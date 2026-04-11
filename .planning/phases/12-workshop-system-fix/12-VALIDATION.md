---
phase: 12
slug: workshop-system-fix
status: draft
nyquist_compliant: true
wave_0_complete: true
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

- **After every task commit:** Run `npx tsc --noEmit --pretty`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | FIX-01: Section picker data | typecheck | `npx tsc --noEmit --pretty` | N/A | pending |
| 12-01-02 | 01 | 1 | FIX-01: Section picker UI + data | e2e-manual | Browser: open section picker, verify sections load with title + block count | N/A | pending |
| 12-02-01 | 02 | 1 | FIX-02: Feedback query | typecheck | `npx tsc --noEmit --pretty` | N/A | pending |
| 12-02-02 | 02 | 1 | FIX-02: Feedback picker UI | e2e-manual | Browser: open feedback picker, verify cards render with search/filter | N/A | pending |
| 12-03-01 | 01+02 | 1 | FIX-03: Duplicate rendering | visual | Browser: verify no duplicate section/feedback lists | N/A | pending |
| 12-04-01 | 01 | 1 | FIX-04: DialogTrigger | structural | `grep -r "DialogTrigger" app/(workspace)/workshops/` | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

None. This is a surgical bug-fix phase where all behavioral correctness is verified through:
1. **TypeScript compilation** (`tsc --noEmit`) -- catches type errors, import mismatches, and structural regressions
2. **Structural grep checks** -- confirms removal of DialogTrigger, presence of includeSections, etc.
3. **Manual browser verification** -- bugs are visually verifiable (section picker shows sections, feedback picker shows cards)

No router integration test stubs are required. The scope is narrow (4 files modified across 2 plans), and the bugs manifest as visual failures that are most reliably caught by browser inspection.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Section picker shows sections with title + block count | FIX-01 | Visual rendering in dialog; router change is opt-in (includeSections) so existing callers are structurally safe via tsc | Open workshop > click Link Section > verify sections appear grouped by document with title and block count |
| Feedback picker cards with search/filter | FIX-02 | Interactive UI with search/filter; anonymity display verified visually | Open workshop > click Link Feedback > search by text > filter by type > verify cards show readableId, type badge, title, excerpt, author (Anonymous for anonymous), date |
| No duplicate rendering | FIX-03 | Visual comparison between picker and detail page | Open workshop detail > verify linked items only appear on detail page, picker shows only available/unlinked items |
| No orphaned DialogTrigger | FIX-04 | Structural grep sufficient, visual confirms no broken trigger buttons | `grep -r "DialogTrigger" app/(workspace)/workshops/[id]/_components/` returns no matches; open pickers in browser and verify no stray trigger buttons |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (tsc --noEmit for all code tasks)
- [x] Sampling continuity: tsc runs after every task commit
- [x] No Wave 0 dependencies required (bug-fix phase, manual verification sufficient)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (tsc completes in ~15s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
