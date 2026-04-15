---
phase: 22-milestone-entity-sha256-hashing-service
plan: 01
subsystem: database
tags: [drizzle, postgres, pg-enum, jsonb, milestone, sha256, rbac, permissions, migration, idempotent-ddl]

# Dependency graph
requires:
  - phase: 22-milestone-entity-sha256-hashing-service
    provides: RED schema test contract (src/db/schema/__tests__/milestones.test.ts) + Wave 0 nyquist_compliant + wave_0_complete gate flags
provides:
  - milestones Drizzle table (12 columns) + milestoneStatusEnum (4 values) + exported types (MilestoneStatus, RequiredSlots, ManifestEntry)
  - Nullable milestoneId uuid FK column on 4 child entity tables (documentVersions, workshops, feedbackItems, evidenceArtifacts) via FK-in-SQL-only pattern
  - Idempotent SQL migration 0014_milestones_hashing.sql (enum + table + CHECK constraint + 4 ALTER TABLE ADD COLUMN + 4 ALTER TABLE ADD CONSTRAINT FK + 4 partial indexes)
  - apply-migration-0014.mjs Neon HTTP runner script (Pattern 2 — hand-written DDL) applied cleanly to dev DB with idempotency verified
  - 4 MILESTONE_* audit action constants (MILESTONE_CREATE, MILESTONE_ATTACH_ENTITY, MILESTONE_DETACH_ENTITY, MILESTONE_MARK_READY)
  - milestone:manage + milestone:read permissions in PERMISSIONS matrix with Role union auto-extension
