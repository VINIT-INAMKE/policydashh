---
phase: 08-dashboards-notifications
plan: 02
subsystem: ui
tags: [dashboard, role-based, notification-bell, server-components, drizzle, tRPC, lucide-react, date-fns]

# Dependency graph
requires:
  - phase: 01-foundation-auth
    provides: users table, tRPC init, permission matrix, Clerk auth
  - phase: 02
    provides: workspace layout, WorkspaceNav, shadcn components
  - phase: 04-feedback-system
    provides: feedback schema, status badges, priority badges
  - phase: 05-change-requests
    provides: change request schema, CR status badges
  - phase: 06-versioning
    provides: document versions schema, publish flow
  - phase: 08-01
    provides: notification router (list, unreadCount, markRead, markAllRead), notifications table
provides:
  - Role-switch dispatcher dashboard page at /dashboard
  - 7 role-specific dashboard components (Policy Lead, Stakeholder, Admin, Research Lead, Auditor, Workshop Moderator, Observer)
  - Reusable StatCard component
  - NotificationBell client component with unread badge, popover, mark-all-read
  - NotificationBell integrated into workspace header layout
affects: [08-03-PLAN, 09-public-portal, 10-workshops]

# Tech tracking
tech-stack:
  added: []
  patterns: [role-switch dispatcher via switch statement in Server Component, direct DB queries in Server Components for dashboard data, fire-and-forget tRPC polling for notification bell at 10s interval, semantic health indicator pills with oklch colors]

key-files:
  created:
    - app/(workspace)/dashboard/_components/stat-card.tsx
    - app/(workspace)/dashboard/_components/policy-lead-dashboard.tsx
    - app/(workspace)/dashboard/_components/stakeholder-dashboard.tsx
    - app/(workspace)/dashboard/_components/admin-dashboard.tsx
    - app/(workspace)/dashboard/_components/research-lead-dashboard.tsx
    - app/(workspace)/dashboard/_components/auditor-dashboard.tsx
    - app/(workspace)/dashboard/_components/workshop-moderator-dashboard.tsx
    - app/(workspace)/dashboard/_components/observer-dashboard.tsx
    - app/(workspace)/_components/notification-bell.tsx
  modified:
    - app/(workspace)/dashboard/page.tsx
    - app/(workspace)/layout.tsx

key-decisions:
  - "Role-switch via switch statement in async Server Component; each role dashboard is a separate async Server Component doing direct DB queries"
  - "Section health computed per-section with parallel queries; Good/Warning/Critical thresholds per UI-SPEC"
  - "Workshop Moderator dashboard is explicit stub (Phase 10 placeholder) with disabled Manage Workshops button"
  - "Notification bell uses tRPC client hooks with 10-second refetchInterval for unread count polling"
  - "NotificationRow type defined locally in notification-bell.tsx to match tRPC return shape (avoids tRPC inference complexity)"

patterns-established:
  - "Dashboard Server Component pattern: async function with direct db queries, Promise.all for parallel fetching"
  - "StatCard reusable component: Card + icon + value + label with min-h-[96px] and aria-label"
  - "Health indicator pills: bg-[oklch(...)]/20 text-[oklch(...)] pattern for semantic colors"
  - "Notification bell: Popover with tabs, ScrollArea, formatDistanceToNow for timestamps"
  - "Button render prop pattern for Link navigation (render={<Link href=... />})"

requirements-completed: [UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07]

# Metrics
duration: 18min
completed: 2026-03-25
---

# Phase 8 Plan 2: Role Dashboards & Notification Bell Summary

