# Phase 24: Stakeholder Engagement Tracking (lite) - Research

**Researched:** 2026-04-16
**Domain:** tRPC middleware, Drizzle ORM subqueries, Next.js App Router dynamic routes, admin dashboard UI
**Confidence:** HIGH

## Summary

Phase 24 adds lightweight stakeholder engagement visibility to the admin experience. The work divides cleanly into four areas: (1) a Drizzle migration adding `last_activity_at` to `users` with a backfill, (2) a new tRPC middleware `touchActivity` that fires-and-forgets an UPDATE after every authenticated mutation, (3) an engagement query that computes `feedbackCount + attendedWorkshopCount` via SQL subqueries at read time, and (4) two new UI surfaces — an inactive-users widget on the existing admin dashboard and an admin-only stakeholder profile page at `app/(workspace)/users/[id]/page.tsx`.

All four areas have locked decisions from CONTEXT.md (D-01 through D-09). The existing codebase provides all required patterns: the tRPC middleware chain in `src/trpc/init.ts`, `workshopRegistrations.attendedAt` from Phase 20, `feedbackItems.submitterId` from Phase 4, the `AdminDashboard` Promise.all server component pattern, and the `StatCard` reusable component. No new libraries are needed; the implementation is purely additive on existing infrastructure.

The only nuance to plan carefully is the fire-and-forget middleware pattern: `touchActivity` must not block the mutation response, must not throw on failure (wrapped in `.catch`), and must compose after `enforceAuth` so the user row is guaranteed to exist before the UPDATE fires.

**Primary recommendation:** Implement in four sequential plans — migration, tRPC middleware + engagement query, admin dashboard widget, stakeholder profile page.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Engagement score = `feedbackCount + attendedWorkshopCount`. No weights, no tiers — plain integer.
**D-02:** Computed on-the-fly via SQL subqueries at read time. No stored column, no triggers, no sync complexity.
**D-03:** Widget lives on the existing `AdminDashboard` (`app/(workspace)/dashboard/_components/admin-dashboard.tsx`), below the existing stat cards row. Reuse `StatCard` for the count, with a table below.
**D-04:** Configurable inactivity window via dropdown on the widget (7d / 14d / 30d / 60d / 90d). Default 30 days. Client-side filter — no server config or env var needed.
**D-05:** Widget shows ALL users (not just stakeholders). Sortable by name, role, last active, engagement score.
**D-06:** Admin-only route at `app/(workspace)/users/[id]/page.tsx`. Clicking a name in the inactive widget or users list navigates here.
**D-07:** Profile shows: user metadata header (name, role, org type, join date, last active, engagement score), workshop attendance history (`workshopRegistrations` where `attendedAt IS NOT NULL`), and feedback summary (count + recent items with status).
**D-08:** `users.lastActivityAt` updated via a new tRPC middleware on EVERY authenticated mutation. Middleware sits after `enforceAuth`, fires-and-forgets the UPDATE after the mutation succeeds. No selective annotation.
**D-09:** Migration adds `last_activity_at` TIMESTAMPTZ column and backfills to `created_at` for all existing users. No user starts with NULL.

### Claude's Discretion

- Profile page content beyond attendance + feedback (e.g., org type breakdown, activity sparkline) — keep it "lite"
- Exact widget table styling and empty states
- Whether to add a link from the users list page to the profile page (likely yes)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

**Out of scope (from domain):** CRM features, engagement email campaigns, self-service stakeholder profile, activity timeline/audit log per user, weighted scoring, stored/materialized engagement scores.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-08 | `users.lastActivityAt` updated via tRPC middleware on every authenticated mutation | D-08/D-09: migration pattern confirmed (0015_cardano_anchoring.sql), middleware chain in `src/trpc/init.ts` shows exact composition point after `enforceAuth` |
| UX-09 | Admin dashboard widget lists inactive users (no activity in configurable window) with engagement score | D-03/D-04/D-05: AdminDashboard server component pattern confirmed, StatCard and Table components already present, client-side filter pattern matches existing `users-client.tsx` |
| UX-10 | Basic engagement score = feedback count + workshop attendance count | D-01/D-02: `feedbackItems.submitterId` and `workshopRegistrations.userId + attendedAt IS NOT NULL` provide exact data sources; Drizzle subquery pattern present in `admin-dashboard.tsx` (`sql<number>` cast) |
| UX-11 | Workshop attendance history visible on stakeholder profile, auto-populated from cal.com webhooks | D-06/D-07: `workshopRegistrations.attendedAt` populated by `MEETING_ENDED` webhook (Phase 20 WS-11); new dynamic route `app/(workspace)/users/[id]/page.tsx` follows existing admin guard pattern |
</phase_requirements>

