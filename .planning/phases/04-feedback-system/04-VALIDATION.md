---
phase: 4
slug: feedback-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.mts` (exists from Phase 1) |
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
| 04-01-01 | 01 | 1 | FB-01, FB-02, FB-03 | unit | `npm test -- src/__tests__/feedback-schema.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | FB-06, FB-07 | unit | `npm test -- src/__tests__/feedback-machine.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | AUTH-05 | unit | `npm test -- src/__tests__/section-assignments.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | FB-08, AUTH-08 | unit | `npm test -- src/__tests__/feedback-privacy.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | FB-01, FB-04, FB-10 | manual | Browser: submit feedback, filter inbox | — | ⬜ pending |
| 04-02-02 | 02 | 2 | FB-09 | manual | Browser: stakeholder outcome view | — | ⬜ pending |
| 04-03-01 | 03 | 2 | EV-01, EV-02 | manual | Browser: attach evidence to feedback | — | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `src/__tests__/feedback-schema.test.ts` — covers FB-01, FB-02, FB-03 schema validation
- [ ] `src/__tests__/feedback-machine.test.ts` — covers FB-06, FB-07 XState lifecycle transitions
- [ ] `src/__tests__/section-assignments.test.ts` — covers AUTH-05 scoping enforcement
- [ ] `src/__tests__/feedback-privacy.test.ts` — covers FB-08, AUTH-08 anonymity enforcement
- [ ] `src/__tests__/feedback-permissions.test.ts` — covers permission matrix for feedback operations
- [ ] `src/__tests__/evidence-permissions.test.ts` — covers EV-01, EV-02 permission checks
- [ ] XState install: `npm install xstate @xstate/react`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stakeholder sees only assigned sections | AUTH-05 | Browser session with specific role | Log in as stakeholder, verify only assigned sections visible |
| Feedback form submits with FB-XXX ID | FB-01, FB-02 | Full UI flow | Submit feedback, verify human-readable ID in response |
| Policy Lead triage with mandatory rationale | FB-06, FB-07 | Multi-step UI interaction | Accept/reject feedback, verify rationale required |
| Anonymous feedback hides identity | FB-08 | Cross-user visibility | Submit anonymous feedback, verify other users can't see author |
| Evidence file upload works | EV-01 | File upload + storage | Attach file to feedback, verify it persists |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
