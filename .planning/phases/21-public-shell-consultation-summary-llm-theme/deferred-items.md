# Phase 21 — Deferred Items (out-of-scope discoveries)

Items discovered during Phase 21 execution that are **outside the current plan's scope**. Documented here per executor protocol; not fixed in Plan 21-01.

---

## Plan 21-01 Discoveries

### 1. `src/__tests__/section-assignments.test.ts` — env-var load failure

- **Discovered during:** Plan 21-01 post-task test sweep
- **Failure:** `No database connection string was provided to neon(). Perhaps an environment variable has not been set?`
- **Root cause:** Test file imports `@/src/trpc/init` at module load time, which imports `@/src/db` which eagerly calls `neon(process.env.DATABASE_URL!)`. The Vitest runner starts with an empty `DATABASE_URL`, so the factory throws before any test executes (0 tests collected).
- **Pre-existing:** Verified this is not caused by Plan 21-01 changes — my 4 commits did not touch `src/db/index.ts`, `src/trpc/init.ts`, or the test file. Likely pre-dates Phase 20.5.
- **Scope:** Out of Plan 21-01. Not caused by the consultation summary backend; unrelated to the `(public)` route group or Inngest consultation flow.
- **Recommendation:** Either (a) add a vitest setup file that stubs `process.env.DATABASE_URL` before top-level module loads, or (b) lazy-init the Neon client inside `db/index.ts` so the test runner can mock it. Both are infrastructure-level changes that should land in a dedicated test-infrastructure phase (or alongside a broader Vitest config sweep).

### 2. `src/__tests__/feedback-permissions.test.ts` — 2 failing assertions

- **Discovered during:** Plan 21-01 post-task test sweep
- **Failures:** `feedback:read_own permission > denies admin` and `feedback:read_own permission > denies auditor` (2/45 tests)
- **Pre-existing:** Confirmed by Phase 20.5 SUMMARY line 256 (`deferred-items.md as unrelated to this phase`) — documented there as pre-existing from commit `1648a46`. Plan 21-01 did not touch `src/lib/permissions.ts` or `src/__tests__/feedback-permissions.test.ts`.
- **Scope:** Out of Plan 21-01.

---

## Wave 0 RED Stubs (expected, not deferred)

The following RED test files from Plan 21-00 remain RED after Plan 21-01 — this is **expected per plan**:

- `src/server/routers/__tests__/consultation-summary.test.ts` — 6 assertions for `consultationSummaryRouter`. Flips GREEN in **Plan 21-03** (moderator review router + workspace review card).
- `app/(public)/_components/__tests__/public-header.test.tsx` — 1 assertion for `PublicHeader`. Flips GREEN in **Plan 21-02** (public shell refactor + header/footer components). Plan 21-02 runs in parallel as Wave 1 sibling agent.
- `app/(public)/portal/[policyId]/_components/__tests__/section-summary-block.test.tsx` — 1 assertion for `SectionSummaryBlock`. Flips GREEN in **Plan 21-04** (public rendering integration).

These are not "failures" — they are locked contracts waiting for their respective plan waves.
