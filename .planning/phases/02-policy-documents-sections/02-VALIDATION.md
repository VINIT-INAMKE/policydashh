---
phase: 2
slug: policy-documents-sections
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.mts` (exists from Phase 1) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~20 seconds |

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
| 02-01-01 | 01 | 1 | DOC-01, DOC-03 | unit | `npm test -- src/__tests__/document-permissions.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | DOC-05 | unit | `npm test -- src/__tests__/markdown-import.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | DOC-02, DOC-04, DOC-06 | unit | `npm test -- src/__tests__/document-router.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | DOC-01, DOC-06 | manual | Browser: verify policy list renders, create dialog works | — | ⬜ pending |
| 02-03-01 | 03 | 2 | DOC-02, DOC-03 | manual | Browser: verify section CRUD, drag-and-drop reorder | — | ⬜ pending |
| 02-03-02 | 03 | 2 | DOC-05 | manual | Browser: verify markdown import flow | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/markdown-import.test.ts` — covers DOC-05 parsing logic (pure function tests)
- [ ] `src/__tests__/document-permissions.test.ts` — covers DOC-01, DOC-03 permission matrix entries

*(Existing `src/__tests__/permissions.test.ts` covers Phase 1 permissions only. Phase 2 adds new permissions that need new tests.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Policy list page renders cards for multiple documents | DOC-01, DOC-06 | UI rendering in browser | Navigate to /policies, create 2+ policies, verify card grid |
| Section sidebar shows stable UUIDs after reorder | DOC-02 | Drag-and-drop interaction | Add 3 sections, reorder via drag, refresh, verify order persists |
| Section content displays Tiptap JSON as text | DOC-04 | Visual rendering | Create section with content, verify text renders in content area |
| Markdown file imports as structured document | DOC-05 | File upload + preview flow | Import policydraft.md, verify sections split correctly |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
