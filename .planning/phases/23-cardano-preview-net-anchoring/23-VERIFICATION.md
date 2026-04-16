---
phase: 23-cardano-preview-net-anchoring
verified: 2026-04-16T13:09:35Z
status: passed
score: 20/20 must-haves verified
re_verification: false
---

# Phase 23: Cardano Preview-Net Anchoring Verification Report

**Phase Goal:** Every published policy version and completed milestone is SHA256-hashed and anchored to Cardano preview-net via Mesh SDK + Blockfrost, with Verified State badges and Cardanoscan explorer links on the public portal

**Verified:** 2026-04-16T13:09:35Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `src/lib/cardano.ts` exports `getWallet`, `buildAndSubmitAnchorTx`, `checkExistingAnchorTx`, `isTxConfirmed` | VERIFIED | All 4 functions present at expected exports with full implementations |
| 2 | `milestones` table has `txHash` and `anchoredAt` columns with UNIQUE constraint | VERIFIED | `src/db/schema/milestones.ts` lines 49-56; migration 0015 confirms ALTER + UNIQUE |
| 3 | `documentVersions` table has `txHash` and `anchoredAt` columns with UNIQUE constraint | VERIFIED | `src/db/schema/changeRequests.ts` lines 27-31; migration 0015 confirms ALTER + UNIQUE |
| 4 | `milestone.ready` event registered in `events.ts` with Zod schema and `sendMilestoneReady` helper | VERIFIED | `src/inngest/events.ts` lines 370-394; uses `z.guid()` for all UUID fields |
| 5 | Blockfrost project ID validated to start with `'preview'` | VERIFIED | `src/lib/cardano.ts` lines 62-65: `if (!projectId.startsWith('preview'))` |
| 6 | Admin marks milestone ready and `milestoneReadyFn` executes the 5-step pipeline | VERIFIED | `src/inngest/functions/milestone-ready.ts` — steps: `compute-hash`, `persist-hash`, `check-existing-tx`, `submit-tx`, `confirm-poll-N`, `finalize` |
| 7 | `version.published` event triggers `versionAnchorFn` alongside consultation summary | VERIFIED | `src/inngest/functions/version-anchor.ts` triggers on `versionPublishedEvent`; registered in `index.ts` |
| 8 | Both functions use concurrency key `'cardano-wallet'` limit 1 | VERIFIED | Both files: `concurrency: { key: 'cardano-wallet', limit: 1 }` |
| 9 | Blockfrost metadata label pre-check prevents double-anchor (VERIFY-08 layer 2) | VERIFIED | Both functions call `checkExistingAnchorTx` before `buildAndSubmitAnchorTx`; returns existing hash if found |
| 10 | Permanent failure sends admin notification via dispatch pipeline | VERIFIED | `milestone-ready.ts` lines 284-303: `sendNotificationCreate` on `!confirmed` path |
| 11 | `retryAnchor` tRPC mutation re-emits `milestone.ready` for stuck anchoring state | VERIFIED | `src/server/routers/milestone.ts`: `retryAnchor: requirePermission('milestone:manage')` with CONFLICT guard for non-`anchoring` states |
| 12 | Public portal shows Verified badge next to version label in `PublicVersionSelector` | VERIFIED | `public-version-selector.tsx` imports `VerifiedBadge` and renders inline per `SelectItem` |
| 13 | Public portal shows Verified badge in version header row for current anchored version | VERIFIED | `portal/[policyId]/page.tsx` line 150: `<VerifiedBadge txHash={selectedVersion.txHash} />` |
| 14 | Portal shows milestone verification section with `VerifiedBadge` per anchored milestone | VERIFIED | `page.tsx` lines 107-183: DB query for `status='anchored'` milestones + conditional section |
| 15 | Clicking Verified badge opens Cardanoscan preview-net in new tab | VERIFIED | `verified-badge.tsx`: `href="https://preview.cardanoscan.io/transaction/${txHash}"` with `target="_blank" rel="noopener noreferrer"` |
| 16 | No badge shown for unanchored versions or milestones (D-11) | VERIFIED | `verified-badge.tsx` line 9: `if (!txHash) return null` |
| 17 | Admin milestone detail shows Cardanoscan link + txHash when status is `anchored` | VERIFIED | `milestone-detail-header.tsx` lines 124-149: conditional block on `status === 'anchored' && txHash` |
| 18 | Admin sees Retry Anchor button when milestone stuck in `anchoring` state | VERIFIED | `milestone-detail-header.tsx` lines 98-100: `props.status === 'anchoring' && props.canManage` renders `RetryAnchorButton` |
| 19 | All 4 test stub files exist with `it.todo` RED stubs | VERIFIED | All 4 files present with `it.todo` placeholders; 46 stubs across cardano.test.ts, milestone-ready.test.ts, version-anchor.test.ts, verified-badge.test.tsx |
| 20 | Three SDK packages installed: `@meshsdk/core`, `@meshsdk/wallet`, `@blockfrost/blockfrost-js` | VERIFIED | `package.json`: `^1.9.0-beta.102`, `^2.0.0-beta.8`, `^6.1.1` |