---

## Standard Stack

### Core (already installed — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | existing | SQL subqueries, migrations, schema column addition | Project ORM throughout all phases |
| @trpc/server | existing | Middleware composition, procedure chain | Project RPC layer |
| zod | existing | Input validation on new queries | Project validation standard |
| date-fns | existing | Date formatting on profile page | Already imported in `admin-dashboard.tsx` |

### Supporting (already present)

| Component | Source | When to Use |
|-----------|--------|-------------|
| `StatCard` | `app/(workspace)/dashboard/_components/stat-card.tsx` | Inactive user count tile |
| `Card`, `CardContent`, `CardHeader`, `CardTitle` | `@/components/ui/card` | Widget wrapper, profile page sections |
| `Table`, `TableHead`, `TableBody`, `TableRow`, `TableCell` | `@/components/ui/table` | Inactive users table, attendance table, feedback table |
| `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` | `@/components/ui/select` | Inactivity window dropdown |
| `Badge` | `@/components/ui/badge` | Role/org type on profile header |
| `Skeleton` | `@/components/ui/skeleton` | Loading state — 5 rows h-12 |

**Installation:** None required. All packages are present.

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src/db/migrations/
└── 0016_engagement_tracking.sql      # ADD COLUMN last_activity_at + backfill

src/db/schema/
└── users.ts                           # ADD lastActivityAt column definition

src/trpc/
└── init.ts                            # ADD touchActivity middleware, compose into protectedProcedure

src/server/routers/
└── user.ts                            # ADD listUsersWithEngagement query + getUserProfile query

app/(workspace)/dashboard/_components/
└── admin-dashboard.tsx                # ADD InactiveUsersWidget section below stat cards
    inactive-users-widget.tsx          # New 'use client' widget component (or inline)

app/(workspace)/users/
└── [id]/
    └── page.tsx                       # New admin-only stakeholder profile page
```

### Pattern 1: tRPC Fire-and-Forget Middleware

**What:** Middleware that runs after `enforceAuth`, updates `lastActivityAt` after the mutation resolves, never blocks the response, never throws.
**When to use:** Composing cross-cutting concerns that should not affect mutation outcome.

```typescript
// In src/trpc/init.ts — add after enforceAuth is defined
// Fire-and-forget: wraps the next() call so the UPDATE fires after the
// mutation resolves. Uses .catch() so failures are silent (operational noise
// not a business event).
const touchActivity = t.middleware(async ({ ctx, next, type }) => {
  const result = await next({ ctx })
  // Only fire on mutations — queries don't constitute "activity"
  if (type === 'mutation' && ctx.user) {
    db.update(users)
      .set({ lastActivityAt: new Date() })
      .where(eq(users.id, ctx.user.id))
      .catch(() => { /* intentional silent fail */ })
  }
  return result
})

// Compose after enforceAuth:
export const protectedProcedure = t.procedure.use(enforceAuth).use(touchActivity)
```

**Critical:** The `db.update(...)` call is NOT awaited — it returns a floating Promise. This is the intentional fire-and-forget pattern per D-08.

**Important:** `type` is available on the middleware context as the procedure type (`'query' | 'mutation' | 'subscription'`). Filter on `'mutation'` only so read queries don't needlessly write.

### Pattern 2: Drizzle On-the-Fly Engagement Score via Subquery

**What:** Inline correlated subqueries in a `db.select()` call that count feedback and attendance per user without a stored column.
**When to use:** Admin-only reads on small user tables (D-02).

```typescript
// In src/server/routers/user.ts
import { sql, lt, isNull, or } from 'drizzle-orm'
import { workshopRegistrations } from '@/src/db/schema/workshops'
import { feedbackItems } from '@/src/db/schema/feedback'

// Subquery for feedback count per user
const feedbackCountSq = db
  .select({ submitterId: feedbackItems.submitterId, cnt: count().as('cnt') })
  .from(feedbackItems)
  .groupBy(feedbackItems.submitterId)
  .as('feedback_counts')

