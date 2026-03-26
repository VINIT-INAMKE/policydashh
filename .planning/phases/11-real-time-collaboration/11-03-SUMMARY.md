---
phase: 11-real-time-collaboration
plan: 03
subsystem: ui
tags: [tiptap, inline-comments, comment-panel, comment-thread, trpc, prosemirror]

# Dependency graph
requires:
  - phase: 11-real-time-collaboration
    provides: "InlineComment mark, comments tRPC router, collaboration schema, HocuspocusProvider integration"
provides:
  - "CommentBubble floating trigger on text selection with keyboard shortcut"
  - "CommentPanel (320px inline panel or Sheet) with Open/Resolved tabs"
  - "CommentThread with replies, resolve, reopen, delete lifecycle"
  - "Comment anchor highlighting via inline-comment-mark CSS"
  - "Full comment creation flow: select text -> bubble -> post -> mark applied -> thread in panel"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["CommentBubble selection detection via window.getSelection + editor selectionUpdate", "Responsive panel: inline on desktop >= 1200px, Sheet on mobile", "Comment anchor click handler via DOM event delegation on editor view"]

key-files:
  created:
    - "app/(workspace)/policies/[id]/_components/comment-bubble.tsx"
    - "app/(workspace)/policies/[id]/_components/comment-panel.tsx"
    - "app/(workspace)/policies/[id]/_components/comment-thread.tsx"
  modified:
    - "app/(workspace)/policies/[id]/_components/block-editor.tsx"
    - "app/(workspace)/policies/[id]/_components/section-content-view.tsx"

key-decisions:
  - "CommentBubble uses manual selection detection (editor.on selectionUpdate + window.getSelection) rather than Tiptap BubbleMenu extension for more control over positioning"
  - "Comment anchor highlighting via CSS class on EditorContent ([&_.inline-comment-mark]:bg-primary/15) rather than ProseMirror decorations -- simpler, mark already renders class"
  - "Desktop/mobile panel detection via window.innerWidth >= 1200 with resize listener, not CSS media query"

patterns-established:
  - "CommentBubble: floating trigger using editor selection events + getBoundingClientRect positioning"
  - "CommentPanel: responsive 320px panel (inline on >= 1200px, Sheet on mobile) with tRPC data fetching"
  - "CommentThread: threaded UI with reply form, resolve/reopen/delete via DropdownMenu and toast feedback"
  - "Comment anchor click delegation on editor.view.dom for opening panel to specific thread"

requirements-completed: [EDIT-08]

# Metrics
duration: 8min
completed: 2026-03-26
---

# Phase 11 Plan 03: Inline Comments Summary

**CommentBubble trigger on text selection, CommentPanel with threaded discussions (Open/Resolved tabs), and full comment lifecycle (create, reply, resolve, reopen, delete) wired via tRPC comments router**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-26T09:07:11Z
- **Completed:** 2026-03-26T09:15:12Z
- **Tasks:** 3 (2 auto + 1 checkpoint auto-approved)
- **Files modified:** 5

## Accomplishments
- CommentBubble floating trigger appears above text selection with "Comment" button and Ctrl+Alt+M keyboard shortcut
- CommentPanel renders as inline 320px panel on desktop (>= 1200px) or Sheet on mobile with Open/Resolved tabs, thread list, and new comment form
- CommentThread displays threaded comments with reply form, resolve/reopen buttons, delete via DropdownMenu, and toast feedback per UI-SPEC copywriting
- Full comment flow wired into BlockEditor: select text -> CommentBubble -> create thread -> InlineComment mark applied -> thread appears in panel
- Comment anchor highlighting via CSS (primary/15 background, primary/25 when active)

## Task Commits

Each task was committed atomically:

1. **Task 1: CommentBubble, CommentPanel, CommentThread, and reply/resolve UI** - `34e518f` (feat)
2. **Task 2: Wire CommentBubble and CommentPanel into BlockEditor** - `d273834` (feat)
3. **Task 3: Verify complete real-time collaboration system** - auto-approved checkpoint (no code changes)

## Files Created/Modified
- `app/(workspace)/policies/[id]/_components/comment-bubble.tsx` - Floating CommentBubble trigger above text selection with Ctrl+Alt+M shortcut
- `app/(workspace)/policies/[id]/_components/comment-panel.tsx` - 320px right panel with Open/Resolved tabs, new comment form, thread list, tRPC mutations
- `app/(workspace)/policies/[id]/_components/comment-thread.tsx` - Individual thread component with replies, resolve, reopen, delete, and inline reply form
- `app/(workspace)/policies/[id]/_components/block-editor.tsx` - Integrated CommentBubble, CommentPanel, comment state, anchor click handler, comment toggle button
- `app/(workspace)/policies/[id]/_components/section-content-view.tsx` - Allow overflow for comment panel expansion

## Decisions Made
- CommentBubble uses manual selection detection (editor selectionUpdate + window.getSelection + getBoundingClientRect) rather than Tiptap BubbleMenu extension -- provides more positioning control and z-index management
- Comment anchor highlighting via CSS class on EditorContent rather than separate ProseMirror decoration plugin -- the InlineComment mark already renders with `.inline-comment-mark` class, so CSS styling is simpler and sufficient
- Desktop/mobile panel detection via JS window.innerWidth >= 1200 with resize listener, matching the UI-SPEC breakpoint

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 11 (Real-Time Collaboration) is fully complete with all 3 plans executed
- EDIT-06 (real-time collaborative editing) delivered in Plan 01/02
- EDIT-07 (presence indicators) delivered in Plan 02
- EDIT-08 (inline comments) delivered in Plan 03
- Ready for milestone completion review

## Self-Check: PASSED

- All 5 created/modified files exist on disk
- Both task commits (34e518f, d273834) found in git log
- No TypeScript errors in new/modified files
- No stubs detected in created files

---
*Phase: 11-real-time-collaboration*
*Completed: 2026-03-26*
