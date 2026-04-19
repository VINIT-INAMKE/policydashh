---
phase: 26-research-module-data-server
plan: 04
subsystem: api
tags: [trpc, drizzle, state-machine, audit, r6-invariant, research, postgres, neon-http]

# Dependency graph
requires:
  - phase: 26-research-module-data-server
    provides: "Plan 26-01 researchItems schema + research_items status enum + workflowTransitions table shape"
  - phase: 26-research-module-data-server
    provides: "Plan 26-02 RESEARCH_* ACTIONS constants + RBAC permission surface (consumed by Plan 26-05 router)"
provides:
  - "Pure VALID_TRANSITIONS const map encoding the 4-state research lifecycle (draft/pending_review/published/retracted) with exactly 5 valid edges"
  - "assertValidTransition(from, to) guard throwing TRPCError BAD_REQUEST on invalid edges (Q3 moderation gate encoded: draft -> published blocked)"
  - "transitionResearch(researchItemId, toStatus, actorId, meta?) service enforcing R6 invariant (INSERT workflowTransitions BEFORE UPDATE researchItems)"
  - "Review-field population: published populates reviewedBy+reviewedAt; retracted persists meta.retractionReason"
  - "Return shape: Object.assign pattern — updated row + previousStatus + newStatus for caller audit-payload use"
  - "NOT_FOUND guard fires before any DB write — zero audit writes on missing row"
  - "24 unit tests GREEN (16 lifecycle + 8 service including R6 call-order spy)"
