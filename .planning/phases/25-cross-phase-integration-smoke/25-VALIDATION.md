---
phase: 25
slug: cross-phase-integration-smoke
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via `npm test` = `vitest run`) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test -- --reporter=verbose 2>&1 | tail -5` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --reporter=verbose 2>&1 | tail -5`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-00-01 | 00 | 0 | INTEGRATION-01 | regression | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 25-00-02 | 00 | 0 | INTEGRATION-01 | regression | `npm test` | ✅ | ⬜ pending |
| 25-01-xx | 01+ | 1+ | INTEGRATION-01 | manual E2E | N/A — manual smoke walk | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Fix TypeScript errors in `src/server/routers/workshop.ts` and `src/trpc/init.ts` (20 TS18049 errors)
- [ ] Fix 6 failing tests in `tests/phase-20.5/set-public-draft-mutation.test.ts` and `src/server/routers/__tests__/evidence-request-export.test.ts`
- [ ] Add `WORKSHOP_FEEDBACK_JWT_SECRET` to `.env.example`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full E2E chain walk (9 criteria) | INTEGRATION-01 | Requires real browser, real external services, real Clerk invite flow, real cal.com booking, real Cardano tx | Follow structured walk procedure in PLAN.md |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
