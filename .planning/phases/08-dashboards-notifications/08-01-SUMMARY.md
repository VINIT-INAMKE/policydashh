---
phase: 08-dashboards-notifications
plan: 01
subsystem: api
tags: [notifications, resend, email, trpc, drizzle, postgres]

# Dependency graph
requires:
  - phase: 01-foundation-auth
    provides: users table, tRPC init, permission matrix, audit log
  - phase: 04-feedback-system
    provides: feedback schema (notification targets)
  - phase: 06-versioning
    provides: version schema (notification targets)
provides:
  - notifications table schema with notifTypeEnum
  - notification tRPC router (list, unreadCount, markRead, markAllRead)
  - createNotification fire-and-forget helper
  - Resend email service (sendFeedbackReviewedEmail, sendVersionPublishedEmail, sendSectionAssignedEmail)
  - last_visited_at column on users for "what changed since last visit"
  - updateLastVisited mutation on user router
  - notification:read and notification:manage permissions for all 7 roles
affects: [08-02-PLAN, 08-03-PLAN, 09-public-portal, 10-workshops]

# Tech tracking
tech-stack:
  added: [resend, "@react-email/components"]
  patterns: [fire-and-forget notification insert, fire-and-forget email send, nullable email guard for phone-first auth]

key-files:
  created:
    - src/db/schema/notifications.ts
    - src/db/migrations/0005_notifications.sql
    - src/lib/notifications.ts
    - src/lib/email.ts
    - src/server/routers/notification.ts
  modified:
    - src/db/schema/users.ts
    - src/db/schema/index.ts
    - src/lib/constants.ts
    - src/lib/permissions.ts
    - src/server/routers/_app.ts
    - src/server/routers/user.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Notification inserts are fire-and-forget (outside transaction boundaries) -- callers use .catch(console.error)"
  - "Email sends are fire-and-forget with graceful no-op when RESEND_API_KEY missing or user email is null"
  - "Plain text emails for now; React Email templates can be enhanced later"
  - "No audit log for markRead/markAllRead or updateLastVisited (operational, not business events)"

patterns-established:
  - "Fire-and-forget notification: createNotification({...}).catch(console.error) -- never await inside mutations"
  - "Email null-email guard: if (!resend || !to) return -- handles phone-only users silently"
  - "Cursor-based pagination for notification list using createdAt of cursor row"

requirements-completed: [NOTIF-01, NOTIF-02, NOTIF-03]

# Metrics
duration: 19min
completed: 2026-03-25
---

# Phase 8 Plan 1: Notification Backend Summary

**Notifications table, tRPC router with cursor pagination, createNotification helper, and Resend email service with phone-first null-email guards**

## Performance

- **Duration:** 19 min
- **Started:** 2026-03-25T09:08:29Z
- **Completed:** 2026-03-25T09:27:30Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Notifications table schema with notifTypeEnum (feedback_status_changed, version_published, section_assigned, cr_status_changed) and partial index on unread notifications
- tRPC notification router with 4 procedures: list (cursor-paginated), unreadCount, markRead, markAllRead -- all permission-gated
- createNotification helper for fire-and-forget inserts from any router mutation
- Resend email service with 3 email templates (feedback reviewed, version published, section assigned) and graceful handling of missing API key and null emails
- last_visited_at column on users table with updateLastVisited mutation for "what changed since last visit" tracking
- notification:read and notification:manage permissions granted to all 7 roles

## Task Commits

Each task was committed atomically:

1. **Task 1: Notification schema, migration, and email dependencies** - `6d8a64d` (feat)
2. **Task 2: Notification router, createNotification helper, and email service** - `d9f5a2c` (feat)

## Files Created/Modified
- `src/db/schema/notifications.ts` - Notifications table schema with notifTypeEnum
- `src/db/migrations/0005_notifications.sql` - Migration: CREATE TABLE notifications + ALTER TABLE users ADD COLUMN last_visited_at
- `src/lib/notifications.ts` - createNotification fire-and-forget helper
- `src/lib/email.ts` - Resend email service with 3 send functions
- `src/server/routers/notification.ts` - tRPC notification router (list, unreadCount, markRead, markAllRead)
- `src/db/schema/users.ts` - Added lastVisitedAt column
- `src/db/schema/index.ts` - Added notifications schema export
- `src/lib/constants.ts` - Added NOTIFICATION_READ and NOTIFICATION_MARK_READ action constants
- `src/lib/permissions.ts` - Added notification:read and notification:manage permissions
- `src/server/routers/_app.ts` - Registered notificationRouter
- `src/server/routers/user.ts` - Added updateLastVisited mutation
- `package.json` - Added resend and @react-email/components dependencies

## Decisions Made
- Notification inserts are fire-and-forget (outside transaction boundaries) -- callers use `.catch(console.error)` not `await`
- Email sends are fire-and-forget with graceful no-op when RESEND_API_KEY is missing or user email is null (phone-first auth)
- Plain text emails for now; React Email templates can be enhanced later with @react-email/components
- No audit log for markRead/markAllRead or updateLastVisited (operational, not business events)
- Cursor-based pagination for notification list using createdAt of cursor notification row

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functions are fully implemented with real Resend SDK calls and Drizzle queries.

## Issues Encountered

None.

## User Setup Required

**Environment variable needed for email delivery:**
- `RESEND_API_KEY` - Resend API key for sending notification emails (optional -- emails silently skip when not set)
- `RESEND_FROM_ADDRESS` - Sender address (defaults to `PolicyDash <onboarding@resend.dev>`)

## Next Phase Readiness
- Notification backend complete: Wave 2 (dashboards) can use createNotification and notification router
- Wave 3 (notification UI + hooks) can build notification panel consuming the tRPC notification.list and notification.unreadCount procedures
- Migration 0005_notifications.sql ready to apply to database

---
*Phase: 08-dashboards-notifications*
*Completed: 2026-03-25*