**Score:** 20/20 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/cardano.ts` | Server-only Cardano wrapper with 4 exported functions | VERIFIED | Line 1: `import 'server-only'`; exports `getWallet`, `buildAndSubmitAnchorTx`, `checkExistingAnchorTx`, `isTxConfirmed`; 185 lines, substantive |
| `src/db/migrations/0015_cardano_anchoring.sql` | txHash + anchoredAt columns on both tables with UNIQUE constraints | VERIFIED | 26 lines; `ALTER TABLE milestones`, `ALTER TABLE document_versions`, both UNIQUE constraints with idempotent DO blocks |
| `src/inngest/events.ts` | `milestoneReadyEvent` + `sendMilestoneReady` helper | VERIFIED | Lines 370-394: event type, Zod schema with `z.guid()`, validated send helper |
| `src/inngest/functions/milestone-ready.ts` | 5-step `milestoneReadyFn` pipeline | VERIFIED | 310 lines; all 5 steps present (`compute-hash`, `persist-hash`, `check-existing-tx`, `submit-tx`, confirm-loop); finalize with notification |
| `src/inngest/functions/version-anchor.ts` | Per-version `versionAnchorFn` | VERIFIED | 119 lines; 3 steps; triggers on `versionPublishedEvent`; concurrency key correct |
| `src/inngest/functions/index.ts` | Both functions registered | VERIFIED | Lines 12-13: imports; lines 34-35: array entries with phase comments |
| `src/server/routers/milestone.ts` | `sendMilestoneReady` call after `markReady` + `retryAnchor` mutation | VERIFIED | Line 14: import; lines 538-545: fire-and-forget emit; lines 552-580: `retryAnchor` with CONFLICT guard |
| `app/(public)/portal/[policyId]/_components/verified-badge.tsx` | `VerifiedBadge` component with ShieldCheck + Cardanoscan link | VERIFIED | 25 lines; null guard; `preview.cardanoscan.io`; `status-cr-merged-bg/text`; `rounded-full`; aria-label |
| `app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/retry-anchor-button.tsx` | `RetryAnchorButton` with loading state and tRPC mutation | VERIFIED | 44 lines; `variant="outline"`, `min-h-[44px]`; `trpc.milestone.retryAnchor.useMutation`; Loader2 + RefreshCw |
| `app/(public)/portal/[policyId]/_components/public-version-selector.tsx` | Extended with `txHash` prop + inline badge | VERIFIED | Props include `txHash: string \| null`; imports and renders `VerifiedBadge` per SelectItem |
| `app/(public)/portal/[policyId]/page.tsx` | Version txHash in options, badge in header, milestone verification section | VERIFIED | `txHash: v.txHash` in versionOptions; `<VerifiedBadge txHash={selectedVersion.txHash} />`; anchored milestone DB query + conditional section |
| `app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/milestone-detail-header.tsx` | Extended with `txHash`, `anchoredAt`, Cardanoscan link, RetryAnchorButton | VERIFIED | Props include `txHash`, `anchoredAt`; Cardanoscan conditional block; RetryAnchorButton conditional on `anchoring` status |
| `app/(workspace)/policies/[id]/milestones/[milestoneId]/page.tsx` | Passes `txHash` and `anchoredAt` to `MilestoneDetailHeader` | VERIFIED | Lines 47-48: `txHash={milestone.txHash ?? null}`, `anchoredAt={...}` |
| `src/db/schema/milestones.ts` | `txHash` and `anchoredAt` columns + UNIQUE constraint | VERIFIED | Lines 49-50 columns; line 56 unique constraint |
| `src/db/schema/changeRequests.ts` | `txHash` and `anchoredAt` columns + UNIQUE constraint on `documentVersions` | VERIFIED | Lines 27-28 columns; line 31 unique constraint |
| `src/lib/constants.ts` | `MILESTONE_ANCHOR_START`, `MILESTONE_ANCHOR_COMPLETE`, `MILESTONE_ANCHOR_FAIL` | VERIFIED | Lines 88-90 |
| `.env.example` | `CARDANO_WALLET_MNEMONIC` and `BLOCKFROST_PROJECT_ID` placeholders | VERIFIED | Lines 43-44 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/cardano.ts` | `@meshsdk/core` | `BlockfrostProvider + MeshTxBuilder` imports | WIRED | Line 20: `import { BlockfrostProvider, MeshTxBuilder } from '@meshsdk/core'` |
| `src/lib/cardano.ts` | `@meshsdk/wallet` | `MeshCardanoHeadlessWallet + AddressType` imports | WIRED | Line 21: `import { MeshCardanoHeadlessWallet, AddressType } from '@meshsdk/wallet'` |
| `src/lib/cardano.ts` | `@blockfrost/blockfrost-js` | `BlockFrostAPI` import | WIRED | Line 22: `import { BlockFrostAPI } from '@blockfrost/blockfrost-js'` |
| `src/inngest/events.ts` | `inngest client` | `milestoneReadyEvent` send | WIRED | `sendMilestoneReady` calls `inngest.send(event)` |
| `src/inngest/functions/milestone-ready.ts` | `src/lib/cardano.ts` | `buildAndSubmitAnchorTx + checkExistingAnchorTx + isTxConfirmed` | WIRED | Lines 22-25: all 3 imports used in step bodies |
| `src/inngest/functions/milestone-ready.ts` | `src/lib/hashing.ts` | `hashMilestone` for compute-hash step | WIRED | Lines 17-20: imports; line 177: `hashMilestone({...})` |
| `src/inngest/functions/version-anchor.ts` | `src/lib/cardano.ts` | `buildAndSubmitAnchorTx + checkExistingAnchorTx + isTxConfirmed` | WIRED | Lines 8-12: all 3 imports; used in anchor + confirm steps |
| `src/server/routers/milestone.ts` | `src/inngest/events.ts` | `sendMilestoneReady` call after markReady | WIRED | Line 14: import; lines 538-545: fire-and-forget call; lines 568: await call in retryAnchor |
| `app/(public)/portal/[policyId]/page.tsx` | `src/db/schema/changeRequests.ts` | DB query selecting `txHash` from `documentVersions` | WIRED | Line 104: `txHash: v.txHash` sourced from live DB select query (lines 44-54) |
| `app/(public)/portal/[policyId]/page.tsx` | `src/db/schema/milestones.ts` | DB query for anchored milestones | WIRED | Lines 107-121: `db.select({txHash: milestones.txHash}).from(milestones).where(eq(milestones.status, 'anchored'))` |
| `app/(public)/portal/[policyId]/_components/verified-badge.tsx` | Cardanoscan explorer | anchor href with `txHash` | WIRED | Line 11: `` `https://preview.cardanoscan.io/transaction/${txHash}` `` |
| `app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/retry-anchor-button.tsx` | `src/server/routers/milestone.ts` | `trpc.milestone.retryAnchor.useMutation` | WIRED | Line 14: mutation call; router has `retryAnchor` procedure |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `portal/[policyId]/page.tsx` | `versionOptions[].txHash` | `db.select().from(documentVersions)` line 44 | Yes — live DB column, not hardcoded | FLOWING |
| `portal/[policyId]/page.tsx` | `anchoredMilestones[]` | `db.select().from(milestones).where(eq(status,'anchored'))` line 108 | Yes — real DB query filtered by status | FLOWING |
| `portal/[policyId]/page.tsx` | `selectedVersion.txHash` | Mapped from `published` array (DB result) via `versionOptions` | Yes — flows from DB result | FLOWING |
| `milestone-detail-header.tsx` | `txHash`, `anchoredAt` props | Parent page `milestone.txHash` from `milestone.getById` query | Yes — passed from DB-sourced page data | FLOWING |
| `PublicVersionSelector` | `versions[].txHash` | Passed from portal page's `versionOptions` array | Yes — DB-sourced | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `cardano.ts` exports 4 functions | File content check for all 4 export signatures | All 4 present: `getWallet`, `buildAndSubmitAnchorTx`, `checkExistingAnchorTx`, `isTxConfirmed` | PASS |
| `milestoneReadyFn` registered in Inngest serve | `index.ts` array contains `milestoneReadyFn` | Line 34 confirmed | PASS |
| `versionAnchorFn` registered in Inngest serve | `index.ts` array contains `versionAnchorFn` | Line 35 confirmed | PASS |
| Confirm-loop step IDs are unique | Step IDs use counter suffix | `confirm-poll-${attempts}`, `confirm-sleep-${attempts}` in both functions | PASS |
| VerifiedBadge renders null for absent txHash | `if (!txHash) return null` guard | Line 9 of verified-badge.tsx | PASS |
| Cardanoscan URL uses preview-net | `preview.cardanoscan.io/transaction/` | Confirmed in verified-badge.tsx and milestone-detail-header.tsx | PASS |
| All 8 task commits exist in git | `git log --oneline` | All 8 hashes confirmed: `448d76b`, `9dbd2ed`, `92887c6`, `e77262a`, `e6917a0`, `03491df`, `584c9c4`, `afa9a16` | PASS |

