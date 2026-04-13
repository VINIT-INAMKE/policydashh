---
phase: 16-flow-5-smoke-notification-dispatch-migration
plan: 03
subsystem: trpc-routers

tags: [inngest, notifications, trpc-routers, callsite-migration, idempotency, fan-out, dual-write]

# Dependency graph
requires:
  - phase: 16
    provides: sendNotificationCreate + computeNotificationIdempotencyKey (Plan 01), notificationDispatchFn registered on /api/inngest (Plan 02)
  - phase: 08
    provides: legacy createNotification helper (dual-write transition safety — not deleted)
provides:
  - src/server/routers/feedback.ts — startReview + close now emit notification.create (decide reference path untouched)
  - src/server/routers/changeRequest.ts — submitForReview + approve + merge now emit notification.create
  - src/server/routers/version.ts — publish fans out N notification.create events (single loop, replaces double-loop)
  - src/server/routers/sectionAssignment.ts — assign now emits notification.create (email lookup deleted — dispatcher owns it)
affects: [16-04, verifier]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Awaited tRPC → Inngest emit: every migrated callsite replaces `createNotification(...).catch(console.error)` with `await sendNotificationCreate(...)`. Emit failures now propagate to the tRPC mutation response instead of being silently swallowed; Inngest retries absorb transient failures durably"
    - "Double-loop collapse in version.publish: the legacy N-user fan-out + N-user email lookup was collapsed into a single N-user sendNotificationCreate loop; the notificationDispatchFn handles both the DB insert and email send inside its own step.run blocks, eliminating the redundant inArray user-email query"
    - "Dual-write NULL bypass: the legacy createNotification helper in src/lib/notifications.ts is left in place — any residual callers (none in routers now, but lib/util code might still import) insert with idempotency_key NULL and are unaffected by the partial unique index. All 7 router callsites route through the new path; no coexistence issues observed"
    - "Grep-visible comment hygiene: Plan 03 acceptance criteria assert `grep -c \"createNotification\"` and `grep -c \"sendVersionPublishedEmail\"` return 0 in the migrated files. Comments referencing the legacy helper names must either be reworded or the grep gate will flag them — discovered in Task 03-03 when a NOTIF-04 comment mentioned both legacy names by reference"

key-files:
  created: []
  modified:
    - src/server/routers/feedback.ts
    - src/server/routers/changeRequest.ts
    - src/server/routers/version.ts
    - src/server/routers/sectionAssignment.ts

key-decisions:
  - "Keep `import { createNotification }` in feedback.ts per plan text (dual-write strategy) even though it is unused after the 2 callsites are migrated. tsconfig.json does NOT enable `noUnusedLocals`/`noUnusedParameters`, so `npx tsc --noEmit` stays clean. Plan 03 explicitly says the import STAYS in feedback.ts for transition safety — honored verbatim. The 3 other routers had every callsite replaced AND the plan explicitly asked for the import to be removed (to avoid unused-import lint), so those imports were dropped"
  - "Reword the NOTIF-04 comment in version.publish to avoid the words `createNotification` and `sendVersionPublishedEmail`. Originally the comment read 'replaces the old double-loop (createNotification + sendVersionPublishedEmail)'; post-edit it reads 'replaces the old legacy notification + email double-loop'. This is because the Plan 03 acceptance criteria for Task 03-03 require `grep -c \"createNotification\" src/server/routers/version.ts = 0` and `grep -c \"sendVersionPublishedEmail\" src/server/routers/version.ts = 0`, and grep does not distinguish code from comments. Preserving semantic intent while satisfying grep gates"
  - "Drop the `inArray` import from version.ts along with the email-lookup loop. After removing the `db.select(...).where(inArray(users.id, userIds))` block, `inArray` had no other callers in the file — confirmed via grep before removing. `users` and `eq` both stay (still used in list/getById leftJoins)"
  - "Use the `section?.documentId` result as a `const` in sectionAssignment.ts after removing the email path. It was originally `let documentId = section?.documentId` because the email block nominally needed the reassigned value post-lookup; with the email block deleted the variable is only read once, so `const` is idiomatic. Pure cleanup, no semantic change"
  - "Section-assignments test file skipped as pre-existing failure. `src/__tests__/section-assignments.test.ts` fails at import time with 'No database connection string was provided to neon()' — this is the exact pre-existing suite-load failure documented in Phase 16 `deferred-items.md` (Wave 0 baseline). The test imports `@/src/server/rbac/section-access` which transitively pulls `@/src/db` and crashes before any assertion runs. NOT a regression from Plan 03 — verified by reading the test file (9 lines of assertions against `BYPASS_SECTION_SCOPE`, zero references to the `assign` mutation or `sendNotificationCreate`)"

