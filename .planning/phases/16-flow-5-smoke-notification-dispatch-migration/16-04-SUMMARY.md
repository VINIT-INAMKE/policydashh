---
phase: 16-flow-5-smoke-notification-dispatch-migration
plan: 04
subsystem: testing
tags: [vitest, inngest, smoke-test, fix-07]

requires:
  - phase: 16-flow-5-smoke-notification-dispatch-migration/03
    provides: 7 router callsites already migrated to sendNotificationCreate (NOTIF-04 / NOTIF-06 chain ready for Flow 5 walk)
  - phase: 16-flow-5-smoke-notification-dispatch-migration/02
    provides: notificationDispatchFn registered at /api/inngest
  - phase: 16-flow-5-smoke-notification-dispatch-migration/01
    provides: notifications.idempotency_key column + sendNotificationCreate helper
  - phase: 16-flow-5-smoke-notification-dispatch-migration/00
    provides: create-draft-cr.test.ts scaffold (3 passing + 1 it.todo to promote)
provides:
  - create-draft-cr.test.ts fully GREEN (5/5 passing, no todos) — automated regression coverage for FIX-07 success + error paths
  - 16-SMOKE.md placeholder with full walk procedure preserved verbatim, status=deferred (batched to milestone-end per workflow preference)
  - 16-HUMAN-UAT.md tracking the deferred smoke walk (created in phase verification step)
affects: [milestone v0.2 closeout, /gsd:complete-milestone audit gate]

tech-stack:
  added: []
  patterns:
    - "Deferred smoke walks: when a phase plan ends with a human-verify checkpoint that requires live dev servers + browser flows, write {phase}-SMOKE.md with status: deferred + full procedure intact, persist as HUMAN-UAT, batch to milestone-end."

key-files:
  created:
    - .planning/phases/16-flow-5-smoke-notification-dispatch-migration/16-SMOKE.md (deferred placeholder)
    - .planning/phases/16-flow-5-smoke-notification-dispatch-migration/16-04-SUMMARY.md
  modified:
    - src/inngest/__tests__/create-draft-cr.test.ts (Task 04-01: it.todo → 2 concrete error-path tests, 5/5 GREEN)

key-decisions:
  - "Defer the Flow 5 manual smoke walk to end-of-milestone v0.2 instead of pausing Phase 16 closeout for it. Operator confirmed this is the workflow preference for ALL human-verify smoke walks in v0.2 (saved to memory: feedback_defer_smoke_walks.md)."
  - "Promote create-draft-cr.test.ts it.todo to two concrete error-path tests: sequence allocation failure (pre-transaction) and transaction-callback rejection (rollback propagation)."

patterns-established:
  - "Deferred smoke walk: status=deferred, full procedure preserved verbatim, tracked via HUMAN-UAT, batched to /gsd:complete-milestone audit gate"

requirements-completed: [FIX-07]

duration: ~5min (Task 04-01 only; 04-02 deferred)
completed: 2026-04-14
---

# Phase 16 Plan 04: Flow 5 Smoke + FIX-07 Gate Summary

**create-draft-cr.test.ts promoted to fully GREEN (5/5, error paths included); manual Flow 5 smoke walk deferred to milestone-end batch with full procedure preserved in 16-SMOKE.md.**

## Performance

- **Duration:** ~5 min (Task 04-01 only — Task 04-02 deferred, no executor time spent on the walk itself)
- **Started:** 2026-04-14 (continuation of Phase 16 execution chain after Plan 03)
- **Completed:** 2026-04-14
- **Tasks:** 1 executed (04-01), 1 deferred (04-02 → milestone-end)
- **Files modified:** 3 (1 test file, 1 SMOKE placeholder, 1 SUMMARY)

## Accomplishments

- **Task 04-01:** Promoted the lone `it.todo` in `src/inngest/__tests__/create-draft-cr.test.ts` to two concrete error-path tests:
  - Sequence allocation failure (`'relation "cr_id_seq" does not exist'` rejection before the transaction opens — exercises the upstream-failure contract)
  - Transaction-callback rejection (exercises the rollback propagation contract; uses the canonical `vi.hoisted()` mock pattern established in Plan 00)
