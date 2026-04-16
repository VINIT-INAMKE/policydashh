---
phase: 24-stakeholder-engagement-tracking-lite
plan: 01
subsystem: api
tags: [trpc, drizzle, engagement, middleware, postgresql]

requires:
  - phase: 01-foundation-auth
    provides: users table, protectedProcedure, tRPC init
  - phase: 04-feedback-system
    provides: feedbackItems table with submitterId
  - phase: 10-workshops-evidence
    provides: workshops table

provides:
  - lastActivityAt column on users table with migration and backfill
  - touchActivity middleware composing fire-and-forget mutation tracking
  - listUsersWithEngagement query computing engagement scores via SQL subqueries
  - getUserProfile query returning user metadata, feedback summary, engagement score

affects: [24-02-PLAN, admin-dashboard, stakeholder-engagement-ui]

tech-stack:
  added: []
  patterns: [fire-and-forget middleware, LEFT JOIN subquery for computed scores, COALESCE for nullable aggregates]

key-files:
  created:
    - src/db/migrations/0016_engagement_tracking.sql
  modified:
    - src/db/schema/users.ts
    - src/trpc/init.ts
    - src/server/routers/user.ts

key-decisions:
  - "touchActivity uses fire-and-forget pattern (not awaited, .catch silent) to avoid blocking mutation responses"
  - "Engagement score computed on-the-fly via LEFT JOIN subqueries, no stored column"
  - "Workshop attendance excluded from engagement score (workshopRegistrations table not yet available)"
  - "getUserProfile returns empty attendedWorkshops array pending workshopRegistrations schema"

patterns-established:
  - "Fire-and-forget middleware: db.update().catch(() => {}) pattern for non-critical writes"
  - "SQL subquery-as-derived-table: db.select().from().groupBy().as() for LEFT JOIN aggregation"

requirements-completed: [UX-08, UX-09, UX-10, UX-11]

duration: 5min
completed: 2026-04-16
---

# Phase 24 Plan 01: Engagement Tracking Backend Summary

**lastActivityAt column with fire-and-forget touchActivity middleware and SQL-computed engagement score queries for admin visibility**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-16T14:12:52Z
- **Completed:** 2026-04-16T14:18:15Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Migration 0016 adds last_activity_at column with backfill from created_at and NOT NULL constraint
- touchActivity middleware fires on mutations only, never blocks response, catches errors silently
- listUsersWithEngagement returns all users with computed engagement score via LEFT JOIN feedback subquery
- getUserProfile returns user metadata, recent 20 feedback items, and engagement score for admin profile pages

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration + lastActivityAt column + touchActivity middleware** - `89b2a5a` (feat)
2. **Task 2: listUsersWithEngagement and getUserProfile tRPC queries** - `4284a96` (feat)

## Files Created/Modified
- `src/db/migrations/0016_engagement_tracking.sql` - Migration: ADD COLUMN last_activity_at, backfill from created_at, SET NOT NULL + DEFAULT now()
- `src/db/schema/users.ts` - Added lastActivityAt column definition (notNull, defaultNow)
- `src/trpc/init.ts` - Added touchActivity middleware composing into protectedProcedure (fire-and-forget mutation tracking)
- `src/server/routers/user.ts` - Added listUsersWithEngagement and getUserProfile queries with engagement score computation

## Decisions Made
- touchActivity uses fire-and-forget pattern: db.update() is NOT awaited, .catch() silences errors -- operational noise should never block business responses
- Engagement score computed on-the-fly via LEFT JOIN subqueries rather than stored column -- avoids sync issues and migration complexity
- Workshop attendance excluded from engagement score because workshopRegistrations table does not exist in current schema -- score is feedback-count only for now
- getUserProfile returns empty attendedWorkshops array as a stable API shape that Plan 02 UI can consume without changes when attendance data becomes available

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] workshopRegistrations table does not exist**
- **Found during:** Task 2 (listUsersWithEngagement and getUserProfile queries)
- **Issue:** Plan interfaces listed workshopRegistrations table with attendedAt and userId columns, but the table does not exist in the codebase. The workshops schema only has workshops, workshopArtifacts, workshopSectionLinks, and workshopFeedbackLinks.
- **Fix:** Removed attendanceCounts subquery from listUsersWithEngagement and workshop attendance Promise.all from getUserProfile. Engagement score is feedback-count only. getUserProfile returns empty attendedWorkshops array for API stability.
- **Files modified:** src/server/routers/user.ts
- **Verification:** TypeScript compilation shows no errors in new code (pre-existing ctx.user null errors are out of scope)
- **Committed in:** 4284a96 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Workshop attendance portion of engagement score deferred. Core engagement tracking (lastActivityAt + feedback count) fully functional. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in user.ts (ctx.user possibly null in getMe, updateProfile, invite, updateLastVisited) and other routers (changeRequest.ts, comments.ts) are unrelated to this plan's changes. Out of scope per deviation rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Backend queries ready for Plan 02 admin UI (engagement widget, user profile page)
- listUsersWithEngagement and getUserProfile are available via tRPC for client consumption
- When workshopRegistrations table is added in a future phase, engagement score can be extended by adding attendance LEFT JOIN subquery

## Self-Check: PASSED

- FOUND: src/db/migrations/0016_engagement_tracking.sql
- FOUND: src/db/schema/users.ts
- FOUND: src/trpc/init.ts
- FOUND: src/server/routers/user.ts
- FOUND: .planning/phases/24-stakeholder-engagement-tracking-lite/24-01-SUMMARY.md
- FOUND: commit 89b2a5a (Task 1)
- FOUND: commit 4284a96 (Task 2)

---
*Phase: 24-stakeholder-engagement-tracking-lite*
*Completed: 2026-04-16*
