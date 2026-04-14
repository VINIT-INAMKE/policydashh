---
phase: 17-workshop-lifecycle-recording-pipeline-groq
plan: 01
subsystem: database
tags: [drizzle, postgres, neon, trpc, inngest, workshops, state-machine]

# Dependency graph
requires:
  - phase: 17-00 (Wave 0 RED contracts)
    provides: workshop-transition.test.ts (locked test contract — flipped GREEN by this plan, 6/6 passing)
  - phase: 16-flow-5-smoke-notification-dispatch-migration
    provides: Inngest event/helper pattern, sql.query DDL runner pattern, z.guid() vs z.uuid() decision
provides:
  - workshop_status enum + workshops.status column with default 'upcoming'
  - workshop_evidence_checklist table with UNIQUE(workshop_id, slot)
  - workshop_artifacts.review_status (default 'approved') for draft/approved gating
  - evidence_artifacts.content nullable text column for LLM-generated transcript/summary text
  - workshop.transition tRPC mutation with ALLOWED_TRANSITIONS state machine + workflow_transitions audit row
  - workshop.approveArtifact tRPC mutation
  - workshop.completed Inngest event + sendWorkshopCompleted helper
affects: [17-02 Groq llm.ts, 17-03 workshopCompletedFn, 17-04 workshopRecordingProcessedFn, 17-05 UI for workshop status + checklist + approval]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Workshop state machine: ALLOWED_TRANSITIONS const map enforces server-side allowed next states"
    - "workflow_transitions table reused as universal audit log for state machines (precedent: feedback, CR)"
    - "Hand-written SQL migration applied via @neondatabase/serverless sql.query() (Phase 16 Pattern 2)"
    - "z.guid() over z.uuid() for Inngest event schemas to accept version-0 test fixtures (Phase 16 decision)"

key-files:
  created:
    - src/db/migrations/0010_workshop_lifecycle.sql
  modified:
    - src/db/schema/workshops.ts
    - src/db/schema/evidence.ts
    - src/inngest/events.ts
    - src/server/routers/workshop.ts
    - src/lib/constants.ts

key-decisions:
  - "workshopArtifacts.id already existed in current schema — research doc was stale on this; migration only adds review_status"
  - "moderatorId in workshop.completed event uses workshops.createdBy, not the actor performing the transition (per RESEARCH OQ3)"
  - "All 4 statuses are terminal-or-forward: upcoming->in_progress->completed->archived; no rollback transitions allowed"
  - "approveArtifact does not require draft precondition — idempotent flip to approved (test contract will lock semantics)"

patterns-established:
  - "ALLOWED_TRANSITIONS Record<string, string[]>: declarative state machine encoded as top-level const, validated server-side before mutation"
  - "Workshop status mutation flow: fetch row -> validate transition -> update -> insert workflowTransitions audit -> writeAuditLog -> conditional Inngest fire"
  - "workshop.completed Inngest event fires only when toStatus === 'completed', awaited (not fire-and-forget) so transition fails if Inngest send fails"

requirements-completed: [WS-06]

# Metrics
duration: ~12min
completed: 2026-04-14
---

# Phase 17 Plan 01: Workshop Lifecycle State Machine Summary

**Workshop status state machine (upcoming→in_progress→completed→archived) with audited transitions, evidence-checklist substrate, artifact review-status gating, and workshop.completed Inngest event for downstream automation.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-14T06:57Z
- **Completed:** 2026-04-14T07:09Z
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Migration 0010 applied to live Neon dev DB via @neondatabase/serverless sql.query() runner
- Drizzle schema mirrors migration: 4 new enums (workshop_status, checklist_slot, checklist_slot_status, artifact_review_status), 1 new table (workshop_evidence_checklist), 2 new columns (workshops.status, workshop_artifacts.review_status), 1 new column on evidence_artifacts (content)
- workshop.transition mutation with declarative ALLOWED_TRANSITIONS state machine and dual audit (workflow_transitions row + writeAuditLog)
- workshop.approveArtifact mutation flips reviewStatus to 'approved' for the WS-14 human-in-loop approval flow
- workshop.completed Inngest event registered with sendWorkshopCompleted helper, fired conditionally from transition mutation when toStatus === 'completed'
- tsc fully clean (exit 0)

## Task Commits

Each task was committed atomically via --no-verify (parallel-mode safety):

1. **Task 01-01: Write and apply migration 0010_workshop_lifecycle.sql** — `0f4b162` (feat)
2. **Task 01-02: Update Drizzle schema to match migration 0010** — `321ead7` (feat)
3. **Task 01-03: Add workshop.completed event + transition + approveArtifact mutations** — `a6e3796` (feat)

## Files Created/Modified

- `src/db/migrations/0010_workshop_lifecycle.sql` — created; 4 enums, 1 table, 2 ALTER TABLE statements, 1 nullable text column
- `src/db/schema/workshops.ts` — added 4 enum exports, status column on workshops, reviewStatus on workshopArtifacts, workshopEvidenceChecklist table with uniqueIndex
- `src/db/schema/evidence.ts` — added content nullable text column to evidenceArtifacts
- `src/inngest/events.ts` — appended workshop.completed event + sendWorkshopCompleted helper following the established 3-step pattern
- `src/server/routers/workshop.ts` — added ALLOWED_TRANSITIONS const, transition mutation, approveArtifact mutation, workflowTransitions + sendWorkshopCompleted imports
- `src/lib/constants.ts` — appended WORKSHOP_TRANSITION + WORKSHOP_ARTIFACT_APPROVE action constants

## Exact DDL Applied

