---
phase: 01-foundation-auth
plan: 02
subsystem: auth
tags: [clerk, trpc, rbac, permissions, webhook, svix, react-query, proxy]

# Dependency graph
requires:
  - "Drizzle ORM schema with users table (roleEnum, orgTypeEnum, clerkId)"
  - "Neon serverless database connection via src/db/index.ts"
  - "TypeScript constants for ROLES, ORG_TYPES, ACTIONS from src/lib/constants.ts"
  - "All Phase 1 npm dependencies installed (Clerk, tRPC, React Query, svix)"
provides:
  - "tRPC v11 initialization with default-deny RBAC middleware chain (auth -> role -> permission)"
  - "Permission matrix (src/lib/permissions.ts) mapping roles to allowed actions"
  - "Clerk proxy.ts middleware for Next.js 16 (route protection with default-deny)"
  - "Clerk webhook handler for user.created -> DB sync with role from publicMetadata"
  - "Sign-in and sign-up pages with Clerk components (phone-only via Clerk Dashboard config)"
  - "Root layout with ClerkProvider and TRPCReactProvider wrappers"
  - "Server-side tRPC caller factory for React Server Components"
  - "tRPC HTTP handler at /api/trpc (GET + POST)"
  - "Workspace layout with auth gate and UserButton"
affects: [01-03, 02-documents, 03-editor, 04-feedback]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Default-deny RBAC via tRPC middleware chain", "Clerk proxy.ts (Next.js 16 convention, NOT middleware.ts)", "Permission matrix as single source of truth for role-action mappings", "createTRPCReact for client-side tRPC provider", "t.createCallerFactory for server-side RSC caller", "Svix webhook signature verification for Clerk events"]

key-files:
  created:
    - "src/lib/permissions.ts"
    - "src/trpc/init.ts"
    - "src/trpc/client.tsx"
    - "src/trpc/query-client.ts"
    - "src/trpc/server.tsx"
    - "src/server/routers/_app.ts"
    - "app/api/trpc/[trpc]/route.ts"
    - "proxy.ts"
    - "app/(auth)/layout.tsx"
    - "app/(auth)/sign-in/[[...sign-in]]/page.tsx"
    - "app/(auth)/sign-up/[[...sign-up]]/page.tsx"
    - "app/api/webhooks/clerk/route.ts"
    - "app/(workspace)/layout.tsx"
    - "app/(workspace)/dashboard/page.tsx"
  modified:
    - "app/layout.tsx"

key-decisions:
  - "Used createTRPCReact (tRPC v11 API) instead of plan's createReactTRPCContext which does not exist in v11"
  - "Exported createCallerFactory from t.createCallerFactory (on initTRPC result) rather than importing from @trpc/server"
  - "Phone-only auth configured in Clerk Dashboard, not in code -- SignIn/SignUp components auto-render phone input"
  - "proxy.ts uses default export (clerkMiddleware return) per Next.js 16 proxy.md convention"

patterns-established:
  - "Default-deny RBAC: every tRPC procedure must use protectedProcedure, requireRole, or requirePermission"
  - "Permission matrix: src/lib/permissions.ts is the single source of truth for what each role can do"
  - "Clerk webhook pattern: svix signature verification -> extract publicMetadata role -> db.insert"
  - "tRPC client pattern: createTRPCReact -> trpc.Provider wrapping QueryClientProvider"
  - "tRPC server pattern: createCallerFactory(appRouter) -> cache(async () => createCaller(ctx))"

requirements-completed: [AUTH-01, AUTH-02, AUTH-06, AUTH-07]

# Metrics
duration: 7min
completed: 2026-03-25
---

# Phase 01 Plan 02: Auth + tRPC Infrastructure Summary

**Default-deny tRPC v11 middleware chain with Clerk proxy.ts, permission matrix RBAC, webhook user sync, and phone-only auth pages**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-24T19:56:09Z
- **Completed:** 2026-03-24T20:03:47Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Built complete tRPC v11 infrastructure with three-tier default-deny middleware: enforceAuth (UNAUTHORIZED), requireRole (FORBIDDEN), requirePermission (FORBIDDEN via permission matrix)
- Created permission matrix mapping 6 actions to allowed roles -- anything not listed is automatically FORBIDDEN
- Wired Clerk proxy.ts (Next.js 16 convention) protecting all non-public routes with auth.protect()
- Built webhook handler that syncs Clerk user.created events to DB with role extraction from publicMetadata and svix signature verification
- Root layout wraps entire app in ClerkProvider > TRPCReactProvider for auth + API availability everywhere

## Task Commits

Each task was committed atomically:

1. **Task 1: tRPC initialization with default-deny middleware chain and permission matrix** - `bc54e19` (feat)
2. **Task 2: Clerk proxy.ts, auth pages, webhook handler, and root layout** - `1956f69` (feat)

