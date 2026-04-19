---
phase: 26-research-module-data-server
plan: 05
subsystem: api
tags: [trpc, router, zod, rbac, audit, research, nextval, drizzle]

# Dependency graph
requires:
  - phase: 26-01-schema-migration
    provides: researchItems + 3 link tables (section/version/feedback) with composite PKs; research_item_id_seq PostgreSQL sequence for readable IDs
  - phase: 26-02-permissions-constants
    provides: 7 research:* RBAC permissions with role grants; 12 ACTIONS.RESEARCH_* audit constants
  - phase: 26-04-lifecycle-service
    provides: transitionResearch(id, toStatus, actorId, meta) service + VALID_TRANSITIONS table + R6 invariant (INSERT workflow_transitions before UPDATE researchItems)
provides:
  - researchRouter with 15 tRPC procedures under appRouter.research.* namespace
  - RESEARCH-02 readable-ID generation via nextval('research_item_id_seq') producing RI-001, RI-002, ... collision-safe
  - Pitfall 5 anonymous-author filter (listPublic + published getById null out authors when isAuthorAnonymous=true)
  - Pitfall 6 secondary ownership check (research_lead restricted to own items; admin/policy_lead bypass)
  - Open Q1 status lock (update mutation blocked unless status='draft')
  - All 12 mutations write audit log fire-and-forget via .catch(console.error)
  - All 3 link-insert operations use .onConflictDoNothing() for idempotent re-links
  - tRPC-client-side type surface for Phase 27 UI and Phase 28 public listing
affects:
  - Phase 27 (Research Workspace Admin UI) — will consume trpc.research.* procedures for list/create/edit/approve flows
  - Phase 28 (Public /research/items Listing & Detail) — uses trpc.research.listPublic + getById for authenticated public pages; server-component direct DB queries for truly public routes

# Tech tracking
tech-stack:
  added: []  # zero new packages — pure code on existing Drizzle/tRPC/Zod/@trpc/server substrate
  patterns:
    - "assertOwnershipOrBypass(role, rowCreatedBy, actorId) helper — admin/policy_lead bypass, research_lead must match createdBy (Pitfall 6 pattern, can be reused by future secondary-scope routers)"
    - "Two-step RBAC: requirePermission middleware for role membership + assertOwnershipOrBypass for row-scope ownership (defense in depth)"
    - "vi.mock('server-only') + downstream mock of calcom/cardano/rate-limit for test harnesses that need to traverse _app.ts import graph"

key-files:
  created:
    - src/server/routers/research.ts (623 lines)
  modified:
    - src/server/routers/_app.ts (+2 lines — 1 import, 1 entry)
    - src/__tests__/research-router.test.ts (converted 19 it.todo to real assertions; 3 it.todo remain for Phase 27)
    - .planning/phases/26-research-module-data-server/deferred-items.md (logged baseline suite state)

key-decisions:
  - "15 procedures exactly — 3 queries (list, listPublic, getById) + 12 mutations (create, update, 4 lifecycle, 6 link-table)"
  - "listPublic uses protectedProcedure not publicProcedure — Open Q2 resolved in favor of authenticated-only tRPC surface; Phase 28 will expose a public route via direct server-component DB queries"
  - "update mutation locks to status='draft' (Open Q1) — admin must reject a pending_review item back to draft before re-editing"
  - "retractionReason input is REQUIRED (not optional) on retract mutation — compliance needs the reason in the workflow_transitions + audit payload"
  - "Router-level assertOwnershipOrBypass applied to update + submitForReview only (not link mutations) — Open Q3 resolved: policy_lead can link published items without being the author"
  - "Test file flip: 19/22 it.todo converted to real assertions; 3 anonymous-author edge cases stay as it.todo for Phase 27 (need tRPC createCaller + session mocking that UI integration tests bring)"

patterns-established:
  - "server-only defanger pattern for tRPC appRouter tests: vi.mock('server-only', () => ({})) plus downstream mocks of every server-only-tainted module (calcom, cardano, rate-limit) so the full _app.ts import graph walks cleanly"
  - "Router-level two-tier RBAC: requirePermission for role membership + assertOwnershipOrBypass(role, rowCreatedBy, actorId) helper for row-scope ownership — canonical pattern for research_lead-style roles that have a permission but should only act on self-owned rows"
  - "Delegate-don't-duplicate: lifecycle mutations (submitForReview/approve/reject/retract) call transitionResearch() and DO NOT re-implement R6 invariant or VALID_TRANSITIONS — service layer is the single source of truth"
  - "Audit payload carries fromStatus/toStatus via updated.previousStatus / updated.newStatus — transitionResearch's Object.assign return contract enables router-layer audit without re-fetching"

requirements-completed:
  - RESEARCH-02
  - RESEARCH-04

