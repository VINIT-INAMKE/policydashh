---
phase: 08-dashboards-notifications
verified: 2026-03-25T10:45:00Z
status: passed
score: 18/18 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Open /dashboard as each of the 7 roles and confirm correct dashboard renders"
    expected: "Policy Lead sees Feedback Inbox + Active CRs + Section Health; Stakeholder sees Assigned Sections + Pending Feedback + What Changed + Upcoming Workshops placeholder; Admin sees Ready to Publish + User Management; Research Lead sees Claims Without Evidence; Auditor sees Recent Audit Activity + Export Controls; Workshop Moderator sees placeholder state with zero values; Observer sees Published Policies"
    why_human: "Role-switch rendering requires an authenticated session per role — cannot verify programmatically without a running server"
  - test: "Trigger a feedback status change and confirm in-app notification appears in the bell within 10 seconds"
    expected: "Unread badge increments; notification popover shows the new item with correct title/body copy from UI-SPEC"
    why_human: "Requires a running server, real database, and real-time polling behavior"
  - test: "Click 'Mark all as read' in notification bell and confirm badge disappears"
    expected: "Unread badge clears; all items in popover switch to read (bg-transparent, font-normal)"
    why_human: "Interactive mutation behavior requires running app"
  - test: "Visit /dashboard, leave, come back and confirm 'What Changed Since Your Last Visit' shows correct delta"
    expected: "lastVisitedAt is updated on first visit; second visit shows sections changed since that timestamp"
    why_human: "Requires real DB state across two page loads and real timestamp tracking"
---

# Phase 8: Dashboards & Notifications Verification Report

**Phase Goal:** Every role has a tailored dashboard showing relevant content and tasks, and users are notified of important events in-app and via email
**Verified:** 2026-03-25T10:45:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                         | Status     | Evidence                                                                                     |
|----|-----------------------------------------------------------------------------------------------|------------|----------------------------------------------------------------------------------------------|
| 1  | Notifications table exists with all required columns                                          | ✓ VERIFIED | `src/db/schema/notifications.ts` defines all 10 columns with correct types                   |
| 2  | users table has `last_visited_at` column (nullable timestamptz)                               | ✓ VERIFIED | `src/db/schema/users.ts` line 20; `0005_notifications.sql` ALTER TABLE adds it               |
| 3  | Notification tRPC router exposes list, unreadCount, markRead, markAllRead                     | ✓ VERIFIED | `src/server/routers/notification.ts` — all 4 procedures fully implemented with real DB queries |
| 4  | createNotification helper inserts into notifications table                                    | ✓ VERIFIED | `src/lib/notifications.ts` — `db.insert(notifications).values(input)` on line 23             |
| 5  | sendEmail helper calls Resend SDK fire-and-forget                                             | ✓ VERIFIED | `src/lib/email.ts` — 3 exports, all guard `!resend || !to`, call `resend.emails.send()`      |
| 6  | notification:read permission is granted to all 7 roles                                        | ✓ VERIFIED | `src/lib/permissions.ts` lines 53-55 — both `notification:read` and `notification:manage` cover all 7 roles |
| 7  | Authenticated user sees a role-specific dashboard at /dashboard based on their role           | ✓ VERIFIED | `app/(workspace)/dashboard/page.tsx` — switch statement dispatches to 7 role components      |
| 8  | Policy Lead dashboard shows all required widgets                                              | ✓ VERIFIED | `policy-lead-dashboard.tsx` — StatCards, Feedback Inbox, Active CRs, Section Health, What Changed banner |
| 9  | Stakeholder dashboard shows assigned sections, pending feedback, what-changed, workshops stub | ✓ VERIFIED | `stakeholder-dashboard.tsx` — all 4 sections present with "Workshop scheduling is coming soon." |
| 10 | Research Lead dashboard shows claims-without-evidence widget with stat cards                  | ✓ VERIFIED | `research-lead-dashboard.tsx` — DB query via LEFT JOIN on feedbackEvidence, Claims Without Evidence widget |
| 11 | Admin dashboard shows stat row, pending publish, user management with role breakdown          | ✓ VERIFIED | `admin-dashboard.tsx` — 4 StatCards, Ready to Publish, User Management with role counts      |
| 12 | Auditor dashboard shows recent audit activity and export controls                             | ✓ VERIFIED | `auditor-dashboard.tsx` — top 10 audit events, Export Controls card with CSV button          |
| 13 | Workshop Moderator dashboard shows placeholder state for all widgets                          | ✓ VERIFIED | `workshop-moderator-dashboard.tsx` — zero-value StatCards, "Workshop management is coming soon." |
| 14 | Observer dashboard shows published policies widget                                            | ✓ VERIFIED | `observer-dashboard.tsx` — real DB query for published versions, Published Policies widget    |
| 15 | Notification bell visible in workspace header for all authenticated users                     | ✓ VERIFIED | `app/(workspace)/layout.tsx` line 5 + 20-21 — `<NotificationBell />` between WorkspaceNav and UserButton |
| 16 | Feedback status transitions generate in-app notifications                                     | ✓ VERIFIED | `feedback.ts` — startReview, decide, close all call `createNotification().catch(console.error)` |
| 17 | Version publish notifies all assigned stakeholders; section assignment notifies assignee       | ✓ VERIFIED | `version.ts` + `sectionAssignment.ts` — both fire createNotification + email fire-and-forget  |
| 18 | Full /notifications page renders with filter tabs and mark-all-read                           | ✓ VERIFIED | `app/(workspace)/notifications/page.tsx` — 5 filter tabs, mark-all-read, load-more, cursor pagination |