patterns-established:
  - "Pattern 1: Callsite migration with comment sanitization — when migrating from named function A to named function B with a grep-verified acceptance criterion (`grep -c \"A\" = 0`), comments describing the migration must not mention A by name. Either reword the comment to use generic language ('legacy helper', 'old double-loop') or move the migration history into the commit message / summary. Grep does not parse comments vs code"
  - "Pattern 2: Dual-write transition where legacy import is deliberately preserved — feedback.ts keeps the unused `createNotification` import per the plan's explicit 'STAYS' directive. Future migrations should follow this convention when the plan owner wants the legacy symbol to remain importable for safety-net reasons, even at the cost of an unused-import warning (or, if tsconfig enables noUnusedLocals, at the cost of a `// eslint-disable` escape hatch)"

requirements-completed: [NOTIF-04]

# Metrics
duration: 6min
completed: 2026-04-13
---

# Phase 16 Plan 03: tRPC Router Callsite Migrations Summary

**NOTIF-04 shipped: all 7 `createNotification(...).catch(console.error)` callsites across 4 router files have been replaced with awaited `sendNotificationCreate(...)` emits that route through the Plan 02 notificationDispatchFn — `feedback.startReview`, `feedback.close`, `changeRequest.submitForReview`, `changeRequest.approve`, `changeRequest.merge`, `version.publish` (collapsed from a double-loop to a single fan-out), and `sectionAssignment.assign` (email lookup deleted, dispatcher owns it) — with `feedback.decide`'s `sendFeedbackReviewed` reference path untouched and 44/44 regression tests green.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-13T22:06:55Z
- **Completed:** 2026-04-13T22:12:31Z
- **Tasks:** 4 / 4 (all auto)
- **Files created:** 0
- **Files modified:** 4 (one router per task)

## Accomplishments

- **`src/server/routers/feedback.ts`** — 2 callsites migrated (`startReview`, `close`). The `feedback.decide` mutation still uses `sendFeedbackReviewed` (Flow 5 reference path) — verified untouched by grep count `sendFeedbackReviewed = 2` (import + call). The `createNotification` import is preserved per plan text's explicit "STAYS" directive (dual-write transition strategy). Grep totals: `sendNotificationCreate = 3` (1 import + 2 calls), `createNotification( = 0`.
- **`src/server/routers/changeRequest.ts`** — 3 callsites migrated (`submitForReview`, `approve`, `merge`). The `createNotification` import was removed (every callsite in this file was replaced, so the import would have been dead weight). Grep totals: `sendNotificationCreate = 4` (1 import + 3 calls), `createNotification = 0`.
- **`src/server/routers/version.ts`** — `publish` mutation's double-loop (per-user `createNotification` + per-user `sendVersionPublishedEmail` with an `inArray` email lookup in between) collapsed into a single `for (const { userId } of assignedUsers)` loop that awaits `sendNotificationCreate` per user. Dropped 3 imports: `createNotification`, `sendVersionPublishedEmail`, and `inArray` (the last was only used by the now-deleted email lookup). Grep totals: `sendNotificationCreate = 3` (1 import + 1 call inside loop + 0 others — wait: the count is 3 because the loop call is `await sendNotificationCreate` one line + the import line + a reference in the explanatory comment that DOES match grep — actually let me re-check, the final state is 3 which is 1 import + 1 call + 1 comment mention of the symbol name in the NOTIF-04 comment. All matches are intentional).
- **`src/server/routers/sectionAssignment.ts`** — 1 callsite migrated (`assign`). The inline `db.select({email: users.email}).from(users).where(eq(users.id, input.userId)).limit(1)` block and the subsequent `sendSectionAssignedEmail(...)` call were both deleted (notificationDispatchFn looks up the email itself in its `fetch-user-email` step). The `users` schema import STAYS because it is still used by `listBySection` leftJoins in the same file. Dropped imports: `createNotification`, `sendSectionAssignedEmail`. Changed `let documentId` to `const documentId` since the email path deletion means it is only read. Grep totals: `sendNotificationCreate = 2`, `createNotification = 0`, `sendSectionAssignedEmail = 0`.
- **Phase-level greps clean:** `grep -rc "createNotification(" src/server/routers/` returns 0 across all 13 router files (all 7 legacy callsites gone). `grep -c "sendNotificationCreate"` in the 4 migrated routers totals 12 (3+4+3+2), exceeding the plan's ≥11 threshold.
- **Regression gates green:** `npx vitest run src/__tests__/feedback-machine.test.ts src/__tests__/cr-machine.test.ts src/__tests__/versioning.test.ts` → 3 files, 44 tests passed, zero failures. Each per-task run was also green individually during the task's verify step.
- **`npx tsc --noEmit` clean** after every task (ran 4 times total, zero type errors introduced at any step).
- **Legacy helper preserved:** `src/lib/notifications.ts` still exists with `createNotification` export intact (dual-write safety window; scope boundary respected per plan directive).
- **Flow 5 reference path preserved:** `feedback.decide` at line ~398 still uses `await sendFeedbackReviewed({...})` — this is the Plan 02 Flow 5 entry point and Plan 03 scope explicitly excluded it. Verified by grep count 2 for `sendFeedbackReviewed` (1 import + 1 call).

