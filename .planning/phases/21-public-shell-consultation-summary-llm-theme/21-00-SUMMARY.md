---
phase: 21-public-shell-consultation-summary-llm-theme
plan: 00
subsystem: database
tags: [drizzle, neon, postgres, jsonb, vitest, tdd-red, llm, privacy]

# Dependency graph
requires:
  - phase: 20.5-public-research-framework-content-pages
    provides: PUB-07 `(public)` layout shell stub + PublicPolicyContent optional-prop precedent
  - phase: 16-flow-5-smoke-notification-dispatch-migration
    provides: Pattern 2 variable-path dynamic import (array.join + /* @vite-ignore */)
  - phase: 17-workshop-lifecycle-recording-pipeline-groq
    provides: chatComplete Groq wrapper + Inngest concurrency-key convention
  - phase: 14-collab-rollback
    provides: Neon HTTP migration runner pattern (sql.query(stmt) via @neondatabase/serverless)
provides:
  - document_versions.consultation_summary JSONB column (migration 0013 applied against Neon)
  - Drizzle $type<ConsultationSummaryJson | null> typed column on documentVersions
  - ConsultationSummaryJson / ConsultationSummarySection / ApprovedSummarySection contract types (pure-type module, zero runtime deps)
  - 5 Wave 0 RED contract tests locking Plans 21-01/02/03/04 behavior (anonymization, guardrail regex, Inngest fn, tRPC router, public header, section summary block)
  - vitest.config.mts include glob extended to `app/**/*.test.ts(x)` for (public) route component tests
  - Per-Task Verification Map preserved + Wave 0 gates flipped (nyquist_compliant true, wave_0_complete true)
affects:
  - 21-01 (llm helper + anonymizer + guardrail + Inngest fn)
  - 21-02 (public shell refactor + PublicHeader)
  - 21-03 (tRPC moderator router + SummaryReviewCard)
  - 21-04 (SectionSummaryBlock + FrameworkSummaryBlock)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern 2: variable-path dynamic import (array.join + @vite-ignore) for Wave 0 RED contracts pinning not-yet-written target modules"
    - "ApprovedSummarySection projection pattern: separate public-safe type from internal moderator type, enforced at the component prop boundary (LLM-08 privacy)"
    - "Hand-written Neon HTTP migration runner 0013 mirroring 0012 pattern (Phase 14/16 Pattern 2)"

key-files:
  created:
    - src/db/migrations/0013_consultation_summary.sql
    - scripts/apply-migration-0013.mjs
    - src/server/services/consultation-summary.service.ts
    - tests/phase-21/consultation-summary-service.test.ts
    - src/inngest/__tests__/consultation-summary-generate.test.ts
    - src/server/routers/__tests__/consultation-summary.test.ts
    - app/(public)/_components/__tests__/public-header.test.tsx
    - app/(public)/portal/[policyId]/_components/__tests__/section-summary-block.test.tsx
  modified:
    - src/db/schema/changeRequests.ts
    - vitest.config.mts
    - .planning/phases/21-public-shell-consultation-summary-llm-theme/21-VALIDATION.md

key-decisions:
  - "Pure-type contract module (consultation-summary.service.ts has zero runtime imports, only types) so Plan 21-01 can extend it without touching Wave 0 locked surface"
  - "ApprovedSummarySection strips sourceFeedbackIds/feedbackCount/edited/generatedAt per LLM-08 privacy enforcement — mandatory projection before data crosses into (public) route components"
  - "Variable-path dynamic import (Pattern 2) used for all 5 RED test files so modules not yet written (anonymizeFeedbackForSection, consultationSummaryGenerateFn, consultationSummaryRouter, PublicHeader, SectionSummaryBlock) do not break Vite static analysis"
  - "vitest.config.mts include glob extended to app/**/*.test.ts(x) — required because (public) RED stubs live at app/(public)/_components/__tests__/ and existing glob only covered src/** + tests/**"
  - "Per-Task Verification Map preserved verbatim from gsd-planner (iteration-2 plan-checker fix); Task 5 flips 5x 21-00 status icons from ⬜ pending to ✅ green without rewriting the 16-row table"

