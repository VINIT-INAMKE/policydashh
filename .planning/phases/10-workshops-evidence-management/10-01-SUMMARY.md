---
phase: 10-workshops-evidence-management
plan: 01
subsystem: api, database
tags: [tRPC, drizzle, workshops, evidence, postgresql, audit]

# Dependency graph
requires:
  - phase: 01-foundation-auth
    provides: users table, tRPC init, audit infrastructure, permissions framework
  - phase: 04-feedback-system
    provides: feedbackItems table, evidence schema (evidenceArtifacts, feedbackEvidence, sectionEvidence)
  - phase: 02-policy-documents
    provides: policyDocuments, policySections tables
provides:
  - workshops, workshopArtifacts, workshopSectionLinks, workshopFeedbackLinks tables
  - workshopRouter with 12 tRPC procedures (CRUD, artifacts, section/feedback linking)
  - claimsWithoutEvidence evidence query (EV-03)
  - uploaderName join on evidence list queries (EV-04)
  - workshop:manage and workshop:read permissions
  - 9 WORKSHOP_* audit action constants
  - Migration 0006_workshops.sql
affects: [10-02, 10-03, 11-realtime-collaboration]

# Tech tracking
tech-stack:
  added: []
  patterns: [workshop-ownership-check, composite-pk-link-tables, onConflictDoNothing-for-links]

key-files:
  created:
    - src/db/schema/workshops.ts
    - src/db/migrations/0006_workshops.sql
    - src/server/routers/workshop.ts
  modified:
    - src/db/schema/index.ts
    - src/lib/constants.ts
    - src/lib/permissions.ts
    - src/server/routers/_app.ts
    - src/server/routers/evidence.ts

key-decisions:
  - "Ownership check on update/delete: creator or admin can modify, others get FORBIDDEN"
  - "Sequential inserts (no transaction) for attachArtifact — Neon HTTP driver compatibility"
  - "removeArtifact deletes workshop link only, preserves evidenceArtifacts record"
  - "onConflictDoNothing for linkSection/linkFeedback — idempotent link operations"
  - "innerJoin users for uploaderName in evidence queries — users always exist for uploaded artifacts"

patterns-established:
  - "Workshop ownership check: creator or admin guard on mutations"
  - "Composite PK link tables with onConflictDoNothing for idempotent linking"
  - "leftJoin for claimsWithoutEvidence using isNull on join column"

requirements-completed: [WS-01, WS-02, WS-03, WS-04, WS-05, EV-03, EV-04]

# Metrics
duration: 4min
completed: 2026-03-26
---

# Phase 10 Plan 01: Workshop Backend Summary

**4 workshop tables, 12-procedure tRPC router with artifact attach and section/feedback linking, plus evidence router claimsWithoutEvidence query and uploaderName joins**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T07:40:11Z
- **Completed:** 2026-03-26T07:45:06Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- 4 new database tables (workshops, workshop_artifacts, workshop_section_links, workshop_feedback_links) with Drizzle schema and hand-written migration SQL
- Full workshop tRPC router with 12 procedures: create, list, getById, update, delete, attachArtifact, removeArtifact, listArtifacts, linkSection, unlinkSection, linkFeedback, unlinkFeedback
- Evidence router enhanced with claimsWithoutEvidence query (EV-03) supporting document/section/type filters
- Uploader name joins added to listByFeedback and listBySection (EV-04)
- 9 workshop audit action constants and 2 permission entries (workshop:manage, workshop:read)

## Task Commits

Each task was committed atomically:

1. **Task 1: Workshop schema, migration, permissions, and audit constants** - `85186ba` (feat)
2. **Task 2: Workshop tRPC router + evidence router enhancements (EV-03, EV-04)** - `f0c4edb` (feat)

## Files Created/Modified
- `src/db/schema/workshops.ts` - 4 workshop tables with workshopArtifactTypeEnum
- `src/db/migrations/0006_workshops.sql` - DDL for all workshop tables + indexes
- `src/db/schema/index.ts` - Added workshops export
- `src/lib/constants.ts` - 9 WORKSHOP_* audit action constants
- `src/lib/permissions.ts` - workshop:manage and workshop:read permissions
- `src/server/routers/workshop.ts` - Full workshop tRPC router with 12 procedures
- `src/server/routers/_app.ts` - workshopRouter registration
- `src/server/routers/evidence.ts` - EV-03 claimsWithoutEvidence + EV-04 uploaderName joins

## Decisions Made
- Ownership check on update/delete: creator or admin can modify, others get FORBIDDEN
- Sequential inserts (no transaction) for attachArtifact per Neon HTTP driver compatibility pattern
- removeArtifact deletes workshop link only, preserves evidenceArtifacts record for evidence integrity
- onConflictDoNothing for linkSection/linkFeedback for idempotent link operations
- innerJoin users for uploaderName in evidence queries (users always exist for uploaded artifacts)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Workshop backend fully operational for 10-02 (workshop list/detail UI pages)
- Evidence gaps query ready for 10-03 (evidence management UI)
- Migration 0006 ready for DB execution

## Self-Check: PASSED

All 8 files verified present. Both commit hashes (85186ba, f0c4edb) confirmed in git log.

---
*Phase: 10-workshops-evidence-management*
*Completed: 2026-03-26*
