---
phase: 01-foundation-auth
plan: 03
subsystem: api, auth, audit
tags: [trpc, rbac, permissions, audit-log, clerk, vitest, phone-auth]

# Dependency graph
requires:
  - phase: 01-foundation-auth (plan 01)
    provides: Database schema (users, audit_events), constants, permissions module
  - phase: 01-foundation-auth (plan 02)
    provides: tRPC init (protectedProcedure, requireRole, requirePermission), Clerk webhook handler, auth middleware
provides:
  - writeAuditLog service for all future mutations
  - userRouter with getMe, updateProfile, invite (phone-only), listUsers
  - auditRouter with paginated, filtered list query
  - Root appRouter wiring user and audit sub-routers
  - 31 passing unit tests covering permission matrix, audit service, and webhook logic
affects: [02-documents, 04-feedback, 05-change-requests, 06-versioning]

# Tech tracking
tech-stack:
  added: []
  patterns: [requirePermission-based RBAC on every router procedure, writeAuditLog after every mutation, createUser for phone-only invite flow]

key-files:
  created:
    - src/lib/audit.ts
    - src/server/routers/user.ts
    - src/server/routers/audit.ts
    - src/__tests__/permissions.test.ts
    - src/__tests__/audit.test.ts
    - src/__tests__/webhook.test.ts
  modified:
    - src/server/routers/_app.ts

key-decisions:
  - "Phone invite uses clerk.users.createUser (not invitations API which only supports email)"
  - "Every tRPC mutation writes audit log via writeAuditLog service"
  - "No publicProcedure used in application routers -- all endpoints are either protectedProcedure or requirePermission"

patterns-established:
  - "requirePermission pattern: every router procedure uses requirePermission('scope:action') or protectedProcedure (never publicProcedure)"
  - "Audit logging pattern: every mutation calls writeAuditLog with actorId, actorRole, action, entityType, entityId, payload"
  - "Router wiring pattern: sub-routers imported into _app.ts and namespaced (user, audit)"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-06, AUTH-07, AUDIT-01, AUDIT-02, AUDIT-03]

# Metrics
duration: 6min
completed: 2026-03-24
---

# Phase 01 Plan 03: tRPC Routers & Audit Service Summary

**tRPC user/audit routers with RBAC permission checks, audit log write service, and 31 passing unit tests covering permission matrix, audit immutability, and webhook sync logic**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-24T20:08:47Z
- **Completed:** 2026-03-24T20:15:15Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Audit log write service (writeAuditLog) inserts structured events into audit_events table with actor, action, entity, payload, and IP tracking
- User router enforces RBAC: invite (Admin only via user:invite), listUsers (Admin only via user:list), getMe/updateProfile (any authenticated user via protectedProcedure)
- Audit router enforces RBAC: list (Admin + Auditor only via audit:read) with pagination, filtering by entityType/actorId/action/date range
- 31 unit tests pass: 20 permission matrix tests (all 7 roles x 6 permissions), 3 audit service tests, 8 webhook handler tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Audit log service, user router, audit router, and root router wiring**
   - `e216375` (test): RED - failing audit service tests
   - `425a630` (feat): GREEN - implement all routers and audit service
2. **Task 2: Unit tests for permissions, audit service, and webhook handler**
   - `e886a33` (test): Permission matrix, audit, and webhook test suites

_Note: TDD tasks have multiple commits (test then feat)_

## Files Created/Modified
- `src/lib/audit.ts` - Audit log write service (writeAuditLog function)
- `src/server/routers/user.ts` - User management tRPC router (getMe, updateProfile, invite, listUsers)
- `src/server/routers/audit.ts` - Audit log read tRPC router (list with pagination/filters)
- `src/server/routers/_app.ts` - Root router wiring user and audit sub-routers
- `src/__tests__/permissions.test.ts` - 20 tests for permission matrix across all roles
- `src/__tests__/audit.test.ts` - 3 tests for audit log write service with mocked db
- `src/__tests__/webhook.test.ts` - 8 tests for webhook role and phone extraction logic

## Decisions Made
- **Phone invite via createUser instead of invitations API**: Clerk's Invitations API (createInvitation) only accepts emailAddress, not phoneNumber. For the phone-only auth decision, the invite flow uses `clerk.users.createUser({ phoneNumber: [phone], publicMetadata: { role } })` to pre-create the user account. The user.created webhook then syncs this to our database with the assigned role. This maintains the phone-only constraint without falling back to email.
- **No publicProcedure in application routers**: All data endpoints use either protectedProcedure (for self-operations) or requirePermission (for restricted operations). This enforces default-deny at the router level.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed invite from Clerk Invitations API to Users API**
- **Found during:** Task 1 (User router implementation)
- **Issue:** Plan specified `clerk.invitations.createInvitation({ phoneNumber })` but the Clerk Invitations API only accepts `emailAddress` in CreateParams. Using `phoneNumber` would cause a TypeScript error and runtime failure.
- **Fix:** Used `clerk.users.createUser({ phoneNumber: [input.phone], publicMetadata: { role: input.role }, skipPasswordRequirement: true })` instead. This creates the user directly with the phone number and role, triggering the user.created webhook for database sync.
- **Files modified:** src/server/routers/user.ts
- **Verification:** TypeScript compiles, import from @clerk/backend verified against actual d.ts types
- **Committed in:** 425a630

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix -- the planned API call would have failed at both compile-time and runtime. The createUser approach achieves the same functional result (phone-based invite with role assignment) using the correct Clerk API.

## Issues Encountered
None beyond the Clerk API deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 1 (Foundation & Auth) is complete: database schema, auth middleware, tRPC infrastructure, RBAC permission system, user/audit routers, and test suite all in place
- Ready for Phase 2 (Documents): the tRPC router pattern, permission middleware, and audit logging patterns are established and tested
- Future routers should follow the same pattern: use requirePermission for restricted operations, call writeAuditLog after every mutation

## Self-Check: PASSED

- All 7 created/modified files verified present on disk
- All 3 task commits verified in git log (e216375, 425a630, e886a33)
- 31/31 tests passing

---
*Phase: 01-foundation-auth*
*Completed: 2026-03-24*
