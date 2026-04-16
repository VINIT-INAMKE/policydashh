---
phase: 24-stakeholder-engagement-tracking-lite
plan: 02
subsystem: ui
tags: [react, next.js, drizzle, admin-dashboard, engagement, server-component]

requires:
  - phase: 24-stakeholder-engagement-tracking-lite
    plan: 01
    provides: lastActivityAt column, listUsersWithEngagement query, getUserProfile query
  - phase: 08-dashboards-notifications
    provides: admin-dashboard.tsx server component with StatCard grid, Promise.all data fetching
  - phase: 01-foundation-auth
    provides: users table, Clerk auth, admin guard pattern

provides:
  - Inactive users widget on admin dashboard with client-side filtering by inactivity window
  - Sortable table (Name, Last Active, Score) with aria-sort accessibility attributes
  - Engagement score computed via LEFT JOIN feedbackCounts subquery in server component
  - Stakeholder profile page at /users/[id] with user header, workshop attendance, feedback summary
  - Name-to-profile links in users list and inactive widget table

affects: [admin-dashboard, stakeholder-engagement-ui, user-management]

tech-stack:
  added: []
  patterns: [server-component Drizzle subquery for computed scores, client-side sort/filter widget receiving server-fetched data]

key-files:
  created:
    - app/(workspace)/dashboard/_components/inactive-users-widget.tsx
    - app/(workspace)/users/[id]/page.tsx
  modified:
    - app/(workspace)/dashboard/_components/admin-dashboard.tsx
    - app/(workspace)/users/_components/users-client.tsx

key-decisions:
  - "Engagement score query duplicated in admin-dashboard server component (not via tRPC) to keep server component pattern consistent"
  - "Workshop attendance card renders empty state always since workshopRegistrations table does not exist (Plan 01 deviation carried forward)"
  - "Select onValueChange wrapped with null guard for base-ui compatibility (value: string | null)"
  - "Button render={<Link>} pattern used for View Profile (matching existing admin-dashboard pattern, not asChild)"

patterns-established:
  - "Client-side sort/filter widget: server component fetches all data, passes to use-client component that sorts/filters locally"
  - "Admin guard pattern: async auth() + db.query.users.findFirst + role check + redirect, reusable for admin-only routes"

requirements-completed: [UX-09, UX-10, UX-11]

duration: 16min
completed: 2026-04-16
---

# Phase 24 Plan 02: Admin Engagement UI Summary

**Inactive users widget with sortable table and inactivity window dropdown on admin dashboard, plus stakeholder profile page at /users/[id] with engagement score, feedback history, and workshop attendance stub**

## Performance

- **Duration:** 16 min
- **Started:** 2026-04-16T14:27:56Z
- **Completed:** 2026-04-16T14:43:56Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Inactive users widget on admin dashboard with StatCard count, sortable table, and 7d/14d/30d/60d/90d inactivity window dropdown
- Stakeholder profile page at /users/[id] with user header (name, role, org type, dates, engagement score), workshop attendance, and recent feedback
- Users list names now link to profile pages, enabling quick navigation from user management
- Engagement score computed via LEFT JOIN feedbackCounts subquery directly in admin-dashboard server component

## Task Commits

Each task was committed atomically:

1. **Task 1: Inactive users widget on admin dashboard** - `b624e87` (feat)
2. **Task 2: Stakeholder profile page at /users/[id]** - `077038c` (feat)

## Files Created/Modified
- `app/(workspace)/dashboard/_components/inactive-users-widget.tsx` - Client-side interactive widget with sort/filter/dropdown
- `app/(workspace)/users/[id]/page.tsx` - Admin-only stakeholder profile page with parallel Drizzle queries
- `app/(workspace)/dashboard/_components/admin-dashboard.tsx` - Added feedbackCounts subquery and InactiveUsersWidget integration
- `app/(workspace)/users/_components/users-client.tsx` - Added Link import and name-to-profile navigation

## Decisions Made
- Engagement score query added directly to admin-dashboard server component using Drizzle LEFT JOIN subquery (matching existing Promise.all pattern) rather than calling the tRPC listUsersWithEngagement query -- server components don't use tRPC hooks
- Workshop attendance card always shows empty state ("No workshops attended yet.") because workshopRegistrations table does not exist in current schema -- consistent with Plan 01 deviation
- Used `render={<Link>}` pattern for Button-as-Link per existing admin-dashboard pattern (base-nova uses render, not asChild)
- Select onValueChange wrapped with `(v) => v && setWindowDays(v)` to handle base-ui's nullable value type

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Select onValueChange type mismatch**
- **Found during:** Task 1 (inactive-users-widget.tsx)
- **Issue:** TypeScript error: base-ui Select onValueChange receives `(value: string | null, eventDetails)` but `setWindowDays` expects `string`. Plan code used `onValueChange={setWindowDays}` directly.
- **Fix:** Wrapped with null guard: `onValueChange={(v) => v && setWindowDays(v)}`
- **Files modified:** app/(workspace)/dashboard/_components/inactive-users-widget.tsx
- **Verification:** TypeScript compilation passes with no errors in modified files
- **Committed in:** b624e87 (Task 1 commit)

**2. [Rule 3 - Blocking] workshopRegistrations table does not exist**
- **Found during:** Task 2 (stakeholder profile page)
- **Issue:** Plan references workshopRegistrations and workshops.status for attendance history queries, but neither exists in schema. Plan 01 already documented this deviation.
- **Fix:** Workshop attendance set to empty array with typed placeholder. Card renders empty state. Engagement score = feedback count only.
- **Files modified:** app/(workspace)/users/[id]/page.tsx
- **Verification:** TypeScript compilation passes, empty state renders correctly
- **Committed in:** 077038c (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for type safety and schema compatibility. No scope creep. Workshop attendance UI structure is in place and will activate when workshopRegistrations table is added.

## Issues Encountered
- Pre-existing TypeScript errors in changeRequest.ts, comments.ts (ctx.user possibly null) and hocuspocus module imports are out of scope per deviation rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Admin dashboard now shows engagement visibility with inactive users widget
- Stakeholder profiles accessible from both dashboard widget and user management list
- Workshop attendance card ready to wire when workshopRegistrations schema is added
- All UI copy matches UI-SPEC contract (empty states, labels, accessibility attributes)

## Self-Check: PASSED

- FOUND: app/(workspace)/dashboard/_components/inactive-users-widget.tsx
- FOUND: app/(workspace)/dashboard/_components/admin-dashboard.tsx
- FOUND: app/(workspace)/users/_components/users-client.tsx
- FOUND: app/(workspace)/users/[id]/page.tsx
- FOUND: .planning/phases/24-stakeholder-engagement-tracking-lite/24-02-SUMMARY.md
- FOUND: commit b624e87 (Task 1)
- FOUND: commit 077038c (Task 2)

---
*Phase: 24-stakeholder-engagement-tracking-lite*
*Completed: 2026-04-16*
