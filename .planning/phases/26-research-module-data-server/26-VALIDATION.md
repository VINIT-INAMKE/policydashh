---
phase: 26
slug: research-module-data-server
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already installed) |
| **Config file** | `vitest.config.mts` (exists, covers `src/**/*.test.ts` and `tests/**/*.test.ts`) |
| **Quick run command** | `npm test -- --reporter=verbose src/__tests__/research` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds (quick) / ~120 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --reporter=verbose src/__tests__/research`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite + `npx tsc --noEmit` must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 26-W0-01 | 00 | 0 | RESEARCH-01..05 | infra | `test -f src/__tests__/research-permissions.test.ts` | ❌ W0 | ⬜ pending |
| 26-W0-02 | 00 | 0 | RESEARCH-05 | infra | `test -f src/__tests__/research-lifecycle.test.ts` | ❌ W0 | ⬜ pending |
| 26-W0-03 | 00 | 0 | RESEARCH-05 | infra | `test -f src/__tests__/research-service.test.ts` | ❌ W0 | ⬜ pending |
| 26-W0-04 | 00 | 0 | RESEARCH-02, RESEARCH-04 | infra | `test -f src/__tests__/research-router.test.ts` | ❌ W0 | ⬜ pending |
| 26-W0-05 | 00 | 0 | RESEARCH-01 | infra | `test -f src/__tests__/research-schema.test.ts` | ❌ W0 | ⬜ pending |
| 26-01-XX | 01 | 1 | RESEARCH-01 | unit | `npm test -- src/__tests__/research-schema.test.ts` | ❌ W0 | ⬜ pending |
| 26-02-XX | 02 | 1 | RESEARCH-03 | unit | `npm test -- src/__tests__/research-permissions.test.ts` | ❌ W0 | ⬜ pending |
| 26-03-XX | 03 | 2 | RESEARCH-05 | unit | `npm test -- src/__tests__/research-lifecycle.test.ts` | ❌ W0 | ⬜ pending |
| 26-04-XX | 04 | 2 | RESEARCH-05 | unit | `npm test -- src/__tests__/research-service.test.ts` | ❌ W0 | ⬜ pending |
| 26-05-XX | 05 | 3 | RESEARCH-02, RESEARCH-04 | unit | `npm test -- src/__tests__/research-router.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: Task IDs are placeholders. Planner will finalize Task-ID column once plans are written. Row template is: one row per task with verify command + requirement coverage.*

---

## Wave 0 Requirements

- [ ] `src/__tests__/research-schema.test.ts` — stubs for RESEARCH-01 (table imports, composite PK assertions)
- [ ] `src/__tests__/research-permissions.test.ts` — stubs for RESEARCH-03 (7 permissions × role grants matrix)
- [ ] `src/__tests__/research-lifecycle.test.ts` — stubs for RESEARCH-05 (valid/invalid transition assertions, retractionReason guard)
- [ ] `src/__tests__/research-service.test.ts` — stubs for RESEARCH-05 (workflowTransitions insert-before-update invariant, reviewedBy on approve)
- [ ] `src/__tests__/research-router.test.ts` — stubs for RESEARCH-02 (readableId uniqueness spy), RESEARCH-04 (FORBIDDEN/NOT_FOUND guards), RESEARCH-01 (anonymous-author filter on listPublic)

*Framework already installed — no install step needed. All test files use existing `vi.mock('@/src/db')` pattern from `src/__tests__/feedback-*.test.ts`.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification. This is a backend-only phase with deterministic inputs/outputs; no UI paths, no external-service calls, no async workflows.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
