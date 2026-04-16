---
phase: 23-cardano-preview-net-anchoring
plan: "00"
subsystem: testing
tags: [vitest, tdd, cardano, inngest, red-stubs, wave-0]

requires:
  - phase: 22-milestone-entity-sha256-hashing
    provides: hashMilestone, hashPolicyVersion hashing functions used in test contracts
provides:
  - 4 RED test stub files defining behavioral contracts for VERIFY-06, VERIFY-07, VERIFY-08, VERIFY-09
  - Wave 0 Nyquist validation stubs for Plans 23-01, 23-02, 23-03
affects: [23-cardano-preview-net-anchoring]

tech-stack:
  added: []
  patterns: [it.todo RED stub pattern for wave-0 TDD contracts]

key-files:
  created:
    - src/lib/__tests__/cardano.test.ts
    - src/inngest/__tests__/milestone-ready.test.ts
    - src/inngest/__tests__/version-anchor.test.ts
    - src/__tests__/verified-badge.test.tsx
  modified: []

key-decisions:
  - "Used it.todo() rather than it.skip() — vitest reports these as 'todo' status, cleanly distinguishing from skipped/disabled tests"
  - "No production imports in stub files — stubs define contract descriptions only, avoiding import errors against non-existent modules"

patterns-established:
  - "Wave-0 RED stubs: use it.todo() with descriptive strings matching VERIFY-XX requirements"

requirements-completed: [VERIFY-06, VERIFY-07, VERIFY-08, VERIFY-09]

duration: 2min
completed: 2026-04-16
---

# Phase 23 Plan 00: Cardano Preview-Net Anchoring RED Test Stubs Summary

**46 it.todo RED stubs across 4 test files defining behavioral contracts for cardano.ts, milestone-ready, version-anchor, and VerifiedBadge**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-16T12:38:33Z
- **Completed:** 2026-04-16T12:40:40Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created 13 it.todo stubs in cardano.test.ts covering requireEnv, getWallet, buildAndSubmitAnchorTx, checkExistingAnchorTx, isTxConfirmed (VERIFY-06, VERIFY-08)
- Created 14 it.todo stubs in milestone-ready.test.ts covering 5-step pipeline, step ID uniqueness, idempotency, finalize, concurrency (VERIFY-06, VERIFY-08)
- Created 9 it.todo stubs in version-anchor.test.ts covering trigger, compute-hash, anchor, confirm-and-persist (VERIFY-07)
- Created 8 it.todo stubs in verified-badge.test.tsx covering rendering, Cardanoscan link, styling (VERIFY-09)
- All 46 stubs confirmed as "todo" by vitest run with zero failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RED test stubs for cardano.ts and both Inngest functions** - `448d76b` (test)
2. **Task 2: Create RED test stub for VerifiedBadge component** - `9dbd2ed` (test)

## Files Created/Modified
- `src/lib/__tests__/cardano.test.ts` - 13 it.todo stubs for cardano.ts utility functions (VERIFY-06, VERIFY-08)
- `src/inngest/__tests__/milestone-ready.test.ts` - 14 it.todo stubs for milestone-ready Inngest function (VERIFY-06, VERIFY-08)
- `src/inngest/__tests__/version-anchor.test.ts` - 9 it.todo stubs for version-anchor Inngest function (VERIFY-07)
- `src/__tests__/verified-badge.test.tsx` - 8 it.todo stubs for VerifiedBadge React component (VERIFY-09)

## Decisions Made
- Used it.todo() rather than it.skip() for cleaner vitest reporting (todo vs skipped status)
- No production imports in stub files to avoid import errors against non-existent modules

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
These files are intentionally RED stubs (wave-0 TDD pattern). Each it.todo will be converted to real assertions as Plans 23-01, 23-02, and 23-03 implement production code:
- `src/lib/__tests__/cardano.test.ts` - 13 it.todo stubs (Plan 23-01)
- `src/inngest/__tests__/milestone-ready.test.ts` - 14 it.todo stubs (Plan 23-02)
- `src/inngest/__tests__/version-anchor.test.ts` - 9 it.todo stubs (Plan 23-02)
- `src/__tests__/verified-badge.test.tsx` - 8 it.todo stubs (Plan 23-03)

## Next Phase Readiness
- Wave 0 test contracts established for all 4 test targets
- Plans 23-01 (cardano.ts lib), 23-02 (Inngest functions), 23-03 (VerifiedBadge UI) can proceed with GREEN phase
- No blockers

## Self-Check: PASSED

- All 4 test stub files exist at expected paths
- Both task commits verified (448d76b, 9dbd2ed)
- SUMMARY.md created at .planning/phases/23-cardano-preview-net-anchoring/23-00-SUMMARY.md

---
*Phase: 23-cardano-preview-net-anchoring*
*Completed: 2026-04-16*
