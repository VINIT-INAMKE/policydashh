import { createHash } from 'node:crypto'
import { ZodError } from 'zod'
import { revalidateTag } from 'next/cache'
import { and, eq, inArray, desc, like, isNull, sql as drizzleSql } from 'drizzle-orm'
import { db } from '@/src/db'
import { workshops, workshopRegistrations } from '@/src/db/schema/workshops'
import { workflowTransitions } from '@/src/db/schema/workflow'
import { processedWebhookEvents } from '@/src/db/schema/processed-webhook-events'
import { verifyCalSignature } from '@/src/lib/cal-signature'
import {
  cascadePattern,
  COMPOSITE_BOOKING_UID_DELIMITER,
  UID_SAFE,
} from '@/src/lib/calcom'
import { SYSTEM_ACTOR_UUID } from '@/src/lib/constants'
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
 * Cal.com webhook handler (Phase 20, Plan 20-03 — WS-09 / WS-10 / WS-11).
 *
 * Pipeline:
 *   1. Read raw body BEFORE JSON.parse (signature covers raw bytes).
 *   2. Verify x-cal-signature-256 via verifyCalSignature(). Missing or
 *      invalid signature → 401. Missing CAL_WEBHOOK_SECRET → 500.
 *   3. Parse body, defensive extract `bookingData = body.payload ?? body`
 *      (cal.com historically shipped MEETING_ENDED flat-at-root; we accept
 *      either shape).
 *   4. Dispatch by triggerEvent:
 *      - BOOKING_CREATED     → no-op 200. Under the seated-booking model
 *                              the root booking is created server-side and
 *                              attendee-adds don't fire this webhook.
 *      - BOOKING_CANCELLED   → seatUid-aware lookup:
 *                              a) if the payload carries `seatUid` /
 *                                 `seatReferenceUid`, treat as a seat-level
 *                                 cancel (exact-match update on the seat's
 *                                 composite `booking_uid`).
 *                              b) otherwise probe
 *                                 `workshops.calcomBookingUid` with the
 *                                 root uid; on match cascade every seat via
 *                                 LIKE `${rootUid}:%` (cascadePattern).
 *                              c) on no root match, fall back to an
 *                                 exact-match OR across `seatUid`,
 *                                 `seatReferenceUid`, `uid`.
 *      - BOOKING_RESCHEDULED → atomic root rewrite:
 *                              a) if the payload's uid corresponds to a
 *                                 workshop root, rewrite the workshop row
 *                                 AND every registration's composite prefix
 *                                 in two SQL statements (no N+1).
 *                              b) otherwise seat-level exact-match rewrite
 *                                 across seatUid / seatReferenceUid /
 *                                 rescheduleUid candidates.
 *      - MEETING_ENDED       → flip workshop → completed (idempotent),
 *                              backfill attendance, synthesize walk-in rows
 *                              for attendees without a prior registration,
 *                              batch-enqueue all feedback invites in a
 *                              single Inngest send.
 *      - unknown             → 200 `{ ignored }` with a console.info so the
 *                              observability dashboard surfaces a new
 *                              trigger name immediately.
 *
 * Idempotency: UNIQUE INDEX on `workshop_registrations.booking_uid` +
 * `.onConflictDoNothing()`. No processedWebhookEvents table.
 *
 * SAFETY: every uid interpolated into a SQL LIKE pattern is first checked
 * against `UID_SAFE` (`src/lib/calcom.ts`). Unsafe uids fall through to the
 * exact-match branch, which is drizzle-parameterised and wildcard-safe.
 *
 * Walk-ins: MEETING_ENDED attendee emails with no prior registration
 * synthesize a row with bookingUid = `walkin:{workshopId}:{sha256(email)}`.
 * See `src/server/routers/workshop.ts`'s `listRegistrations` for how these
 * surface in the moderator UI.
 */

export const runtime = 'nodejs'

type CalAttendee = {
  email: string
  name?: string | null
  /**
   * Cal.com sometimes populates `noShow: true` on MEETING_ENDED attendees
   * who registered but were not detected in the meeting. We log the flag
   * so moderators can reconcile attendance manually — the seated-event
   * model already records `attendedAt` from the webhook's attendee list,
   * so honouring `noShow` would require a deeper attendance rework.
   */
  noShow?: boolean
}