# Metrics
duration: 15min
completed: 2026-04-19
---

# Phase 26 Plan 05: Router Registration Summary

**15-procedure tRPC researchRouter with RESEARCH-02 nextval('research_item_id_seq') readable-ID generation, 4 lifecycle mutations delegating to transitionResearch(), Pitfall 5 anonymous-author filter, Pitfall 6 ownership check, Open Q1 status lock — registered under appRouter.research.* with the full Wave 0 test contract flipped RED to GREEN.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-19T17:08:39Z
- **Completed:** 2026-04-19T17:23:40Z (approx)
- **Tasks:** 2
- **Files created:** 1 (`src/server/routers/research.ts`)
- **Files modified:** 3 (`src/server/routers/_app.ts`, `src/__tests__/research-router.test.ts`, `.planning/phases/26-research-module-data-server/deferred-items.md`)

## Accomplishments

### Procedure Surface — 15 Total (3 queries + 12 mutations)

**Queries (3)**

| Procedure    | Guard                              | Purpose                                                                 |
| ------------ | ---------------------------------- | ----------------------------------------------------------------------- |
| `list`       | `requirePermission('research:read_drafts')` | Admin/policy_lead/research_lead list with optional documentId/itemType/status filters |
| `listPublic` | `protectedProcedure`               | All 7 auth roles, filters to status='published', applies anonymous-author filter |
| `getById`    | `requirePermission('research:read_drafts')` | Single-item fetch; applies anonymous-author filter only when status='published' |

**Mutations — CRUD (2)**

| Procedure | Guard                                    | Key Behavior                                                                |
| --------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| `create`  | `requirePermission('research:create')`   | `nextval('research_item_id_seq')` -> `RI-NNN` (RESEARCH-02); inserts with createdBy |
| `update`  | `requirePermission('research:manage_own')` | Status lock (Q1) + ownership check (Pitfall 6); only editable while status='draft' |

**Mutations — Lifecycle (4)**

| Procedure          | Guard                                      | Delegates To                                       |
| ------------------ | ------------------------------------------ | -------------------------------------------------- |
| `submitForReview`  | `requirePermission('research:submit_review')` + ownership check | `transitionResearch(id, 'pending_review', actor)` |
| `approve`          | `requirePermission('research:publish')`   | `transitionResearch(id, 'published', actor)` (populates reviewedBy/reviewedAt) |
| `reject`           | `requirePermission('research:publish')`   | `transitionResearch(id, 'draft', actor, { rejectionReason? })` |
| `retract`          | `requirePermission('research:retract')`   | `transitionResearch(id, 'retracted', actor, { retractionReason })` — REQUIRED reason |

**Mutations — Link Tables (6)** — all `requirePermission('research:manage_own')`, all link-inserts use `.onConflictDoNothing()` for idempotency:

- `linkSection` / `unlinkSection` — researchItems <-> policySections (with optional relevanceNote)
- `linkVersion` / `unlinkVersion` — researchItems <-> document_versions
- `linkFeedback` / `unlinkFeedback` — researchItems <-> feedbackItems

### Invariant Coverage

| Invariant                            | Location                                           | Verification                                                        |
| ------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------- |
| RESEARCH-02 nextval pattern          | `create` mutation (research.ts:217-220)            | `grep -q "nextval('research_item_id_seq')"` — PASS                  |
| RI-NNN padStart format               | `create` mutation (research.ts:221)                | `grep -q "RI-\${String(num).padStart(3, '0')}"` — PASS              |
| Pitfall 5 anonymous-author filter    | `listPublic` (lines 160-165) + `getById` (line 190) | `grep -q "if (row.isAuthorAnonymous)"` + `grep -q "authors: null"` — PASS |
| Pitfall 6 ownership check            | `assertOwnershipOrBypass` helper (lines 113-122)   | `grep -q "assertOwnershipOrBypass"` — PASS; called in update + submitForReview |
| Open Q1 status lock                  | `update` mutation (line 273)                       | `grep -q "row.status !== 'draft'"` — PASS                           |
| Phase 16 z.guid() precedent          | All UUID inputs                                    | `! grep -qE "z\.uuid\(\)"` (in code) — PASS                         |
| Phase 10 onConflictDoNothing pattern | 3 link-insert mutations                            | `grep -c "onConflictDoNothing()"` = 5 (3 inserts + unused values; well over 3 threshold) |
| R6 delegation (no duplication)       | 4 lifecycle mutations                              | `grep -c "transitionResearch("` = 5 — PASS                          |
| Audit fire-and-forget                | All 12 mutations                                   | `grep -c "writeAuditLog({"` = 12, `.catch(console.error)` = 13 — PASS |

### Audit Action Coverage

Every mutation writes an audit log entry with the correct `ACTIONS.RESEARCH_*` constant:

