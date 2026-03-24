---
phase: 1
slug: foundation-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.mts` — Wave 0 installs |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | AUTH-03 | unit | `npx vitest run src/__tests__/permissions.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | AUDIT-01, AUDIT-02, AUDIT-03 | unit | `npx vitest run src/__tests__/audit.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 2 | AUTH-01, AUTH-06 | unit | `npx vitest run src/__tests__/trpc.test.ts -t "default-deny"` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 2 | AUTH-02 | unit | `npx vitest run src/__tests__/webhooks.test.ts -t "user.created"` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 3 | AUTH-02, AUTH-04 | unit | `npx vitest run src/__tests__/users.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-02 | 03 | 3 | AUTH-06 | unit | `npx vitest run src/__tests__/trpc.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.mts` — test framework config (created in Plan 01-01 Task 1)
- [ ] `src/__tests__/permissions.test.ts` — covers AUTH-03, AUTH-06
- [ ] `src/__tests__/webhooks.test.ts` — covers AUTH-02
- [ ] `src/__tests__/users.test.ts` — covers AUTH-04
- [ ] `src/__tests__/audit.test.ts` — covers AUDIT-01, AUDIT-02
- [ ] `src/__tests__/trpc.test.ts` — covers AUTH-01, AUTH-06
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths` (handled in Plan 01-01 Task 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Session cookie persists across browser refresh | AUTH-07 | Requires real browser session with Clerk | Sign in via phone, refresh page, verify UserButton shows user |
| Audit partition pruning works | AUDIT-03 | Requires running EXPLAIN on actual DB | `psql -c "EXPLAIN SELECT * FROM audit_events WHERE timestamp > '2026-03-01'"` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
