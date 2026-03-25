---
phase: 04-feedback-system
plan: 02
subsystem: ui
tags: [react, shadcn, base-ui, select, radio-group, checkbox, sheet, progress, feedback, inbox, filter, outcomes]

# Dependency graph
requires:
  - phase: 04-01
    provides: tRPC feedback router (submit, list, listOwn), feedback DB schema, XState lifecycle
  - phase: 02
    provides: workspace layout, WorkspaceNav, shadcn base-nova design system, policy/section pages
provides:
  - Feedback submission form with full field set (type, priority, impact, title, body, suggested change, anonymity)
  - Feedback inbox page with multi-filter sidebar (section, status, type, priority, impact, org type)
  - Stakeholder outcomes page with summary stats and inline decision log
  - StatusBadge component for 6 feedback statuses with semantic colors
  - FeedbackCard component for inbox list rendering
  - FilterPanel component with checkbox filter groups
  - AnonymityToggle component with Named/Anonymous radio options
  - 5 shadcn UI components (select, radio-group, checkbox, sheet, progress)
  - Feedback semantic CSS variables for status/priority colors
  - Workspace nav Feedback link
affects: [04-03, 05-change-requests, 07-traceability, 08-dashboards]

# Tech tracking
tech-stack:
  added: [select (shadcn/base-ui), radio-group (shadcn/base-ui), checkbox (shadcn/base-ui), sheet (shadcn/base-ui), progress (shadcn/base-ui)]
  patterns: [feedback semantic CSS variables, StatusBadge semantic color mapping, multi-filter client+server pattern, inline accordion decision log]

key-files:
  created:
    - components/ui/select.tsx
    - components/ui/radio-group.tsx
    - components/ui/checkbox.tsx
    - components/ui/sheet.tsx
    - components/ui/progress.tsx
    - app/(workspace)/policies/[id]/feedback/_components/status-badge.tsx
    - app/(workspace)/policies/[id]/feedback/_components/feedback-card.tsx
    - app/(workspace)/policies/[id]/feedback/_components/filter-panel.tsx
    - app/(workspace)/policies/[id]/feedback/_components/feedback-inbox.tsx
    - app/(workspace)/policies/[id]/feedback/page.tsx
    - app/(workspace)/policies/[id]/sections/[sectionId]/feedback/new/_components/submit-feedback-form.tsx
    - app/(workspace)/policies/[id]/sections/[sectionId]/feedback/new/_components/anonymity-toggle.tsx
    - app/(workspace)/policies/[id]/sections/[sectionId]/feedback/new/page.tsx
    - app/(workspace)/feedback/outcomes/_components/outcomes-list.tsx
    - app/(workspace)/feedback/outcomes/page.tsx
  modified:
    - app/globals.css
    - app/(workspace)/_components/workspace-nav.tsx

key-decisions:
  - "Select.Root.Props requires generic type argument in base-ui -- typed as string for feedback select components"
  - "Client-side multi-filter for checkbox groups (server API accepts single value; client filters for multi-select)"
  - "Feedback submission page uses tRPC server caller for section title and user info (RSC data fetching)"
  - "Outcomes page uses inline accordion pattern for decision log (click to expand, no separate page)"

patterns-established:
  - "Feedback semantic CSS variables (--status-accepted-bg, etc.) declared in :root and .dark blocks of globals.css"
  - "StatusBadge component maps FeedbackStatus to Tailwind arbitrary value classes using CSS variables"
  - "FilterPanel with CheckboxFilterGroup helper for multi-select checkbox filter groups"
  - "FeedbackInbox two-column layout with mobile Sheet for filter panel on <768px"

requirements-completed: [FB-01, FB-02, FB-03, FB-04, FB-08, FB-09, FB-10, AUTH-05, AUTH-08]

# Metrics
duration: 15min
completed: 2026-03-25
---

# Phase 04 Plan 02: Feedback UI Pages Summary

