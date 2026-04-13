---
phase: 14
slug: collab-rollback
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `14-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.1 + @testing-library/react ^16.3.2 |
| **Config file** | `vitest.config.mts` (root) |
| **Quick run command** | `npm test -- src/__tests__/editor-extensions.test.ts src/__tests__/section-content-view.test.tsx` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds quick / ~90 seconds full |

**Baseline failures (NOT introduced by Phase 14):** `src/__tests__/feedback-permissions.test.ts`, `src/__tests__/document-router-scope.test.ts`. Acceptance signal is "no NEW failures beyond these two."

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green (modulo baseline failures above)
- **Max feedback latency:** ~30 seconds (quick run)

---

## Per-Task Verification Map

> Populated by planner. One row per task. Every task MUST have an automated verify command OR a Wave 0 dependency marker.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Per-Wave Test Cadence (from RESEARCH.md)

| Wave | Action | Test Command | Acceptance Signal |
|------|--------|-------------|-------------------|
| Wave 1 | Delete 10 standalone collab files (presence-bar, connection-status, comment-bubble/panel/thread, use-presence, presence-colors, inline-comment-mark, collab tests) | `npm test` | All tests pass (deleted test files removed from suite); no new failures |
| Wave 2 | Edit `block-editor.tsx` — remove all 5 `providerRef.current` references, remove Yjs/Hocuspocus imports | `npm test -- src/__tests__/section-content-view.test.tsx` | Render test passes; BlockEditor imports cleanly; no `providerRef` residue via grep |
| Wave 3 | Edit `build-extensions.ts`; remove `Collaboration`/`CollaborationCaret`/InlineComment extensions | `npm test -- src/__tests__/editor-extensions.test.ts` | `buildExtensions()` array contains zero `collaboration*` entries; extension count still ≥ 15 |
| Wave 4 | Delete `commentRouter`, remove from `_app.ts`, clean `permissions.ts` + `constants.ts` | `npm test` | Full suite passes; grep for `commentRouter` returns zero hits |
| Wave 5 | Drop `ydoc_snapshots`, `comment_threads`, `comment_replies` from `schema/index.ts`; generate + apply drop migration | `npx tsc --noEmit` | TypeScript clean compile; Drizzle journal advances; `\dt` shows 0 matching tables |
| Wave 6 | Remove npm packages (`yjs`, `y-prosemirror`, `@hocuspocus/provider`, `@tiptap/extension-collaboration*`); clean env + globals.css presence styles | `npm test` | Full suite green excluding baseline failures; `package.json` shows zero yjs/hocuspocus deps |
| Wave 7 | Annotate `EDIT-06`, `EDIT-07`, `EDIT-08` in `REQUIREMENTS.md` as "rolled back in v0.2 Phase 14, deferred to v2" | Manual grep | `grep -c "rolled back in v0.2 Phase 14"` returns ≥ 3 |

---

## Wave 0 Requirements

- [ ] No new test files required — existing `section-content-view.test.tsx` covers the render gate (COLLAB-ROLLBACK-02)
- [ ] `editor-extensions.test.ts` needs a minor update after InlineComment removal — tracked as a task in the plan (not a Wave 0 install)
- [ ] Framework already installed (Vitest + @testing-library/react) — no installs needed

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Editor accepts input and auto-save fires in a real browser | COLLAB-ROLLBACK-02 | Render test stubs BlockEditor; real Tiptap mount not exercised in unit tests | `npm run dev`, open a document section, type text, observe auto-save indicator within debounce window (~2s idle) |
| REQUIREMENTS.md annotation is human-readable | Success Criteria #4 | Text annotation in a markdown file | Visual inspection of EDIT-06/07/08 entries |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (none required this phase)
- [ ] No watch-mode flags in any command
- [ ] Feedback latency < 30s for quick run
- [ ] `nyquist_compliant: true` set in frontmatter after planner populates the per-task table

**Approval:** pending
