---
phase: 16-flow-5-smoke-notification-dispatch-migration
verified: 2026-04-14T04:01:00Z
status: human_needed
score: 8/9 must-haves verified (1 deferred human smoke walk)
gaps: []
human_verification:
  - test: "Flow 5 end-to-end smoke walk — feedback.decide → Inngest → notification + email + auto-draft CR"
    expected: "4 observable effects confirmed: (1) notifications row with idempotency_key, (2) Resend email to submitter (or gated if RESEND_API_KEY unset), (3) change_requests row status=drafting + cr_feedback_links + cr_section_links, (4) workflow_transitions row to_state=accepted"
    why_human: "Requires running npm run dev + npx inngest-cli@latest dev + browser UI interaction. Full procedure preserved verbatim in 16-SMOKE.md (status: deferred). Operator has pre-approved batching to milestone-end per feedback_defer_smoke_walks.md memory entry."
---

# Phase 16: Flow 5 Smoke + Notification Dispatch Migration — Verification Report

**Phase Goal:** All notification dispatch runs through Inngest (off the mutation critical path) with transition-window dual-write to prevent duplicate sends; Flow 5 (feedback decided → notification + email + auto-draft CR) smoke-tested end-to-end against a running dev server.

**Verified:** 2026-04-14T04:01:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Notifications table has `idempotency_key TEXT` column with partial UNIQUE index | VERIFIED | `src/db/schema/notifications.ts` line 26: `idempotencyKey: text('idempotency_key').unique()`; `src/db/migrations/0009_notification_idempotency.sql` contains `ADD COLUMN idempotency_key TEXT` + `CREATE UNIQUE INDEX ... WHERE idempotency_key IS NOT NULL` |
| 2 | `sendNotificationCreate`, `notificationCreateEvent`, and `computeNotificationIdempotencyKey` exported from `src/inngest/events.ts` | VERIFIED | grep confirmed all 3 exports at lines 127, 133, 149 of events.ts |
| 3 | `notificationDispatchFn` exists with 3 step.run blocks (insert-notification, fetch-user-email, send-email) | VERIFIED | `src/inngest/functions/notification-dispatch.ts` (144 lines): step.run calls at lines 75, 103, 128; `onConflictDoNothing` at line 95 |
| 4 | `notificationDispatchFn` registered in functions barrel served at /api/inngest | VERIFIED | `src/inngest/functions/index.ts` line 3 imports it, line 12 exports it in functions array |
| 5 | All 7 `createNotification(` callsites in routers replaced — grep returns 0 | VERIFIED | `grep -rc "createNotification(" src/server/routers/` returns 0 across all 13 files |
| 6 | `sendNotificationCreate` present in all 4 migrated routers (≥ 12 total matches) | VERIFIED | feedback.ts=3, changeRequest.ts=4, version.ts=3, sectionAssignment.ts=2 → total 12 |
| 7 | `feedback.decide` still uses `sendFeedbackReviewed` (Flow 5 reference path untouched) | VERIFIED | `feedback.ts` line 402: `await sendFeedbackReviewed({...})` — only `sendFeedbackReviewed` call in the decide mutation |
| 8 | `create-draft-cr.test.ts` fully GREEN (5/5, no todos) — FIX-07 automated coverage | VERIFIED | Vitest: 5 concrete tests, 0 `it.todo`, 0 `it.skip`. CR-042 assertion present. Error paths (sequence failure + transaction rollback) both covered. |
| 9 | Flow 5 manual smoke walk: 4 observable effects confirmed on running dev server | HUMAN_NEEDED | Deferred to milestone-end per operator preference. 16-SMOKE.md preserves full walk procedure verbatim. |

