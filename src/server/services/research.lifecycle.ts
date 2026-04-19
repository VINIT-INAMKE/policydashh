import { TRPCError } from '@trpc/server'

/**
 * Research item lifecycle state machine.
 *
 * Phase 26 — RESEARCH-05
 *
 * Pure transition-table approach (no XState). Workshop precedent:
 * ALLOWED_TRANSITIONS const map in src/server/routers/workshop.ts has
 * shipped this way since Phase 17 with zero recovery-path bugs.
 *
 * Avoiding XState here (vs. feedback.service.ts) buys us:
 *  - No xstateSnapshot JSONB column on researchItems
 *  - No corruption-fallback code path (R1 pattern)
 *  - Entire machine fits in one const + one guard function
 *
 * State diagram:
 *   draft
 *     └─ [submit for review] ──► pending_review
 *                                    ├─ [approve] ──► published
 *                                    └─ [reject]  ──► draft     (returned for edits)
 *   published
 *     └─ [retract] ──► retracted (terminal — audit-preserving soft delete)
 *
 * Q3 moderation gate is enforced at the permission layer (Plan 26-02);
 * the state machine itself is role-agnostic.
 */

export type ResearchItemStatus = 'draft' | 'pending_review' | 'published' | 'retracted'

export const VALID_TRANSITIONS: Record<ResearchItemStatus, ResearchItemStatus[]> = {
  draft:          ['pending_review'],
  pending_review: ['published', 'draft'],  // approve (published) | reject returns to draft
  published:      ['retracted'],
  retracted:      [],                       // terminal
}

/**
 * Guards a proposed transition. Throws TRPCError BAD_REQUEST if the edge
 * (from, to) is not in VALID_TRANSITIONS. Called by transitionResearch()
 * before any DB write, so an invalid edge never results in a partial update.
 */
export function assertValidTransition(
  from: ResearchItemStatus,
  to: ResearchItemStatus,
): void {
  const allowed = VALID_TRANSITIONS[from] ?? []
  if (!allowed.includes(to)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Invalid transition: cannot move from ${from} to ${to}`,
    })
  }
}