**Score:** 18/18 truths verified

---

### Required Artifacts

| Artifact                                                                | Status     | Details                                                                        |
|-------------------------------------------------------------------------|------------|--------------------------------------------------------------------------------|
| `src/db/schema/notifications.ts`                                        | ✓ VERIFIED | 22 lines; exports `notifTypeEnum` and `notifications` table with all 10 columns |
| `src/db/migrations/0005_notifications.sql`                              | ✓ VERIFIED | 25 lines; CREATE TABLE notifications + CREATE INDEX + ALTER TABLE users         |
| `src/server/routers/notification.ts`                                    | ✓ VERIFIED | 94 lines; exports `notificationRouter` with all 4 procedures, cursor pagination |
| `src/lib/notifications.ts`                                              | ✓ VERIFIED | 32 lines; exports `createNotification`, inserts into DB, documented pattern     |
| `src/lib/email.ts`                                                      | ✓ VERIFIED | 62 lines; exports 3 send functions with null-guard + Resend SDK                 |
| `app/(workspace)/dashboard/page.tsx`                                    | ✓ VERIFIED | 79 lines; switch statement dispatcher, user role lookup, greeting, LastVisitTracker |
| `app/(workspace)/dashboard/_components/stat-card.tsx`                  | ✓ VERIFIED | Reusable component with icon/value/label, min-h-[96px], aria-label              |
| `app/(workspace)/dashboard/_components/policy-lead-dashboard.tsx`      | ✓ VERIFIED | 325 lines; real DB queries (Promise.all), Feedback Inbox, Active CRs, Section Health, What Changed |
| `app/(workspace)/dashboard/_components/stakeholder-dashboard.tsx`      | ✓ VERIFIED | 219 lines; real DB queries, What Changed, Assigned Sections, Pending Feedback, Workshops placeholder |
| `app/(workspace)/dashboard/_components/research-lead-dashboard.tsx`    | ✓ VERIFIED | 154 lines; LEFT JOIN evidence query, Claims Without Evidence, Evidence Overview  |
| `app/(workspace)/dashboard/_components/admin-dashboard.tsx`            | ✓ VERIFIED | 163 lines; real DB queries, Ready to Publish, User Management with role counts  |
| `app/(workspace)/dashboard/_components/auditor-dashboard.tsx`          | ✓ VERIFIED | 111 lines; real audit_events query, Export Controls, Recent Audit Activity      |
| `app/(workspace)/dashboard/_components/workshop-moderator-dashboard.tsx`| ✓ VERIFIED | 45 lines; intentional stub (Phase 10), zero-value StatCards, disabled CTA       |
| `app/(workspace)/dashboard/_components/observer-dashboard.tsx`         | ✓ VERIFIED | 102 lines; real DB query for published versions with deduplication               |
| `app/(workspace)/_components/notification-bell.tsx`                    | ✓ VERIFIED | 238 lines; 'use client', 10s polling, popover, All/Unread tabs, mark-read       |
| `app/(workspace)/dashboard/_components/last-visit-tracker.tsx`         | ✓ VERIFIED | 19 lines; 'use client', useEffect on mount, `trpc.user.updateLastVisited.useMutation()` |
| `app/(workspace)/notifications/page.tsx`                               | ✓ VERIFIED | 249 lines; 'use client', 5 filter tabs, load-more pagination, mark-all-read     |
| `src/server/routers/feedback.ts`                                       | ✓ VERIFIED | createNotification imported and called in startReview, decide, close mutations  |
| `src/server/routers/changeRequest.ts`                                  | ✓ VERIFIED | createNotification imported and called in submitForReview, approve, merge       |
| `src/server/routers/version.ts`                                        | ✓ VERIFIED | createNotification + sendVersionPublishedEmail in publish mutation              |
| `src/server/routers/sectionAssignment.ts`                              | ✓ VERIFIED | createNotification + sendSectionAssignedEmail in assign mutation                |

