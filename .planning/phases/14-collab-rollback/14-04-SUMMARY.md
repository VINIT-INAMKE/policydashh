---
phase: 14-collab-rollback
plan: 04
subsystem: build-tooling
tags: [npm, package-removal, css, env, requirements-audit, final-acceptance, phase-gate]

# Dependency graph
requires:
  - phase: 14-collab-rollback
    plan: 03
    provides: "Backend surface teardown — commentRouter deleted, collaboration schema dropped, ydoc_snapshots/comment_threads/comment_replies removed from Neon — unblocks final package/css cleanup + phase acceptance gate"
provides:
  - "Zero direct @hocuspocus/* or @tiptap/extension-collaboration* dependencies in package.json"
  - "package-lock.json reconciled (removed 5 packages)"
  - "app/globals.css stripped of .collaboration-cursor__* and .inline-comment-mark rules"
  - "Formal audit-trail that .env.example, hocuspocus-server/, and REQUIREMENTS.md EDIT-06/07/08 annotations are in the expected state (success criteria #2 and #4)"
  - "Final Phase 14 acceptance gate passed: npm test at baseline (295/297), tsc --noEmit clean, full-codebase residual collab grep returns zero matches"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Audit-as-task pattern: plan task whose acceptance is a grep count / directory absence / file-absence assertion, not a mutation — preserves audit trail in SUMMARY even when RESEARCH pre-confirmed the state"
    - "Transitive-vs-direct dependency distinction for rollback acceptance — direct deps removed from package.json is the signal, transitive residuals via other legit packages (e.g. @tiptap/extension-drag-handle → @tiptap/y-tiptap → yjs) are acceptable because source code no longer imports them"

key-files:
  created:
    - ".planning/phases/14-collab-rollback/14-04-SUMMARY.md"
  modified:
    - "package.json (-3 direct deps: @hocuspocus/provider, @tiptap/extension-collaboration, @tiptap/extension-collaboration-caret)"
    - "package-lock.json (reconciled: 5 packages removed total)"
    - "app/globals.css (-43 lines: .collaboration-cursor__caret, .collaboration-cursor__label, .collaboration-cursor__caret[data-idle], .inline-comment-mark, .inline-comment-mark.active, and @media (prefers-reduced-motion) wrapper block that only contained a collab rule)"
    - ".env.local (local-only, gitignored, NOT committed — removed `# Hocuspocus ...` header and `# NEXT_PUBLIC_HOCUSPOCUS_URL=...` commented line)"
  deleted: []

key-decisions:
  - "Accepted residual transitive yjs + @tiptap/extension-collaboration in node_modules (pulled in via @tiptap/extension-drag-handle → @tiptap/y-tiptap → yjs). The plan's acceptance criteria are phrased in terms of direct dependencies (package.json grep) and node_modules/@hocuspocus absence, not comprehensive yjs eradication. Source code contains zero `from 'yjs'` and zero `@tiptap/extension-collaboration` imports (verified by Part D residual grep), so the rollback is behaviorally complete. Leaving this pattern documented so a future v2 revival wave knows the transitive chain already exists."
  - "Committed Task 1 as a single atomic commit (package.json + package-lock.json + app/globals.css). Task 2 produced no file modifications — it is a pure audit + full-suite acceptance gate — so no Task 2 commit exists in git history. This is intentional: the SUMMARY itself, plus its final metadata commit, is the audit record for Task 2."
  - "Removed the `@media (prefers-reduced-motion) { .collaboration-cursor__label { transition: none; } }` block entirely because its only contained selector was `.collaboration-cursor__label`. Preserving an empty `@media` block would be dead CSS."

patterns-established:
  - "Phase-final acceptance pattern: last plan of a rollback phase runs (a) direct-dep grep on package.json, (b) full-codebase residual grep on src/ + app/, (c) full npm test, (d) npx tsc --noEmit — this quartet is the canonical Phase Acceptance Gate for any future teardown phase"

requirements-completed: [COLLAB-ROLLBACK-01, COLLAB-ROLLBACK-02]

# Metrics
duration: ~10min
completed: 2026-04-13
---

# Phase 14 Plan 04: Package Cleanup + CSS Strip + Final Acceptance Gate Summary

