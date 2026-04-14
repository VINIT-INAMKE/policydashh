---
phase: 19
slug: public-participate-intake-clerk-invite-turnstile
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-14
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run tests/phase-19` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~15 seconds (phase subset) / ~60s (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run tests/phase-19`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 0 | INTAKE-02, 07 | unit | `npm test -- --run tests/phase-19/participate-route.test.ts` | ❌ W0 | ⬜ pending |
| 19-01-02 | 01 | 0 | INTAKE-04, 06 | unit | `npm test -- --run tests/phase-19/participate-intake.test.ts` | ❌ W0 | ⬜ pending |
| 19-01-03 | 01 | 0 | INTAKE-05 | unit | `npm test -- --run tests/phase-19/welcome-email.test.ts` | ❌ W0 | ⬜ pending |
| 19-01-04 | 01 | 0 | INTAKE-01, 07 | unit | `npm test -- --run tests/phase-19/public-routes.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/phase-19/participate-route.test.ts` — RED stub: POST /api/intake/participate verifies Turnstile before Clerk, returns 403 on invalid token, returns 202 + success shape on valid, fires `participateIntake` Inngest event (INTAKE-02, INTAKE-03, INTAKE-07)
- [ ] `tests/phase-19/participate-intake.test.ts` — RED stub: Inngest `participateIntake` fn has `rateLimit` config keyed on `event.data.emailHash` (15m/1), uses `clerkClient().invitations.createInvitation({ ignoreExisting: true })`, derives `idempotency` from emailHash+day, no-ops on duplicate (INTAKE-04, INTAKE-06)
- [ ] `tests/phase-19/welcome-email.test.ts` — RED stub: `renderWelcomeEmail({ orgType })` returns distinct HTML string per 6 org buckets (government / industry / legal / academia / civil_society / internal) (INTAKE-05)
- [ ] `tests/phase-19/public-routes.test.ts` — RED stub: `proxy.ts` (or middleware) `isPublicRoute` matcher includes `/participate(.*)`; unauthenticated GET /participate returns 200 (INTAKE-01)
- [ ] `npm install @marsidev/react-turnstile` — Turnstile React component (not currently installed)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Cloudflare Turnstile widget renders and challenges abuse | INTAKE-02 | Cloudflare challenge UI requires real browser + network to Cloudflare edge | Load `/participate` in a real browser, confirm widget appears, submit with a known-bad token via DevTools → expect 403 toast |
| Welcome email deliverability through real Resend | INTAKE-05 | Resend API + inbox rendering can't be unit-tested end-to-end | Submit form with real email, confirm inbox receives role-tailored email with correct copy and CTA — **deferred to end-of-milestone smoke walk** |
| Clerk invitation email → account claim flow | INTAKE-04 | Clerk hosted flow can't be automated headlessly | Submit → check Clerk dashboard for pending invitation → click invitation link → confirm sign-in works — **deferred to end-of-milestone smoke walk** |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