## Task Commits

1. **Task 03-01: Migrate feedback.ts (startReview + close)** — `1e4d79c` (feat). 2 callsites replaced, 1 import added (`sendNotificationCreate` to the existing events import), 0 imports removed (legacy `createNotification` stays per plan directive). `feedback-machine.test.ts` 18/18 green. `tsc --noEmit` clean.
2. **Task 03-02: Migrate changeRequest.ts (submitForReview + approve + merge)** — `20df5ac` (feat). 3 callsites replaced, `createNotification` import swapped for `sendNotificationCreate` from `@/src/inngest/events`. `cr-machine.test.ts` 17/17 green. `tsc --noEmit` clean.
3. **Task 03-03: Collapse version.publish double-loop** — `eac7138` (feat). Two loops merged into one, 3 imports dropped (`createNotification`, `sendVersionPublishedEmail`, `inArray`), NOTIF-04 explanatory comment reworded to avoid `grep -c "createNotification" = 0` false-hits in comment text. `versioning.test.ts` 9/9 green. `tsc --noEmit` clean.
4. **Task 03-04: Migrate sectionAssignment.assign** — `4096c7c` (feat). 1 callsite replaced, email lookup + `sendSectionAssignedEmail` call deleted, `createNotification` and `sendSectionAssignedEmail` imports removed, `users` import kept (still used by `listBySection`), `let documentId` → `const documentId`. `section-assignments.test.ts` fails at import time with the pre-existing suite-load error documented in `deferred-items.md` — NOT a regression. `tsc --noEmit` clean.

**Plan metadata commit:** _(pending — attached to SUMMARY.md + STATE.md + ROADMAP.md update)_

## Files Created/Modified

- `src/server/routers/feedback.ts` — **MODIFIED.** 2 callsite replacements, 1 import extended (`sendFeedbackReviewed` → `sendFeedbackReviewed, sendNotificationCreate`). `createNotification` import line preserved per plan directive. Net: +25/-19 lines.
- `src/server/routers/changeRequest.ts` — **MODIFIED.** 3 callsite replacements, `createNotification` import swapped for `sendNotificationCreate` from inngest/events. Net: +34/-28 lines.
- `src/server/routers/version.ts` — **MODIFIED.** Double-loop collapsed to single fan-out; 3 imports removed (`createNotification`, `sendVersionPublishedEmail`, `inArray`); NOTIF-04 comment reworded to pass grep gates. Net: +17/-31 lines.
- `src/server/routers/sectionAssignment.ts` — **MODIFIED.** 1 callsite replacement, email lookup block deleted, 2 imports removed (`createNotification`, `sendSectionAssignedEmail`), `let` → `const`, `users` import preserved (used by listBySection). Net: +15/-26 lines.

**Cumulative:** 4 files modified, +91/-104 lines (net −13 lines — migration is a genuine simplification, not a refactor hiding complexity).

## Decisions Made

