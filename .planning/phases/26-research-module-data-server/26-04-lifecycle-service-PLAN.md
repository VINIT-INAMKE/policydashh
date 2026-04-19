---
phase: 26-research-module-data-server
plan: 04
type: execute
wave: 2
depends_on: ["26-01"]
files_modified:
  - src/server/services/research.lifecycle.ts
  - src/server/services/research.service.ts
autonomous: true
requirements:
  - RESEARCH-05
must_haves:
  truths:
    - "VALID_TRANSITIONS table encodes all 5 valid edges and no others (draft->pending_review; pending_review->published; pending_review->draft; published->retracted)"
    - "assertValidTransition() throws TRPCError BAD_REQUEST on any edge not in VALID_TRANSITIONS"
    - "transitionResearch() INSERTS workflowTransitions row BEFORE UPDATING researchItems row (R6 invariant — mirrors feedback.service.ts lines 139-162)"
    - "Successful transition to 'published' sets reviewedBy + reviewedAt on the row"
    - "Successful transition to 'retracted' accepts retractionReason via meta parameter and persists it"
    - "Missing researchItem row throws TRPCError NOT_FOUND BEFORE any write"
    - "Return value includes previousStatus and newStatus fields (Object.assign pattern) for caller audit-payload use"
    - "src/__tests__/research-lifecycle.test.ts and src/__tests__/research-service.test.ts flip RED -> GREEN"
  artifacts:
    - path: "src/server/services/research.lifecycle.ts"
      provides: "Pure VALID_TRANSITIONS table + assertValidTransition guard + ResearchItemStatus type"
      min_lines: 30
      contains: "VALID_TRANSITIONS"
    - path: "src/server/services/research.service.ts"
      provides: "transitionResearch() enforcing R6 invariant + review field population"
      min_lines: 80
      contains: "transitionResearch"
  key_links:
    - from: "src/server/services/research.service.ts"
      to: "src/server/services/research.lifecycle.ts"
      via: "import { assertValidTransition, type ResearchItemStatus } from './research.lifecycle'"
      pattern: "from './research.lifecycle'"
    - from: "src/server/services/research.service.ts"
      to: "src/db/schema/research.ts (Plan 26-01)"
      via: "import { researchItems } from '@/src/db/schema/research'"
      pattern: "from '@/src/db/schema/research'"
    - from: "src/server/services/research.service.ts"
      to: "src/db/schema/workflow.ts (workflowTransitions)"
      via: "INSERT before UPDATE — R6 invariant"
      pattern: "workflowTransitions"
---

<objective>
Ship the pure state-machine module + service layer enforcing the R6 write-order invariant for Phase 26.

Purpose: RESEARCH-05 — every lifecycle mutation (submitForReview / approve / reject / retract) in Plan 26-05's router delegates to `transitionResearch(itemId, targetStatus, actorId, meta?)`. This service centralizes the guard + audit trail so every edge of the state machine has identical behavior (valid/invalid transition handling, review-field population, audit-INSERT ordering).

The "insert workflowTransitions BEFORE update researchItems" ordering is the R6 invariant: Neon HTTP driver lacks `db.transaction()`, so if we did UPDATE first and the INSERT failed, the row would be permanently in the new state with no audit record and no way to retry (XState / VALID_TRANSITIONS guard blocks re-running). Ordering write-first-audit-first means a retry can always recover from a partial failure.

Output:
- `src/server/services/research.lifecycle.ts` — 30+ lines, exports VALID_TRANSITIONS + assertValidTransition + ResearchItemStatus type
- `src/server/services/research.service.ts` — 80+ lines, exports async transitionResearch()

Two test files flip RED -> GREEN: research-lifecycle.test.ts (13 tests) + research-service.test.ts (4+ tests).

This plan addresses RESEARCH-05 (state machine + service layer + R6 invariant).
</objective>

<execution_context>
@D:/aditee/policydash/.claude/get-shit-done/workflows/execute-plan.md
@D:/aditee/policydash/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/26-research-module-data-server/26-CONTEXT.md
@.planning/phases/26-research-module-data-server/26-RESEARCH.md
@.planning/research/research-module/DOMAIN.md
@src/db/schema/research.ts
@src/db/schema/workflow.ts
@src/server/services/feedback.service.ts
@src/__tests__/research-lifecycle.test.ts
@src/__tests__/research-service.test.ts
@AGENTS.md

<interfaces>
<!-- Target exports for this plan's two files -->

From (this plan) src/server/services/research.lifecycle.ts:
```typescript
export type ResearchItemStatus = 'draft' | 'pending_review' | 'published' | 'retracted'

export const VALID_TRANSITIONS: Record<ResearchItemStatus, ResearchItemStatus[]> = {
  draft:          ['pending_review'],
  pending_review: ['published', 'draft'],  // approve | reject-back-to-draft
  published:      ['retracted'],
  retracted:      [],
}

export function assertValidTransition(from: ResearchItemStatus, to: ResearchItemStatus): void
```