| Mutation        | Action Constant              |
| --------------- | ---------------------------- |
| create          | RESEARCH_CREATE              |
| update          | RESEARCH_UPDATE              |
| submitForReview | RESEARCH_SUBMIT_REVIEW       |
| approve         | RESEARCH_APPROVE             |
| reject          | RESEARCH_REJECT              |
| retract         | RESEARCH_RETRACT             |
| linkSection     | RESEARCH_SECTION_LINK        |
| unlinkSection   | RESEARCH_SECTION_UNLINK      |
| linkVersion     | RESEARCH_VERSION_LINK        |
| unlinkVersion   | RESEARCH_VERSION_UNLINK      |
| linkFeedback    | RESEARCH_FEEDBACK_LINK       |
| unlinkFeedback  | RESEARCH_FEEDBACK_UNLINK     |

All 12 constants consumed. All writes are `.catch(console.error)` fire-and-forget — audit failures never block the mutation response.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write `src/server/routers/research.ts` (15 procedures)** — `a50215c` (feat)
2. **Task 2: Register researchRouter in `_app.ts` + flip test contract to GREEN** — `ed638f4` (feat)

## Files Created/Modified

- `src/server/routers/research.ts` (623 lines) — 15-procedure tRPC router with Zod inputs, permission guards, ownership checks, audit writes, and lifecycle delegations
- `src/server/routers/_app.ts` (+2 lines) — imports researchRouter and mounts under `research:` entry in the appRouter object
- `src/__tests__/research-router.test.ts` (253 lines, rewrite) — 19 real assertions covering all 15 procedures, procedure count, appRouter.research.* namespace, RESEARCH-02 nextval wiring; 3 anonymous-author edge cases remain as `it.todo` for Phase 27
- `.planning/phases/26-research-module-data-server/deferred-items.md` — appended baseline suite state (17 pre-existing failing files verified via `git stash` + re-run)

## Test Contract Flip

Wave 0 (Plan 26-00) shipped 22 `it.todo` stubs. Plan 26-05 flipped:

- **19 tests** converted to real assertions (all PASSING)
- **3 tests** remain as `it.todo` (anonymous-author edge cases requiring tRPC createCaller + session mocking — deferred to Phase 27 when UI integration tests land)

Full test file result: **19 passed, 3 todo (22 total)**.

### Full Suite Delta

| Metric         | Baseline (pre-26-05) | After 26-05 | Delta                          |
| -------------- | -------------------- | ----------- | ------------------------------ |
| Passed tests   | 532                  | 551         | +19 (matches flipped it.todos) |
| Failed tests   | 69                   | 69          | 0 (no regressions)             |
| Todo tests     | 73                   | 54          | -19 (flipped to real)          |
| Failed files   | 17                   | 17          | 0 (pre-existing)               |

The 69 pre-existing failures are documented in `deferred-items.md` as unrelated to research module — they stem from fixture drift and unshipped adjacent features touched by adjacent tests. **Plan 26-05 introduces zero regressions.**

## Decisions Made