**Feedback submission form, Policy Lead inbox with 6-dimension filter panel, and stakeholder outcomes view with inline decision log**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-25T03:41:24Z
- **Completed:** 2026-03-25T03:56:00Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Built complete feedback submission form with type, priority, impact, title, body, suggested change, and anonymity toggle fields, connected to tRPC feedback.submit mutation
- Created Policy Lead feedback inbox with two-column layout (240px filter panel + feedback list), supporting filters across section, status, type, priority, impact, and org type dimensions
- Created stakeholder outcomes page showing summary stats (total, accepted, pending) with inline expandable decision log per feedback item
- Added 5 shadcn base-nova components (select, radio-group, checkbox, sheet, progress) using @base-ui/react primitives
- Added feedback semantic CSS variables for status and priority badge colors
- Updated workspace navigation with Feedback link

## Task Commits

Each task was committed atomically:

1. **Task 1: Install shadcn components, add CSS vars, StatusBadge, submit feedback form and page** - `6e19960` (feat)
2. **Task 2: Create feedback inbox, filter panel, feedback card, outcomes view, workspace nav** - `21ccdf0` (feat)

## Files Created/Modified
- `components/ui/select.tsx` - shadcn Select component using @base-ui/react/select
- `components/ui/radio-group.tsx` - shadcn RadioGroup component using @base-ui/react/radio-group
- `components/ui/checkbox.tsx` - shadcn Checkbox component using @base-ui/react/checkbox
- `components/ui/sheet.tsx` - shadcn Sheet component using @base-ui/react/dialog
- `components/ui/progress.tsx` - shadcn Progress component using @base-ui/react/progress
- `app/globals.css` - Added feedback semantic CSS variables (--status-accepted-bg, etc.)
- `app/(workspace)/policies/[id]/feedback/_components/status-badge.tsx` - StatusBadge with semantic colors for 6 statuses
- `app/(workspace)/policies/[id]/feedback/_components/feedback-card.tsx` - FeedbackCard with badges, body preview, metadata
- `app/(workspace)/policies/[id]/feedback/_components/filter-panel.tsx` - FilterPanel with 6 checkbox filter groups
- `app/(workspace)/policies/[id]/feedback/_components/feedback-inbox.tsx` - FeedbackInbox with two-column layout and mobile sheet
- `app/(workspace)/policies/[id]/feedback/page.tsx` - Server component page for feedback inbox
- `app/(workspace)/policies/[id]/sections/[sectionId]/feedback/new/_components/submit-feedback-form.tsx` - Full feedback submission form
- `app/(workspace)/policies/[id]/sections/[sectionId]/feedback/new/_components/anonymity-toggle.tsx` - Named/Anonymous radio toggle
- `app/(workspace)/policies/[id]/sections/[sectionId]/feedback/new/page.tsx` - Server component page for feedback submission
- `app/(workspace)/feedback/outcomes/_components/outcomes-list.tsx` - Stakeholder outcomes with summary stats and accordion
- `app/(workspace)/feedback/outcomes/page.tsx` - Server component page for stakeholder outcomes
- `app/(workspace)/_components/workspace-nav.tsx` - Added Feedback link to workspace nav

## Decisions Made
- Select.Root.Props requires generic type argument in base-ui; typed as `<string>` for feedback select components
- Client-side multi-filter approach: server API accepts single filter values, client-side JavaScript further filters when multiple checkboxes are selected in a filter group
- Feedback submission page is a server component that fetches section title and user info via tRPC server caller, passing props to the client SubmitFeedbackForm component
- Outcomes page uses inline accordion pattern (click to expand decision log) rather than navigating to a separate detail page

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components are wired to tRPC endpoints with real data sources.

## Next Phase Readiness
- Feedback submission, inbox, and outcomes pages are complete and ready for integration with Plan 03 (triage actions, detail sheet, evidence)
- The FeedbackInbox component exposes a `selectedFeedbackId` state variable that Plan 03's detail sheet will consume
- StatusBadge is reusable across all feedback views (inbox, detail, outcomes)
- FilterPanel is reusable and extensible for additional filter dimensions

## Self-Check: PASSED
- All 16 created files verified present on disk
- Commit 6e19960 (Task 1) verified in git log
- Commit 21ccdf0 (Task 2) verified in git log

---
*Phase: 04-feedback-system*
*Completed: 2026-03-25*
