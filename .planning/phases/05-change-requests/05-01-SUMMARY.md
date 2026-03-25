---
phase: 05-change-requests
plan: 01
subsystem: api
tags: [xstate, drizzle, trpc, state-machine, change-request, postgresql]

# Dependency graph
requires:
  - phase: 04-feedback-system
    provides: feedback schema, XState 5 pattern, transitionFeedback service, feedback router, permissions matrix, audit constants
provides:
  - changeRequests Drizzle schema with 5 tables (changeRequests, documentVersions, crFeedbackLinks, crSectionLinks + feedback ALTER)
  - XState 5 CR lifecycle machine (5 states, 5 events, rationale guard)
  - transitionCR and mergeCR service functions (atomic merge with version creation)
  - tRPC changeRequestRouter with 12 procedures
  - CR permissions (cr:create, cr:read, cr:manage) and 7 audit action constants
  - Migration 0003 with enum, sequence, tables, indexes, ALTER TABLE
affects: [05-change-requests, 06-versioning, 07-traceability]

# Tech tracking
tech-stack:
  added: []
  patterns: [CR state machine replicating feedback machine pattern, atomic merge transaction, version label generation]

key-files:
  created:
    - src/db/schema/changeRequests.ts
    - src/db/migrations/0003_change_requests.sql
    - src/server/machines/changeRequest.machine.ts
    - src/server/services/changeRequest.service.ts
    - src/server/routers/changeRequest.ts
    - src/__tests__/cr-machine.test.ts
    - src/__tests__/cr-permissions.test.ts
  modified:
    - src/db/schema/feedback.ts
    - src/db/schema/index.ts
    - src/lib/permissions.ts
    - src/lib/constants.ts
    - src/server/routers/_app.ts

key-decisions:
  - "documentVersions defined before changeRequests to avoid forward-reference for mergedVersionId FK"
  - "resolvedInVersionId added to feedback as plain uuid (no .references()) to avoid circular import between feedback.ts and changeRequests.ts -- FK constraint in SQL migration only"
  - "mergeCR uses db.transaction for atomic version create + CR update + feedback bulk-update + transition log"
  - "getNextVersionLabel parses v0.N pattern and increments; defaults to v0.1 for first version"

patterns-established:
  - "CR machine: setup({types,guards,actions}).createMachine() -- same XState 5 pattern as feedback"
  - "Atomic merge: transaction wrapping version insert + status update + linked entity bulk-update + workflow log"
  - "Version labeling: v0.N auto-incrementing from documentVersions table"

requirements-completed: [CR-01, CR-02, CR-03, CR-04, CR-05, CR-06, CR-07, CR-08]

# Metrics
duration: 6min
completed: 2026-03-25
---

# Phase 05 Plan 01: CR Backend Summary

**XState 5 CR lifecycle machine with 5-state workflow, atomic mergeCR transaction creating document versions, and 12-procedure tRPC router enforcing role-based permissions**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-25T04:41:52Z
- **Completed:** 2026-03-25T04:47:56Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Complete CR data model: changeRequests, documentVersions (stub), crFeedbackLinks, crSectionLinks tables with all FKs, indexes, and CR-NNN sequence
- XState 5 state machine enforcing Drafting -> In Review -> Approved -> Merged -> Closed lifecycle with rationale guard on CLOSE
- Atomic mergeCR function: creates document version + updates CR status + bulk-updates linked feedback resolvedInVersionId + logs workflow transition
- 12 tRPC procedures: create, list, getById, submitForReview, approve, requestChanges, merge, close, addSection, removeSection, listTransitions, getNextVersionLabel
- 38 unit tests passing: 16 machine transition tests + 21 permission tests + context update tests

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): CR machine and permissions tests** - `7197f1b` (test)
2. **Task 1 (TDD GREEN): Schema, migration, machine, permissions, constants** - `02c5243` (feat)
3. **Task 2: CR service + tRPC router + app registration** - `bf42361` (feat)

_Note: Task 1 followed TDD pattern with RED (failing tests) then GREEN (implementation) commits._

## Files Created/Modified
- `src/db/schema/changeRequests.ts` - Drizzle schema for changeRequests, documentVersions, crFeedbackLinks, crSectionLinks tables
- `src/db/migrations/0003_change_requests.sql` - Migration with enum, sequence, 4 tables, ALTER TABLE, 4 indexes
- `src/server/machines/changeRequest.machine.ts` - XState 5 CR lifecycle machine (5 states, 5 events, hasRationale guard)
- `src/server/services/changeRequest.service.ts` - transitionCR (11-step pattern), mergeCR (atomic transaction), getNextVersionLabel helper
- `src/server/routers/changeRequest.ts` - tRPC router with 12 procedures, permission enforcement, audit logging
- `src/__tests__/cr-machine.test.ts` - 16 tests for CR state machine transitions, guards, final states, context updates
- `src/__tests__/cr-permissions.test.ts` - 21 tests for 7 roles x 3 CR permissions
- `src/db/schema/feedback.ts` - Added resolvedInVersionId uuid column (plain, no .references())
- `src/db/schema/index.ts` - Added changeRequests re-export
- `src/lib/permissions.ts` - Added cr:create, cr:read, cr:manage permissions
- `src/lib/constants.ts` - Added 7 CR audit action constants
- `src/server/routers/_app.ts` - Registered changeRequestRouter

## Decisions Made
- documentVersions defined before changeRequests in schema file to allow mergedVersionId FK without forward-reference
- resolvedInVersionId on feedback table added as plain uuid without .references() to avoid circular import between feedback.ts and changeRequests.ts; FK constraint defined only in SQL migration
- mergeCR uses db.transaction() for atomicity across version creation, CR status update, feedback bulk-update, and workflow transition logging
- getNextVersionLabel queries latest version by createdAt desc and parses v0.N to increment; returns v0.1 if no versions exist

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing: section-assignments.test.ts fails due to missing DATABASE_URL (Neon connection required). Unrelated to CR changes. All 209 other tests pass.

## User Setup Required

None - no external service configuration required.

## Known Stubs

- `src/db/schema/changeRequests.ts` documentVersions table is a minimal stub for Phase 6 -- only columns needed for merge (no content snapshots, diff data). Phase 6 will extend this table.

## Next Phase Readiness
- CR backend fully operational: all 8 requirement IDs (CR-01 through CR-08) have backend support
- Phase 05 Plans 02/03 (CR list UI, detail/merge UI) can wire directly to these working endpoints
- Phase 06 (Versioning) will extend documentVersions table with content snapshots and diff data

## Self-Check: PASSED

All 13 files verified present. All 3 commit hashes (7197f1b, 02c5243, bf42361) found in git log.

---
*Phase: 05-change-requests*
*Completed: 2026-03-25*