patterns-established:
  - "Privacy-safe projection type at contract boundary: ApprovedSummarySection as the public-facing cross-seam, ConsultationSummarySection kept internal to moderator review path"
  - "RED contract discovery under (public) route group: vitest include glob appended with app/**/*.test.ts(x) once, re-usable for any future (public)/(workspace) __tests__ directories"
  - "TDD RED-by-module-not-found: when target modules do not exist, module resolution error IS the locked contract — Plan 21-00 continues the Phase 16/17/18/19/20 precedent"

requirements-completed: []  # Wave 0 scaffolds the contracts; requirement sign-off happens in Plans 21-01 through 21-04.

# Metrics
duration: 8min
completed: 2026-04-15
---

# Phase 21 Plan 00: Wave 0 Contract Lock Summary

**Migration 0013 applied against Neon + 5 RED contract tests locked for Plans 21-01/02/03/04 via Pattern 2 variable-path dynamic import, with pure-type ConsultationSummaryJson / ApprovedSummarySection contract module shipped as backbone**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-15T09:39:21Z
- **Completed:** 2026-04-15T09:46:50Z
- **Tasks:** 5 of 5
- **Files created:** 8
- **Files modified:** 3

## Accomplishments

- Migration 0013 adds `document_versions.consultation_summary JSONB` column and is applied cleanly against Neon (probe SELECT returns rows successfully)
- Drizzle schema wired with `$type<ConsultationSummaryJson | null>()` on the new column; `npx tsc --noEmit` exits 0 with the new types in place
- Contract type module `src/server/services/consultation-summary.service.ts` ships 3 exports (`ConsultationSummaryJson`, `ConsultationSummarySection`, `ApprovedSummarySection`) as a pure-type module with zero runtime dependencies
- 5 RED test files land (3 backend + 2 frontend) and all are discovered by Vitest — 22 failing assertions across them — locking the contracts that Plans 21-01/21-02/21-03/21-04 must satisfy to flip GREEN
- `vitest.config.mts` include glob extended to `app/**/*.test.ts(x)` so the new `(public)` route group `__tests__` directories are discoverable
- `21-VALIDATION.md` frontmatter flipped (`nyquist_compliant: true`, `wave_0_complete: true`, `wave_0_completed_at: 2026-04-15`), 5 task status icons green, all 8 Wave 0 Requirements ticked, all 6 Validation Sign-Off gates ticked, approval moved from pending → approved

## Task Commits

Each task was committed atomically:

1. **Task 1: Create migration 0013 + runner and apply it** — `a1ce400` (feat)
2. **Task 2: Add Drizzle typed column + create contract type module** — `d7d83fb` (feat)
3. **Task 3: Create 3 RED contract tests — anonymization, guardrail, Inngest fn, tRPC router** — `ca87bd3` (test)
4. **Task 4: Create 2 RED frontend stubs — public-header + section-summary-block** — `1dc23d6` (test)
5. **Task 5: Flip VALIDATION.md Wave 0 gates and populate task map** — `ecd5a5a` (docs)

## Files Created/Modified

### Created
- `src/db/migrations/0013_consultation_summary.sql` — DDL: `ADD COLUMN IF NOT EXISTS consultation_summary JSONB` on `document_versions`
- `scripts/apply-migration-0013.mjs` — Neon HTTP runner (Pattern 2; `sql.query(stmt)` with DO-block splitter preserved)
- `src/server/services/consultation-summary.service.ts` — Pure-type contract module exporting `ConsultationSummarySection`, `ConsultationSummaryJson`, `ApprovedSummarySection`, plus `ConsultationSummarySectionStatus` and `ConsultationSummaryOverallStatus` union types
- `tests/phase-21/consultation-summary-service.test.ts` — Wave 0 RED: `anonymizeFeedbackForSection` strips `name`/`email`/`phone`/`submitterId`; `buildGuardrailPatternSource` returns regex source string (not RegExp object — Pitfall 3), matches email/phone/FirstName-LastName, excludes role-only attribution + <4-char name tokens
- `src/inngest/__tests__/consultation-summary-generate.test.ts` — Wave 0 RED: `consultationSummaryGenerateFn` id equals `consultation-summary-generate`, concurrency key `groq-summary`, trigger `version.published`; `versionPublishedEvent` + `sendVersionPublished` helper exported from events module
- `src/server/routers/__tests__/consultation-summary.test.ts` — Wave 0 RED: `consultationSummaryRouter` exports 6 procedures (`getByVersionId`, `approveSection`, `editSection`, `regenerateSection`, `getSectionFeedback`) discovered via `_def.procedures` probe (Phase 18 pattern)
- `app/(public)/_components/__tests__/public-header.test.tsx` — Wave 0 RED: `PublicHeader` React component export
- `app/(public)/portal/[policyId]/_components/__tests__/section-summary-block.test.tsx` — Wave 0 RED: `SectionSummaryBlock` React component export