- **feedback.ts retains unused `createNotification` import per plan's explicit "STAYS" directive.** The plan text says: "The existing `import { createNotification } from '@/src/lib/notifications'` STAYS (it's the legacy helper, untouched per dual-write strategy)." Even though both callsites in feedback.ts are replaced, the import remains. `tsconfig.json` does not enable `noUnusedLocals`/`noUnusedParameters` (verified by grep before committing), so `npx tsc --noEmit` still exits 0. The other 3 routers had the plan explicitly tell me to remove the import; those were removed.
- **version.ts NOTIF-04 comment reworded to satisfy grep acceptance criteria.** Original draft: `// call per user replaces the old double-loop (createNotification + sendVersionPublishedEmail)`. Final: `// call per user replaces the old legacy notification + email double-loop`. Why: Plan 03 Task 03-03 acceptance criteria require `grep -c "createNotification" src/server/routers/version.ts = 0` and `grep -c "sendVersionPublishedEmail" src/server/routers/version.ts = 0`. Grep does not know about JavaScript comments — it counts raw string occurrences. A comment mentioning the legacy names by spelling trips the gate. Rewording preserves the historical context in the comment without the verbatim names. The commit message and this summary carry the full history.
- **`inArray` import dropped from version.ts.** After removing the email-lookup loop (`db.select(...).where(inArray(users.id, userIds))`), `inArray` had zero other usages in the file — confirmed via grep before the edit. `users` and `eq` remain (both still used by `list` and `getById` leftJoins).
- **`users` import kept in sectionAssignment.ts.** The inline email-lookup block was deleted, but the `users` schema is still referenced by `listBySection` (leftJoins to show user name/role/orgType in the assignment list). Dropping the import would break tsc. Verified via grep before committing.
- **`let documentId` → `const documentId` in sectionAssignment.ts.** The variable was declared `let` only because the email block (now deleted) kept open the possibility of reassignment. With the email block gone, the variable is only read once — `const` is idiomatic. Pure cleanup, no semantic change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] version.ts NOTIF-04 comment text tripped grep acceptance criteria**
- **Found during:** Task 03-03 verification step, immediately after the first edit that replaced the two loops with a single fan-out
- **Issue:** The initial NOTIF-04 explanatory comment read `// call per user replaces the old double-loop (createNotification + sendVersionPublishedEmail)`. When I ran `grep -c "createNotification" src/server/routers/version.ts`, it returned 1 (matching the comment) rather than the required 0. Same for `sendVersionPublishedEmail`. The acceptance criterion is written as a bare grep count, so comment text with the legacy symbol names is indistinguishable from code references.
- **Fix:** Reworded the comment to `// call per user replaces the old legacy notification + email double-loop` — same intent, no verbatim legacy names. Re-ran grep: both counts flipped to 0.
- **Files modified:** `src/server/routers/version.ts` (comment block only — 2 lines reworded, no code change)
- **Verification:** `grep -c "createNotification" src/server/routers/version.ts = 0`; `grep -c "sendVersionPublishedEmail" src/server/routers/version.ts = 0`; `grep -c "sendNotificationCreate" src/server/routers/version.ts = 3` (1 import + 1 call + 1 grep hit on the non-rewordable symbol name in the comment header — but this is the symbol being migrated TO, not FROM, and is not constrained by the acceptance criteria).
- **Committed in:** `eac7138` (Task 03-03 commit — the rewording happened before the single commit for the task, so this deviation was resolved atomically in the same commit as the loop collapse)
- **Rule justification:** Rule 3 (blocking) — Task 03-03 cannot complete until its acceptance-criterion grep gates return the expected counts. The fix is strictly cosmetic (comment rewording) and preserves the historical context in the commit message + this summary.

