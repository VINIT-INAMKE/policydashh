# Phase 19 — Deferred Items (Out of Scope)

Pre-existing test failures encountered during Plan 19-00 Wave 0 execution but
not caused by Phase 19 changes. Logged per GSD scope-boundary rule: out-of-scope
discoveries are deferred, not auto-fixed.

## Pre-existing failing tests (unchanged from Phase 16/17/18)

- `src/__tests__/section-assignments.test.ts` — entire file fails (imports broken or runtime error; same state as Phase 16 deferred list)
- `src/__tests__/feedback-permissions.test.ts` — 2 tests fail:
  - `feedback:read_own permission > denies admin`
  - `feedback:read_own permission > denies auditor`

Neither is related to the Phase 19 `/participate` intake surface. Both predate
this phase and were already present on master at 10c3512
(docs(phase-18): complete phase execution).

## Action

None for Phase 19. Owner: whichever plan touches
`src/server/routers/feedback.ts` permission wiring next (likely a post-v0.2
cleanup pass).
