---
phase: 23-cardano-preview-net-anchoring
plan: 02
subsystem: infra
tags: [cardano, inngest, blockfrost, anchoring, trpc, milestone, version]

# Dependency graph
requires:
  - phase: 23-cardano-preview-net-anchoring
    plan: 01
    provides: src/lib/cardano.ts wrapper, milestone.ready event, txHash DB columns, audit action constants
  - phase: 22-milestone-entity-hashing
    provides: milestones table with contentHash + manifest, hashing service
provides:
  - milestoneReadyFn 5-step Inngest pipeline (compute-hash, persist-hash, check-existing-tx, submit-tx, confirm-loop)
  - versionAnchorFn per-version Cardano anchor on version.published
  - markReady tRPC mutation emits milestone.ready Inngest event
  - retryAnchor tRPC mutation re-emits milestone.ready for stuck anchoring state
affects: [23-03-anchor-ui-status]

# Tech tracking
tech-stack:
  added: []
  patterns: [inngest-5-step-pipeline, cardano-wallet-concurrency-lock, blockfrost-idempotency-precheck, confirm-poll-loop-unique-step-ids]

key-files:
  created:
    - src/inngest/functions/milestone-ready.ts
    - src/inngest/functions/version-anchor.ts
  modified:
    - src/inngest/functions/index.ts
    - src/server/routers/milestone.ts

key-decisions:
  - "actorRole hardcoded to 'admin' in Inngest function audit logs since only admins can trigger markReady/retryAnchor"
  - "versionAnchorFn does not send failure notifications (unlike milestoneReadyFn) -- version anchoring is implicit background work, milestone anchoring is admin-initiated"
  - "confirm-loop uses MAX_ATTEMPTS=20 with 30s sleep (10min total) matching research recommendation"
  - "retryAnchor uses await sendMilestoneReady (not fire-and-forget) since user-initiated retry should confirm event dispatch"

patterns-established:
  - "Cardano confirm-loop pattern: unique step IDs via counter suffix (confirm-poll-N, confirm-sleep-N) for Inngest memoization"
  - "Concurrency key 'cardano-wallet' limit 1 shared across milestone-ready and version-anchor for UTxO contention prevention"

requirements-completed: [VERIFY-06, VERIFY-07, VERIFY-08]

# Metrics
duration: 3min
completed: 2026-04-16
---

# Phase 23 Plan 02: Inngest Anchor Functions + tRPC Wiring Summary

**5-step milestoneReadyFn Cardano anchor pipeline + versionAnchorFn fan-out + markReady event emission + retryAnchor mutation for stuck state recovery**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-16T12:57:15Z
- **Completed:** 2026-04-16T13:00:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created milestoneReadyFn with full 5-step pipeline: compute-hash (re-derives from DB), persist-hash (status anchoring), check-existing-tx (Blockfrost idempotency), submit-tx (CIP-10 label 674), confirm-loop (20 polls x 30s)
- Created versionAnchorFn that fans out from version.published alongside consultationSummaryGenerateFn with separate concurrency key (cardano-wallet vs groq-summary)
- Wired markReady mutation to emit milestone.ready Inngest event after status persist and audit log
- Added retryAnchor mutation for admin recovery from stuck anchoring state with CONFLICT guard

## Task Commits

Each task was committed atomically:

1. **Task 1: Create milestoneReadyFn + versionAnchorFn Inngest functions** - `e6917a0` (feat)
2. **Task 2: Extend markReady to emit Inngest event + add retryAnchor mutation** - `03491df` (feat)

## Files Created/Modified
- `src/inngest/functions/milestone-ready.ts` - 5-step milestoneReadyFn: compute-hash, persist-hash, check-existing-tx, submit-tx, confirm-loop + finalize with failure notification
- `src/inngest/functions/version-anchor.ts` - versionAnchorFn: compute-hash, anchor (pre-check + submit), confirm-and-persist for per-version Cardano anchoring
- `src/inngest/functions/index.ts` - Registered both milestoneReadyFn and versionAnchorFn in functions array
- `src/server/routers/milestone.ts` - markReady emits milestone.ready event + retryAnchor mutation added

## Decisions Made
- actorRole hardcoded to 'admin' in Inngest function audit logs since only admins can trigger the anchor pipeline (markReady and retryAnchor both require milestone:manage permission)
- versionAnchorFn omits failure notification (unlike milestoneReadyFn) because version anchoring is implicit background work triggered by publish, not an explicit admin action
- retryAnchor uses `await sendMilestoneReady()` (not fire-and-forget) so the user gets confirmation that the retry event was dispatched before the mutation returns
- Fixed pre-existing retryAnchor that passed extra fields (contentHash, title) not in milestoneReadySchema -- corrected to match the 3-field schema {milestoneId, triggeredBy, documentId}

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed retryAnchor sendMilestoneReady schema mismatch**
- **Found during:** Task 2
- **Issue:** Pre-existing retryAnchor passed contentHash and title to sendMilestoneReady, but milestoneReadySchema only accepts {milestoneId, triggeredBy, documentId} -- would fail Zod validation at runtime
- **Fix:** Removed extra fields, corrected to 3-field signature matching events.ts schema
- **Files modified:** src/server/routers/milestone.ts
- **Committed in:** 03491df (Task 2 commit)

**2. [Rule 1 - Bug] Fixed retryAnchor error code from PRECONDITION_FAILED to CONFLICT**
- **Found during:** Task 2
- **Issue:** Pre-existing retryAnchor used PRECONDITION_FAILED error code; plan specifies CONFLICT for status mismatch (consistent with other state machine guards in the router)
- **Fix:** Changed error code to CONFLICT with corrected message format
- **Files modified:** src/server/routers/milestone.ts
- **Committed in:** 03491df (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for runtime correctness. No scope creep.

## Issues Encountered
None.

## Known Stubs
None -- all functions are complete implementations. They require CARDANO_WALLET_MNEMONIC and BLOCKFROST_PROJECT_ID env vars at runtime (expected behavior for optional Cardano infrastructure).

## Next Phase Readiness
- Both Inngest functions registered and ready for Plan 03 UI integration (anchor status display, retry button)
- Three-layer idempotency fully wired: DB UNIQUE (Plan 01) + Blockfrost pre-check (this plan) + concurrency key (this plan)
- retryAnchor mutation available for the milestone detail page retry button

## Self-Check: PASSED

All 4 created/modified files verified present. Both task commits (e6917a0, 03491df) confirmed in git history.

---
*Phase: 23-cardano-preview-net-anchoring*
*Completed: 2026-04-16*
