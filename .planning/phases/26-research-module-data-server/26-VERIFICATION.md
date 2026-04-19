---
phase: 26-research-module-data-server
verified: 2026-04-19T23:03:30Z
status: passed
score: 9/9 must-haves verified
gaps: []
human_verification: []
---

# Phase 26: research-module-data-server Verification Report

**Phase Goal:** research_lead and admin can create, manage, review, publish, and retract citable research items attached to a policy document; research items participate in milestone manifests; schema and tRPC surface are in place with full audit/RBAC coverage.

**Verified:** 2026-04-19T23:03:30Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Must-Haves Verified

- [x] **MH-1 (RESEARCH-01): Schema** — `src/db/schema/research.ts` contains `pgTable('research_items'`; 3 link tables (`research_item_section_links`, `research_item_version_links`, `research_item_feedback_links`) with composite PKs. Migration `0025_research_module.sql` contains `CREATE SEQUENCE IF NOT EXISTS research_item_id_seq` (line 33). SQL-only FK `ALTER TABLE` constraints present for `milestoneId` (line 95-98), `previousVersionId` (line 102-106), and `versionId` on link table (line 111-114). `src/db/schema/index.ts` re-exports `research` (line 12).

- [x] **MH-2 (RESEARCH-02): Readable ID** — `src/server/routers/research.ts` line 236 calls `nextval('research_item_id_seq')`. Format at line 239: `` `RI-${String(num).padStart(3, '0')}` ``.

- [x] **MH-3 (RESEARCH-03): Permissions** — `src/lib/permissions.ts` contains all 7 strings at lines 88-96: `research:create`, `research:manage_own`, `research:submit_review`, `research:publish`, `research:retract`, `research:read_drafts`, `research:read_published`. Q3 moderation gate confirmed: `research:publish` and `research:retract` grant only `[ROLES.ADMIN, ROLES.POLICY_LEAD]` — `RESEARCH_LEAD` absent from both (lines 91-92). `src/lib/constants.ts` has exactly 12 `RESEARCH_*` ACTIONS (lines 103-114).

- [x] **MH-4 (RESEARCH-04): Router** — `src/server/routers/research.ts` has exactly 15 procedures: `list`, `listPublic`, `getById` (queries) + `create`, `update`, `submitForReview`, `approve`, `reject`, `retract`, `linkSection`, `unlinkSection`, `linkVersion`, `unlinkVersion`, `linkFeedback`, `unlinkFeedback` (mutations). `_app.ts` line 15 imports `researchRouter`; line 31 registers as `research: researchRouter`. No `z.uuid()` calls found in router (only `z.guid()` throughout). `listPublic` nulls `authors` when `isAuthorAnonymous=true` (lines 191-192 and 216-217 for `getById`).

- [x] **MH-5 (RESEARCH-05): State machine** — `src/server/services/research.lifecycle.ts` exports `VALID_TRANSITIONS` (line 31) and `assertValidTransition` (line 43). In `src/server/services/research.service.ts`, `db.insert(workflowTransitions)` is on line 59 and `db.update(researchItems)` is on line 86 — R6 invariant confirmed (INSERT before UPDATE).

- [x] **MH-6: ManifestEntry union** — `src/db/schema/milestones.ts` contains `'research_item'` in the `entityType` union (line 26) and `research_items?: number` in `RequiredSlots` (line 21). `src/lib/hashing.ts` mirrors the same: `ManifestEntry.entityType` includes `'research_item'` (line 253) and `MilestoneMetadata.requiredSlots` includes `research_items?: number` (line 274).

- [x] **MH-7 (SC7): Test coverage** — All test files pass GREEN:
  - `research-schema.test.ts`: **9 passed**
  - `research-permissions.test.ts`: **50 passed**
  - `research-lifecycle.test.ts`: **16 passed**
  - `research-service.test.ts`: **8 passed**
  - `research-router.test.ts`: **19 passed + 3 todo** (anonymous edge cases deferred to Phase 27)
  - **Total: 102 GREEN + 3 todo**

- [x] **MH-8: TypeScript** — `npx tsc --noEmit` exits clean (zero errors).

- [x] **MH-9: Goal semantics (backend-only)** — Phase delivers schema, migration, permissions, constants, lifecycle service, and 15-procedure tRPC router — no UI claimed. Phase 27 will supply the admin workspace UI; Phase 28 the public listing page.