Note: Live Cardano transaction submission (Step 7b behavioral) requires `BLOCKFROST_PROJECT_ID` and `CARDANO_WALLET_MNEMONIC` env vars — deferred to end-of-milestone smoke walk per project preference.

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VERIFY-06 | 23-00, 23-01, 23-02 | `milestoneReady` Inngest fn anchors milestone state to Cardano preview-net via Mesh SDK + Blockfrost in 5 steps | SATISFIED | `milestone-ready.ts` implements all 5 steps; `markReady` emits event via `sendMilestoneReady`; `cardano.ts` provides the SDK wrapper |
| VERIFY-07 | 23-00, 23-02 | Every `version.published` event triggers a per-version Cardano anchor tx | SATISFIED | `version-anchor.ts` triggers on `versionPublishedEvent`; fans out from same event as `consultationSummaryGenerateFn` |
| VERIFY-08 | 23-00, 23-01, 23-02 | Cardano anchor fn is idempotent (DB unique + Blockfrost pre-check + concurrency key) | SATISFIED | Three layers wired: DB UNIQUE in migration 0015 + `checkExistingAnchorTx` pre-check in both functions + `concurrency: { key: 'cardano-wallet', limit: 1 }` |
| VERIFY-09 | 23-00, 23-03 | Public `/portal` displays Verified State badges with Cardanoscan preview-net explorer links on anchored versions and milestones | SATISFIED | `VerifiedBadge` rendered in 3 locations (SelectItem, header row, milestone section); null guard for unanchored; Cardanoscan links correct |

