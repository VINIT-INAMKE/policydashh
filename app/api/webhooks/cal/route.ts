import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/src/db'
import { workshops, workshopRegistrations } from '@/src/db/schema/workshops'
import { workflowTransitions } from '@/src/db/schema/workflow'
import { verifyCalSignature } from '@/src/lib/cal-signature'
import {
  sendWorkshopRegistrationReceived,
  sendWorkshopFeedbackInvite,
  sendWorkshopCompleted,
} from '@/src/inngest/events'

/**
 * Cal.com webhook handler (Phase 20, Plan 20-03, requirements WS-09/WS-10/WS-11).
 *
 * Pipeline:
 *   1. Read raw body BEFORE JSON.parse (signature covers raw bytes).
 *   2. Verify x-cal-signature-256 via verifyCalSignature(). Missing or invalid
 *      signature → 401. Missing CAL_WEBHOOK_SECRET → 500.
 *   3. Parse body, defensive extract bookingData = body.payload ?? body (cal.com
 *      historically shipped MEETING_ENDED flat-at-root; we accept either shape).
 *   4. Dispatch by triggerEvent — BOOKING_CREATED, BOOKING_CANCELLED,
 *      BOOKING_RESCHEDULED, MEETING_ENDED. Unknown trigger → 200 { ignored }.
 *
 * Idempotency: UNIQUE INDEX on workshop_registrations.booking_uid +
 * .onConflictDoNothing() per D-15. No processedWebhookEvents table.
 *
 * BOOKING_RESCHEDULED correction (20-RESEARCH.md Pitfall 1): cal.com creates a
 * NEW uid on reschedule; the ORIGINAL uid is in payload.rescheduleUid. Handler
 * matches WHERE booking_uid = rescheduleUid and rewrites to the new uid.
 *
 * Walk-ins (D-12): MEETING_ENDED attendee emails with no prior registration
 * synthesize a row with bookingUid = `walkin:{workshopId}:{sha256(email)}`.
 */

export const runtime = 'nodejs'

type CalAttendee = {
  email: string
  name?: string | null
  noShow?: boolean
}

type CalPayload = {
  uid?: string
  rescheduleUid?: string
  startTime?: string
  endTime?: string
  attendees?: CalAttendee[]
  eventTypeId?: number
  [k: string]: unknown
}

type CalWebhookBody = {
  triggerEvent?: string
  payload?: CalPayload
  [k: string]: unknown
}

function emailHashOf(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex')
}

function walkinBookingUid(workshopId: string, email: string): string {
  return `walkin:${workshopId}:${emailHashOf(email)}`
}

