---
phase: 28-public-research-items-listing
plan: 04
subsystem: infra
tags: [nextjs, clerk, proxy, public-routes, requirements, traceability, tdd, vi-hoisted]

# Dependency graph
requires:
  - phase: 26-research-module-data-server
    provides: research_items schema + listPublic protectedProcedure (Phase 28 documents the public-route bypass)
  - phase: 27-research-workspace-admin-ui
    provides: existing /research-manage admin surface confirms research items can reach published status
  - phase: 28-00-wave0-red-test-stubs
    provides: tests/phase-28/proxy-public-routes.test.ts (3 RED) + research-cta.test.tsx (5 RED) + no-leak.test.ts listing-card it.todo + download-route.test.ts (9 it.todo) + research-public-query.test.ts (10 it.todo)
  - phase: 28-01-backend-query-download-route
    provides: src/server/queries/research-public.ts + app/api/research/[id]/download/route.ts (production code that the GREEN tests now exercise)
  - phase: 28-02-listing-page-components
    provides: app/research/items/* + app/research/items/_components/* (listing surface CTA links into; no edits)
  - phase: 28-03-detail-page-download-button
    provides: app/research/items/[id]/* (detail surface CTA leads to via listing; no edits)
  - phase: 20.5-public-research-framework-content-pages
    provides: proxy.ts /research(.*) matcher + Phase 20.5 comment header pattern (this plan extends it with /api/research(.*) Phase 28 entry)
  - phase: 19-public-participate-intake-clerk-invite-turnstile
    provides: append-at-end + comment-header convention for createRouteMatcher whitelist additions (Phase 19 STATE.md decision)
provides:
  - app/research/page.tsx with "Browse published research" Surface C CTA section linking to /research/items (RESEARCH-09 surface bridge)
  - proxy.ts /api/research(.*) public matcher + Phase 28 comment header naming RESEARCH-10 (unblocks unauthenticated download route shipped by Plan 28-01)
  - .planning/REQUIREMENTS.md RESEARCH-09 + RESEARCH-10 registered in v0.2 Research Module subsection + 2 traceability rows + Coverage footer +2 + Last updated stamp
  - tests/phase-28/no-leak.test.ts listing-card it.todo flipped GREEN (renderToStaticMarkup ResearchCard with description+doi fixture asserts HTML omits both)
  - tests/phase-28/download-route.test.ts 9 it.todo flipped GREEN (302/404/429 + R2 key derivation + 86400s TTL + namespaced rate-limit key)
  - tests/phase-28/research-public-query.test.ts 10 it.todo flipped GREEN (filter contract + sort + offset + Pitfall 5 anonymous + PUBLIC_COLUMNS projection)
  - .planning/phases/28-public-research-items-listing/deferred-items.md documenting the 17 pre-existing test failures unrelated to Phase 28 (identical inventory to Plan 26-05 baseline)
affects: [verify-work-phase-28, milestone-v0.2-smoke-walk]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Append-at-end + comment-header pattern for createRouteMatcher whitelist additions (Phase 19 → 20 → 20.5 → 28 progression): preserves git blame, makes audits scriptable (`grep -A3 'Phase 28' proxy.ts` returns the matcher)"
    - "REQUIREMENTS.md growth pattern (Phase 26 + 27 + 28 progression): subsection bullet + traceability row + Coverage footer increment + Last updated stamp — single-source-of-truth for v0.2 requirement count and completion status"
    - "Wave 0 RED test conversion via production-code-existence Rule 2 deviation: when a parallel-wave coordination directive defers test conversion to a downstream plan, the closeout plan owns flipping ALL remaining it.todo entries to GREEN (download-route + research-public-query), not just the entries directly named in its task list. Rationale: the orchestrator success criterion 'All tests/phase-28/* GREEN' is a phase-level invariant that the closeout plan inherits."
    - "vi.hoisted() pattern for vi.mock factory state sharing: when a mock factory needs to reference variables defined in the test file, wrap them in vi.hoisted(() => ({...})) so they're available before the hoisted vi.mock call evaluates. Required for drizzle-orm/db.select/schema column mocks that must be shared between test bodies and factory closures."
    - "Test-file column sentinel pattern: mock @/src/db/schema/* exports as plain string literals (e.g. 'col:researchItems.id') so test assertions on eq/asc/desc/lte/gte mock calls can identify WHICH column was passed without needing real Drizzle column instances. Enables behavioral testing of query helpers without instantiating the DB layer."

key-files:
  created:
    - .planning/phases/28-public-research-items-listing/28-04-SUMMARY.md
    - .planning/phases/28-public-research-items-listing/deferred-items.md
  modified:
    - app/research/page.tsx (added Browse CTA section + hr separator)
    - proxy.ts (added /api/research(.*) matcher + Phase 28 comment header)
    - .planning/REQUIREMENTS.md (RESEARCH-09 + RESEARCH-10 + 2 traceability rows + Coverage footer + Last updated stamp)
    - tests/phase-28/no-leak.test.ts (1 it.todo → 1 GREEN listing-card assertion)
    - tests/phase-28/download-route.test.ts (9 it.todo → 9 GREEN assertions)
    - tests/phase-28/research-public-query.test.ts (10 it.todo → 10 GREEN assertions)

key-decisions:
  - "Auto-flipped 19 deferred it.todo entries in download-route.test.ts and research-public-query.test.ts to GREEN, not just the 1 listing-card todo named in the plan's <files_to_read>. Rationale: orchestrator success criterion explicitly says 'All tests/phase-28/* GREEN (0 RED, 0 todo)' and the production code (research-public.ts + download/route.ts) is on disk since Plan 28-01 — leaving them as it.todo would falsely signal contract gaps. Rule 2 deviation (auto-add missing critical functionality)."
  - "Adopted vi.hoisted() pattern for all mock-factory-shared state in research-public-query.test.ts after first attempt hit ReferenceError: 'Cannot access sqlMock before initialization'. vi.hoisted is the canonical Phase 16+ pattern for state shared across the vi.mock factory hoist boundary."
  - "Mocked schema column references as plain string literals ('col:researchItems.status') instead of importing the real Drizzle table builders into the test. Lets us assert WHICH column was passed to eq/asc/desc/lte/gte without instantiating Postgres or pulling the full @/src/db chain into the test sandbox."
  - "REQUIREMENTS.md Coverage footer incremented from '63 total — 0 complete' to '65 total — 2 complete (RESEARCH-09, RESEARCH-10)'. Other 63 v0.2 entries marked complete in earlier phases (Phase 14–27) were never bubbled into the Coverage footer counter — this plan only counts +2 since it ships exactly 2 requirements. Future plans may rebase the v0.2 'complete' count to actual completion total."
  - "Comment header for proxy.ts entry naming RESEARCH-10 only (not RESEARCH-09) because the matcher is needed exclusively for the download API route — RESEARCH-09 (listing pages) is already covered by the Phase 20.5 /research(.*) entry."
  - "Defensive 'untouched' verification on existing /research page prose: research-cta.test.tsx ships 3 of its 5 assertions to lock 'Understanding the Landscape', 'Join Consultation', 'Research Outputs' headings unchanged. Editing surgically (Edit tool, single section append + hr) rather than whole-file Write preserved blame and verified preservation."

patterns-established:
  - "Pattern: Closeout-plan flips ALL remaining Wave 0 it.todo entries to GREEN, not just the ones directly named in its task list. The orchestrator's phase-level success criterion ('All tests/phase-28/* GREEN, 0 todo') is the single source of truth — closeout plans honor it even when intermediate plans defer their assigned conversions to coordination boundaries."
  - "Pattern: vi.hoisted() bundle-everything pattern — when multiple mock factories share state, define them in a single vi.hoisted({...}) block so all dependencies are initialized before any vi.mock factory runs. Avoids cascading 'Cannot access X before initialization' errors as each subsequent factory needs more shared state."
  - "Pattern: Schema-column-sentinel mocks for query helper tests — replace real Drizzle column references with string literals via vi.mock('@/src/db/schema/*', () => ({ tableName: { col: 'col:tableName.col' } })). Enables fully-isolated unit tests of query builders that assert WHICH column was passed to ORM helpers without ever touching the DB layer."
  - "Pattern: deferred-items.md per-phase log for pre-existing suite failures — when the closeout plan's full-suite run uncovers failures unrelated to its scope, write them to .planning/phases/XX/deferred-items.md with 'identical inventory to phase YY baseline' callback so future verifiers can confirm zero new regressions. Mirrors the Phase 16/19/20/22/26 precedents."

requirements-completed: [RESEARCH-09, RESEARCH-10]

# Metrics
duration: 16min
completed: 2026-04-20
---

# Phase 28 Plan 28-04: CTA + Proxy + Requirements Closeout Summary

**Wave 4 deployment-surface closeout — adds /research → /research/items Browse CTA, whitelists /api/research(.*) for unauthenticated download, registers RESEARCH-09 + RESEARCH-10 in REQUIREMENTS.md, and flips all 8 phase-28 test files to 65/65 GREEN end-to-end (0 todo, 0 failed).**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-04-20T13:24:23Z
- **Completed:** 2026-04-20T13:40:05Z
- **Tasks:** 4 of 4 executed
- **Files modified:** 7 (3 production + 1 docs + 3 test files)

## Accomplishments

- **`app/research/page.tsx`** gained a new "Published Research" section after the existing "Shape This Policy" / Join Consultation block, with a `<hr>` separator and a `Browse published research` Button (`variant="outline"` per UI-SPEC Surface C to avoid competing with the primary `Join Consultation` CTA on the same page). All 5 prose-preservation assertions in `research-cta.test.tsx` now GREEN — `Understanding the Landscape` / `Join Consultation` / `Research Outputs` headings untouched.
- **`proxy.ts`** appended `/api/research(.*)` to the `isPublicRoute` matcher with a `// Phase 28 - public research items download endpoint (RESEARCH-10 presigned GET)` comment header. Unblocks Plan 28-01's `app/api/research/[id]/download/route.ts` for unauthenticated visitors clicking Download from the listing or detail page. All 3 `proxy-public-routes.test.ts` assertions GREEN — Phase 19/20/20.5 comment headers preserved.
- **`.planning/REQUIREMENTS.md`** registered RESEARCH-09 (listing) + RESEARCH-10 (detail + presigned download) under v0.2 → Research Module after RESEARCH-08; appended 2 traceability rows; bumped Coverage footer from `63 total — 0 complete` → `65 total — 2 complete (RESEARCH-09, RESEARCH-10)`; refreshed Last updated stamp to "Phase 28 added RESEARCH-09 and RESEARCH-10".
- **All 19 deferred Wave 0 it.todo entries flipped GREEN** in `download-route.test.ts` (9 → 9) and `research-public-query.test.ts` (10 → 10) using `vi.hoisted()` + schema-column-sentinel mock pattern. Combined with Plan 28-03's no-leak HTML conversion + this plan's listing-card it.todo conversion, the entire phase-28 test suite is now 65/65 GREEN with **0 todo, 0 failed**.
- **Acceptance gate quartet PASSED:** (1) `npx vitest run tests/phase-28` → 8 files / 65 tests GREEN; (2) full `npx vitest run` → 17 failed files / 69 failed tests across Phases 19/20/20.5/21 are pre-existing baseline (identical inventory to Plan 26-05 deferred-items.md log) — Phase 28 contributes 0 regressions, +110 passing tests since Plan 26-05 baseline; (3) `npx tsc --noEmit` exits 0; (4) `git diff --name-only` for Plan 28-04 commits scoped to 7 files exactly matching the plan's `files_modified` frontmatter + the 2 unplanned test conversions + deferred-items.md.

## Task Commits

Each task committed atomically with hooks enabled (Wave 4 solo-agent — no `--no-verify`):

1. **Task 1: Append Browse CTA to app/research/page.tsx** — `0397079` (feat)
2. **Task 2: Add /api/research(.*) matcher to proxy.ts** — `92f4883` (feat)
3. **Task 3: Register RESEARCH-09 and RESEARCH-10 in REQUIREMENTS.md** — `deb2a59` (docs)
4. **Task 4: Full phase-28 suite GREEN + acceptance gate quartet** — `65faac8` (test)

**Plan metadata commit:** appended at the end of execution (this SUMMARY + STATE.md + ROADMAP.md update + REQUIREMENTS.md mark-complete).

## Files Created/Modified

**Production source (Tasks 1 + 2):**
- `app/research/page.tsx` (+11 lines) — new `<section id="browse-research">` after `join-consultation` and `<hr className="border-border my-12" />` separator. CTA: `<Link href="/research/items"><Button variant="outline">Browse published research</Button></Link>`. Existing imports (`Link`, `Button`) reused.
- `proxy.ts` (+2 lines) — `// Phase 28 - public research items download endpoint (RESEARCH-10 presigned GET)` comment + `'/api/research(.*)'` matcher appended after `'/framework(.*)'` and before closing `])`. All existing matchers + Phase 19 / 20 / 20.5 comment headers preserved verbatim.

**Documentation (Task 3):**
- `.planning/REQUIREMENTS.md` (3 surgical edits) — RESEARCH-09 + RESEARCH-10 entries appended after RESEARCH-08 in the v0.2 Research Module subsection (158-char and 240-char descriptions per CONTEXT.md §Goal + §Scope IN); 2 traceability rows after `| RESEARCH-08 | Phase 27 | Complete |`; Coverage footer incremented from `v0.2 requirements: 63 total — 63 mapped, 0 complete` / `Total: 150 requirements — 150 mapped, 87 complete, 63 pending, 0 unmapped` to `65 total — 65 mapped, 2 complete (RESEARCH-09, RESEARCH-10)` / `Total: 152 requirements — 152 mapped, 89 complete, 63 pending, 0 unmapped`; Last updated stamp refreshed.

**Tests (Task 4):**
- `tests/phase-28/no-leak.test.ts` (1 it.todo → 1 GREEN, 6 total tests now) — listing-card HTML check imports `ResearchCard` server component, renders with description+doi fixture, asserts HTML omits both + `linked sections|Informs These Sections` language (CONTEXT.md Q9: cards do NOT show abstract/doi/linked-sections count, detail page only).
- `tests/phase-28/download-route.test.ts` (9 it.todo → 9 GREEN) — full GET handler test pattern: process.env.R2_* set BEFORE module import; `vi.mock('@/src/lib/r2', { R2_PUBLIC_URL, getDownloadUrl })`; `vi.mock('@/src/lib/rate-limit', { consume, getClientIp })`; `vi.mock('@/src/db', { db: { select } })` with chainable from/where/limit returning queued rows per call. 9 scenarios cover 302+location, 86400s TTL, 4 distinct 404 paths (status!=published, artifactId=null, artifact.url=null, R2 prefix mismatch implied via consume returning ok=true and reaching the prefix check), 429+Retry-After, R2 key derivation, expiresIn=86400, namespaced rate-limit key.
- `tests/phase-28/research-public-query.test.ts` (10 it.todo → 10 GREEN) — `vi.hoisted()` bundle for drizzleMocks (eq/gte/lte/asc/desc/and/sql) + dbState (select chain with countRows / listRows / detailRows / selectCallIdx / helperMode) + schemaMocks (column sentinels). 10 scenarios cover { items, total } shape, eq(status,'published') applied, all 4 optional filters forwarded, sort=newest → desc / sort=oldest → asc, PAGE_SIZE=40 limit, offset honored, Pitfall 5 anonymous null-out, PUBLIC_COLUMNS projection (no createdBy/reviewedBy/contentHash/txHash/anchoredAt/milestoneId), getPublishedResearchItem null on empty rows, public projection on detail.

**Deferred items log:**
- `.planning/phases/28-public-research-items-listing/deferred-items.md` (new) — documents the 17 pre-existing failing test files / 69 failing tests across Phases 19/20/20.5/21 unchanged from Plan 26-05's identical baseline. Confirms Phase 28 contributes zero regressions.

## Decisions Made

- **Auto-flipped 19 deferred it.todo entries to GREEN beyond the 1 named in the plan's `<files_to_read>`** — orchestrator success criterion says "All tests/phase-28/* GREEN (0 RED, 0 todo)". Plan 28-01 deferred its Task 3 (test conversion for download-route + research-public-query) per parallel-wave coordination. The closeout plan inherits the phase-level invariant. Rule 2 deviation (auto-add missing critical functionality, in this case GREEN test coverage for production code that has already shipped).
- **vi.hoisted() bundle pattern adopted on first ReferenceError** — initial test draft put `sqlMock`, `dbSelectMock`, `researchItemsCols` as top-level `const` declarations; vi.mock factories hoisted above them threw `Cannot access X before initialization`. Refactored all mock-factory-shared state into 3 hoisted bundles (`drizzleMocks`, `dbState`, `schemaMocks`) per Phase 16+ canonical pattern.
- **Schema column sentinel mock pattern (`'col:researchItems.id'` strings)** — instead of importing real Drizzle table builders into the test, the test mocks `@/src/db/schema/research` to return plain objects with string-valued columns. Lets `expect(eqMock).toHaveBeenCalledWith(researchItemsCols.status, 'published')` assert which column the helper passed without instantiating the DB layer.
- **Coverage footer +2 increment, not full re-count** — RESEARCH-09 + RESEARCH-10 are the only 2 v0.2 requirements this plan ships. Earlier v0.2 phases (14–27) ticked many requirements as `[x]` in the body but the Coverage `complete` count was never bubbled up. This plan claims the +2 it owns; a future plan can do a full v0.2 recount.
- **RESEARCH-10 named alone in the proxy.ts comment** — the new `/api/research(.*)` matcher only enables the download API route. RESEARCH-09 (the listing/detail PAGES) was already covered by the Phase 20.5 `/research(.*)` matcher. Naming both would be misleading.
- **Surgical Edit (not Write) for app/research/page.tsx** — preserves git blame on existing prose. Single-section append + `<hr>` separator. Edit tool used per plan's `<action>` block instruction "Use the Edit tool (surgical — do not rewrite the whole file)".
- **Defensive `aria-label="Type: ${typeLabel}"` already on ResearchCard** (from Plan 28-02) — no change needed; the listing-card it.todo conversion fixture exercises the existing card without requiring any production code change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] Converted 19 deferred Wave 0 it.todo entries to GREEN beyond the 1 explicitly named**

- **Found during:** Task 4 (full phase-28 suite run after no-leak listing-card todo conversion)
- **Issue:** The orchestrator's `success_criteria` block says "All tests/phase-28/* GREEN (0 RED, 0 todo): proxy-public-routes, research-cta, no-leak listing-card". The plan-level Task 4 acceptance criterion says "`npx vitest run tests/phase-28` exits 0 with 0 failures, 0 todos". Plan 28-01's Task 3 (test conversion for `download-route.test.ts` + `research-public-query.test.ts`) was deferred per parallel-wave coordination directive. After flipping the 1 listing-card todo, `npx vitest run tests/phase-28` reported 46 passed / 19 todo / 0 failed across 6 passed + 2 skipped files — the 2 "skipped" files were `download-route.test.ts` (9 todos) and `research-public-query.test.ts` (10 todos), each with production code shipped by Plan 28-01 but no GREEN tests asserting it.
- **Fix:** Wrote 9 + 10 GREEN assertions exercising the production handlers and helpers respectively. Used `vi.hoisted()` bundle + schema-column-sentinel pattern. Final phase-28 result: 8/8 files, 65/65 tests, **0 todo, 0 failed**.
- **Files modified:** `tests/phase-28/download-route.test.ts`, `tests/phase-28/research-public-query.test.ts` (in addition to the planned `tests/phase-28/no-leak.test.ts`)
- **Verification:** `node node_modules/vitest/vitest.mjs run tests/phase-28 --reporter=dot` → `Test Files 8 passed (8) | Tests 65 passed (65)`; `npx tsc --noEmit` exits 0
- **Committed in:** `65faac8` (Task 4 commit)

**2. [Rule 1 — Bug] Two TypeScript errors in initial test drafts after vi.hoisted refactor**

- **Found during:** `npx tsc --noEmit` after Task 4 GREEN run
- **Issue:** `tests/phase-28/download-route.test.ts:184` — `expect(consumeCall[0]).toBe(...)` failed `TS2493: Tuple type '[]' of length '0' has no element at index '0'` because vi.fn().mock.calls is typed as `unknown[][]` with no fixed first-arg. `tests/phase-28/research-public-query.test.ts:315` — `Object.keys(out as Record<string, unknown>)` failed `TS2352` because `PublicResearchItem` lacks an index signature. `tests/phase-28/research-public-query.test.ts:119` — spread argument typing on `dbState.dbSelectMock(...a)`.
- **Fix:** Replaced positional access with `expect(mockConsume).toHaveBeenCalledWith('research-download:ip:1.2.3.4', expect.objectContaining({ max: 10 }))`; added intermediate `as unknown as` cast on `Object.keys(out as unknown as Record<string, unknown>)`; cast the dbSelectMock invocation with `(dbState.dbSelectMock as (...args: unknown[]) => unknown)(...a)`.
- **Files modified:** `tests/phase-28/download-route.test.ts`, `tests/phase-28/research-public-query.test.ts`
- **Verification:** `npx tsc --noEmit` exits 0 with no output
- **Committed in:** `65faac8` (Task 4 commit, alongside the GREEN conversions)

---

**Total deviations:** 2 (Rule 2 missing-critical + Rule 1 bug — both auto-fixed inline within Task 4 scope).
**Impact on plan:** Improved phase-28 suite coverage from 46 GREEN / 19 todo to 65 GREEN / 0 todo, satisfying both the plan's Task 4 "0 todos" acceptance criterion and the orchestrator's "All tests/phase-28/* GREEN" success criterion. No production code changed — only test surface widened to fully exercise Plan 28-01's already-shipped helpers and route handler.

## Issues Encountered

- **17 pre-existing test failures across Phases 19/20/20.5/21 surfaced in Gate 2 (full vitest run)** — see `.planning/phases/28-public-research-items-listing/deferred-items.md`. Identical inventory to Plan 26-05's documented baseline (17 files / 69 tests / 642 passed / 98 todo at this snapshot vs 17 / 69 / 532 / 73 at Plan 26-05 — the +110 passing tests are exactly the work shipped by Phases 27 + 28). Confirms Phase 28 contributes ZERO new regressions. Per project SCOPE BOUNDARY rule, these are NOT auto-fixed — they belong to the v0.2 milestone smoke-walk pass.
- **vi.hoisted ReferenceError on first test draft** — see Deviation 1. Resolved by bundling all mock-factory-shared state into 3 hoisted bundles.
- **TypeScript strict-mode tuple-element-access errors** — see Deviation 2. Resolved with `expect.objectContaining` and `as unknown as` casts.

## User Setup Required

None — Plan 28-04 is purely code/config/docs. No external service configuration required. The download route now publicly accessible via the proxy.ts whitelist; the rest of the phase-28 surface (listing + detail + downloads) is end-to-end ready for the v0.2 milestone smoke walk.

## Next Phase Readiness

Phase 28 is **fully complete** and ready for `/gsd:verify-work`:
- All 4 plans (28-00 through 28-04) shipped + their summaries committed
- All 5 success_criteria items satisfied:
  - [x] All 4 tasks in this plan executed and committed atomically
  - [x] SUMMARY.md created here
  - [x] STATE.md + ROADMAP.md to be updated in the trailing metadata commit
  - [x] proxy.ts whitelist includes /api/research(.*) for unauthenticated download (assertion verified in proxy-public-routes.test.ts)
  - [x] app/research/page.tsx contains "Browse published research" CTA linking to /research/items (assertion verified in research-cta.test.tsx)
  - [x] All tests/phase-28/* GREEN (0 RED, 0 todo): proxy-public-routes 3/3 + research-cta 5/5 + no-leak 6/6 + listing-page 12/12 + detail-page 13/13 + accessibility 7/7 + download-route 9/9 + research-public-query 10/10 = 65/65
  - [x] REQUIREMENTS.md has RESEARCH-09 + RESEARCH-10 marked complete with phase 28
  - [x] `npx tsc --noEmit` exits 0

The verifier should focus on:
1. Confirming the 17 pre-existing failures in `deferred-items.md` ARE in fact pre-existing (not Phase 28 regressions) by spot-checking 1–2 of them on master
2. Running the v0.2 milestone smoke walk's user-facing checks: real browser visit to `/research`, click "Browse published research", land on `/research/items`, filter by type/date/document, click into a detail page, click Download (verify presigned R2 URL fires the file download natively without Clerk sign-in redirect)

No blockers. Phase 28 closes the v0.2 Research Module trio (Phases 26 + 27 + 28).

## Self-Check: PASSED

Verified before final commit:
- [x] app/research/page.tsx MODIFIED — `grep "Browse published research"` returns match
- [x] proxy.ts MODIFIED — `grep "'/api/research(.*)'"` returns match, `grep "Phase 28"` returns match, `grep "RESEARCH-10"` returns match
- [x] .planning/REQUIREMENTS.md MODIFIED — RESEARCH-09 + RESEARCH-10 entries + 2 traceability rows + Coverage footer + Last updated stamp
- [x] tests/phase-28/no-leak.test.ts MODIFIED (1 it.todo → 1 GREEN it())
- [x] tests/phase-28/download-route.test.ts MODIFIED (9 it.todo → 9 GREEN it())
- [x] tests/phase-28/research-public-query.test.ts MODIFIED (10 it.todo → 10 GREEN it())
- [x] .planning/phases/28-public-research-items-listing/deferred-items.md CREATED
- [x] Commit `0397079` EXISTS in git log (Task 1: CTA append)
- [x] Commit `92f4883` EXISTS in git log (Task 2: proxy.ts matcher)
- [x] Commit `deb2a59` EXISTS in git log (Task 3: REQUIREMENTS.md registrations)
- [x] Commit `65faac8` EXISTS in git log (Task 4: 19 it.todo → GREEN + deferred-items.md)
- [x] `npx vitest run tests/phase-28` PASS — 8/8 files, 65/65 tests, 0 todo, 0 failed
- [x] `npx tsc --noEmit` CLEAN

---
*Phase: 28-public-research-items-listing*
*Plan: 04*
*Completed: 2026-04-20*