// Subquery for attended workshop count per user
const attendanceSq = db
  .select({ userId: workshopRegistrations.userId, cnt: count().as('cnt') })
  .from(workshopRegistrations)
  .where(isNull(workshopRegistrations.attendedAt).not())  // attendedAt IS NOT NULL
  .groupBy(workshopRegistrations.userId)
  .as('attendance_counts')

const usersWithEngagement = await db
  .select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    orgType: users.orgType,
    createdAt: users.createdAt,
    lastActivityAt: users.lastActivityAt,
    // engagementScore = feedbackCount + attendedWorkshopCount
    // Formula: simple sum, no weights (D-01)
    engagementScore: sql<number>`
      COALESCE(${feedbackCountSq.cnt}, 0) + COALESCE(${attendanceSq.cnt}, 0)
    `.as('engagement_score'),
  })
  .from(users)
  .leftJoin(feedbackCountSq, eq(users.id, feedbackCountSq.submitterId))
  .leftJoin(attendanceSq, eq(users.id, attendanceSq.userId))
```

**Alternative simpler approach** (also acceptable for small datasets): Two separate `db.select({ count })` queries per user fetched in parallel — less efficient but easier to read. Use LEFT JOIN subquery approach for the list query (single DB round trip).

### Pattern 3: Admin-Only Dynamic Route Guard

**What:** Server component at `app/(workspace)/users/[id]/page.tsx` that mirrors the guard in `app/(workspace)/users/page.tsx`.
**When to use:** Any new admin-only page in the workspace shell.

```typescript
// app/(workspace)/users/[id]/page.tsx
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { eq } from 'drizzle-orm'

export default async function UserProfilePage({ params }: { params: { id: string } }) {
  const { userId } = await auth()
  if (!userId) redirect('/dashboard')

  const currentUser = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  })
  if (!currentUser || currentUser.role !== 'admin') redirect('/dashboard')

  // Fetch target user + engagement data
  // ...
}
```

### Pattern 4: AdminDashboard Promise.all Extension

**What:** Extend the existing `Promise.all` in `AdminDashboard` with the new engagement query.
**When to use:** Adding a new data slice to the admin dashboard server component.

Current shape (from `admin-dashboard.tsx`):
```typescript
const [
  [totalUsersResult],
  [activePoliciesResult],
  [openFeedbackResult],
  versionsReadyToPublish,
  usersByRole,
] = await Promise.all([...])
```

Extension: add the engagement list query as a 6th element in the `Promise.all` array. The widget itself should be a separate `'use client'` component that receives the pre-fetched users array as a prop (matches existing pattern — server fetches, client renders interactive parts).

### Pattern 5: Migration — ADD COLUMN with Backfill

**What:** SQL migration adding `last_activity_at` TIMESTAMPTZ with immediate UPDATE backfill.
**When to use:** All schema additions in this project.

```sql
-- 0016_engagement_tracking.sql
-- Phase 24: UX-08 — lastActivityAt mutation tracking
-- UX-09, UX-10, UX-11 — admin engagement visibility

-- Add lastActivityAt; no NOT NULL yet to allow backfill
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- Backfill: all existing users default to their created_at (D-09)
-- No user starts with NULL
UPDATE users SET last_activity_at = created_at WHERE last_activity_at IS NULL;

