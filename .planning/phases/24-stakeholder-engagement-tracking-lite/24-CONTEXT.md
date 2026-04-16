# Phase 24: Stakeholder Engagement Tracking (lite) - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Admins have visibility into stakeholder engagement — who is active, who has gone dormant, and how engagement is measured — without building a full CRM. Scoped to: `users.lastActivityAt` middleware, computed engagement score, admin dashboard inactive-users widget, and admin-only stakeholder profile page with attendance history. Anchored to ROADMAP Phase 24 success criteria 1–4 and REQUIREMENTS UX-08, UX-09, UX-10, UX-11.

Out of scope: CRM features, engagement email campaigns, self-service stakeholder profile, activity timeline/audit log per user, weighted scoring, stored/materialized engagement scores.

</domain>

<decisions>
## Implementation Decisions

### Engagement Score Formula
- **D-01:** Simple sum: `engagementScore = feedbackCount + attendedWorkshopCount`. No weights, no tiers — just a transparent integer.
- **D-02:** Computed on-the-fly via SQL subqueries at read time. No stored column, no triggers, no sync complexity. Fine for admin-only queries with small user counts.

### Inactive Users Widget
- **D-03:** Widget lives on the existing AdminDashboard (`app/(workspace)/dashboard/_components/admin-dashboard.tsx`), below the existing stat cards row. Reuse the `StatCard` pattern for the count, with a table below listing inactive users.
- **D-04:** Configurable inactivity window via a dropdown on the widget itself (7d / 14d / 30d / 60d / 90d). Default 30 days. Client-side filter — no server config or env var needed.
- **D-05:** Widget shows ALL users (not just stakeholders). Sortable by name, role, last active, engagement score. Admins need to know if a Policy Lead or Workshop Moderator dropped off too.

### Stakeholder Profile Page
- **D-06:** Admin-only route at `app/(workspace)/users/[id]/page.tsx`. Clicking a name in the inactive widget or users list navigates here.
- **D-07:** Profile shows: user metadata header (name, role, org type, join date, last active, engagement score), workshop attendance history (from `workshopRegistrations` where `attendedAt IS NOT NULL`), and feedback summary (count + recent items with status).

### Activity Tracking
- **D-08:** `users.lastActivityAt` column updated via a new tRPC middleware on EVERY authenticated mutation. Middleware sits after `enforceAuth`, fires-and-forgets the UPDATE after the mutation succeeds. No selective annotation needed — all future mutations are automatically tracked.
- **D-09:** Migration adds `last_activity_at` TIMESTAMPTZ column and backfills to `created_at` for all existing users. No user starts with NULL.

### Claude's Discretion
- Profile page content beyond attendance + feedback (e.g., whether to include org type breakdown, activity sparkline, etc.) — keep it "lite"
- Exact widget table styling and empty states
- Whether to add a link from the users list page to the profile page (likely yes)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema & middleware
- `src/db/schema/users.ts` — Current users table; add `lastActivityAt` column here
- `src/trpc/init.ts` — tRPC middleware chain (`enforceAuth`, `requireRole`, `requirePermission`); add `touchActivity` middleware here
- `src/server/routers/user.ts` — Existing `listUsers` query and `updateLastVisited` pattern; extend with engagement queries

### Dashboard & UI
- `app/(workspace)/dashboard/_components/admin-dashboard.tsx` — Existing admin dashboard with StatCard pattern; add inactive widget here
- `app/(workspace)/dashboard/_components/stat-card.tsx` — Reusable stat card component
- `app/(workspace)/users/page.tsx` — Existing admin users list page; link to new profile page

### Attendance data
- `src/db/schema/workshops.ts` — `workshopRegistrations` table with `attendedAt` field (Phase 20); data source for attendance count in engagement score
- `src/db/schema/feedback.ts` — `feedbackItems` table with `submitterId`; data source for feedback count in engagement score

### Requirements
- `.planning/REQUIREMENTS.md` — UX-08, UX-09, UX-10, UX-11 requirement definitions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StatCard` component: used across all role dashboards for count displays — reuse for inactive user count
- `admin-dashboard.tsx` Promise.all pattern: parallel data fetching for stat cards — extend with engagement queries
- `workshopRegistrations` schema: `attendedAt IS NOT NULL` gives attended workshops per user (via `userId` FK)
- `feedbackItems` schema: `submitterId` gives feedback count per user
- `users.lastVisitedAt` column: already tracks last login; `lastActivityAt` adds mutation-level tracking

### Established Patterns
- tRPC middleware chain: `enforceAuth` → `requireRole`/`requirePermission`. New `touchActivity` middleware slots in after `enforceAuth`
- Admin-only pages: `/users/page.tsx` checks `user.role !== 'admin'` and redirects — same pattern for `/users/[id]`
- Server components with parallel `Promise.all` data fetching (admin-dashboard.tsx pattern)
- Drizzle ORM with `db.select()` and subquery patterns

### Integration Points
- `protectedProcedure` in `src/trpc/init.ts`: compose `touchActivity` middleware so ALL protected mutations auto-touch `lastActivityAt`
- Admin dashboard: add new section after existing stat cards row
- Users list page: add name-click navigation to new `/users/[id]` profile page

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-stakeholder-engagement-tracking-lite*
*Context gathered: 2026-04-16*
