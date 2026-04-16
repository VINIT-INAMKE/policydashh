---
phase: 22-milestone-entity-sha256-hashing-service
plan: 04
subsystem: ui
tags: [milestone, trpc, react, tabs, badge, dialog, checkbox, entity-curation, mark-ready, status-badge]

# Dependency graph
requires:
  - phase: 22-milestone-entity-sha256-hashing-service
    provides: milestoneRouter tRPC (6 procedures - create, list, getById, attachEntity, detachEntity, markReady) from Plan 22-03
  - phase: 22-milestone-entity-sha256-hashing-service
    provides: milestones schema + milestoneId FK on 4 child tables from Plan 22-01
provides:
  - "Milestones" tab in PolicyTabBar visible to admin/policy_lead/auditor
  - /policies/[id]/milestones index page with MilestoneList + CreateMilestoneDialog
  - /policies/[id]/milestones/[milestoneId] detail page with 4-tab entity curation + Mark ready button
  - MilestoneStatusBadge (4-state - defining/ready/anchoring/anchored) using existing semantic tokens
  - MilestoneSlotStatus inline indicators (met/unmet with CheckCircle/X icons)
  - MarkReadyErrorDisplay for structured unmet-slot error panel
  - milestoneId added to version.list, feedback.list, workshop.list selects for entity tab filtering
