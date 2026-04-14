---
phase: 20
slug: cal-com-workshop-register
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Planner MUST populate the per-task map from 20-RESEARCH.md `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (inherited from Phase 19 + Phase 17 test patterns) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `pnpm vitest run tests/phase-20 src/inngest/__tests__/workshop-created.test.ts src/inngest/__tests__/workshop-registration-received.test.ts src/inngest/__tests__/workshop-feedback-invite.test.ts src/lib/__tests__/feedback-token.test.ts` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~40 seconds (quick) / ~3 minutes (full) |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

*Planner populates this table from RESEARCH.md `## Validation Architecture`. Every task with code changes must have either an `<automated>` verify command or a Wave 0 dependency.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | WS-07..WS-15 | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Candidate Wave 0 test stubs (planner refines):

- [ ] `tests/phase-20/cal-webhook-signature.test.ts` — HMAC valid/invalid/missing/tampered
- [ ] `tests/phase-20/cal-webhook-booking-created.test.ts` — insert row, emit Inngest event, idempotent on bookingUid
- [ ] `tests/phase-20/cal-webhook-booking-cancelled.test.ts` — status='cancelled' by bookingUid
- [ ] `tests/phase-20/cal-webhook-booking-rescheduled.test.ts` — **WHERE booking_uid = rescheduleUid** (per research correction), update to new uid + bookingStartTime
- [ ] `tests/phase-20/cal-webhook-meeting-ended.test.ts` — transition, attendance, walk-in synthesis, feedback-invite event emission
- [ ] `tests/phase-20/workshops-listing.test.tsx` — 3 sections filter, spots-left badge, modal trigger
- [ ] `tests/phase-20/participate-mode-switch.test.tsx` — intake mode vs feedback mode on workshopId query param, expired token state
- [ ] `tests/phase-20/workshop-feedback-submit.test.ts` — JWT verify, feedbackItems + workshopFeedbackLinks inserted in txn
- [ ] `src/inngest/__tests__/workshop-created.test.ts` — cal.com event-type create, backfill calcomEventTypeId, 5xx retry / 4xx NonRetriable
- [ ] `src/inngest/__tests__/workshop-registration-received.test.ts` — mirrors participate-intake.test.ts, Clerk mock, email mock
- [ ] `src/inngest/__tests__/workshop-feedback-invite.test.ts` — Resend mock, deep-link JWT in body
- [ ] `src/lib/__tests__/feedback-token.test.ts` — sign/verify, expiry, wrong secret, wrong workshopId
- [ ] `src/lib/__tests__/cal-signature.test.ts` — HMAC-SHA256 hex + constant-time compare

---

## Manual-Only Verifications

Per user preference (`feedback_defer_smoke_walks.md`), manual smoke walks are deferred to end-of-milestone v0.2 — NOT per-phase. The items below are captured for the milestone smoke walk, not Phase 20 verification.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real cal.com booking via embed lands a registration row | WS-08, WS-10 | Requires live cal.com API key + real Chrome session | Book a real slot in staging; check `workshopRegistrations` row; verify welcome email in Resend logs |
| Real MEETING_ENDED webhook from cal.com fires on meeting end | WS-11 | Requires live cal.com meeting | Join + end a real cal.com meeting; verify workshop transitions + feedback email delivered |
| Post-workshop feedback deep-link round-trip | WS-15 | Requires real email + real Next.js dev server | Click a dev-generated feedback link; submit; verify feedbackItems + workshopFeedbackLinks row + workflowTransition audit row |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
