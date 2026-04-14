---
phase: 19-public-participate-intake-clerk-invite-turnstile
plan: 02
subsystem: inngest
tags: [inngest, clerk, rate-limit, nonretriable, wave-2, parallel]

# Dependency graph
requires:
  - phase: 19-00
    provides: Wave 0 RED contract (tests/phase-19/participate-intake.test.ts)
  - phase: 17
    provides: workshopCompletedFn canonical Inngest function pattern (inlined triggers, step.run error policy)
  - phase: 16
    provides: notification-dispatch Inngest 5xx/4xx retry branching pattern
provides:
  - participateIntakeFn Inngest function with id 'participate-intake'
  - rateLimit keyed on event.data.emailHash (1/15m) for INTAKE-03 abuse prevention
  - Clerk invitation creation with ignoreExisting:true and publicMetadata.role='stakeholder'
  - Unconditional welcome email dispatch (no info leak on existing user)
  - Clerk 5xx → plain Error (retry); 4xx → NonRetriableError
  - Registration in src/inngest/functions/index.ts (served by /api/inngest)
affects:
  - 19-01 (Route Handler that fires participate.intake event)
  - 19-03 (sendWelcomeEmail helper consumed by this function)
  - 19-04 (cal.com webhook which may reuse Clerk invite pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inlined triggers literal string ({ event: 'participate.intake' }) avoids cross-plan event registry coupling in Wave 2 parallel"
    - "isClerkAPIResponseError guard + status ≥ 500 branch mirrors notification-dispatch's retriable vs permanent split"
    - "Wave 2 parallel cross-seam: import sendWelcomeEmail from 19-03 at compile time; tests mock at module level"

key-files:
  created:
    - src/inngest/functions/participate-intake.ts
  modified:
    - src/inngest/functions/index.ts

key-decisions:
  - "Use string-literal trigger event 'participate.intake' (not participateIntakeEvent import) — Plan 19-01 ships the event registry in parallel; string literal decouples the two Wave 2 plans"
  - "Import sendWelcomeEmail from @/src/lib/email even though 19-03 ships it — test mocks cover import-time absence; runtime TypeScript diagnostic clears when 19-03 merges"
  - "Wrap Clerk error branching in try/catch inside step.run (not outside) so Inngest's retry contract applies per-step, matching workshop-completed.ts Phase 17 precedent"
  - "Cast event.data inline with structural shape; do not import ParticipateIntakeData type from events.ts to keep this file independent of 19-01"

patterns-established:
  - "Wave 2 cross-plan seam: downstream worker imports upstream helper by path; Wave 0 test mocks the import at module level; TypeScript diagnostic is tolerated until both plans merge"
  - "String-literal Inngest trigger name is acceptable when the registered EventType lives in a parallel plan — Inngest resolves trigger-to-event at runtime by name, not by reference"

requirements-completed: [INTAKE-03, INTAKE-04, INTAKE-06]

# Metrics
duration: 2min
completed: 2026-04-14
---

# Phase 19 Plan 02: participateIntakeFn Summary

**Inngest worker for /participate flow: 15m emailHash rate-limit + Clerk invitation with ignoreExisting + unconditional welcome email, with 5xx-retry / 4xx-NonRetriable error policy.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-14T11:34:29Z
- **Completed:** 2026-04-14T11:35:59Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 edited)

## Accomplishments

- `participateIntakeFn` shipped with exact contract: id `'participate-intake'`, `rateLimit { key: 'event.data.emailHash', limit: 1, period: '15m' }`, Clerk invitation with `ignoreExisting:true` + `publicMetadata.role='stakeholder'`, unconditional `sendWelcomeEmail` call (INTAKE-06 no-leak guarantee).
- Error policy matches Phase 16/17 precedent: Clerk 5xx throws plain Error (Inngest retries up to 3), 4xx throws `NonRetriableError`, non-Clerk errors escalate to `NonRetriableError`.
- Function registered in `src/inngest/functions/index.ts` functions array (served by `/api/inngest`).
- All 8 Wave 0 RED contracts (importability probe + Tests 2.1–2.7) now GREEN with zero deviations from plan.

## Task Commits

1. **Task 1: Implement participateIntakeFn with rateLimit + Clerk invite + welcome email** — `4887e66` (feat)
2. **Task 2: Register participateIntakeFn in src/inngest/functions/index.ts** — `0c83b39` (feat)

## Files Created/Modified

- `src/inngest/functions/participate-intake.ts` — **CREATED** — Inngest function: rate-limited, Clerk invitation, welcome email, 5xx-retry / 4xx-NonRetriable branching.
- `src/inngest/functions/index.ts` — **MODIFIED** — Added import + array entry (`participateIntakeFn, // Phase 19`).

## Decisions Made

- **String-literal trigger over EventType import:** Plan 19-01 registers `participateIntakeEvent` in `src/inngest/events.ts` in parallel (Wave 2). Importing it here would couple execution order of two parallel plans. Inngest resolves triggers by event-name string at runtime, so `{ event: 'participate.intake' }` is operationally equivalent and removes the coupling.
- **Inline `event.data` structural cast:** Same reason — avoids importing `ParticipateIntakeData` type from 19-01. The cast shape `{ email, name, orgType, emailHash, expertise? }` matches the Wave 0 test fixture exactly.
- **sendWelcomeEmail import from 19-03:** Plan explicitly authorizes this cross-seam (Wave 2 parallel). The Wave 0 test uses `vi.mock('@/src/lib/email', ...)` so runtime is clean; the compile-time TypeScript diagnostic resolves when 19-03 merges.
- **No try/catch around `sendWelcomeEmail`:** Plan instructs bare `await` so Resend/helper failures bubble through Inngest's retry contract (3 retries).

## Deviations from Plan

None — plan executed exactly as written. Only micro-adjustment was omitting the decorative `import { participateIntakeEvent } from '../events'` line shown in the `<interfaces>` code block, since the final implementation uses the string-literal trigger instead. This was explicitly sanctioned by the plan's key-links pattern (trigger name is what matters for Inngest, not the EventType reference).

## Issues Encountered

None. Tests passed first run (8/8 green in 3.77s).

## User Setup Required

None — Clerk invitations API and Inngest are already configured from prior phases. No new env vars.

## Next Phase Readiness

- **Unblocks 19-01 runtime:** Route handler can fire `participate.intake` events; worker is registered and will consume them.
- **Unblocks 19-03 integration:** Once `sendWelcomeEmail` ships, `npx tsc --noEmit` is clean on this file with no code changes required.
- **Rate-limit verification:** End-to-end rate-limit verification (burst 10 requests → 1 Clerk call) will happen in Phase 19 end-of-phase validation against the Inngest dev server.

## Self-Check: PASSED

- `src/inngest/functions/participate-intake.ts` FOUND
- `src/inngest/functions/index.ts` FOUND (contains 2 `participateIntakeFn` occurrences)
- Commit `4887e66` FOUND (Task 1)
- Commit `0c83b39` FOUND (Task 2)
- `npm test -- --run tests/phase-19/participate-intake.test.ts` → 8/8 GREEN

---
*Phase: 19-public-participate-intake-clerk-invite-turnstile*
*Plan: 02*
*Completed: 2026-04-14*
