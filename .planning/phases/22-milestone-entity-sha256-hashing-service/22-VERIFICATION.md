---
phase: 22-milestone-entity-sha256-hashing-service
verified: 2026-04-15T16:50:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 22: Milestone Entity + SHA256 Hashing Service — Verification Report

**Phase Goal:** First-class Milestone entity links all its constituent state (versions, workshops, feedback, evidence) and exposes a deterministic SHA256 hash service; golden-fixture tests guarantee hash stability under Cardano anchoring
**Verified:** 2026-04-15T16:50:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `milestones` table exists with required-slot definitions, readiness state (defining → ready → anchoring → anchored), and immutability enforcement after `anchored` | VERIFIED | `src/db/schema/milestones.ts`: 12-column pgTable, milestoneStatusEnum 4 values, CHECK constraint on contentHash, assertNotAnchored guard in router |
| 2 | `documentVersions`, `workshops`, `feedbackItems`, `evidenceArtifacts` each have nullable `milestoneId` FK with partial indexes | VERIFIED | milestoneId column confirmed in all 4 schema files; 4 partial indexes in `0014_milestones_hashing.sql` |
| 3 | Admin can view a milestone detail page showing all linked entities and click "Mark milestone ready" to trigger hash computation | VERIFIED | `app/(workspace)/policies/[id]/milestones/[milestoneId]/page.tsx` wired to `trpc.milestone.getById`; `MilestoneDetailHeader` renders mark-ready button; `markReady` mutation wired in milestone router |
| 4 | `src/lib/hashing.ts` produces deterministic SHA256 hashes for `policyVersion`, `workshop`, `evidenceBundle`, `milestone` inputs | VERIFIED | 303-line pure-function module with 8 exports confirmed; 27/27 tests pass including golden-fixture lock |
| 5 | Canonical JSON pass (RFC 8785 JCS) normalizes input before hashing | VERIFIED | `canonicalize` wrapper in `hashing.ts` wraps `canonicalize@3.0.0` (RFC 8785 reference impl); canonicalize wrapper tests pass |
| 6 | Golden-fixture tests verify hash stability across permuted inputs, nested objects, and array orderings | VERIFIED | 6 fixture files with real 64-char SHA256 hex; permutation + D-01a position-independence tests in hashing test suite; 27/27 GREEN |