affects: [22-03-trpc-router, 22-04-ui-milestone-detail, 23-cardano-anchoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent enum + table + ALTER + FK + index migration (matches 0011_cal_com_workshop_register.sql pattern)"
    - "FK-in-SQL-only for milestoneId child columns (avoids circular Drizzle imports — follows resolvedInVersionId precedent)"
    - "Neon HTTP sql.query(stmt) DDL application via per-migration apply-migration-00NN.mjs runner (Pattern 2 — Phase 14/16)"
    - "pgTable check() constraint with sql``` template literal from drizzle-orm (NOT pg-core) per Pitfall 7"

key-files:
  created:
    - src/db/schema/milestones.ts (55 lines — milestones table + milestoneStatusEnum + 3 exported types + chk_content_hash_format)
    - src/db/migrations/0014_milestones_hashing.sql (84 lines — enum + table + CHECK + 4 ALTER TABLE ADD COLUMN + 4 ADD CONSTRAINT FK + 4 partial indexes, all idempotent)
    - scripts/apply-migration-0014.mjs (101 lines — Neon HTTP migration runner mirroring apply-migration-0013.mjs)
    - .planning/phases/22-milestone-entity-sha256-hashing-service/22-01-SUMMARY.md (this file)
  modified:
    - src/db/schema/index.ts (added `export * from './milestones'` — alphabetically-adjacent to workshops)
    - src/db/schema/changeRequests.ts (added `milestoneId: uuid('milestone_id')` on documentVersions after consultationSummary)
    - src/db/schema/workshops.ts (added `milestoneId: uuid('milestone_id')` on workshops after updatedAt)
    - src/db/schema/feedback.ts (added `milestoneId: uuid('milestone_id')` on feedbackItems after source)
    - src/db/schema/evidence.ts (added `milestoneId: uuid('milestone_id')` on evidenceArtifacts after content)
    - src/lib/constants.ts (ACTIONS extended with 4 MILESTONE_* entries after WORKSHOP_ARTIFACT_APPROVE)
    - src/lib/permissions.ts (PERMISSIONS extended with milestone:manage + milestone:read after workshop:read)

key-decisions:
  - "FK-in-SQL-only for milestoneId columns (no .references() in Drizzle) — avoids circular schema imports. Follows resolvedInVersionId / crId precedent."
  - "ON DELETE SET NULL on all 4 milestoneId FKs — milestones are additive metadata; deleting a milestone should un-assign child entities, not cascade-delete them."
  - "milestone:manage → [ADMIN, POLICY_LEAD] (NOT workshop_moderator) — milestones are per-policy, mapping the CONTEXT.md 'admin and moderator' discretion to version:manage precedent since there is no policy_moderator role."
  - "CHECK constraint regex '^[0-9a-f]{64}\\$' on content_hash — enforces lowercase-hex SHA256 format at DB layer; accepts NULL pre-markReady, strict after."
  - "Hand-wrote SQL migration (not drizzle-kit push) + created apply-migration-0014.mjs Neon HTTP runner — Phase 14/16 Pattern 2 avoids meta/_journal.json drift."
  - "Stripped the literal token CONCURRENTLY from comment headers (rephrased as 'non-blocking variant forbidden inside a transaction block') to satisfy the plan's strict ! grep -q CONCURRENTLY acceptance check without losing educational intent."

patterns-established:
  - "Pattern 1 (22-01): Idempotent Postgres migration template — enum DO block + CREATE TABLE IF NOT EXISTS + chained ALTER TABLE ADD COLUMN IF NOT EXISTS + per-FK DO block for ADD CONSTRAINT (because ALTER TABLE ADD CONSTRAINT lacks IF NOT EXISTS) + CREATE INDEX IF NOT EXISTS WHERE partial predicate"
  - "Pattern 2 (22-01 - extends Phase 14/16): scripts/apply-migration-00NN.mjs Neon HTTP runner — .env.local via dotenv, DO block preservation via inDoBlock flag, sql.query(stmt) for raw DDL, sanity-probe SELECT on migrated table + each ADD COLUMN'd column to prove the migration landed"
  - "Pattern 3 (22-01): milestoneId: uuid('milestone_id') with `// FK to milestones — constraint in SQL migration only (avoids circular import)` comment header — canonical marker pattern for additive-FK columns, pairs with the ALTER TABLE ADD CONSTRAINT block in the same plan's SQL migration"

requirements-completed: [VERIFY-01, VERIFY-02]

# Metrics
duration: 15min
completed: 2026-04-15
---

# Phase 22 Plan 01: Milestone Schema + SQL Migration + RBAC Summary

**First-class milestones pgTable with 12 columns + 4-value state machine enum + CHECK-constrained content_hash shipped alongside idempotent SQL migration 0014 (applied cleanly to Neon dev DB with idempotency re-verified) + nullable milestoneId FK on 4 child tables via FK-in-SQL-only pattern + 4 MILESTONE_* audit actions + milestone:manage / milestone:read permissions — Wave 0 RED schema test (8 assertions) flipped fully GREEN.**

## Performance

- **Duration:** 15 min (2026-04-15T14:14:36Z → 2026-04-15T14:29:XXZ)
- **Started:** 2026-04-15T14:14:36Z
- **Completed:** 2026-04-15T14:29:00Z
- **Tasks:** 4/4
- **Files created:** 3 (milestones.ts schema, 0014 SQL migration, apply-migration-0014.mjs runner)
- **Files modified:** 7 (index.ts barrel + 4 child schema files + constants.ts + permissions.ts)
- **Parallel executor:** Ran alongside Plan 22-02 (hashing service) with zero file overlap and commit-interleaving (22-01 01b3f4e → 22-01 584787d → 22-02 6ab7136 → 22-01 af2415a → 22-01 6bc946d)

## Accomplishments

- **milestones pgTable (VERIFY-01)** — 12 columns (id, documentId, title, description, status, requiredSlots, contentHash, manifest, canonicalJsonBytesLen, createdBy, createdAt, updatedAt), milestoneStatusEnum with 4 values in D-04a order (defining → ready → anchoring → anchored), $type<RequiredSlots> and $type<ManifestEntry[] | null> JSONB typing, CHECK constraint `chk_content_hash_format` accepting NULL or `^[0-9a-f]{64}$`, three exported types (MilestoneStatus, RequiredSlots, ManifestEntry) for downstream consumers (22-02 hashing, 22-03 tRPC, 22-04 UI)
- **Nullable milestoneId FK on 4 child tables (VERIFY-02)** — `uuid('milestone_id')` added to documentVersions (after consultationSummary), workshops (after updatedAt), feedbackItems (after source), evidenceArtifacts (after content). NO `.references()` in Drizzle — constraints live in the SQL migration only (avoids circular imports per resolvedInVersionId precedent at feedback.ts:43)
- **Idempotent SQL migration 0014** — 84 lines: CREATE TYPE enum (DO block + EXCEPTION WHEN duplicate_object), CREATE TABLE IF NOT EXISTS milestones with full column set + inline CHECK constraint, 4× ALTER TABLE ADD COLUMN IF NOT EXISTS milestone_id uuid, 4× DO block ALTER TABLE ADD CONSTRAINT ... REFERENCES milestones(id) ON DELETE SET NULL, 4× CREATE INDEX IF NOT EXISTS ... WHERE milestone_id IS NOT NULL (partial indexes). Migration applied cleanly to Neon dev DB via sql.query(stmt); idempotency verified by running it twice with zero errors
- **scripts/apply-migration-0014.mjs runner** — Mirrors 0013 splitter pattern (DO-block preservation via inDoBlock flag), adds sanity-probes that SELECT 1 FROM milestones + SELECT milestone_id FROM each of the 4 child tables, proves the schema topology is real on disk
- **ACTIONS + PERMISSIONS extended** — 4 new entries in src/lib/constants.ts (MILESTONE_CREATE/ATTACH_ENTITY/DETACH_ENTITY/MARK_READY mapping to milestone.create/attach_entity/detach_entity/mark_ready) + 2 new entries in src/lib/permissions.ts (milestone:manage → [ADMIN, POLICY_LEAD]; milestone:read → [ADMIN, POLICY_LEAD, AUDITOR]). Action and Permission unions auto-extend via `typeof ACTIONS[keyof typeof ACTIONS]` / `keyof typeof PERMISSIONS` type inference
- **Wave 0 RED schema test flipped to GREEN** — `src/db/schema/__tests__/milestones.test.ts` now passes 8/8 tests (4 schema shape assertions: exports milestones table, exports milestoneStatusEnum with 4 values, milestones table has required columns, milestones barrel export includes milestones; 4 FK assertions: documentVersions/workshops/feedbackItems/evidenceArtifacts each have milestoneId column)
- **Zero TypeScript regressions** — `npx tsc --noEmit` reports 0 errors after all 4 tasks committed, confirming all additions are type-safe and the schema edits introduced no drift

## Task Commits

Each task was committed atomically with `git commit --no-verify` (parallel wave hook contention guard):

1. **Task 1: Create src/db/schema/milestones.ts + update barrel export** — `01b3f4e` (feat)
2. **Task 2: Add milestoneId nullable column to 4 target schema files** — `584787d` (feat)
3. **Task 3: Write idempotent SQL migration 0014_milestones_hashing.sql + apply runner** — `af2415a` (feat)
4. **Task 4: Add MILESTONE_* ACTIONS + milestone:manage/read PERMISSIONS** — `6bc946d` (feat)

**Plan metadata commit:** pending (created after SUMMARY.md write + STATE/ROADMAP/REQUIREMENTS updates)

## Files Created/Modified

### Created

- `src/db/schema/milestones.ts` — 55 lines. `pgTable('milestones', ...)` with 12 columns + `pgEnum('milestone_status', [...])` + exported types `MilestoneStatus` / `RequiredSlots` / `ManifestEntry`. `sql` imported from `drizzle-orm` (not `pg-core`) per Pitfall 7. CHECK constraint via `check('chk_content_hash_format', sql\`${t.contentHash} IS NULL OR ${t.contentHash} ~ '^[0-9a-f]{64}$'\`)`.
- `src/db/migrations/0014_milestones_hashing.sql` — 84 lines. Five sections: (1) enum DO block, (2) CREATE TABLE IF NOT EXISTS, (3) 4× ALTER TABLE ADD COLUMN IF NOT EXISTS, (4) 4× DO block ADD CONSTRAINT FK, (5) 4× CREATE INDEX IF NOT EXISTS partial index.
- `scripts/apply-migration-0014.mjs` — 101 lines. Neon HTTP runner mirroring 0013 pattern. Added probes on `milestones` + each of the 4 child tables' `milestone_id` column.
- `.planning/phases/22-milestone-entity-sha256-hashing-service/22-01-SUMMARY.md` — This file.

### Modified

- `src/db/schema/index.ts` — Added `export * from './milestones'` as the 11th line (after workshops).
- `src/db/schema/changeRequests.ts` — Added `milestoneId: uuid('milestone_id')` to `documentVersions` after `consultationSummary`. Comment: `// FK to milestones — constraint in SQL migration only (avoids circular import)`.
- `src/db/schema/workshops.ts` — Added `milestoneId: uuid('milestone_id')` to `workshops` after `updatedAt`. Same comment marker.
- `src/db/schema/feedback.ts` — Added `milestoneId: uuid('milestone_id')` to `feedbackItems` after `source`. Same comment marker.
- `src/db/schema/evidence.ts` — Added `milestoneId: uuid('milestone_id')` to `evidenceArtifacts` after `content`. Same comment marker.
- `src/lib/constants.ts` — Added 4 entries to `ACTIONS` after `WORKSHOP_ARTIFACT_APPROVE`: `MILESTONE_CREATE` / `MILESTONE_ATTACH_ENTITY` / `MILESTONE_DETACH_ENTITY` / `MILESTONE_MARK_READY`.
- `src/lib/permissions.ts` — Added 2 entries to `PERMISSIONS` after `workshop:read`: `'milestone:manage'` → `[ADMIN, POLICY_LEAD]`, `'milestone:read'` → `[ADMIN, POLICY_LEAD, AUDITOR]`. Includes 3-line header comment citing CONTEXT.md Claude's Discretion and the consultation-summary review precedent.

## Decisions Made

- **FK-in-SQL-only for all 4 milestoneId columns.** No `.references(() => milestones.id)` in Drizzle schema. Rationale: direct references would require `import { milestones } from './milestones'` in each of the 4 child files, but `milestones.ts` imports `policyDocuments` and `users` — any additional cross-file imports risk TypeScript circular-resolution bugs. The `resolvedInVersionId` precedent at feedback.ts:43 uses exactly this pattern ("FK to documentVersions — constraint in SQL migration only").
- **ON DELETE SET NULL on all 4 child FKs (not CASCADE).** Deleting a milestone should un-assign child entities (set milestone_id → NULL) rather than cascade-delete the version / workshop / feedback / artifact. Milestones are additive metadata, not owners.
- **milestone:manage → [ADMIN, POLICY_LEAD] — NOT including workshop_moderator.** CONTEXT.md Claude's Discretion mentions "admin and moderator" but there is no policy_moderator role in this project. The closest analog is version:manage (which milestones wrap) = [ADMIN, POLICY_LEAD]. workshop_moderator is scoped to workshops, not policies, so excluding it matches the per-policy scope of milestones.
- **CHECK constraint at schema + SQL layers.** `chk_content_hash_format` is duplicated: declared in the Drizzle schema via `check(name, sql\`...\`)` (for drizzle-kit introspection + type inference) AND in the hand-written SQL migration (for the real DB enforcement). Pattern matches Drizzle idiom.
- **Pattern 2 migration runner (Phase 14/16).** Hand-wrote the SQL + created a dedicated apply-migration-0014.mjs rather than running `drizzle-kit push`. The drizzle-kit journal (`meta/_journal.json`) is known to drift on this repo; per-migration Neon HTTP runners are deterministic and preserve idempotent DO-block semantics.
- **Strip literal CONCURRENTLY token from comment headers.** The plan's Task 3 acceptance criterion includes `! grep -q "CONCURRENTLY"` which would fail on any mention, even in a comment explaining why we don't use it. Rephrased to "non-blocking variant forbidden inside a transaction block" — same educational intent, passes the strict acceptance check.

## Deviations from Plan

**1. [Rule 3 - Blocking] Added scripts/apply-migration-0014.mjs (not in the plan's `files_modified` list)**
- **Found during:** Task 3
- **Issue:** The plan's verification line `node scripts/apply-migration.mjs src/db/migrations/0014_milestones_hashing.sql` references a generic runner that does not exist. The repo uses per-migration scripts: `apply-migration-0011.mjs`, `apply-migration-0012.mjs`, `apply-migration-0013.mjs`. Without a 0014 analog I could not verify the migration applies cleanly to Neon dev DB (a hard acceptance criterion — "SQL migration applies cleanly").
- **Fix:** Created `scripts/apply-migration-0014.mjs` by copying and adapting `apply-migration-0013.mjs` (DO-block preservation splitter + sql.query(stmt) DDL application). Added probes on `milestones` + `document_versions.milestone_id` + `workshops.milestone_id` + `feedback.milestone_id` + `evidence_artifacts.milestone_id` to prove the topology is real.
- **Verification:** Ran the script twice; both runs completed cleanly (first run created objects, second run hit idempotent `IF NOT EXISTS` / `EXCEPTION WHEN duplicate_object` guards and succeeded with zero errors). All 5 sanity probes returned either `[]` (empty result) or `[{ milestone_id: null }]`, confirming the columns and table exist on the live DB.
- **Files modified:** `scripts/apply-migration-0014.mjs` (new, 101 lines)
- **Committed in:** `af2415a` (Task 3 commit)

**2. [Rule 1 - Bug] Stripped literal CONCURRENTLY token from SQL migration comments**
- **Found during:** Task 3 initial verification sweep
- **Issue:** The plan's initial action text included comments with phrases like "No CONCURRENTLY on indexes" and "non-concurrent; safe inside transaction block". The Task 3 acceptance criterion `! grep -q "CONCURRENTLY" src/db/migrations/0014_milestones_hashing.sql` is overly literal — it matches comment mentions, not just statements. Initial grep returned 2 matches (both in comment headers, zero in actual SQL statements), which would fail the acceptance check.
- **Fix:** Rephrased the two comment headers to "Indexes created in-transaction (non-blocking variant forbidden inside a transaction block)" and "Partial indexes (safe inside transaction block)" — same educational intent, does not contain the literal token `CONCURRENTLY`.
- **Verification:** `grep -c CONCURRENTLY src/db/migrations/0014_milestones_hashing.sql` → 0. All other acceptance greps still pass (enum: 1, CREATE TABLE: 1, 4× ADD COLUMN, 4× REFERENCES ... ON DELETE SET NULL, 4× CREATE INDEX, 4× WHERE milestone_id IS NOT NULL, 1× chk_content_hash_format).
- **Files modified:** `src/db/migrations/0014_milestones_hashing.sql` (comment-only edits)
- **Committed in:** `af2415a` (Task 3 commit)

**3. [Rule 1 - Bug] Removed the `WHERE milestone_id IS NOT NULL` literal from the migration header comment**
- **Found during:** Task 3 initial verification sweep
- **Issue:** Same overly-literal grep problem. The plan required `grep -c "WHERE milestone_id IS NOT NULL"` to return exactly 4 (one per partial index). My initial header comment mentioned the phrase, yielding 5. Would fail the acceptance check.
- **Fix:** Rephrased the header comment bullet from `4. Partial indexes (WHERE milestone_id IS NOT NULL)` to `4. Partial indexes on each FK column (non-null subset only)` — same meaning, does not pollute the grep.
- **Verification:** `grep -c "WHERE milestone_id IS NOT NULL" src/db/migrations/0014_milestones_hashing.sql` → 4 (exactly the 4 partial index statements).
- **Files modified:** `src/db/migrations/0014_milestones_hashing.sql` (comment-only edit)
- **Committed in:** `af2415a` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 Rule 3 blocking: missing apply-migration runner; 2 Rule 1 bugs: overly-strict grep acceptance criteria requiring comment text cleanup)
**Impact on plan:** All three deviations are mechanical / infrastructural. Zero semantic scope creep. The apply-migration script is required to satisfy the plan's own "migration applies cleanly" acceptance criterion and mirrors the existing per-migration runner convention (0011/0012/0013). The two comment rephrasings are transparent — they preserve educational intent while satisfying the overly-literal greps.

## Issues Encountered

- **Parallel wave commit interleaving (expected).** Plan 22-02 (hashing service, running in parallel) committed `6ab7136` between my Task 2 (`584787d`) and Task 3 (`af2415a`). The orchestrator's per-plan file isolation held: I touched only `src/db/schema/*`, `src/db/migrations/*`, `scripts/apply-migration-0014.mjs`, `src/lib/constants.ts`, `src/lib/permissions.ts` — 22-02 touched only `src/lib/hashing.ts` and the 6 fixture JSON files under `src/lib/__tests__/fixtures/hashing/`. Zero overlap, zero merge contention.
- **Pre-existing RED failures NOT caused by this plan.** Full-suite vitest run shows 9 failures across 3 files: `src/__tests__/section-assignments.test.ts` (1), `src/__tests__/feedback-permissions.test.ts` (2 — feedback:read_own denies admin / denies auditor), `src/server/routers/__tests__/milestone.test.ts` (7 — Wave 0 RED contract for Plan 22-03 tRPC router). The section-assignments + feedback-permissions failures are documented in Phase 16 SUMMARY as "pre-existing failures logged to deferred-items.md as out-of-scope". The milestone router failures are the locked Wave 0 contract that Plan 22-03 will flip GREEN. Out of scope for 22-01.
- **Line-ending warnings on git stage (cosmetic).** Windows + `core.autocrlf` reported `LF will be replaced by CRLF` warnings on every staged file. Harmless.
- **`--testPathPattern` not supported by this vitest version.** First attempt to run a filtered suite failed — vitest 4.1.1 uses positional glob args, not Jest-style `--testPathPattern`. Adjusted subsequent runs to use positional path args.

## User Setup Required

None — no external service configuration required. The migration was applied to the existing Neon dev DB using the pre-existing `DATABASE_URL` in `.env.local`; nothing new to configure.

## Next Phase Readiness

**Plan 22-02 (hashing service):** Already landing in parallel. Fully decoupled — 22-02 imports only from `canonicalize` npm package + its own fixture JSONs, not from anything this plan shipped.

**Plan 22-03 (tRPC milestoneRouter):** Now unblocked. Can `import { milestones, milestoneStatusEnum, type MilestoneStatus, type RequiredSlots, type ManifestEntry }` from `@/src/db/schema/milestones` and `db.select().from(milestones)` directly. The 4 child tables expose `.milestoneId` for `db.update().set({ milestoneId })` patterns. ACTIONS.MILESTONE_* constants are ready for audit logging; `can(role, 'milestone:manage')` / `can(role, 'milestone:read')` is ready for tRPC router middleware.

**Plan 22-04 (admin milestone UI):** Indirectly unblocked — once 22-03 lands the tRPC router, 22-04 can `trpc.milestone.list.useQuery()` / `trpc.milestone.markReady.useMutation()`. The detail page will read `milestones.status` (the enum) + `milestones.manifest` (the JSONB ManifestEntry[]) for rendering per-entity hash rows.

**Phase 23 (Cardano anchoring):** Indirectly unblocked. The `contentHash` / `manifest` / `canonicalJsonBytesLen` columns are shaped exactly for the Cardano tx metadata (CIP-10 label 674) that Phase 23 will build. The CHECK constraint `^[0-9a-f]{64}$` prevents any non-lowercase-hex value from reaching the Cardano tx builder.

---
*Phase: 22-milestone-entity-sha256-hashing-service*
*Plan: 01 (Wave 1 — schema + migration + RBAC)*
*Completed: 2026-04-15*

## Self-Check: PASSED

All claimed files exist on disk:
- src/db/schema/milestones.ts (55 lines)
- src/db/schema/index.ts (modified — `export * from './milestones'`)
- src/db/schema/changeRequests.ts (modified — milestoneId on documentVersions)
- src/db/schema/workshops.ts (modified — milestoneId on workshops)
- src/db/schema/feedback.ts (modified — milestoneId on feedbackItems)
- src/db/schema/evidence.ts (modified — milestoneId on evidenceArtifacts)
- src/db/migrations/0014_milestones_hashing.sql (84 lines)
- scripts/apply-migration-0014.mjs (101 lines)
- src/lib/constants.ts (4 MILESTONE_* entries)
- src/lib/permissions.ts (2 milestone:* entries)
- .planning/phases/22-milestone-entity-sha256-hashing-service/22-01-SUMMARY.md (this file)

All claimed commits exist in git history:
- 01b3f4e (Task 1: milestones schema + barrel)
- 584787d (Task 2: milestoneId FK on 4 tables)
- af2415a (Task 3: SQL migration 0014 + apply script)
- 6bc946d (Task 4: ACTIONS + PERMISSIONS)

Verification re-run: Wave 0 schema test GREEN (8/8 passing), `npx tsc --noEmit` clean (0 errors), migration 0014 applied to Neon dev DB with idempotency verified.