---

### Key Link Verification

| From                                           | To                                        | Via                            | Status     | Details                                                            |
|------------------------------------------------|-------------------------------------------|--------------------------------|------------|--------------------------------------------------------------------|
| `src/server/routers/notification.ts`           | `src/db/schema/notifications.ts`          | drizzle query                  | ✓ WIRED    | `notifications` imported and used in all 4 procedures              |
| `src/server/routers/_app.ts`                   | `src/server/routers/notification.ts`      | router registration            | ✓ WIRED    | `notificationRouter` imported line 11, registered line 23          |
| `src/lib/email.ts`                             | `resend`                                  | npm package import             | ✓ WIRED    | `import { Resend } from 'resend'` line 1                           |
| `app/(workspace)/dashboard/page.tsx`           | `src/db/schema/users.ts`                  | db.query for user role lookup  | ✓ WIRED    | `db.query.users.findFirst({ where: eq(users.clerkId, clerkId) })`  |
| `app/(workspace)/layout.tsx`                   | `app/(workspace)/_components/notification-bell.tsx` | component import in header | ✓ WIRED | `import { NotificationBell }` line 5, rendered lines 20-21         |
| `src/server/routers/feedback.ts`               | `src/lib/notifications.ts`                | fire-and-forget createNotification | ✓ WIRED | 3 call sites; all use `.catch(console.error)` outside transactions |
| `src/server/routers/feedback.ts`               | `src/lib/email.ts`                        | fire-and-forget email send     | ✓ WIRED    | `sendFeedbackReviewedEmail().catch(console.error)` on decide       |
| `src/server/routers/version.ts`                | `src/lib/notifications.ts`                | fire-and-forget createNotification | ✓ WIRED | Loop over assignedUsers, each `.catch(console.error)`              |

---

### Data-Flow Trace (Level 4)