---

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `research_items` table + 3 link tables with composite PKs exist in schema and migration | VERIFIED | `src/db/schema/research.ts` lines 29-93; `0025_research_module.sql` lines 36-89 |
| 2 | `CREATE SEQUENCE IF NOT EXISTS research_item_id_seq` in migration 0025 | VERIFIED | `0025_research_module.sql` line 33 |
| 3 | SQL-only FKs for milestoneId/previousVersionId/versionId as `ALTER TABLE ... ADD CONSTRAINT` | VERIFIED | `0025_research_module.sql` lines 95-113 |
| 4 | 7 research RBAC permissions with Q3 moderation gate (research_lead locked out of publish/retract) | VERIFIED | `src/lib/permissions.ts` lines 88-96; RESEARCH_LEAD absent from publish and retract grants |
| 5 | 12 RESEARCH_* ACTIONS constants in constants.ts | VERIFIED | `src/lib/constants.ts` lines 103-114 |
| 6 | 15-procedure tRPC router registered under `appRouter.research.*` | VERIFIED | `src/server/routers/research.ts` 15 named procedures; `_app.ts` lines 15, 31 |
| 7 | `nextval('research_item_id_seq')` + `RI-NNN` format in `create` mutation | VERIFIED | `src/server/routers/research.ts` lines 236-239 |
| 8 | VALID_TRANSITIONS + assertValidTransition exported from lifecycle module; R6 INSERT before UPDATE | VERIFIED | `research.lifecycle.ts` lines 31, 43; `research.service.ts` lines 59, 86 |
| 9 | ManifestEntry union and RequiredSlots include `research_item` in both milestones.ts and hashing.ts | VERIFIED | `milestones.ts` lines 21, 26; `hashing.ts` lines 253, 274 |

