---
phase: 3
slug: block-editor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.mts` (exists from Phase 1) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~25 seconds |

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
| 03-01-01 | 01 | 1 | EDIT-01, EDIT-02 | manual | Browser: slash commands, block types render | — | ⬜ pending |
| 03-01-02 | 01 | 1 | EDIT-03 | manual | Browser: drag-and-drop blocks | — | ⬜ pending |
| 03-02-01 | 02 | 2 | EDIT-04 | manual | Browser: bold/italic/underline/links/code | — | ⬜ pending |
| 03-02-02 | 02 | 2 | EDIT-05 | manual | Browser: image upload, file attach | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

No automated test files needed — Phase 3 is primarily UI component work (Tiptap editor). All verification is visual/manual. Existing Phase 1+2 tests continue to run as regression checks.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Slash command menu appears on "/" and lists all block types | EDIT-01 | Browser interaction | Type "/" in editor, verify dropdown shows text/heading/callout/table/toggle/quote/divider/code |
| All block types render correctly | EDIT-02 | Visual rendering | Insert each block type via slash command, verify visual output |
| Blocks can be dragged and reordered | EDIT-03 | DnD interaction | Drag handle on block, move up/down, verify order persists |
| Rich text formatting works | EDIT-04 | Text selection + toolbar | Select text, apply bold/italic/underline/strikethrough/link/code, verify |
| Image upload displays inline | EDIT-05 | File upload + rendering | Upload image, verify it renders in editor and persists on save |
| Content auto-saves on edit | All | Debounced mutation | Edit content, wait 2s, refresh, verify content persisted |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