-- Now safe to add NOT NULL constraint
ALTER TABLE users ALTER COLUMN last_activity_at SET NOT NULL;
ALTER TABLE users ALTER COLUMN last_activity_at SET DEFAULT now();
```

### Anti-Patterns to Avoid

- **Awaiting `touchActivity` DB write:** Must NOT be awaited — defeats fire-and-forget, adds latency to every mutation.
- **Throwing in `touchActivity`:** Must wrap in `.catch()` — a failed activity touch must not fail the mutation response.
- **Applying `touchActivity` to queries:** Filter `type === 'mutation'` — read queries are not activity.
- **Storing engagement score as a column:** D-02 explicitly rejects this — on-the-fly subqueries only.
- **NULL `lastActivityAt`:** D-09 requires backfill; all users must have a non-null value after migration.
- **Server-side inactivity filtering:** D-04 requires client-side filtering against the inactivity window dropdown — the query returns ALL users with `lastActivityAt`, the client filters.
- **New procedure for touchActivity:** Do NOT add a separate tRPC mutation for touching activity — it must be automatic middleware, not an explicit call from each mutation handler.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Engagement score aggregation | Custom in-memory computation after fetching all rows | SQL LEFT JOIN with subqueries | Single DB round trip, correct COALESCE for zero-count users |
| Inactivity filtering | New tRPC query per window size | Client-side filter over pre-fetched array | D-04 explicitly requires client-side; no server config needed |
| Date comparison for "dormant since X days" | Custom date math | `date-fns` `subDays` + comparison, or `lt(users.lastActivityAt, subDays(new Date(), windowDays))` | Already imported, handles edge cases |
| Admin guard | Duplicated auth check logic | Mirror exact pattern from `app/(workspace)/users/page.tsx` | Consistent, already reviewed pattern |

---

## Common Pitfalls

### Pitfall 1: `protectedProcedure` Redefinition Breaks Existing Routes

**What goes wrong:** Redefining `protectedProcedure` in `init.ts` to add `touchActivity` can silently change behavior of all existing protected queries (queries should not touch `lastActivityAt`).
**Why it happens:** If `touchActivity` does not check `type === 'mutation'`, it fires on queries too — unnecessary DB writes on every `trpc.user.listUsers.useQuery()` call.
**How to avoid:** Guard with `if (type === 'mutation')` inside the middleware body.
**Warning signs:** DB write traffic unexpectedly high; `lastActivityAt` updating on dashboard page loads.

### Pitfall 2: `workshopRegistrations.userId` Can Be NULL

**What goes wrong:** `workshopRegistrations.userId` is `uuid REFERENCES users(id) ON DELETE SET NULL` — it can be null for synthetic walk-in rows (created when `MEETING_ENDED` reports an attendee email with no prior Clerk account).
**Why it happens:** Phase 20 design: unknown emails create synthetic registration rows without a `userId` until a Clerk invite is accepted.
**How to avoid:** The attendance subquery must filter `WHERE user_id IS NOT NULL` before grouping, otherwise the LEFT JOIN produces a NULL key that never matches any user row (harmless but wasteful).
**Warning signs:** Engagement scores lower than expected for users who attended workshops pre-Clerk-account creation.

### Pitfall 3: Missing `lastActivityAt` in `createTRPCContext` User Object

**What goes wrong:** `createTRPCContext` fetches the user via `db.query.users.findFirst()`. Once `lastActivityAt` is added to the schema, it will be included in the returned object automatically — but `touchActivity` reads `ctx.user.id`, which is already present. No issue here. However, if the Drizzle schema file (`users.ts`) is updated but the migration has not been run, queries will fail with a column-not-found error.
**Why it happens:** Schema-first workflow: Drizzle schema declares the column but the DB column only exists after migration runs.
**How to avoid:** Plan must run migration (plan 1) before any code using `lastActivityAt` is executed (plans 2+).
**Warning signs:** `column "last_activity_at" does not exist` Postgres error.

### Pitfall 4: Client-Side Filter Requires Full User List in Payload

**What goes wrong:** The inactivity window dropdown (D-04) filters client-side. This means the initial fetch must return ALL users with their `lastActivityAt`, not pre-filtered for 30 days. If the tRPC query pre-filters, changing the dropdown to 7 days will show nothing because 23-day-inactive users are not in the payload.
**Why it happens:** Temptation to push filtering to the server for efficiency.
**How to avoid:** `listUsersWithEngagement` returns all users. Client filters by comparing `lastActivityAt` to `subDays(new Date(), selectedWindow)`.
**Warning signs:** Dropdown window changes produce unexpectedly empty tables.

### Pitfall 5: Dynamic Route Params in Next.js App Router

**What goes wrong:** In Next.js App Router, `params` in a server component page is a Promise (as of Next.js 15). Accessing `params.id` synchronously throws.
**Why it happens:** Next.js breaking change in newer versions — `params` is async.
**How to avoid:** Read `node_modules/next/dist/docs/` before writing the dynamic route. Pattern: `const { id } = await params` — destructure after awaiting.
**Warning signs:** `params.id` is `undefined`; TypeScript type for `params` is `Promise<{ id: string }>`.

---

## Code Examples

### Migration: ADD COLUMN + Backfill

```sql
-- src/db/migrations/0016_engagement_tracking.sql
-- Phase 24: UX-08 activity tracking column

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- Backfill: no user starts with NULL (D-09)
UPDATE users SET last_activity_at = created_at WHERE last_activity_at IS NULL;

