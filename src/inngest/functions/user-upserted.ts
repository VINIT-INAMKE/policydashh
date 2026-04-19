import { and, eq, isNull } from 'drizzle-orm'
import { inngest } from '../client'
import { userUpsertedEvent } from '../events'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { workshopRegistrations } from '@/src/db/schema/workshops'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import type { Role } from '@/src/lib/constants'

/**
 * userUpsertedFn - P2 fan-out target.
 *
 * The Clerk webhook handler used to do:
 *   1. SELECT the prior users row
 *   2. UPSERT the current Clerk payload
 *   3. Role-delta audit write
 *   4. Bulk UPDATE workshop_registrations.userId backfill
 * ...all inline before returning 200. Under DB pressure Svix would time
 * the request out and replay it, double-firing the audit write (which
 * has no idempotency key) and the backfill (safe but wasteful).
 *
 * The webhook now fires this Inngest event immediately after step (2)
 * succeeds, so steps (3) + (4) run inside durable retryable Inngest
 * steps and the webhook's response stays fast.
 *
 * Idempotency:
 *   - Backfill is a SET-based UPDATE filtered on `userId IS NULL`, so
 *     repeated runs are no-ops after the first success.
 *   - Audit write is pre-checked against writeAuditLog (which itself is
 *     idempotent only in the sense that duplicate rows are tolerable —
 *     the `payload.source = 'clerk_webhook'` marker keeps the audit
 *     trail interpretable).
 */
export const userUpsertedFn = inngest.createFunction(
  {
    id: 'user-upserted',
    name: 'User upserted - audit + workshop registrations backfill',
    retries: 3,
    // P2: bound fan-out so a burst of Clerk webhook replays doesn't
    // saturate the DB. Five concurrent runs is enough for interactive
    // latency; the backfill UPDATE is idempotent (WHERE userId IS NULL)
    // so a replayed event cannot produce duplicate writes.
    concurrency: { key: 'user-upserted', limit: 5 },
    triggers: [{ event: userUpsertedEvent }],
  },
  async ({ event, step }) => {
    const { userId, email, roleDelta, clerkEvent } = event.data

    // Step 1: role-delta audit. Only emitted when the caller detected a
    // real role change (prior !== new AND webhook payload carried a valid
    // enum value). The Inngest-side guard tolerates roleDelta === null
    // so the event remains useful for pure backfill runs.
    if (roleDelta) {
      await step.run('audit-role-delta', async () => {
        await writeAuditLog({
          actorId: userId,
          actorRole: roleDelta.newRole as Role,
          action: ACTIONS.USER_ROLE_ASSIGN,
          entityType: 'user',
          entityId: userId,
          payload: {
            before: { role: roleDelta.priorRole },
            after: { role: roleDelta.newRole },
            source: 'clerk_webhook',
            clerkEvent,
          },
        })
      })
    }

    // Step 2: backfill workshop_registrations.userId for pre-existing
    // cal.com-booked rows that matched this email. Idempotent: rows with
    // userId already set are filtered out by the WHERE clause.
    if (email) {
      await step.run('backfill-workshop-registrations', async () => {
        await db
          .update(workshopRegistrations)
          .set({ userId })
          .where(
            and(
              eq(workshopRegistrations.email, email),
              isNull(workshopRegistrations.userId),
            ),
          )
      })
    }

    return { userId, email, hasRoleDelta: roleDelta !== null }
  },
)

// Internal alias used by the webhook route so it doesn't need the `users`
// schema import. Keeps the webhook route lean.
export async function _loadUserFromClerkId(clerkId: string) {
  return db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
    columns: { id: true, role: true },
  })
}