affects: [23-cardano-anchoring, milestone-ui-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Milestone UI surface follows existing workspace patterns: 'use client' + trpc hooks + use(params) for Promise params"
    - "MilestoneStatusBadge mirrors CRStatusBadge pattern with Badge variant=secondary + className override"
    - "Entity tab uses attach/detach mutations with optimistic-flip pending state + toast feedback"
    - "font-semibold (600) throughout per UI-SPEC Dim 4 — no font-medium in any new file"

key-files:
  created:
    - app/(workspace)/policies/[id]/milestones/page.tsx
    - app/(workspace)/policies/[id]/milestones/_components/milestone-list.tsx
    - app/(workspace)/policies/[id]/milestones/_components/milestone-card.tsx
    - app/(workspace)/policies/[id]/milestones/_components/milestone-status-badge.tsx
    - app/(workspace)/policies/[id]/milestones/_components/create-milestone-dialog.tsx
    - app/(workspace)/policies/[id]/milestones/[milestoneId]/page.tsx
    - app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/milestone-detail-header.tsx
    - app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/milestone-detail-tabs.tsx
    - app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/milestone-entity-tab.tsx
    - app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/milestone-slot-status.tsx
    - app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/mark-ready-error-display.tsx
  modified:
    - app/(workspace)/policies/[id]/_components/policy-tab-bar.tsx
    - app/(workspace)/policies/[id]/layout.tsx
    - src/server/routers/version.ts
    - src/server/routers/feedback.ts
    - src/server/routers/workshop.ts
    - src/__tests__/policy-tab-bar.test.tsx

key-decisions:
  - "Used DialogTrigger render prop pattern for base-ui Dialog (render={trigger as ReactElement}) instead of asChild which does not exist in this version"
  - "Evidence tab renders empty — no document-scoped evidence.list procedure exists; evidence artifacts are scoped to feedback/section join tables"
  - "canManage prop passed optimistically (always true client-side); tRPC milestone:manage permission gate is source of truth for authorization"
  - "Added milestoneId to version.list, feedback.list, workshop.list selects (Rule 2) — minimal, non-architectural change required for entity tab attach/available filtering"

patterns-established:
  - "Milestone UI component tree: index page -> MilestoneList -> MilestoneCard; detail page -> MilestoneDetailHeader + MilestoneDetailTabs -> MilestoneEntityTab"
  - "4-state badge pattern using existing CSS variables (--status-cr-approved-*, --status-cr-merged-*) — no new CSS custom properties"

requirements-completed: [VERIFY-03]

# Metrics
duration: 10min
completed: 2026-04-15
---

# Phase 22 Plan 04: Milestone Admin UI Surface Summary

**Complete admin milestone UI with 6-tab PolicyTabBar, milestone index page with create dialog, and detail page with 4-tab entity curation and mark-ready state transition**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-16T11:00:29Z
- **Completed:** 2026-04-16T11:10:10Z
- **Tasks:** 3
- **Files modified:** 17

## Accomplishments

- Shipped complete admin milestone UI: new "Milestones" tab in PolicyTabBar visible to admin/policy_lead/auditor
- Milestone index page (/policies/[id]/milestones) with MilestoneList + CreateMilestoneDialog + empty state
- Milestone detail page (/policies/[id]/milestones/[milestoneId]) with MilestoneDetailHeader (title + 4-state badge + slot status + Mark ready button + SHA256 hash display) and MilestoneDetailTabs (4 tabs for entity curation with checkbox attach/detach)
- All tRPC procedures wired: milestone.list, milestone.create, milestone.getById, milestone.attachEntity, milestone.detachEntity, milestone.markReady
- UI-SPEC contract satisfied: font-semibold typography, existing semantic color tokens, spacing scale, copywriting verbatim, no new CSS vars, no custom animations

## Task Commits

Each task was committed atomically:

1. **Task 1: Modify layout + tab bar to add Milestones tab** - `62104f5` (feat)
2. **Task 2: Create milestone index route + list + card + status badge + create dialog** - `24da796` (feat)
3. **Task 3: Create milestone detail page + header + tabs + entity tab + slot status + mark-ready** - `e7cf889` (feat)

## Files Created/Modified

- `app/(workspace)/policies/[id]/_components/policy-tab-bar.tsx` - Added canViewMilestones prop + Milestones tab + font-semibold fix
- `app/(workspace)/policies/[id]/layout.tsx` - Computed and passed canViewMilestones prop
- `app/(workspace)/policies/[id]/milestones/page.tsx` - Milestone index page (client component)
- `app/(workspace)/policies/[id]/milestones/_components/milestone-list.tsx` - Scrollable milestone list with skeleton loading + empty state
- `app/(workspace)/policies/[id]/milestones/_components/milestone-card.tsx` - Single milestone row card
- `app/(workspace)/policies/[id]/milestones/_components/milestone-status-badge.tsx` - 4-state badge (defining/ready/anchoring/anchored)
- `app/(workspace)/policies/[id]/milestones/_components/create-milestone-dialog.tsx` - Create form dialog with slot inputs
- `app/(workspace)/policies/[id]/milestones/[milestoneId]/page.tsx` - Milestone detail page (client component)
- `app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/milestone-detail-header.tsx` - Header with badge, slots, mark-ready, hash display
- `app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/milestone-detail-tabs.tsx` - 4-tab container (Versions/Workshops/Feedback/Evidence)
- `app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/milestone-entity-tab.tsx` - Entity list with Attached + Available sections + checkbox mutations
- `app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/milestone-slot-status.tsx` - Inline slot met/unmet indicator
- `app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/mark-ready-error-display.tsx` - Structured unmet-slot error display
- `src/server/routers/version.ts` - Added milestoneId to version.list select
- `src/server/routers/feedback.ts` - Added milestoneId to feedback.list select
- `src/server/routers/workshop.ts` - Added milestoneId to workshop.list select
- `src/__tests__/policy-tab-bar.test.tsx` - Updated for canViewMilestones prop + 6-tab count

## Decisions Made

- **Dialog trigger pattern:** Used `DialogTrigger render={trigger as ReactElement}` since base-ui Dialog does not support `asChild` prop (this project's shadcn uses @base-ui/react)
- **Evidence tab:** Renders empty because no document-scoped evidence.list procedure exists; evidence artifacts are scoped to feedback/section join tables and cannot be listed by document without a new tRPC procedure (out of scope for Phase 22)
- **canManage prop:** Passed optimistically (always true client-side); the tRPC milestone:manage permission gate on the server is the authorization source of truth, returning FORBIDDEN for unauthorized roles
- **milestoneId in list selects:** Added milestoneId to version.list, feedback.list, and workshop.list selects (Rule 2 deviation) so the MilestoneEntityTab can determine attached vs available entities client-side

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added milestoneId to existing list procedure selects**
- **Found during:** Task 3 (milestone detail tabs)
- **Issue:** version.list, feedback.list, and workshop.list selects did not include the milestoneId column, making it impossible for the entity tab to determine which entities are attached to a milestone vs available
- **Fix:** Added `milestoneId: table.milestoneId` to the select object in version.ts, feedback.ts, and workshop.ts list procedures (one line each)
- **Files modified:** src/server/routers/version.ts, src/server/routers/feedback.ts, src/server/routers/workshop.ts
- **Verification:** npx tsc --noEmit clean; entity tab can now compute attached vs available rows
- **Committed in:** e7cf889 (Task 3 commit)

**2. [Rule 3 - Blocking] Updated PolicyTabBar test for new prop + tab count**
- **Found during:** Task 3 (tsc --noEmit revealed test type errors)
- **Issue:** src/__tests__/policy-tab-bar.test.tsx missing required canViewMilestones prop and expected 5 tabs (now 6)
- **Fix:** Added canViewMilestones={true/false} to all render calls; updated admin tab count from 5 to 6; added Milestones tab assertion
- **Files modified:** src/__tests__/policy-tab-bar.test.tsx
- **Verification:** npx vitest run src/__tests__/policy-tab-bar.test.tsx — 5/5 GREEN
- **Committed in:** e7cf889 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both auto-fixes essential for correctness. No scope creep.

## Known Stubs

- **Evidence tab** (milestone-detail-tabs.tsx): Renders with empty `evidenceRows=[]` because no document-scoped evidence listing procedure exists. The evidence.listByFeedback and evidence.listBySection procedures query by feedback/section scope, not document scope. Attach/detach still works if evidence entity IDs are known. Phase 23 can wire a document-scoped evidence query to populate this tab.

## Issues Encountered

- Pre-existing test failures in feedback-permissions.test.ts (2 tests) — auditor role has `feedback:read_own` permission but tests assert false. Not caused by Phase 22 changes; logged to deferred-items.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 22 scope shipped: schema (22-01) + hashing (22-02) + tRPC (22-03) + UI (22-04)
- Phase 22-05 (validation) can now verify the full milestone lifecycle end-to-end
- Phase 23 (Cardano anchoring) can consume the milestone.markReady output (contentHash + manifest) for on-chain submission
- Evidence tab requires a document-scoped evidence listing procedure for full functionality (documented as known stub)
- Smoke-walk deferred to end-of-milestone batch per user preferences

---
*Phase: 22-milestone-entity-sha256-hashing-service*
*Completed: 2026-04-15*