**Removed 3 collab npm packages (reconciled lockfile), stripped 43 lines of dead collab CSS from globals.css, cleaned the local-only `.env.local`, and ran the Phase 14 FINAL acceptance gate — npm test at baseline 295/297 with zero new failures, tsc --noEmit clean, full-codebase residual grep for `HocuspocusProvider|hocuspocus-server|providerRef|@hocuspocus|from 'yjs'|from '@tiptap/extension-collaboration|inline-comment-mark` across src/ + app/ returning zero matches. COLLAB-ROLLBACK-01 + COLLAB-ROLLBACK-02 both fully satisfied; Phase 14 is ready for `/gsd:verify-work`.**

## Performance

- **Duration:** ~10 min (dominated by ~2 min `npm uninstall` and ~25 s full `npm test`)
- **Started:** 2026-04-13T14:52:00Z (approx, right after init)
- **Completed:** 2026-04-13T15:02:41Z
- **Tasks:** 2 (1 mutation, 1 pure audit/acceptance)
- **Commits:** 1 task commit (Task 1 only — Task 2 was audit-only) + 1 upcoming metadata commit

## Accomplishments

### Task 1 — Remove collab npm packages; clean `.env.local`; verify `.env.example` + `hocuspocus-server/` absence; strip collab CSS

**Part A — npm uninstall (direct-dep removal):**

Ran `npm uninstall @hocuspocus/provider @tiptap/extension-collaboration @tiptap/extension-collaboration-caret`. The command removed 5 packages total (the 3 direct + 2 transitives that were only pulled in by the 3 direct deps) and reconciled `package-lock.json` in one step. Post-command checks:

- `grep -c "@hocuspocus\|@tiptap/extension-collaboration" package.json` → **0** (both tokens gone from direct dependencies)
- `test ! -d node_modules/@hocuspocus` → **OK** (one empty leftover directory removed via `rmdir`; npm did not fully clean the namespace directory)
- `package-lock.json` still present → **OK**

**Note on transitive yjs residual:** `npm ls yjs` after uninstall shows:

```
policydashboard@0.1.0
└─┬ @tiptap/extension-drag-handle@3.20.5
  ├─┬ @tiptap/extension-collaboration@3.20.5
  │ └── yjs@13.6.30
  └─┬ @tiptap/y-tiptap@3.0.2
    ├─┬ y-protocols@1.0.7
    │ └── yjs@13.6.30 deduped
    └── yjs@13.6.30 deduped
```

`@tiptap/extension-drag-handle` (which the block editor legitimately uses for the drag handle affordance) still pulls in `@tiptap/extension-collaboration` and `yjs` transitively via `@tiptap/y-tiptap`. This is NOT a regression — RESEARCH § Subsystem: npm Packages expected yjs to be transitive via the 3 removed packages, but it turns out yjs is ALSO transitive via a second chain the RESEARCH did not enumerate. The acceptance criteria are phrased in terms of:

1. Direct dependencies in `package.json` (→ now 0 for all 3 targets — PASS)
2. `node_modules/@hocuspocus` absence (→ PASS)
3. No source imports of yjs / hocuspocus / @tiptap/extension-collaboration (→ verified by Part D residual grep, 0 matches — PASS)

So the rollback is behaviorally complete: no application code touches Yjs or Hocuspocus, and the npm surface area that consumers care about (the direct dep list) is clean. The transitive yjs chain is inert and costs only disk space.

**Part B — `.env.local` cleanup (local-only, gitignored):**

Removed the `# NEXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1234` commented line AND the `# Hocuspocus (real-time collaboration server URL)` section header that preceded it. Post-edit:

- `grep -c "NEXT_PUBLIC_HOCUSPOCUS_URL\|Hocuspocus" .env.local` → **0**

`.env.local` is in `.gitignore`; the edit was made to the working-tree file only and was NOT staged or committed. All other env vars (Clerk, Neon DATABASE_URL, R2, Resend, Inngest) preserved untouched.

