---
phase: 23-cardano-preview-net-anchoring
plan: 01
subsystem: infra
tags: [cardano, meshsdk, blockfrost, blockchain, inngest, drizzle, migration]

# Dependency graph
requires:
  - phase: 22-milestone-entity-hashing
    provides: milestones table with contentHash + manifest columns, milestone status enum
provides:
  - src/lib/cardano.ts server-only wrapper (getWallet, buildAndSubmitAnchorTx, checkExistingAnchorTx, isTxConfirmed)
  - Migration 0015 adding txHash + anchoredAt to milestones and document_versions
  - milestone.ready Inngest event type + sendMilestoneReady helper
  - Cardano audit action constants (MILESTONE_ANCHOR_START/COMPLETE/FAIL)
affects: [23-02-inngest-anchor-functions, 23-03-anchor-ui-status]

# Tech tracking
tech-stack:
  added: ["@meshsdk/core ^1.9.0-beta.102", "@meshsdk/wallet ^2.0.0-beta.8", "@blockfrost/blockfrost-js ^6.1.1"]
  patterns: [server-only-cardano-wrapper, lazy-init-wallet, cip10-metadata-label-674, blockfrost-metadata-scan]

key-files:
  created:
    - src/lib/cardano.ts
    - src/db/migrations/0015_cardano_anchoring.sql
  modified:
    - package.json
    - package-lock.json
    - src/db/schema/milestones.ts
    - src/db/schema/changeRequests.ts
    - src/inngest/events.ts
    - src/lib/constants.ts
    - .env.example

key-decisions:
  - "MeshSDK wallet is async (fromMnemonic) -- must be called inside Inngest step.run, never at module load"
  - "Blockfrost project ID prefix validation enforces preview-net only (no mainnet accidents)"
  - "z.guid() for milestone.ready schema fields (not z.uuid()) matching Phase 16+ convention for test fixture compatibility"
  - "CIP-10 label 674 for anchor metadata (Cardano metadata standard)"

patterns-established:
  - "Cardano server-only pattern: import 'server-only' + lazy-init provider/wallet + requireEnv fail-fast"
  - "Three-layer idempotency: DB UNIQUE on txHash + Blockfrost metadata scan + Inngest step.idempotencyKey"

requirements-completed: [VERIFY-06, VERIFY-07, VERIFY-08]

# Metrics
duration: 11min
completed: 2026-04-16
---

# Phase 23 Plan 01: Cardano Infrastructure Layer Summary

**MeshSDK + Blockfrost Cardano wrapper with preview-net wallet, CIP-10 anchor tx builder, DB migration for txHash columns, and milestone.ready Inngest event**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-16T12:38:51Z
- **Completed:** 2026-04-16T12:49:57Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Installed Cardano SDK: @meshsdk/core, @meshsdk/wallet, @blockfrost/blockfrost-js
- Created src/lib/cardano.ts server-only wrapper with 4 exported functions: getWallet, buildAndSubmitAnchorTx, checkExistingAnchorTx, isTxConfirmed
- Migration 0015 adds txHash + anchoredAt columns to milestones and document_versions tables with UNIQUE constraints and hex format check
- Registered milestone.ready Inngest event with validated send helper (z.guid() schema)
- Added three Cardano audit action constants for anchor lifecycle tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Cardano SDK + create src/lib/cardano.ts + DB migration** - `92887c6` (feat)
2. **Task 2: Register milestone.ready Inngest event + add audit action constants** - `e77262a` (feat)

## Files Created/Modified
- `src/lib/cardano.ts` - Server-only Cardano wrapper: wallet init, tx build+submit, metadata scan, tx confirmation
- `src/db/migrations/0015_cardano_anchoring.sql` - txHash + anchoredAt columns on milestones and document_versions with UNIQUE constraints
- `src/db/schema/milestones.ts` - Extended with txHash and anchoredAt columns + milestones_tx_hash_unique constraint
- `src/db/schema/changeRequests.ts` - Extended documentVersions with txHash and anchoredAt columns + document_versions_tx_hash_unique constraint
- `src/inngest/events.ts` - Added milestone.ready event type with Zod schema and sendMilestoneReady helper
- `src/lib/constants.ts` - Added MILESTONE_ANCHOR_START, MILESTONE_ANCHOR_COMPLETE, MILESTONE_ANCHOR_FAIL audit actions
- `package.json` - Added @meshsdk/core, @meshsdk/wallet, @blockfrost/blockfrost-js dependencies
- `.env.example` - Added CARDANO_WALLET_MNEMONIC and BLOCKFROST_PROJECT_ID placeholders

## Decisions Made
- MeshSDK wallet is async (fromMnemonic returns a Promise) -- must always be called inside Inngest step.run, never at module load time
- Blockfrost project ID prefix validation enforces preview-net only to prevent accidental mainnet transactions
- Used z.guid() for all UUID fields in milestone.ready schema, matching Phase 16+ convention for test fixture compatibility
- CIP-10 label 674 used for anchor metadata per Cardano metadata standard
- Network ID hardcoded to 0 (preview-net/testnet) with no env var toggle, per research recommendation D-04

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

Environment variables required before Phase 23 can run live:
- `CARDANO_WALLET_MNEMONIC` - 24-word seed phrase for a preview-net wallet
- `BLOCKFROST_PROJECT_ID` - Must start with 'preview' (obtain from https://blockfrost.io)

See `.env.example` for format.

## Known Stubs
None - all functions are complete implementations. They will fail at runtime without env vars (expected behavior for optional infrastructure).

## Next Phase Readiness
- cardano.ts wrapper ready for Plan 02 Inngest functions (milestoneReadyFn, versionPublishedFn)
- milestone.ready event available for Plan 02 to trigger anchor pipeline
- DB schema extended for Plan 02 to write txHash/anchoredAt after successful anchor
- Audit action constants ready for Plan 02 audit log writes

## Self-Check: PASSED

All 7 created/modified files verified present. Both task commits (92887c6, e77262a) confirmed in git history.

---
*Phase: 23-cardano-preview-net-anchoring*
*Completed: 2026-04-16*
