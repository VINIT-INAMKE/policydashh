---
phase: 5
slug: change-requests
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 5 — Validation Strategy

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.mts` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | CR-01, CR-02, CR-03, CR-04 | unit | `npm test -- src/__tests__/cr-machine.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | CR-05, CR-06, CR-07, CR-08 | unit | `npm test -- src/__tests__/cr-permissions.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | CR-01, CR-02, CR-03 | manual | Browser: create CR from feedback, verify links | — | ⬜ pending |
| 05-02-02 | 02 | 2 | CR-04, CR-05, CR-06 | manual | Browser: lifecycle transitions, merge creates version | — | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `src/__tests__/cr-machine.test.ts` — XState CR machine transitions
- [ ] `src/__tests__/cr-permissions.test.ts` — CR permission matrix

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CR created from feedback items with CR-NNN ID | CR-01, CR-02 | Full UI flow | Select feedback items, create CR, verify ID and links |
| CR lifecycle enforced with human approval | CR-04, CR-05 | Multi-step interaction | Walk CR through drafting → review → approve → merge |
| Merge creates new version and updates feedback | CR-06, CR-07 | Atomic transaction verification | Merge CR, verify version created, feedback items updated |
| CR closed without merge records rationale | CR-08 | UI interaction | Close CR, verify rationale required and recorded |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity
- [ ] Wave 0 covers all MISSING references
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