**Part C — Formal absence audit of `.env.example` NEXT_PUBLIC_HOCUSPOCUS_URL (success criterion #2):**

`grep -c "NEXT_PUBLIC_HOCUSPOCUS_URL" .env.example` → **0**. Already absent per RESEARCH § Subsystem: Env / Config. This task is a formal audit trail — the plan deliberately demanded it despite RESEARCH pre-confirming the state.

**Part D — Formal absence audit of `hocuspocus-server/` directory (success criterion #2):**

`test ! -e hocuspocus-server` → **OK (exit 0)**. Directory never existed in this repo (was never committed). Formal audit per success criterion #2.

**Part E — Strip collab CSS from `app/globals.css`:**

Located the collab CSS blocks at lines 361-402 (matching RESEARCH exactly) and removed:

- `.collaboration-cursor__caret { ... }` (7 lines)
- `.collaboration-cursor__label { ... }` (18 lines — wide block with positioning/transition)
- `.collaboration-cursor__caret[data-idle="true"] .collaboration-cursor__label { ... }` (3 lines)
- `.inline-comment-mark { ... }` (4 lines)
- `.inline-comment-mark.active { ... }` (3 lines)
- `@media (prefers-reduced-motion: reduce) { .collaboration-cursor__label { transition: none; } }` (3 lines) — entire @media block removed because its only selector was the collab one; see key-decisions

Total: 43 lines deleted from globals.css. The file now ends at `.ProseMirror a:hover { opacity: 0.8; }` and no longer contains any collab-related rules.

Post-edit: `grep -c "collaboration-cursor\|inline-comment-mark" app/globals.css` → **0**.

**Verification gate (executed after Task 1 edits, before commit):**

```
npm test -- src/__tests__/section-content-view.test.tsx src/__tests__/editor-extensions.test.ts
→ Test Files  2 passed (2)
→ Tests       24 passed (24)
→ Duration    5.00s
```

Both render-gate test files green after package uninstall confirms the single-user editor still boots without the removed packages. (The hardened verify command was added during plan review per execution_notes.)

### Task 2 — Formal REQUIREMENTS.md annotation audit + FINAL full-suite acceptance gate

**Part A — REQUIREMENTS.md EDIT-06/07/08 annotation audit (success criterion #4):**

```
grep -c "rolled back in v0.2 Phase 14" .planning/REQUIREMENTS.md         → 4
grep -c "EDIT-06.*rolled back in v0.2 Phase 14" .planning/REQUIREMENTS.md → 1
grep -c "EDIT-07.*rolled back in v0.2 Phase 14" .planning/REQUIREMENTS.md → 1
grep -c "EDIT-08.*rolled back in v0.2 Phase 14" .planning/REQUIREMENTS.md → 1
```

The total count is 4 (not 3) because the footer note at line 427 also contains the string `rolled back in v0.2 Phase 14` as a historical annotation. All three EDIT-06/07/08 lines are individually present and correctly marked `[x]` complete with the rollback annotation inside the bullet text. No file mutation required — formal audit per success criterion #4.

**Part B — FINAL full `npm test` acceptance gate (success criterion #5 + COLLAB-ROLLBACK-02):**

```
Test Files  2 failed | 21 passed (23)
Tests       2 failed | 295 passed (297)
Duration    25.15s
```

Failed files (BOTH pre-existing baseline, NOT regressions):

1. `src/__tests__/section-assignments.test.ts` — full-file load failure: `No database connection string was provided to neon()`. This is the baseline failure noted in execution_notes — this test file tries to import `src/db/index.ts` at test collection time, which calls `neon(process.env.DATABASE_URL!)` at module-load, and Vitest's test-env does not set `DATABASE_URL`. Identical to 14-03 baseline.
2. `src/__tests__/feedback-permissions.test.ts` — 2 test failures:
   - `Feedback Permission Matrix > feedback:read_own permission > denies admin`
   - `Feedback Permission Matrix > feedback:read_own permission > denies auditor`

   Both assert that `can('admin', 'feedback:read_own')` and `can('auditor', 'feedback:read_own')` return false, but the current permission matrix returns true. This is the pre-existing baseline from 14-01/02/03 (logged in 14-03 SUMMARY line 82 "Test Files 2 failed | 21 passed (23) / Tests 2 failed | 295 passed (297)"). Identical baseline.

**Zero new failures introduced by Plan 04.** 295 passing tests — exact baseline match — is the FINAL acceptance signal for COLLAB-ROLLBACK-02.

**Part C — Render-gate re-run (success criterion #3):**

Already run as part of Task 1 verify gate: `section-content-view.test.tsx` + `editor-extensions.test.ts` = 24/24 green. Both count for this success criterion.

**Part D — Full-codebase residual grep audit (success criterion COLLAB-ROLLBACK-01 comprehensive):**

```
Grep pattern: HocuspocusProvider|hocuspocus-server|providerRef|@hocuspocus|from 'yjs'|from '@tiptap/extension-collaboration|inline-comment-mark
Roots: src/ + app/
Result: No matches found (both roots, all file types)
```

**Zero residual references anywhere in application source.** This is the conclusive COLLAB-ROLLBACK-01 signal.

**Part E — TypeScript clean compile (success criterion):**

```
npx tsc --noEmit
→ (no output)
→ exit 0
```

Full project TypeScript compile is clean with zero diagnostics.

## Task Commits

1. **Task 1:** `9556726` — `chore(14-04): remove collab npm packages and clean CSS/env`
   - 3 files changed, 3 insertions(+), 116 deletions(-)
   - Files: `package.json`, `package-lock.json`, `app/globals.css`
2. **Task 2:** *(no commit — pure audit + acceptance gate, no file mutations)*

The SUMMARY.md commit (final metadata commit) captures Task 2's audit record.

## Deviations from Plan

**1. [Rule 3 — Blocker Avoidance] Manually removed empty `node_modules/@hocuspocus` leftover directory**

- **Found during:** Task 1 Part A verification loop
- **Issue:** After `npm uninstall @hocuspocus/provider ...`, `ls node_modules/@hocuspocus` returned empty. The `provider` subdirectory was correctly removed, but the enclosing `@hocuspocus` namespace directory itself was left as an empty directory. `test ! -d node_modules/@hocuspocus` then returned FAIL, failing the plan's acceptance criterion "`test ! -d node_modules/@hocuspocus` exits 0".
- **Fix:** Ran `rmdir node_modules/@hocuspocus` to clean the empty leftover. Re-ran the test: PASS.
- **Files modified:** None (node_modules is not tracked)
- **Commit:** N/A (working tree only)
- **Why this is a deviation:** Plan acceptance strictly requires directory absence, not just "the provider subdirectory is gone". Rule 3 blocker fix — the alternative (leave the empty dir, fail the acceptance criterion) would block commit.

**2. [Rule 2 — Missing critical cleanup] Also removed the `# Hocuspocus (real-time collaboration server URL)` section header from `.env.local`, not just the commented `NEXT_PUBLIC_HOCUSPOCUS_URL` line**

- **Found during:** Task 1 Part B
- **Issue:** Plan said "Remove any line matching `NEXT_PUBLIC_HOCUSPOCUS_URL`". Doing only that would leave an orphan comment header `# Hocuspocus (real-time collaboration server URL)` pointing at nothing.
- **Fix:** Removed both the commented var line and the header comment. Preserved the adjacent Resend and Inngest sections untouched.
- **Files modified:** `.env.local` (gitignored, not committed)
- **Justification:** Rule 2 — auto-add missing cleanup. Dead section headers are a documentation smell and would have been an obvious tidying request if caught in review.

**3. Transitive yjs residual acceptance (documented, not fixed)**

- **Found during:** Task 1 Part A post-verification
- **Issue:** After removing the 3 direct deps, `npm ls yjs` still shows `yjs@13.6.30` is pulled in via `@tiptap/extension-drag-handle → @tiptap/y-tiptap → yjs`. RESEARCH § Subsystem: npm Packages implied yjs would fully disappear after removing the 3 direct deps.
- **Fix:** None — this is the correct state. See key-decisions above. The plan's success criteria are phrased around direct deps and application-source imports, both of which pass. Removing `@tiptap/extension-drag-handle` would be an architectural change (the block editor uses drag-handle for block-reorder UX, unrelated to collab) and requires a separate decision — out of scope for this plan.
- **Files modified:** None
- **Why not Rule 4 (ask):** The acceptance criteria already explicitly pass. No user decision required — this is an informational observation, not a blocker.

No other deviations. Both tasks executed otherwise as written.

## Issues Encountered

None that required escalation. The baseline `section-assignments.test.ts` file-load failure is documented in 14-03 SUMMARY and the plan's execution_notes — it is NOT a Plan 04 regression. The two `feedback-permissions.test.ts` failures are also documented baseline.

## User Setup Required

None. All work was automated. `.env.local` was already present and untouched except for local hygiene cleanup (not committed).

## Formal Absence Audits (Phase 14 acceptance trail)

Recorded explicitly because Phase 14 success criteria #2 and #4 demand formal verification, even where RESEARCH pre-confirmed the state:

| Check | Path | Expected | Result |
|-------|------|----------|--------|
| #2a | `.env.example` NEXT_PUBLIC_HOCUSPOCUS_URL | absent | **absent** (grep count = 0) |
| #2b | `hocuspocus-server/` directory | absent | **absent** (`test ! -e` exit 0) |
| #4  | REQUIREMENTS.md EDIT-06/07/08 "rolled back in v0.2 Phase 14" | present ×3 | **present ×3** (grep count per-ID = 1 each; total = 4 with footer) |

## Final Acceptance Gate Results (Phase 14 exit signal)

| Gate | Command | Expected | Actual | Status |
|------|---------|----------|--------|--------|
| Direct dep removal | `grep -c "@hocuspocus\|@tiptap/extension-collaboration" package.json` | 0 | 0 | **PASS** |
| node_modules cleanup | `test ! -d node_modules/@hocuspocus` | exit 0 | exit 0 | **PASS** |
| CSS cleanup | `grep -c "collaboration-cursor\|inline-comment-mark" app/globals.css` | 0 | 0 | **PASS** |
| Render gate 1 | `npm test -- section-content-view.test.tsx` | pass | 14 passed / 14 | **PASS** |
| Render gate 2 | `npm test -- editor-extensions.test.ts` | pass | 10 passed / 10 | **PASS** |
| Full test suite | `npm test` | baseline (2 failed files, 295/297 passed) | 2 failed files, 295/297 passed | **PASS** (zero regressions) |
| TypeScript compile | `npx tsc --noEmit` | exit 0 clean | exit 0 (no output) | **PASS** |
| Residual grep src/ | collab token union | 0 matches | 0 matches | **PASS** |
| Residual grep app/ | collab token union | 0 matches | 0 matches | **PASS** |
| REQUIREMENTS audit | `grep -c "rolled back in v0.2 Phase 14"` | ≥ 3 | 4 | **PASS** |

**Phase 14 is COMPLETE and READY for `/gsd:verify-work`.**

## Known Stubs

None. Every edit in this plan was a removal — no placeholder values, no empty state components, no mock data introduced. The single-user block editor path established in 14-02 is the real path; nothing stubs for anything removed.

## Next Phase Readiness

**Phase 14 ends here.** The orchestrator will now run:

1. Regression gate (full `npm test` — already done by this plan, result recorded above)
2. `gsd-verifier` sonnet subagent to review the 4-plan phase as a whole
3. ROADMAP.md completion for Phase 14
4. Advance Current Phase pointer to Phase 15 (first v0.2-new phase)

COLLAB-ROLLBACK-01 (comprehensive removal of Yjs/Hocuspocus/inline-comment surface) and COLLAB-ROLLBACK-02 (zero-regression acceptance modulo 3 pre-existing baseline failures) are both fully satisfied. No Phase 14 follow-up work pending.

## Self-Check: PASSED

**File state:**

- FOUND: `.planning/phases/14-collab-rollback/14-04-SUMMARY.md`
- FOUND: `package.json` (3 collab direct deps removed — verified grep 0)
- FOUND: `package-lock.json` (reconciled — still exists)
- FOUND: `app/globals.css` (43 lines removed — verified grep 0)
- ABSENT (OK): `node_modules/@hocuspocus` directory
- ABSENT (OK): `hocuspocus-server/` directory
- ABSENT (OK): `NEXT_PUBLIC_HOCUSPOCUS_URL` in `.env.example` (already absent — formally audited)
- ABSENT (OK): `NEXT_PUBLIC_HOCUSPOCUS_URL` in `.env.local` (removed this plan — gitignored, not committed)
- PRESENT: `EDIT-06/07/08 rolled back in v0.2 Phase 14` annotations in REQUIREMENTS.md (grep per-ID = 1)

**Commits (1/1 found in git log):**

- FOUND: `9556726` — Task 1 (chore(14-04): remove collab npm packages and clean CSS/env)

**Test + type results:**

- FOUND: Targeted `npm test -- section-content-view.test.tsx editor-extensions.test.ts`: 24/24 passed
- FOUND: Full `npm test`: 2 failed files / 21 passed files / 295 passed tests / 297 total — exact baseline from 14-03 SUMMARY line 82, zero regressions
- FOUND: `npx tsc --noEmit`: exit 0, no output
- FOUND: Full-codebase residual collab grep (src/ + app/): 0 matches

---
*Phase: 14-collab-rollback*
*Plan: 04 (final wave — phase acceptance gate)*
*Completed: 2026-04-13*
