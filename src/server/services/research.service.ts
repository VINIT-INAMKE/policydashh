import { db } from '@/src/db'
import { researchItems } from '@/src/db/schema/research'
import { workflowTransitions } from '@/src/db/schema/workflow'
import { eq } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { assertValidTransition, type ResearchItemStatus } from './research.lifecycle'

/**
 * Transitions a research item through its lifecycle state machine.
 *
 * Phase 26 — RESEARCH-05
 *
 * Ordering contract (R6 invariant, mirrored from feedback.service.ts 139-162):
 *
 *   1. SELECT current row (throws NOT_FOUND if missing)
 *   2. Guard via assertValidTransition() — throws BAD_REQUEST on invalid edge
 *   3. INSERT workflowTransitions row (audit trail durability guarantee)
 *   4. UPDATE researchItems row (state flip + optional review field population)
 *   5. Return row augmented with previousStatus / newStatus for caller audit use
 *
 * Why INSERT comes before UPDATE (R6):
 *   Neon HTTP has no db.transaction(). If UPDATE succeeded but a subsequent
 *   audit-write failed, the row would live in the new status with no audit
 *   record, and VALID_TRANSITIONS would block re-running the transition.
 *   By INSERTing first, a partial failure always leaves the system in a
 *   recoverable state: the audit row survives even if UPDATE fails, and
 *   the caller can retry.
 *
 * Review-field population:
 *   - toStatus === 'published' -> populate reviewedBy = actorId, reviewedAt = now
 *   - toStatus === 'retracted' AND meta.retractionReason present -> persist retractionReason
 *   (Other transitions do not touch review fields.)
 */
export async function transitionResearch(
  researchItemId: string,
  toStatus: ResearchItemStatus,
  actorId: string,
  meta?: Record<string, unknown>,
) {
  // 1. Fetch the current row
  const [row] = await db
    .select()
    .from(researchItems)
    .where(eq(researchItems.id, researchItemId))
    .limit(1)

  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Research item not found' })
  }

  const fromStatus = row.status as ResearchItemStatus

  // 2. Guard the edge (throws TRPCError BAD_REQUEST on invalid)
  assertValidTransition(fromStatus, toStatus)

  // 3. R6: INSERT workflowTransitions FIRST. If the UPDATE below fails for
  //    any reason (network blip, schema drift, etc), the audit row survives
  //    as a durable record of the intended transition — a retry can re-apply.
  await db.insert(workflowTransitions).values({
    entityType: 'research_item',
    entityId: researchItemId,
    fromState: fromStatus,
    toState: toStatus,
    actorId,
    metadata: meta ?? {},
  })

  // 4. Build the update data. Only populate review fields on transitions
  //    where those fields are semantically meaningful.
  const updateData: Record<string, unknown> = {
    status: toStatus,
    updatedAt: new Date(),
  }

  if (toStatus === 'published') {
    updateData.reviewedBy = actorId
    updateData.reviewedAt = new Date()
  }

  if (toStatus === 'retracted' && meta && typeof meta.retractionReason === 'string') {
    updateData.retractionReason = meta.retractionReason
  }

  // 5. Apply the UPDATE. If this fails, the audit row above still stands.
  const [updated] = await db
    .update(researchItems)
    .set(updateData)
    .where(eq(researchItems.id, researchItemId))
    .returning()

  if (!updated) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Research item state update returned no rows',
    })
  }

  // 6. Return the updated row with before/after state strings for caller
  //    audit-payload use (mirrors feedback.service.ts lines 176-182).
  return Object.assign(updated, {
    previousStatus: fromStatus,
    newStatus:      toStatus,
  })
}
