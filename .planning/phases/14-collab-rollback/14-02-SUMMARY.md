---
phase: 14-collab-rollback
plan: 02
subsystem: editor
tags: [tiptap, yjs, hocuspocus, rollback, block-editor, build-extensions, inline-comment]

# Dependency graph
requires:
  - phase: 14-collab-rollback
    plan: 01
    provides: "Wave-1 leaf pruning — 10 standalone collab files deleted, block-editor.tsx left with 4 transient broken imports intentionally"
provides:
  - "Clean single-user block-editor.tsx with zero Yjs/Hocuspocus/comment references"
  - "buildExtensions() with zero Collaboration/CollaborationCaret/InlineComment entries"
  - "inline-comment-mark.ts removed from disk"
  - "Unblocked Plan 03 (tRPC comments router deletion) — editor client surface is now clean"
affects: [14-03, 14-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Whole-file rewrite via Write tool when edit surface exceeds ~30% of source (more reliable than chained Edits)"

key-files:
  created: []
  modified:
    - "app/(workspace)/policies/[id]/_components/block-editor.tsx (rewritten — 555 lines → 336 lines, −219 lines)"
    - "src/lib/tiptap-extensions/build-extensions.ts (rewritten — 138 lines → 107 lines, −31 lines)"
    - "src/lib/tiptap-extensions/inline-comment-mark.ts (deleted)"

key-decisions:
  - "Use Write tool for block-editor.tsx whole-file rewrite rather than chained Edits — the removal surface touched ~40% of the file (imports, state, 2 useEffects, callback guards, useEditor config, JSX header, CommentBubble/Panel JSX), making a clean rewrite more reliable than ~15 individual Edits"
  - "No changes needed to editor-extensions.test.ts — the test file at HEAD already had zero inlineComment references; the RESEARCH § Pitfall 2 warning was preemptive for a test state that no longer exists (likely cleaned during Plan 01 wave or prior refactor). Verified via direct grep."
  - "handleBlur simplified to take no destructuring argument — previous signature had unused { editor } param that was only referenced inside the removed providerRef guard"

patterns-established:
  - "Clean single-user Tiptap editor surface: unconditional debouncedSave on update/blur, section.content as sole content source"

requirements-completed: [COLLAB-ROLLBACK-02]

# Metrics
duration: 3min
completed: 2026-04-13
---

# Phase 14 Plan 02: Editor Client Surface Rewrite Summary

**Excised all Yjs/Hocuspocus/InlineComment code from the editor client surface: block-editor.tsx rewritten to single-user (−219 lines), build-extensions.ts stripped of Collaboration/CollaborationCaret/InlineComment (−31 lines), inline-comment-mark.ts deleted — render gate (section-content-view.test.tsx) and unit gate (editor-extensions.test.ts) both green, full suite at baseline 295/297.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-13T14:43:11Z
- **Completed:** 2026-04-13T14:46:10Z
- **Tasks:** 2
- **Files modified:** 2 rewritten + 1 deleted

## Accomplishments

### Task 1 — block-editor.tsx rewrite

Removed (in one atomic rewrite):

- **Imports (9):** `HocuspocusProvider`, `useSession`, `useUser` (Clerk), `getPresenceColor`, `PresenceBar`, `ConnectionStatus`, `CommentBubble`/`PendingComment`, `CommentPanel`, plus `MessageSquare` icon (only used for comment toggle)
- **Type alias:** `CollabConnectionStatus`
- **Const:** `HOCUSPOCUS_URL = process.env.NEXT_PUBLIC_HOCUSPOCUS_URL`
- **State declarations:** `commentPanelOpen`, `pendingComment`, `activeCommentId`, `providerRef`, `connectionStatus`, `providerReady`, `session`, `user`, `connectionStatusRef`
- **`useEffect` blocks (2):** provider-init (was ~lines 161–221) and comment-click handler (was ~lines 412–431)
- **Callback guards:** `handleUpdate` and `handleBlur` no longer check `providerRef.current`/`connectionStatusRef.current` — they call `debouncedSave` / `debouncedSave.flush()` unconditionally
- **Comment handlers:** `handleCreateComment`, `handleCloseCommentPanel`, `handleClearPending`
- **`useEditor` config:** dropped `collaboration:` option from `buildExtensions` call, changed `content` to unconditional `section.content ?? { type: 'doc', content: [{ type: 'paragraph' }] }`
- **Effect deps:** removed `providerReady` from `useEditor` dep array
- **JSX:** PresenceBar wrapper, ConnectionStatus, MessageSquare comment toggle button, CommentBubble, CommentPanel

All 5 `providerRef.current` access sites from RESEARCH Pitfall 1 eliminated in one pass. Grep audit confirms zero residue for all banned tokens.

### Task 2 — build-extensions.ts rewrite + inline-comment-mark.ts delete

Removed from `build-extensions.ts`:

- **Imports (5):** `Collaboration`, `CollaborationCaret`, `HocuspocusProvider` type, `Y` type, `InlineComment`
- **`BuildExtensionsOptions.collaboration?`** field (interface simplified to just `onSlashCommand?`)
- **`StarterKit.configure({ undoRedo: ... })`** — `undoRedo` key removed entirely, Tiptap default is used
- **`InlineComment`** from extensions array
- **Conditional `if (options?.collaboration)` push block** — removed entirely

Deleted: `src/lib/tiptap-extensions/inline-comment-mark.ts` — confirmed absent on disk.

Extension count after rewrite: **17** (StarterKit, CodeBlockLowlight, Image, FileHandler, Table, TableRow, TableCell, TableHeader, Details, DetailsSummary, DetailsContent, NodeRange, Callout, FileAttachment, LinkPreview, SlashCommands, Placeholder) — still comfortably ≥ 15.

### Test results

**After Task 1** — `npm test -- src/__tests__/section-content-view.test.tsx`:
```
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

**After Task 2** — `npm test -- src/__tests__/editor-extensions.test.ts src/__tests__/section-content-view.test.tsx`:
```
 Test Files  2 passed (2)
      Tests  24 passed (24)
```

**Full suite regression check** — `npm test`:
```
 Test Files  2 failed | 21 passed (23)
      Tests  2 failed | 295 passed (297)
```
Identical to Plan 01 baseline (feedback-permissions 2 failures + section-assignments suite missing DATABASE_URL). **Zero new failures.**

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite block-editor.tsx to remove all collab/comment code paths** — `7cc1e31` (refactor)
   - 1 file changed, 33 insertions(+), 252 deletions(-)
2. **Task 2: Rewrite build-extensions.ts, delete inline-comment-mark.ts** — `c93fff7` (refactor)
   - 2 files changed, 3 insertions(+), 97 deletions(-)

## Files Created/Modified

**Modified:**

- `app/(workspace)/policies/[id]/_components/block-editor.tsx` — whole-file rewrite. Final state: 336 lines (−219). Imports only the non-collab subset (buildExtensions, slash-command machinery, NodeView hosts, toolbar, floating link editor, DragHandle, lucide icons for save state). Single-user path only.
- `src/lib/tiptap-extensions/build-extensions.ts` — whole-file rewrite. Final state: 107 lines (−31). `BuildExtensionsOptions` contains only `onSlashCommand?`; extensions array has 17 entries; no conditional collaboration push.

**Deleted:**

- `src/lib/tiptap-extensions/inline-comment-mark.ts` — confirmed absent.

**Unchanged (contrary to plan instructions):**

- `src/__tests__/editor-extensions.test.ts` — already had zero `inlineComment` references at HEAD. The plan and RESEARCH § Pitfall 2 flagged this file for update, but direct inspection showed the `required` array at lines 19–35 never contained `inlineComment`, and no other reference exists. No edit was required. Test passes as-is.

## Decisions Made

- **Whole-file Write tool rewrite for block-editor.tsx.** The removal surface touched imports, state, callbacks, 2 useEffects, useEditor config, header JSX, CommentBubble JSX, and CommentPanel JSX — roughly 40% of the file. Fifteen chained Edit operations would have compounded risk of stale matches. A single Write with a known-clean target state is more reliable.
- **handleBlur signature simplified.** Original signature destructured `{ editor }` only to access it inside the removed `providerRef` guard. Post-rewrite handleBlur takes no arguments; it only calls `debouncedSave.flush()` when dirty.
- **Removed MessageSquare import and comment toggle button.** The toggle button's only purpose was to show/hide CommentPanel, which is deleted. Removing it drops one more lucide icon import.
- **editor-extensions.test.ts needs no edit.** Empirical grep at HEAD showed zero `inlineComment` references. The plan's update instruction was based on RESEARCH.md which described a pre-existing state that had already been cleaned. Documenting this as a plan deviation for the verifier.

## Deviations from Plan

**1. [Rule 3 — Blocker Not Needed] `editor-extensions.test.ts` requires no update**
- **Found during:** Task 2 pre-edit inspection
- **Issue:** Plan Task 2 Part C instructed to remove `inlineComment` from the expected extension names array. Direct Read of the file and grep for `inlineComment|InlineComment|inline-comment` returned zero matches. The test already conforms to the post-rollback state.
- **Fix:** No edit made. File left untouched. Test passes.
- **Files modified:** None
- **Commit:** N/A (no change)

No other deviations. Plan executed as written for both tasks.

## Issues Encountered

None. The grep audits passed on the first rewrite attempt for both files. No iteration needed.

## User Setup Required

None.

## Known Stubs

None. The editor is now fully wired for single-user operation — auto-save fires unconditionally on every update, section.content is the sole content source, no mock data flows through the component.

## Next Phase Readiness

**Ready for Plan 03 (`14-03-PLAN.md`):** tRPC comments router deletion + permissions/constants cleanup.

- Plan 03 can safely delete `src/server/routers/comments.ts`, remove `comments: commentRouter` from `_app.ts`, and strip `comment:read`/`comment:create` from `src/lib/permissions.ts` + comment ACTIONS from `src/lib/constants.ts`. No remaining code in the editor client surface references these.
- The render-gate test (`section-content-view.test.tsx`) remains the correct acceptance signal.

**Grep audit (final state):**

- `grep -rn "HocuspocusProvider\|providerRef\|InlineComment" "app/(workspace)/policies/[id]/_components/block-editor.tsx" "src/lib/tiptap-extensions/build-extensions.ts"` → **0 matches**
- `grep -c "Collaboration\|CollaborationCaret\|collaboration?\|undoRedo" src/lib/tiptap-extensions/build-extensions.ts` → **0**
- `test ! -e src/lib/tiptap-extensions/inline-comment-mark.ts` → **true**

## Self-Check: PASSED

Verified claimed edits and commit hashes exist:

**File state:**
- FOUND: `app/(workspace)/policies/[id]/_components/block-editor.tsx` (336 lines, clean single-user)
- FOUND: `src/lib/tiptap-extensions/build-extensions.ts` (107 lines, 17 extensions, no collab)
- ABSENT (OK): `src/lib/tiptap-extensions/inline-comment-mark.ts`

**Grep audits (all return 0):**
- `providerRef|HocuspocusProvider|PresenceBar|ConnectionStatus|CommentPanel|CommentBubble|PendingComment|getPresenceColor|useSession|useUser|HOCUSPOCUS_URL|commentPanelOpen|pendingComment|activeCommentId|CollabConnectionStatus|collaboration:` in block-editor.tsx → 0
- `Collaboration|CollaborationCaret|@hocuspocus/provider|from 'yjs'|InlineComment|inline-comment-mark|undoRedo|collaboration?` in build-extensions.ts → 0
- `inlineComment|InlineComment|inline-comment` in editor-extensions.test.ts → 0

**Commits (2/2 found in git log):**
- FOUND: `7cc1e31` — Task 1 (refactor: strip Yjs/Hocuspocus/comment code from block-editor.tsx)
- FOUND: `c93fff7` — Task 2 (refactor: drop Collaboration/InlineComment from buildExtensions)

**Test results:**
- FOUND: `section-content-view.test.tsx` — 7/7 pass (post-Task-1 and post-Task-2)
- FOUND: `editor-extensions.test.ts` — 9/9 pass (17 extensions ≥ 15)
- FOUND: Full suite at 2 failed / 295 passed — identical to Plan 01 baseline, **zero new failures**

---
*Phase: 14-collab-rollback*
*Plan: 02*
*Completed: 2026-04-13*
