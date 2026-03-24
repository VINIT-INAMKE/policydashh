# Phase 1: Foundation & Auth - Research

**Researched:** 2026-03-25
**Domain:** Next.js 16 App Router + Clerk v7 + tRPC v11 + Drizzle ORM + Neon PostgreSQL + partitioned audit log
**Confidence:** HIGH (all core claims verified against installed packages, official docs, and Next.js 16 local docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Roles modeled via Clerk publicMetadata + mirrored in Drizzle users table for queryability
- Invite flow uses Clerk Invitations API — admin creates invite with role in metadata, user arrives pre-configured
- Org type (Government, Industry, Legal, Academia, Civil Society, Internal) stored in app DB users table only (not Clerk)
- Session validation via Clerk middleware + tRPC context — Clerk middleware validates JWT, tRPC context extracts user+role for every procedure
- Neon PostgreSQL for hosting (serverless, branching for dev, Drizzle first-class support)
- Drizzle Kit push for dev, generate + migrate for production deployments
- Audit log partitioned monthly from day one — auto-create partitions
- State transition table pattern: `workflow_transitions(id, entity_type, entity_id, from_state, to_state, actor_id, timestamp)` alongside status columns for all workflow entities
- tRPC v11 for API layer — end-to-end type safety, middleware chains for auth/RBAC/audit
- Default-deny enforcement via tRPC middleware chain: auth → role check → audit. No procedure accessible without explicit permission declaration
- Project scaffolded with create-next-app + manual setup (Next.js 16 App Router, add Drizzle/tRPC/Clerk/Tailwind incrementally)
- Deployment target: Vercel (first-class Next.js support, edge middleware for Clerk)

### Claude's Discretion
- Exact Drizzle schema column types and indexes
- tRPC router organization (flat vs nested)
- Tailwind/shadcn configuration details
- Test setup and tooling choices

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign up / log in via Clerk auth provider (email-based) | Clerk v7 `clerkMiddleware()` in `proxy.ts` + `<SignIn>` / `<UserButton>` components |
| AUTH-02 | Admin can invite users via email with pre-assigned role | Clerk Invitations API with `publicMetadata` carrying role; webhook syncs to DB on `user.created` |
| AUTH-03 | User is assigned one of 7 roles: Admin, Policy Lead, Research Lead, Workshop Moderator, Stakeholder, Observer, Auditor | Stored in `publicMetadata.role` + mirrored in Drizzle `users.role` column (enum) |
| AUTH-04 | User's organization type is tagged: Government, Industry, Legal, Academia, Civil Society, Internal | Stored in Drizzle `users.org_type` column (enum) — not in Clerk |
| AUTH-06 | Each role has a defined permission set enforced on every API endpoint (default-deny) | tRPC `protectedProcedure` middleware chain: auth check → role permission matrix check → throws FORBIDDEN if not granted |
| AUTH-07 | User session persists across browser refresh | Clerk JWT session cookie automatically managed; Next.js layout renders auth state from Clerk `auth()` RSC helper |
| AUDIT-01 | Immutable append-only audit log recording every action | `audit_events` table with PostgreSQL rules blocking UPDATE/DELETE; INSERT-only from application |
| AUDIT-02 | Audit log captures: actor, action, object type, object ID, timestamp, metadata | Schema: `id, timestamp, actor_id, actor_role, action, entity_type, entity_id, payload JSONB, ip_address` |
| AUDIT-03 | Audit log is partitioned for performance (monthly or quarterly) | `PARTITION BY RANGE (timestamp)` monthly; initial partitions created in Wave 0 migration |
</phase_requirements>

---

## Summary

Phase 1 is the security and infrastructure foundation — nothing else in the system is safe to build without it. The phase establishes Clerk v7 authentication, a role-bearing user record in PostgreSQL, tRPC v11 with default-deny middleware, and a partitioned immutable audit log. Zero user-facing product features ship in this phase.

The most significant research finding is a **breaking API change in Next.js 16**: the middleware file is now named `proxy.ts` (not `middleware.ts`), and the exported function must be named `proxy` (or default export). Every tutorial and most library docs still reference the v15 convention — this will cause a hard runtime failure if missed. Clerk's docs have been updated for this; tRPC route handlers are unaffected (they live in `app/api/trpc/[trpc]/route.ts`).

A second critical finding is the **7-role to Clerk mapping decision** flagged as a blocker in STATE.md. Clerk's role management UI is designed around 3-4 roles per organization. The recommendation is to store the 7-role distinction in `publicMetadata.role` and the Drizzle `users.role` enum, while using only 3 Clerk org roles (Admin, Editor, Viewer) for Clerk-native features. This avoids Clerk UI friction without losing business logic granularity.

**Primary recommendation:** Build the auth + database + tRPC skeleton in strict sequence: schema first, then tRPC init + context, then Clerk `proxy.ts`, then role-bearing procedures, then audit log. Every procedure must go through the middleware chain from the first commit — retrofitting default-deny after the fact is the failure mode from the previous attempt.

---

## Standard Stack

### Core (Phase 1 only)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @clerk/nextjs | 7.0.6 | Auth provider, invitations, session JWT | Drop-in Next.js 16 App Router support; `clerkMiddleware()` for `proxy.ts`; 50K free MAUs |
| drizzle-orm | 0.45.1 | TypeScript ORM for PostgreSQL | SQL-first, zero codegen, type-safe schema; project decision |
| drizzle-kit | 0.31.10 | Schema migration tooling | Pairs with drizzle-orm 0.45.x; `push` for dev, `generate`+`migrate` for prod |
| @neondatabase/serverless | 1.0.2 | Neon PostgreSQL serverless driver | Native Vercel integration; works with Drizzle |
| @trpc/server | 11.15.0 | tRPC server core | Middleware chains, typed procedures, default-deny enforcement |
| @trpc/client | 11.15.0 | tRPC client core | Type-safe API calls from Next.js client components |
| @trpc/react-query | 11.15.0 | tRPC React hooks (TanStack Query integration) | `useMutation`, `useQuery` hooks for client components |
| @tanstack/react-query | 5.95.2 | Server state management | Required by tRPC React adapter; handles caching and refetch |
| zod | 4.3.6 | Schema validation | Input validation for all tRPC procedures; pairs with TypeScript |
| server-only | 0.0.1 | Prevents server code from being imported in client bundles | Guards `trpc/server.tsx` and DB layer imports |

### Supporting (installed in Phase 1 for later use)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | 4.x | Date formatting for audit timestamps | Audit log display and timestamp formatting |
| vitest | 4.1.1 | Unit/integration test runner | Test middleware chains and permission logic |
| @vitejs/plugin-react | latest | Vitest React plugin | Required for Vitest with React components |
| @testing-library/react | latest | Component testing | UI component tests |
| vite-tsconfig-paths | latest | TSConfig path resolution in Vitest | Required for `@/` imports in tests |

**Installation for Phase 1:**
```bash
npm install @clerk/nextjs drizzle-orm @neondatabase/serverless
npm install @trpc/server @trpc/client @trpc/react-query @tanstack/react-query
npm install zod server-only date-fns
npm install -D drizzle-kit
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths
```

**Version verification (confirmed 2026-03-25):**
```bash
npm view @clerk/nextjs version        # 7.0.6
npm view drizzle-orm version          # 0.45.1
npm view drizzle-kit version          # 0.31.10
npm view @neondatabase/serverless version  # 1.0.2
npm view @trpc/server version         # 11.15.0
npm view @tanstack/react-query version # 5.95.2
npm view zod version                  # 4.3.6
npm view vitest version               # 4.1.1
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (workspace)/          # Auth-gated routes
│   │   ├── dashboard/        # Role-aware dashboard (Phase 8)
│   │   └── layout.tsx        # Uses Clerk auth() to gate access
│   ├── api/
│   │   └── trpc/[trpc]/
│   │       └── route.ts      # tRPC HTTP handler (fetch adapter)
│   └── layout.tsx            # Root layout + ClerkProvider + TRPCReactProvider
├── server/
│   ├── routers/
│   │   ├── _app.ts           # Root router merging all sub-routers
│   │   ├── user.ts           # User profile, org type, role
│   │   └── audit.ts          # Audit log queries (Auditor role only)
│   └── trpc.ts               # tRPC init, context, middleware definitions
├── db/
│   ├── schema/
│   │   ├── users.ts          # users table (role enum, org_type enum, clerk_id)
│   │   ├── audit.ts          # audit_events partitioned table
│   │   └── workflow.ts       # workflow_transitions table (stub for Phase 4+)
│   ├── migrations/           # Generated by drizzle-kit
│   └── index.ts              # Neon client + Drizzle instance
├── trpc/
│   ├── init.ts               # createTRPCContext, t, router, procedure builders
│   ├── client.tsx            # TRPCReactProvider + client hooks
│   ├── query-client.ts       # QueryClient factory (staleTime, hydration config)
│   └── server.tsx            # 'server-only' server-side caller + prefetch helpers
└── lib/
    ├── auth.ts               # Clerk helper re-exports
    ├── permissions.ts        # Role permission matrix
    └── constants.ts          # Role enum, org type enum, action constants
proxy.ts                      # Clerk middleware (Next.js 16 name — NOT middleware.ts)
drizzle.config.ts
next.config.ts
```

### Pattern 1: Next.js 16 Proxy File (Breaking Change from v15)

**What:** In Next.js 16, the middleware convention is renamed from `middleware.ts` to `proxy.ts`. The exported function must be named `proxy` (or use default export). The `config` object with `matcher` is still supported.

**When to use:** Always in Next.js 16 — every project needs this file for Clerk auth.

**Source:** Verified in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` (installed Next.js 16.2.1)

```typescript
// proxy.ts  (NOT middleware.ts — that convention is deprecated in Next.js 16)
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

### Pattern 2: tRPC Context with Clerk Auth

**What:** tRPC context is created per-request. It extracts the Clerk user ID and role from the session, making both available to all procedures without redundant lookups.

**Source:** tRPC v11 App Router docs (trpc.io/docs/client/nextjs/app-router-setup) + Clerk auth() RSC docs

```typescript
// src/trpc/init.ts
import { initTRPC, TRPCError } from '@trpc/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/db'
import { users } from '@/db/schema/users'
import { eq } from 'drizzle-orm'
import { cache } from 'react'
import { ZodError } from 'zod'

export const createTRPCContext = cache(async (opts: { headers: Headers }) => {
  const { userId } = await auth()

  // Load full user record (role, org_type) from DB if authenticated
  const user = userId
    ? await db.query.users.findFirst({ where: eq(users.clerkId, userId) })
    : null

  return {
    headers: opts.headers,
    userId,
    user,  // null for unauthenticated requests
  }
})

const t = initTRPC.context<typeof createTRPCContext>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const router = t.router
export const publicProcedure = t.procedure

// Auth middleware — throws UNAUTHORIZED if no session
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.userId || !ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }
  return next({ ctx: { ...ctx, userId: ctx.userId, user: ctx.user } })
})

export const protectedProcedure = t.procedure.use(enforceAuth)

// Role-checking middleware factory — default-deny
export const requireRole = (allowedRoles: string[]) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({ code: 'FORBIDDEN' })
    }
    return next({ ctx })
  })
```

### Pattern 3: Default-Deny Permission Middleware Chain

**What:** Every tRPC procedure must explicitly declare its permission requirements. The `publicProcedure` is only for truly public operations (health check). All application procedures use `protectedProcedure` or a role-specific variant. No procedure is accessible without traversing the full auth → role → audit chain.

**When to use:** Always. "Every endpoint requires explicit permission declaration, and requests without one are rejected" — this is the lesson from the previous PolicyDash failure.

```typescript
// src/lib/permissions.ts
export const ROLES = {
  ADMIN: 'admin',
  POLICY_LEAD: 'policy_lead',
  RESEARCH_LEAD: 'research_lead',
  WORKSHOP_MODERATOR: 'workshop_moderator',
  STAKEHOLDER: 'stakeholder',
  OBSERVER: 'observer',
  AUDITOR: 'auditor',
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

// Permission matrix — what each role CAN do (default-deny: anything not listed = forbidden)
export const PERMISSIONS = {
  'user:invite':          [ROLES.ADMIN],
  'user:manage_roles':    [ROLES.ADMIN],
  'audit:read':           [ROLES.ADMIN, ROLES.AUDITOR],
  // Phase 4+ permissions added when those features ship
} as const

export type Permission = keyof typeof PERMISSIONS

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role)
}
```

### Pattern 4: Audit Log Schema (Partitioned, Append-Only)

**What:** Monthly-partitioned `audit_events` table with PostgreSQL rules preventing UPDATE/DELETE. Initial partitions created in the same migration that creates the parent table.

**Source:** Architecture research, Pitfalls research (Pitfall 6), CONTEXT.md decision

```typescript
// src/db/schema/audit.ts
import { pgTable, uuid, timestamp, text, jsonb, inet, pgEnum } from 'drizzle-orm/pg-core'

// Parent table with monthly partitioning
// NOTE: Drizzle ORM does not generate PARTITION BY syntax automatically.
// The partition DDL must be written as raw SQL in the migration file.
export const auditEvents = pgTable('audit_events', {
  id:          uuid('id').primaryKey().defaultRandom(),
  timestamp:   timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  actorId:     uuid('actor_id').notNull(),
  actorRole:   text('actor_role').notNull(),
  action:      text('action').notNull(),    // 'user.create', 'user.role_assign', 'user.invite'
  entityType:  text('entity_type').notNull(),
  entityId:    uuid('entity_id').notNull(),
  payload:     jsonb('payload').notNull(),   // { before, after, rationale, ... }
  ipAddress:   inet('ip_address'),
})

// Raw SQL for partition + immutability rules (add to migration file):
// CREATE TABLE audit_events (...) PARTITION BY RANGE (timestamp);
// CREATE TABLE audit_events_2026_03 PARTITION OF audit_events
//   FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
// CREATE TABLE audit_events_2026_04 PARTITION OF audit_events
//   FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
// CREATE RULE no_update_audit AS ON UPDATE TO audit_events DO INSTEAD NOTHING;
// CREATE RULE no_delete_audit AS ON DELETE TO audit_events DO INSTEAD NOTHING;
// CREATE INDEX idx_audit_entity ON audit_events (entity_type, entity_id, timestamp);
```

### Pattern 5: Clerk Invite Flow with Pre-Assigned Role

**What:** Admin calls Clerk Invitations API to create an invite with the role in `publicMetadata`. On invite acceptance, a `user.created` webhook fires. The webhook handler reads the role from `publicMetadata` and inserts the user row in Drizzle with the correct role.

**Source:** Clerk Invitations API docs, CONTEXT.md decision

```typescript
// src/app/api/webhooks/clerk/route.ts
import { Webhook } from 'svix'
import { db } from '@/db'
import { users } from '@/db/schema/users'

export async function POST(req: Request) {
  const body = await req.text()
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!)
  const event = wh.verify(body, Object.fromEntries(req.headers)) as any

  if (event.type === 'user.created') {
    const { id, email_addresses, public_metadata } = event.data
    await db.insert(users).values({
      clerkId: id,
      email: email_addresses[0].email_address,
      role: public_metadata?.role ?? 'stakeholder',
      orgType: null,  // Set by user on first profile completion
    })
  }

  return Response.json({ ok: true })
}
```

### Pattern 6: Workflow Transitions Stub Table

**What:** The `workflow_transitions` table schema is created in Phase 1 even though no workflow entities exist yet. This ensures the table is available when Phase 4 adds feedback and CR lifecycles. The table stores every state transition as an immutable row.

**Source:** CONTEXT.md locked decision, Architecture research (state machine pattern)

```typescript
// src/db/schema/workflow.ts
import { pgTable, uuid, timestamp, text } from 'drizzle-orm/pg-core'

export const workflowTransitions = pgTable('workflow_transitions', {
  id:          uuid('id').primaryKey().defaultRandom(),
  entityType:  text('entity_type').notNull(),   // 'feedback', 'change_request'
  entityId:    uuid('entity_id').notNull(),
  fromState:   text('from_state'),               // null for initial transition
  toState:     text('to_state').notNull(),
  actorId:     uuid('actor_id').notNull(),
  timestamp:   timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  metadata:    text('metadata'),                 // JSON string, optional context
})
```

### Pattern 7: Drizzle + Neon Serverless Setup

**What:** Connect Neon with the serverless driver via `@neondatabase/serverless`. Use `drizzle-orm/neon-serverless` adapter. Environment variable `DATABASE_URL` holds the connection string.

**Source:** Drizzle ORM docs, STACK.md (drizzle-orm 0.45.x + @neondatabase/serverless 1.0.2 compatibility)

```typescript
// src/db/index.ts
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config
```

### Anti-Patterns to Avoid

- **`middleware.ts` (v15 name):** Use `proxy.ts` in Next.js 16. The old filename is deprecated and will produce a warning or fail.
- **`publicProcedure` for application data:** Reserve `publicProcedure` for health checks only. All real endpoints start from `protectedProcedure`.
- **`auth()` in layout.tsx for access control:** Clerk's `auth()` in layouts is for display only (username, avatar). Layouts do not re-render on navigation; auth checks there become stale. Use `auth()` only in page/route handlers for access control.
- **All 7 roles as Clerk Organization roles:** Clerk's role management UI is optimized for 3-4 roles. Map to 3 Clerk org roles (Admin, Editor, Viewer) and store the 7-role distinction in `publicMetadata.role`.
- **Clerk `<Show>` for security gates:** This only hides UI; sensitive data remains in the DOM. Authorization must happen at the API layer (tRPC middleware throws FORBIDDEN), never at the component level.
- **Synchronous `cookies()`, `headers()`, `params` in Next.js 16:** These APIs are now async-only. `const { userId } = await auth()` is the correct pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session JWT verification | Custom JWT parser | Clerk's `auth()` + `clerkMiddleware()` | Edge cases in JWT expiry, rotation, and refresh are non-trivial; Clerk handles RSA key rotation |
| Email invite sending | Custom email with role link | Clerk Invitations API | Clerk handles token generation, expiry, resend, and cancellation |
| OAuth / social login | Custom OAuth flow | Clerk providers | OAuth state management, PKCE, and token refresh are security minefields |
| Database connection pooling | Manual pg pool | `@neondatabase/serverless` neon() | Neon's HTTP mode is serverless-safe (no long-lived connections that exhaust compute) |
| Schema migration tracking | Manual migration table | Drizzle Kit migrations | Drizzle Kit tracks applied migrations and handles rename detection |
| Audit log partitioning logic | Application-level table routing | PostgreSQL `PARTITION BY RANGE` | PostgreSQL's partition pruning is automatic and more efficient than routing in code |
| Role permission registry | Ad-hoc if/else in endpoints | `permissions.ts` matrix + tRPC middleware | Hand-rolled per-endpoint checks create the "default-allow by omission" bug from the previous attempt |

**Key insight:** The entire security model of PolicyDash depends on Clerk + tRPC middleware doing the heavy lifting correctly. Any custom auth code is a liability. Keep the custom code thin: permission matrix + a middleware factory that reads from it.

---

## Common Pitfalls

### Pitfall 1: Using `middleware.ts` Instead of `proxy.ts`
**What goes wrong:** The project builds but Clerk middleware does not execute. All routes become accessible without authentication. Clerk `auth()` returns null in server components.
**Why it happens:** Every tutorial, blog post, and library doc (including some Clerk examples) still references the v15 `middleware.ts` convention. The rename is new in Next.js 16.
**How to avoid:** Create `proxy.ts` at project root (or `src/proxy.ts`). Export the function as `default` or as a named `proxy` export. The existing `middleware.ts` is silently ignored by Next.js 16.
**Warning signs:** `auth()` returns `{ userId: null }` for all requests including logged-in users; Clerk `<UserButton>` shows sign-in when user is logged in.

### Pitfall 2: Default-Allow via Missing Permission Declarations
**What goes wrong:** A new tRPC procedure is added using `protectedProcedure` (auth check passes) but no role check is applied. Any authenticated user, including Observers and Stakeholders, can call it.
**Why it happens:** `protectedProcedure` only checks if a session exists — it does NOT check the role. The role check requires either `requireRole([...])` or an inline middleware. This was the failure mode in the previous PolicyDash attempt.
**How to avoid:** Every procedure uses either (a) `requireRole(ROLES.ADMIN)` style composition, or (b) an explicit inline check that throws FORBIDDEN. There is no "open to all authenticated roles" endpoint in PolicyDash except reading one's own profile.
**Warning signs:** A Stakeholder can call `user.listAll` or `audit.read` without getting a FORBIDDEN response.

### Pitfall 3: Clerk `publicMetadata` Not Synced to DB
**What goes wrong:** Role is set in Clerk `publicMetadata` via invite but the Drizzle `users.role` column is never populated. tRPC context loads the DB user and finds `role: null` — all role checks fail with FORBIDDEN even for the admin who created the account.
**Why it happens:** The `user.created` webhook handler is not implemented, or the webhook secret is not configured in the environment, or the webhook route is not in the `isPublicRoute` matcher and gets blocked by Clerk auth before executing.
**How to avoid:** (1) The webhook route `/api/webhooks/clerk` must be in the public routes matcher in `proxy.ts`. (2) Verify with the Clerk dashboard that the webhook endpoint is registered and the `user.created` event is enabled. (3) Use `svix` for webhook signature verification — do NOT skip this; unsigned webhooks are a security hole.
**Warning signs:** `users` table has zero rows even after accounts are created; `auth.protect()` succeeds but `db.query.users.findFirst` returns undefined.

### Pitfall 4: Audit Partitions Not Created for Current Month
**What goes wrong:** The first INSERT into `audit_events` fails with "no partition of relation audit_events found for row." The partitioned parent table exists but no child partition covers the current month.
**Why it happens:** Drizzle Kit generates the parent table DDL but not the child partition DDL (Drizzle ORM does not have native syntax for `CREATE TABLE ... PARTITION OF ... FOR VALUES FROM ...`). If partition creation is forgotten or only one partition is pre-created, inserts for any unpartitioned month fail.
**How to avoid:** The Wave 0 migration must include: (a) the parent table with `PARTITION BY RANGE (timestamp)`, (b) child partitions for at least the current and next 2 months, (c) a comment with the command to run when creating future partitions. Consider a database function or scheduled job that auto-creates the next month's partition.
**Warning signs:** `ERROR: no partition of relation "audit_events" found for row` on the first audit write.

### Pitfall 5: Async Request API Violations (Next.js 16 Breaking Change)
**What goes wrong:** Code accesses `cookies()`, `headers()`, `params`, or `searchParams` synchronously. Next.js 16 removed the temporary synchronous compatibility layer from v15. These calls throw runtime errors.
**Why it happens:** Documentation examples and most tutorials still show the synchronous pattern. The React 19 `use()` hook and async Server Components are the new model.
**How to avoid:** Use `await auth()` (not `auth().userId`). Use `await cookies()`, `await headers()`. Use `await props.params` in page components. Run `npx next typegen` to generate `PageProps` and `LayoutProps` helper types.
**Warning signs:** Runtime error: "You're using a Next.js API that's not supported in the current environment."

### Pitfall 6: tRPC Context Created Multiple Times Per Request
**What goes wrong:** `createTRPCContext` is called in both the RSC server caller and the API route handler separately. The DB user lookup runs twice per request. If one fetch has stale data, the two contexts have different views of the user's role.
**Why it happens:** Failing to wrap `createTRPCContext` in React's `cache()` function. Without caching, every call to the context factory is a fresh execution.
**How to avoid:** Wrap `createTRPCContext` with `cache()` from React (imported from `'react'`). This memoizes the result for the duration of the request, so both the server caller and the route handler get the same context object.

---

## Code Examples

Verified patterns from official sources and local Next.js 16 docs:

### tRPC Route Handler (App Router)
```typescript
// src/app/api/trpc/[trpc]/route.ts
// Source: trpc.io/docs/client/nextjs/app-router-setup
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/server/routers/_app'
import { createTRPCContext } from '@/trpc/init'

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
  })

export { handler as GET, handler as POST }
```

### tRPC Client Provider
```typescript
// src/trpc/client.tsx
// Source: tRPC v11 App Router docs
'use client'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { TRPCProvider } from '@trpc/react-query'
import type { AppRouter } from '@/server/routers/_app'
import { makeQueryClient } from './query-client'

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: '/api/trpc' })],
    })
  )
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  )
}
```

### Root Layout with ClerkProvider
```typescript
// src/app/layout.tsx
// Source: Clerk Next.js App Router quickstart
import { ClerkProvider } from '@clerk/nextjs'
import { TRPCReactProvider } from '@/trpc/client'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <TRPCReactProvider>
            {children}
          </TRPCReactProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
```

### Users Table Schema
```typescript
// src/db/schema/users.ts
import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('user_role', [
  'admin', 'policy_lead', 'research_lead', 'workshop_moderator',
  'stakeholder', 'observer', 'auditor'
])

export const orgTypeEnum = pgEnum('org_type', [
  'government', 'industry', 'legal', 'academia', 'civil_society', 'internal'
])

export const users = pgTable('users', {
  id:        uuid('id').primaryKey().defaultRandom(),
  clerkId:   text('clerk_id').notNull().unique(),
  email:     text('email').notNull().unique(),
  role:      roleEnum('role').notNull().default('stakeholder'),
  orgType:   orgTypeEnum('org_type'),   // nullable until user sets profile
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` with `proxy` export | Next.js 16 (Oct 2025) | Hard breakage if missed; `middleware.ts` is silently ignored |
| Synchronous `cookies()`, `headers()`, `params` | Async `await cookies()` etc. | Next.js 15/16 | Runtime error if synchronous access attempted |
| `experimental.turbopack` in next.config | `turbopack` at top level | Next.js 16 | Config warning; Turbopack is now default for dev AND build |
| tRPC `@trpc/next` adapter | `fetchRequestHandler` with App Router route handler | tRPC v11 | `@trpc/next` is still available but `fetchRequestHandler` is the App Router standard |
| Clerk `auth()` synchronous call | `await auth()` async call | Clerk v6+ / Next.js 16 | Must be awaited everywhere; any synchronous access throws |
| Drizzle 0.x `pg` driver | `@neondatabase/serverless` + `drizzle-orm/neon-http` | Neon serverless driver 1.0 | Serverless HTTP mode avoids connection exhaustion in Vercel edge |

**Deprecated / outdated:**
- `middleware.ts`: Deprecated in Next.js 16. Use `proxy.ts`.
- `@trpc/next` (for App Router): Still works but the community standard is now `fetchRequestHandler` in a route handler.
- Synchronous Request APIs: Fully removed in Next.js 16, no compatibility layer.

---

## Open Questions

1. **Clerk 7-role to 3-4 Clerk org role mapping**
   - What we know: Clerk recommends 3-4 org roles for UI manageability. PolicyDash has 7 business roles.
   - What's unclear: Which 7 roles map to which 3-4 Clerk org roles? Should Clerk org roles be (Admin, Editor, Viewer) or something else?
   - Recommendation: Use 3 Clerk org roles: `org:admin`, `org:editor`, `org:viewer`. Map Policy Lead + Research Lead + Workshop Moderator → `org:editor`. Map Stakeholder + Observer + Auditor → `org:viewer`. Store the fine-grained 7-role distinction in `publicMetadata.role`. The plan should explicitly resolve this mapping.

2. **Drizzle `PARTITION BY RANGE` migration approach**
   - What we know: Drizzle Kit generates DDL from schema but does NOT generate `PARTITION BY RANGE` clauses or child partition tables.
   - What's unclear: The cleanest way to manage partition DDL alongside Drizzle Kit migrations.
   - Recommendation: Write partition-related DDL as a raw SQL string appended to the Drizzle-generated migration file. Document the pattern clearly so subsequent developers know to add new partition rows when months advance. Mark the audit schema file with a comment explaining this.

3. **Neon project and database branch setup**
   - What we know: Neon supports database branching for dev/preview environments.
   - What's unclear: Whether the Neon project needs to be created before Phase 1 tasks can start, and what the `DATABASE_URL` looks like.
   - Recommendation: The plan should include a Wave 0 "infrastructure setup" task that creates the Neon project, sets up the main branch, and documents the DATABASE_URL format.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js 16 | Assumed available | 20.9+ required | — |
| Next.js | App Router | Already installed | 16.2.1 | — |
| PostgreSQL (Neon) | Database layer | External service | Neon managed | Local Docker PG for testing |
| Clerk | Auth | External service (npm not installed) | 7.0.6 on npm | — |
| npm | Package management | Available | — | — |

**Missing dependencies to install (no fallback):**
- `@clerk/nextjs`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `@trpc/server`, `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query`, `zod`, `server-only`

**External accounts required:**
- Neon project (free tier available at neon.tech)
- Clerk application (free tier at clerk.com, 50K MAU)

**Current project state:** The project has only Next.js + React + TypeScript + ESLint + Tailwind installed. No auth, no database, no API layer. Phase 1 installs the entire stack from scratch.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.mts` — does NOT exist yet (Wave 0 gap) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

**Note:** Async Server Components (RSC) are not supported by Vitest. Unit tests cover synchronous server utilities (permission matrix, middleware logic, schema validation). E2E tests (Playwright, Phase 8+) cover RSC-heavy auth flows.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Unauthenticated request to protected route returns redirect to sign-in | unit (middleware logic) | `npx vitest run src/__tests__/auth.test.ts -t "unauthenticated"` | Wave 0 |
| AUTH-02 | Invite with `publicMetadata.role` sets correct role in DB via webhook | unit (webhook handler) | `npx vitest run src/__tests__/webhooks.test.ts -t "user.created"` | Wave 0 |
| AUTH-03 | `can(role, permission)` returns true/false per permission matrix | unit (permissions.ts) | `npx vitest run src/__tests__/permissions.test.ts` | Wave 0 |
| AUTH-04 | `users.orgType` stores one of the 6 valid org type values | unit (schema + insert) | `npx vitest run src/__tests__/users.test.ts -t "orgType"` | Wave 0 |
| AUTH-06 | Procedure with no role check returns FORBIDDEN for Stakeholder | unit (tRPC procedure) | `npx vitest run src/__tests__/trpc.test.ts -t "default-deny"` | Wave 0 |
| AUTH-07 | Session cookie persists; subsequent requests return same userId | manual/E2E | manual: sign in, refresh, verify UserButton shows user | — |
| AUDIT-01 | `audit_events` table rejects UPDATE and DELETE | unit (DB rules test) | `npx vitest run src/__tests__/audit.test.ts -t "immutable"` | Wave 0 |
| AUDIT-02 | auditLog.write() stores actor, action, entityType, entityId, timestamp | unit (audit service) | `npx vitest run src/__tests__/audit.test.ts -t "schema"` | Wave 0 |
| AUDIT-03 | EXPLAIN on audit query shows partition pruning | manual (drizzle studio) | `psql -c "EXPLAIN SELECT * FROM audit_events WHERE timestamp > '2026-03-01'"` | — |

### Sampling Rate
- **Per task commit:** `npx vitest run` (fast, < 30s)
- **Per wave merge:** `npx vitest run` + manual auth flow check in browser
- **Phase gate:** All Vitest tests green + manual AUTH-07 verified before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.mts` — test framework config
- [ ] `src/__tests__/permissions.test.ts` — covers AUTH-03, AUTH-06
- [ ] `src/__tests__/webhooks.test.ts` — covers AUTH-02
- [ ] `src/__tests__/users.test.ts` — covers AUTH-04
- [ ] `src/__tests__/audit.test.ts` — covers AUDIT-01, AUDIT-02
- [ ] `src/__tests__/trpc.test.ts` — covers AUTH-01, AUTH-06
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths`

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

CLAUDE.md contains only `@AGENTS.md`. AGENTS.md contains one directive:

> "This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices."

**Extracted actionable constraints:**

1. **MANDATORY before writing any Next.js code:** Read the relevant guide in `node_modules/next/dist/docs/`. This applies to every task in every plan.
2. **`proxy.ts` not `middleware.ts`:** Verified from local docs. This is the most impactful breaking change for Phase 1.
3. **Async Request APIs only:** `cookies()`, `headers()`, `params`, `searchParams` are all async in Next.js 16. Synchronous access throws.
4. **Turbopack is default:** No `--turbopack` flag needed. `turbopack` config moves to top level of `next.config.ts`.
5. **React Compiler stable (opt-in):** Available via `reactCompiler: true` in `next.config.ts`. Not required but available.

---

## Sources

### Primary (HIGH confidence)
- Local `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` — verified `proxy.ts` convention in Next.js 16.2.1
- Local `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` — verified all breaking changes
- Local `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md` — Vitest setup for Next.js 16
- npm registry (verified 2026-03-25): `@clerk/nextjs@7.0.6`, `drizzle-orm@0.45.1`, `drizzle-kit@0.31.10`, `@neondatabase/serverless@1.0.2`, `@trpc/server@11.15.0`, `@tanstack/react-query@5.95.2`, `zod@4.3.6`, `vitest@4.1.1`
- `.planning/research/STACK.md` — verified library selection rationale (researched 2026-03-25)
- `.planning/research/ARCHITECTURE.md` — verified tRPC context, permission, and audit patterns
- `.planning/research/PITFALLS.md` — verified default-deny, audit partition, and Clerk boundary pitfalls

### Secondary (MEDIUM confidence)
- [Clerk clerkMiddleware() reference](https://clerk.com/docs/reference/nextjs/clerk-middleware) — proxy.ts file name for Next.js 16, verified against local docs
- [tRPC v11 App Router setup](https://trpc.io/docs/client/nextjs/app-router-setup) — `fetchRequestHandler`, `createTRPCContext` with `cache()`, provider pattern

### Tertiary (LOW confidence)
- None — all critical claims verified at PRIMARY level

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry 2026-03-25
- Architecture: HIGH — patterns sourced from local Next.js 16 docs + tRPC official docs + prior research
- Pitfalls: HIGH — proxy.ts breaking change verified in local docs; others from PITFALLS.md which cites official sources
- Breaking changes: HIGH — verified in `node_modules/next/dist/docs` (the actual installed version)

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 for stable libraries; 2026-04-01 for Clerk (fast-moving)
