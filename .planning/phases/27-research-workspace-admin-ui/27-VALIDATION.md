---
phase: 27
slug: research-workspace-admin-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + @testing-library/react |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

*To be populated by planner per-plan. Every task that modifies behavior must map to an automated test or declare a manual-only exception.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | RESEARCH-06/07/08 | unit+component | `npx vitest run <path>` | Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Based on research findings (27-RESEARCH.md):

- [ ] Router additions: `research.listTransitions` procedure (no tests yet exist)
- [ ] Router fix: `research.list` accepts `authorId` filter (extend `tests/trpc/research.list.test.ts` if exists)
- [ ] Router fix: `linkSection` upserts on conflict (extend existing `linkSection` tests)
- [ ] Upload route fix: add `'research'` category to `app/api/upload/route.ts` category whitelist
- [ ] `tests/research/create-edit-dialog.test.tsx` — create-edit dialog validation stubs (RESEARCH-06)
- [ ] `tests/research/link-picker.test.tsx` — multi-select link picker stubs (RESEARCH-07)
- [ ] `tests/research/lifecycle-actions.test.tsx` — RBAC + transition stubs (RESEARCH-08)
- [ ] `tests/research/anonymous-toggle.test.tsx` — anonymous-author preview stub (RESEARCH-06)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-drop file upload UX | RESEARCH-06 | Requires real browser DnD events; JSDOM stubs are thin | Dev server → drag a PDF onto upload zone → verify progress + artifact row |
| Dashboard widget visual rhythm | RESEARCH-08 | Visual-only (spacing, alignment) | Dev server → log in as research_lead → inspect `/dashboard` StatCards |
| Anonymous-author preview rendering across locales | RESEARCH-06 | Token-scoped rendering; visual check recommended | Toggle anonymous flag → verify author text shows "Anonymous" in detail view |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (router additions + test stubs)
- [ ] No watch-mode flags (use `vitest run`, not `vitest`)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner wires tasks)

**Approval:** pending