ALTER TABLE users ALTER COLUMN last_activity_at SET NOT NULL;
ALTER TABLE users ALTER COLUMN last_activity_at SET DEFAULT now();
```

### Schema Column Addition

```typescript
// src/db/schema/users.ts — add to users table definition
lastActivityAt: timestamp('last_activity_at', { withTimezone: true })
  .notNull()
  .defaultNow(),
```

### touchActivity Middleware

```typescript
// src/trpc/init.ts
const touchActivity = t.middleware(async ({ ctx, next, type }) => {
  const result = await next({ ctx })
  if (type === 'mutation' && ctx.user) {
    // Fire-and-forget: no await, failure is silent (not a business event)
    db.update(users)
      .set({ lastActivityAt: new Date() })
      .where(eq(users.id, ctx.user.id))
      .catch(() => {})
  }
  return result
})

export const protectedProcedure = t.procedure.use(enforceAuth).use(touchActivity)
```

### Engagement Score Query (user router)

```typescript
// src/server/routers/user.ts — new listUsersWithEngagement query
listUsersWithEngagement: requirePermission('user:list')
  .query(async () => {
    // engagementScore = feedbackCount + attendedWorkshopCount (D-01)
    // Computed on-the-fly via LEFT JOIN subqueries (D-02)
    const feedbackCounts = db
      .select({
        submitterId: feedbackItems.submitterId,
        cnt: count().as('cnt'),
      })
      .from(feedbackItems)
      .groupBy(feedbackItems.submitterId)
      .as('feedback_counts')

    const attendanceCounts = db
      .select({
        userId: workshopRegistrations.userId,
        cnt: count().as('cnt'),
      })
      .from(workshopRegistrations)
      .where(
        and(
          isNotNull(workshopRegistrations.attendedAt),
          isNotNull(workshopRegistrations.userId),
        )
      )
      .groupBy(workshopRegistrations.userId)
      .as('attendance_counts')

    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        orgType: users.orgType,
        createdAt: users.createdAt,
        lastActivityAt: users.lastActivityAt,
        // Formula documented here per D-01:
        // engagementScore = feedbackCount + attendedWorkshopCount (no weights)
        engagementScore: sql<number>`
          COALESCE(${feedbackCounts.cnt}, 0) + COALESCE(${attendanceCounts.cnt}, 0)
        `.mapWith(Number),
      })
      .from(users)
      .leftJoin(feedbackCounts, eq(users.id, feedbackCounts.submitterId))
      .leftJoin(attendanceCounts, eq(users.id, attendanceCounts.userId))
      .orderBy(users.createdAt)
  }),
```

### getUserProfile Query (for profile page)

```typescript
// src/server/routers/user.ts — new getUserProfile query
getUserProfile: requirePermission('user:list')
  .input(z.object({ userId: z.string().uuid() }))
  .query(async ({ input }) => {
    const [profile, attendedWorkshops, userFeedback] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, input.userId) }),

      // Attendance history: workshopRegistrations WHERE attendedAt IS NOT NULL (UX-11)
      db
        .select({
          workshopId: workshops.id,
          title: workshops.title,
          scheduledAt: workshops.scheduledAt,
          attendedAt: workshopRegistrations.attendedAt,
          status: workshops.status,
        })
        .from(workshopRegistrations)
        .innerJoin(workshops, eq(workshopRegistrations.workshopId, workshops.id))
        .where(
          and(
            eq(workshopRegistrations.userId, input.userId),
            isNotNull(workshopRegistrations.attendedAt),
          )
        )
        .orderBy(desc(workshopRegistrations.attendedAt)),

      // Feedback summary (D-07)
      db
        .select({
          id: feedbackItems.id,
          readableId: feedbackItems.readableId,
          title: feedbackItems.title,
          status: feedbackItems.status,
          createdAt: feedbackItems.createdAt,
        })
        .from(feedbackItems)
        .where(eq(feedbackItems.submitterId, input.userId))
        .orderBy(desc(feedbackItems.createdAt))
        .limit(20),
    ])

    if (!profile) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' })

    // Engagement score: feedbackCount + attendedWorkshopCount (D-01)
    const engagementScore = userFeedback.length + attendedWorkshops.length

    return { profile, attendedWorkshops, userFeedback, engagementScore }
  }),
