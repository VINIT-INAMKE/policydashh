import { NonRetriableError } from 'inngest'
import { eq } from 'drizzle-orm'
import { inngest } from '../client'
import { db } from '@/src/db'
import { workshops } from '@/src/db/schema/workshops'
import { createCalEventType, CalApiError } from '@/src/lib/calcom'

/**
 * workshopCreatedFn — async cal.com event-type provisioning for WS-07.
 *
 * Triggered by the `workshop.created` event emitted from the admin create
 * mutation in `src/server/routers/workshop.ts`. Calls cal.com v2 API to
 * provision an event type, then backfills `workshops.calcomEventTypeId`.
 *
 * Why async (D-01):
 *   - Admin create mutation stays fast (no external API hop).
 *   - Workshop row persists even if cal.com is down, so the admin dashboard
 *     surfaces the row immediately; the public listing (Plan 20-05) gates
 *     the cal.com embed on `calcomEventTypeId IS NOT NULL`.
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
 * Pitfall 4 (Inngest v4 type widening): `triggers` MUST be inlined in the
 * createFunction options object. Extracting to a const collapses `event.data`
 * to `any` inside the handler. Do not refactor. See Phase 19's
 * `participateIntakeFn` for the same pattern.
 */

export const workshopCreatedFn = inngest.createFunction(
  {
    id:      'workshop-created',
    name:    'Workshop created — provision cal.com event type',
    retries: 3,
    // INLINE triggers — Pitfall 4. String-literal event name keeps this
    // function independent of other Wave 1 plans that may also touch
    // `src/inngest/events.ts`.
    triggers: [{ event: 'workshop.created' }],
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

    // Idempotency: if a prior run already backfilled the id, short-circuit.
    // Cheap insurance against Inngest replays and against re-emits from the
    // admin mutation if we ever add a retry button there.
    if (workshop.calcomEventTypeId) {
      return { workshopId, skipped: 'already-provisioned' as const }
    }

    // Step 2: call cal.com. Error mapping happens inside the step so Inngest's
    // step-level retry semantics wrap it cleanly. A thrown plain Error here
    // consumes a retry; NonRetriableError skips straight to failure.
    const eventTypeId = await step.run('create-cal-event-type', async () => {
      try {
        // Deterministic slug per workshop id — guarantees uniqueness inside
        // the shared cal.com org (D-04) and lets us reason about idempotency:
        // a retry of this step produces the same slug and cal.com 4xx's us
        // (duplicate slug), which the outer fn correctly maps to NonRetriable.
        // The admin can then manually retry after fixing whatever was wrong.
        const slug = `workshop-${workshop.id}`
        const result = await createCalEventType({
          title:           workshop.title,
          slug,
          durationMinutes: workshop.durationMinutes ?? 60,
        })
        return result.id
      } catch (err) {
        if (err instanceof CalApiError) {
          if (err.status >= 500) {
            // Transient — bubble so Inngest consumes retry budget.
            throw err
          }
          // 4xx — permanent (bad API key, duplicate slug, bad field).
          throw new NonRetriableError(err.message)
        }
        // Unknown error surface — safest default is permanent failure until
        // observed in production, mirroring Phase 19 participateIntakeFn.
        throw new NonRetriableError(
          err instanceof Error ? err.message : String(err),
        )
      }
    })

    // Step 3: backfill the workshop row. cal.com returns a numeric id; we
    // persist it as text to keep the FK column type-agnostic (cal.com's own
    // docs also refer to the id as "string or number" in different places).
    await step.run('backfill-calcom-event-type-id', async () => {
      await db
        .update(workshops)
        .set({
          calcomEventTypeId: String(eventTypeId),
          updatedAt:         new Date(),
        })
        .where(eq(workshops.id, workshopId))
    })

    return { workshopId, eventTypeId, ok: true as const }
  },
)
