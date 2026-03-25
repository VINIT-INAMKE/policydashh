---
phase: 08-dashboards-notifications
plan: 03
subsystem: notifications
tags: [trpc, notifications, email, fire-and-forget, resend, date-fns]

# Dependency graph
requires:
  - phase: 08-01
    provides: notification schema, createNotification helper, email service, notification router
  - phase: 08-02
    provides: dashboard page, notification bell component
provides:
  - Notification generation on feedback transitions, CR transitions, version publish, section assignment
  - Fire-and-forget email sends for feedback decisions, version publish, section assignment
  - Full /notifications page with filter tabs and mark-all-read
  - lastVisitedAt tracking on dashboard mount for what-changed queries
affects: [09-public-portal, 10-workshops]

# Tech tracking
tech-stack:
  added: []
  patterns: [fire-and-forget notification pattern, fire-and-forget email pattern, cursor-based pagination with load-more, client component in server page for side effects]

key-files:
  created:
    - app/(workspace)/notifications/page.tsx
    - app/(workspace)/dashboard/_components/last-visit-tracker.tsx
  modified:
    - src/server/routers/feedback.ts
    - src/server/routers/changeRequest.ts
    - src/server/routers/version.ts
    - src/server/routers/sectionAssignment.ts
    - app/(workspace)/dashboard/page.tsx

key-decisions:
  - "React Query v5 removed onSuccess from useQuery -- used useEffect + ref pattern for load-more pagination accumulation"
  - "LastVisitTracker as separate client component file (not inline) for cleaner separation in Server Component dashboard page"
  - "Notification copy uses Unicode left/right double quotation marks for section names per UI-SPEC"

patterns-established:
  - "Fire-and-forget notification: createNotification({...}).catch(console.error) OUTSIDE transaction"
  - "Fire-and-forget email: sendXxxEmail(...).catch(console.error) after notification, skip if no email"
  - "Cursor-based load-more pagination: useEffect accumulates pages into loadedPages array"
  - "Client-side filter tabs: single query, filterNotifications() selects by type/isRead"

requirements-completed: [NOTIF-01, NOTIF-02, NOTIF-03]

# Metrics
duration: 14min
completed: 2026-03-25
---

# Phase 08 Plan 03: Notification Wiring & Full Page Summary

**Fire-and-forget notification + email hooks in 4 mutation routers, full /notifications page with filter tabs and load-more, lastVisitedAt tracking on dashboard mount**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-25T10:01:07Z
- **Completed:** 2026-03-25T10:14:42Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Feedback status transitions (startReview, decide, close) generate in-app notifications to submitter with exact UI-SPEC copy
- Feedback decisions (accept/reject/partial) also send fire-and-forget email via Resend to submitter
- CR transitions (submitForReview, approve, merge) generate in-app notifications to CR owner
- Version publish generates notifications + emails to all users assigned to sections in that policy
- Section assignment generates notification + email to assigned user
- Full /notifications page with All/Unread/Feedback/Versions/CRs filter tabs, mark-all-read, load-more
- Dashboard updates lastVisitedAt on mount for what-changed tracking (NOTIF-03)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire notifications and emails into existing routers** - `b3e498d` (feat)
2. **Task 2: Notifications full page and lastVisitedAt tracking** - `e492904` (feat)

## Files Created/Modified
- `src/server/routers/feedback.ts` - Added createNotification + sendFeedbackReviewedEmail hooks to startReview, decide, close mutations
- `src/server/routers/changeRequest.ts` - Added createNotification hooks to submitForReview, approve, merge mutations
- `src/server/routers/version.ts` - Added createNotification + sendVersionPublishedEmail hooks to publish mutation (notifies all assigned stakeholders)
- `src/server/routers/sectionAssignment.ts` - Added createNotification + sendSectionAssignedEmail hooks to assign mutation
- `app/(workspace)/notifications/page.tsx` - Full notification history page with filter tabs, mark-read, load-more pagination
- `app/(workspace)/dashboard/_components/last-visit-tracker.tsx` - Client component that updates lastVisitedAt on mount
- `app/(workspace)/dashboard/page.tsx` - Added LastVisitTracker import and render

## Decisions Made
- React Query v5 removed onSuccess from useQuery; used useEffect + prevDataRef pattern for load-more page accumulation instead
- LastVisitTracker created as separate file component (not inline) for clean Server Component / Client Component boundary
- Used Unicode quotation marks in notification body strings to match UI-SPEC copy exactly
- Rationale truncation at 80 chars with ellipsis for accepted/rejected notification bodies

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed React Query v5 API incompatibility**
- **Found during:** Task 2 (Notifications page)
- **Issue:** Plan suggested onSuccess callback on useQuery which was removed in React Query v5 (@tanstack/react-query ^5.95.2)
- **Fix:** Replaced with useEffect + useRef pattern to detect new data and accumulate pages for load-more
- **Files modified:** app/(workspace)/notifications/page.tsx
- **Verification:** TypeScript compiles clean, no onSuccess usage
- **Committed in:** e492904 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for React Query v5 compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all notification hooks are wired to real data sources. Email sends gracefully no-op when RESEND_API_KEY is not configured (by design from Plan 01).

## Next Phase Readiness
- Phase 08 (Dashboards & Notifications) is now complete (3/3 plans)
- Notification infrastructure fully wired: events generate notifications and emails
- Ready for Phase 09 (Public Portal)

## Self-Check: PASSED

- FOUND: app/(workspace)/notifications/page.tsx
- FOUND: app/(workspace)/dashboard/_components/last-visit-tracker.tsx
- FOUND: .planning/phases/08-dashboards-notifications/08-03-SUMMARY.md
- FOUND: b3e498d (Task 1 commit)
- FOUND: e492904 (Task 2 commit)

---
*Phase: 08-dashboards-notifications*
*Completed: 2026-03-25*