**7 role-specific dashboards with direct DB queries, reusable StatCard, section health indicators, and NotificationBell with 10s polling in workspace header**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-25T09:35:59Z
- **Completed:** 2026-03-25T09:53:34Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Role-switch dispatcher on /dashboard that renders role-specific dashboard based on user.role (7 roles + observer default)
- Policy Lead dashboard with stat cards (open feedback, active CRs, policies, published versions), feedback inbox widget, active CRs widget, section health widget with Good/Warning/Critical pills
- Stakeholder dashboard with what-changed-since-last-visit section, assigned sections widget, pending feedback widget, upcoming workshops placeholder
- Admin dashboard with stat row, ready-to-publish versions widget, user management widget with role breakdown
- Research Lead dashboard with claims-without-evidence widget, evidence overview stats
- Auditor dashboard with recent audit activity (10 events), export controls, CSV export button
- Workshop Moderator stub dashboard with all-zero stat cards and disabled Manage Workshops button
- Observer dashboard with published policies list and open consultations count
- NotificationBell client component with unread count badge (10s polling), popover with All/Unread tabs, mark-all-read, item click-through navigation
- NotificationBell integrated into workspace header between WorkspaceNav and UserButton

## Task Commits

Each task was committed atomically:

1. **Task 1: Dashboard page with role-switch, stat card, and 4 dashboards** - `f3a5fb1` (feat)
2. **Task 2: Remaining dashboards and notification bell** - `79956f0` (feat)

## Files Created/Modified
- `app/(workspace)/dashboard/page.tsx` - Role-switch dispatcher Server Component with greeting and role badge
- `app/(workspace)/dashboard/_components/stat-card.tsx` - Reusable stat card (icon, value, label, min-h-96px)
- `app/(workspace)/dashboard/_components/policy-lead-dashboard.tsx` - Feedback inbox, active CRs, section health
- `app/(workspace)/dashboard/_components/stakeholder-dashboard.tsx` - Assigned sections, pending feedback, what-changed, workshops placeholder
- `app/(workspace)/dashboard/_components/admin-dashboard.tsx` - Ready-to-publish, user management with role breakdown
- `app/(workspace)/dashboard/_components/research-lead-dashboard.tsx` - Claims without evidence, evidence overview
- `app/(workspace)/dashboard/_components/auditor-dashboard.tsx` - Audit activity, export controls
- `app/(workspace)/dashboard/_components/workshop-moderator-dashboard.tsx` - Phase 10 stub with disabled CTA
- `app/(workspace)/dashboard/_components/observer-dashboard.tsx` - Published policies, open consultations
- `app/(workspace)/_components/notification-bell.tsx` - Client component with bell icon, unread badge, popover dropdown
- `app/(workspace)/layout.tsx` - Added NotificationBell import and placement in header

## Decisions Made
- Role-switch via switch statement in async Server Component; each role dashboard is a separate async Server Component doing direct DB queries (not tRPC hooks -- Server Components fetch directly)
- Section health computed per-section with parallel queries; Good/Warning/Critical thresholds per UI-SPEC (0/1-3/4+ open feedback, high-priority, approved CR unpublished >7 days)
- Workshop Moderator dashboard is explicit stub (workshops ship Phase 10) with disabled Manage Workshops button
- Notification bell uses tRPC client hooks with 10-second refetchInterval for unread count polling; notification list only fetched when popover opens
- NotificationRow type defined locally to match tRPC return shape, cast from query result to avoid complex tRPC type inference issues
- Auditor "View Full Audit Trail" button rendered as disabled (Phase 9 route does not exist yet)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

- **Workshop Moderator dashboard** (`app/(workspace)/dashboard/_components/workshop-moderator-dashboard.tsx`): All widgets show placeholder/empty states with zero values. Workshops ship in Phase 10.
- **Auditor "View Full Audit Trail" button**: Disabled because /audit route ships in Phase 9.
- **Auditor "Export Audit Log (CSV)" button**: Present but no export logic wired (Phase 9 compliance module).

All stubs are intentional Phase 8 placeholders documented in the plan and will be resolved in their respective future phases.

## Issues Encountered

None.

## Next Phase Readiness
- All 7 role dashboards complete and rendering at /dashboard
- Notification bell visible in workspace header for all authenticated users
- Wave 3 (08-03-PLAN: notifications page + hooks) can build on the notification bell infrastructure
- Phase 9 (Public Portal) can wire audit trail page
- Phase 10 (Workshops) can populate the Workshop Moderator dashboard

---
*Phase: 08-dashboards-notifications*
*Completed: 2026-03-25*