No orphaned requirements — all 4 VERIFY-XX IDs are claimed by plans and have verified implementations.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `src/lib/cardano.ts` line 168 | `return null` | — | NOT a stub — this is the intended return value of `checkExistingAnchorTx` when no matching tx found on Blockfrost |
| `verified-badge.tsx` line 9 | `if (!txHash) return null` | — | NOT a stub — D-11 design requirement: no badge for unanchored entities |

No blockers. No warnings. Both `return null` instances are intentional design, not empty implementations.

---

### Human Verification Required

The following items cannot be verified programmatically and are deferred to end-of-milestone smoke walk per project memory `feedback_defer_smoke_walks`:

**1. Live Cardano Transaction Flow**

**Test:** Set `BLOCKFROST_PROJECT_ID` (prefix `preview`) and `CARDANO_WALLET_MNEMONIC` in `.env.local`. Fund the preview wallet with tADA from `faucet.preview.cardano.org`. Mark a milestone ready as an admin.
**Expected:** `milestoneReadyFn` Inngest function executes all 5 steps; `txHash` (64-char hex) written to `milestones.tx_hash`; Verified badge appears on public portal; Cardanoscan link resolves to a real transaction.
**Why human:** Requires live Blockfrost API key, funded preview-net wallet, running Inngest dev server, and end-to-end DB state.

**2. Verified Badge Visual Appearance**

**Test:** Open public portal for a policy with an anchored version. Inspect the version selector row and milestone verification section.
**Expected:** Indigo-tinted pill badge with ShieldCheck icon and "Verified" text, matching UI-SPEC color variables (`--status-cr-merged-bg`, `--status-cr-merged-text`).
**Why human:** CSS variable values and visual rendering cannot be verified programmatically.

**3. Retry Anchor Button UX**

**Test:** Force a milestone to `anchoring` status in DB. Navigate to milestone detail page as admin.
**Expected:** "Retry Anchor" button visible with `RefreshCw` icon; clicking triggers `retryAnchor` mutation; toast "Anchor retry started" appears; button shows loading spinner while pending.
**Why human:** Interactive client component behavior requires browser testing.

---

## Gaps Summary

None. All 20 truths verified, all artifacts substantive and wired, all key links confirmed, all 4 requirements satisfied, no anti-patterns found.

---

_Verified: 2026-04-16T13:09:35Z_
_Verifier: Claude (gsd-verifier)_
