---
phase: 14
slug: collab-rollback
status: human_needed
verified: 2026-04-13
must_haves_passed: 5/5
human_verification:
  - test: "Open a document section in the browser (npm run dev), type text, idle for ~2s, observe auto-save indicator firing"
    expected: "Save state transitions from Unsaved to Saving to Saved without any provider connection or Yjs involvement"
    why_human: "Render test stubs BlockEditor via next/dynamic mock — the real Tiptap mount is not exercised in unit tests. Visual confirmation that debouncedSave fires on idle requires a live browser."
---

# Phase 14: Collab Rollback Verification Report

**Phase Goal:** Real-time collaboration code is fully removed so v0.2 work can layer onto a smaller, stable type surface.
**Verified:** 2026-04-13
**Status:** HUMAN_NEEDED — all automated checks pass; one item requires browser confirmation
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ydoc_snapshots, comment_threads, comment_replies dropped via migration with no dangling FK references | VERIFIED | `src/db/schema/collaboration.ts` absent; `src/db/schema/index.ts` has 0 "collaboration" references; `src/db/migrations/0008_drop_collaboration.sql` exists with CASCADE DROP in FK-safe order (replies → threads → ydoc_snapshots); live DB verified via information_schema query in 14-03-SUMMARY (0 rows returned) |
| 2 | hocuspocus-server/ deleted; NEXT_PUBLIC_HOCUSPOCUS_URL absent from .env.example | VERIFIED | `test ! -e hocuspocus-server` exits 0; `grep -c "NEXT_PUBLIC_HOCUSPOCUS_URL" .env.example` returns 0; confirmed by formal audit in 14-04 Task 1 Part C and D |
| 3 | Block editor loads in single-user mode without any Yjs/Collaboration extension imports; auto-save fires on idle | VERIFIED (automated) / HUMAN_NEEDED (real browser) | Full residual grep across src/ + app/ for `providerRef\|HocuspocusProvider\|@hocuspocus\|from 'yjs'\|from '@tiptap/extension-collaboration\|inline-comment-mark` returns 0 matches; block-editor.tsx handleUpdate and handleBlur call debouncedSave unconditionally (no providerRef guard); section-content-view.test.tsx 7/7 pass; editor-extensions.test.ts 10/10 pass; real-browser idle-save requires human |
| 4 | EDIT-06, EDIT-07, EDIT-08 annotated as "rolled back in v0.2 Phase 14, deferred to v2" | VERIFIED | `grep -c "EDIT-06.*rolled back in v0.2 Phase 14" .planning/REQUIREMENTS.md` → 1; same for EDIT-07 → 1; EDIT-08 → 1; all three lines are `[x]` complete |
| 5 | Render tests pass after each deletion step | VERIFIED | 14-01 Wave 1: npm test 2 failed / 295 passed (baseline unchanged); 14-02 Wave 2: section-content-view.test.tsx 7/7; Wave 3: editor-extensions.test.ts 9/9; 14-03 Wave 4: npm test baseline unchanged; 14-04 final: npm test 2 failed / 295 passed — identical baseline throughout |

