---
phase: 14-collab-rollback
plan: 03
subsystem: backend
tags: [trpc, permissions, constants, drizzle, migration, neon, collaboration, schema-drop]

# Dependency graph
requires:
  - phase: 14-collab-rollback
    plan: 02
    provides: "Clean single-user block-editor.tsx + build-extensions.ts with zero Yjs/Hocuspocus/comment references — unblocks router/schema teardown"
provides:
  - "commentRouter deleted; appRouter no longer registers the comments key"
  - "comment:read / comment:create permission keys purged from PERMISSIONS matrix"
  - "COMMENT_CREATE/REPLY/RESOLVE/REOPEN/DELETE constants purged from ACTIONS"
  - "collaboration.ts schema file deleted; index.ts no longer re-exports it"
  - "0008_drop_collaboration.sql drop migration authored with FK-safe CASCADE order"
  - "Live Neon DB cleaned: ydoc_snapshots, comment_threads, comment_replies tables verified absent"
affects: [14-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct SQL migration application via @neondatabase/serverless when drizzle-kit journal is out of sync (established project pattern — RESEARCH § Open Question 1)"

key-files:
  created:
    - "src/db/migrations/0008_drop_collaboration.sql (7 lines — DROP TABLE IF EXISTS CASCADE x3 in FK-safe order)"
  modified:
    - "src/server/routers/_app.ts (−2 lines: commentRouter import + registration)"
    - "src/lib/permissions.ts (−4 lines: comment:read + comment:create entries and section header)"
    - "src/lib/constants.ts (−6 lines: 5 COMMENT_* action constants)"
    - "src/db/schema/index.ts (−1 line: collaboration re-export)"
  deleted:
    - "src/server/routers/comments.ts (207 lines — entire commentRouter with list/create/createReply/resolve/reopen/delete procedures)"
    - "src/db/schema/collaboration.ts (50 lines — ydocSnapshots/commentThreads/commentReplies table definitions + bytea customType)"

key-decisions:
  - "Skipped `npx drizzle-kit push` entirely and went directly to @neondatabase/serverless for migration application. RESEARCH § Open Question 1 flagged the drizzle-kit journal as out of sync (meta/_journal.json only has entry 0), and `drizzle-kit push` would either prompt interactively or re-derive diffs from a schema that no longer defines these tables. The Neon serverless driver path is deterministic, idempotent (DROP TABLE IF EXISTS), and matches the RESEARCH § Code Examples fallback verbatim. Logged this choice — it is now the preferred path for any future hand-written drop migrations on this project."
  - "Inlined .env.local parsing via fs.readFileSync + regex instead of `require('dotenv')`. Dotenv is not a direct project dependency; parsing a single `DATABASE_URL=\"...\"` line by hand avoids adding a transient dep for a one-shot script."
  - "Committed Task 1 and Task 2 as separate atomic commits. Even though they share a plan, the first is a pure TS surface edit (router/permissions/constants) and the second touches the live database. Separating them lets a future operator git-bisect across the DB-state boundary cleanly."

patterns-established:
  - "Neon serverless driver as the canonical migration-application fallback for hand-written DDL when drizzle-kit push journal drift blocks the primary path"
  - "Pre-drop / post-drop verification via information_schema.tables query in the same script that issues the DROPs — acceptance signal is programmatic, not manual"

requirements-completed: [COLLAB-ROLLBACK-01]

# Metrics
duration: 4min
completed: 2026-04-13
---

# Phase 14 Plan 03: Backend Surface Teardown + Schema Drop Summary

**Deleted the tRPC commentRouter + purged comment permissions/action constants + dropped the collaboration schema file + authored and applied migration 0008 to the live Neon database via the @neondatabase/serverless driver — three collab tables (ydoc_snapshots, comment_threads, comment_replies) confirmed absent via information_schema query, TypeScript compiles cleanly, full test suite at baseline 295/297 with zero new failures.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-13T20:19:00Z
- **Completed:** 2026-04-13T20:23:00Z
- **Tasks:** 2
- **Commits:** 2 (plus this SUMMARY commit)

## Accomplishments

### Task 1 — Delete commentRouter + unregister + clean permissions.ts + clean constants.ts

**Files touched:**

- **Deleted** `src/server/routers/comments.ts` (207 lines). The entire `commentRouter` with six procedures (`list`, `create`, `createReply`, `resolve`, `reopen`, `delete`) — all gated on `comment:read` / `comment:create` permissions, all writing audit logs via `ACTIONS.COMMENT_*`, all querying `commentThreads` / `commentReplies` from the (soon-to-be-dropped) collaboration schema.
- **Edited** `src/server/routers/_app.ts`: removed `import { commentRouter } from './comments'` (was line 13) and `comments: commentRouter,` (was line 27) from the `appRouter` object. `appRouter` now has 11 keys (user, audit, document, feedback, sectionAssignment, evidence, changeRequest, version, traceability, notification, workshop).
- **Edited** `src/lib/permissions.ts`: removed the `// Inline Comments (Phase 11)` section header and the two permission entries `comment:read` and `comment:create`. The trailing `} as const` closes directly after `workshop:read` now.
- **Edited** `src/lib/constants.ts`: removed the five `COMMENT_*` keys from the `ACTIONS` constants object (`COMMENT_CREATE`, `COMMENT_REPLY`, `COMMENT_RESOLVE`, `COMMENT_REOPEN`, `COMMENT_DELETE`). `ACTIONS` now ends at `WORKSHOP_FEEDBACK_UNLINK`.

**Verification:**

- Grep (via graphify-aware search) for the union pattern `commentRouter|comment:read|comment:create|COMMENT_CREATE|COMMENT_REPLY|COMMENT_RESOLVE|COMMENT_REOPEN|COMMENT_DELETE` across `src/` and `app/` → **0 matches**
- `npx tsc --noEmit` → **exits 0 with no output**
- `npm test` → `Test Files  2 failed | 21 passed (23)` / `Tests  2 failed | 295 passed (297)` — identical to Plan 02 baseline (feedback-permissions auditor test + section-assignments DATABASE_URL test). **Zero new failures.**

### Task 2 — Delete collaboration schema + write drop migration + apply to live DB

**Files touched:**

- **Deleted** `src/db/schema/collaboration.ts` (50 lines). The file defined a `bytea` customType and three tables: `ydocSnapshots` (Y.Doc binary blobs keyed by sectionId, CASCADE FK to `policySections`), `commentThreads` (thread metadata, CASCADE FK to `policySections`), and `commentReplies` (replies keyed by `threadId`, CASCADE FK to `commentThreads`).
- **Edited** `src/db/schema/index.ts`: removed line 11 `export * from './collaboration'`. The file now re-exports 10 subsystems instead of 11.
- **Created** `src/db/migrations/0008_drop_collaboration.sql`:

  ```sql
  -- 0008_drop_collaboration.sql
  -- Phase 14: Collab Rollback — remove Yjs persistence and inline comment tables
  -- Drop order matters: comment_replies has FK → comment_threads, so replies first.
  DROP TABLE IF EXISTS comment_replies CASCADE;
  DROP TABLE IF EXISTS comment_threads CASCADE;
  DROP TABLE IF EXISTS ydoc_snapshots CASCADE;
  ```

  `0007_collaboration.sql` was preserved as historical record per RESEARCH § Subsystem: Database Schema.

**Migration application path:**

Skipped the primary `npx drizzle-kit push` path in favor of the documented fallback. RESEARCH § Open Question 1 flagged `meta/_journal.json` as only containing entry 0 — subsequent migrations were applied via push, not via the migration journal — so the cleanest deterministic path is direct SQL execution against the live Neon DB using `@neondatabase/serverless` (already a project dependency).

One-shot Node script executed (see commit for full script):

```text
BEFORE: [{"table_name":"comment_replies"},{"table_name":"comment_threads"},{"table_name":"ydoc_snapshots"}]
dropped comment_replies
dropped comment_threads
dropped ydoc_snapshots
AFTER: []
remaining_collab_tables: 0
```

The script:
1. Parsed `DATABASE_URL` from `.env.local` via `fs.readFileSync` + regex (avoided adding `dotenv` as a transient dep).
2. Ran a pre-check against `information_schema.tables` confirming all 3 tables existed.
3. Issued three `DROP TABLE IF EXISTS ... CASCADE` statements in FK-safe order.
4. Ran a post-check confirming `information_schema.tables` returns 0 rows for those names.
5. Exit code 0 on verification success.

**Verification:**

- `test ! -e src/db/schema/collaboration.ts` → **true**
- `test -e src/db/migrations/0008_drop_collaboration.sql` → **true**
- `test -e src/db/migrations/0007_collaboration.sql` → **true** (historical record preserved)
- Live DB query `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('comment_replies','comment_threads','ydoc_snapshots')` → **0 rows**
- `npx tsc --noEmit` → **exits 0 with no output**
- `npm test` → `Test Files  2 failed | 21 passed (23)` / `Tests  2 failed | 295 passed (297)` — identical baseline. **Zero new failures.**

## Task Commits

1. **Task 1:** `777c1cb` — `refactor(14-03): delete commentRouter and purge comment permissions/actions`
   - 4 files changed, 218 deletions(-)
2. **Task 2:** `60b77d4` — `refactor(14-03): drop collaboration schema and apply migration 0008`
   - 3 files changed, 6 insertions(+), 51 deletions(-)

## Deviations from Plan

**1. [Rule 3 — Blocker Avoidance] Skipped `drizzle-kit push` primary path**

- **Found during:** Task 2 Part D planning
- **Issue:** Plan listed `npx drizzle-kit push` as the primary migration application path, with direct-SQL via psql / Neon driver as fallback only if push conflicted. RESEARCH § Open Question 1 already documented that `meta/_journal.json` is out of sync (only contains entry 0), and `drizzle-kit push` on a schema where tables were just removed from code would either prompt interactively for destructive confirmation or would diff-push against an empty schema target — neither is deterministic in a non-interactive executor.
- **Fix:** Went directly to the Neon serverless driver path (the plan's documented fallback B). Pre- and post-DROP `information_schema.tables` queries in the same Node script gave programmatic acceptance signal.
- **Files modified:** None (just application path)
- **Commit:** Same as Task 2 (`60b77d4`)
- **Justification:** Plan explicitly listed this as a valid path — "Use whichever works — the acceptance signal is that `information_schema.tables` returns zero rows for the three table names." Logged per execution_notes instructions.

**2. [Rule 3 — Blocker Avoidance] Inlined .env.local parsing instead of `require('dotenv')`**

- **Found during:** Task 2 Part D script composition
- **Issue:** Plan's example Node script used `require('dotenv').config({ path: '.env.local' })`. `dotenv` is not a direct dependency in this project's `package.json`.
- **Fix:** Parsed `DATABASE_URL` via `fs.readFileSync('.env.local', 'utf8')` + regex. Same effect, no dep added.
- **Files modified:** None
- **Commit:** Same as Task 2 (`60b77d4`)

No other deviations. Both tasks executed as written otherwise.

## Issues Encountered

None. Both grep audits returned zero on first edit attempt. TSC passed on first check for both tasks. The Neon driver migration applied cleanly on first run — no journal drift errors, no FK constraint violations (FK-safe drop order worked as designed), no permission errors against the live database.

## User Setup Required

None. `.env.local` was already present with a valid `DATABASE_URL` pointing at the dev Neon branch. No interactive prompts. No new dependencies installed.

## Known Stubs

None. Every edit in this plan was a removal or a drop — no placeholder values, no empty state components, no mock data introduced. The commentRouter surface is gone; nothing "stubs" for it in the client (Plan 02 already removed all client references).

## Migration Application Log

Recorded here for future reference and for Plan 04's pre-flight checks:

| Step | Command / Query | Result |
|------|-----------------|--------|
| Pre-check | `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN (...)` | 3 rows: comment_replies, comment_threads, ydoc_snapshots |
| Drop 1 | `DROP TABLE IF EXISTS comment_replies CASCADE` | Success |
| Drop 2 | `DROP TABLE IF EXISTS comment_threads CASCADE` | Success |
| Drop 3 | `DROP TABLE IF EXISTS ydoc_snapshots CASCADE` | Success |
| Post-check | Same SELECT query | 0 rows (exit 0) |

## Next Phase Readiness

**Ready for Plan 04 (`14-04-PLAN.md`):** Final package.json / CSS / env cleanup (Wave 6 of RESEARCH) + REQUIREMENTS.md annotation verification.

- Plan 04 can safely remove `@hocuspocus/provider`, `@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-caret` from `package.json` — nothing in code imports them anymore (Plan 02 stripped editor imports, Plan 03 dropped the schema file that defined the custom bytea type which was the last code-level consumer of anything collab-related).
- Plan 04 can safely remove the `.collaboration-cursor__*` and `.inline-comment-mark` CSS blocks from `app/globals.css` — no DOM element in the app renders those classes anymore.
- Plan 04 can safely remove the commented `# NEXT_PUBLIC_HOCUSPOCUS_URL=...` line from `.env.local` (but **do not commit .env.local**).
- Plan 04 should verify `.planning/REQUIREMENTS.md` already annotates EDIT-06/07/08 with "rolled back in v0.2 Phase 14" text (per RESEARCH, this is already present).

**COLLAB-ROLLBACK-01 status:** Schema drop + router removal components complete. The requirement is fully satisfied for the database and backend surface portions. Package removal in Plan 04 closes out the remaining npm + env + CSS portions.

## Self-Check: PASSED

**File state:**

- ABSENT (OK): `src/server/routers/comments.ts`
- ABSENT (OK): `src/db/schema/collaboration.ts`
- FOUND: `src/db/migrations/0008_drop_collaboration.sql` (7 lines, 3 DROP TABLE CASCADE statements in FK-safe order)
- FOUND: `src/db/migrations/0007_collaboration.sql` (preserved as history)
- FOUND: `src/server/routers/_app.ts` (no commentRouter reference)
- FOUND: `src/lib/permissions.ts` (no comment:read/comment:create)
- FOUND: `src/lib/constants.ts` (no COMMENT_* constants)
- FOUND: `src/db/schema/index.ts` (no collaboration re-export; 10 re-exports total)

**Grep audits (via graphify-aware search, all return 0 matches):**

- `commentRouter|comment:read|comment:create|COMMENT_CREATE|COMMENT_REPLY|COMMENT_RESOLVE|COMMENT_REOPEN|COMMENT_DELETE` in `src/` → 0
- Same pattern in `app/` → 0

**Live DB state:**

- `information_schema.tables` query against Neon for `(comment_replies, comment_threads, ydoc_snapshots)` → 0 rows remaining

**Commits (2/2 found in git log):**

- FOUND: `777c1cb` — Task 1 (refactor: delete commentRouter and purge comment permissions/actions)
- FOUND: `60b77d4` — Task 2 (refactor: drop collaboration schema and apply migration 0008)

**Test results:**

- FOUND: Post-Task-1 `npm test`: 2 failed / 295 passed / 297 total (baseline, zero new failures)
- FOUND: Post-Task-2 `npm test`: 2 failed / 295 passed / 297 total (baseline, zero new failures)
- FOUND: `npx tsc --noEmit` clean both after Task 1 and after Task 2

---
*Phase: 14-collab-rollback*
*Plan: 03*
*Completed: 2026-04-13*
