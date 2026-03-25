---
phase: 06-versioning
plan: 02
subsystem: ui
tags: [versioning, diff-view, publish-dialog, tRPC, version-history, changelog, immutable-badge]

# Dependency graph
requires:
  - phase: 06-versioning
    provides: version tRPC router (list, getById, createManual, publish, diff), diff CSS variables, version.service types
  - phase: 05-change-requests
    provides: CR detail/list patterns, merge-dialog pattern, LinkedFeedbackList pattern
  - phase: 02
    provides: two-panel layout pattern, section sidebar, ScrollArea, Select, Dialog components
provides:
  - Version history page with two-panel layout (list + detail)
  - Version list with monospace labels, status badges (Draft/Published/Immutable)
  - Version detail with changelog, metadata rows, publish button, immutable indicator
  - Publish dialog with immutability warning, changelog preview, confirmation flow
  - Create version dialog with notes textarea, character counter, validation
  - Version comparison selector with base/target/section selects and swap button
  - Section diff view with inline word-level diff using green/red CSS variables
affects: [07-traceability, 09-public-portal]

# Tech tracking
tech-stack:
  added: []
  patterns: [two-panel version history with list/detail, inline word-level diff rendering, publish confirmation with immutability warning]

key-files:
  created:
    - app/(workspace)/policies/[id]/versions/page.tsx
    - app/(workspace)/policies/[id]/versions/_components/version-list.tsx
    - app/(workspace)/policies/[id]/versions/_components/version-card.tsx
    - app/(workspace)/policies/[id]/versions/_components/version-detail.tsx
    - app/(workspace)/policies/[id]/versions/_components/version-status-badge.tsx
    - app/(workspace)/policies/[id]/versions/_components/version-changelog.tsx
    - app/(workspace)/policies/[id]/versions/_components/publish-dialog.tsx
    - app/(workspace)/policies/[id]/versions/_components/create-version-dialog.tsx
    - app/(workspace)/policies/[id]/versions/_components/version-comparison-selector.tsx
    - app/(workspace)/policies/[id]/versions/_components/section-diff-view.tsx
  modified: []

key-decisions:
  - "canManage defaults to true client-side following Phase 4 pattern; server enforces version:manage and version:publish permissions"
  - "Inline word-level diff rendering (single column) for both desktop and mobile; two-column header on desktop only"
  - "Version comparison selector auto-selects previous version as base and current as target for most useful default"

patterns-established:
  - "Version status badge pattern: Draft (muted), Published/Immutable (indigo with Lock icon)"
  - "Publish confirmation pattern: DialogFooter with justify-between for cancel/confirm separation on irreversible actions"
  - "Character counter pattern on textarea: destructive color when below minimum, muted when valid"

requirements-completed: [VER-01, VER-02, VER-03, VER-04, VER-05, VER-06, VER-07]

# Metrics
duration: 11min
completed: 2026-03-25
---

# Phase 06 Plan 02: Version History UI Summary

**Two-panel version history with monospace labels, Draft/Published/Immutable badges, changelog with CR/FB badges, publish confirmation with immutability warning, word-level section diff with green/red CSS variable highlighting**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-25T06:13:38Z
- **Completed:** 2026-03-25T06:24:38Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Version history page with two-panel layout: 280px sidebar list with ScrollArea + flex-1 detail area capped at 800px
- 10 client components wired to 5 tRPC procedures (version.list, version.getById, version.publish, version.createManual, version.diff)
- Publish dialog with changelog preview, immutability warning (AlertTriangle), and irreversible action separation (justify-between footer)
- Section diff view rendering inline word-level diffs using --diff-added-bg/text and --diff-removed-bg/text CSS variables

## Task Commits

Each task was committed atomically:

1. **Task 1: Version history page, list panel, detail view, status badge, changelog** - `8fa6974` (feat)
2. **Task 2: Publish dialog, create version dialog, comparison selector, section diff view** - `dc58da3` (feat)

## Files Created/Modified
- `app/(workspace)/policies/[id]/versions/page.tsx` - Version history page entry point with two-panel layout, auto-select latest version, empty state
- `app/(workspace)/policies/[id]/versions/_components/version-list.tsx` - Left panel with ScrollArea (desktop) and Select dropdown (mobile), New Version button
- `app/(workspace)/policies/[id]/versions/_components/version-card.tsx` - Version list item with monospace label badge, status badge, date, creator
- `app/(workspace)/policies/[id]/versions/_components/version-detail.tsx` - Right panel with version label, metadata rows, changelog, publish button/immutable indicator, diff section
- `app/(workspace)/policies/[id]/versions/_components/version-status-badge.tsx` - Three-state badge: Draft (muted), Published/Immutable (indigo with Lock icon)
- `app/(workspace)/policies/[id]/versions/_components/version-changelog.tsx` - Changelog entries with CR badge (monospace), summary text, FB-NNN badges
- `app/(workspace)/policies/[id]/versions/_components/publish-dialog.tsx` - Publish confirmation with immutability warning, changelog preview, Lock icon CTA
- `app/(workspace)/policies/[id]/versions/_components/create-version-dialog.tsx` - Manual version creation with notes textarea, 10-char min, 2000-char max, character counter
- `app/(workspace)/policies/[id]/versions/_components/version-comparison-selector.tsx` - Three selects (base, target, section) with swap button and Compare Versions CTA
- `app/(workspace)/policies/[id]/versions/_components/section-diff-view.tsx` - Inline diff renderer with green (added) and red (removed) CSS variable highlighting

## Decisions Made
- Client-side permission defaults to true following Phase 4 canTriage pattern; server-side requirePermission on mutations is the real guard
- Inline diff rendering for both desktop and mobile (no side-by-side split) since word-level diff via diffWords produces Change[] spans, not line-by-line output
- Version comparison selector defaults base to previous version and target to current version for most common comparison scenario
- Used VersionListItem interface across components rather than inferring from tRPC output types for cleaner prop drilling

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Known Stubs
None - all 10 components are fully implemented with real tRPC query/mutation wiring.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All VER requirements complete (VER-01 through VER-07)
- Version history UI fully wired to version backend (Plan 01)
- Ready for Phase 07 (Traceability) which will link version data into the traceability matrix
- Ready for Phase 09 (Public Portal) which will add public read-only view of published versions

## Self-Check: PASSED

- All 10 created files verified on disk
- Commits 8fa6974 and dc58da3 verified in git log
- No new TypeScript compilation errors (all errors are pre-existing from earlier phases)
- All UI-SPEC copywriting verified: "Version History", "VERSIONS", "Back to Policy", "Draft", "Published", "Immutable", "CHANGELOG", "SECTION DIFF", "Publish Version", "Create Version", "Compare Versions"
- Diff CSS variables (--diff-added-bg, --diff-removed-bg) confirmed used in section-diff-view.tsx
- All 5 tRPC procedures wired: version.list, version.getById, version.publish, version.createManual, version.diff

---
*Phase: 06-versioning*
*Completed: 2026-03-25*