## Files Created/Modified
- `src/lib/permissions.ts` - Permission matrix with default-deny RBAC (6 permissions across 7 roles)
- `src/trpc/init.ts` - tRPC v11 context (Clerk auth + DB user), protectedProcedure, requireRole, requirePermission
- `src/trpc/client.tsx` - Client-side TRPCReactProvider with React Query integration
- `src/trpc/query-client.ts` - Shared QueryClient factory with 30s stale time
- `src/trpc/server.tsx` - Server-side caller factory for RSC usage
- `src/server/routers/_app.ts` - Root tRPC router (expanded in Plan 03)
- `app/api/trpc/[trpc]/route.ts` - tRPC HTTP handler (GET + POST)
- `proxy.ts` - Clerk middleware for Next.js 16 (NOT middleware.ts)
- `app/(auth)/layout.tsx` - Centered layout for auth pages
- `app/(auth)/sign-in/[[...sign-in]]/page.tsx` - Clerk sign-in page (phone-only via dashboard config)
- `app/(auth)/sign-up/[[...sign-up]]/page.tsx` - Clerk sign-up page (phone-only via dashboard config)
- `app/api/webhooks/clerk/route.ts` - Webhook handler: user.created -> DB insert with role from publicMetadata
- `app/(workspace)/layout.tsx` - Auth-gated workspace layout with UserButton
- `app/(workspace)/dashboard/page.tsx` - Placeholder dashboard page
- `app/layout.tsx` - Updated: wrapped with ClerkProvider + TRPCReactProvider, updated metadata to PolicyDash

## Decisions Made
- **tRPC v11 API correction:** Plan referenced `createReactTRPCContext` from `@trpc/react-query` which does not exist. Used `createTRPCReact` (the actual v11 API) which returns `Provider` and `createClient`.
- **createCallerFactory source:** Plan suggested importing from `@trpc/server` but v11 exposes it as `t.createCallerFactory` on the initTRPC result. Exported from init.ts for server.tsx to consume.
- **Phone-only auth via dashboard:** Clerk components (`<SignIn>`, `<SignUp>`) automatically render the input fields configured in the Clerk Dashboard. No code-level props needed for phone-only.
- **proxy.ts default export:** Clerk's `clerkMiddleware()` returns a `NextMiddleware` function, exported as default per Next.js 16 proxy.md convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected tRPC v11 React API usage**
- **Found during:** Task 1 (client.tsx creation)
- **Issue:** Plan used `createReactTRPCContext` from `@trpc/react-query` which does not exist in tRPC v11. The actual export is `createTRPCReact`.
- **Fix:** Used `createTRPCReact<AppRouter>()` which returns `{ Provider, createClient, ... }`. Adapted client.tsx to use `trpc.Provider` and `trpc.createClient` pattern.
- **Files modified:** src/trpc/client.tsx
- **Verification:** File created with correct imports, all acceptance criteria pass
- **Committed in:** bc54e19 (Task 1 commit)

**2. [Rule 3 - Blocking] Corrected createCallerFactory import path**
- **Found during:** Task 1 (server.tsx creation)
- **Issue:** Plan imported `createCallerFactory` from `@trpc/server` but v11 does not export it directly. It is available as `t.createCallerFactory` from `initTRPC`.
- **Fix:** Exported `createCallerFactory` from `src/trpc/init.ts` (where `t` is created) and imported it in `server.tsx`.
- **Files modified:** src/trpc/init.ts, src/trpc/server.tsx
- **Verification:** Correct export chain established
- **Committed in:** bc54e19 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking issues -- tRPC v11 API differences from plan)
**Impact on plan:** Both fixes necessary to use actual tRPC v11 API. No scope creep.

## Issues Encountered
None beyond the API corrections documented above.

## User Setup Required

**External services require manual configuration.** Before the auth system works:
- Create a Clerk application at https://dashboard.clerk.com (free tier)
- Enable Phone Number as primary sign-in method, disable Email (User & Authentication settings)
- Copy API keys to `.env.local`: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- Create webhook endpoint pointing to `{YOUR_DOMAIN}/api/webhooks/clerk` subscribing to `user.created`
- Copy webhook signing secret to `.env.local` as `CLERK_WEBHOOK_SECRET`

## Next Phase Readiness
- tRPC infrastructure ready for Plan 03 to add user and audit routers
- Permission matrix ready to be extended with new permissions as features ship
- Root router (`_app.ts`) ready for sub-router imports
- All middleware (protectedProcedure, requireRole, requirePermission) ready for use in procedures
- Workspace layout provides the shell for all authenticated pages

## Known Stubs
None -- all files contain complete implementations as specified. The root router `_app.ts` is intentionally empty (populated in Plan 03). The dashboard page shows userId as a placeholder (will be replaced with role-aware content in Phase 8).

## Self-Check: PASSED

All 14 created files and 1 modified file verified present on disk. Both task commits (bc54e19, 1956f69) verified in git log.

---
*Phase: 01-foundation-auth*
*Completed: 2026-03-25*
