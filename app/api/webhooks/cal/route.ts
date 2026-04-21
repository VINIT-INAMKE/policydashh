import { createHash } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { and, eq, inArray, desc, like } from 'drizzle-orm'
import { db } from '@/src/db'
import { workshops, workshopRegistrations } from '@/src/db/schema/workshops'
import { workflowTransitions } from '@/src/db/schema/workflow'
import { verifyCalSignature } from '@/src/lib/cal-signature'
import {
  sendWorkshopRegistrationReceived,
  sendWorkshopFeedbackInvitesBatch,
  sendWorkshopCompleted,
} from '@/src/inngest/events'

// F5: tag prefix matching the unstable_cache tag written by
// `src/server/queries/workshops-public.ts`. Keep the prefix in lockstep with
// that file.
function spotsTag(workshopId: string): string {
  return `workshop-spots-${workshopId}`
}

/**
 * Cal.com webhook handler (Phase 20, Plan 20-03, requirements WS-09/WS-10/WS-11).
 *
 * Pipeline:
 *   1. Read raw body BEFORE JSON.parse (signature covers raw bytes).
 *   2. Verify x-cal-signature-256 via verifyCalSignature(). Missing or invalid
 *      signature → 401. Missing CAL_WEBHOOK_SECRET → 500.
 *   3. Parse body, defensive extract bookingData = body.payload ?? body (cal.com
 *      historically shipped MEETING_ENDED flat-at-root; we accept either shape).
 *   4. Dispatch by triggerEvent - BOOKING_CREATED, BOOKING_CANCELLED,
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

// Defensive guard before interpolating a cal.com uid into a SQL LIKE pattern.
// Cal.com documents uids as alphanumeric today; this regex is the authoritative
// format assertion. If the uid fails, cascade paths fall through to exact-match
// only — a malformed uid won't cascade but also can't corrupt data via
// injected `%` / `_` / `\` wildcards.
const UID_SAFE = /^[A-Za-z0-9_-]+$/

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

async function findWorkshopByRootBookingUid(
  bookingUid: string | undefined,
): Promise<string | null> {
  if (!bookingUid) return null
  const [row] = await db
    .select({ id: workshops.id })
    .from(workshops)
    .where(eq(workshops.calcomBookingUid, bookingUid))
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
        // No-op: the root seated booking is created server-side by
        // workshopCreatedFn, and subsequent attendee-adds do NOT fire this
        // webhook. Return 200 to satisfy cal.com's delivery contract in
        // case any future shape does fire it.
        return new Response('OK (ignored in new model)', { status: 200 })
      }

      case 'BOOKING_CANCELLED': {
        if (!bookingData.uid) return new Response('OK', { status: 200 })

        // SAFETY: fall through to exact match when the uid fails UID_SAFE —
        // prevents SQL LIKE wildcard injection if cal.com's uid format ever
        // widens. Guard is declared at module scope.
        const uidIsSafeForLike = UID_SAFE.test(bookingData.uid)

        // If this uid is a workshop's root booking, cascade-cancel every
        // registration for that workshop. Otherwise treat uid as an
        // individual seat's booking_uid (attendee-self-cancel or legacy
        // per-seat cancel shape) and update only that row.
        const workshopIdForRoot = uidIsSafeForLike
          ? await findWorkshopByRootBookingUid(bookingData.uid)
          : null

        if (workshopIdForRoot) {
          await db
            .update(workshopRegistrations)
            .set({
              status:      'cancelled',
              cancelledAt: new Date(),
              updatedAt:   new Date(),
            })
            .where(like(workshopRegistrations.bookingUid, `${bookingData.uid}:%`))
          revalidateTag(spotsTag(workshopIdForRoot), 'max')
        } else {
          const cancelled = await db
            .update(workshopRegistrations)
            .set({
              status:      'cancelled',
              cancelledAt: new Date(),
              updatedAt:   new Date(),
            })
            .where(eq(workshopRegistrations.bookingUid, bookingData.uid))
            .returning({ workshopId: workshopRegistrations.workshopId })
          for (const row of cancelled) {
            if (row.workshopId) revalidateTag(spotsTag(row.workshopId), 'max')
          }
        }

        return new Response('OK', { status: 200 })
      }

      case 'BOOKING_RESCHEDULED': {
        const origUid = bookingData.rescheduleUid
        const newUid  = bookingData.uid
        if (!origUid || !newUid || !bookingData.startTime) {
          return new Response('OK', { status: 200 })
        }
        const newStart = new Date(bookingData.startTime)

        // SAFETY: same wildcard guard as BOOKING_CANCELLED — only match via
        // LIKE when origUid is format-safe. Module-scope UID_SAFE.
        const origIsSafe = UID_SAFE.test(origUid)

        const workshopIdForRoot = origIsSafe
          ? await findWorkshopByRootBookingUid(origUid)
          : null

        if (workshopIdForRoot) {
          // Workshop-level reschedule: update the workshop row AND every
          // registration's booking_uid prefix + bookingStartTime.
          await db
            .update(workshops)
            .set({
              calcomBookingUid: newUid,
              scheduledAt:      newStart,
              updatedAt:        new Date(),
            })
            .where(eq(workshops.id, workshopIdForRoot))

          // Rewrite each child registration's composite booking_uid prefix.
          // We cannot express the prefix-swap purely in SQL with drizzle's
          // query builder, so fetch + update in a loop. Ranges are small
          // (≤ maxSeats) so this is fine.
          const rows = await db
            .select({ id: workshopRegistrations.id, bookingUid: workshopRegistrations.bookingUid })
            .from(workshopRegistrations)
            .where(like(workshopRegistrations.bookingUid, `${origUid}:%`))

          for (const row of rows) {
            const suffix = row.bookingUid.slice(origUid.length + 1)
            await db
              .update(workshopRegistrations)
              .set({
                bookingUid:       `${newUid}:${suffix}`,
                bookingStartTime: newStart,
                status:           'rescheduled',
                updatedAt:        new Date(),
              })
              .where(eq(workshopRegistrations.id, row.id))
          }

          revalidateTag(spotsTag(workshopIdForRoot), 'max')
          return new Response('OK', { status: 200 })
        }

        // Fall back to seat-level reschedule (exact bookingUid match).
        const updated = await db
          .update(workshopRegistrations)
          .set({
            bookingUid:       newUid,
            bookingStartTime: newStart,
            status:           'rescheduled',
            updatedAt:        new Date(),
          })
          .where(eq(workshopRegistrations.bookingUid, origUid))
          .returning({ workshopId: workshopRegistrations.workshopId })

        for (const row of updated) {
          if (row.workshopId) revalidateTag(spotsTag(row.workshopId), 'max')
        }
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

        // S5: archived workshops are no longer soliciting feedback. Skip
        // BOTH the status transition AND the attendee loop so we don't
        // email feedback invites on a workshop that was intentionally
        // retired. The guard below already excludes `archived` from the
        // status flip, but the loop ran unconditionally after it.
        if (workshop.status === 'archived') {
          console.warn(
            '[cal-webhook] MEETING_ENDED ignored for archived workshop',
            { workshopId },
          )
          return new Response('OK (archived)', { status: 200 })
        }

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
        //
        // P3: we collect feedback-invite payloads into `feedbackInvites` and
        // emit a single batch `inngest.send([...])` at the end of the loop,
        // replacing the prior N sequential sends. A 50-person workshop used
        // to saturate cal.com's retry window; now it's one network hop.
        const attendees = bookingData.attendees ?? []
        const feedbackInvites: Array<{
          workshopId: string
          email: string
          name: string
          attendeeUserId: null
        }> = []

        for (const a of attendees) {
          if (!a.email) continue
          const emailHash = emailHashOf(a.email)

          // F7: match on (workshopId, email, status in ('registered',
          // 'rescheduled')) and take the latest booking. Previous code
          // ignored status entirely so a prior 'cancelled' row could shadow
          // the real current booking.
          const [existing] = await db
            .select()
            .from(workshopRegistrations)
            .where(
              and(
                eq(workshopRegistrations.workshopId, workshopId),
                eq(workshopRegistrations.email, a.email),
                inArray(workshopRegistrations.status, ['registered', 'rescheduled']),
              ),
            )
            .orderBy(desc(workshopRegistrations.bookingStartTime))
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

          // P3: queue the feedback invite for a batch send below.
          feedbackInvites.push({
            workshopId,
            email: a.email,
            name: a.name ?? '',
            attendeeUserId: null,
          })
        }

        // P3: single batch send for all feedback invites.
        await sendWorkshopFeedbackInvitesBatch(feedbackInvites).catch((err) => {
          console.error('[cal-webhook] sendWorkshopFeedbackInvitesBatch failed', err)
        })

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