From (this plan) src/server/services/research.service.ts:
```typescript
export async function transitionResearch(
  researchItemId: string,
  toStatus: ResearchItemStatus,
  actorId: string,
  meta?: Record<string, unknown>,
): Promise<ResearchItemRow & { previousStatus: string; newStatus: string }>
```

From (existing) src/db/schema/workflow.ts:
```typescript
export const workflowTransitions: pgTable  // columns: id, entityType (text), entityId (uuid), fromState (text), toState (text), actorId (text), timestamp, metadata (jsonb)
```

From (existing, Plan 26-01) src/db/schema/research.ts:
```typescript
export const researchItems  // table with status + reviewedBy + reviewedAt + retractionReason columns
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write src/server/services/research.lifecycle.ts (pure VALID_TRANSITIONS + assertValidTransition)</name>
  <files>src/server/services/research.lifecycle.ts</files>
  <read_first>
    - src/server/services/feedback.service.ts lines 97–111 (R1 fallback VALID_TRANSITIONS table — canonical shape to mirror)
    - src/__tests__/research-lifecycle.test.ts (contract the new module must satisfy — all 13+ tests must flip GREEN)
    - .planning/phases/26-research-module-data-server/26-RESEARCH.md §Pattern 4 (full research.lifecycle.ts source)
    - .planning/research/research-module/DOMAIN.md (Status State Machine section — exact 5 edges)
  </read_first>
  <action>
    Create `src/server/services/research.lifecycle.ts` with this EXACT content:

    ```typescript
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
    ```
  </action>
  <verify>
    <automated>test -f src/server/services/research.lifecycle.ts && grep -q "VALID_TRANSITIONS" src/server/services/research.lifecycle.ts && npm test -- --run src/__tests__/research-lifecycle.test.ts 2>&1 | grep -qE "(passed|Tests\s+[0-9]+ passed)"</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/server/services/research.lifecycle.ts`
    - `grep -q "export type ResearchItemStatus = 'draft' | 'pending_review' | 'published' | 'retracted'" src/server/services/research.lifecycle.ts`
    - `grep -q "export const VALID_TRANSITIONS" src/server/services/research.lifecycle.ts`
    - `grep -q "draft:.*\['pending_review'\]" src/server/services/research.lifecycle.ts`
    - `grep -q "pending_review:.*\['published', 'draft'\]" src/server/services/research.lifecycle.ts` (exact order matters — approve first, reject second)
    - `grep -q "published:.*\['retracted'\]" src/server/services/research.lifecycle.ts`
    - `grep -q "retracted:.*\[\]" src/server/services/research.lifecycle.ts` (terminal)
    - `grep -q "export function assertValidTransition" src/server/services/research.lifecycle.ts`
    - `grep -q "code: 'BAD_REQUEST'" src/server/services/research.lifecycle.ts`
    - `grep -q "cannot move from \${from} to \${to}" src/server/services/research.lifecycle.ts` (exact error message template)
    - `grep -q "import { TRPCError } from '@trpc/server'" src/server/services/research.lifecycle.ts`
    - `npx tsc --noEmit` — clean
    - `npm test -- --run src/__tests__/research-lifecycle.test.ts` — all 13+ tests GREEN (flipped from RED)
  </acceptance_criteria>
  <done>research.lifecycle.ts ships with pure VALID_TRANSITIONS const + assertValidTransition throwing TRPCError BAD_REQUEST on invalid edges; 13+ lifecycle tests flip RED -> GREEN; no DB, no async, no XState.</done>
</task>

