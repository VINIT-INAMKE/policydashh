# Phase 8: Dashboards & Notifications - Research

**Researched:** 2026-03-25
**Domain:** Role-aware dashboard views, in-app notification infrastructure, email notifications, "what changed" tracking
**Confidence:** HIGH (core patterns) / MEDIUM (Resend email integration — not yet installed)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None explicitly locked — discuss phase was skipped.

### Claude's Discretion
All implementation choices are at Claude's discretion.

Key constraints from prior phases:
- 7 roles with defined permissions (Phase 1)
- All data entities exist: policies, sections, feedback, CRs, versions, evidence, workshops (Phases 2-7)
- tRPC with role-based permission checks (Phase 1)
- Clerk auth provider handles user sessions (Phase 1)

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | Role-aware dashboard: each role sees relevant content, tasks, metrics on login | Role switch pattern via `ctx.user.role`; single `/dashboard` route with role-conditional rendering |
| UX-02 | Policy Lead dashboard: feedback inbox (filterable), active CRs, section health indicators | Reuse `feedback.list` + `changeRequest.list` tRPC queries with status filters; section health = count of open feedback per section |
| UX-03 | Research Lead dashboard: evidence repository, "claims without evidence", research tasks | Query `evidence_artifacts` joined to `feedback_evidence`; LEFT JOIN to find feedback with no evidence |
| UX-04 | Stakeholder dashboard: assigned sections, pending feedback requests, upcoming workshops, "what changed since last visit" | `sectionAssignments` table; `feedback.listOwn`; `last_visited_at` column on `users` table |
| UX-05 | Admin dashboard: user management, publish controls, system overview | `user.listUsers` tRPC; pending publish = `documentVersions` where `is_published = false` |
| UX-06 | Auditor dashboard: audit trail viewer, export controls | Reuses `audit.list` tRPC from Phase 1 |
| UX-07 | Workshop Moderator dashboard: workshop management, artifact uploads, section linking | Workshop entity does not yet exist (Phase 10); stub with placeholder for now |
| NOTIF-01 | In-app notifications for: feedback status changes, new version published, section assignment, CR status changes | New `notifications` DB table + `notification.list` / `notification.markRead` tRPC router |
| NOTIF-02 | Email notifications for key events: feedback reviewed, version published, workshop upcoming | Resend SDK (not yet installed); `lib/email.ts` service wrapper; fire-and-forget from tRPC mutations |
| NOTIF-03 | "What changed since last visit" indicators on dashboard and section views | `last_visited_at` column added to `users` table; compare against entity `updated_at` / `created_at` |
</phase_requirements>

---

## Summary

Phase 8 is a data assembly and UI composition phase. Every query it needs already has a router and schema backing it — the work is choosing what to surface per role and wiring it to dashboard pages. The only net-new backend infrastructure is:

1. A `notifications` table + tRPC notification router for in-app notifications (NOTIF-01).
2. A `last_visited_at` column on `users` for "what changed" tracking (NOTIF-03).
3. Resend SDK integration for outbound email (NOTIF-02) — the package is not yet in `package.json`.

Dashboard pages are Server Components that call existing tRPC routers, display aggregated counts, and link into the deep feature pages already built. Because all seven roles share `/dashboard`, the implementation pattern is: read `ctx.user.role` in the page, then render the matching role-specific React component. No new routes are needed beyond `/dashboard`.

The notification bell is a client component with a Zustand store for unread count, backed by a polling `trpc.notification.list` query (TanStack Query `refetchInterval`). Real-time push via SSE/WebSocket is out of scope for Phase 8.

**Primary recommendation:** Build notifications as a DB-first polling system. Add `last_visited_at` to `users` with a single migration. Wire Resend through a thin `lib/email.ts` service that is called fire-and-forget from tRPC mutations that already exist (feedback.decide, version publish, sectionAssignment). Dashboard pages are pure data composition — no new DB queries beyond what already exists.

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md contains `@AGENTS.md`, which states:

