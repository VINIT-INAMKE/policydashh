---
phase: 19-public-participate-intake-clerk-invite-turnstile
plan: 00
subsystem: testing
tags: [vitest, wave-0, red-tests, turnstile, clerk-invitations, inngest, tdd]

requires:
  - phase: 16-flow-5-smoke-notification-dispatch-migration
    provides: "vi.hoisted + variable-path dynamic import Wave 0 pattern"
  - phase: 17-workshop-lifecycle-recording-pipeline-groq
    provides: "Pattern 2 (variable-path dynamic import) canonical mechanism for RED contract files"
  - phase: 18-async-evidence-pack-export
    provides: "dialog/mutation RED contract pattern for tRPC + UI wave-0 tests"
provides:
  - "4 RED contract test files locking Phase 19 Plans 19-01..05 behaviour"
  - "@marsidev/react-turnstile ^1.5.0 dependency (site-key widget for public form)"
  - "CLOUDFLARE_TURNSTILE_* env var documentation in .env.example"
  - "vitest.config.mts include glob extended to tests/**/*.test.ts"
affects: [19-01, 19-02, 19-03, 19-04, 19-05, 20-cal-com-workshop-registration, 21-public-content-surfaces]

tech-stack:
  added:
    - "@marsidev/react-turnstile ^1.5.0"
  patterns:
    - "Nyquist sampling gate: all Wave 0 RED files must fail predictably before downstream plans may merge"
    - "Variable-path dynamic import (segments.join('/') + /* @vite-ignore */) for not-yet-existing module contracts"
    - "vi.hoisted() shared mock pattern for Clerk clerkClient + sendWelcomeEmail + fetch stubs"
    - "tests/phase-NN/*.test.ts sibling directory (vs src/__tests__) for phase-scoped Wave 0 contracts"

key-files:
  created:
    - "tests/phase-19/participate-route.test.ts"
    - "tests/phase-19/participate-intake.test.ts"
    - "tests/phase-19/welcome-email.test.ts"
    - "tests/phase-19/public-routes.test.ts"
    - ".planning/phases/19-public-participate-intake-clerk-invite-turnstile/deferred-items.md"
  modified:
    - "package.json (+ @marsidev/react-turnstile)"
    - "package-lock.json"
    - ".env.example (+ Turnstile site/secret keys)"
    - "vitest.config.mts (+ tests/**/*.test.ts include glob)"
    - ".planning/phases/19-public-participate-intake-clerk-invite-turnstile/19-VALIDATION.md (nyquist_compliant + wave_0_complete flipped to true)"

key-decisions:
  - "Use @marsidev/react-turnstile ^1.5.0 — npm resolved to 1.x, not 3.x as plan hinted; plan authorized 'no version pin — allow npm to resolve latest', so 1.5.0 is accepted"
  - "Extend vitest.config.mts include glob as Rule 3 auto-fix — original config only scanned src/**/*.test.ts, plan mandates tests/phase-19/ directory; without this fix Vitest would silently skip all 4 Wave 0 files"
  - "Cloudflare test placeholder keys (0x00000000000000000000AA / 0x0000000000000000000000000000000AA) used as .env.example values — always-passes test keys documented by Cloudflare as safe public examples"

patterns-established:
  - "Phase 19 Wave 0 gate: 4 RED files (25 tests) must all fail before any of Plans 19-01..05 may proceed — first appearance of Nyquist sampling gate for a UI-heavy phase with no pre-existing code surface"
  - "vitest.config include glob evolution: src-only → src + tests/** (reverse-compatible, zero regression to 352 pre-existing passing tests)"

requirements-completed: [INTAKE-01, INTAKE-02, INTAKE-03, INTAKE-04, INTAKE-05, INTAKE-06, INTAKE-07]

duration: 21min
completed: 2026-04-14
---

# Phase 19 Plan 00: Wave 0 RED Contract Lock + Turnstile Install Summary

**4 RED Wave 0 contract test files (25 tests) locking participate-route / participate-intake / welcome-email / public-routes behaviour for Plans 19-01..05, plus @marsidev/react-turnstile dependency installed and Cloudflare Turnstile env vars documented in .env.example.**

## Performance