**Score:** 8/9 truths verified (1 human_needed)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/migrations/0009_notification_idempotency.sql` | DDL: ADD COLUMN + partial UNIQUE INDEX | VERIFIED | 9 lines; ALTER TABLE + CREATE UNIQUE INDEX ... WHERE idempotency_key IS NOT NULL |
| `src/db/schema/notifications.ts` | `idempotencyKey: text('idempotency_key').unique()` | VERIFIED | Line 26 confirmed |
| `src/inngest/events.ts` | notificationCreateEvent, sendNotificationCreate, computeNotificationIdempotencyKey | VERIFIED | All 3 exports present and substantive (lines 127, 133, 149) |
| `src/inngest/functions/notification-dispatch.ts` | notificationDispatchFn with 3 step.run blocks, onConflictDoNothing, NonRetriableError | VERIFIED | 144 lines; id='notification-dispatch', retries=3, triggers inlined; all 3 step names confirmed |
| `src/inngest/functions/index.ts` | Registers notificationDispatchFn in functions array | VERIFIED | Import at line 3, array membership at line 12 |
| `src/server/routers/feedback.ts` | sendNotificationCreate replaces 2 createNotification callsites; decide untouched | VERIFIED | 3 sendNotificationCreate matches (1 import + 2 calls); sendFeedbackReviewed at decide intact |
| `src/server/routers/changeRequest.ts` | sendNotificationCreate replaces 3 callsites | VERIFIED | 4 sendNotificationCreate matches (1 import + 3 calls); 0 createNotification |
| `src/server/routers/version.ts` | Single sendNotificationCreate fan-out loop replaces double-loop | VERIFIED | 3 sendNotificationCreate matches; 0 createNotification; 0 sendVersionPublishedEmail |
| `src/server/routers/sectionAssignment.ts` | sendNotificationCreate replaces createNotification + sendSectionAssignedEmail pair | VERIFIED | 2 sendNotificationCreate matches; 0 createNotification; 0 sendSectionAssignedEmail |
| `src/inngest/__tests__/create-draft-cr.test.ts` | 5/5 GREEN, 0 todos, error paths covered | VERIFIED | 187 lines; 5 concrete it() tests; CR-042 assertion + cr_id_seq error-path + rollback path confirmed |
| `src/inngest/__tests__/notification-create.test.ts` | 5/5 GREEN | VERIFIED | Inngest suite: 27 passed / 1 todo across 6 files — all notification-create tests green |
| `src/inngest/__tests__/notification-dispatch.test.ts` | 4/4 GREEN + 1 todo (options metadata) | VERIFIED | Inngest suite confirms 27 passed / 1 todo; notification-dispatch tests green |
| `.planning/phases/16-flow-5-smoke-notification-dispatch-migration/16-SMOKE.md` | status: deferred, full procedure preserved | VERIFIED (DEFERRED) | File exists with status: deferred; full walk procedure intact for milestone-end session |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/inngest/__tests__/notification-create.test.ts` | `src/inngest/events.ts` | `import { sendNotificationCreate, notificationCreateEvent }` | VERIFIED | Imports resolve; 5/5 tests green |
| `src/inngest/__tests__/notification-dispatch.test.ts` | `src/inngest/functions/notification-dispatch.ts` | variable-path dynamic import in beforeAll | VERIFIED | 4/4 tests green |
| `src/inngest/__tests__/create-draft-cr.test.ts` | `src/inngest/lib/create-draft-cr.ts` | `import { createDraftCRFromFeedback } from '../lib/create-draft-cr'` | VERIFIED | 5/5 tests green |
| `src/inngest/functions/notification-dispatch.ts` | `src/inngest/events.ts` | `notificationCreateEvent, computeNotificationIdempotencyKey` | VERIFIED | grep confirmed at lines 52, 58, 66 of dispatch fn |
| `src/inngest/functions/notification-dispatch.ts` | `src/db/schema/notifications.ts` | `onConflictDoNothing()` on notifications insert | VERIFIED | line 95 of dispatch fn |
| `src/inngest/functions/index.ts` | `src/inngest/functions/notification-dispatch.ts` | import + functions array | VERIFIED | lines 3 and 12 |
| `src/server/routers/feedback.ts` | `src/inngest/events.ts` | `import { sendFeedbackReviewed, sendNotificationCreate }` | VERIFIED | line 16; 2 sendNotificationCreate calls confirmed |
| `src/server/routers/changeRequest.ts` | `src/inngest/events.ts` | `import { sendNotificationCreate }` | VERIFIED | 4 matches confirmed |
| `src/server/routers/version.ts` | `src/inngest/events.ts` | `import { sendNotificationCreate }` | VERIFIED | 3 matches confirmed |
| `src/server/routers/sectionAssignment.ts` | `src/inngest/events.ts` | `import { sendNotificationCreate }` | VERIFIED | 2 matches confirmed |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `notification-dispatch.ts` | `event.data` | `notificationCreateEvent` via Inngest trigger | Yes — validated by Zod schema in events.ts before emit | FLOWING |
| `notification-dispatch.ts` `insert-notification` step | `idempotencyKey` | `computeNotificationIdempotencyKey(...)` | Yes — deterministic string from event.data fields | FLOWING |
| `notification-dispatch.ts` `fetch-user-email` step | `recipientEmail` | `db.select({ email: users.email })...` real DB query | Yes — live Neon query; NonRetriableError if user missing | FLOWING |
| `src/server/routers/feedback.ts` | `sendNotificationCreate(...)` | awaited emit to Inngest with `createdBy: ctx.user.id, action: 'startReview'/'close'` | Yes — real tRPC context values | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Inngest test suite fully green | `npm test -- --run src/inngest/__tests__/` | 6 files, 27 passed, 1 todo | PASS |
| create-draft-cr.test.ts 5/5 with no todos | grep + vitest | 5 concrete it(), 0 it.todo, 0 it.skip | PASS |
| createNotification( callsites = 0 in routers | `grep -rc "createNotification("` | 0 across all 13 router files | PASS |
| sendNotificationCreate callsites ≥ 7 in routers | `grep -rc "sendNotificationCreate"` | 12 total (3+4+3+2) | PASS |
| sendFeedbackReviewed intact in feedback.decide | `grep -n "sendFeedbackReviewed" feedback.ts` | line 402, inside decide mutation | PASS |
| notificationDispatchFn registered in barrel | `grep -n "notificationDispatchFn" index.ts` | lines 3 + 12 | PASS |
| Full project test suite not regressed | `npm test` | 309 passed, 2 pre-existing failures (documented in deferred-items.md), 1 todo | PASS |
| Flow 5 manual smoke walk | dev server + browser + 4 DB effect queries | DEFERRED to milestone-end | HUMAN_NEEDED |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FIX-07 | 16-04 | v0.1 Flow 5 (feedback.decide → Inngest → notification + email + auto-draft CR) smoke test passes end-to-end | HUMAN_NEEDED | Automated: create-draft-cr.test.ts 5/5 GREEN covers FIX-07 success + error paths. Manual smoke walk deferred to milestone-end (16-SMOKE.md). REQUIREMENTS.md marks as "Pending". |
| NOTIF-04 | 16-01, 16-03 | Every createNotification callsite migrated to notification.create Inngest event | SATISFIED | `grep -rc "createNotification(" src/server/routers/` = 0; `sendNotificationCreate` present in all 4 migrated routers (12 matches). REQUIREMENTS.md marks as "Complete". |
| NOTIF-05 | 16-02 | notificationDispatch Inngest fn handles DB insert + Resend email off critical path | SATISFIED | `notification-dispatch.ts` exists (144 lines), 3 step.run blocks, registered in functions barrel. notification-dispatch.test.ts 4/4 GREEN. REQUIREMENTS.md marks as "Complete". |
| NOTIF-06 | 16-01 | Transition-window dual-write with idempotency key (createdBy+entityType+entityId+action) prevents duplicate sends | SATISFIED | `0009_notification_idempotency.sql` partial UNIQUE index deployed. `notifications.idempotencyKey` column present. `computeNotificationIdempotencyKey` exported and used by dispatch fn. `onConflictDoNothing()` in insert-notification step. REQUIREMENTS.md marks as "Complete". |

**All 4 requirement IDs from PLAN frontmatter accounted for.** No orphaned requirements detected for Phase 16 in REQUIREMENTS.md.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/inngest/functions/notification-dispatch.ts` | 120–130 | `sendFeedbackReviewedEmail` used for all email-enabled types (single-helper dispatch shortcut) | Info | Documented in file-level JSDoc as a Phase 16 scope shortcut; per-type templates deferred to Plan 17+. Not a stub — the function correctly routes to the helper. |
| `src/inngest/__tests__/notification-dispatch.test.ts` | (todo) | 1 `it.todo` on Inngest function options metadata assertion | Info | Intentional: Inngest v4 does not expose options stably. Documented in test comment. Does not affect coverage of the 4 behavioral contracts. |
| `src/server/routers/feedback.ts` | (import) | Unused `createNotification` import retained deliberately | Info | Explicit per-plan directive for dual-write transition safety. `tsconfig.json` does not enable `noUnusedLocals` — no compile error. Plan 17+ cleanup. |

No blocker or warning anti-patterns found. All info items are documented intentional decisions.

---

### Pre-Existing Test Failures (Not Phase 16 Regressions)

The full suite reports `2 failed | 309 passed | 1 todo`. The 2 failures are both pre-existing and documented in `deferred-items.md`:

- `src/__tests__/feedback-permissions.test.ts` — 2 tests (`denies admin`, `denies auditor` for `feedback:read_own`). Pre-existing before Phase 16; confirmed via git-stash baseline in Plan 00.
- `src/__tests__/section-assignments.test.ts` — full file fails to load at import time with `No database connection string was provided to neon()`. Pre-existing env-config issue; vitest does not load `.env.local` automatically for this file's transitive import of `@/src/db`.

Neither failure is caused by Phase 16 work. Neither touches notification dispatch, router callsite migration, or Flow 5 logic.

---

### Human Verification Required

#### 1. Flow 5 End-to-End Smoke Walk (FIX-07)

**Test:** Run `npm run dev` and `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest` in two terminals. Sign in as admin/policy_lead. Open a feedback item in `submitted` status, click Start Review, then click Decide → Accept with ≥20 char rationale.

**Expected:** 4 observable effects within ~5 seconds:
1. `notifications` table row with `entity_id = <feedbackId>`, `type = 'feedback_status_changed'`, `idempotency_key` populated
2. Resend email to submitter with subject referencing the feedback readable ID (or "gated" if `RESEND_API_KEY` unset)
3. `change_requests` row `status = 'drafting'` linked via `cr_feedback_links` + `cr_section_links` to the feedback and its section
4. `workflow_transitions` rows ending in `to_state = 'accepted'`

Also verify: Inngest Dev UI at http://localhost:8288 shows `feedback-reviewed` run with all steps green and a run ID.

**Why human:** Requires live dev server + Inngest dev server + browser UI click flow + external Resend delivery. Cannot be driven by vitest or curl alone.

**Procedure:** See `.planning/phases/16-flow-5-smoke-notification-dispatch-migration/16-SMOKE.md` — full walk procedure preserved verbatim with exact DB queries, pre-conditions, and SMOKE.md evidence format.

**Deferral status:** Operator pre-approved batching to milestone-end. All in-process logic (feedbackReviewedFn, createDraftCRFromFeedback, notificationDispatchFn step semantics) is covered by the automated suite (27/27 inngest tests green + 44/44 router regression tests green).

---

### Gaps Summary

No gaps. All automated deliverables are verified against the codebase. The single `human_needed` item is the deferred Flow 5 smoke walk (FIX-07 Task 04-02), intentionally batched to milestone-end per documented operator preference. The SMOKE.md file exists with status: deferred and full procedure intact.

---

_Verified: 2026-04-14T04:01:00Z_
_Verifier: Claude (gsd-verifier)_