| Artifact                           | Data Variable           | Source                                          | Produces Real Data | Status      |
|------------------------------------|-------------------------|-------------------------------------------------|--------------------|-------------|
| `policy-lead-dashboard.tsx`        | openFeedbackCount       | `db.select count from feedbackItems WHERE status IN (...)` | Yes | ✓ FLOWING |
| `policy-lead-dashboard.tsx`        | recentFeedback          | `db.select from feedbackItems INNER JOIN policySections LIMIT 5` | Yes | ✓ FLOWING |
| `policy-lead-dashboard.tsx`        | sectionHealthData       | Per-section parallel DB queries with computed health | Yes | ✓ FLOWING |
| `stakeholder-dashboard.tsx`        | assignedSections        | `db.select from sectionAssignments INNER JOIN policySections INNER JOIN policyDocuments WHERE userId` | Yes | ✓ FLOWING |
| `stakeholder-dashboard.tsx`        | changedSections         | Client-side filter on assignedSections using sectionUpdatedAt > lastVisitedAt | Yes | ✓ FLOWING |
| `admin-dashboard.tsx`              | versionsReadyToPublish  | `db.select from documentVersions WHERE isPublished = false` | Yes | ✓ FLOWING |
| `admin-dashboard.tsx`              | usersByRole             | `db.select role, count(*) FROM users GROUP BY role` | Yes | ✓ FLOWING |
| `research-lead-dashboard.tsx`      | feedbackWithoutEvidence | `LEFT JOIN feedbackEvidence WHERE artifactId IS NULL LIMIT 5` | Yes | ✓ FLOWING |
| `auditor-dashboard.tsx`            | recentAuditEvents       | `db.select from auditEvents ORDER BY timestamp DESC LIMIT 10` | Yes | ✓ FLOWING |
| `observer-dashboard.tsx`           | uniquePublishedPolicies | `INNER JOIN documentVersions WHERE isPublished = true`, deduplicated | Yes | ✓ FLOWING |
| `notification-bell.tsx`            | unreadCount             | `trpc.notification.unreadCount.useQuery({ refetchInterval: 10_000 })` → DB COUNT(*) WHERE isRead = false | Yes | ✓ FLOWING |
| `notifications/page.tsx`           | allItems                | `trpc.notification.list.useQuery({ limit: 20, cursor })` → cursor-paginated DB SELECT | Yes | ✓ FLOWING |

---

### Behavioral Spot-Checks

Step 7b: Skipped — the application requires a running Next.js server and database connection. No standalone runnable entry points are testable without a running server. All behavioral verifications routed to human verification above.

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                      | Status       | Evidence                                                                                              |
|-------------|-------------|--------------------------------------------------------------------------------------------------|--------------|-------------------------------------------------------------------------------------------------------|
| UX-01       | 08-02       | Role-aware dashboard: each role sees relevant content, tasks, metrics on login                   | ✓ SATISFIED  | Dashboard page.tsx switch dispatches to 7 role-specific async Server Components                       |
| UX-02       | 08-02       | Policy Lead dashboard: feedback inbox (filterable), active CRs, section health indicators        | ✓ SATISFIED  | `policy-lead-dashboard.tsx` — Feedback Inbox widget, Active CRs widget, Section Health widget with Good/Warning/Critical pills |
| UX-03       | 08-02       | Research Lead dashboard: evidence repository, "claims without evidence", research tasks          | ✓ SATISFIED  | `research-lead-dashboard.tsx` — Claims Without Evidence widget with LEFT JOIN query, Evidence Overview |
| UX-04       | 08-02       | Stakeholder dashboard: assigned sections, pending feedback, upcoming workshops, what changed      | ✓ SATISFIED  | `stakeholder-dashboard.tsx` — all 4 widgets present; workshops explicitly placeholder per plan       |
| UX-05       | 08-02       | Admin dashboard: user management, publish controls, system overview                              | ✓ SATISFIED  | `admin-dashboard.tsx` — User Management with role breakdown, Ready to Publish, stat row               |
| UX-06       | 08-02       | Auditor dashboard: audit trail viewer, export controls                                            | ✓ SATISFIED  | `auditor-dashboard.tsx` — Recent Audit Activity (top 10), Export Controls with CSV button            |
| UX-07       | 08-02       | Workshop Moderator dashboard: workshop management, artifact uploads, section linking              | ✓ SATISFIED  | `workshop-moderator-dashboard.tsx` — intentional Phase 10 stub per research recommendation; placeholder state with disabled CTA |
| NOTIF-01    | 08-01, 08-03| In-app notifications for feedback status changes, version published, section assignment, CR changes | ✓ SATISFIED | All 4 event types hooked in `feedback.ts`, `changeRequest.ts`, `version.ts`, `sectionAssignment.ts` with `createNotification().catch(console.error)` |
| NOTIF-02    | 08-01, 08-03| Email notifications: feedback reviewed, version published, workshop upcoming                      | ✓ SATISFIED  | `email.ts` — 3 send functions with Resend SDK; `workshop upcoming` deferred to Phase 10 (not yet implemented); feedback + version emails wired |
| NOTIF-03    | 08-01, 08-03| "What changed since last visit" indicators on dashboard and section views                        | ✓ SATISFIED  | `lastVisitedAt` column on users, `LastVisitTracker` updates on dashboard mount, both Policy Lead and Stakeholder dashboards show what-changed section |