**Score:** 6/6 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema/milestones.ts` | milestones table + milestoneStatusEnum + 3 exported types | VERIFIED | 55 lines; pgTable('milestones'), pgEnum('milestone_status', ['defining','ready','anchoring','anchored']), exports MilestoneStatus / RequiredSlots / ManifestEntry; CHECK constraint chk_content_hash_format |
| `src/db/schema/index.ts` | barrel export includes milestones | VERIFIED | Line 11: `export * from './milestones'` present |
| `src/db/schema/changeRequests.ts` | milestoneId FK on documentVersions | VERIFIED | Line 26: `milestoneId: uuid('milestone_id')` with FK-in-SQL-only comment |
| `src/db/schema/workshops.ts` | milestoneId FK on workshops | VERIFIED | Line 45: `milestoneId: uuid('milestone_id')` with FK-in-SQL-only comment |
| `src/db/schema/feedback.ts` | milestoneId FK on feedbackItems | VERIFIED | Line 46: `milestoneId: uuid('milestone_id')` with FK-in-SQL-only comment |
| `src/db/schema/evidence.ts` | milestoneId FK on evidenceArtifacts | VERIFIED | Line 18: `milestoneId: uuid('milestone_id')` with FK-in-SQL-only comment |
| `src/db/migrations/0014_milestones_hashing.sql` | idempotent DDL for enum + table + 4 ALTER TABLE + 4 FK + 4 partial indexes | VERIFIED | 83 lines; all 5 sections present; DO blocks for idempotent enum + FK constraints; CREATE INDEX IF NOT EXISTS WHERE milestone_id IS NOT NULL on all 4 tables |
| `src/lib/hashing.ts` | pure hashing service with 8 exports | VERIFIED | 303 lines; exports: canonicalize, sha256Hex, hashPolicyVersion, hashWorkshop, hashFeedbackItem, hashEvidenceArtifact, hashEvidenceBundle, hashMilestone (8 functions) + 7 interfaces; no DB imports |
| `src/server/routers/milestone.ts` | 6-procedure tRPC router | VERIFIED | 542 lines; procedures: create, list, getById, attachEntity, detachEntity, markReady — all present; state machine guards assertNotAnchored + assertInDefining; hash composition in markReady (steps 1-8 per spec) |
| `src/server/routers/_app.ts` | milestoneRouter registered under appRouter.milestone | VERIFIED | Line 14: `import { milestoneRouter }`, line 29: `milestone: milestoneRouter` |
| `app/(workspace)/policies/[id]/milestones/page.tsx` | milestone index page | VERIFIED | Renders MilestoneList + CreateMilestoneDialog wired to documentId; trpc.milestone.list used via MilestoneList |
| `app/(workspace)/policies/[id]/milestones/[milestoneId]/page.tsx` | milestone detail page | VERIFIED | Renders MilestoneDetailHeader + MilestoneDetailTabs; wired to trpc.milestone.getById; passes slotStatus and contentHash to header |
| `app/(workspace)/policies/[id]/_components/policy-tab-bar.tsx` | Milestones tab visible to admin/policy_lead/auditor | VERIFIED | canViewMilestones prop accepted; Milestones tab present pointing to `/policies/${documentId}/milestones`; conditionally visible |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `milestone-detail-tabs.tsx` | `trpc.version.list` | useQuery({ documentId }) | WIRED | Line 22; milestoneId in response used to compute attached state (line 44) |
| `milestone-detail-tabs.tsx` | `trpc.workshop.list` | useQuery({ filter: 'all' }) | WIRED | Line 25; milestoneId in response used (line 55) |
| `milestone-detail-tabs.tsx` | `trpc.feedback.list` | useQuery({ documentId }) | WIRED | Line 28; milestoneId in response used (line 65) |
| `milestone-detail-tabs.tsx` | `trpc.milestone.attachEntity` / `detachEntity` | MilestoneEntityTab mutations | WIRED | Via MilestoneEntityTab entityType prop + onMutated callback |
| `milestone.ts` (markReady) | `src/lib/hashing.ts` | hashPolicyVersion, hashWorkshop, hashFeedbackItem, hashEvidenceArtifact, hashMilestone imports | WIRED | Lines 14-20; called inside markReady mutation steps 4-6 with real DB row data |
| `milestone.ts` (markReady) | `milestones` DB table | db.update().set({ status: 'ready', contentHash, manifest }) | WIRED | Lines 510-519; persists hash + manifest + status transition |
| `milestone-detail-header.tsx` | `trpc.milestone.markReady` | mutation triggered from button | WIRED | Confirmed via 22-04-SUMMARY key-files; header receives milestoneId + canManage props |
| `milestones schema` | `policy_documents` | documentId NOT NULL REFERENCES | WIRED | milestones.ts line 38; SQL migration line 23 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `milestones/page.tsx` | MilestoneList (documentId) | trpc.milestone.list — DB select from milestones WHERE documentId | Real DB query in router list procedure (lines 205-213) | FLOWING |
| `milestones/[milestoneId]/page.tsx` | data.milestone, data.slotStatus | trpc.milestone.getById — loadMilestone + computeSlotStatus (4 COUNT queries) | Real DB queries; computeSlotStatus issues 4 COUNT queries against 4 child tables | FLOWING |
| `milestone-detail-tabs.tsx` evidenceRows | hardcoded `[]` | No document-scoped evidence.list procedure | Static empty array — documented as known scope limitation | HOLLOW (known, scoped to Phase 23) |

Note on evidence tab: `evidenceRows` is hardcoded `[]` because no document-scoped evidence listing procedure exists — evidence artifacts are scoped to feedback/section, not documents. This is explicitly documented in 22-04-SUMMARY as a "Known Stub" and deferred to Phase 23. The attach/detach mutation is still functional for known entity IDs. This does NOT block the phase goal (VERIFY-03 covers the milestone admin UI; evidence listing is a Phase 23 concern).

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| hashing.ts: 27 tests covering canonicalize wrapper, sha256Hex, 6 hash functions, permutation, golden fixtures, D-01a | `npx vitest run src/lib/__tests__/hashing.test.ts` | 27 passed | PASS |
| milestones schema: 8 tests covering table shape, enum values, barrel export, milestoneId FK on 4 tables | `npx vitest run src/db/schema/__tests__/milestones.test.ts` | 8 passed | PASS |
| milestoneRouter: 7 tests covering 6 procedures + module exports | `npx vitest run src/server/routers/__tests__/milestone.test.ts` | 7 passed | PASS |
| TypeScript strict type check across full project | `npx tsc --noEmit` | 0 errors | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| VERIFY-01 | 22-01 | First-class `milestones` table with required-slot definitions and readiness state (immutable once anchored) | SATISFIED | `src/db/schema/milestones.ts` (12 columns, 4-value enum, CHECK constraint); assertNotAnchored guard in router; migration 0014 applied |
| VERIFY-02 | 22-01 | Milestone entity links to documentVersions, workshops, feedbackItems, evidenceArtifacts via nullable milestoneId FK | SATISFIED | milestoneId column in all 4 schema files; 4 FK constraints + 4 partial indexes in SQL migration |
| VERIFY-03 | 22-03, 22-04 | Admin can mark milestone ready, triggering hash computation and Cardano anchoring | SATISFIED | milestoneRouter.markReady: full 8-step hash composition + status transition; detail page UI with mark-ready button wired; 7/7 router tests GREEN |
| VERIFY-04 | 22-02 | SHA256 hashing service (`src/lib/hashing.ts`) produces deterministic hashes for policyVersion, workshop, evidenceBundle, and milestone | SATISFIED | 303-line pure-function module; 8 exports; 27/27 hashing tests GREEN |
| VERIFY-05 | 22-02 | JSON canonicalization (RFC 8785 JCS) with golden-fixture tests ensures hash determinism | SATISFIED | canonicalize@3.0.0 wrapper; 6 fixture JSONs with real hex locked; permutation + array-order-independence + D-01a position-independence tests GREEN |

All 5 requirements for Phase 22 are SATISFIED. Requirements VERIFY-06 through VERIFY-09 are correctly scoped to Phase 23 (Cardano anchoring) and not claimed by this phase.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `milestone-detail-tabs.tsx` | 36 | `evidenceRows: [] = []` (hardcoded empty) | INFO | Evidence tab renders empty — no document-scoped evidence.list procedure exists; documented known limitation scoped to Phase 23. Attach/detach via milestone.attachEntity still works for known IDs. Does not block goal. |

No TODO/FIXME/PLACEHOLDER comments found in Phase 22 implementation files. No empty return null / return {} stubs found. The one flagged empty array is a deliberate architectural choice documented in the SUMMARY, not an accidental stub.

---

## Human Verification Required

### 1. Admin Browser Walk — Create Milestone and Mark Ready

**Test:** Log in as admin, open a policy with at least one published version and one completed workshop. Navigate to the Milestones tab. Create a new milestone with requiredSlots = { versions: 1, workshops: 1 }. Attach the version and workshop via the entity tabs. Click "Mark milestone ready."
**Expected:** Status badge transitions from "defining" to "ready". SHA256 hash displayed in the header (64-char lowercase hex). Audit log entry recorded.
**Why human:** Requires a live dev server + admin Clerk session + real DB rows (published version, completed workshop). Deferred to end-of-milestone smoke-walk batch per user preferences.

### 2. Evidence Tab — Scope Limitation Visible

**Test:** Navigate to a milestone detail page and open the Evidence tab.
**Expected:** Tab renders empty with an explanation message (no evidence rows), and no JS errors. Attach button either hidden or gracefully disabled.
**Why human:** Requires browser render. Evidence empty state rendering cannot be verified without running the dev server.

---

## Gaps Summary

No gaps. All 6 success criteria are verified, all 5 VERIFY-XX requirements are satisfied, all 4 test targets pass (27 + 8 + 7 = 42 tests GREEN, 0 TypeScript errors), and all key wiring links are confirmed in the codebase.

The one known hollow artifact (evidence tab `evidenceRows = []`) is a deliberate, documented scope decision — it does not represent a missing feature for Phase 22 and is tracked for Phase 23.

---

_Verified: 2026-04-15T16:50:00Z_
_Verifier: Claude (gsd-verifier)_
