---
phase: 01-foundation-auth
plan: 01
subsystem: database
tags: [drizzle, neon, postgresql, vitest, clerk, trpc, zod, partitioned-audit]

# Dependency graph
requires: []
provides:
  - "Drizzle ORM schema with users (role/org_type enums), partitioned audit_events, workflow_transitions stub"
  - "Neon serverless database connection via @neondatabase/serverless"
  - "Initial SQL migration with partition DDL and immutability rules"
  - "Vitest test runner configured with jsdom environment"
  - "TypeScript constants for ROLES (7), ORG_TYPES (6), ACTIONS (5)"
  - "All Phase 1 npm dependencies installed (Clerk, Drizzle, tRPC, React Query, Zod, svix)"
affects: [01-02, 01-03, 02-documents, 03-editor, 04-feedback]

# Tech tracking
tech-stack:
  added: ["@clerk/nextjs@^7", "drizzle-orm", "@neondatabase/serverless", "@trpc/server@^11", "@trpc/client@^11", "@trpc/react-query@^11", "@tanstack/react-query@^5", "zod", "server-only", "date-fns", "svix", "drizzle-kit", "vitest", "@vitejs/plugin-react", "jsdom", "@testing-library/react", "@testing-library/dom", "vite-tsconfig-paths"]
  patterns: ["Drizzle pgEnum for role/org_type enums", "Hand-written migration for partition DDL", "Neon serverless HTTP driver pattern", "Constants-as-source-of-truth for enum values"]

key-files:
  created:
    - "src/db/schema/users.ts"
    - "src/db/schema/audit.ts"
    - "src/db/schema/workflow.ts"
    - "src/db/schema/index.ts"
    - "src/db/index.ts"
    - "src/lib/constants.ts"
    - "drizzle.config.ts"
    - "vitest.config.mts"
    - ".env.example"
    - "src/db/migrations/0000_initial.sql"
    - "src/db/migrations/meta/_journal.json"
  modified:
    - "package.json"

key-decisions:
  - "Hand-written initial migration instead of drizzle-kit generate (Drizzle cannot express PARTITION BY RANGE)"
  - "Phone column as primary auth identifier, email optional (per user decision: phone-only Clerk auth)"
  - "Audit events table uses composite primary key (id, timestamp) for partition compatibility"
  - "Added passWithNoTests to vitest config so it exits 0 with no test files"
  - "Added .env.example exception to .gitignore (pattern .env* was blocking it)"

patterns-established:
  - "Schema-first: Drizzle schema is single source of truth for all DB types"
  - "Constants mirroring: src/lib/constants.ts mirrors Drizzle enum values for app-level use"
  - "Migration pattern: Hand-written SQL for complex DDL (partitions, rules), drizzle-kit for future simple changes"
  - "Barrel exports: src/db/schema/index.ts re-exports all table definitions"

requirements-completed: [AUTH-03, AUTH-04, AUDIT-01, AUDIT-02, AUDIT-03]

# Metrics
duration: 8min
completed: 2026-03-25
---

# Phase 01 Plan 01: Dependencies, Schema & Config Summary

**Drizzle ORM schema with 7-role user table, monthly-partitioned immutable audit log, and Neon serverless connection -- plus Vitest, Clerk, tRPC, and all Phase 1 dependencies installed**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-24T19:43:40Z
- **Completed:** 2026-03-24T19:51:52Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Installed all 13 Phase 1 npm packages (production + dev) without UNMET dependency errors
- Created Drizzle schema with users table (7-value role enum, 6-value org_type enum, phone/email/clerkId), partitioned audit_events, and workflow_transitions stub
- Hand-wrote initial SQL migration with PARTITION BY RANGE, 3 monthly partitions (Mar/Apr/May 2026), and UPDATE/DELETE immutability rules
- Configured Vitest with jsdom, globals, and passWithNoTests for clean CI behavior
- Established constants.ts as the app-level source of truth for role/org_type enum values

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create project structure** - `f0c09fa` (feat)
2. **Task 2: Create Drizzle database schema, migration, and Neon connection** - `f6adb27` (feat)

