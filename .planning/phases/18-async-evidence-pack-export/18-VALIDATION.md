---
phase: 18
slug: async-evidence-pack-export
status: executing
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-14
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.1 |
| **Config file** | vitest.config.mts |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~35s (full suite, baseline 328 passed / 2 pre-existing failed from Phase 16 deferred-items.md, plus 24 Wave 0 RED contracts after 18-00) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green (Wave 0 REDs flipped to GREEN by Plans 18-01/18-02)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Pre-seeded with rows from ALL plans (18-00, 18-01, 18-02). 18-00 task rows are flipped to `created (this task)` / `RED (expected)` after this plan executes. 18-01 and 18-02 rows stay `pending` until those plans land.
>
> **Blocker 2 gate:** 18-01 and 18-02 MUST NOT start while `nyquist_compliant: false` or `wave_0_complete: false`. Both flags flipped true in Plan 18-00 Task 3 (this section). Execute-phase reads these flags as a precondition check before dispatching any 18-01 task.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-00-01 | 00 | 1 | EV-05, EV-06 | unit | `npm test -- --run src/inngest/__tests__/evidence-pack-export.test.ts` | created (this task) | RED (expected) |
| 18-00-02 | 00 | 1 | EV-07 | unit | `npm test -- --run src/lib/__tests__/email.test.ts src/__tests__/evidence-pack-dialog.test.ts` | created (this task) | RED (expected) |
| 18-00-02b | 00 | 1 | EV-05 | unit | `npm test -- --run src/server/routers/__tests__/evidence-request-export.test.ts` | created (this task) | RED (expected) |
| 18-00-03 | 00 | 1 | — | doc | `test -f .planning/phases/18-async-evidence-pack-export/18-VALIDATION.md` | ✓ | complete |
| 18-01-01 | 01 | 2 | EV-05, EV-07 | unit | `npm test -- --run src/inngest/__tests__/evidence-pack-export.test.ts src/lib/__tests__/email.test.ts` | after Plan 01 | pending |
| 18-01-02 | 01 | 2 | EV-05, EV-06, EV-07 | unit | `npm test -- --run src/inngest/__tests__/evidence-pack-export.test.ts` | after Plan 01 | pending |
| 18-02-01 | 02 | 3 | EV-05, EV-06 | unit | `npm test -- --run src/server/routers/__tests__/evidence-request-export.test.ts` | after Plan 02 | pending |
| 18-02-02 | 02 | 3 | EV-05, EV-06, EV-07 | unit | `npm test -- --run src/__tests__/evidence-pack-dialog.test.ts` | after Plan 02 | pending |

---

## Wave 0 Requirements

- [x] Test stubs for evidence-pack Inngest function (src/inngest/__tests__/evidence-pack-export.test.ts) — 12 RED
- [x] Test stub for sendEvidencePackReadyEmail (src/lib/__tests__/email.test.ts) — 4 RED
- [x] Test stub for EvidencePackDialog async flow (src/__tests__/evidence-pack-dialog.test.ts) — 3 RED
- [x] Test stub for evidence.requestExport tRPC mutation (src/server/routers/__tests__/evidence-request-export.test.ts) — 5 RED
- [x] Mock R2 client fixtures (via vi.hoisted pattern inside the fn test)
- [x] Resend mock for email assertion (via vi.mock inside the email test)

*All four stubs delivered by Plan 18-00 tasks 1, 2, and 2b. The `wave_0_complete: true` flip below records 24 RED failures on disk (12 + 4 + 3 + 5) — the locked Nyquist contract Plans 18-01 and 18-02 must satisfy.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end pack download via email link | EV-07 | Requires real Inngest dev server + Resend + R2 | Deferred to milestone smoke walk per user prefs |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all unresolved verify references (every row in the per-task map points at a real test command on disk)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter (flipped in 18-00 Task 3 — GATES 18-01 START)
- [x] `wave_0_complete: true` set in frontmatter (flipped in 18-00 Task 3 — GATES 18-01 START)

**Approval:** pending (final approval after Plans 18-01 + 18-02 flip Wave 0 REDs to GREEN)
