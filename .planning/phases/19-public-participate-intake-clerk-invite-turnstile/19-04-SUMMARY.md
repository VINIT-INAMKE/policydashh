---
phase: 19-public-participate-intake-clerk-invite-turnstile
plan: 04
subsystem: ui
tags: [next.js, react, turnstile, base-ui, shadcn, sonner, public-route, intake]

# Dependency graph
requires:
  - phase: 19-public-participate-intake-clerk-invite-turnstile
    provides: "Plan 19-00 installed @marsidev/react-turnstile and locked Wave 0 contracts; Plan 19-01 shipped POST /api/intake/participate route handler; Plan 19-02 shipped Inngest participate.intake handler; Plan 19-03 shipped welcome email templates"
provides:
  - "Public /participate page (server shell + .cl-landing scope) at app/(public)/participate/page.tsx"
  - "Client form island participate-form.tsx with 7 user fields + Turnstile widget"
  - "Form-replace success panel participate-success.tsx (no redirect, no info leak)"
  - "Dual error presentation pattern (sonner toast + inline role=alert) per WCAG 4.1.3"
  - "base-ui Select<string> nullable-value adapter pattern for empty-string form state"
affects: [19-05 (proxy isPublicRoute whitelist), v0.2 milestone smoke walk]

# Tech tracking
tech-stack:
  added: []  # all deps already installed in 19-00
  patterns:
    - "Public route group app/(public)/participate/ with zero Clerk/tRPC imports (Phase 09 pattern extended)"
    - "Form-replace success state via React state flag instead of route navigation (preserves URL, blocks back-button double-submit)"
    - "Turnstile token gates submit: button disabled until onSuccess callback fires"
    - "base-ui Select value={state.field || null} + onValueChange={(v) => setField(v ?? '')} adapter for empty-string defaults"

key-files:
  created:
    - "app/(public)/participate/page.tsx"
    - "app/(public)/participate/_components/participate-form.tsx"
    - "app/(public)/participate/_components/participate-success.tsx"
  modified: []

key-decisions:
  - "Plan 19-04: base-ui Select<string> requires value: string | null and onValueChange receives string | null — adapt with `value || null` and `v ?? ''` because FormState uses '' for empty (canonical adapter for empty-string-default form state on this repo's Select primitive)"
  - "Plan 19-04: Form uses 7 user-facing fields + 1 system Turnstile (UI-SPEC §Form Field Inventory lists 8 rows including Turnstile as row 8); the React FormState shape carries 7 keys, Turnstile token is separate state"
  - "Plan 19-04: Auto-approved checkpoint task 3 per user preference to defer per-phase smoke walks to end-of-milestone — visual verification rolled into v0.2 milestone walk, NOT skipped"

patterns-established:
  - "Public form pattern: server page shell + client form island + client success island + form-replace state (no redirect)"
  - "Turnstile gate pattern: store token in React state, derive `canSubmit = !!turnstileToken && !submitting`, set Button disabled+aria-disabled+title='Please complete the security check'"
  - "Dual error presentation: setTopError() + toast.error() side-by-side on every server-error branch (400/403/429/500/network)"

requirements-completed: [INTAKE-01, INTAKE-07]

# Metrics
duration: 4min
completed: 2026-04-14
---

# Phase 19 Plan 04: Public /participate Form UI Summary

**Public `/participate` intake page with 7-field form, Turnstile widget gating submit, and form-replace success panel posting to /api/intake/participate.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-14T11:41:26Z
- **Completed:** 2026-04-14T11:45:00Z
- **Tasks:** 2 of 2 auto + 1 checkpoint auto-approved (3 of 3 total)
- **Files created:** 3
- **Files modified:** 0

## Accomplishments

- `app/(public)/participate/page.tsx` server component renders `.cl-landing` scope, "Join the Consultation" headline (Newsreader 28px), and mounts `<ParticipateForm />` client island. Zero Clerk imports.
- `app/(public)/participate/_components/participate-form.tsx` ships all 7 user fields (name, email, role, orgType, orgName, expertise, howHeard) wired to base-ui Select/RadioGroup primitives, with Turnstile widget from `@marsidev/react-turnstile`, client-side validation, dual-presentation error handling (sonner + inline alert), and form-replace success state.
- `app/(public)/participate/_components/participate-success.tsx` renders the post-submit panel with green CheckCircle2 icon, "You're on the list." heading, bucket badge, and `role="status" aria-live="polite"` — preserves URL, no info leak about account existence (INTAKE-06).
- POST target `/api/intake/participate` (from Plan 19-01) receives `{ ...formState, turnstileToken }` JSON; 200 → success panel + sonner toast; 400/403/429/500/network → dual error presentation.
- TypeScript clean (`npx tsc --noEmit` zero errors).

## Task Commits

1. **Task 1: page.tsx + participate-success.tsx** — `73f7d97` (feat)
2. **Task 2: participate-form.tsx (Turnstile + 7 fields + submit)** — `7365876` (feat)
3. **Task 3: Visual checkpoint** — auto-approved (no commit; deferred to v0.2 milestone smoke walk per user preference)

