# Phase 16 — Deferred Items

Pre-existing failures observed during Plan 00 Wave 0 execution. These are
NOT caused by Wave 0 changes (confirmed via `git stash` + isolated run on
master at HEAD `d2ab069` before adding notification-dispatch.test.ts).

## Baseline drift from plan's stated "295/297"

Plan 00 success criteria reference a baseline of 295/297 passing. Actual
baseline at execution time (master HEAD = d2ab069, measured 2026-04-14):

| File | Failing Cases | Status |
|------|---------------|--------|
| `src/__tests__/section-assignments.test.ts` | full file fails to load (suite-level error) | pre-existing |
| `src/__tests__/feedback-permissions.test.ts > feedback:read_own permission > denies admin` | 1 test | pre-existing |
| `src/__tests__/feedback-permissions.test.ts > feedback:read_own permission > denies auditor` | 1 test | pre-existing |

**Scope ruling (Wave 0 executor):** Out of scope. Neither file was
touched by Plan 00 tasks, and the failures predate Phase 16. Logged here
for the verifier and subsequent plans.

## Wave 0 intentional RED files

These failures ARE expected and are the Nyquist contract for Wave 0:

- `src/inngest/__tests__/notification-create.test.ts` — 5 failing tests, flips GREEN in Plan 01 Task 01-02 (when `sendNotificationCreate` and `computeNotificationIdempotencyKey` are added to `src/inngest/events.ts`)
- `src/inngest/__tests__/notification-dispatch.test.ts` — 4 failing tests + 1 it.todo, flips GREEN in Plan 02 Task 02-01 (when `src/inngest/functions/notification-dispatch.ts` is created)

These are NOT bugs and must not be fixed in Plan 00 — they are the
automated `<verify>` targets that Plans 01 and 02 are bound to satisfy.
