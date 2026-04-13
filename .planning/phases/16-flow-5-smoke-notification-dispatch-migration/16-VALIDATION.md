---
phase: 16
slug: flow-5-smoke-notification-dispatch-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 16-RESEARCH.md `## Validation Architecture` section.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test -- <test-file>` |
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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-00-01 | 00 | 0 | NOTIF-04 | unit (W0 stub) | `npm test -- create-draft-cr.test.ts` | ❌ W0 | ⬜ pending |
| 16-00-02 | 00 | 0 | NOTIF-04 | unit (W0 stub) | `npm test -- notification-create.test.ts` | ❌ W0 | ⬜ pending |
| 16-00-03 | 00 | 0 | NOTIF-05 | unit (W0 stub) | `npm test -- notification-dispatch.test.ts` | ❌ W0 | ⬜ pending |
| 16-01-01 | 01 | 1 | NOTIF-04 | migration | `npm test -- migrations.test.ts` (or grep migration file) | ⚠️ W0-driven | ⬜ pending |
| 16-01-02 | 01 | 1 | NOTIF-04 | unit | `npm test -- notification-create.test.ts` | ✅ after W0 | ⬜ pending |
| 16-02-01 | 02 | 2 | NOTIF-05 | unit | `npm test -- notification-dispatch.test.ts` | ✅ after W0 | ⬜ pending |
| 16-02-02 | 02 | 2 | NOTIF-05 | inngest function | `npm test -- inngest-functions.test.ts` | ✅ | ⬜ pending |
| 16-03-01 | 03 | 3 | NOTIF-06 | unit | `npm test -- feedback.test.ts` | ✅ | ⬜ pending |
| 16-03-02 | 03 | 3 | NOTIF-06 | unit | `npm test -- changeRequest.test.ts` | ✅ | ⬜ pending |
| 16-03-03 | 03 | 3 | NOTIF-06 | unit | `npm test -- version.test.ts` | ✅ | ⬜ pending |
| 16-03-04 | 03 | 3 | NOTIF-06 | unit | `npm test -- sectionAssignment.test.ts` | ✅ | ⬜ pending |
| 16-04-01 | 04 | 4 | FIX-07 | smoke (manual + log grep) | `npm test -- create-draft-cr.test.ts` + manual smoke | ✅ | ⬜ pending |
| 16-04-02 | 04 | 4 | FIX-07 | full suite | `npm test` (must be ≥ baseline 295/297) | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/lib/create-draft-cr.test.ts` — stubs for NOTIF-04 (auto-draft CR creation from accepted feedback)
- [ ] `tests/lib/notification-create.test.ts` — stubs for NOTIF-04 (notification row insert with idempotency key)
- [ ] `tests/inngest/notification-dispatch.test.ts` — stubs for NOTIF-05 (notificationDispatch Inngest function step semantics)
- [ ] `drizzle migration` — adds `idempotencyKey text UNIQUE` (and supporting index) to `notifications` table; mark Wave 0 if migration tooling needs setup, otherwise covered by Plan 01

*Existing test infrastructure (`vitest`, `tests/helpers/*`, `tests/inngest/*`) covers everything else.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Flow 5 end-to-end smoke walk | FIX-07 | Requires real dev server + Inngest dev server + Resend test inbox; spans tRPC → Inngest → DB → email provider | 1) `npm run dev` + `npx inngest-cli@latest dev`; 2) Sign in as admin; 3) Open a feedback item, click Decide → Accept; 4) Within ~5s assert: (a) in-app notification appears for submitter (poll notifications router), (b) Resend test inbox shows email, (c) draft CR row exists in DB linked to feedback + sections, (d) `workflowTransition` log row written; 5) Repeat for Reject (only in-app + email, no draft CR) |
| Resend email delivery | NOTIF-05 | External provider, requires test API key | Verify test inbox for delivery; check Resend dashboard for retry behavior on simulated failure |
| Idempotency dual-write | NOTIF-04 | Requires racing two paths (legacy + Inngest) during transition window | Manually fire a feedback.decide while the legacy createNotification path is still wired; assert only one notifications row exists with the matching idempotency key |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (3 new test files + migration)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (planner sets after writing plans)

**Approval:** pending
