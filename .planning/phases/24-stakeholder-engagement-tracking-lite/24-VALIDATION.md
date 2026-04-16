---
phase: 24
slug: stakeholder-engagement-tracking-lite
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.mts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | UX-08 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UX-09 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UX-10 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | UX-11 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/server/routers/__tests__/engagement.test.ts` — engagement score query tests
- [ ] `src/server/routers/__tests__/user-activity.test.ts` — lastActivityAt middleware tests

*Existing vitest infrastructure covers framework needs. Only test files need creation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin dashboard widget renders with inactive users | UX-09 | Visual UI component | Open /dashboard as admin, verify widget shows below stat cards |
| Stakeholder profile page shows attendance history | UX-11 | Visual UI component + cal.com data | Open /users/[id] as admin, verify attendance rows from workshopRegistrations |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
