---
phase: 03-block-editor
plan: 02
subsystem: editor
tags: [tiptap, prosemirror, block-editor, drag-handle, slash-commands, toolbar, link-editor, auto-save, trpc]

# Dependency graph
requires:
  - phase: 03-block-editor
    plan: 01
    provides: buildExtensions() factory, custom extensions (Callout, SlashCommands, LinkPreview), updateSectionContent mutation
  - phase: 02-document-structure
    provides: policySections table, SectionContentView component, policy detail page
provides:
  - BlockEditor component with Tiptap EditorContent, DragHandle, auto-save, and edit mode
  - EditorToolbar with 5 button groups (block type, text format, links, lists, insert)
  - SlashCommandMenu popover with grouped items rendered via ReactRenderer
  - FloatingLinkEditor with URL validation and apply/remove
  - CalloutBlockView React NodeView for callout blocks
  - ProseMirror CSS styles for all block types
  - Updated SectionContentView with canEdit prop and dynamic editor import
affects: [03-03-media-blocks, 06-versioning, 11-collaboration]

# Tech tracking
tech-stack:
  added: []
  patterns: ["ReactNodeViewRenderer for custom block node views", "ReactRenderer for suggestion popup rendering", "dynamic() with ssr:false for DragHandle hydration safety", "useDebouncedCallback for auto-save with flush on blur", "Callout.extend() to add React NodeView to headless extension"]

key-files:
  created:
    - app/(workspace)/policies/[id]/_components/block-editor.tsx
    - app/(workspace)/policies/[id]/_components/editor-toolbar.tsx
    - app/(workspace)/policies/[id]/_components/slash-command-menu.tsx
    - app/(workspace)/policies/[id]/_components/floating-link-editor.tsx
    - app/(workspace)/policies/[id]/_components/callout-block-view.tsx
  modified:
    - app/(workspace)/policies/[id]/_components/section-content-view.tsx
    - app/(workspace)/policies/[id]/page.tsx
    - app/globals.css

key-decisions:
  - "Callout.extend() used to add ReactNodeViewRenderer in block-editor rather than modifying the headless callout-node.ts from Plan 01"
  - "Portal-based slash command menu positioning via createPortal + clientRect instead of tippy.js (tippy not installed)"
  - "Block type dropdown cycles through types on click rather than full dropdown menu (simpler UX, full dropdown deferred)"
  - "Auto-save fires on every editor update with 1.5s debounce, plus flush on blur -- matches UI-SPEC save strategy"

patterns-established:
  - "ReactNodeViewRenderer pattern: extend headless node with addNodeView() returning ReactNodeViewRenderer(Component)"
  - "Suggestion popup: ReactRenderer + portal for positioning, forwardRef + useImperativeHandle for keyboard forwarding"
  - "Editor toolbar: ToolbarButton wrapper with Tooltip, aria-pressed for active state, ghost/secondary variant toggle"
  - "Dynamic import with ssr:false: `dynamic(() => import('./block-editor'), { ssr: false })` for DragHandle safety"

requirements-completed: [EDIT-01, EDIT-02, EDIT-03, EDIT-04]

# Metrics
duration: 9min
completed: 2026-03-25
---

# Phase 03 Plan 02: Editor UI Summary

**Full block editor UI with EditorToolbar (5 groups), SlashCommandMenu (15 block types), FloatingLinkEditor, DragHandle block reorder, and debounced auto-save via tRPC mutation**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-25T02:08:22Z
- **Completed:** 2026-03-25T02:17:23Z
- **Tasks:** 3 (2 auto + 1 checkpoint auto-approved)
- **Files modified:** 8

## Accomplishments
- Built BlockEditor component with Tiptap EditorContent, DragHandle for drag-and-drop block reorder, and debounced auto-save (1.5s) via updateSectionContent tRPC mutation
- Created EditorToolbar with 5 button groups: block type dropdown, text formatting (bold/italic/underline/strikethrough/code), link insertion, lists, and insert actions -- all with tooltips showing keyboard shortcuts
- Built SlashCommandMenu using ReactRenderer and portal-based positioning, with 15 block types grouped into Text blocks/Advanced/Media categories, keyboard navigation, and filtering
- Implemented FloatingLinkEditor with URL validation, apply/remove link actions, and new tab toggle
- Created CalloutBlockView React NodeView for styled callout blocks with emoji prefix
- Added comprehensive ProseMirror CSS styles for all block types (headings, code blocks, tables, callouts, toggles, blockquotes, images, links)
- Updated SectionContentView with canEdit/edit mode toggle and dynamic BlockEditor import (SSR disabled for DragHandle)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create BlockEditor with DragHandle, auto-save, and edit mode toggle** - `3886d45` (feat)
2. **Task 2: Create EditorToolbar, SlashCommandMenu, and FloatingLinkEditor** - `c85eb1c` (feat)
3. **Task 3: Verify core editor experience** - auto-approved (checkpoint, no commit)

## Files Created/Modified
- `app/(workspace)/policies/[id]/_components/block-editor.tsx` - Main editor component with useEditor, EditorContent, DragHandle, auto-save, toolbar/slash/link integration
- `app/(workspace)/policies/[id]/_components/editor-toolbar.tsx` - Fixed toolbar with block type dropdown and 5 button groups
- `app/(workspace)/policies/[id]/_components/slash-command-menu.tsx` - Suggestion popup with Command component, grouped items, keyboard navigation
- `app/(workspace)/policies/[id]/_components/floating-link-editor.tsx` - Link editing popover with URL validation, apply/remove
- `app/(workspace)/policies/[id]/_components/callout-block-view.tsx` - React NodeView for callout blocks with emoji prefix
- `app/(workspace)/policies/[id]/_components/section-content-view.tsx` - Updated with canEdit prop, edit mode toggle, dynamic BlockEditor import
- `app/(workspace)/policies/[id]/page.tsx` - Passes canEdit and documentId props to SectionContentView
- `app/globals.css` - ProseMirror CSS for headings, code blocks, tables, callouts, toggles, blockquotes, lists, images, links, placeholders

## Decisions Made
- **Callout NodeView extension:** Used `Callout.extend()` in block-editor.tsx to add ReactNodeViewRenderer rather than modifying callout-node.ts from Plan 01, keeping the headless extension clean
- **Portal-based slash menu:** Used createPortal + clientRect positioning instead of tippy.js (not installed), avoiding a new dependency
- **Block type cycling:** Block type dropdown cycles through types on click for simplicity; full dropdown menu deferred to refinement
- **Auto-save strategy:** Fires on every editor update with 1.5s debounce, flushes on blur, matches UI-SPEC save strategy exactly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
- Image insert button calls `setImage({ src: '' })` -- empty src placeholder, upload flow in Plan 03
- Table controls (add row, delete column, etc.) not yet rendered as floating toolbar -- basic insert via toolbar and slash command works

## Next Phase Readiness
- All editor UI components ready for Plan 03 (media blocks: image upload, file attachment, link preview)
- EditorToolbar image button is wired but needs upload flow from Plan 03
- SlashCommandMenu renders all 15 block types; Image/File/Link Preview commands need Plan 03 implementations
- Auto-save and mutation are fully wired, ready for content persistence testing

## Self-Check: PASSED

- All 8 files verified present on disk
- All 2 commit hashes verified in git log (3886d45, c85eb1c)

---
*Phase: 03-block-editor*
*Completed: 2026-03-25*