### Modified
- `src/db/schema/changeRequests.ts` — Added `import type { ConsultationSummaryJson }` and `consultationSummary: jsonb('consultation_summary').$type<ConsultationSummaryJson | null>()` to `documentVersions`; unique constraint unchanged
- `vitest.config.mts` — Extended `include` glob with `app/**/*.test.ts` + `app/**/*.test.tsx` (comment: `// Phase 21: enable app/**/__tests__ discovery for (public) route components`)
- `.planning/phases/21-public-shell-consultation-summary-llm-theme/21-VALIDATION.md` — Frontmatter gates + 5 task status icons + 8 Wave 0 requirement checkboxes + 6 sign-off gates flipped; 16-row Per-Task Verification Map preserved verbatim

## Decisions Made

- **Pure-type contract module (no runtime imports).** `consultation-summary.service.ts` ships only TypeScript types at Wave 0 so Plan 21-01 can extend it with `anonymizeFeedbackForSection` / `buildGuardrailPatternSource` / `generateConsultationSummary` without clobbering the locked Wave 0 surface. The contract test asserts `typeof mod.anonymizeFeedbackForSection === 'function'` and fails until Plan 21-01 adds that runtime export.
- **`ApprovedSummarySection` as the privacy-safe projection.** Separate type from `ConsultationSummarySection` so the type system enforces LLM-08 at the public-component prop boundary: `(public)` route components cannot accept `sourceFeedbackIds` / `feedbackCount` / `edited` / `generatedAt` because the type doesn't include them.
- **Pattern 2 variable-path dynamic import used uniformly.** All 5 RED test files use `import(/* @vite-ignore */ segs.join('/'))` so Vite's static analysis cannot resolve the not-yet-written target modules. Mirrors Phase 16/17/18/19/20 precedent and Phase 20.5's successful Wave 0 contract lock.
- **vitest.config.mts include glob extended (Rule 3 auto-fix).** The blocking issue: the `(public)` RED stubs live under `app/(public)/_components/__tests__/`, but the existing include glob only covered `src/**` and `tests/**`. Without the glob extension, vitest would print "no test files found" and the RED contracts would never discover-fail. Extended the glob in-task, documented with a `// Phase 21:` comment, committed with the frontend stubs.
- **Preserve Per-Task Verification Map verbatim.** Earlier plan drafts hard-coded the 16-row map inside Task 5 text for the executor to paste. Plan-checker iteration-2 fix removed that because the planner-generated map is the single source of truth and the hard-coded copy drifted (missed T5, wrong grep on T2). Task 5 now only flips status icons and frontmatter, leaving the table body untouched.
- **Task 5 status icon upgrade: ⬜ pending → ✅ green for the 5 Plan 21-00 rows.** Plans 21-01 through 21-04 will flip their own status icons as they complete. RED-locked tests (T3, T4) marked `✅ green (RED-locked)` to signal the RED contract is validly pinned, not that assertions pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended `vitest.config.mts` include glob to cover `app/**/*.test.ts(x)`**