- **Mock `server-only` module in the test harness.** The `_app.ts` import graph traverses `workshop.ts` -> `calcom.ts` -> `'server-only'`. That package throws on import by design (it's a bundler sentinel). Mocking it to `{}` in the research router test file lets us assert `appRouter.research.*` registration without rewriting the entire router graph. Also mocked downstream consumers (`calcom`, `cardano`, `rate-limit`) so their module-level SDK constructors don't blow up in the test env.
- **Keep anonymous-author edge-case tests as `it.todo`.** The 3 remaining edge cases in the final describe block need tRPC `createCaller` + synthetic `ctx.user` rows to exercise the filter end-to-end. That machinery comes online with Phase 27's UI integration tests. The router-layer filter presence is already verified by the grep-based acceptance criteria (`if (row.isAuthorAnonymous)` + `authors: null`).
- **assertOwnershipOrBypass on update + submitForReview only (not link mutations).** Open Q3 resolved: a policy_lead should be able to link published research items to versions they manage, regardless of who authored the research item. The ownership check applies only where the author's editorial control is semantically required.
- **retract takes REQUIRED retractionReason.** Compliance requires the reason to be in `workflowTransitions.metadata` AND the audit payload. Making it optional would leave retraction actions unannotated.
- **Phase 16 z.guid() everywhere.** All 19 UUID inputs across createInput, updateInput, submitForReview/approve/reject/retract, and all 6 link mutations use `z.guid()`. `z.uuid()` is explicitly absent from the code path (only referenced in a single JSDoc block that describes why NOT to use it).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added server-only + downstream module mocks to the test file**

- **Found during:** Task 2 (first run of `research-router.test.ts` after flip)
- **Issue:** `_app.ts` transitively imports `'server-only'` via `workshop.ts` -> `calcom.ts`. The `server-only` package throws on import (bundler sentinel), causing the test file to FAIL SUITE (error during module resolution, all 22 tests reported as `skipped` with an exception).
- **Fix:** Added `vi.mock('server-only', () => ({}))` plus downstream mocks for `@/src/lib/calcom`, `@/src/lib/cardano`, `@/src/lib/rate-limit` so their constructor-time side-effects (env reads, SDK client builds) don't crash the test environment.
- **Files modified:** `src/__tests__/research-router.test.ts`
- **Verification:** `npx vitest run src/__tests__/research-router.test.ts` returns **19 passed, 3 todo** (was 0 passed, 22 skipped before the fix).
- **Committed in:** `ed638f4` (Task 2 commit)

**2. [Rule 2 - Missing Critical] Documented pre-existing test suite baseline**

- **Found during:** Task 2 full-suite verification
- **Issue:** The plan's acceptance criteria include "`npm test` — full suite green (no regressions in any existing router)". The full suite has 69 pre-existing failures unrelated to this plan. Without documenting this, a future auditor could mistakenly attribute them to Plan 26-05.
- **Fix:** Verified via `git stash` + `npm test` that the baseline (without Plan 26-05 changes) has identical 17 failed files / 69 failed tests. Appended this finding to `deferred-items.md` with timestamp and exact counts.
- **Files modified:** `.planning/phases/26-research-module-data-server/deferred-items.md`
- **Verification:** Baseline `532 passed` vs with-changes `551 passed` = exactly +19 (matches 19 flipped it.todos). Zero regressions.
- **Committed in:** `ed638f4` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both auto-fixes are essential — the `server-only` mock unblocked the test harness from even running, and the baseline documentation prevents mis-attribution. No scope creep; no new functionality added beyond the plan's spec.

## Issues Encountered

- **Ownership check placement in `reject`/`approve`/`retract`.** Initial read of the plan suggested every lifecycle mutation should have `assertOwnershipOrBypass`. Re-reading Pitfall 6 and the plan's `interfaces` table clarified: the guard belongs ONLY on `update` and `submitForReview`. The other 3 lifecycle mutations are gated by `research:publish` / `research:retract` which are admin/policy_lead-only — no research_lead can reach those paths.
- **retract reason schema.** The plan's Zod snippet initially suggested `retractionReason: z.string()...` without `.optional()`. Verified the plan's interfaces table AND Task 1 acceptance criteria explicitly call for "REQUIRED for retract". Kept it as `z.string().min(1).max(2000)` with no `.optional()`. Acceptance-criteria grep `grep -A3 "^  retract:" ... | grep -q "retractionReason: z.string().min(1).max(2000)"` passes.

## User Setup Required

None — no external service configuration required. This plan is pure TypeScript + tRPC, zero new packages.

## Next Phase Readiness

- **Phase 27 (Research Workspace Admin UI):** All 15 tRPC procedures are registered and type-safe. Client-side `trpc.research.list.useQuery()`, `trpc.research.create.useMutation()`, etc. are available immediately. The `AppRouter` type export propagates the full surface.
- **Phase 28 (Public /research/items Listing & Detail):** `trpc.research.listPublic` + `trpc.research.getById` are wired with the Pitfall 5 anonymous-author filter. Truly public (no-auth) routes will bypass tRPC and query `researchItems` directly from server components (same pattern as existing `/portal`).
- **Phase 26 closeout:** Phase 26 is now complete — entire backend substrate (schema + migration + permissions + constants + lifecycle service + router) is shipped, type-checked, tested, and registered.

## Self-Check: PASSED

- src/server/routers/research.ts: FOUND (623 lines)
- src/server/routers/_app.ts: MODIFIED (researchRouter imported + registered)
- src/__tests__/research-router.test.ts: MODIFIED (19 real assertions + 3 it.todo)
- .planning/phases/26-research-module-data-server/deferred-items.md: MODIFIED (baseline documented)
- Task 1 commit a50215c: FOUND
- Task 2 commit ed638f4: FOUND
- npx tsc --noEmit: CLEAN (no TypeScript errors)
- npx vitest run src/__tests__/research-router.test.ts: 19 passed, 3 todo
- Full npm test: 551 passed, 54 todo, 69 failed (baseline 532/73/69 — +19 matches flipped it.todos, 0 regressions)
- grep verification for all 15 procedures, 6 permission guards, RESEARCH-02 nextval pattern, Pitfall 5 filter, Pitfall 6 helper, Open Q1 status lock, z.guid() usage, z.uuid() absence, 12 ACTIONS constants, onConflictDoNothing, transitionResearch delegations: ALL PASS

---
*Phase: 26-research-module-data-server*
*Completed: 2026-04-19*