## Files Created/Modified
- `package.json` - Added all Phase 1 dependencies and test script
- `vitest.config.mts` - Vitest config with jsdom, globals, tsconfig path support
- `src/lib/constants.ts` - ROLES, ORG_TYPES, ACTIONS constants with TypeScript types
- `.env.example` - Documents all required env vars (DATABASE_URL, Clerk keys, routes)
- `drizzle.config.ts` - Drizzle Kit config pointing to schema and migrations dirs
- `src/db/index.ts` - Neon serverless driver + Drizzle ORM instance export
- `src/db/schema/users.ts` - Users table with roleEnum and orgTypeEnum pgEnums
- `src/db/schema/audit.ts` - Audit events table definition (partitioned in migration)
- `src/db/schema/workflow.ts` - Workflow transitions stub table for Phase 4+
- `src/db/schema/index.ts` - Barrel export for all schema modules
- `src/db/migrations/0000_initial.sql` - Hand-written migration with partition DDL and immutability rules
- `src/db/migrations/meta/_journal.json` - Drizzle migration journal
- `.gitignore` - Added .env.example exception
- `src/server/routers/.gitkeep` - Directory stub for Plan 03
- `src/trpc/.gitkeep` - Directory stub for Plan 02

## Decisions Made
- **Hand-written migration:** Drizzle Kit cannot generate PARTITION BY RANGE syntax, so the initial migration is hand-written SQL. Future simple schema changes can use drizzle-kit generate.
- **Composite PK on audit_events:** PostgreSQL partitioned tables require the partition key in the primary key, so audit_events uses `(id, timestamp)` instead of just `id`.
- **Phone-first auth:** Users table has `phone` as primary identifier and `email` as optional, per user decision to use phone-only Clerk auth.
- **passWithNoTests in vitest:** Added so CI/verification passes cleanly when no test files exist yet.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added passWithNoTests to vitest config**
- **Found during:** Task 1 (vitest verification)
- **Issue:** Vitest exits with code 1 when no test files found, but plan expected exit 0
- **Fix:** Added `passWithNoTests: true` to vitest.config.mts test options
- **Files modified:** vitest.config.mts
- **Verification:** `npx vitest run` exits 0
- **Committed in:** f0c09fa (Task 1 commit)

**2. [Rule 3 - Blocking] Added .env.example exception to .gitignore**
- **Found during:** Task 1 (commit preparation)
- **Issue:** .gitignore pattern `.env*` blocks `.env.example` from being committed
- **Fix:** Added `!.env.example` exception line to .gitignore
- **Files modified:** .gitignore
- **Verification:** `git add .env.example` succeeds
- **Committed in:** f0c09fa (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 blocking issue)
**Impact on plan:** Both fixes necessary for correct behavior. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in `types/validator.ts` (Next.js auto-generated file referencing `../../app/page.js` with wrong path resolution). Not caused by this plan's changes, out of scope.
- Drizzle ORM ships with `gel` module type references that fail without skipLibCheck. Already handled by tsconfig `skipLibCheck: true`.

## User Setup Required

**External services require manual configuration.** Before running the database migration:
- Create a Neon project at https://console.neon.tech (free tier)
- Copy the connection string to `.env.local` as `DATABASE_URL`
- Set up Clerk at https://dashboard.clerk.com with phone-number auth enabled
- Copy Clerk keys to `.env.local`

## Next Phase Readiness
- All npm dependencies installed for Plans 02 (tRPC) and 03 (Clerk auth)
- Schema files ready for `drizzle-kit push` once DATABASE_URL is configured
- Constants and types ready for import by tRPC routers and middleware
- Directory stubs in place for src/server/routers/ and src/trpc/

## Known Stubs
None - all files created contain complete implementations as specified. The workflow_transitions table is intentionally a stub table (documented in schema comment) to be populated by Phase 4+ state machine work.

## Self-Check: PASSED

All 11 created files verified present on disk. Both task commits (f0c09fa, f6adb27) verified in git log.

---
*Phase: 01-foundation-auth*
*Completed: 2026-03-25*