affects: [plan-26-05-router-registration, plan-27-research-workspace-admin-ui, plan-28-public-research-items-listing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure VALID_TRANSITIONS const map for simple lifecycles (4 states + 5 edges) — avoids XState + xstateSnapshot overhead of feedback.service.ts"
    - "R6 invariant propagated: every state-transition service in this project INSERTs audit row BEFORE UPDATEing primary entity (Neon HTTP no-transaction workaround)"
    - "vi.hoisted() shared state + table-ref identity check in vi.mock('@/src/db') enables precise callOrder tracking (insert:workflowTransitions vs update:researchItems)"

key-files:
  created:
    - "src/server/services/research.lifecycle.ts (54 lines) — pure state-machine module"
    - "src/server/services/research.service.ts (104 lines) — transitionResearch with R6 invariant"
  modified:
    - "src/__tests__/research-lifecycle.test.ts (16 it.todo -> 16 it assertions GREEN)"
    - "src/__tests__/research-service.test.ts (8 it.todo -> 8 it assertions GREEN including R6 call-order spy)"

key-decisions:
  - "No XState — pure VALID_TRANSITIONS const map (workshop Phase 17 precedent) because the 4-state research machine doesn't justify the snapshot-corruption fallback complexity in feedback.service.ts"
  - "R6 invariant verified statically: insert(workflowTransitions) on line 59 < update(researchItems) on line 86 in research.service.ts"
  - "R6 invariant verified dynamically: vi.hoisted() shared callOrder array asserts insertIdx < updateIdx in the call-order spy test"
  - "Retraction reason guard: only persists meta.retractionReason when it's a string AND toStatus is 'retracted' — defensive against meta shape drift"
  - "INTERNAL_SERVER_ERROR on empty updated-rows array (Rule 2 missing-critical) — defends against UPDATE touching 0 rows after a successful INSERT audit write, which would leave the system with an audit row but unchanged state"
  - "entityType: 'research_item' literal on workflowTransitions INSERT — discriminator for audit queries filtering research lifecycle events"

patterns-established:
  - "Table-reference identity check in vi.mock('@/src/db') factory: `table === workflowTransitions ? 'insert:workflowTransitions' : 'insert:unknown'` — robust call-order tracking surviving future refactors that add more INSERT/UPDATE targets"
  - "R6 call-order spy contract: test fixture drives selectRows and updateRows via vi.hoisted shared state; service passes expect(insertIdx).toBeLessThan(updateIdx) without intricate argument inspection"
  - "meta.retractionReason guarded via `typeof meta.retractionReason === 'string'` — handles undefined meta and undefined .retractionReason and wrong-type .retractionReason uniformly"

requirements-completed:
  - RESEARCH-05

# Metrics
duration: 9min
completed: 2026-04-19
---

# Phase 26 Plan 04: Lifecycle Service Summary

**Pure VALID_TRANSITIONS state machine + transitionResearch service enforcing R6 invariant (INSERT workflowTransitions BEFORE UPDATE researchItems), review-field population on published/retracted, NOT_FOUND/BAD_REQUEST guards, and 24 Wave 0 contracts flipped RED to GREEN.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-19T16:52:24Z
- **Completed:** 2026-04-19T17:01:16Z
- **Tasks:** 2
- **Files modified:** 4 (2 created + 2 test flips)

## Accomplishments
- `src/server/services/research.lifecycle.ts` — pure state-machine module: `VALID_TRANSITIONS` record + `assertValidTransition()` guard + `ResearchItemStatus` union type; zero DB, zero async, zero XState
- `src/server/services/research.service.ts` — `transitionResearch()` with R6 invariant (INSERT audit FIRST, UPDATE row AFTER) plus NOT_FOUND / BAD_REQUEST / INTERNAL_SERVER_ERROR guards and Object.assign return pattern mirroring feedback.service.ts lines 176-182
- 16 RED `it.todo` lifecycle tests flipped GREEN — VALID_TRANSITIONS shape, valid paths, invalid paths (Q3 moderation gate verified: draft->published blocked), error message format, ResearchItemStatus union
- 8 RED `it.todo` service tests flipped GREEN — including the R6 call-order spy that asserts `callOrder.indexOf('insert:workflowTransitions') < callOrder.indexOf('update:researchItems')`

## Task Commits

Each task was committed atomically:

1. **Task 1: Write research.lifecycle.ts (pure VALID_TRANSITIONS + assertValidTransition)** — `7d72771` (feat)
2. **Task 2: Write research.service.ts (transitionResearch with R6 invariant)** — `8bd94af` (feat)

**Plan metadata:** TBD (final docs commit below)

## Files Created/Modified

- `src/server/services/research.lifecycle.ts` — 54 lines, 4 exports: `VALID_TRANSITIONS`, `assertValidTransition`, `ResearchItemStatus` type
- `src/server/services/research.service.ts` — 104 lines, 1 export: `transitionResearch()`
- `src/__tests__/research-lifecycle.test.ts` — 16 `it.todo` -> 16 `it` assertions GREEN
- `src/__tests__/research-service.test.ts` — 8 `it.todo` -> 8 `it` assertions GREEN

## R6 Invariant Verification

**Static (line-number) check:**
```
grep -n "insert(workflowTransitions)" src/server/services/research.service.ts  =>  line 59
grep -n "update(researchItems)"       src/server/services/research.service.ts  =>  line 86
```
Line 59 < Line 86. PASS.

**Dynamic (call-order spy) check (research-service.test.ts):**
```ts
const insertIdx = shared.callOrder.indexOf('insert:workflowTransitions')
const updateIdx = shared.callOrder.indexOf('update:researchItems')
expect(insertIdx).toBeGreaterThanOrEqual(0)
expect(updateIdx).toBeGreaterThanOrEqual(0)
expect(insertIdx).toBeLessThan(updateIdx)
```
Result: PASS.

**Negative case verified:** invalid transition (draft -> published skipping pending_review) throws BAD_REQUEST and `callOrder` does NOT contain `'insert:workflowTransitions'` — guard fires before audit write.

**NOT_FOUND case verified:** missing row throws NOT_FOUND and `callOrder` does NOT contain `'insert:workflowTransitions'` — guard fires before audit write.

## Test Pass Counts

- `npm test -- --run src/__tests__/research-lifecycle.test.ts` — **16/16 passed** (was 16 todo)
- `npm test -- --run src/__tests__/research-service.test.ts` — **8/8 passed** (was 8 todo)
- `npx tsc --noEmit` — **clean**

## Decisions Made

- **No XState, pure const map.** The research lifecycle has 4 states and 5 transitions — small enough that the snapshot-corruption fallback complexity in feedback.service.ts isn't warranted. Workshop (Phase 17) already uses this pure-table pattern in production.
- **Q3 moderation gate encoded in data, not code.** `VALID_TRANSITIONS.draft = ['pending_review']` forbids `draft -> published` by shape; the permission layer (Plan 26-02) stops self-publish at the RBAC boundary. Two defenses, one intention.
- **Retraction reason guard is structural.** `typeof meta.retractionReason === 'string'` handles three drift cases uniformly: undefined meta, undefined key, wrong type. No exceptions thrown — missing reason simply doesn't persist.
- **INTERNAL_SERVER_ERROR on zero-row UPDATE** (Rule 2 missing-critical): if UPDATE touches 0 rows after a successful INSERT audit write, the system would have an audit row but unchanged state. Throwing makes this condition loud instead of silent, and the audit row still serves as a retry anchor.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] INTERNAL_SERVER_ERROR guard on empty updated[]**
- **Found during:** Task 2 (research.service.ts implementation)
- **Issue:** Plan's pseudocode did `const [updated] = await db.update(...).returning()` and immediately `Object.assign(updated, ...)`. If UPDATE touches zero rows (row deleted between SELECT and UPDATE, schema drift, etc), `updated` would be `undefined` and `Object.assign(undefined, ...)` would throw a TypeError at runtime — a worse error than a typed TRPCError.
- **Fix:** Added `if (!updated) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Research item state update returned no rows' })`.
- **Files modified:** `src/server/services/research.service.ts`
- **Verification:** TypeScript narrows `updated` to non-undefined after the guard, making the subsequent `Object.assign` safe.
- **Committed in:** `8bd94af` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing-critical)
**Impact on plan:** The guard is required for correctness; it turns a latent runtime crash into a typed HTTP error that callers can route to standard error handling. Zero scope creep — the function signature and all return paths remain as specified.

