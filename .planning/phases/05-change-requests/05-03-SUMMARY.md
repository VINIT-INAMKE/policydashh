---
phase: 05-change-requests
plan: 03
subsystem: ui
tags: [react, trpc, dialog, lifecycle, merge, close, feedback-traceability]

# Dependency graph
requires:
  - phase: 05-change-requests-01
    provides: "tRPC changeRequest router with CRUD, transitions, merge, close, addSection, removeSection, listTransitions, getNextVersionLabel"
  - phase: 05-change-requests-02
    provides: "CRStatusBadge component, CR list page, CR card, create dialog, globals.css CR status variables"
  - phase: 04-feedback-system
    provides: "StatusBadge, RationaleDialog pattern, DecisionLog pattern, TriageActions pattern"
provides:
  - "CR detail page at /policies/[id]/change-requests/[crId]"
  - "CRLifecycleActions with 5 state-based button renderings"
  - "MergeDialog with merge summary textarea, char counter, version preview"
  - "CloseDialog with rationale textarea enforcing 20-char minimum"
  - "LinkedFeedbackList with FB-NNN badges and status badges"
  - "AffectedSectionsTable with add/remove in drafting state"
  - "AddSectionDialog with section select excluding already-linked"
  - "CRDecisionLog with chronological transitions and metadata"
affects: [06-versioning, 07-traceability]

# Tech tracking
tech-stack:
  added: []
  patterns: ["CR lifecycle state-based rendering", "merge confirmation with version preview", "section linking CRUD with AlertDialog confirmation"]

key-files:
  created:
    - "app/(workspace)/policies/[id]/change-requests/[crId]/page.tsx"
    - "app/(workspace)/policies/[id]/change-requests/_components/cr-detail.tsx"
    - "app/(workspace)/policies/[id]/change-requests/_components/cr-lifecycle-actions.tsx"
    - "app/(workspace)/policies/[id]/change-requests/_components/merge-dialog.tsx"
    - "app/(workspace)/policies/[id]/change-requests/_components/close-dialog.tsx"
    - "app/(workspace)/policies/[id]/change-requests/_components/linked-feedback-list.tsx"
    - "app/(workspace)/policies/[id]/change-requests/_components/affected-sections-table.tsx"
    - "app/(workspace)/policies/[id]/change-requests/_components/add-section-dialog.tsx"
    - "app/(workspace)/policies/[id]/change-requests/_components/cr-decision-log.tsx"
  modified: []

key-decisions:
  - "Import Phase 4 StatusBadge directly for feedback status rendering in LinkedFeedbackList (consistency with existing feedback display)"
  - "CRDecisionLog fetches its own transitions via useQuery rather than receiving props (encapsulated data fetching per component)"
  - "AffectedSectionsTable inline AlertDialog for remove confirmation rather than separate component (follows UI-SPEC exactly)"

patterns-established:
  - "CR lifecycle state-based rendering: conditional button groups per CRStatus enum value"
  - "Merge confirmation with version preview: fetch getNextVersionLabel query on dialog open"
  - "Section CRUD pattern: Add/Remove with AlertDialog confirmation and query invalidation"

requirements-completed: [CR-04, CR-05, CR-06, CR-07, CR-08]

# Metrics
duration: 6min
completed: 2026-03-25
---

# Phase 5 Plan 3: CR Detail Page Summary

**CR detail page with lifecycle actions (submit/approve/merge/close), linked feedback list with FB-NNN traceability, affected sections table with add/remove, and chronological decision log**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-25T04:54:41Z
- **Completed:** 2026-03-25T05:00:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- CR detail page renders full CR information with back link, ID badge, title, status, owner, dates, and description
- All 5 lifecycle states render correct action buttons: Submit for Review, Approve, Merge, Close without Merge, and terminal state messages
- MergeDialog shows merge summary textarea (min 20 chars), character counter, version preview via getNextVersionLabel, and "Merge and Create Version" button
- CloseDialog enforces 20-character minimum rationale with character counter
- LinkedFeedbackList shows FB-NNN badges in monospace, feedback status badges (using Phase 4 StatusBadge), and external links to feedback detail
- AffectedSectionsTable shows sections with truncated UUIDs and tooltips; add/remove only available in drafting state
- CRDecisionLog shows chronological transitions with CRStatusBadge arrows, actor names, timestamps, and metadata (rationale/mergeSummary)

## Task Commits

Each task was committed atomically:

1. **Task 1: CR detail page, lifecycle actions, merge dialog, close dialog** - `0c957e1` (feat)
2. **Task 2: Linked feedback list, affected sections table, add section dialog, decision log** - `9085f80` (feat)

## Files Created/Modified
- `app/(workspace)/policies/[id]/change-requests/[crId]/page.tsx` - Server component page with params Promise unwrapping
- `app/(workspace)/policies/[id]/change-requests/_components/cr-detail.tsx` - Main detail view with getById query and all child components
- `app/(workspace)/policies/[id]/change-requests/_components/cr-lifecycle-actions.tsx` - State-based lifecycle action buttons with mutations
- `app/(workspace)/policies/[id]/change-requests/_components/merge-dialog.tsx` - Merge confirmation with summary textarea and version preview
- `app/(workspace)/policies/[id]/change-requests/_components/close-dialog.tsx` - Close without merge with rationale textarea (min 20 chars)
- `app/(workspace)/policies/[id]/change-requests/_components/linked-feedback-list.tsx` - Linked feedback with FB-NNN badges and external links
- `app/(workspace)/policies/[id]/change-requests/_components/affected-sections-table.tsx` - Sections table with add/remove and AlertDialog confirmation
- `app/(workspace)/policies/[id]/change-requests/_components/add-section-dialog.tsx` - Add section dialog with Select component
- `app/(workspace)/policies/[id]/change-requests/_components/cr-decision-log.tsx` - Decision log with transitions query and status badges

## Decisions Made
- Imported Phase 4 StatusBadge directly for feedback status rendering in LinkedFeedbackList to maintain visual consistency
- CRDecisionLog fetches its own transitions via useQuery rather than receiving data as props, following encapsulated data fetching per component
- AffectedSectionsTable uses inline AlertDialog for remove confirmation per UI-SPEC rather than a separate component
- page.tsx uses async params unwrapping per Next.js 15+ conventions (params is a Promise)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all components are wired to tRPC queries and mutations.

## Next Phase Readiness
- CR detail page complete with full lifecycle management UI
- Ready for Phase 6 (Versioning) which will extend the version display after merge
- Ready for Phase 7 (Traceability) which will build the full FB->CR->Section->Version matrix

## Self-Check: PASSED

All 9 created files verified on disk. Both task commits (0c957e1, 9085f80) verified in git log.

---
*Phase: 05-change-requests*
*Completed: 2026-03-25*