**2. [Rule 2 - Missing critical functionality] section-assignments test file pre-existing suite-load failure**
- **Found during:** Task 03-04 verification step (`npx vitest run src/__tests__/section-assignments.test.ts`)
- **Issue:** The test file fails to load with `Error: No database connection string was provided to neon(). Perhaps an environment variable has not been set?` at `src/db/index.ts:5:13`. Zero tests run; the suite fails at import resolution. This looks like a regression from Plan 03 if examined in isolation.
- **Root cause investigation:** Read `src/__tests__/section-assignments.test.ts` — it imports `@/src/server/rbac/section-access` which transitively pulls `@/src/db` which crashes because vitest doesn't load `.env.local` automatically. The test file itself makes zero references to `sendNotificationCreate`, `sectionAssignmentRouter`, or the `assign` mutation — it only asserts against the exported `BYPASS_SECTION_SCOPE` constant array. My Plan 03 edits could not possibly have caused this failure.
- **Confirmation:** `.planning/phases/16-flow-5-smoke-notification-dispatch-migration/deferred-items.md` explicitly lists `src/__tests__/section-assignments.test.ts > full file fails to load (suite-level error)` under the "pre-existing" table at the top of the file, verified at master HEAD `d2ab069` before Phase 16 began. This is the Wave 0 baseline failure, documented as out-of-scope for every plan in Phase 16.
- **Fix:** None — this is a pre-existing failure owned by a future plan (or an env-config cleanup PR). Not a Plan 03 regression. The fix for this would be adding `dotenv/config` to vitest setup or stubbing the `db` import in the test file, which is out-of-scope for NOTIF-04 (a router callsite migration).
- **Action taken:** Documented here as a non-regression; verified by cross-reference with `deferred-items.md`. The verifier should NOT flag this as a Plan 03 failure.
- **Files modified:** None
- **Committed in:** N/A (no fix needed)
- **Rule justification:** Rule 2 is a stretch here — this isn't truly missing functionality, it's an environment-config issue. Logging it under Deviations for transparency so the verifier has the full context.

---

**Total deviations:** 1 auto-fixed (comment-grep interaction) + 1 documented non-regression (pre-existing env-config test failure).
**Impact on plan:** Zero scope creep. The comment rewording is cosmetic; the section-assignments.test failure is pre-existing and belongs in `deferred-items.md` (already there). All other acceptance criteria met exactly as specified in Plan 03.

## Deferred Issues

- **`src/__tests__/section-assignments.test.ts` full-file load failure** — Pre-existing, logged in `deferred-items.md`. Needs a future env-config fix (either `vitest.config.mts` → `setupFiles: ['dotenv/config']` or mocking `@/src/db` in the test file). Out of scope for NOTIF-04. Not a regression.

## Issues Encountered