**Score:** 5/5 truths verified (1 item needs browser confirmation for complete SC #3 coverage)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema/collaboration.ts` | ABSENT | VERIFIED | File deleted in Plan 03 Task 2 (commit `60b77d4`); `test ! -e` exits 0 |
| `src/db/schema/index.ts` | No collaboration re-export | VERIFIED | `grep -c "collaboration" src/db/schema/index.ts` → 0 |
| `src/db/migrations/0008_drop_collaboration.sql` | DROP TABLE CASCADE x3 in FK order | VERIFIED | File exists; contains `DROP TABLE IF EXISTS comment_replies CASCADE`, `DROP TABLE IF EXISTS comment_threads CASCADE`, `DROP TABLE IF EXISTS ydoc_snapshots CASCADE` in that exact order |
| `hocuspocus-server/` | ABSENT (never existed) | VERIFIED | `test ! -e hocuspocus-server` exits 0; confirmed absent since Phase 11 (RESEARCH § hocuspocus-server) |
| `.env.example` | No HOCUSPOCUS_URL | VERIFIED | `grep -c "NEXT_PUBLIC_HOCUSPOCUS_URL" .env.example` → 0 |
| `app/(workspace)/policies/[id]/_components/block-editor.tsx` | Clean single-user editor; no collab imports | VERIFIED | 336 lines; grep for providerRef/HocuspocusProvider/PresenceBar/ConnectionStatus/CommentPanel/CommentBubble/getPresenceColor/useSession/useUser/HOCUSPOCUS_URL/commentPanelOpen → 0 matches each |
| `src/lib/tiptap-extensions/build-extensions.ts` | No Collaboration/CollaborationCaret/InlineComment | VERIFIED | grep for Collaboration/CollaborationCaret/@hocuspocus/InlineComment/inline-comment-mark → 0; 107 lines, 17 extensions |
| `src/lib/tiptap-extensions/inline-comment-mark.ts` | ABSENT | VERIFIED | `test ! -e` exits 0 |
| `src/lib/collaboration/` | ABSENT (directory) | VERIFIED | `test ! -d src/lib/collaboration` exits 0 |
| `src/lib/hooks/use-presence.ts` | ABSENT | VERIFIED | `test ! -e` exits 0 |
| `src/server/routers/comments.ts` | ABSENT | VERIFIED | `test ! -e` exits 0 |
| `src/server/routers/_app.ts` | No commentRouter | VERIFIED | `grep -c "commentRouter" src/server/routers/_app.ts` → 0 |
| `src/lib/permissions.ts` | No comment:read/comment:create | VERIFIED | `grep -c "comment:read\|comment:create" src/lib/permissions.ts` → 0 |
| `src/lib/constants.ts` | No COMMENT_* constants | VERIFIED | `grep -c "COMMENT_CREATE\|COMMENT_REPLY\|COMMENT_RESOLVE\|COMMENT_REOPEN\|COMMENT_DELETE" src/lib/constants.ts` → 0 |
| `app/globals.css` | No .collaboration-cursor__* or .inline-comment-mark rules | VERIFIED | `grep -c "collaboration-cursor\|inline-comment-mark" app/globals.css` → 0; 43 lines removed |
| `package.json` | No @hocuspocus/* or @tiptap/extension-collaboration* | VERIFIED | `grep -c "@hocuspocus\|@tiptap/extension-collaboration" package.json` → 0 |
| `src/__tests__/inline-comment-mark.test.ts` | ABSENT | VERIFIED | `test ! -e` exits 0 |
| `src/__tests__/build-extensions-collab.test.ts` | ABSENT | VERIFIED | `test ! -e` exits 0 |
| `src/__tests__/comments-router.test.ts` | ABSENT | VERIFIED | `test ! -e` exits 0 |
| `.planning/REQUIREMENTS.md` | EDIT-06/07/08 annotated; COLLAB-ROLLBACK-01/02 marked [x] | VERIFIED | All five requirements confirmed present and `[x]` complete |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| block-editor.tsx handleUpdate | debouncedSave | unconditional call | WIRED | Line 107: `debouncedSave(editor.getJSON() as Record<string, unknown>)` — no providerRef guard; confirmed by direct Read of file |
| block-editor.tsx handleBlur | debouncedSave.flush() | unconditional call | WIRED | Line 114: `debouncedSave.flush()` guarded only by `isDirtyRef.current` (not by providerRef); all 5 providerRef access sites from RESEARCH Pitfall 1 are gone |
| block-editor.tsx useEditor content prop | section.content | unconditional assignment | WIRED | Line 229: `content: section.content ?? { type: 'doc', content: [{ type: 'paragraph' }] }` — no ternary on providerRef.current |
| buildExtensions call | no collaboration: option | call site | WIRED | Line 119: `buildExtensions({ onSlashCommand: ... })` — no collaboration key; verified by grep-c "collaboration:" → 0 |
| src/db/schema/index.ts | no collaboration re-export | schema barrel | WIRED | `grep -c "collaboration" src/db/schema/index.ts` → 0 |
| src/server/routers/_app.ts | appRouter (11 keys) | no comments: key | WIRED | `grep -c "commentRouter" src/server/routers/_app.ts` → 0 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| block-editor.tsx | section.content | Props passed from parent (SectionContentView → PolicyPage) | Yes — content comes from DB via tRPC section query upstream | FLOWING |
| block-editor.tsx auto-save | debouncedSave → mutation.mutate | tRPC sectionAssignment/document router update mutation | Yes — mutates DB record | FLOWING |

No hollow props or static returns detected. The editor receives real section content via props and persists via a live tRPC mutation.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Render gate: SectionContentView mounts without crash | `npm test -- src/__tests__/section-content-view.test.tsx` | 7 passed (7) | PASS |
| Editor extensions load without collab packages | `npm test -- src/__tests__/editor-extensions.test.ts` | 10 passed (10) — 17 extensions >= 15 | PASS |
| Full test suite — zero new failures | `npm test` | 2 failed / 295 passed (297) — identical to pre-Phase-14 baseline | PASS |
| TypeScript compile | `npx tsc --noEmit` | Exit 0, no output (verified in all 4 plans) | PASS |
| Real browser auto-save on idle | Requires `npm run dev` + manual test | Not run — requires live server | SKIP (human needed) |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COLLAB-ROLLBACK-01 | 14-01, 14-02, 14-03, 14-04 | Yjs/Hocuspocus/inline-comment code removed; EDIT-06/07/08 deferred; schema dropped; hocuspocus-server deleted | SATISFIED | All artifacts absent/clean; migration applied; residual grep → 0 matches; REQUIREMENTS.md `[x]` |
| COLLAB-ROLLBACK-02 | 14-02, 14-04 | Single-user Tiptap editor with auto-save continues to function without Collaboration extension | SATISFIED (automated) / HUMAN_NEEDED (browser) | section-content-view.test.tsx 7/7; editor-extensions.test.ts 10/10; debouncedSave unconditional; real-browser idle-save unverifiable without running server |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | Full residual grep across src/ + app/ returned 0 matches for all collab tokens |

No TODOs, FIXME, placeholder comments, empty handlers, or hardcoded stubs were found in any of the modified files. The executor confirmed "zero known stubs" in all four SUMMARY.md files.

---

## Informational Finding: Transitive yjs Residual in node_modules

After removing the 3 direct collab packages (`@hocuspocus/provider`, `@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-caret`), `yjs@13.6.30` and `@tiptap/extension-collaboration@3.20.5` remain in `node_modules` as transitive dependencies via the chain:

```
@tiptap/extension-drag-handle → @tiptap/y-tiptap → yjs
@tiptap/extension-drag-handle → @tiptap/extension-collaboration (peer) → yjs
```

`@tiptap/extension-drag-handle` is legitimately used by the block editor for the drag-handle block-reorder UX. This is documented in `14-04-SUMMARY.md` (key-decisions section) and is NOT a gap. The rollback goal is removal of DIRECT usage, which is fully achieved:

- `package.json` has 0 direct collab packages
- `node_modules/@hocuspocus` directory is absent
- All source files have 0 `from 'yjs'` or `@tiptap/extension-collaboration` imports

This transitive chain is inert — no application code exercises it. Future v2 collab revival will find the transitive chain already in place. Note this for v2 planning, not as a rollback gap.

---

## Human Verification Required

### 1. Real-browser auto-save fire on idle (SC #3)

**Test:** Run `npm run dev`, navigate to a policy document, open a section for editing in the block editor, type some text, then idle for approximately 2 seconds.
**Expected:** The save state indicator transitions from Unsaved to Saving to Saved without any WebSocket connection error, any Yjs console output, or any reference to HocuspocusProvider. The mutation network request to the tRPC document/sectionAssignment update endpoint should appear in the browser's Network tab.
**Why human:** The render test for `SectionContentView` stubs `BlockEditor` via `vi.mock('next/dynamic', ...)`, so the real Tiptap editor mount and the actual `debouncedSave` debounce cycle are not exercised in any unit test. Code inspection confirms the wiring is correct (unconditional calls at lines 107 and 114 of block-editor.tsx), but the live debounce behavior and network mutation can only be observed in a real browser session.

---

## Gaps Summary

No gaps were found. All five success criteria are fully verifiable via automated checks, with the single exception of the live-browser auto-save behavior for SC #3 (which is structurally correct in code but requires human observation for full confidence).

The phase goal — "Real-time collaboration code is fully removed so v0.2 work can layer onto a smaller, stable type surface" — is achieved. The type surface is clean: zero collab imports in source, zero schema exports, zero router registrations, zero npm direct dependencies, zero CSS rules, and zero test files targeting deleted code.

---

## Phase 14 Commits (11 commits across 4 plans)

| Commit | Plan | Description |
|--------|------|-------------|
| `1fe1b5e` | 14-01 Task 1 | Delete 3 collab-specific test files before source removal |
| `d177a56` | 14-01 Task 2 | Delete 7 standalone source files + empty src/lib/collaboration/ dir |
| `7cc1e31` | 14-02 Task 1 | Strip Yjs/Hocuspocus/comment code from block-editor.tsx |
| `c93fff7` | 14-02 Task 2 | Drop Collaboration/InlineComment from buildExtensions |
| `777c1cb` | 14-03 Task 1 | Delete commentRouter and purge comment permissions/actions |
| `60b77d4` | 14-03 Task 2 | Drop collaboration schema and apply migration 0008 |
| `9556726` | 14-04 Task 1 | Remove collab npm packages and clean CSS/env |

---

_Verified: 2026-04-13_
_Verifier: Claude (gsd-verifier)_