<task type="auto">
  <name>Task 2: Write src/server/services/research.service.ts (transitionResearch with R6 invariant)</name>
  <files>src/server/services/research.service.ts</files>
  <read_first>
    - src/server/services/feedback.service.ts (FULL FILE — R6 insert-before-update invariant at lines 139–162 is the canonical pattern to mirror; transitionResearch is a simpler version without the XState snapshot fallback)
    - src/server/services/research.lifecycle.ts (Task 1 output — imports assertValidTransition + ResearchItemStatus)
    - src/db/schema/research.ts (Plan 26-01 output — imports researchItems)
    - src/db/schema/workflow.ts (workflowTransitions shape — entityType (text), entityId (uuid), fromState, toState, actorId (text), metadata (jsonb))
    - src/__tests__/research-service.test.ts (contract — INSERT-before-UPDATE order, NOT_FOUND path, return shape)
    - .planning/phases/26-research-module-data-server/26-RESEARCH.md §Pattern 4 transitionResearch source + §Pitfall 2 write order
  </read_first>
  <action>
    Create `src/server/services/research.service.ts` with this EXACT content:

    ```typescript
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
    ```
  </action>
  <verify>
    <automated>test -f src/server/services/research.service.ts && grep -q "transitionResearch" src/server/services/research.service.ts && npm test -- --run src/__tests__/research-service.test.ts 2>&1 | grep -qE "(passed|Tests\s+[0-9]+ passed)"</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/server/services/research.service.ts`
    - `grep -q "export async function transitionResearch" src/server/services/research.service.ts`
    - `grep -q "researchItemId: string" src/server/services/research.service.ts`
    - `grep -q "toStatus: ResearchItemStatus" src/server/services/research.service.ts`
    - `grep -q "actorId: string" src/server/services/research.service.ts`
    - `grep -q "meta\?: Record<string, unknown>" src/server/services/research.service.ts`
    - `grep -q "import { assertValidTransition, type ResearchItemStatus } from './research.lifecycle'" src/server/services/research.service.ts`
    - `grep -q "import { researchItems } from '@/src/db/schema/research'" src/server/services/research.service.ts`
    - `grep -q "import { workflowTransitions } from '@/src/db/schema/workflow'" src/server/services/research.service.ts`
    - `grep -q "code: 'NOT_FOUND'" src/server/services/research.service.ts`
    - `grep -q "assertValidTransition(fromStatus, toStatus)" src/server/services/research.service.ts`
    - **R6 invariant visually checked** — INSERT must come before UPDATE:
      `grep -B2 -A2 "workflowTransitions" src/server/services/research.service.ts` shows `insert(workflowTransitions)` call
      AND `grep -n "insert(workflowTransitions)" src/server/services/research.service.ts` line number is LESS than `grep -n "update(researchItems)" src/server/services/research.service.ts` line number
    - `grep -q "entityType: 'research_item'" src/server/services/research.service.ts` (workflow_transitions discriminator)
    - `grep -q "updateData.reviewedBy = actorId" src/server/services/research.service.ts` (review-field population on publish)
    - `grep -q "updateData.retractionReason = meta.retractionReason" src/server/services/research.service.ts` (retraction reason persistence)
    - `grep -q "Object.assign(updated" src/server/services/research.service.ts`
    - `grep -q "previousStatus:" src/server/services/research.service.ts`
    - `grep -q "newStatus:" src/server/services/research.service.ts`
    - `npx tsc --noEmit` — clean
    - `npm test -- --run src/__tests__/research-service.test.ts` — all tests GREEN (flipped from RED) — especially the INSERT-before-UPDATE call-order assertion
    - `npm test -- --run src/__tests__/research-lifecycle.test.ts` — still GREEN (regression check; Task 1 output intact)
  </acceptance_criteria>
  <done>research.service.ts ships with transitionResearch() honoring R6 invariant (INSERT workflowTransitions BEFORE UPDATE researchItems), review-field population on published/retracted, NOT_FOUND guard, Object.assign return shape; research-service.test.ts flips GREEN; R6 line-ordering visually + automatedly verified.</done>
</task>

</tasks>

<verification>
1. `test -f src/server/services/research.lifecycle.ts` — lifecycle module exists
2. `test -f src/server/services/research.service.ts` — service module exists
3. `npm test -- --run src/__tests__/research-lifecycle.test.ts` — 13+ tests GREEN
4. `npm test -- --run src/__tests__/research-service.test.ts` — 4+ tests GREEN including call-order spy (INSERT before UPDATE)
5. `npx tsc --noEmit` — clean
6. R6 invariant auto-checked: INSERT workflowTransitions line number < UPDATE researchItems line number in research.service.ts
</verification>

<success_criteria>
- VALID_TRANSITIONS table encodes exactly 5 valid edges: draft->pending_review, pending_review->published, pending_review->draft, published->retracted; retracted terminal
- assertValidTransition throws TRPCError BAD_REQUEST with `cannot move from X to Y` message on every invalid edge
- transitionResearch validates, then INSERTs workflowTransitions, then UPDATEs researchItems (R6 invariant)
- Published transition populates reviewedBy + reviewedAt; retracted transition with meta.retractionReason persists the reason
- Missing researchItem throws TRPCError NOT_FOUND (no audit writes, no wasted Neon query)
- Return value is the updated row + previousStatus + newStatus (Object.assign pattern)
- research-lifecycle.test.ts + research-service.test.ts both flip RED -> GREEN
- No XState, no xstateSnapshot column (workshop-precedent pattern)
</success_criteria>

<output>
After completion, create `.planning/phases/26-research-module-data-server/26-04-SUMMARY.md` documenting:
- Line counts for both new files
- Confirmation of R6 invariant line ordering (grep line numbers of INSERT vs UPDATE)
- Pass counts for research-lifecycle.test.ts (13+) and research-service.test.ts (4+)
- Unblocks: Plan 26-05 (router — every lifecycle mutation calls transitionResearch; router also imports ResearchItemStatus for input validation)
</output>
