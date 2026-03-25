---
phase: 03-block-editor
plan: 01
subsystem: editor
tags: [tiptap, prosemirror, slash-commands, callout, link-preview, lowlight, trpc, zod]

# Dependency graph
requires:
  - phase: 02-document-structure
    provides: policySections table with JSONB content column, document tRPC router
provides:
  - buildExtensions() factory producing complete Tiptap extension array
  - Custom Callout block node (callout-node.ts)
  - Custom SlashCommands extension with 15 command items (slash-command-extension.ts)
  - Custom LinkPreview atom node (link-preview-node.ts)
  - updateSectionContent tRPC mutation for persisting editor content
affects: [03-02-editor-ui, 03-03-media-blocks, 06-versioning]

# Tech tracking
tech-stack:
  added: ["@tiptap/react", "@tiptap/pm", "@tiptap/starter-kit", "@tiptap/extension-image", "@tiptap/extension-file-handler", "@tiptap/extension-table", "@tiptap/extension-details", "@tiptap/extension-code-block-lowlight", "@tiptap/extension-drag-handle-react", "@tiptap/extension-drag-handle", "@tiptap/extension-node-range", "@tiptap/extension-bubble-menu", "@tiptap/extension-placeholder", "@tiptap/suggestion", "lowlight", "uploadthing", "@uploadthing/react", "use-debounce"]
  patterns: ["Tiptap Node.create() for custom block nodes", "Extension.create() + @tiptap/suggestion for slash commands", "buildExtensions() factory pattern for composing extension arrays", "z.record(z.string(), z.unknown()) for Zod v4 record type"]

key-files:
  created:
    - src/lib/tiptap-extensions/build-extensions.ts
    - src/lib/tiptap-extensions/callout-node.ts
    - src/lib/tiptap-extensions/slash-command-extension.ts
    - src/lib/tiptap-extensions/link-preview-node.ts
    - src/__tests__/editor-extensions.test.ts
    - src/__tests__/section-content-mutation.test.ts
  modified:
    - src/server/routers/document.ts

key-decisions:
  - "CodeBlockLowlight registers as 'codeBlock' (not 'codeBlockLowlight') -- tests match actual extension name"
  - "Zod v4 requires z.record(z.string(), z.unknown()) instead of z.record(z.unknown()) -- single-arg form broken"
  - "lowlight v3 uses createLowlight(common) for ~35 common languages instead of manual registration"
  - "No audit log for updateSectionContent -- high-frequency auto-saves; Phase 6 versioning provides audit"

patterns-established:
  - "Custom Tiptap nodes: Node.create() with name, group, content, addAttributes, parseHTML, renderHTML"
  - "Custom Tiptap extensions: Extension.create() + addProseMirrorPlugins for plugin integration"
  - "Extension factory: buildExtensions(options?) returns configured array, StarterKit codeBlock disabled for CodeBlockLowlight"
  - "Slash command items: title, description, searchTerms[], command({editor, range})"

requirements-completed: [EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05]

# Metrics
duration: 7min
completed: 2026-03-25
---

# Phase 03 Plan 01: Extensions & Backend Summary

