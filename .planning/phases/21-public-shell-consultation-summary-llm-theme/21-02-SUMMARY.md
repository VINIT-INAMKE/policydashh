---
phase: 21-public-shell-consultation-summary-llm-theme
plan: 02
subsystem: ui
tags: [nextjs, layout, client-component, server-component, tailwind, font-variables, cl-landing, public-shell, lucide-icons]

# Dependency graph
requires:
  - phase: 21-public-shell-consultation-summary-llm-theme
    provides: Wave 0 PUB-09 RED test (public-header.test.tsx) locked by Plan 21-00
  - phase: 20.5-public-research-framework-content-pages
    provides: (public) route group baseline, PUB-07 layout shell stub, zero-Clerk-import discipline
  - phase: 19-public-participate-intake-clerk-invite-turnstile
    provides: self-wrapped .cl-landing intake/feedback shells (unwound here)
  - phase: 20-cal-com-workshop-register
    provides: self-wrapped .cl-landing workshops page (unwound here)
provides:
  - app/(public)/layout.tsx single source of .cl-landing + Newsreader/Inter font variables + public header/footer chrome
  - app/(public)/_components/public-header.tsx client component with sticky glassmorphism nav, active-route state via usePathname, mobile hamburger at md breakpoint, emerald #179d53 underline accent
  - app/(public)/_components/public-footer.tsx server component with "Published by PolicyDash" + Internal Login /sign-in link
  - PUB-09 Wave 0 RED test flipped GREEN (public-header.test.tsx)
  - Simplified participate + workshops pages (.cl-landing ownership deferred to layout per D-02)
affects:
  - 21-03 (SummaryReviewCard workspace moderator review — will render under this shell when inspecting public preview)
  - 21-04 (SectionSummaryBlock / FrameworkSummaryBlock — will render inside this shell via PublicPolicyContent)
  - any future (public) route (will automatically inherit header, footer, fonts, cl-landing palette)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Public shell inheritance: nested layout.tsx at route-group root owns className + font variables, child pages render `<div className='min-h-screen'>` without re-declaring palette"
    - "Client/server component split at the chrome boundary: PublicHeader is `'use client'` (usePathname + mobile menu useState), PublicFooter is server (no hooks, no state)"
    - "Font variable deduplication: layout and app/page.tsx both declare Newsreader + Inter with identical variable names — Next.js deduplicates at the font loader level per Phase 21 Pitfall 6"
    - "Hamburger mobile menu via max-height transition: max-h-0 ↔ max-h-96 with transition-[max-height] duration-200 ease-out, no external animation library"

key-files:
  created:
    - app/(public)/_components/public-header.tsx
    - app/(public)/_components/public-footer.tsx
  modified:
    - app/(public)/layout.tsx
    - app/(public)/participate/page.tsx
    - app/(public)/workshops/page.tsx

key-decisions:
  - "Layout owns cl-landing className at the root <div> (not `<main>`) so header + footer both inherit the palette tokens"
  - "PublicHeader is a standalone client component under app/(public)/_components/ — one file per responsibility, kept near the layout it serves"
  - "Mobile menu uses max-height transition not display-none toggling — 200ms ease-out feels like a modal not a snap, matches glassmorphism aesthetic"
  - "Active-route matching is prefix-aware for /portal and /framework (both have child routes) and exact-match for /research, /workshops, /participate"
  - "Nav order matches D-03 verbatim: Research, Framework, Workshops, Participate, Portal — Participate sits between Workshops and Portal per CONTEXT copywriting contract"
  - "Footer retains /sign-in target (not a new /login) so Phase 1 Clerk auth flow stays untouched"

patterns-established:
  - "Nested layout palette ownership: route-group layouts can own CSS-variable scopes without being root layouts — the inner <div> carries the className, the root app/layout.tsx still owns <html>/<body>"
  - "Pages inside a palette-owning layout render `<div className='min-h-screen'>` (or similar structural class only) and inherit all token values automatically — no re-wrapping"

requirements-completed: [PUB-09, PUB-10]

# Metrics
duration: 8min
completed: 2026-04-15
---

# Phase 21 Plan 02: Public Shell + cl-landing Layout Ownership Summary

**Rewrote `app/(public)/layout.tsx` to own the `.cl-landing` palette, Newsreader/Inter font variables, and sticky glassmorphism `PublicHeader` + single-row `PublicFooter` chrome so every `(public)` route inherits the same policy-grade theme automatically; flipped the Wave 0 `public-header.test.tsx` RED contract to GREEN and unwound the manual `.cl-landing` wrappers from `/participate` + `/workshops`.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-15T09:53:52Z
- **Completed:** 2026-04-15T10:02:00Z
- **Tasks:** 2 of 2
- **Files created:** 2
- **Files modified:** 3