- **Duration:** ~21 min
- **Started:** 2026-04-14T11:10:00Z (approx, from plan dispatch)
- **Completed:** 2026-04-14T11:30:31Z
- **Tasks:** 2 / 2
- **Files created:** 5
- **Files modified:** 5

## Accomplishments

- **Wave 0 RED gate locked.** 25 tests across 4 files all fail predictably with "expected null not to be null" (target modules do not yet exist) — the canonical Nyquist signal for Plans 19-01..05 to begin.
- **@marsidev/react-turnstile ^1.5.0 installed** and visible in `node_modules/@marsidev/react-turnstile/package.json`. Ready for Plan 19-01 client-side widget mount.
- **Cloudflare Turnstile env vars** (`NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY`, `CLOUDFLARE_TURNSTILE_SECRET_KEY`) appended to `.env.example` with Cloudflare's documented always-passes test placeholders.
- **19-VALIDATION.md frontmatter flipped** — `nyquist_compliant: true`, `wave_0_complete: true` — releases the depends_on gate for downstream plans.
- **Zero regression**: full `npm test` shows 352 pre-existing tests still passing, only the 25 new RED tests and the 2 pre-existing deferred failures are red.

## Task Commits

Each task committed atomically:

1. **Task 1: Install @marsidev/react-turnstile and document Turnstile env vars** — `b489a4e` (chore)
2. **Task 2: Create 4 RED test files locking Phase 19 behavioural contracts** — `f62444f` (test)

**Plan metadata commit:** pending (will include this SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md, 19-VALIDATION.md update).

## Files Created/Modified

- `tests/phase-19/participate-route.test.ts` — 6 tests (5 numbered + 1 RED import) locking POST /api/intake/participate (zod body, Turnstile /siteverify, SHA-256 emailHash, single sendParticipateIntake call)
- `tests/phase-19/participate-intake.test.ts` — 8 tests (7 numbered + 1 RED import) locking `participateIntakeFn` Inngest function (rateLimit, Clerk ignoreExisting+publicMetadata, sendWelcomeEmail, 5xx retry vs 4xx NonRetriableError, INTAKE-06 ignoreExisting welcome path)
- `tests/phase-19/welcome-email.test.ts` — 9 tests (8 numbered + 1 RED import) locking `renderWelcomeEmail` 6 org-bucket variants (government/industry/legal/academia/civil_society/internal) with audience phrase + CTA + hero line
- `tests/phase-19/public-routes.test.ts` — 2 tests locking proxy.ts isPublicRoute additions (`/participate(.*)` and `/api/intake(.*)` or `/api/intake/participate(.*)`)
- `vitest.config.mts` — extended `include` glob to also match `tests/**/*.test.ts` and `tests/**/*.test.tsx`
- `package.json` / `package-lock.json` — added `@marsidev/react-turnstile ^1.5.0`
- `.env.example` — appended Phase 19 Cloudflare Turnstile section with test placeholder keys
- `.planning/phases/19-public-participate-intake-clerk-invite-turnstile/deferred-items.md` — logged pre-existing unrelated failures (section-assignments + feedback-permissions, already on the Phase 16 deferred list)
- `.planning/phases/19-public-participate-intake-clerk-invite-turnstile/19-VALIDATION.md` — `nyquist_compliant: true`, `wave_0_complete: true`

## Decisions Made

