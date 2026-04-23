import { NonRetriableError } from 'inngest'
import { eq } from 'drizzle-orm'
import { inngest } from '../client'
import { db } from '@/src/db'
import { workshops } from '@/src/db/schema/workshops'
import {
  createCalEventType,
  createCalBooking,
  CalApiError,
  DEFAULT_SEATS_PER_TIME_SLOT,
  WORKSHOP_CREATED_EVENT,
} from '@/src/lib/calcom'

/**
 * workshopCreatedFn - async cal.com event-type provisioning for WS-07.
 *
 * Triggered by the `workshop.created` event emitted from the admin create
 * mutation in `src/server/routers/workshop.ts`. Calls cal.com v2 API to
 * provision an event type, creates the root seated booking for the primary
 * attendee (configured via CAL_PRIMARY_ATTENDEE_EMAIL; production:
 * vinay@konma.io), then backfills `workshops.calcomEventTypeId`,
 * `calcomBookingUid`, and `meetingUrl` atomically.
 *
 * Why async (D-01):
 *   - Admin create mutation stays fast (no external API hop).
 *   - Workshop row persists even if cal.com is down, so the admin dashboard
 *     surfaces the row immediately; the public listing (Plan 20-05) gates
 *     the cal.com embed on `calcomEventTypeId IS NOT NULL`.
 *
 * Required env (all validated at boot via `src/lib/env.ts`):
 *   - CAL_API_KEY                    cal.com v2 API credential.
 *   - CAL_PRIMARY_ATTENDEE_EMAIL     address that receives the booking-
 *                                    confirmation email + owns the shared
 *                                    Google Meet link.
 *   - CAL_PRIMARY_ATTENDEE_NAME      name shown in cal.com for the above.
 *
 * Error policy (D-03, mirrors Phase 19 participateIntakeFn):
 *   - cal.com 5xx         → plain Error → Inngest retries up to `retries: 3`.
 *   - cal.com 4xx         → NonRetriableError → no retry (bad input).
 *   - Missing CAL_API_KEY → NonRetriableError (surfaces as CalApiError 400
 *                           from the client; see `src/lib/calcom.ts`).
 *   - Missing workshop    → NonRetriableError (guard; shouldn't happen since
 *                           the event fires right after the insert, but the
 *                           guard makes the contract explicit).
 *
 * Half-provisioned recovery (B4-4): the idempotency guard below short-
 * circuits only when BOTH `calcomEventTypeId` AND `calcomBookingUid` are
 * present. If a prior run backfilled the event-type but died before the
 * booking, re-firing `workshop.created` resumes at the booking step — the
 * event-type is reused (via the `?` branch) and the backfill step writes
 * both fields atomically. An operator can also NULL out one field in the
 * DB to force a partial re-run.
 *
 * Pitfall 4 (Inngest v4 type widening): `triggers` MUST be inlined in the
 * createFunction options object. Extracting to a const collapses `event.data`
 * to `any` inside the handler. Do not refactor. See Phase 19's
 * `participateIntakeFn` for the same pattern.
 */