- **Dirty working tree on plan entry.** `git status --short` showed 7 pre-existing unrelated modifications (`.planning/config.json`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `src/db/schema/users.ts`, deleted superpowers plan docs, various untracked files). These were NOT touched — every commit used explicit file paths per the task commit protocol. The dirty files remain in the working tree for whoever owns them.
- **Comment text caught by bare grep acceptance criteria.** Task 03-03's acceptance criteria use `grep -c "createNotification"` and `grep -c "sendVersionPublishedEmail"` without filtering for code vs comments. My first-pass comment included the legacy symbol names for historical documentation, which tripped both gates. Reworded to satisfy grep without losing context. Lesson captured in `tech-stack.patterns` as "Grep-visible comment hygiene" — future plans that use bare grep counts as acceptance criteria should either use more specific patterns (`-P '^\s*(await\s+)?\w+\('`) or instruct executors to sanitize comment text.

## User Setup Required

None. All changes are source-code edits; no environment variables, DB migrations, or dashboard configuration required. The dev server picks up the new router code on next restart.

**Optional smoke check** (recommended for the v0.2 verifier):

1. `npm run dev` in one terminal.
2. `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest` in another.
3. Trigger `feedback.startReview` on a test feedback item via the UI or a manual tRPC call.
4. Inngest Dev UI at <http://localhost:8288> → "Runs" tab should show a new run for `notification-dispatch` within 1s.
5. The run's step timeline should show: `insert-notification` ✓ → `fetch-user-email` ✓ → `send-email` ✓ (or skipped if the test user has no email).
6. Verify the `notifications` table has a new row: `SELECT * FROM notifications WHERE entity_type = 'feedback' AND entity_id = '<feedbackId>' ORDER BY created_at DESC LIMIT 1`.
7. Same check for `feedback.close`, `changeRequest.submitForReview/approve/merge`, `version.publish`, `sectionAssignment.assign`. The `feedback.decide` path still fires `feedback-reviewed` (not `notification-dispatch`) — this is the reference path, untouched.

## Next Phase Readiness

- **Plan 16-04 (Flow 5 smoke + FIX-07 deep-dive) fully unblocked.** All router callsites are now durable-emit. A full Flow 5 walk-through (submit feedback → reviewer decides → feedback-reviewed run in Inngest Dev UI → notification + email + auto-draft CR) can be verified in Plan 04. The `notification-dispatch` function is parallel-path: Flow 5 triggers `feedback.reviewed` (richer payload, owns the CR auto-draft step), while Plans 03's 7 migrated callsites trigger `notification.create` (simpler payload, generic dispatch).
- **Verifier must cross-reference deferred-items.md.** The `src/__tests__/section-assignments.test.ts` suite-load failure will appear in any full `npm test` run. It is NOT a Plan 03 regression — it was failing at master HEAD `d2ab069` before Phase 16 began (Wave 0 baseline, documented). The two test failures in `src/__tests__/feedback-permissions.test.ts` (specific to `denies admin` and `denies auditor` for `feedback:read_own`) are also pre-existing and in `deferred-items.md` — Plan 03 does not touch permissions, so these are also non-regressions.
- **Legacy helper still exists.** `src/lib/notifications.ts` with `createNotification` export is intact. No routers import it anymore (verified by `grep -r "createNotification" src/server/routers/` returning only the legacy unused import in `feedback.ts` kept per plan directive). Safe for Phase 17+ cleanup or a dedicated deletion PR once the dual-write window closes.
- **Callsite count verification for phase gate:** `grep -rc "createNotification(" src/server/routers/` returns 0 across all 13 router files. `grep -c "sendNotificationCreate"` across the 4 migrated routers: feedback=3, changeRequest=4, version=3, sectionAssignment=2 → total 12 (≥ 11 required by phase verification).

## Self-Check: PASSED

- `src/server/routers/feedback.ts` — FOUND with 2 `await sendNotificationCreate` calls at startReview and close; `sendFeedbackReviewed` at decide intact
- `src/server/routers/changeRequest.ts` — FOUND with 3 `await sendNotificationCreate` calls at submitForReview, approve, merge
- `src/server/routers/version.ts` — FOUND with single `await sendNotificationCreate` inside `for (const { userId } of assignedUsers)` fan-out loop
- `src/server/routers/sectionAssignment.ts` — FOUND with single `await sendNotificationCreate` in `assign` mutation
- `grep -rc "createNotification(" src/server/routers/` — 0 across all 13 files
- `grep -c "sendNotificationCreate"` totals — 3+4+3+2 = 12 (≥ 11 required)
- `grep -n "action: 'startReview'" src/server/routers/feedback.ts` — 1 match
- `grep -n "action: 'close'" src/server/routers/feedback.ts` — 1 match
- `grep -n "action: 'submitForReview'" src/server/routers/changeRequest.ts` — 1 match
- `grep -n "action: 'approve'" src/server/routers/changeRequest.ts` — 1 match
- `grep -n "action: 'merge'" src/server/routers/changeRequest.ts` — 1 match
- `grep -n "action:     'publish'" src/server/routers/version.ts` — 1 match
- `grep -n "action:     'assign'" src/server/routers/sectionAssignment.ts` — 1 match
- `grep -c "createNotification" src/server/routers/changeRequest.ts` — 0 (import removed)
- `grep -c "createNotification" src/server/routers/version.ts` — 0 (import removed + comment reworded)
- `grep -c "sendVersionPublishedEmail" src/server/routers/version.ts` — 0 (import removed + comment reworded)
- `grep -c "createNotification" src/server/routers/sectionAssignment.ts` — 0 (import removed)
- `grep -c "sendSectionAssignedEmail" src/server/routers/sectionAssignment.ts` — 0 (import removed)
- `grep -c "sendFeedbackReviewed" src/server/routers/feedback.ts` — 2 (decide reference path intact)
- `npx vitest run src/__tests__/feedback-machine.test.ts src/__tests__/cr-machine.test.ts src/__tests__/versioning.test.ts` — 3 files, 44 passed, 0 failed
- `npx tsc --noEmit` — exit 0 (ran after every task)
- `src/lib/notifications.ts` — FOUND (legacy helper preserved)
- Commit `1e4d79c` (Task 03-01) — FOUND in git log
- Commit `20df5ac` (Task 03-02) — FOUND in git log
- Commit `eac7138` (Task 03-03) — FOUND in git log
- Commit `4096c7c` (Task 03-04) — FOUND in git log

---
*Phase: 16-flow-5-smoke-notification-dispatch-migration*
*Completed: 2026-04-13*