- **npm resolved @marsidev/react-turnstile to 1.5.0, not 3.x.** Plan text says "allow npm to resolve latest ~3.x" but also "no version pin — allow npm to resolve latest". The `@marsidev/react-turnstile` package is on major version 1 on the npm registry; there is no 3.x line. I followed the explicit "no version pin" instruction. Plan 19-01 consumer code must use the 1.x API (`<Turnstile siteKey=... onSuccess=... />`) — matches 3.x API documented in research, so no interface drift.
- **Vitest config include glob extended (Rule 3 auto-fix).** Original `include: ['src/**/*.test.ts', 'src/**/*.test.tsx']` would silently skip any test file in `tests/phase-19/` (the plan's mandated path). Extended to also match `tests/**/*.test.ts{,x}`. Acceptance criteria "Running `npm test -- --run tests/phase-19` executes all 4 test files" would otherwise have been unverifiable. Non-invasive — verified 352 pre-existing passing tests are unaffected.
- **Plan references `tests/phase-18/*` as precedent, but Phase 18 Wave 0 tests actually live under `src/**/__tests__/` not `tests/phase-18/`.** Followed the plan's explicit `files_modified` frontmatter which lists `tests/phase-19/*`, establishing a new per-phase test directory convention. Future phases can continue either pattern; both work.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Extended vitest.config.mts include glob**
- **Found during:** Task 2 (executing `npx vitest run tests/phase-19` for the first time)
- **Issue:** `vitest.config.mts` `include: ['src/**/*.test.ts', 'src/**/*.test.tsx']` does not match `tests/phase-19/*.test.ts`. Without this fix, Vitest would report "No test files found" and the RED gate would silently pass.
- **Fix:** Added `'tests/**/*.test.ts'` and `'tests/**/*.test.tsx'` to the include array.
- **Files modified:** vitest.config.mts
- **Verification:** Re-ran `npx vitest run tests/phase-19` — 4 files discovered, 25 tests all RED as expected. Full `npm test` still runs the 32 pre-existing src/ test files.
- **Committed in:** f62444f (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking — test discovery)
**Impact on plan:** Auto-fix was essential for the task's verification command to be meaningful. No scope creep.

## Issues Encountered

- Plan's verification command uses `/tmp/phase-19-red.txt`, which resolves to `D:\tmp\phase-19-red.txt` on Windows and fails with ENOENT. Used project-local `phase-19-red.txt` instead (cleaned up after). Not recorded as a deviation — plan's command is unix-ism, environment is Windows bash.
- Plan example says "failed markers: ... file refs:" — my run got `failed markers: 7, file refs: 54`, both comfortably above the plan's `< 4` failure threshold.

## Known Stubs

None. Wave 0 files are INTENTIONALLY stubs (RED contracts for modules that do not yet exist). This is the designed state. Plans 19-01..05 will flip each RED to GREEN.

## Next Phase Readiness

- **Plans 19-01..05 unblocked.** Nyquist gate released via `19-VALIDATION.md` frontmatter flip. Each downstream plan's depends_on check will now pass.
- **Ready for Plan 19-01** (public /participate page + client-side Turnstile widget) — `@marsidev/react-turnstile` installed, env vars documented. Plan 19-01 needs only the site-key value at dev-time (Cloudflare dashboard → Turnstile → Add Site).
- **Ready for Plan 19-02** (POST /api/intake/participate route) — test file `tests/phase-19/participate-route.test.ts` locks the exact contract (zod body shape, Turnstile verify→403/200 branch, SHA-256 emailHash, single event fire).
- **Ready for Plan 19-03** (`participateIntakeFn` Inngest function) — test file locks id, rateLimit options, Clerk invitations.createInvitation args, sendWelcomeEmail contract, 5xx/4xx error branches.
- **Ready for Plan 19-04** (welcome-email template) — test file locks 6 org-bucket variants + CTA label logic + hero line.
- **Ready for Plan 19-05** (proxy.ts whitelist extension) — test file locks `/participate(.*)` + `/api/intake(.*)` additions.

## Self-Check: PASSED

Verified before returning:
- `tests/phase-19/participate-route.test.ts`: FOUND
- `tests/phase-19/participate-intake.test.ts`: FOUND
- `tests/phase-19/welcome-email.test.ts`: FOUND
- `tests/phase-19/public-routes.test.ts`: FOUND
- `.planning/phases/19-public-participate-intake-clerk-invite-turnstile/deferred-items.md`: FOUND
- commit `b489a4e` (Task 1): FOUND
- commit `f62444f` (Task 2): FOUND
- `package.json` contains `@marsidev/react-turnstile`: CONFIRMED
- `.env.example` contains Turnstile env vars: CONFIRMED
- `19-VALIDATION.md` frontmatter flipped to `nyquist_compliant: true` + `wave_0_complete: true`: CONFIRMED
- `vitest.config.mts` include glob extended: CONFIRMED
- `npx vitest run tests/phase-19` reports 4 files, 25 tests, 25 failed (RED): CONFIRMED

---
*Phase: 19-public-participate-intake-clerk-invite-turnstile*
*Plan: 19-00*
*Completed: 2026-04-14*