**Plan metadata:** _to be committed at final step_

## Files Created/Modified

- `app/(public)/participate/page.tsx` — Server component shell with .cl-landing scope, headline, subhead, ParticipateForm mount
- `app/(public)/participate/_components/participate-form.tsx` — Client form: 7 fields, base-ui Select/RadioGroup, Turnstile widget, validation, fetch POST, dual error UX, form-replace success
- `app/(public)/participate/_components/participate-success.tsx` — Client success panel with CheckCircle2, bucket-keyed copy, Badge, post-submit links

## Decisions Made

- **base-ui Select nullable-value adapter:** `<Select value={state.howHeard || null} onValueChange={(v) => update('howHeard', v ?? '')}>` — base-ui's `Select.Root.Props<string>` types value as `string | null`, but FormState uses `''` for empty. `|| null` and `?? ''` bridge the two without state-shape churn. First documented appearance of this adapter for empty-string-default form state on this repo.
- **Form-replace success (not redirect):** Per UI-SPEC line 433 (INTAKE-06 no-info-leak rationale) — same panel renders for new and existing users, URL never changes, back-button cannot replay submit.
- **Turnstile environment guard:** When `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` is missing, render placeholder text ("Security widget unavailable in this environment.") instead of crashing the form. Submit stays disabled because `turnstileToken` never resolves — fail-safe by construction.
- **Auto-approve visual checkpoint:** User preference (memory: defer smoke walks to end-of-milestone) overrides the in-plan `checkpoint:human-verify` gate. Visual + interaction verification rolled into the v0.2 milestone smoke walk, NOT skipped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] base-ui Select TS2345 nullable-value mismatch**
- **Found during:** Task 2 (`npx tsc --noEmit` after writing participate-form.tsx)
- **Issue:** Plan's literal JSX `<Select value={state.orgType} onValueChange={(v) => update('orgType', v as OrgType)}>` failed TypeScript: base-ui `SelectPrimitive.Root.Props<string>` types `value` as `string | null` (not `string | undefined`), and `state.orgType` is `OrgType | ''` which doesn't satisfy it. Same error on `howHeard` Select.
- **Fix:** Adapted both Select call sites to `value={state.X || null}` + `onValueChange={(v) => update('X', v ?? '')}`. The empty string `''` becomes `null` for the primitive; `null` from the primitive becomes `''` for FormState.
- **Files modified:** app/(public)/participate/_components/participate-form.tsx (2 lines)
- **Verification:** `npx tsc --noEmit` returns clean (zero participate errors, zero regressions elsewhere).
- **Committed in:** 7365876 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minimal — adapter pattern preserves plan's intended UX exactly. Documented as new repo pattern for empty-string-default Select state.

## Issues Encountered

None beyond the auto-fixed TS error above. The plan was unusually well-specified — 351-line participate-form.tsx file landed verbatim modulo the 2-line Select adapter fix.

## Checkpoint Status

**Task 3 (`checkpoint:human-verify`): AUTO-APPROVED — DEFERRED to v0.2 milestone smoke walk.**

Per user preference logged in memory (`feedback_defer_smoke_walks.md`): "Defer manual smoke walks (dev-server walks, browser flows, Resend/external checks) to end of milestone, not per phase."

The 14-step visual + interaction verification (incognito browser walk, Turnstile resolution, field validation, success panel render, Inngest event delivery, mobile breakpoint check, accessibility tab order) is **not skipped** — it is rolled into the v0.2 "Verifiable Policy OS — Public Consultation & On-Chain Anchoring" milestone smoke walk, where it will be executed alongside Plan 19-05's proxy whitelist (which is required before `/participate` can actually be reached unauthenticated).

This deferral is consistent with prior phases in v0.2 and does NOT block Plan 19-05 from depending on Plan 19-04's outputs.

## User Setup Required

None for this plan (env vars `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` and `CLOUDFLARE_TURNSTILE_SECRET_KEY` were tracked in Plan 19-00 USER-SETUP). The form gracefully degrades to "Security widget unavailable in this environment." text when the site key is missing in dev.

## Next Phase Readiness

- **Plan 19-05 (proxy isPublicRoute whitelist):** Ready. The `/participate` route exists at `app/(public)/participate/page.tsx`; Plan 19-05 just needs to add `/participate` to the proxy.ts isPublicRoute matcher so unauthenticated visitors don't redirect to sign-in.
- **v0.2 milestone smoke walk:** Add to walk checklist — verify form renders, Turnstile resolves with test keys, valid submit triggers POST + Inngest event + welcome email, error states surface correctly, mobile layout collapses radio grid to single column.
- **No blockers.**

## Self-Check: PASSED

- `app/(public)/participate/page.tsx` — FOUND
- `app/(public)/participate/_components/participate-form.tsx` — FOUND
- `app/(public)/participate/_components/participate-success.tsx` — FOUND
- Commit `73f7d97` — FOUND in git log
- Commit `7365876` — FOUND in git log
- `npx tsc --noEmit` — clean, zero errors

---
*Phase: 19-public-participate-intake-clerk-invite-turnstile*
*Plan: 04*
*Completed: 2026-04-14*