```sql
CREATE TYPE workshop_status AS ENUM ('upcoming', 'in_progress', 'completed', 'archived');

ALTER TABLE workshops
  ADD COLUMN status workshop_status NOT NULL DEFAULT 'upcoming';

CREATE TYPE checklist_slot AS ENUM (
  'registration_export', 'screenshot', 'recording', 'attendance', 'summary'
);

CREATE TYPE checklist_slot_status AS ENUM ('empty', 'filled');

CREATE TABLE workshop_evidence_checklist (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id  UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  slot         checklist_slot NOT NULL,
  status       checklist_slot_status NOT NULL DEFAULT 'empty',
  artifact_id  UUID REFERENCES evidence_artifacts(id) ON DELETE SET NULL,
  filled_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, slot)
);

CREATE TYPE artifact_review_status AS ENUM ('draft', 'approved');

ALTER TABLE workshop_artifacts
  ADD COLUMN review_status artifact_review_status NOT NULL DEFAULT 'approved';

ALTER TABLE evidence_artifacts
  ADD COLUMN content TEXT;
```

All 8 statements executed successfully against the live Neon dev DB; runner output:

```
Executing: CREATE TYPE workshop_status AS ENUM (...
Executing: ALTER TABLE workshops ADD COLUMN status workshop_status NOT NULL DEFAULT 'upco...
Executing: CREATE TYPE checklist_slot AS ENUM (...
Executing: CREATE TYPE checklist_slot_status AS ENUM ('empty', 'filled')
Executing: CREATE TABLE workshop_evidence_checklist (...
Executing: CREATE TYPE artifact_review_status AS ENUM ('draft', 'approved')
Executing: ALTER TABLE workshop_artifacts ADD COLUMN review_status artifact_review_status...
Executing: ALTER TABLE evidence_artifacts ADD COLUMN content TEXT
Migration 0010 applied.
```

## New Router Procedure Signatures

```typescript
transition: requirePermission('workshop:manage')
  .input(z.object({
    workshopId: z.string().uuid(),
    toStatus: z.enum(['in_progress', 'completed', 'archived']),
  }))
  .mutation(async ({ ctx, input }) => {
    // -> { success: true, fromStatus, toStatus }
  })

approveArtifact: requirePermission('workshop:manage')
  .input(z.object({
    workshopId: z.string().uuid(),
    workshopArtifactId: z.string().uuid(),
  }))
  .mutation(async ({ ctx, input }) => {
    // -> { success: true }
  })
```

ALLOWED_TRANSITIONS map:

```typescript
{
  upcoming:    ['in_progress'],
  in_progress: ['completed'],
  completed:   ['archived'],
  archived:    [],
}
```

## Decisions Made

- **workshopArtifacts.id already existed** — Research doc (RESEARCH.md line 617 + Pitfall 5) was stale. Verified via direct file read of src/db/schema/workshops.ts before writing migration. Migration ONLY adds `review_status` column to workshop_artifacts.
- **moderatorId resolution** — Per RESEARCH OQ3, the workshop.completed event carries `moderatorId = workshops.createdBy` (the original creator), not the user performing the transition. Plan 03 will consume this for nudge routing.
- **Transition mutation awaits sendWorkshopCompleted** — Not fire-and-forget. If Inngest send fails, the entire mutation fails (the transition is the trigger for Plan 03's downstream pipeline; silently dropping it would break WS-13).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Wave 0 race condition with Plan 17-00 (resolved during execution):** During Tasks 01-01 / 01-02 the locked test file `src/server/routers/workshop-transition.test.ts` did not yet exist on disk because Plan 17-00 was running in parallel. Implementation proceeded against the contract spec described in the plan body. Plan 17-00 landed the test file (commit `81945b7` and predecessors) before this plan's final verification step. Final test run: **6/6 GREEN** (`npx vitest run src/server/routers/workshop-transition.test.ts`, ~6.7s). RED → GREEN flip confirmed.

## User Setup Required

None - no external service configuration required for this plan.

## Next Phase Readiness

- WS-06 functionally complete at the router/DB/event layer
- Plan 17-02 can implement src/lib/llm.ts (Groq SDK wrapper) without blocking on this plan
- Plan 17-03 can implement workshopCompletedFn consuming the workshop.completed event registered here
- Plan 17-04 can implement workshopRecordingProcessedFn writing draft artifacts with reviewStatus='draft'
- Plan 17-05 UI work will need to surface workshop.status badge + transition controls

## Self-Check: PASSED

Verified files exist:
- FOUND: src/db/migrations/0010_workshop_lifecycle.sql
- FOUND: src/db/schema/workshops.ts (modified)
- FOUND: src/db/schema/evidence.ts (modified)
- FOUND: src/inngest/events.ts (modified)
- FOUND: src/server/routers/workshop.ts (modified)
- FOUND: src/lib/constants.ts (modified)

Verified commits exist:
- FOUND: 0f4b162 (feat 17-01: migration 0010)
- FOUND: 321ead7 (feat 17-01: drizzle schema)
- FOUND: a6e3796 (feat 17-01: router + event)

Verified acceptance grep counts:
- transition: requirePermission = 1
- approveArtifact: requirePermission = 1
- ALLOWED_TRANSITIONS = 2
- sendWorkshopCompleted in workshop.ts = 2
- workflowTransitions in workshop.ts = 2
- WORKSHOP_TRANSITION/WORKSHOP_ARTIFACT_APPROVE in constants.ts = 2
- workshopCompletedEvent/sendWorkshopCompleted in events.ts = 3
- npx tsc --noEmit exit code = 0
- npx vitest run src/server/routers/workshop-transition.test.ts = 6/6 PASSED (~6.7s)

Known stubs: none. Wave 0 test contract flipped RED → GREEN.

---
*Phase: 17-workshop-lifecycle-recording-pipeline-groq*
*Completed: 2026-04-14*
