---
phase: 12
slug: workshop-system-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-12
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

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
| 12-01-01 | 01 | 1 | FIX-01: Section picker data | integration | `npx vitest run src/server/routers/__tests__/document.test.ts` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | FIX-01: Section picker UI | e2e-manual | Browser: open section picker, verify sections load | N/A | ⬜ pending |
| 12-02-01 | 02 | 1 | FIX-02: Feedback query | integration | `npx vitest run src/server/routers/__tests__/feedback.test.ts` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 1 | FIX-02: Feedback picker UI | e2e-manual | Browser: open feedback picker, verify cards render with search | N/A | ⬜ pending |
| 12-03-01 | 03 | 1 | FIX-03: Duplicate rendering | visual | Browser: verify no duplicate section/feedback lists | N/A | ⬜ pending |
| 12-04-01 | 04 | 1 | FIX-04: DialogTrigger | structural | `grep -r "DialogTrigger" app/(workspace)/workshops/` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Router test stubs for document.list includeSections
- [ ] Router test stubs for feedback.listAll query

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Section picker shows sections with title + block count | FIX-01 | Visual rendering in dialog | Open workshop > click Link Section > verify sections appear with metadata |
| Feedback picker cards with search/filter | FIX-02 | Interactive UI with search | Open workshop > click Link Feedback > search/filter > verify cards |
| No duplicate rendering | FIX-03 | Visual comparison | Open workshop detail > verify linked items only on detail page, not in picker |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