async function findWorkshopByCalEventTypeId(
  eventTypeId: number | string | undefined,
): Promise<string | null> {
  if (eventTypeId === undefined || eventTypeId === null) return null
  const [row] = await db
    .select({ id: workshops.id })
    .from(workshops)
    .where(eq(workshops.calcomEventTypeId, String(eventTypeId)))
    .limit(1)
  return row?.id ?? null
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CAL_WEBHOOK_SECRET
  if (!secret) return new Response('Misconfigured', { status: 500 })

  // WS-09: raw body FIRST, verify BEFORE JSON.parse
  const rawBody = await req.text()
  const sigHeader = req.headers.get('x-cal-signature-256')

  if (!verifyCalSignature(rawBody, sigHeader, secret)) {
    return new Response('Invalid signature', { status: 401 })
  }

  let body: CalWebhookBody
  try {
    body = JSON.parse(rawBody) as CalWebhookBody
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // Defensive parse: MEETING_ENDED historically shipped data flat-at-root.
  const bookingData: CalPayload =
    (body.payload ?? (body as unknown as CalPayload)) ?? {}

  try {
    switch (body.triggerEvent) {
      case 'BOOKING_CREATED': {
        const workshopId = await findWorkshopByCalEventTypeId(bookingData.eventTypeId)
        if (!workshopId) return new Response('OK (no workshop)', { status: 200 })

        const attendee = bookingData.attendees?.[0]
        if (!attendee?.email || !bookingData.uid || !bookingData.startTime) {
          return new Response('OK (missing fields)', { status: 200 })
        }

        const emailHash = emailHashOf(attendee.email)

        await db
          .insert(workshopRegistrations)
          .values({
            workshopId,
            bookingUid: bookingData.uid,
            email: attendee.email,
            emailHash,
            name: attendee.name ?? null,
            bookingStartTime: new Date(bookingData.startTime),
            status: 'registered',
          })
          .onConflictDoNothing({ target: workshopRegistrations.bookingUid })

        await sendWorkshopRegistrationReceived({
          workshopId,
          email: attendee.email,
          emailHash,
          name: attendee.name ?? '',
          bookingUid: bookingData.uid,
          source: 'cal_booking',
        })

        return new Response('OK', { status: 200 })
      }

      case 'BOOKING_CANCELLED': {
        if (!bookingData.uid) return new Response('OK', { status: 200 })
        await db
          .update(workshopRegistrations)
          .set({
            status: 'cancelled',
            cancelledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(workshopRegistrations.bookingUid, bookingData.uid))
        return new Response('OK', { status: 200 })
      }

      case 'BOOKING_RESCHEDULED': {
        // RESEARCH CORRECTION (20-RESEARCH.md Pitfall 1): match on the ORIGINAL
        // uid (rescheduleUid), update booking_uid to the NEW uid.
        const origUid = bookingData.rescheduleUid
        const newUid = bookingData.uid
        if (!origUid || !newUid || !bookingData.startTime) {
          return new Response('OK', { status: 200 })
        }
        await db
          .update(workshopRegistrations)
          .set({
            bookingUid: newUid,
            bookingStartTime: new Date(bookingData.startTime),
            status: 'rescheduled',
            updatedAt: new Date(),
          })
          .where(eq(workshopRegistrations.bookingUid, origUid))
        return new Response('OK', { status: 200 })
      }

      case 'MEETING_ENDED': {
        const workshopId = await findWorkshopByCalEventTypeId(bookingData.eventTypeId)
        if (!workshopId) return new Response('OK (no workshop)', { status: 200 })

        const [workshop] = await db
          .select()
          .from(workshops)
          .where(eq(workshops.id, workshopId))
          .limit(1)
        if (!workshop) return new Response('OK', { status: 200 })

        // Idempotency: short-circuit if already completed (D-15).
        if (
          workshop.status !== 'completed' &&
          (workshop.status === 'upcoming' || workshop.status === 'in_progress')
        ) {
          const prevStatus = workshop.status
          await db
            .update(workshops)
            .set({ status: 'completed', updatedAt: new Date() })
            .where(eq(workshops.id, workshopId))

          // Phase 17 workflow_transitions audit row. actorId is a text column
          // so we encode the system actor inline.
          await db
            .insert(workflowTransitions)
            .values({
              entityType: 'workshop',
              entityId: workshopId,
              fromState: prevStatus,
              toState: 'completed',
              actorId: 'system:cal-webhook',
              metadata: { source: 'cal.com', trigger: 'MEETING_ENDED' },
            })

          // Fire the Phase 17 workshop.completed pipeline (evidence nudges).
          await sendWorkshopCompleted({
            workshopId,
            moderatorId: workshop.createdBy,
          }).catch((err) => {
            console.error('[cal-webhook] sendWorkshopCompleted failed', err)
          })
        }

        // Backfill attendance + handle walk-ins.
        const attendees = bookingData.attendees ?? []
        for (const a of attendees) {
          if (!a.email) continue
          const emailHash = emailHashOf(a.email)

          const [existing] = await db
            .select()
            .from(workshopRegistrations)
            .where(
              and(
                eq(workshopRegistrations.workshopId, workshopId),
                eq(workshopRegistrations.email, a.email),
              ),
            )
            .limit(1)

          if (existing) {
            if (!existing.attendedAt) {
              await db
                .update(workshopRegistrations)
                .set({
                  attendedAt: new Date(),
                  attendanceSource: 'cal_meeting_ended',
                  updatedAt: new Date(),
                })
                .where(eq(workshopRegistrations.id, existing.id))
            }
          } else {
            // Walk-in (D-12): synthesize deterministic bookingUid.
            const walkUid = walkinBookingUid(workshopId, a.email)
            await db
              .insert(workshopRegistrations)
              .values({
                workshopId,
                bookingUid: walkUid,
                email: a.email,
                emailHash,
                name: a.name ?? null,
                bookingStartTime: workshop.scheduledAt,
                status: 'registered',
                attendedAt: new Date(),
                attendanceSource: 'cal_meeting_ended',
              })
              .onConflictDoNothing({ target: workshopRegistrations.bookingUid })

            // Walk-ins also enqueue the Clerk invite + welcome email flow.
            await sendWorkshopRegistrationReceived({
              workshopId,
              email: a.email,
              emailHash,
              name: a.name ?? '',
              bookingUid: walkUid,
              source: 'walk_in',
            }).catch((err) => {
              console.error(
                '[cal-webhook] sendWorkshopRegistrationReceived (walk-in) failed',
                err,
              )
            })
          }

          // Emit one feedback invite per attendee.
          await sendWorkshopFeedbackInvite({
            workshopId,
            email: a.email,
            name: a.name ?? '',
            attendeeUserId: null,
          }).catch((err) => {
            console.error('[cal-webhook] sendWorkshopFeedbackInvite failed', err)
          })
        }

        return new Response('OK', { status: 200 })
      }

      default:
        return new Response('OK (ignored)', { status: 200 })
    }
  } catch (err) {
    console.error('[cal-webhook] error:', err)
    return new Response('Internal error', { status: 500 })
  }
}
