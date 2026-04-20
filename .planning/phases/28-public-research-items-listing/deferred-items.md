# Phase 28 — Deferred Items

Items discovered during Phase 28 execution that are **out of scope** for this phase.

## Pre-existing Suite Failures Confirmed Before Plan 28-04

### 17 test files / 69 tests failing on master (baseline carries through Phase 28)

- **Files:** Same 17 test files documented in `.planning/phases/26-research-module-data-server/deferred-items.md` and Phase 21/22 SUMMARYs:
  - `src/server/routers/__tests__/evidence-request-export.test.ts`
  - `app/portal/[policyId]/_components/__tests__/section-summary-block.test.tsx`
  - `tests/phase-19/participate-route.test.ts` + `participate-intake.test.ts`
  - `tests/phase-20/cal-webhook-route.test.ts` + `participate-mode-switch.test.tsx` + `workshop-feedback-submit.test.ts` + `workshops-listing.test.tsx`
  - `tests/phase-20.5/framework-page-render.test.tsx` + `research-page-render.test.tsx`
  - `src/__tests__/evidence-pack-dialog.test.ts` (1 failing assertion)
  - `src/__tests__/versioning.test.ts` (1 failing assertion)
  - `src/__tests__/feedback-permissions.test.ts` + `section-assignments.test.ts` (Phase 04-01 baseline)
  - Plus the previously-noted hashing fixture drift in `src/lib/__tests__/hashing.test.ts`
- **Discovered in:** Plan 28-04 Task 4 full-suite run (2026-04-20)
- **Baseline count:** 17 failed files, 69 failed tests, 642 passed, 98 todo
- **Plan 28-04 contribution:** All 8 phase-28 test files GREEN (65/65, 0 todo, 0 failed). Total passed went from 532 (Plan 26-05 baseline) → 642 (+110 across Phases 27 and 28 ships); failure count unchanged at 69.
- **Root cause:** Unrelated to research module / public-research surface. Pre-existing fixture drift, missing module paths (e.g., `@/app/(public)/portal/...` paths from a Phase 21 layout reorganisation that test files weren't updated against), and contract assertions against unshipped adjacent features.
- **Why deferred:** Plan 28-04 only modifies `app/research/page.tsx` (CTA append), `proxy.ts` (one matcher append), `.planning/REQUIREMENTS.md`, and `tests/phase-28/*.test.ts(x)`. None of the 17 failing files import from these paths or depend on `app/research/items/*`.
- **Disposition:** Pre-existing test-infra debt; to be triaged in the v0.2 milestone smoke-walk pass per project policy. Identical inventory to the Plan 26-05 baseline — confirms zero regression introduced by Phases 26 / 27 / 28.

## Acceptance gate verification

- `npx vitest run tests/phase-28` — 8/8 files GREEN, 65/65 tests pass, 0 todo, 0 failed.
- `npx tsc --noEmit` — verified clean (see Self-Check in 28-04-SUMMARY.md).
- `git diff --name-only HEAD~4 HEAD` for Plan 28-04 commits — only `app/research/page.tsx`, `proxy.ts`, `.planning/REQUIREMENTS.md`, and `tests/phase-28/*` touched.