## Accomplishments

- `app/(public)/layout.tsx` now owns the entire public-route chrome: `.cl-landing` className, `--font-cl-headline` (Newsreader) + `--font-cl-body` (Inter) CSS custom properties, sticky `<PublicHeader />`, main flex container, and `<PublicFooter />` attribution. Every `(public)` route inherits all four automatically.
- `app/(public)/_components/public-header.tsx` ships as a client component with sticky glassmorphism nav (`sticky top-0 z-50 bg-[var(--cl-surface-container-low)]/80 backdrop-blur-md`), `usePathname()`-driven active route state, 5-item nav in the locked D-03 order (Research → Framework → Workshops → Participate → Portal), emerald `#179d53` underline accent on the active route per D-01, and a mobile hamburger panel that expands via `max-height` transition at the `md:` breakpoint.
- `app/(public)/_components/public-footer.tsx` ships as a server component (zero hooks, zero state) rendering "Published by PolicyDash" on the left and an "Internal Login" `/sign-in` link on the right, with matching `--cl-outline-variant` border and `--cl-on-surface-variant` text color.
- Wave 0 PUB-09 RED contract `public-header.test.tsx` flipped to GREEN on first run — 1/1 test passing, module resolution succeeds against the new `app/(public)/_components/public-header.tsx` file.
- `/participate` and `/workshops` pages simplified: three `<div className="cl-landing min-h-screen bg-[var(--cl-surface)]">` wrappers replaced with plain `<div className="min-h-screen">` — `.cl-landing` palette, background, and font vars all inherited from the layout. Form mounts (`ParticipateForm`, `WorkshopFeedbackForm`, `WorkshopCard`) and JSDoc visual-contract comments preserved with a D-02 reference update.
- `npx tsc --noEmit` exits 0 after each task and in the final composite run.
- Parallel-execution discipline maintained: used `git commit --no-verify` on both task commits to avoid pre-commit hook contention with Plan 21-01 executor running in the same wave, and did not touch any backend files owned by 21-01 (`src/server`, `src/lib/llm.ts`, `src/inngest/**`).

## Task Commits

Each task was committed atomically with `--no-verify`:

1. **Task 1: Rewrite app/(public)/layout.tsx + create PublicHeader + PublicFooter** — `760185a` (feat)
2. **Task 2: Remove manual .cl-landing wrappers from participate + workshops pages** — `a200dcf` (refactor)

## Files Created/Modified

### Created

- `app/(public)/_components/public-header.tsx` — 115 lines. `'use client'` component. Imports `useState` from react, `Link` from `next/link`, `usePathname` from `next/navigation`, `Menu` + `X` from `lucide-react`. Declares `NAV_ITEMS` const + `isActive(pathname, href)` helper with prefix-match for `/portal` and `/framework`. Renders `<header>` with sticky glassmorphism backdrop, `<div>` container with logo `<Link href="/">` + desktop `<nav className="hidden md:flex">` + mobile `<button className="md:hidden">` hamburger toggle, and an expandable `<div>` mobile menu panel below. Both nav lists iterate `NAV_ITEMS.map` and conditionally apply the active/inactive className string based on `isActive(pathname, item.href)`.
- `app/(public)/_components/public-footer.tsx` — 32 lines. Server component (no `'use client'` directive). Renders a `<footer>` with `--cl-outline-variant` border-t and `--cl-surface` background, a centered max-w-screen-2xl `<div>` flex container with left `<span>Published by PolicyDash</span>` and right `<Link href="/sign-in">Internal Login</Link>`.

### Modified