**Score:** 9/9 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema/research.ts` | Tables + enums | VERIFIED | 94 lines; all 4 tables + 2 enums present |
| `src/db/schema/index.ts` | Re-exports research | VERIFIED | Line 12: `export * from './research'` |
| `src/db/migrations/0025_research_module.sql` | Sequence + tables + SQL FKs | VERIFIED | 129 lines; sequence on line 33, 3 ALTER TABLE constraints |
| `src/lib/permissions.ts` | 7 research permissions | VERIFIED | Lines 88-96 |
| `src/lib/constants.ts` | 12 RESEARCH_* ACTIONS | VERIFIED | Lines 103-114 |
| `src/server/services/research.lifecycle.ts` | VALID_TRANSITIONS + assertValidTransition | VERIFIED | 55 lines; both exported |
| `src/server/services/research.service.ts` | transitionResearch with R6 invariant | VERIFIED | 105 lines; INSERT line 59 < UPDATE line 86 |
| `src/server/routers/research.ts` | 15 procedures | VERIFIED | 623 lines; exactly 15 named procedures |
| `src/server/routers/_app.ts` | `research: researchRouter` registered | VERIFIED | Lines 15 (import) and 31 (registration) |
| `src/db/schema/milestones.ts` | `research_item` in ManifestEntry + RequiredSlots | VERIFIED | Lines 21, 26 |
| `src/lib/hashing.ts` | Mirror of ManifestEntry + RequiredSlots with `research_item` | VERIFIED | Lines 253, 274 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `research.ts` router | `research.lifecycle.ts` | `import { transitionResearch }` from `research.service` | WIRED | Line 3 of `research.ts` imports from service; lifecycle is re-exported through service |
| `research.ts` router | `db.execute(sql nextval)` | `db.execute(sql\`SELECT nextval('research_item_id_seq')\`)` | WIRED | Lines 236-239 of router |
| `_app.ts` | `researchRouter` | `research: researchRouter` | WIRED | Lines 15 + 31 |
| `research.service.ts` | `workflowTransitions` INSERT | `await db.insert(workflowTransitions).values(...)` | WIRED | Line 59; before UPDATE on line 86 |
| `permissions.ts` | router guards | `requirePermission('research:*')` | WIRED | Each of the 15 procedures uses `requirePermission` or `protectedProcedure` |

---

## Requirements Coverage

| Requirement | Source Plan | File | Status | Evidence |
|-------------|------------|------|--------|----------|
| RESEARCH-01 | 26-01-schema-migration | `src/db/schema/research.ts`, `0025_research_module.sql` | SATISFIED | Table + enums + sequence + 3 link tables + SQL FKs all present |
| RESEARCH-02 | 26-05-router-registration | `src/server/routers/research.ts` lines 236-239 | SATISFIED | `nextval('research_item_id_seq')` + `RI-NNN` format verified |
| RESEARCH-03 | 26-02-permissions-constants | `src/lib/permissions.ts` lines 88-96, `src/lib/constants.ts` lines 103-114 | SATISFIED | 7 permissions + 12 ACTIONS; Q3 gate enforced |
| RESEARCH-04 | 26-05-router-registration | `src/server/routers/research.ts` + `_app.ts` | SATISFIED | 15 procedures, all with correct guards, z.guid() throughout |
| RESEARCH-05 | 26-04-lifecycle-service | `research.lifecycle.ts` + `research.service.ts` | SATISFIED | VALID_TRANSITIONS + assertValidTransition + R6 invariant |

All 5 requirements marked `[x]` Complete in `.planning/REQUIREMENTS.md` (lines 228-232). Traceability table rows RESEARCH-01..05 all show Phase 26 / Complete (lines 427-431).

---

## Test Results

| Test File | Expected | Actual | Status |
|-----------|----------|--------|--------|
| `research-schema.test.ts` | 9 passed | 9 passed | PASS |
| `research-permissions.test.ts` | 50 passed | 50 passed | PASS |
| `research-lifecycle.test.ts` | 16 passed | 16 passed | PASS |
| `research-service.test.ts` | 8 passed | 8 passed | PASS |
| `research-router.test.ts` | 19 passed + 3 todo | 19 passed + 3 todo | PASS |
| **Total** | **102 passed + 3 todo** | **102 passed + 3 todo** | **PASS** |

The 3 `it.todo` items are the anonymous-author edge cases in `research-router.test.ts` requiring tRPC `createCaller` + session mocking — correctly deferred to Phase 27 per the plan's decisions.

---

## Anti-Patterns Found

None. No `TODO`, `FIXME`, `PLACEHOLDER`, stub returns (`return null`, `return {}`, `return []`), or hardcoded-empty values found in the 4 implementation files (`research.ts`, `research.service.ts`, `research.lifecycle.ts`, `src/db/schema/research.ts`).

All 12 mutations write audit logs via fire-and-forget `.catch(console.error)`. All 3 link-insert operations use `.onConflictDoNothing()`. No `z.uuid()` calls present.

---

## Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| Router exports 15 procedures | `research-router.test.ts` procedure count assertion | 19 passed (count check included) | PASS |
| R6 invariant INSERT before UPDATE | `research-service.test.ts` callOrder spy | 8 passed | PASS |
| State machine blocks invalid transitions | `research-lifecycle.test.ts` invalid path tests | 16 passed | PASS |
| research_lead excluded from publish/retract | `research-permissions.test.ts` deny matrix | 50 passed | PASS |

Server must be running to test `nextval` sequence generation end-to-end; this is a backend-only phase so no manual browser verification is needed.

---

## Human Verification Required

None. This is a fully backend phase (schema + migration + services + tRPC router). All observable behaviors are verifiable programmatically. The 3 deferred anonymous-author edge cases will be covered by Phase 27's UI integration test machinery.

---

## Gaps Found

None.

---

## Summary

Phase 26 achieves its stated goal in full. The complete backend substrate for citable research items is in place: `research_items` table and 3 link tables in both Drizzle schema and SQL migration 0025 (with correct `CREATE SEQUENCE` and `ALTER TABLE` SQL-only FK constraints for circular references); 7 RBAC permissions with the Q3 moderation gate (research_lead blocked from self-publishing or retracting); 12 audit ACTIONS constants; a 4-state lifecycle machine with `VALID_TRANSITIONS` + `assertValidTransition` in a pure module; `transitionResearch()` service enforcing the R6 INSERT-before-UPDATE invariant; and a 15-procedure tRPC `researchRouter` registered under `appRouter.research.*` with correct permission guards, `z.guid()` UUID validation, fire-and-forget audit writes, idempotent link-table operations, and the Pitfall 5 anonymous-author filter. The `ManifestEntry` union and `RequiredSlots` type in both `milestones.ts` and `hashing.ts` correctly include `research_item`, completing the milestone manifest integration. All 102 test cases are GREEN (9 schema + 50 permissions + 16 lifecycle + 8 service + 19 router), with 3 router edge-case todos intentionally deferred to Phase 27. `npx tsc --noEmit` is clean.

---

_Verified: 2026-04-19T23:03:30Z_
_Verifier: Claude (gsd-verifier)_