> This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Actionable directives for this phase:
- Read `node_modules/next/dist/docs/01-app/` guides before writing new page/layout files.
- No assumptions about Next.js APIs from training data — verify against local docs.
- No `pages/` directory usage — App Router only (confirmed by existing codebase structure).
- Server Components are default; add `'use client'` only where needed (existing pattern in workspace-nav.tsx, feedback-inbox.tsx, etc.).

---

## Standard Stack

### Core (already installed — verified in package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.1 | App Router, Server Components for dashboard pages | Installed, confirmed |
| tRPC v11 | `@trpc/server` 11.15.0 | New `notification` router follows existing patterns | Installed, confirmed |
| Drizzle ORM | 0.45.1 | Schema for `notifications` table + Drizzle query for unread count | Installed, confirmed |
| TanStack Query | 5.95.x | `refetchInterval` for notification polling on client | Installed, confirmed |
| Zustand | via existing stores | Unread notification count in global UI state | Installed (xstate+react in package.json, Zustand confirmed in STACK.md) |
| Sonner | 2.0.7 | Toast when notification arrives | Installed, confirmed |
| date-fns | 4.1.0 | Format `last_visited_at` / notification timestamps | Installed, confirmed |
| Clerk | 7.0.6 | `auth()` → `userId` → `users.clerkId` lookup for `ctx.user.role` | Installed, confirmed |

### New (must install)

| Library | Version | Purpose | Install Command |
|---------|---------|---------|-----------------|
| resend | 4.x (latest ~4.x as of search; npm confirms 6.9.4) | Transactional email API | `npm install resend` |
| @react-email/components | latest | React Email template primitives | `npm install @react-email/components` |

**Version note:** npm search result indicates resend@6.9.4 as of March 2026. Confirm with `npm view resend version` before writing install docs. The Resend Node.js SDK v4+ uses `new Resend(apiKey)` + `resend.emails.send({...})`.

**Installation:**
```bash
npm install resend @react-email/components
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Resend | Nodemailer | Resend has React Email native integration, developer-friendly API, no SMTP config. Already recommended in STACK.md. |
| Polling (TanStack Query refetchInterval) | SSE / WebSockets | Polling is simpler, no infrastructure changes, adequate for notification freshness (5-10s interval). SSE appropriate only after Phase 11 real-time work. |
| Single `/dashboard` with role switch | Per-role route e.g. `/dashboard/stakeholder` | Single route avoids auth routing complexity. Role switch in one Server Component is easier to test. |

---

## Architecture Patterns

### Recommended Project Structure

New files this phase adds to the existing structure:

```
src/
├── db/
│   ├── schema/
│   │   └── notifications.ts          # NEW: notifications table schema
│   └── migrations/
│       └── 0005_notifications.sql    # NEW: migration for notifications + last_visited_at
├── server/
│   └── routers/
│       ├── notification.ts           # NEW: tRPC notification router
│       └── _app.ts                   # EXTEND: add notificationRouter
├── lib/
│   └── email.ts                      # NEW: Resend email service wrapper
└── __tests__/
    └── notifications.test.ts         # NEW: unit tests for notification logic

app/(workspace)/
└── dashboard/
    ├── page.tsx                       # REPLACE stub with role-switch dispatcher
    └── _components/
        ├── policy-lead-dashboard.tsx  # NEW: UX-02
        ├── research-lead-dashboard.tsx # NEW: UX-03
        ├── stakeholder-dashboard.tsx  # NEW: UX-04
        ├── admin-dashboard.tsx        # NEW: UX-05
        ├── auditor-dashboard.tsx      # NEW: UX-06
        ├── workshop-moderator-dashboard.tsx # NEW: UX-07
        ├── observer-dashboard.tsx     # NEW: generic read-only view
        └── notification-bell.tsx      # NEW: NOTIF-01 bell UI (client component)

