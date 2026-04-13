---
phase: 16
slug: flow-5-smoke-notification-dispatch-migration
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-14
updated: 2026-04-14
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 16-RESEARCH.md `## Validation Architecture` section.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.mts |
| **Quick run command** | `npm test -- --run <test-file>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30s (full suite, 295/297 baseline) |

---

## Sampling Rate

- **After every task commit:** Run quick command for the touched test file(s)
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green at baseline (295/297) plus all new Phase 16 tests passing
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Task IDs below match the actual plan task names written in 16-00-PLAN.md through 16-04-PLAN.md.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 0-01 | 00 | 0 | FIX-07 | unit (W0 stub) | `npm test -- --run src/inngest/__tests__/create-draft-cr.test.ts` | ❌ → created by W0 | ⬜ pending |
| 0-02 | 00 | 0 | NOTIF-04, NOTIF-06 | unit (W0 stub) | `npm test -- --run src/inngest/__tests__/notification-create.test.ts` | ❌ → created by W0 | ⬜ pending |
| 0-03 | 00 | 0 | NOTIF-05, NOTIF-06 | unit (W0 stub) | `npm test -- --run src/inngest/__tests__/notification-dispatch.test.ts` | ❌ → created by W0 | ⬜ pending |
| 01-01 | 01 | 1 | NOTIF-06 | migration DDL | `grep -n idempotency_key src/db/migrations/0009_notification_idempotency.sql` + live DB query | ✅ after Plan 01 | ⬜ pending |
| 01-02 | 01 | 1 | NOTIF-04, NOTIF-06 | unit | `npm test -- --run src/inngest/__tests__/notification-create.test.ts` | ✅ after W0 | ⬜ pending |
| 02-01 | 02 | 2 | NOTIF-05 | unit (Inngest fn) | `npm test -- --run src/inngest/__tests__/notification-dispatch.test.ts` | ✅ after W0 | ⬜ pending |
| 02-02 | 02 | 2 | NOTIF-05 | import check | `grep -c notificationDispatchFn src/inngest/functions/index.ts` returns ≥ 1 | ✅ | ⬜ pending |
| 03-01 | 03 | 3 | NOTIF-04 | unit (router) | `npm test -- --run src/__tests__/feedback-machine.test.ts src/__tests__/feedback-permissions.test.ts` | ✅ | ⬜ pending |
| 03-02 | 03 | 3 | NOTIF-04 | unit (router) | `npm test -- --run src/__tests__/cr-machine.test.ts src/__tests__/cr-permissions.test.ts` | ✅ | ⬜ pending |
| 03-03 | 03 | 3 | NOTIF-04 | unit (router) | `npm test -- --run src/__tests__/versioning.test.ts` | ✅ | ⬜ pending |
| 03-04 | 03 | 3 | NOTIF-04 | unit (router) | `npm test -- --run src/__tests__/section-assignments.test.ts` | ✅ | ⬜ pending |
| 04-01 | 04 | 4 | FIX-07 | unit | `npm test -- --run src/inngest/__tests__/create-draft-cr.test.ts` | ✅ | ⬜ pending |
| 04-02 | 04 | 4 | FIX-07 | manual smoke + full suite | `npm test` + manual 4-effect walk per 16-SMOKE.md | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 (Plan 00) creates three test scaffolds so Plans 01-04 have concrete automated `<verify>` targets. Tests start RED (imports unresolved) and flip GREEN as Plans 01/02 ship implementation; Plan 04 promotes any remaining `it.todo` to concrete assertions.

- [ ] `src/inngest/__tests__/create-draft-cr.test.ts` — FIX-07 scaffold (auto-draft CR creation from accepted feedback). Goes GREEN in Plan 04 Task 04-01.
- [ ] `src/inngest/__tests__/notification-create.test.ts` — NOTIF-04 / NOTIF-06 scaffold (sendNotificationCreate payload validation + computeNotificationIdempotencyKey). Goes GREEN in Plan 01 Task 01-02.
- [ ] `src/inngest/__tests__/notification-dispatch.test.ts` — NOTIF-05 / NOTIF-06 scaffold (notificationDispatchFn step semantics + onConflictDoNothing). Goes GREEN in Plan 02 Task 02-01.
- [x] DB migration substrate — NOT a Wave 0 test file; covered by Plan 01 Task 01-01 which writes `src/db/migrations/0009_notification_idempotency.sql` and applies it to the dev DB.

*Existing test infrastructure (`vitest`, `src/__tests__/*`, `src/inngest/__tests__/*`) covers everything else.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Flow 5 end-to-end smoke walk | FIX-07 | Requires real dev server + Inngest dev server + Resend test inbox; spans tRPC → Inngest → DB → email provider | See Plan 04 Task 04-02. Summary: 1) `npm run dev` + `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`; 2) Sign in as admin; 3) Open a feedback item, click Start Review → Decide → Accept; 4) Within ~5s assert: (a) in-app notification row in `notifications` table, (b) Resend inbox shows email (or skipped if RESEND_API_KEY unset — Effect 2 gated), (c) draft CR row in `change_requests` linked via `cr_feedback_links` + `cr_section_links`, (d) `workflow_transitions` rows logged; 5) Record all outputs in 16-SMOKE.md |
| Resend email delivery | NOTIF-05 | External provider, requires test API key | Verify test inbox for delivery. If RESEND_API_KEY unset, mark as "gated" — NOT a failure (per src/lib/email.ts:3 silent no-op pattern) |
| Idempotency dual-write | NOTIF-06 | Requires racing legacy + Inngest paths during transition window | NOT racing in Phase 16: the unique partial index on `idempotency_key WHERE idempotency_key IS NOT NULL` makes legacy NULL-key inserts unaffected, and the new Inngest path is the only code populating the key. Phase 16 exits with ALL 7 router callsites migrated, so there is no real dual-write window. The index is belt-and-suspenders for future redeploys. Manual verification: after Plan 03, grep confirms zero `createNotification(` callsites in `src/server/routers/`. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (3 new test files; DB migration is Plan 01 not Wave 0)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter (planner set 2026-04-14 after writing 16-00 through 16-04 plans)

**Approval:** planner-signed 2026-04-14. Executor may proceed with Plan 00.
