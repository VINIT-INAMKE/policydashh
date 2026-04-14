---
phase: 19-public-participate-intake-clerk-invite-turnstile
plan: 05
subsystem: infra
tags: [clerk, middleware, proxy, public-route, intake, phase-final]

# Dependency graph
requires:
  - phase: 19-public-participate-intake-clerk-invite-turnstile
    provides: "Plan 19-00 locked Wave 0 contract tests/phase-19/public-routes.test.ts (Tests 4.1 + 4.2 RED). Plan 19-01 shipped POST /api/intake/participate route handler. Plan 19-02 shipped participateIntakeFn Inngest handler. Plan 19-03 shipped welcome email templates. Plan 19-04 shipped /participate page + form."
provides:
  - "proxy.ts isPublicRoute matcher extended with /participate(.*) and /api/intake(.*) — closes the final public-route gap"
  - "Phase 19 chain end-to-end wired: GET /participate (200 unauth) → POST /api/intake/participate (reachable unauth) → Turnstile verify → Inngest participate.intake event → participateIntakeFn → Clerk invitation → welcome email"
  - "tests/phase-19/public-routes.test.ts (2/2 GREEN); full tests/phase-19 suite (25/25 GREEN)"
  - "Phase 19 VALIDATION.md flipped status: approved"