components/
└── emails/
    ├── feedback-reviewed.tsx          # NEW: NOTIF-02 email template
    └── version-published.tsx          # NEW: NOTIF-02 email template
```

### Pattern 1: Role-Switch Dashboard Dispatcher (Server Component)

**What:** The `/dashboard` page.tsx reads `ctx.user.role` from Clerk and renders the matching role component. All role components are Server Components that await their own data fetches.

**When to use:** Single route, multiple role views. Avoids URL-based role routing which would require middleware guards per path.

**Example:**
```typescript
// app/(workspace)/dashboard/page.tsx
import { auth } from '@clerk/nextjs/server'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { eq } from 'drizzle-orm'
import { PolicyLeadDashboard } from './_components/policy-lead-dashboard'
import { StakeholderDashboard } from './_components/stakeholder-dashboard'
// ... other role imports

export default async function DashboardPage() {
  const { userId } = await auth()
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId!),
  })

  switch (user?.role) {
    case 'policy_lead':  return <PolicyLeadDashboard userId={user.id} />
    case 'stakeholder':  return <StakeholderDashboard userId={user.id} />
    case 'admin':        return <AdminDashboard userId={user.id} />
    case 'auditor':      return <AuditorDashboard userId={user.id} />
    case 'research_lead': return <ResearchLeadDashboard userId={user.id} />
    case 'workshop_moderator': return <WorkshopModeratorDashboard userId={user.id} />
    default:             return <ObserverDashboard userId={user.id} />
  }
}
```

### Pattern 2: Notification Table Schema

**What:** A `notifications` table tracks in-app events per user. Notification records are inserted by tRPC mutations that already fire audit logs (feedback.decide, cr transitions, version publish, sectionAssignment).

**Schema design:**
```typescript
// src/db/schema/notifications.ts
import { pgTable, uuid, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users'

export const notifTypeEnum = pgEnum('notification_type', [
  'feedback_status_changed',
  'version_published',
  'section_assigned',
  'cr_status_changed',
])

export const notifications = pgTable('notifications', {
  id:          uuid('id').primaryKey().defaultRandom(),
  userId:      uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:        notifTypeEnum('type').notNull(),
  title:       text('title').notNull(),
  body:        text('body'),
  entityType:  text('entity_type'),            // e.g. 'feedback', 'cr', 'version'
  entityId:    uuid('entity_id'),              // linked record UUID
  linkHref:    text('link_href'),              // deep link for click-through
  isRead:      boolean('is_read').notNull().default(false),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

**Migration (0005_notifications.sql):**
```sql
-- Notifications table
CREATE TYPE notification_type AS ENUM (
  'feedback_status_changed',
  'version_published',
  'section_assigned',
  'cr_status_changed'
);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  entity_type TEXT,
  entity_id   UUID,
  link_href   TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read)
  WHERE is_read = false;

-- "What changed since last visit" — add last_visited_at to users
ALTER TABLE users ADD COLUMN last_visited_at TIMESTAMPTZ;
```

### Pattern 3: Notification Router (tRPC)

**What:** A `notificationRouter` with `list`, `markRead`, and `markAllRead` procedures. A helper `createNotification()` utility is called from existing routers.

**Example:**
```typescript
// src/server/routers/notification.ts
export const notificationRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      return db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, ctx.user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(input.limit)
    }),

  unreadCount: protectedProcedure
    .query(async ({ ctx }) => {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(
          eq(notifications.userId, ctx.user.id),
          eq(notifications.isRead, false),
        ))
      return result?.count ?? 0
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(
          eq(notifications.id, input.id),
          eq(notifications.userId, ctx.user.id),
        ))
    }),

  markAllRead: protectedProcedure
    .mutation(async ({ ctx }) => {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, ctx.user.id))
    }),
})
```

**Helper to call from other routers:**
```typescript
// src/lib/notifications.ts
export async function createNotification(input: {
  userId: string
  type: 'feedback_status_changed' | 'version_published' | 'section_assigned' | 'cr_status_changed'
  title: string
  body?: string
  entityType?: string
  entityId?: string
  linkHref?: string
}) {
  await db.insert(notifications).values(input)
}
```

### Pattern 4: Notification Bell (Client Component)

**What:** A client component in the workspace header that polls `notification.unreadCount` every 10 seconds and opens a dropdown with `notification.list`.

**When to use:** Add to `workspace-nav.tsx` or the header in `(workspace)/layout.tsx`.

**Example:**
```typescript
// app/(workspace)/_components/notification-bell.tsx
'use client'

import { trpc } from '@/src/trpc/client'
import { Bell } from 'lucide-react'

export function NotificationBell() {
  const { data: count } = trpc.notification.unreadCount.useQuery(undefined, {
    refetchInterval: 10_000,
  })
  // Render Bell icon with badge count
  // On click: open dropdown with notification.list items
}
```

### Pattern 5: Resend Email Service

**What:** A thin `lib/email.ts` wrapper around the Resend SDK. Called fire-and-forget from tRPC mutations (do not await inside mutations to avoid latency impact).

**Example:**
```typescript
// src/lib/email.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendFeedbackReviewedEmail(to: string, data: {
  feedbackReadableId: string
  decision: string
  rationale: string
}) {
  const { FeedbackReviewedEmail } = await import('@/components/emails/feedback-reviewed')
  await resend.emails.send({
    from: 'PolicyDash <notifications@yourdomain.com>',
    to,
    subject: `Your feedback ${data.feedbackReadableId} has been reviewed`,
    react: FeedbackReviewedEmail(data),
  })
}
```

**Calling from tRPC mutation (fire-and-forget):**
```typescript
// Inside feedback.decide mutation, after existing logic:
// Fire-and-forget — don't await, email failure must not fail the mutation
sendFeedbackReviewedEmail(submitterEmail, { ... }).catch(console.error)
```

### Pattern 6: "What Changed Since Last Visit"

**What:** Store `last_visited_at` per user on `users` table (added in migration 0005). Update it via a `updateLastVisited` tRPC mutation called on dashboard mount. Compare against `feedback.updatedAt`, `documentVersions.publishedAt`, etc.

**Update on dashboard load:**
```typescript
// src/server/routers/user.ts — add new mutation
updateLastVisited: protectedProcedure
  .mutation(async ({ ctx }) => {
    await db
      .update(users)
      .set({ lastVisitedAt: new Date() })
      .where(eq(users.id, ctx.user.id))
  }),
```

**"New since last visit" badge logic:**
```typescript
// In stakeholder dashboard component
const newSections = assignedSections.filter(s =>
  user.lastVisitedAt === null || s.updatedAt > user.lastVisitedAt
)
```

### Anti-Patterns to Avoid

- **Awaiting email sends inside tRPC mutations:** Resend calls can take 200-500ms. Call `.catch(console.error)` and do not `await` — email failure must not block the mutation response.
- **Real-time WebSocket for notifications:** Out of scope for Phase 8. Polling at 10s interval is sufficient for the async nature of policy consultation workflows.
- **Separate routes per role (e.g. `/dashboard/admin`):** Requires middleware guards and duplicates the workspace layout. Single `/dashboard` with role switch is simpler and easier to test.
- **Storing notification payload as raw JSONB:** Use an enum for `type` + structured `title` / `body` / `linkHref` columns instead of opaque JSON — makes client rendering trivial and avoids type casting.
- **Creating notifications inside the same DB transaction as the triggering mutation:** Notification writes can be best-effort; wrapping them in the same transaction means a notification table insert failure rolls back the business operation. Insert notifications after the primary transaction commits.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email sending | Custom SMTP client | Resend SDK (`resend.emails.send`) | Handles deliverability, DKIM, SPF, retry logic |
| Email templates | Raw HTML strings | `@react-email/components` | Type-safe, JSX-based, renders correctly across email clients |
| Role-based query filtering | Manual if/else per endpoint | Existing `requirePermission()` middleware in `trpc/init.ts` | Already guards every router; dashboard queries just reuse existing protected procedures |
| Unread count | Custom SQL aggregate with no index | Index `idx_notifications_user_unread` on `(user_id, is_read) WHERE is_read = false` | Partial index keeps unread count queries sub-millisecond even at scale |
| "What changed" diff computation | Storing snapshots and computing diffs | `last_visited_at` timestamp comparison against entity `updatedAt` | Simple, cheap, no storage overhead. Full diffs exist in Phase 6 version history. |

**Key insight:** This phase assembles data that already exists. The only genuine new infrastructure is the `notifications` table and the Resend integration. Everything else is query composition.

---

## Common Pitfalls

### Pitfall 1: `users` table does not have `last_visited_at` — migration required

**What goes wrong:** Dashboard page tries to read `user.lastVisitedAt` but the column doesn't exist yet.
**Why it happens:** `users.ts` schema was defined in Phase 1 before this requirement existed.
**How to avoid:** Migration 0005 must ALTER TABLE users to add the column. Drizzle schema file must be updated to include `lastVisitedAt: timestamp('last_visited_at', { withTimezone: true })` (nullable, no default).
**Warning signs:** TypeScript error on `user.lastVisitedAt` access before migration runs.

### Pitfall 2: `notifications` inserts within a Drizzle transaction can fail silently

**What goes wrong:** Notification insert is wrapped in the same transaction as the business mutation. If the notifications table has a constraint violation, the entire transaction rolls back — the user's feedback decision is lost.
**Why it happens:** Copy-paste of the `db.transaction()` pattern from `mergeCR`.
**How to avoid:** Insert notifications outside the transaction boundary, after `.returning()` confirms the primary operation succeeded. Use fire-and-forget pattern.
**Warning signs:** Mutations that previously worked start rolling back with cryptic errors.

### Pitfall 3: Resend `from` address requires a verified domain

**What goes wrong:** Email sends to `from: 'notifications@yourdomain.com'` fail with a 422 error if the domain is not verified in the Resend dashboard.
**Why it happens:** Resend requires domain ownership verification before sending from custom addresses.
**How to avoid:** Use Resend's test address `onboarding@resend.dev` during development. Document the domain verification requirement for production. Add `RESEND_FROM_ADDRESS` to `.env.example`.
**Warning signs:** `resend.emails.send` returns a 422 error in development.

### Pitfall 4: Base-ui Dialog vs. Dropdown for notification bell

**What goes wrong:** Using a Dialog (modal) for the notification panel, which blocks page interaction.
**Why it happens:** Dialog is the most prominent primitive in the codebase.
**How to avoid:** Use Base-ui `Popover` (or a custom dropdown built on `@base-ui/react` Popup) for the bell panel. The workspace-nav already uses client components — the bell is the same pattern. Phase 2 STATE.md notes: "shadcn base-nova style uses @base-ui/react (not Radix) as default primitives."
**Warning signs:** Notification bell opens a full-screen overlay.

### Pitfall 5: Observer and Workshop Moderator roles have limited data

**What goes wrong:** Observer dashboard shows empty state because Observer has only `feedback:read_own` and `version:read` permissions. Workshop Moderator dashboard requires workshops which don't exist until Phase 10.
**Why it happens:** Observer is a read-only audit role; workshop entity ships in Phase 10.
**How to avoid:** Observer dashboard: show recent published versions and assigned sections (read-only). Workshop Moderator: stub with "Workshops coming soon" placeholder — the requirement (UX-07) is to build the dashboard shell now; the data source ships later.
**Warning signs:** tRPC FORBIDDEN errors when Observer dashboard tries to call `feedback:read_all`.

### Pitfall 6: Dashboard Server Components calling tRPC directly vs. via `createCallerFactory`

**What goes wrong:** Server Components cannot use the React client hooks (`trpc.xxx.useQuery`). Using them causes "cannot call hooks outside React component" errors.
**Why it happens:** Dashboard pages are Server Components; tRPC client hooks are client-side.
**How to avoid:** Use `createCallerFactory` from `trpc/init.ts` for server-side data fetching in page.tsx, or query the DB directly via Drizzle (which is simpler for dashboard aggregates). Existing pattern in codebase: Server Components use `db.query.*` directly and pass data as props to Client Components. Follow that pattern.
**Warning signs:** "React hooks can only be called inside a function component" errors during build.

---

## Code Examples

Verified patterns from codebase:

### DB direct query in Server Component (established pattern from Phase 2+)
```typescript
// Source: app/(workspace)/policies/page.tsx pattern
// Server Component fetches directly from DB, no tRPC hooks
import { db } from '@/src/db'
import { feedbackItems } from '@/src/db/schema/feedback'
import { changeRequests } from '@/src/db/schema/changeRequests'
import { eq, and, count } from 'drizzle-orm'

// In PolicyLeadDashboard (server component):
const [pendingFeedback, activeCRs] = await Promise.all([
  db.select({ count: count() }).from(feedbackItems)
    .where(and(eq(feedbackItems.documentId, docId), eq(feedbackItems.status, 'submitted'))),
  db.select({ count: count() }).from(changeRequests)
    .where(and(eq(changeRequests.documentId, docId), eq(changeRequests.status, 'in_review'))),
])
```

### requirePermission pattern (Phase 1 — reuse in notification router)
```typescript
// Source: src/trpc/init.ts
export const requirePermission = (permission: Permission) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!can(ctx.user.role as Role, permission)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: `Missing permission: ${permission}` })
    }
    return next({ ctx })
  })
```

### writeAuditLog pattern (every mutation uses this — notification inserts do NOT need it)
```typescript
// Source: src/lib/audit.ts — notifications are operational, not auditable events
// Do NOT write audit log entries for notification reads/marks
// Audit log is for business events (feedback decisions, CR merges, publishes)
```

### tRPC client polling (TanStack Query refetchInterval)
```typescript
// Established pattern in Phase 4/5 components using useQuery
// For notification bell:
const { data: count } = trpc.notification.unreadCount.useQuery(undefined, {
  refetchInterval: 10_000,  // 10 second poll — appropriate for async policy workflows
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-role routes (`/dashboard/admin`) | Single route with role switch | Phase 8 new | Simpler nav, one page to maintain |
| Custom HTML email templates (string literals) | React Email components (`@react-email/components`) | ~2023, stable 2025 | Type-safe, JSX-based email templates |
| WebSocket push for notifications | DB polling with TanStack Query `refetchInterval` | N/A — Phase 8 design choice | No infra overhead; real-time deferred to Phase 11 |

**Deprecated/outdated:**
- `nodemailer` with SMTP: Replaced by Resend for developer-facing applications. No SMTP config needed.
- `getServerSideProps`: This codebase uses App Router Server Components exclusively — no Pages Router patterns.

---

## Open Questions

1. **Does `users` table need `email` for Resend?**
   - What we know: `users.email` column exists in the schema (nullable). Phone-first auth means many users may have `null` email.
   - What's unclear: Which users will have emails populated for Resend to send to?
   - Recommendation: Send email only when `user.email` is non-null. Log skipped sends. For Phase 8, this means some stakeholders on phone-only auth will not receive email notifications — acceptable for MVP. Document as known limitation.

2. **Should `notification.list` be paginated or capped?**
   - What we know: TanStack Query pagination exists in the stack (Phase 7 traceability uses it). For MVP a cap of 20-50 recent notifications is fine.
   - Recommendation: Add `limit` input to `notification.list` (default 20, max 50). No cursor pagination needed in Phase 8.

3. **UX-07 Workshop Moderator dashboard — stub or skip?**
   - What we know: Workshop entities don't exist until Phase 10. The requirement says "workshop management" but no data exists.
   - Recommendation: Build the dashboard shell with hardcoded placeholder content ("No workshops yet — create your first workshop") and a disabled "Create Workshop" button. The shell satisfies UX-07 without depending on Phase 10 data.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|---------|
| Resend SDK | NOTIF-02 email sends | Not installed | — | Add to package.json in Wave 0 |
| @react-email/components | NOTIF-02 email templates | Not installed | — | Add to package.json in Wave 0 |
| PostgreSQL / Neon | Notifications table, last_visited_at migration | Available via existing `db` connection | Neon serverless | — |
| Drizzle Kit | Migration 0005 | Available | 0.31.10 | — |

**Missing dependencies with no fallback:**
- `resend` and `@react-email/components` must be installed before Wave 2 (email notifications). Wave 0 or Wave 1 task should install them.

**Missing dependencies with fallback:**
- None beyond the above.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.mts` (root) |
| Quick run command | `npm run test -- --reporter=verbose src/__tests__/notifications.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-01 | `createNotification()` inserts correct row with type/title/body/linkHref | unit | `npm run test -- src/__tests__/notifications.test.ts` | No — Wave 0 |
| NOTIF-01 | `notification.markRead` sets `is_read = true` only for owning user | unit | `npm run test -- src/__tests__/notifications.test.ts` | No — Wave 0 |
| NOTIF-03 | `updateLastVisited` mutation sets `last_visited_at` on users table | unit | `npm run test -- src/__tests__/notifications.test.ts` | No — Wave 0 |
| UX-01 (permissions) | Each role permission boundary: admin can `user:list`, stakeholder cannot | unit | `npm run test -- src/__tests__/permissions.test.ts` | Yes (existing) |
| NOTIF-02 | `sendFeedbackReviewedEmail` calls Resend with correct params (mock) | unit | `npm run test -- src/__tests__/notifications.test.ts` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- src/__tests__/notifications.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/notifications.test.ts` — covers NOTIF-01, NOTIF-03, NOTIF-02 (Resend mock)
- [ ] Resend mock: `vi.mock('resend', () => ({ Resend: vi.fn(() => ({ emails: { send: vi.fn().mockResolvedValue({ id: 'test' }) } })) }))`

---

## Sources

### Primary (HIGH confidence)
- Project codebase — `src/db/schema/`, `src/server/routers/`, `src/trpc/init.ts` — read directly; patterns verified
- `package.json` — confirmed installed packages and versions
- `src/lib/permissions.ts` — confirmed 7 roles and permission matrix
- `src/db/schema/users.ts` — confirmed `last_visited_at` column does NOT yet exist (must add in migration)
- `src/db/migrations/0004_versioning.sql` — confirmed migration convention (ALTER TABLE pattern)

### Secondary (MEDIUM confidence)
- [Resend npm page](https://www.npmjs.com/package/resend) — version 6.9.4 confirmed via search result (verify with `npm view resend version`)
- [React Email send with Resend](https://react.email/docs/integrations/resend) — API pattern `resend.emails.send({ react: EmailComponent })`
- [React Email 5.0](https://resend.com/blog/react-email-5) — React 19.2 + Next.js 16 + Tailwind 4 support confirmed

### Tertiary (LOW confidence — validate before use)
- WebSearch: in-app notification polling pattern (tRPC + TanStack Query `refetchInterval`) — common industry pattern, not from official source; confidence boosted by direct stack knowledge

---

## Metadata

**Confidence breakdown:**
- Standard stack (existing packages): HIGH — verified from package.json
- Notification table schema: HIGH — follows exact same patterns as existing Drizzle schemas in codebase
- Resend integration: MEDIUM — package not yet installed; version from search result, not registry; API pattern confirmed from official docs
- Dashboard role-switch pattern: HIGH — follows existing codebase conventions (Server Components + `ctx.user.role`)
- "What changed" via `last_visited_at`: HIGH — simple timestamp column, no external dependency

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable domain — main risk is Resend API version; verify at install time)