type CalPayload = {
  uid?: string
  /**
   * Cal.com seated-event webhooks historically carry the per-seat identity
   * in a dedicated `seatUid` field on BOOKING_CANCELLED / BOOKING_RESCHEDULED
   * (docs disagree across versions; newer payloads may use `seatReferenceUid`
   * or continue to overload `uid`). We look at all three so the handler
   * tolerates any shape cal.com ships.
   */
  seatUid?: string
  seatReferenceUid?: string
  rescheduleUid?: string
  startTime?: string
  endTime?: string
  attendees?: CalAttendee[]
  eventTypeId?: number
  /**
   * Audit 2026-04-27: cal.com's BOOKING_RESCHEDULED payload may include a
   * fresh meeting URL (Google Meet rotates the link on reschedule for
   * seated bookings in some configs). Mirror the createCalBooking() shape
   * — `meetingUrl` first, fall back to `location`. We refresh
   * `workshops.meetingUrl` when this lands; today our column was set
   * exactly once at provision-time and would silently drift.
   */
  meetingUrl?: string
  location?: string
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

/**
 * Collect every plausible seat-level candidate uid from the payload, trimmed
 * and de-duplicated. Empty strings and whitespace-only values are dropped.
 *
 * Used by both BOOKING_CANCELLED and BOOKING_RESCHEDULED fallbacks so they
 * target the same uid set regardless of which field cal.com populated.
 */
function seatCandidates(p: CalPayload): string[] {
  return Array.from(
    new Set(
      [p.seatUid, p.seatReferenceUid, p.uid]
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter((v) => v.length > 0),
    ),
  )
}

async function findWorkshopByCalEventTypeId(
  eventTypeId: number | string | undefined,
): Promise<string | null> {
  // M-4 (audit 2026-04-27 wide review): use loose null check so legitimate
  // eventTypeId === 0 (theoretically valid in cal.com's id space) doesn't
  // get coerced to "no workshop". Strict `=== undefined || === null` was
  // fine in practice but the loose check is more defensible.
  if (eventTypeId == null) return null
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
    // B2-12: surface the trigger name + a sig-header prefix so an
    // attacker probing the endpoint is visible in logs without leaking
    // the full header value. Truncate to 8 chars — enough to distinguish
    // two nearby failures, not enough to reconstruct the secret.
    let triggerPreview: string | null = null
    try {
      const peek = JSON.parse(rawBody) as { triggerEvent?: unknown }
      if (typeof peek.triggerEvent === 'string') triggerPreview = peek.triggerEvent
    } catch {
      /* unparseable — fine, observability only */
    }
    console.warn('[cal-webhook] invalid signature', {
      triggerEvent: triggerPreview,
      sigPrefix:    sigHeader ? sigHeader.slice(0, 8) : null,
    })
    return new Response('Invalid signature', { status: 401 })
  }

  let body: CalWebhookBody
  try {
    body = JSON.parse(rawBody) as CalWebhookBody
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  // Defensive parse: MEETING_ENDED historically shipped data flat-at-root.
  // B2-4: drop the redundant `?? {}` — `body.payload ?? body` is never
  // nullish when `body` has already parsed successfully.
  const bookingData: CalPayload =
    body.payload ?? (body as unknown as CalPayload)

  // M2 (audit 2026-04-27): replay protection. HMAC verifies authenticity
  // but not freshness; a captured signature stays valid forever. We
  // compute a deterministic event id from the payload — booking uid +
  // triggerEvent + (startTime || endTime || createdAt) — and INSERT into
  // processed_webhook_events ON CONFLICT DO NOTHING. If RETURNING is
  // empty the event was already processed; return 200 immediately and
  // skip the side-effecting branch.
  const triggerEvent = body.triggerEvent ?? 'unknown'
  // H-6 (audit 2026-04-27 wide review): include seat-level identifiers so
  // BOOKING_RESCHEDULED variants (cal.com payload may carry only seatUid /
  // seatReferenceUid / rescheduleUid, not always uid) get distinct hashes.
  // Without this, two seat-level reschedules of the same root booking with
  // the same startTime would collide in the dedup hash and the second
  // delivery would be misclassified as a replay.
  const eventIdSource = [
    bookingData.uid ?? '',
    bookingData.seatUid ?? '',
    bookingData.seatReferenceUid ?? '',
    bookingData.rescheduleUid ?? '',
    triggerEvent,
    bookingData.startTime ?? bookingData.endTime ?? '',
  ].join('|')
  // SHA-256 hex (64 chars) keeps the PRIMARY KEY bounded and avoids
  // smuggling `;` or `'` into the column even though drizzle parameterises.
  const eventId =
    createHash('sha256').update(eventIdSource).digest('hex')
  // Skip dedup for events whose source string is fully empty (no uid /
  // seatUid / seatReferenceUid / rescheduleUid + no startTime/endTime).
  // The downside: those replay through; but the signature gate already
  // catches the replay-with-stolen-secret threat for fresh requests.
  // Count empties from the join: 6 segments + 5 separators = 11 chars
  // when ALL primary fields are empty (only the trigger string remains).
  const skipReplayCheck = eventIdSource.replace(/[^|]/g, '').length === 5 &&
    eventIdSource.split('|').every((seg, i) => i === 4 || seg === '')
  if (!skipReplayCheck) {
    const inserted = await db
      .insert(processedWebhookEvents)
      .values({ eventId, triggerEvent })
      .onConflictDoNothing({ target: processedWebhookEvents.eventId })
      .returning({ eventId: processedWebhookEvents.eventId })
    if (inserted.length === 0) {
      console.info('[cal-webhook] dedup: replay ignored', {
        eventId, triggerEvent,
      })
      return new Response('OK (replay)', { status: 200 })
    }
  }

  try {
    switch (body.triggerEvent) {
      case 'BOOKING_CREATED': {
        // H4 (audit 2026-04-27): we expect cal.com to NOT fire this
        // webhook for seat-adds under the seated-booking model. If we
        // start receiving it, cal.com's behavior has drifted (API version
        // bump, an admin manually creating a booking via cal.com console,
        // etc.) and the silent 200 would mean we never create a
        // workshop_registrations row for that attendee. WARN with the
        // identifying fields so the operator notices in the dashboard.
        console.warn(
          '[cal-webhook] BOOKING_CREATED unexpectedly fired — seat-add semantics may have drifted',
          {
            uid: bookingData.uid ?? null,
            eventTypeId: bookingData.eventTypeId ?? null,
          },
        )
        return new Response('OK (ignored in new model)', { status: 200 })
      }

      case 'BOOKING_CANCELLED': {
        // Prefer seat-level identity when present (`seatUid` /
        // `seatReferenceUid`) — those are per-attendee fields cal.com
        // populates for seated-event cancellations. When neither is set
        // we fall back to the booking-level `uid`.
        const hasSeatId =
          typeof bookingData.seatUid === 'string' ||
          typeof bookingData.seatReferenceUid === 'string'
        const rootCandidateUid = hasSeatId ? null : bookingData.uid

        // SAFETY: fall through to exact match when the uid fails UID_SAFE —
        // prevents SQL LIKE wildcard injection if cal.com's uid format ever
        // widens. Shared guard in `src/lib/calcom.ts`.
        const rootCandidateSafe =
          rootCandidateUid !== undefined &&
          rootCandidateUid !== null &&
          UID_SAFE.test(rootCandidateUid)

        const workshopIdForRoot = rootCandidateSafe
          ? await findWorkshopByRootBookingUid(rootCandidateUid!)
          : null

        if (workshopIdForRoot) {
          // B2-3: defensively log when a payload carries a seat id but we
          // still took the cascade branch. Current control flow makes this
          // unreachable, but a future edit that widens `rootCandidateUid`
          // would silently cascade across every seat — the warning makes
          // that regression loud.
          if (hasSeatId) {
            console.warn(
              '[cal-webhook] BOOKING_CANCELLED unexpected: seat id present but cascade taken',
              { workshopId: workshopIdForRoot, uid: rootCandidateUid },
            )
          }
          await db
            .update(workshopRegistrations)
            .set({
              status:      'cancelled',
              cancelledAt: new Date(),
              updatedAt:   new Date(),
            })
            .where(
              like(
                workshopRegistrations.bookingUid,
                cascadePattern(rootCandidateUid!),
              ),
            )
          // B2-5: revalidateTag is unconditional here even when the UPDATE
          // hits zero rows (replay). The cost is a cache-key bust with no
          // downstream effect; correctness > micro-optimisation.
          revalidateTag(spotsTag(workshopIdForRoot), 'max')
        } else {
          // Exact-match fallback targets the individual seat. We try every
          // plausible candidate identifier because cal.com's seat-cancel
          // payload shape has drifted across versions — OR'ing across them
          // lands the cancellation wherever our composite booking_uid was
          // stored. B2-11: `seatCandidates` trims each value before the
          // length check so a stray space in a malformed payload doesn't
          // slip through as a valid "candidate".
          const candidates = seatCandidates(bookingData)
          if (candidates.length === 0) return new Response('OK', { status: 200 })

          const cancelled = await db
            .update(workshopRegistrations)
            .set({
              status:      'cancelled',
              cancelledAt: new Date(),
              updatedAt:   new Date(),
            })
            .where(inArray(workshopRegistrations.bookingUid, candidates))
            .returning({ workshopId: workshopRegistrations.workshopId })
          for (const row of cancelled) {
            if (row.workshopId) revalidateTag(spotsTag(row.workshopId), 'max')
          }
        }

        return new Response('OK', { status: 200 })
      }

      case 'BOOKING_RESCHEDULED': {
        // B2-1: seat-level reschedules historically only carried
        // `rescheduleUid`. Newer cal.com seated-event payloads may ship
        // `seatUid` / `seatReferenceUid` as the original identity on
        // reschedule — same shape drift as BOOKING_CANCELLED. Build the
        // candidate set the same way we do for cancel so the exact-match
        // fallback lands wherever our composite booking_uid was stored.
        const origUid = bookingData.rescheduleUid
        const newUid  = bookingData.uid
        if (!origUid || !newUid || !bookingData.startTime) {
          return new Response('OK', { status: 200 })
        }

        // B2-2: newUid is interpolated into the composite-rebuild SQL via
        // `${newUid} || ':' || substring(...)`. Drizzle parameterises the
        // value, but we still gate via UID_SAFE so an unexpected payload
        // (future cal.com uid change) can't corrupt the stored prefix
        // shape. Unsafe newUid → short-circuit 200 so cal.com doesn't
        // retry indefinitely while we investigate.
        if (!UID_SAFE.test(newUid)) {
          console.warn(
            '[cal-webhook] BOOKING_RESCHEDULED newUid failed UID_SAFE, skipping',
            { newUid },
          )
          return new Response('OK (unsafe newUid)', { status: 200 })
        }

        const newStart = new Date(bookingData.startTime)

        // SAFETY: same wildcard guard as BOOKING_CANCELLED — only match via
        // LIKE when origUid is format-safe. Shared UID_SAFE.
        const origIsSafe = UID_SAFE.test(origUid)

        const workshopIdForRoot = origIsSafe
          ? await findWorkshopByRootBookingUid(origUid)
          : null

        if (workshopIdForRoot) {
          // Workshop-level reschedule: atomically rewrite the workshop row
          // AND every registration's composite booking_uid prefix +
          // bookingStartTime in TWO SQL statements (no N+1 loop). Prior
          // implementation walked rows in a loop — on a 100-seat workshop
          // that is ~100 Neon HTTP round-trips and a mid-flight process
          // death left the workshop + some rows pointing at different uids.
          //
          // The registrations UPDATE uses Postgres' CONCAT + SUBSTRING to
          // swap the prefix in-place: the stored composite is
          // `${origUid}:${attendeeId}`, so starting from position
          // (origUid.length + 2) yields just the trailing attendeeId, and
          // prepending `${newUid}:` reassembles the composite with the new
          // root uid. Replay-safe: a re-fired webhook after the workshop
          // row already holds newUid (and the children too) simply can't
          // match `booking_uid LIKE '${origUid}:%'` anymore — the whole
          // handler becomes a harmless no-op.
          //
          // Audit 2026-04-27 crack #1: refresh `meetingUrl` if the payload
          // carries one. Cal.com may rotate the Meet link on reschedule
          // for seated bookings; without this, our stored URL silently
          // drifts away from what attendees see in their cal.com email.
          const freshMeetingUrl =
            typeof bookingData.meetingUrl === 'string'
              ? bookingData.meetingUrl
              : typeof bookingData.location === 'string'
                ? bookingData.location
                : null
          await db
            .update(workshops)
            .set({
              calcomBookingUid: newUid,
              scheduledAt:      newStart,
              ...(freshMeetingUrl !== null ? { meetingUrl: freshMeetingUrl } : {}),
              updatedAt:        new Date(),
            })
            .where(eq(workshops.id, workshopIdForRoot))

          await db
            .update(workshopRegistrations)
            .set({
              bookingUid: drizzleSql`${newUid} || ${COMPOSITE_BOOKING_UID_DELIMITER} || substring(${workshopRegistrations.bookingUid} from ${origUid.length + 2})`,
              bookingStartTime: newStart,
              status:           'rescheduled',
              updatedAt:        new Date(),
            })
            .where(like(workshopRegistrations.bookingUid, cascadePattern(origUid)))

          revalidateTag(spotsTag(workshopIdForRoot), 'max')
          return new Response('OK', { status: 200 })
        }

        // Seat-level fallback. B2-1: match against every plausible
        // candidate identifier cal.com could have populated as the ORIGINAL
        // seat uid on a reschedule. `uid` is excluded intentionally — in
        // BOOKING_RESCHEDULED it holds the NEW uid, not the original.
        const candidates = Array.from(
          new Set(
            [bookingData.seatUid, bookingData.seatReferenceUid, origUid]
              .map((v) => (typeof v === 'string' ? v.trim() : ''))
              .filter((v) => v.length > 0 && v !== newUid),
          ),
        )
        if (candidates.length === 0) return new Response('OK', { status: 200 })

        const updated = await db
          .update(workshopRegistrations)
          .set({
            bookingUid:       newUid,
            bookingStartTime: newStart,
            status:           'rescheduled',
            updatedAt:        new Date(),
          })
          .where(inArray(workshopRegistrations.bookingUid, candidates))
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
        // retired.
        if (workshop.status === 'archived') {
          console.warn(
            '[cal-webhook] MEETING_ENDED ignored for archived workshop',
            { workshopId },
          )
          return new Response('OK (archived)', { status: 200 })
        }

        // Idempotency: short-circuit the status flip + audit row when
        // we've already moved to completed. The workflow_transitions
        // insert uses SYSTEM_ACTOR_UUID (not the literal 'system:cal-webhook'
        // string the prior code used) because migration 0029 tightened
        // actor_id to uuid; the metadata still carries the human-readable
        // source label.
        if (
          workshop.status !== 'completed' &&
          (workshop.status === 'upcoming' || workshop.status === 'in_progress')
        ) {
          const prevStatus = workshop.status
          await db
            .update(workshops)
            .set({ status: 'completed', updatedAt: new Date() })
            .where(eq(workshops.id, workshopId))

          await db
            .insert(workflowTransitions)
            .values({
              entityType: 'workshop',
              entityId: workshopId,
              fromState: prevStatus,
              toState: 'completed',
              actorId: SYSTEM_ACTOR_UUID,
              metadata: { source: 'cal.com', trigger: 'MEETING_ENDED' },
            })
        }

        // M3 (audit 2026-04-27): the post-completion fan-out
        // (sendWorkshopCompleted) used to live INSIDE the status-flip
        // guard above. If the flip succeeded but Inngest send failed,
        // the next webhook redelivery saw status === 'completed' and
        // skipped the entire branch — Phase 17 evidence-nudge pipeline
        // never fired. Now we gate on `completionPipelineSentAt` (added
        // in migration 0030) which is stamped only AFTER a successful
        // Inngest send. A retry sees the column null and re-fires.
        // Loose null check (== null) catches both null and undefined so a
        // future schema change that drops the field from the select still
        // defaults to "not yet sent" rather than silently skipping the fan-out.
        if (workshop.completionPipelineSentAt == null) {
          try {
            await sendWorkshopCompleted({
              workshopId,
              moderatorId: workshop.createdBy,
            })
            await db
              .update(workshops)
              .set({ completionPipelineSentAt: new Date() })
              .where(
                and(
                  eq(workshops.id, workshopId),
                  isNull(workshops.completionPipelineSentAt),
                ),
              )
          } catch (err) {
            // Don't stamp the column — the next redelivery will retry.
            // Log loudly so operators see persistent failures.
            console.error(
              '[cal-webhook] sendWorkshopCompleted failed; will retry on next webhook delivery',
              { workshopId, err },
            )
          }
        }

        // Backfill attendance + handle walk-ins.
        //
        // P3: we collect feedback-invite payloads into `feedbackInvites` and
        // emit a single batch `inngest.send([...])` at the end of the loop,
        // replacing the prior N sequential sends. A 50-person workshop used
        // to saturate cal.com's retry window; now it's one network hop.
        //
        // B2-8: walk-in `sendWorkshopRegistrationReceived` calls used to
        // fire sequentially per attendee in the loop; we now collect them
        // and `Promise.all` once below.
        const attendees = bookingData.attendees ?? []
        const feedbackInvites: Array<{
          workshopId: string
          email: string
          name: string
          attendeeUserId: null
        }> = []
        const walkInInvites: Array<{
          workshopId: string
          email: string
          emailHash: string
          name: string
          bookingUid: string
          source: 'walk_in'
        }> = []
        let noShowCount = 0

        for (const a of attendees) {
          if (!a.email) continue
          if (a.noShow) noShowCount++
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
            // Walk-in: synthesize deterministic bookingUid so the row is
            // idempotent across webhook redeliveries. See the
            // `walkinBookingUid` helper + the composite-uid JSDoc in
            // `src/inngest/events.ts`.
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

            // B2-8: queue for a batched Promise.all below.
            walkInInvites.push({
              workshopId,
              email: a.email,
              emailHash,
              name: a.name ?? '',
              bookingUid: walkUid,
              source: 'walk_in',
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

        // L3 (audit 2026-04-27): cal.com has shipped duplicate-attendee
        // entries on rare MEETING_ENDED payloads. Without this dedup we'd
        // double-send feedback invites to the same address. Keep the FIRST
        // occurrence (preserves the name from the earliest entry).
        const dedupedFeedbackInvites = (() => {
          const seen = new Set<string>()
          const out: typeof feedbackInvites = []
          for (const e of feedbackInvites) {
            const key = e.email.toLowerCase().trim()
            if (seen.has(key)) continue
            seen.add(key)
            out.push(e)
          }
          return out
        })()

        // B2-10: surface noShow attendees for observability. Attendance is
        // recorded from cal.com's attendee list (attendees absent from the
        // meeting are still marked attended if they were on the booking),
        // so `noShow` is additional signal moderators may want for manual
        // reconciliation. We log the count rather than auto-reversing
        // attendance — deciding how to treat noShow is a product call.
        if (noShowCount > 0) {
          console.info('[cal-webhook] MEETING_ENDED noShow attendees', {
            workshopId,
            noShowCount,
          })
        }

        // B2-8: walk-in invites — one network round-trip for all of them.
        if (walkInInvites.length > 0) {
          await Promise.all(
            walkInInvites.map((payload) =>
              sendWorkshopRegistrationReceived(payload).catch((err) => {
                console.error(
                  '[cal-webhook] sendWorkshopRegistrationReceived (walk-in) failed',
                  { workshopId: payload.workshopId, err },
                )
              }),
            ),
          )
        }

        // P3 + B2-9: single batch send for all feedback invites, only when
        // there is at least one attendee to invite. L3: dedupe by email
        // first so duplicate cal.com attendee entries don't double-email.
        if (dedupedFeedbackInvites.length > 0) {
          await sendWorkshopFeedbackInvitesBatch(dedupedFeedbackInvites).catch((err) => {
            console.error(
              '[cal-webhook] sendWorkshopFeedbackInvitesBatch failed',
              err,
            )
          })
        }

        return new Response('OK', { status: 200 })
      }

      default: {
        // B2-13: observability for unknown triggers. Cal.com adds trigger
        // events every few releases; logging the name makes the "why is
        // this 200-ignored webhook arriving?" investigation two greps
        // instead of a redeploy.
        console.info('[cal-webhook] unknown trigger ignored', {
          triggerEvent: body.triggerEvent ?? null,
        })
        return new Response('OK (ignored)', { status: 200 })
      }
    }
  } catch (err) {
    // M4 (audit 2026-04-27): distinguish recoverable from unrecoverable
    // failures so cal.com doesn't retry forever on a poison-pill payload.
    // ZodError + SyntaxError + plain TypeError on payload shape are
    // unrecoverable — no amount of retry will turn a malformed payload
    // into a valid one — so we 200 + log loudly. Genuinely transient
    // failures (network blip, Neon timeout) keep the 500 path so cal.com
    // retries with backoff.
    if (
      err instanceof ZodError ||
      err instanceof SyntaxError ||
      err instanceof TypeError
    ) {
      console.error(
        '[cal-webhook] unrecoverable payload error — returning 200 to stop retries',
        {
          triggerEvent: body.triggerEvent ?? null,
          err: err instanceof Error ? err.message : String(err),
        },
      )
      return new Response('OK (unrecoverable)', { status: 200 })
    }
    console.error('[cal-webhook] error:', err)
    return new Response('Internal error', { status: 500 })
  }
}