- `app/(public)/layout.tsx` — Rewritten from the 29-line hollow stub (only `<div className="min-h-screen flex flex-col">` + inline `<header>`/`<main>`/`<footer>`) to the 46-line shell owner. Imports `Inter`, `Newsreader` from `next/font/google`, `PublicHeader` from `./_components/public-header`, `PublicFooter` from `./_components/public-footer`. Declares `newsreader` + `inter` font loaders with identical variable names + configs to `app/page.tsx` (deduplicated by Next.js per Phase 21 Pitfall 6). The root `<div>` className is a template literal combining `cl-landing`, `${newsreader.variable}`, `${inter.variable}`, `flex min-h-screen flex-col`, `bg-[var(--cl-surface)]`, `text-[var(--cl-on-surface)]`.
- `app/(public)/participate/page.tsx` — Two surgical edits. `IntakeShell` helper function: `<div className="cl-landing min-h-screen bg-[var(--cl-surface)]">` replaced with `<div className="min-h-screen">`. `FeedbackShell` helper function: same replacement. JSDoc comment "Visual contract: `.cl-landing` scope matches Phase 19 intake mode exactly." updated to "Visual contract: `.cl-landing` scope now inherited from (public)/layout.tsx (Phase 21 D-02)." No other edits — all form mounts, ParticipateForm, WorkshopFeedbackForm, ExpiredLinkCard, JWT verification flow, data fetches, and inner `<main>` JSX preserved unchanged.
- `app/(public)/workshops/page.tsx` — Two surgical edits. Root return `<div className="cl-landing min-h-screen bg-[var(--cl-surface)]">` replaced with `<div className="min-h-screen">`. JSDoc comment ".cl-landing scope, 28px page headline with Newsreader headline font)." updated to "28px page headline with Newsreader headline font; .cl-landing inherited from (public)/layout.tsx per Phase 21 D-02)." No other edits — `WorkshopCard`, `listPublicWorkshops`, `upcoming`/`live`/`past` filter logic, and empty-state UI preserved unchanged.

## Decisions Made

- **Layout owns `.cl-landing` at the root `<div>`, not on `<main>`.** Puts the palette scope above both header and footer so all three inherit the tokens from one declaration. Alternative (scoping to `<main>` only) would force header and footer to re-reference tokens through prop drilling or another parent, which is strictly worse.
- **`PublicHeader` is a standalone client component.** Two reasons: (a) `usePathname()` + `useState` for mobile menu both require `'use client'`, (b) keeping the directive isolated to the header component allows `PublicFooter` and layout to remain server components. If we had inlined the nav in the layout, the entire layout would need to be client.
- **Mobile menu uses max-height transition, not display toggling.** `max-h-0` ↔ `max-h-96` with `transition-[max-height] duration-200 ease-out` provides a smooth 200ms reveal that feels intentional. A `display: none ↔ block` toggle would be instant and visually jarring against the glassmorphism header.
- **Font declarations duplicated from `app/page.tsx`, not deleted-from-source.** Per Phase 21 Pitfall 6 + D-01 in CONTEXT, Next.js deduplicates identical font configs within a request — so the landing page at `/` can keep its own font loader while the layout declares identical ones. This keeps `/` (which sits OUTSIDE the `(public)` route group) independent of the layout refactor.
- **Nav order locked by D-03: Research → Framework → Workshops → Participate → Portal.** Participate is 4th, Portal is 5th — matches the copywriting contract. No "Join Consultation" CTA button per the explicit "no separate CTA" rule in D-03 (`/participate` itself is the conversion target).
- **Active-route matching is prefix-aware for `/portal` and `/framework`.** Both have nested routes (`/portal/[policyId]`, `/framework/[policyId]`), so an exact-match would fail to highlight the top-level link when a user is on a detail page. `/research`, `/workshops`, `/participate` use exact-match because they have no nested dynamic routes today.
- **Plain `<div className="min-h-screen">` in pages instead of deleting the wrapper entirely.** Keeps the semantic structure (a page-level container) and provides the `min-h-screen` contribution so the flex-column layout in the layout still fills the viewport when pages are short (e.g., empty workshops listing).

## Deviations from Plan

None — plan executed exactly as written. All grep acceptance criteria matched on first pass, `npx tsc --noEmit` exited 0 after each task, and the Wave 0 RED test flipped GREEN on first run. No auto-fixes applied under Rules 1/2/3; no architectural changes requested under Rule 4.

## Issues Encountered

- **Pre-existing ESLint errors in `app/(public)/` (out of scope).** When running `npx eslint "app/(public)/**/*.{ts,tsx}"` after Task 2, ESLint surfaced two errors:
  1. `app/(public)/participate/_components/participate-success.tsx:53:11` — `@next/next/no-html-link-for-pages` on an `<a>` element pointing to `/portal/`. This file was NOT touched by this plan (outside Plan 21-02 file scope).
  2. `app/(public)/workshops/page.tsx:37:15` — `react-hooks/purity` on `const now = Date.now()`. `git diff` confirms this line was present BEFORE my edits and is unchanged — my only edits to this file were the JSDoc comment and the root `<div>` className at lines 12 and 50.

  Per deviation_rules SCOPE BOUNDARY: both errors are pre-existing, not introduced by Plan 21-02, so they are NOT auto-fixed. Logged below in "Deferred Issues" and should be picked up by a dedicated lint-cleanup plan. Note: `npx eslint` exits with code 0 despite reporting these errors (eslint flat-config behavior), so they do not block CI.

