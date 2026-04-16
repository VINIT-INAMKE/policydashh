---
phase: 25-cross-phase-integration-smoke
plan: 00
subsystem: api, testing
tags: [trpc, typescript, vitest, middleware, type-narrowing, cardano]

# Dependency graph
requires:
  - phase: 24-engagement-tracking
    provides: touchActivity middleware in protectedProcedure chain
provides:
  - Clean TypeScript compilation (0 errors) across all router files
  - Non-null ctx.user type propagation through protectedProcedure middleware chain
  - Full test suite passing (542 tests, 0 failures)
  - Complete .env.example with WORKSHOP_FEEDBACK_JWT_SECRET
affects: [25-01, all router files using protectedProcedure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NonNullable<typeof ctx.user> type assertion in tRPC middleware next() calls for type propagation"
    - "db.update mock chain (.set().where().catch()) required in all test files using protectedProcedure"

key-files:
  created: []
  modified:
    - src/trpc/init.ts
    - src/lib/cardano.ts
    - src/server/routers/__tests__/evidence-request-export.test.ts
    - tests/phase-20.5/set-public-draft-mutation.test.ts
    - .env.example

key-decisions:
  - "Used NonNullable<typeof ctx.user> type assertion instead of ! operator for tRPC middleware type propagation"
  - "Added type narrowing to both enforceAuth and touchActivity middlewares to ensure downstream handlers receive non-null ctx.user"

patterns-established:
  - "tRPC middleware type propagation: every middleware in the protectedProcedure chain must explicitly narrow ctx.user and ctx.userId types in next() calls"
  - "Test db mock pattern: any test using protectedProcedure must include update mock chain with .set().where().catch() for touchActivity"

requirements-completed: [INTEGRATION-01]

# Metrics
duration: 14min
completed: 2026-04-16
---

# Phase 25 Plan 00: Cross-Phase Integration Smoke Pre-Cleanup Summary

**Zero TypeScript errors and zero test failures via tRPC middleware type narrowing and touchActivity db mock fixes**

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-16T17:36:18Z
- **Completed:** 2026-04-16T17:50:47Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Resolved all 182+ TS18049 ctx.user nullability errors across every router file by fixing type propagation in enforceAuth and touchActivity middlewares
- Fixed 4 TS2345 errors in cardano.ts by adding missing await on async Mesh SDK wallet methods
- Fixed 6 failing tests by adding db.update mock chain for touchActivity middleware compatibility
- Documented WORKSHOP_FEEDBACK_JWT_SECRET in .env.example

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix TypeScript ctx.user nullability errors and Cardano type errors** - `94f0fe4` (fix)
2. **Task 2: Fix 6 failing tests and add WORKSHOP_FEEDBACK_JWT_SECRET to .env.example** - `68d80ae` (fix)

## Files Created/Modified
- `src/trpc/init.ts` - Added NonNullable type assertions in enforceAuth and touchActivity middleware next() calls for proper type propagation
- `src/lib/cardano.ts` - Added await on wallet.getChangeAddress() and wallet.signTx(), cast utxos for Mesh SDK compatibility
- `src/server/routers/__tests__/evidence-request-export.test.ts` - Added db.update mock chain for touchActivity middleware
- `tests/phase-20.5/set-public-draft-mutation.test.ts` - Extended hoisted db mock with full chain and added catch() to in-test mock override
- `.env.example` - Added WORKSHOP_FEEDBACK_JWT_SECRET env var documentation

## Decisions Made
- Used `NonNullable<typeof ctx.user>` type assertion instead of `!` operator because tRPC's middleware type inference does not propagate narrowing from non-null assertion operators -- explicit type casting via `as` is required for the narrowed type to flow through the middleware chain to downstream handlers
- Applied type narrowing to both enforceAuth AND touchActivity middlewares -- the touchActivity middleware was re-broadening the type by passing unnarrrowed `{ ctx }` to `next()`, which reset the type for all downstream consumers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed touchActivity middleware type re-broadening**
- **Found during:** Task 1
- **Issue:** Plan specified fixing only enforceAuth middleware, but touchActivity middleware was passing `{ ctx }` to next() which reset the narrowed type back to the base context type, causing 182 TS18049 errors across all router files (not just the 20 in workshop.ts + init.ts)
- **Fix:** Added explicit NonNullable type assertions in touchActivity's next() call
- **Files modified:** src/trpc/init.ts
- **Verification:** npx tsc --noEmit exits 0
- **Committed in:** 94f0fe4

**2. [Rule 1 - Bug] Fixed async Mesh SDK wallet method calls in cardano.ts**
- **Found during:** Task 1
- **Issue:** wallet.getChangeAddress() and wallet.signTx() are async methods but were called without await, causing TS2345 errors (Promise<string> not assignable to string)
- **Fix:** Added await to both calls, cast utxos for selectUtxosFrom type compatibility
- **Files modified:** src/lib/cardano.ts
- **Verification:** npx tsc --noEmit exits 0
- **Committed in:** 94f0fe4

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both auto-fixes necessary for achieving the plan's success criterion of zero TypeScript errors. No scope creep.

## Issues Encountered
- The plan expected 20 TS18049 errors (18 in workshop.ts + 2 in init.ts) but the actual count was 182+ across all router files because the touchActivity middleware was the real bottleneck for type propagation. The enforceAuth fix alone only resolved workshop.ts errors; the touchActivity fix was needed to resolve errors in all other routers.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TypeScript compilation is clean (0 errors)
- Full test suite passes (542 tests, 0 failures)
- .env.example is complete
- Ready for Phase 25 Plan 01 integration walk

## Self-Check: PASSED

All files verified present. All commit hashes verified in git log.

---
*Phase: 25-cross-phase-integration-smoke*
*Completed: 2026-04-16*