## Issues Encountered

None. Both tasks executed exactly as specified, RED tests flipped GREEN on first run, `tsc --noEmit` clean.

## Next Phase Readiness

- **Plan 26-05 (router registration)** can now consume:
  - `import { transitionResearch } from '@/src/server/services/research.service'` — every lifecycle mutation (submitForReview / approve / reject / retract) delegates here
  - `import { type ResearchItemStatus } from '@/src/server/services/research.lifecycle'` — for Zod input validation on router procs
  - Return value carries `previousStatus` + `newStatus` for the router's `writeAuditLog` payload — no second DB fetch needed
- **R6 invariant** is now enforced at the service layer. The router layer should not re-implement audit-write ordering.
- **Q3 moderation gate** is encoded in two layers: VALID_TRANSITIONS shape (draft -> published blocked) + RBAC permission matrix (Plan 26-02, research_lead excluded from research:publish/retract). Defense in depth.

## Self-Check: PASSED

- `src/server/services/research.lifecycle.ts` exists — FOUND
- `src/server/services/research.service.ts` exists — FOUND
- `src/__tests__/research-lifecycle.test.ts` modified — FOUND
- `src/__tests__/research-service.test.ts` modified — FOUND
- Task 1 commit `7d72771` — FOUND in git log
- Task 2 commit `8bd94af` — FOUND in git log
- `VALID_TRANSITIONS` exported with exact 4 keys and expected edge order — VERIFIED via `research-lifecycle.test.ts` 16/16 GREEN
- `transitionResearch` function exported, R6 invariant satisfied statically (line 59 < line 86) and dynamically (call-order spy GREEN) — VERIFIED
- `npx tsc --noEmit` clean — VERIFIED
- 24/24 research tests GREEN (16 lifecycle + 8 service) — VERIFIED

---
*Phase: 26-research-module-data-server*
*Plan: 04 — lifecycle-service*
*Completed: 2026-04-19*