affects: [v0.2 milestone smoke walk, future intake endpoints under /api/intake/*, Phase 20 cal.com webhooks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Clerk createRouteMatcher whitelist extension: append-at-end with comment header naming requirements (e.g. // Phase 19 — INTAKE-01, INTAKE-07) — preserves pre-existing entry order, makes future audits scriptable"
    - "Broader prefix wildcard /api/intake(.*) (not /api/intake/participate(.*)) — admits future Phase 20+ intake endpoints without re-touching proxy.ts"

key-files:
  created: []
  modified:
    - "proxy.ts"
    - ".planning/phases/19-public-participate-intake-clerk-invite-turnstile/19-VALIDATION.md"

key-decisions:
  - "Plan 19-05: chose /api/intake(.*) (broader) over /api/intake/participate(.*) (narrower) — admits future intake endpoints without re-touching proxy.ts, and Phase 20 cal.com webhooks live under /api/webhooks (already public) so there is no namespace collision"
  - "Plan 19-05: append-at-end + comment header pattern for createRouteMatcher whitelist additions — preserves pre-existing entry order, makes future audits scriptable, signals which requirement(s) drove each entry"
  - "Plan 19-05: Task 2 checkpoint:human-verify auto-approved per user preference (memory: defer smoke walks to end-of-milestone) — full 18-step E2E walk rolled into v0.2 milestone smoke walk, NOT skipped"

patterns-established:
  - "Phase-final acceptance gate quartet (extends Phase 14 pattern): 1) targeted Wave 0 contract test, 2) full phase test suite, 3) tsc --noEmit, 4) git diff additions-only verification — all four GREEN before flipping VALIDATION.md status: approved"
  - "Public-route extension is a strict-superset edit: git diff MUST show only additions; reordering or removal is a regression signal"

requirements-completed: [INTAKE-01, INTAKE-07]

# Metrics
duration: 2min
completed: 2026-04-14
---

# Phase 19 Plan 05: Proxy isPublicRoute Whitelist Extension Summary

**proxy.ts isPublicRoute matcher extended with `/participate(.*)` and `/api/intake(.*)` — closes the final public-route gap, lighting up the entire Phase 19 chain (page → form → route → Turnstile → Inngest → Clerk invite → welcome email) for unauthenticated visitors.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-14T11:47:46Z
- **Completed:** 2026-04-14T11:49:19Z
- **Tasks:** 1 of 1 auto + 1 checkpoint auto-approved (2 of 2 total)
- **Files created:** 0
- **Files modified:** 2 (proxy.ts, 19-VALIDATION.md)

## Accomplishments

- `proxy.ts` `isPublicRoute` `createRouteMatcher` array extended with two new entries (`/participate(.*)`, `/api/intake(.*)`) prefixed by a Phase 19 / requirement comment header. All seven pre-existing public routes preserved in original order.
- `tests/phase-19/public-routes.test.ts` (Wave 0 contract Tests 4.1 + 4.2) flipped from RED to GREEN — the final 2 RED tests from Phase 19 Wave 0 are now satisfied.
- Full `tests/phase-19` suite (4 files, 25 tests) all GREEN end-to-end.
- `npx tsc --noEmit` clean — no TypeScript regressions.
- `git diff proxy.ts` is pure additions (3 lines, 0 removals) — strict-superset edit, no reorder, no risk of accidental authenticated-route exposure.
- `19-VALIDATION.md` frontmatter flipped `status: approved` and Approval line stamped with date + 25/25 GREEN signal.
- INTAKE-01 (public form reachable) and INTAKE-07 (public submit endpoint reachable) closed.

## Task Commits

1. **Task 1: Add /participate(.*) and /api/intake(.*) to proxy.ts isPublicRoute matcher** — `1597484` (feat)
2. **Task 2: End-to-end Phase 19 smoke walk** — auto-approved (no commit; deferred to v0.2 milestone smoke walk per user preference)

**Plan metadata:** _to be committed at final step (includes 19-05-SUMMARY.md + 19-VALIDATION.md flip + STATE.md + ROADMAP.md)_

## Files Created/Modified

- `proxy.ts` — Added `/participate(.*)` and `/api/intake(.*)` entries (with comment header) to the `createRouteMatcher` array. No other lines touched.
- `.planning/phases/19-public-participate-intake-clerk-invite-turnstile/19-VALIDATION.md` — Flipped `status: draft` → `status: approved` and updated Approval footer with completion timestamp + suite signal.

## Decisions Made

- **Broader `/api/intake(.*)` over narrower `/api/intake/participate(.*)`:** Plan explicitly authorized the broader prefix because (a) any future intake endpoint added under `/api/intake/*` should be public by default for the same reason participate is — they are stakeholder-facing intake surfaces — and (b) Phase 20's cal.com webhooks live under `/api/webhooks` (already public via the pre-existing `'/api/webhooks(.*)'` entry), so there is no namespace collision risk. Re-touching `proxy.ts` for every new intake endpoint would create unnecessary churn on a security-sensitive file.
- **Append-at-end + comment-header pattern:** New entries appear AFTER the pre-existing `'/api/export/policy-pdf(.*)'` line, preceded by `// Phase 19 — public intake form + submit endpoint (INTAKE-01, INTAKE-07)`. This preserves git blame on the pre-existing seven entries, makes the Phase 19 additions scriptable to audit (`grep -A3 "Phase 19" proxy.ts`), and ties each addition back to its requirement IDs.
- **Auto-approve Task 2 checkpoint:** User preference (memory: `feedback_defer_smoke_walks.md`) overrides the in-plan `checkpoint:human-verify` gate. The full 18-step E2E walk (incognito browser → Turnstile widget → form submit → Inngest dev server inspection → Clerk dashboard invitation check → Resend inbox check → rate-limit replay → Turnstile failure replay → negative regression check on /policies → full repo test run) is rolled into the v0.2 milestone smoke walk, NOT skipped.

## Deviations from Plan

None — plan executed exactly as written. The proxy.ts edit landed verbatim per the plan's "After" code block (matching indentation, single quotes, trailing comma, comment header text, and entry order).

## Issues Encountered

None.

## Checkpoint Status

**Task 2 (`checkpoint:human-verify`): AUTO-APPROVED — DEFERRED to v0.2 milestone smoke walk.**

Per user preference logged in memory (`feedback_defer_smoke_walks.md`): "Defer manual smoke walks (dev-server walks, browser flows, Resend/external checks) to end of milestone, not per phase."

The 18-step end-to-end verification — incognito browser load of `/participate`, Turnstile widget resolution with Cloudflare test keys, field validation cycle, success-panel render, Network tab inspection of POST /api/intake/participate response, Inngest Dev Server function-run inspection (steps `create-clerk-invitation` and `send-welcome-email`), Clerk Dashboard invitation existence + publicMetadata check, Resend inbox check (if key configured), rate-limit replay test, Turnstile failure replay test, negative regression test on `/policies` (must still redirect to /sign-in), full phase-19 test suite re-run, and full repo test suite re-run — is **not skipped**. It is rolled into the v0.2 "Verifiable Policy OS — Public Consultation & On-Chain Anchoring" milestone smoke walk, where it will be executed in one consolidated pass alongside the rest of the v0.2 phases (17, 18, 19, and any subsequent v0.2 phases).

This deferral is consistent with prior phases in v0.2 (Phases 17, 18, 19-04 all auto-approved their per-phase checkpoints under the same preference). It does NOT block Phase 19 completion or Phase 20 planning, because the automated sampling already proves the source-level contract:

- `tests/phase-19/public-routes.test.ts` 2/2 GREEN (Wave 0 contract for THIS plan)
- `tests/phase-19/participate-route.test.ts` GREEN (Plan 19-01 route handler contract)
- `tests/phase-19/participate-intake.test.ts` GREEN (Plan 19-02 Inngest fn contract)
- `tests/phase-19/welcome-email.test.ts` GREEN (Plan 19-03 email template contract)
- `npx tsc --noEmit` clean

The remaining gaps that ONLY a real browser walk can close (Turnstile widget rendering, Clerk hosted invitation flow, Resend deliverability) are flagged in `19-VALIDATION.md` Manual-Only Verifications table and tracked for the milestone smoke walk.

## Phase 19 Final Acceptance Gate

This is the **last plan in Phase 19**. Phase-final acceptance gate quartet:

1. **Targeted Wave 0 contract test:** `npm test -- --run tests/phase-19/public-routes.test.ts` → 2/2 GREEN
2. **Full phase test suite:** `npm test -- --run tests/phase-19` → 4 files, 25/25 tests GREEN
3. **TypeScript clean:** `npx tsc --noEmit` → zero errors
4. **Git diff additions-only:** `git diff proxy.ts` → 3 lines added, 0 removed

All four signals GREEN. Phase 19 VALIDATION.md flipped `status: approved`.

## User Setup Required

None for this plan. Env vars `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY`, `CLOUDFLARE_TURNSTILE_SECRET_KEY`, `CLERK_SECRET_KEY`, `RESEND_API_KEY`, and `NEXT_PUBLIC_APP_URL` were tracked in earlier Phase 19 plans' USER-SETUP. The deferred milestone smoke walk will verify all of them in one pass.

## Next Phase Readiness

- **Phase 19 complete.** All 6 plans (19-00 through 19-05) shipped with SUMMARYs and Wave 0 contracts GREEN.
- **Requirements closed:** INTAKE-01 (public form), INTAKE-02 (Turnstile verify), INTAKE-03 (Inngest event), INTAKE-04 (Clerk invitation), INTAKE-05 (welcome email), INTAKE-06 (no info leak), INTAKE-07 (public submit endpoint).
- **v0.2 milestone smoke walk:** Phase 19 adds 18 verification steps to the consolidated walk checklist — see `19-VALIDATION.md` Manual-Only Verifications and Plan 19-05 Task 2 spec for the full list.
- **Phase 20 ready to plan:** No blockers from Phase 19. Phase 20 (cal.com webhooks) lives under `/api/webhooks` which is already public — no further proxy.ts changes needed for the next phase.

## Self-Check

- `proxy.ts` contains literal `'/participate(.*)'` — VERIFIED via grep
- `proxy.ts` contains literal `'/api/intake(.*)'` — VERIFIED via grep
- `proxy.ts` preserves all 7 pre-existing public route entries — VERIFIED via git diff (additions-only)
- `proxy.ts` `export default clerkMiddleware` shape unchanged — VERIFIED via grep
- Commit `1597484` — to be verified post-write
- `tests/phase-19/public-routes.test.ts` — 2/2 GREEN (verified)
- `tests/phase-19` full suite — 25/25 GREEN (verified)
- `npx tsc --noEmit` — clean (verified)
- `19-VALIDATION.md` — `status: approved` flipped (verified)

## Self-Check: PASSED

- proxy.ts — modified, contains both new entries, 7 pre-existing preserved
- 19-VALIDATION.md — status flipped to approved
- Commit 1597484 — FOUND in git log
- All Wave 0 contract tests GREEN

---
*Phase: 19-public-participate-intake-clerk-invite-turnstile*
*Plan: 05*
*Completed: 2026-04-14*