**Custom Tiptap 3 extensions (callout, slash commands, link preview), extension builder factory with 16+ extensions, and updateSectionContent tRPC mutation with permission gating**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-25T01:54:20Z
- **Completed:** 2026-03-25T02:01:49Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Built 3 custom Tiptap extensions: Callout (block with type/emoji), SlashCommands (15 items with filtering), LinkPreview (atom with url/title/description/image)
- Created buildExtensions() factory composing StarterKit + CodeBlockLowlight + Image + FileHandler + Table suite + Details suite + NodeRange + custom extensions + Placeholder
- Added updateSectionContent mutation to document router, permission-gated by section:manage
- 108 tests passing across full suite with zero regressions (34 new tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create custom Tiptap extensions**
   - `6606d85` (test: add failing tests for Tiptap extensions - TDD RED)
   - `a24831b` (feat: create custom Tiptap extensions and extension builder - TDD GREEN)
2. **Task 2: Add updateSectionContent tRPC mutation with unit tests**
   - `2eaf972` (test: add tests for updateSectionContent mutation - TDD RED)
   - `1b867ed` (feat: add updateSectionContent tRPC mutation - TDD GREEN)

## Files Created/Modified
- `src/lib/tiptap-extensions/build-extensions.ts` - Extension builder factory, returns complete configured array
- `src/lib/tiptap-extensions/callout-node.ts` - Custom callout block node with type (info/warning/tip/danger) and emoji attributes
- `src/lib/tiptap-extensions/slash-command-extension.ts` - Slash command trigger using @tiptap/suggestion + 15 filterable command items
- `src/lib/tiptap-extensions/link-preview-node.ts` - Custom atom node for rich link previews with url/title/description/image
- `src/server/routers/document.ts` - Added updateSectionContent mutation (section:manage permission)
- `src/__tests__/editor-extensions.test.ts` - 17 tests covering extensions, schema, and filtering
- `src/__tests__/section-content-mutation.test.ts` - 17 tests covering permissions and input validation

## Decisions Made
- **CodeBlockLowlight name:** Extension registers as `codeBlock` not `codeBlockLowlight` -- test expectations adjusted to match actual Tiptap behavior
- **Zod v4 record syntax:** `z.record(z.unknown())` crashes in Zod v4; must use `z.record(z.string(), z.unknown())` with explicit key type
- **lowlight initialization:** Used `createLowlight(common)` which includes ~35 common languages instead of manually registering 8 individual languages -- reduces code and provides broader coverage
- **No audit log for content saves:** Research explicitly recommends skipping audit for high-frequency auto-saves; Phase 6 versioning creates explicit version snapshots as auditable events

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod v4 z.record() API incompatibility**
- **Found during:** Task 2 (section-content-mutation tests)
- **Issue:** `z.record(z.unknown())` throws "Cannot read properties of undefined (reading '_zod')" in Zod v4
- **Fix:** Changed to `z.record(z.string(), z.unknown())` in both test schema and mutation input
- **Files modified:** src/__tests__/section-content-mutation.test.ts, src/server/routers/document.ts
- **Verification:** All 17 schema validation tests pass
- **Committed in:** 2eaf972, 1b867ed

**2. [Rule 1 - Bug] Fixed CodeBlockLowlight extension name in test**
- **Found during:** Task 1 (editor-extensions tests)
- **Issue:** Test expected extension name `codeBlockLowlight` but CodeBlockLowlight registers as `codeBlock`
- **Fix:** Updated test expectation to match actual extension name
- **Files modified:** src/__tests__/editor-extensions.test.ts
- **Verification:** buildExtensions includes-all-required-extensions test passes
- **Committed in:** a24831b

---

**Total deviations:** 2 auto-fixed (2 bug fixes)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
- `FileHandler.configure({ onDrop: () => {}, onPaste: () => {} })` in build-extensions.ts -- placeholder no-op callbacks, will be wired in Plan 03 (media blocks)
- File slash command item (`command: ({ editor, range }) => { editor.chain().focus().deleteRange(range).run() }`) -- just clears range, file upload UI in Plan 03
- Image slash command inserts `setImage({ src: '' })` -- empty src placeholder, upload flow in Plan 03

## Next Phase Readiness
- buildExtensions() is ready for consumption by BlockEditor component (Plan 02)
- SlashCommands extension needs React UI popup component (Plan 02: slash-command-menu.tsx)
- Callout node needs React NodeView renderer (Plan 02: callout component)
- LinkPreview node needs React NodeView renderer (Plan 03: link preview component)
- updateSectionContent mutation is ready for auto-save via debounced onUpdate (Plan 02)

## Self-Check: PASSED

- All 7 files verified present on disk
- All 4 commit hashes verified in git log
- 108/108 tests passing (full suite)

---
*Phase: 03-block-editor*
*Completed: 2026-03-25*