```

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/config changes against existing infrastructure (Postgres, tRPC, Next.js, Drizzle) already verified operational in prior phases. No new external dependencies introduced.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.mts) |
| Config file | `vitest.config.mts` — existing, covers `src/**/*.test.ts` and `app/**/*.test.ts` |
| Quick run command | `npm test -- --reporter=verbose src/server/routers/__tests__/user-engagement.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-08 | `touchActivity` middleware fires UPDATE on mutation, not on query | unit | `npm test -- src/server/routers/__tests__/user-engagement.test.ts` | Wave 0 |
| UX-09 | `listUsersWithEngagement` query returns all users with `lastActivityAt` and `engagementScore` fields | unit | `npm test -- src/server/routers/__tests__/user-engagement.test.ts` | Wave 0 |
| UX-10 | Engagement score = feedbackCount + attendedWorkshopCount, COALESCE handles zero case | unit | `npm test -- src/server/routers/__tests__/user-engagement.test.ts` | Wave 0 |
| UX-11 | `getUserProfile` returns attendance history from `workshopRegistrations` where `attendedAt IS NOT NULL` | unit | `npm test -- src/server/routers/__tests__/user-engagement.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- src/server/routers/__tests__/user-engagement.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/server/routers/__tests__/user-engagement.test.ts` — covers UX-08, UX-09, UX-10, UX-11. Follow the db mock pattern from `milestone.test.ts` (vi.mock `@/src/db`, assert procedure definitions and schema field presence).

---

## Open Questions

1. **`protectedProcedure` redefinition downstream impact**
   - What we know: all 13 routers use `protectedProcedure` or `requirePermission`/`requireRole` which compose from it. Adding `touchActivity` into `protectedProcedure` adds one fire-and-forget write per mutation across all routers.
   - What's unclear: whether any existing mutation handlers have performance tests that would fail with the extra async write.
   - Recommendation: Check for any mutation-level timing tests in the suite before composing `touchActivity` into `protectedProcedure`. None found in current test files — safe to proceed.

2. **`workshopRegistrations.userId` null synthetic walk-ins**
   - What we know: Phase 20 can create synthetic walk-in registration rows with `userId = null` when an attendee's email is not yet a Clerk user.
   - What's unclear: for those users who later claim their Clerk account, will the `userId` FK be back-populated?
   - Recommendation: The engagement query already handles this by filtering `WHERE user_id IS NOT NULL`. No action needed. Note in code comment.

---

## Sources

### Primary (HIGH confidence)

- `src/trpc/init.ts` — middleware chain, `protectedProcedure` composition point, `t.middleware` type signature
- `src/db/schema/users.ts` — current `users` table; `lastActivityAt` column absent, `lastVisitedAt` present as precedent
- `src/db/schema/workshops.ts` — `workshopRegistrations` schema: `attendedAt`, `userId`, `attendanceSource` fields
- `src/db/schema/feedback.ts` — `feedbackItems` schema: `submitterId` FK
- `app/(workspace)/dashboard/_components/admin-dashboard.tsx` — Promise.all pattern, StatCard usage, Table rendering
- `app/(workspace)/dashboard/_components/stat-card.tsx` — StatCard props interface
- `app/(workspace)/users/page.tsx` — admin guard pattern to mirror
- `app/(workspace)/users/_components/users-client.tsx` — client-side table/select/sort pattern
- `src/server/routers/user.ts` — existing `listUsers`, `updateLastVisited` patterns
- `src/server/routers/_app.ts` — router composition; `user` namespace confirmed
- `src/db/migrations/0015_cardano_anchoring.sql` — ADD COLUMN IF NOT EXISTS + DO $$ pattern
- `src/db/migrations/0000_initial.sql` — users DDL baseline
- `vitest.config.mts` — test discovery globs, environment jsdom
- `.planning/phases/24-stakeholder-engagement-tracking-lite/24-UI-SPEC.md` — component inventory, copy, interaction contracts, layout specs

### Secondary (MEDIUM confidence)

- `src/server/routers/__tests__/milestone.test.ts` — vi.mock db pattern for unit tests

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries present, versions confirmed via package.json
- Architecture: HIGH — all patterns directly verified from existing source files
- Pitfalls: HIGH — derived from schema inspection (nullable userId, async params) and tRPC middleware mechanics confirmed in init.ts
- Test patterns: HIGH — vitest.config.mts and milestone.test.ts confirm framework and mock approach

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable stack; no external API dependencies)
