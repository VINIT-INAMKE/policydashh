---
phase: 12-workshop-system-fix
plan: 01
subsystem: ui, api
tags: [tRPC, dialog, workshop, sections, drizzle]

# Dependency graph
requires:
  - phase: 10-workshops-evidence-management
    provides: Workshop detail page, section/feedback link pickers, artifact dialog
  - phase: 02-policy-documents-sections
    provides: document.list tRPC query, policySections schema
provides:
  - "document.list with optional includeSections parameter returning nested sections"
  - "Pure dialog content section-link-picker with title + block count display"
  - "Artifact attach dialog with no orphaned DialogTrigger"
affects: [12-workshop-system-fix]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional nested include pattern: tRPC query with opt-in parameter for nested data"
    - "Pure dialog content pattern: picker components render only Dialog+DialogContent, parent owns trigger and state"

key-files:
  created: []
  modified:
    - src/server/routers/document.ts
    - app/(workspace)/workshops/[id]/_components/section-link-picker.tsx
    - app/(workspace)/workshops/[id]/_components/artifact-attach-dialog.tsx

key-decisions:
  - "Optional includeSections parameter preserves backward compatibility for all existing document.list callers"
  - "Section picker shows block count derived from content.content.length (Tiptap JSON structure)"
  - "Removed Upload icon import from artifact dialog (was only used in removed DialogTrigger)"

patterns-established:
  - "Opt-in nested data: tRPC query accepts optional parameter to include related data, keeping default response lean"
  - "Pure dialog content: picker/dialog components receive open/onOpenChange as required props, no internal state or DialogTrigger"

requirements-completed: [FIX-01, FIX-03, FIX-04]

# Metrics
duration: 3min
completed: 2026-04-12
---

# Phase 12 Plan 01: Workshop System Fix Summary

**Section link picker fetches nested sections via document.list({ includeSections: true }) with block count display, orphaned DialogTriggers removed from both pickers**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-11T22:34:40Z
- **Completed:** 2026-04-11T22:37:48Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Expanded document.list tRPC query with opt-in includeSections parameter that returns nested sections grouped by document
- Rewrote section-link-picker as pure dialog content showing sections with title, document name, and block count
- Removed orphaned DialogTrigger and internalOpen state from artifact-attach-dialog

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand document.list with includeSections and rewrite section-link-picker.tsx** - `363f091` (feat)
2. **Task 2: Remove orphaned DialogTrigger from artifact-attach-dialog.tsx** - `3071a06` (fix)

## Files Created/Modified
- `src/server/routers/document.ts` - Added optional includeSections input to list query; fetches and groups sections by document when enabled
- `app/(workspace)/workshops/[id]/_components/section-link-picker.tsx` - Full rewrite as pure dialog content with section title + block count display, no DialogTrigger/Badge/unlinkMutation
- `app/(workspace)/workshops/[id]/_components/artifact-attach-dialog.tsx` - Removed DialogTrigger, internalOpen state, unused Upload import; made open/onOpenChange required

## Decisions Made
- Optional includeSections parameter preserves backward compatibility for all existing document.list callers (no breaking changes)
- Block count derived from Tiptap JSON content.content.length (counts top-level blocks in section)
- Removed unused Upload icon import from artifact dialog that was only referenced in the deleted DialogTrigger

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused Upload import from artifact-attach-dialog.tsx**
- **Found during:** Task 2
- **Issue:** After removing DialogTrigger, the Upload icon import became unused (was only used inside the trigger)
- **Fix:** Removed the unused import to prevent lint warnings
- **Files modified:** app/(workspace)/workshops/[id]/_components/artifact-attach-dialog.tsx
- **Verification:** File compiles, no unused import references
- **Committed in:** 3071a06 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Minor cleanup, no scope creep.

## Issues Encountered
- TypeScript compilation in worktree shows pre-existing errors due to missing node_modules (worktree shares source but not dependencies). Confirmed no new errors introduced by verifying same error patterns exist in unmodified files.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data sources are wired and functional.

## Next Phase Readiness
- Section link picker now fetches and displays real sections with title and block count
- Artifact dialog is clean with no orphaned trigger elements
- Ready for Plan 02 (feedback link picker UI) to complete the workshop system fix

---
*Phase: 12-workshop-system-fix*
*Completed: 2026-04-12*