- **5/5 tests GREEN** — `npm test -- --run src/inngest/__tests__/create-draft-cr.test.ts` exits 0; `grep -c "it\.todo"` returns 0; `grep -c "CR-042"` returns 2.
- FIX-07 now has automated regression coverage on both happy and error paths even with the manual smoke walk deferred.
- **Task 04-02:** Wrote `16-SMOKE.md` with `status: deferred`, preserving the full walk procedure verbatim (pre-conditions, dev-server start, test feedback selection, browser flow, 4 effect verification queries, baseline regression gate, clean shutdown). The file will be promoted to `status: passed` / `status: gated` and gain a `## Results` section when the operator runs the walk before `/gsd:complete-milestone`.

## Task Commits

1. **Task 04-01: Flesh out create-draft-cr.test.ts to fully GREEN** — `d5fddbc` (test)
2. **Task 04-02: Manual smoke walk** — DEFERRED. SMOKE.md placeholder + this SUMMARY committed inline by orchestrator.

## Files Created/Modified

- `src/inngest/__tests__/create-draft-cr.test.ts` — 5/5 GREEN (was 3 passing + 1 it.todo). Added two error-path tests using `vi.hoisted()` mock pattern.
- `.planning/phases/16-flow-5-smoke-notification-dispatch-migration/16-SMOKE.md` — Created with `status: deferred`, full walk procedure preserved.
- `.planning/phases/16-flow-5-smoke-notification-dispatch-migration/16-04-SUMMARY.md` — This file.

## Decisions Made

1. **Deferral of Task 04-02 to milestone-end:** Operator stated `"we will do these testings at the end of entire milestone at once. Lets continue ahead."` Established as durable workflow preference (see memory: `feedback_defer_smoke_walks.md`). Applies to all v0.2 phases with human-verify smoke walks.
2. **SMOKE.md as placeholder, not absent:** Writing a `status: deferred` SMOKE.md (instead of skipping the file entirely) preserves the walk procedure verbatim so the milestone-end session has a single document to drive from, and the file participates in `/gsd:audit-uat` tracking via HUMAN-UAT.
3. **Closure pattern:** Phase 16 will be marked complete in ROADMAP/STATE/REQUIREMENTS once the verifier creates `16-HUMAN-UAT.md`. The HUMAN-UAT remains `status: partial` and surfaces in `/gsd:progress` / `/gsd:audit-uat` until the milestone-end walk resolves it.

## Deviations from Plan

### Plan-level deviation: Task 04-02 deferred

- **Rule:** Workflow preference (memory `feedback_defer_smoke_walks.md`) overrides the plan's `autonomous: false` checkpoint
- **Found during:** Plan 04 execution after Task 04-01 completed and the executor returned the human-verify checkpoint
- **Decision:** Deferred Task 04-02 to milestone end. Acceptance criteria for Task 04-02 (status: passed/gated, ≥4 PASS/GATED tokens, 4 Effect sections) will be satisfied later.
- **Risk acknowledgement:** Limited to integration-edge issues (env wiring, dev-server startup, real Resend delivery). All in-process logic is covered by the automated suite (5 phase-16 test files + feedback-machine + cr-machine + versioning regression suites — 44/44 GREEN).
- **Tracking:** HUMAN-UAT will hold the open item through to `/gsd:complete-milestone`.

### Auto-fixed during Task 04-01

None — Task 04-01 followed the plan's `<action>` block exactly.

## Issues Encountered

None during Task 04-01. The deferral of Task 04-02 is a workflow choice, not an issue.

## User Setup Required

None for Task 04-01 (test file change). Task 04-02 (when run at milestone end) requires:
- `RESEND_API_KEY` in `.env.local` (optional — Effect 2 will be `gated` if unset)
- `DATABASE_URL` pointing at dev Neon (already set per project baseline)
- Two terminals for `npm run dev` + `npx inngest-cli@latest dev`
- Browser sign-in as admin/policy_lead

See `16-SMOKE.md` for the complete procedure.

## Next Phase Readiness

- Phase 16 ready for verification (`gsd-verifier`). Verifier should mark FIX-07 as `human_needed` and persist `16-HUMAN-UAT.md`. Operator's pre-given approval (deferred-batching policy) auto-resolves the verifier's `human_needed` gate to `passed` for ROADMAP/STATE purposes.
- Phase 17 (Workshop Lifecycle + Recording Pipeline) unblocked.
- Milestone-end `/gsd:complete-milestone` will need to surface this deferred smoke walk plus any others accumulated through phases 17–25.

---
*Phase: 16-flow-5-smoke-notification-dispatch-migration*
*Plan: 04*
*Completed: 2026-04-14 (Task 04-01 executed, Task 04-02 deferred to milestone-end batch)*