export const workshopCreatedFn = inngest.createFunction(
  {
    id:      'workshop-created',
    name:    'Workshop created - provision cal.com event type',
    retries: 3,
    // INLINE triggers - Pitfall 4. String-literal event name keeps this
    // function independent of other Wave 1 plans that may also touch
    // `src/inngest/events.ts`.
    triggers: [{ event: WORKSHOP_CREATED_EVENT }],
  },
  async ({ event, step }) => {
    const { workshopId } = event.data as {
      workshopId:  string
      moderatorId: string
    }

    // Step 1: load the workshop row. If it's missing the event is orphaned
    // (should be impossible since the mutation inserts before emitting, but
    // we fail loudly as a NonRetriableError either way).
    const workshop = await step.run('load-workshop', async () => {
      const [row] = await db
        .select()
        .from(workshops)
        .where(eq(workshops.id, workshopId))
        .limit(1)
      return row ?? null
    })

    if (!workshop) {
      throw new NonRetriableError(`workshop ${workshopId} not found`)
    }

    // Idempotency: both fields must be backfilled for the workshop to be
    // fully provisioned. If a prior run backfilled event-type but died
    // before creating the root booking, we re-enter here and finish the
    // booking half without re-provisioning the event type.
    if (workshop.calcomEventTypeId && workshop.calcomBookingUid) {
      return { workshopId, skipped: 'already-provisioned' as const }
    }

    // Step 2: call cal.com to provision the event type. Error mapping happens
    // inside the step so Inngest's step-level retry semantics wrap it cleanly.
    // A thrown plain Error here consumes a retry; NonRetriableError skips
    // straight to failure. If event type is already present from a prior
    // partial run, reuse it.
    //
    // B4-1: parseInt silently returns NaN on a malformed stored value (e.g.
    // `'abc'` or `''`). Guard with `Number.isFinite` and fail
    // NonRetriable — a malformed id is operator data corruption, not a
    // transient issue, and retrying would loop without converging.
    let reusedEventTypeId: number | null = null
    if (workshop.calcomEventTypeId) {
      const parsed = parseInt(workshop.calcomEventTypeId, 10)
      if (!Number.isFinite(parsed)) {
        throw new NonRetriableError(
          `workshop ${workshopId} has non-numeric calcomEventTypeId: ${JSON.stringify(workshop.calcomEventTypeId)}`,
        )
      }
      reusedEventTypeId = parsed
    }
    const eventTypeId = reusedEventTypeId !== null
      ? reusedEventTypeId
      : await step.run('create-cal-event-type', async () => {
          try {
            // Deterministic slug per workshop id - guarantees uniqueness
            // inside the shared cal.com org (D-04) and lets us reason about
            // idempotency: a retry of this step produces the same slug and
            // cal.com 4xx's us (duplicate slug), which the outer fn correctly
            // maps to NonRetriable. The admin can then manually retry after
            // fixing whatever was wrong.
            const slug = `workshop-${workshop.id}`
            const result = await createCalEventType({
              title:            workshop.title,
              slug,
              durationMinutes:  workshop.durationMinutes ?? 60,
              // Workshops are multi-attendee broadcasts. Honor the admin-
              // specified maxSeats, fallback to DEFAULT_SEATS_PER_TIME_SLOT
              // for uncapped workshops.
              seatsPerTimeSlot: workshop.maxSeats ?? DEFAULT_SEATS_PER_TIME_SLOT,
            })
            return result.id
          } catch (err) {
            if (err instanceof CalApiError) {
              if (err.status >= 500) {
                // Transient - bubble so Inngest consumes retry budget.
                throw err
              }
              // 4xx - permanent (bad API key, duplicate slug, bad field).
              throw new NonRetriableError(err.message)
            }
            // Unknown error surface - safest default is permanent failure
            // until observed in production, mirroring Phase 19.
            throw new NonRetriableError(
              err instanceof Error ? err.message : String(err),
            )
          }
        })

    // Step 3: create the root seated booking at the workshop's scheduled time.
    // The primary attendee (vinay@konma.io) holds the Google Meet link so
    // every participant registration reuses the SAME meeting room via
    // addAttendeeToBooking (Plan 20-02). The booking uid and meetingUrl land
    // on the workshop row in Step 4 and drive the public participation UX.
    const rootBooking = await step.run('create-root-booking', async () => {
      // B4-6: env.ts validates both vars at boot, so in production neither
      // can be falsy here. We still read via process.env (rather than the
      // env() singleton) because the singleton caches its validated
      // snapshot at module load — vi.stubEnv in tests would not bust that
      // cache. The NonRetriable guard below remains as defence-in-depth
      // for the (impossible-in-prod, possible-in-tests) empty-string case.
      const primaryEmail = process.env.CAL_PRIMARY_ATTENDEE_EMAIL
      const primaryName  = process.env.CAL_PRIMARY_ATTENDEE_NAME
      if (!primaryEmail || !primaryName) {
        throw new NonRetriableError(
          'CAL_PRIMARY_ATTENDEE_EMAIL / CAL_PRIMARY_ATTENDEE_NAME not set',
        )
      }
      try {
        return await createCalBooking({
          eventTypeId,
          name:      primaryName,
          email:     primaryEmail,
          // workshop.scheduledAt round-trips through step.run's JSON
          // serialization, so the static type is string (ISO) even though
          // the raw DB value is Date. new Date(...).toISOString() normalizes
          // either shape back to the canonical ISO form cal.com expects.
          startTime: new Date(workshop.scheduledAt).toISOString(),
          timeZone:  workshop.timezone,
        })
      } catch (err) {
        if (err instanceof CalApiError) {
          if (err.status >= 500) {
            // Transient - bubble so Inngest consumes retry budget.
            throw err
          }
          // 4xx - permanent.
          throw new NonRetriableError(err.message)
        }
        throw new NonRetriableError(
          err instanceof Error ? err.message : String(err),
        )
      }
    })

    // Step 4: atomic backfill of all three cal.com-sourced fields. The
    // idempotency guard above requires both calcomEventTypeId AND
    // calcomBookingUid to be populated for short-circuit, so writing them
    // together prevents a half-provisioned row from looking "done".
    await step.run('backfill-cal-ids', async () => {
      await db
        .update(workshops)
        .set({
          calcomEventTypeId: String(eventTypeId),
          calcomBookingUid:  rootBooking.uid,
          meetingUrl:        rootBooking.meetingUrl,
          updatedAt:         new Date(),
        })
        .where(eq(workshops.id, workshopId))
    })

    return {
      workshopId,
      eventTypeId,
      bookingUid: rootBooking.uid,
      ok: true as const,
    }
  },
)