- **Plan 21-01 / 21-03 / 21-04 Wave 0 RED contracts still failing (expected).** When running the full `npm test -- --run` suite, 14 tests fail across `tests/phase-21/consultation-summary-service.test.ts`, `src/inngest/__tests__/consultation-summary-generate.test.ts`, `src/server/routers/__tests__/consultation-summary.test.ts`, and `app/(public)/portal/[policyId]/_components/__tests__/section-summary-block.test.tsx`. All are Wave 0 RED contracts locked by Plan 21-00 and scheduled to flip GREEN by Plans 21-01 / 21-03 / 21-04 — NOT by Plan 21-02. Confirmed by module-not-found error messages (`@/src/lib/llm`, `@/src/inngest/functions/consultation-summary-generate`, `@/src/server/routers/consultation-summary`, `@/app/(public)/portal/[policyId]/_components/section-summary-block`). The one RED contract Plan 21-02 was responsible for (`public-header.test.tsx`) is GREEN.

## Deferred Issues

- **`participate-success.tsx` `<a>` → `<Link>` migration.** Pre-existing; out of Plan 21-02 file scope. Candidate for a Phase 21 cleanup plan or a v0.2 milestone-end lint sweep.
- **`workshops/page.tsx` `Date.now()` impurity.** Pre-existing (present in commit `cc12ce8` which shipped the page in Plan 20-05). Fix would be moving the `now` derivation inside the filter lambdas or rendering as `unstable_cache` output. Requires a Phase 20-cleanup or lint-sweep plan, not Plan 21-02 scope.

## User Setup Required

None — no external service configuration, no new environment variables, no new dependencies, no secrets or API keys. All imports resolve against existing `lucide-react`, `next/font/google`, `next/link`, `next/navigation`, `react` packages.

## Self-Check: PASSED

- `app/(public)/layout.tsx` FOUND (contains `cl-landing`, `font-cl-headline`, `font-cl-body`, `<PublicHeader />`, `<PublicFooter />`, `min-h-screen`)
- `app/(public)/_components/public-header.tsx` FOUND (contains `'use client'` as first line, `export function PublicHeader`, `usePathname`, `sticky top-0 z-50`, `backdrop-blur-md`, all 5 nav labels, `border-[#179d53]`, `aria-label={open ? 'Close navigation' : 'Open navigation'}`)
- `app/(public)/_components/public-footer.tsx` FOUND (contains `Published by PolicyDash`, `Internal Login`, `/sign-in`)
- `app/(public)/participate/page.tsx` MODIFIED (does NOT contain `className="cl-landing min-h-screen`, still contains `<ParticipateForm />` and `WorkshopFeedbackForm`)
- `app/(public)/workshops/page.tsx` MODIFIED (does NOT contain `className="cl-landing min-h-screen`, still contains `WorkshopCard` and `max-w-3xl`)
- Commit `760185a` FOUND in `git log --oneline` (feat: public shell with PublicHeader + PublicFooter + cl-landing ownership)
- Commit `a200dcf` FOUND in `git log --oneline` (refactor: strip manual .cl-landing wrappers from participate + workshops)
- `npx tsc --noEmit` exits 0 (final run after Task 2)
- `npm test -- --run app/(public)/_components/__tests__/public-header.test.tsx` reports 1 passed / 0 failed (Wave 0 PUB-09 RED contract flipped GREEN)

## Next Phase Readiness

- **Plan 21-03 (tRPC moderator router + SummaryReviewCard) unblocked on the layout side.** Any workspace preview of the public rendering that Plan 21-03 adds will now render inside the shared public shell automatically via route navigation.
- **Plan 21-04 (SectionSummaryBlock + FrameworkSummaryBlock) unblocked on the layout side.** Both components will render inside `(public)/layout.tsx` and inherit `.cl-landing` palette + fonts without re-declaring anything. The existing `PublicPolicyContent` extension pattern from Phase 20.5 (`sectionStatuses` optional prop) remains the template for the `sectionSummaries` prop Plan 21-04 will add.
- **Any future `(public)` route is free.** Drop a `page.tsx` under `app/(public)/[whatever]/` and it automatically gets the full chrome — no need to re-import fonts, re-declare `.cl-landing`, or manually mount a header/footer.
- **Parallel wave synchronization:** this plan completed without touching any files owned by the concurrent Plan 21-01 executor (`src/server`, `src/lib/llm.ts`, `src/inngest/**`, `src/db/schema`). Both plans can commit-integrate cleanly.

---
*Phase: 21-public-shell-consultation-summary-llm-theme*
*Plan: 02*
*Completed: 2026-04-15*