**Note on UX-07:** The Workshop Moderator dashboard is explicitly a Phase 10 stub. The plan documented this as an intentional placeholder — workshops ship in Phase 10. The requirement description mentions workshop management which requires Phase 10 data. The stub dashboard plus the "coming soon" messaging satisfies the Phase 8 deliverable scope.

**Note on NOTIF-02 (workshop emails):** The requirement lists "workshop upcoming" email. The plan scoped only `sendFeedbackReviewedEmail`, `sendVersionPublishedEmail`, and `sendSectionAssignedEmail` for Phase 8. Workshop upcoming email is a Phase 10 deliverable. The three implemented email types fully cover Phase 8 scope.

---

### Anti-Patterns Found

| File                                                       | Line | Pattern                                     | Severity | Impact                                                                         |
|------------------------------------------------------------|------|---------------------------------------------|----------|--------------------------------------------------------------------------------|
| `auditor-dashboard.tsx`                                    | 57   | `<Button size="sm" disabled>View Full Audit Trail</Button>` | INFO | Intentional: /audit route ships in Phase 9. Documented in SUMMARY Known Stubs. |
| `auditor-dashboard.tsx`                                    | 99   | Export Audit Log (CSV) button with no export logic | INFO | Intentional: compliance export module ships in Phase 9. No data mutation risk.  |
| `workshop-moderator-dashboard.tsx`                         | 29   | `<Button size="sm" disabled>Manage Workshops</Button>` | INFO | Intentional: workshops ship in Phase 10. All zero-value stats, no fake data.   |

No blocker anti-patterns. All stubs are intentional Phase 8 placeholders for Phase 9/10 features, documented in the SUMMARY Known Stubs section. None of them prevent Phase 8's goal from being achieved.

---

### Human Verification Required

#### 1. Role-Specific Dashboard Rendering

**Test:** Sign in as each of the 7 roles and navigate to /dashboard
**Expected:** Each role sees their specific dashboard component with correct layout, widgets, and copy per UI-SPEC
**Why human:** Requires authenticated sessions per role against a running app with real Clerk auth

#### 2. Notification Bell — Real-Time Polling

**Test:** With the app running, trigger a feedback status change (e.g., startReview on a submitted feedback item). Wait up to 10 seconds.
**Expected:** Notification bell badge increments; popover shows the new notification with correct title ("Feedback under review") and body ("Your feedback on...is now being reviewed.")
**Why human:** Requires a running server, real database write, and live polling behavior

#### 3. Notification Mark-All-Read Interaction

**Test:** Open notification bell with unread items. Click "Mark all as read".
**Expected:** Unread badge disappears immediately; all items in the popover switch to read styling (bg-transparent, font-normal)
**Why human:** Interactive mutation + optimistic UI requires running app

#### 4. What Changed Since Last Visit

**Test:** Visit /dashboard (first visit sets lastVisitedAt). Submit new feedback to a section. Return to /dashboard.
**Expected:** "What Changed Since Your Last Visit" section appears on Policy Lead or Stakeholder dashboard showing the changed section(s)
**Why human:** Requires real DB state across two browser sessions and real timestamp tracking

#### 5. Email Delivery (Optional, requires RESEND_API_KEY)

**Test:** Configure RESEND_API_KEY, trigger a feedback decision. Check email inbox.
**Expected:** Email arrives with correct subject line matching UI-SPEC ("Your feedback FB-NNN has been reviewed")
**Why human:** Requires external Resend service configuration and real email delivery

---

### Gaps Summary

No gaps. All 18 must-have truths verified across all three plans. Every artifact exists, is substantive (not a stub for any Phase 8 features), is wired to real data sources, and produces real data. All requirement IDs are satisfied.

The three intentional stubs (audit trail button, CSV export, workshop management) are Phase 9/10 placeholders explicitly designed and documented as such — they are not gaps in Phase 8's goal.

---

_Verified: 2026-03-25T10:45:00Z_
_Verifier: Claude (gsd-verifier)_