- **Found during:** Task 4 (Create 2 RED frontend stubs)
- **Issue:** The new RED stubs live at `app/(public)/_components/__tests__/public-header.test.tsx` and `app/(public)/portal/[policyId]/_components/__tests__/section-summary-block.test.tsx`. Current `vitest.config.mts` only included `src/**/*.test.ts(x)` + `tests/**/*.test.ts(x)`, so vitest would print "no test files found" and the RED contracts would not be discovered — failing acceptance criterion "Both test files are discovered and reported by Vitest (not 'no test files found')".
- **Fix:** Appended `'app/**/*.test.ts'` and `'app/**/*.test.tsx'` to the `include` array with a `// Phase 21:` comment header.
- **Files modified:** `vitest.config.mts`
- **Verification:** `npm test -- --run app/(public)/_components/__tests__/public-header.test.tsx app/(public)/portal/[policyId]/_components/__tests__/section-summary-block.test.tsx` discovers both files, reports 2 failed tests with module-not-found (locked contract).
- **Committed in:** `1dc23d6` (Task 4 commit — plan Task 4 explicitly authorized this edit in its notes: "if Vitest 4.1.1 doesn't pick up app/**/__tests__/*.test.tsx by default, append that glob to the include array in vitest.config.mts")

---

**Total deviations:** 1 auto-fixed (1 blocking, explicitly pre-authorized by plan Task 4 notes — not a true surprise deviation).
**Impact on plan:** Zero scope creep. The plan anticipated this edit and Task 4 instructed the executor to perform it if needed.

## Issues Encountered

- None. Migration applied first-try, typecheck clean first-try, all 5 RED test files discovered and RED first-try.

## User Setup Required

None — no external service configuration required for Wave 0 (no secrets, no dashboards, no env vars). The groq-summary concurrency key + `version.published` event land in Plan 21-01; the Inngest function registration happens there.

## Self-Check: PASSED

- `src/db/migrations/0013_consultation_summary.sql` FOUND
- `scripts/apply-migration-0013.mjs` FOUND
- `src/server/services/consultation-summary.service.ts` FOUND
- `tests/phase-21/consultation-summary-service.test.ts` FOUND
- `src/inngest/__tests__/consultation-summary-generate.test.ts` FOUND
- `src/server/routers/__tests__/consultation-summary.test.ts` FOUND
- `app/(public)/_components/__tests__/public-header.test.tsx` FOUND
- `app/(public)/portal/[policyId]/_components/__tests__/section-summary-block.test.tsx` FOUND
- Commits `a1ce400`, `d7d83fb`, `ca87bd3`, `1dc23d6`, `ecd5a5a` all FOUND in `git log`
- Migration probe SELECT on `document_versions.consultation_summary` succeeds on Neon
- `npx tsc --noEmit` exits 0
- `grep -c "consultationSummary" src/db/schema/changeRequests.ts` returns 1
- `grep -c "ConsultationSummaryJson" src/server/services/consultation-summary.service.ts` returns 1
- `grep -c "ApprovedSummarySection" src/server/services/consultation-summary.service.ts` returns 2
- `grep -q "nyquist_compliant: true" 21-VALIDATION.md` passes
- `grep -q "wave_0_complete: true" 21-VALIDATION.md` passes
- `grep -c "21-0[0-4]-T" 21-VALIDATION.md` returns 16
- `grep -q "getSectionFeedback.useQuery" 21-VALIDATION.md` passes (locked 21-03-T2 SC#7 grep preserved)

## Next Phase Readiness

- **Plans 21-01 through 21-04 unblocked.** All `depends_on: [21-00]` gates cleared.
- Plan 21-01 (LLM helper + anonymizer + guardrail + Inngest fn) can now flip 11 Wave 0 RED contracts: 4 `anonymizeFeedbackForSection` + 4 `buildGuardrailPatternSource` + 2 Inngest fn metadata + 1 `versionPublishedEvent` export.
- Plan 21-02 (public shell refactor) can now flip 1 `PublicHeader` RED contract.
- Plan 21-03 (tRPC moderator router) can now flip 6 router-procedure RED contracts.
- Plan 21-04 (public rendering) can now flip 1 `SectionSummaryBlock` RED contract.
- Migration 0013 is live on Neon; Plan 21-01's `consultationSummaryGenerateFn` can write directly into the new column without additional DDL.
- Contract types are importable from `@/src/server/services/consultation-summary.service`; Plans 21-01/02/03/04 can reference `ConsultationSummaryJson` / `ApprovedSummarySection` without circular deps because the module has zero runtime imports.

---
*Phase: 21-public-shell-consultation-summary-llm-theme*
*Plan: 00*
*Completed: 2026-04-15*
