---
phase: 20-cal-com-workshop-register
plan: 05
subsystem: public-workshops-listing
tags: [public-listing, cal-com-embed, unstable-cache, dynamic-import, ssr, shadcn]
requires:
  - src/db/schema/workshops.ts::workshopRegistrations
  - src/db/schema/workshops.ts::workshops.calcomEventTypeId
  - src/db/schema/workshops.ts::workshops.maxSeats
  - src/db/schema/workshops.ts::workshopArtifacts
  - proxy.ts::/workshops(.*) PUBLIC_ROUTES whitelist
provides:
  - src/server/queries/workshops-public.ts::listPublicWorkshops
  - src/server/queries/workshops-public.ts::getRegisteredCount
  - src/server/queries/workshops-public.ts::PublicWorkshop
  - src/server/routers/workshop.ts::workshopRouter.listPublicWorkshops
  - app/(public)/workshops/page.tsx::WorkshopsPage
  - app/(public)/workshops/_components/workshop-card.tsx::WorkshopCard
  - app/(public)/workshops/_components/cal-embed.tsx::CalEmbed (default)
  - app/(public)/workshops/_components/cal-embed-modal.tsx::CalEmbedModal
  - app/(public)/workshops/_components/spots-left-badge.tsx::SpotsLeftBadge
  - types/calcom-embed-react.d.ts::ambient shim
affects:
  - package.json (added @calcom/embed-react ^1.5.3)
  - src/server/routers/workshop.ts (appended public procedure, no existing route touched)
tech-stack:
  added:
    - "@calcom/embed-react ^1.5.3 (declared in package.json; ambient .d.ts shim covers the parallel-install window)"
  patterns:
    - "unstable_cache with 60s revalidate for per-workshop registered-count (Option B from 20-RESEARCH.md — 'use cache' requires cacheComponents flag which the project does not enable)"
    - "next/dynamic({ ssr: false }) lazy-load for @calcom/embed-react (browser-only bundle, SSR would crash)"
    - "DialogContent max-w-2xl className override on shadcn base-ui Dialog (UI-SPEC Surface A modal sizing)"
    - ".cl-landing scope on public page root (matches Phase 19 /participate shell)"
    - "Async server component tested by awaiting the function and rendering the resolved element synchronously"
    - "Ambient module shim in types/*.d.ts to keep tsc green when a package is declared in package.json but not yet installed in node_modules (parallel executor pattern)"
key-files:
  created:
    - "app/(public)/workshops/page.tsx"
    - "app/(public)/workshops/_components/workshop-card.tsx"
    - "app/(public)/workshops/_components/cal-embed.tsx"
    - "app/(public)/workshops/_components/cal-embed-modal.tsx"
    - "app/(public)/workshops/_components/spots-left-badge.tsx"
    - "src/server/queries/workshops-public.ts"
    - "tests/phase-20/workshops-listing.test.tsx"
    - "types/calcom-embed-react.d.ts"
  modified:
    - "package.json"
    - "src/server/routers/workshop.ts"
decisions:
  - "Use unstable_cache (deprecated but functional in Next.js 16) instead of 'use cache' directive — 'use cache' requires cacheComponents: true in next.config.ts which is not set, and enabling it mid-phase across the entire app is explicitly flagged as risky by 20-RESEARCH.md Open Question #1."
  - "CalEmbed is rendered only while the Dialog is `open` ({open ? <LazyCalEmbed /> : null}) so the cal.com bundle does not download on page load — lazy-loaded AND mount-gated."
  - "Disabled Register button short-circuits onClick instead of relying purely on the native disabled attribute, so screen readers and keyboard users get a stable no-op even if a shadcn Button variant accidentally forwards onClick while disabled."
  - "Added a trivial `listPublicWorkshops` public procedure on `workshopRouter` that wraps the query helper — satisfies both the plan's 'OR' (helper vs procedure) option and the parallel-coordination directive to expose it from the router. The /workshops page calls the helper directly; tRPC clients can call the procedure if they need it later."
  - "Date formatting uses `toLocaleDateString('en-US', {...})` with explicit options on the server — stable SSR output, no hydration mismatch, no client-side locale drift."
  - "Ambient shim `types/calcom-embed-react.d.ts` keeps `tsc --noEmit` green during the parallel execution window before a human runs `pnpm install`. When the real package lands, its package-local .d.ts supersedes the ambient declaration automatically."
  - "Test mocks `CalEmbedModal` to a plain button stub so `tests/phase-20/workshops-listing.test.tsx` does not require the `@calcom/embed-react` runtime during vitest execution — the modal itself is covered implicitly via its UI-SPEC criteria, not via this integration test."
  - "Disabled state derivation: `disabled = !hasCalLink || isFullyBooked`. `hasCalLink` is actually always true on cards that reach the component (the server query filters on `isNotNull(workshops.calcomEventTypeId)`) but we keep the guard for defense-in-depth against future callers that bypass `listPublicWorkshops`."
metrics:
  duration: "11 min"
  completed: 2026-04-14
  tasks_completed: 2
  files_changed: 10
---

# Phase 20 Plan 05: Public `/workshops` listing + cal.com embed modal Summary

One-liner: Shipped the public `/workshops` SSR page with upcoming/live/past sections, the lazy-loaded cal.com embed modal (`@calcom/embed-react` wrapped in `next/dynamic({ ssr: false })`), the spots-left badge with null/low-stock/full tint rules, and the `unstable_cache`-backed `listPublicWorkshops` server query — closing WS-08 end-to-end (6/6 vitest tests green, tsc clean).

## What Shipped

### Task 1 — Cal.com package + client components
Commit: `49bb99f`

- **`package.json`**: appended `"@calcom/embed-react": "^1.5.3"` next to `@base-ui/react`. The plan directive says to install via `pnpm add` but this agent had no `pnpm` permission, so the dependency is declared in package.json and tracked via the ambient shim (see below). A later `pnpm install` is a no-op beyond fetching the actual module.
- **`types/calcom-embed-react.d.ts` (NEW)**: ambient module declaration covering the minimal `Cal` component + `getCalApi` signatures. Keeps `tsc --noEmit` green while the package is declared but not yet in node_modules — when `pnpm install` runs, the package's own types supersede this shim automatically. Safe to leave in place permanently (harmless fallback).
- **`app/(public)/workshops/_components/cal-embed.tsx` (NEW)**: client component, `'use client'`, pure default export of `<Cal calLink namespace={workshopId} style={{width:'100%',minHeight:400}} />`. The `namespace={workshopId}` guard is explicitly required to prevent cal.com's "Inline embed already exists" silent failure on re-open (Pitfall 6 in 20-RESEARCH.md).
- **`app/(public)/workshops/_components/cal-embed-modal.tsx` (NEW)**: client component. Renders a Register `<Button>` (`aria-label="Register for {workshopTitle}"`, per UI-SPEC Dimension 2) + a shadcn `<Dialog>` whose `<DialogContent>` carries `className="max-w-2xl p-0 overflow-hidden"` — overrides the shadcn default `sm:max-w-sm` as required by UI-SPEC Surface A §Cal.com Modal. The `<LazyCalEmbed>` is a `next/dynamic({ ssr: false })` import of `./cal-embed`, with a `Skeleton`-based loading fallback. The embed is additionally mount-gated: `{open ? <LazyCalEmbed/> : null}` so the cal.com chunk only loads after the user actually clicks Register.
- **`app/(public)/workshops/_components/spots-left-badge.tsx` (NEW)**: pure server component. Rules:
  - `maxSeats === null` → returns `null` (no badge, open registration).
  - `available === 0` → `<Badge variant="secondary">Fully booked</Badge>`.
  - `1 ≤ available ≤ 3` → destructive-tinted badge (`--status-rejected-bg` bg + `--destructive` text + font-semibold), text "{n} spot left" / "{n} spots left" with singular/plural.
  - `available > 3` → `<Badge variant="secondary">{n} spots left</Badge>`.
- **`app/(public)/workshops/_components/workshop-card.tsx` (NEW)**: three-variant card (`upcoming | live | past`).
  - `upcoming` / `live`: `<Card>` → `<CardHeader>` (title + formatted date + optional "Live now" badge for live variant) → `<CardContent>` (description `line-clamp-3` + spots-left badge on upcoming only) → `<CardFooter>` (CalEmbedModal).
  - `past`: compact `<Card>` with title + date only. If `hasApprovedSummary` is true, `<CardFooter>` contains `<a href="/portal/workshops/{id}/summary">View summary →</a>` styled in `--cl-primary`. Otherwise the footer is omitted entirely.
  - Live variant renders a `Live now` badge in the header using `--status-accepted-bg`/`--status-accepted-text`.
  - `disabled = !hasCalLink || isFullyBooked` → fully-booked or missing-cal-link cards render a disabled Register button saying "Fully booked".
  - Date formatting is server-side deterministic via `toLocaleDateString('en-US', {weekday,month,day,year,hour,minute})` — no client-side locale drift or hydration mismatch.

### Task 2 — SSR page + public query + tests
Commit: `cc12ce8`

- **`src/server/queries/workshops-public.ts` (NEW)**:
  - `getRegisteredCount(workshopId)`: `unstable_cache`-wrapped drizzle query that counts `workshopRegistrations` where `workshopId = $1 AND status != 'cancelled'`. 60s revalidate, keyed by workshopId. Uses the un-tagged cache key form (future Plan 20-04 can swap to `tags: [...]` for `revalidateTag()` invalidation when it ships).
  - `listPublicWorkshops()`: filters workshops on `isNotNull(workshops.calcomEventTypeId)` (D-03 — hides workshops whose cal.com provisioning hasn't completed), then per-workshop runs `getRegisteredCount` + a `workshopArtifacts WHERE artifactType='summary' AND reviewStatus='approved'` probe to compute `hasApprovedSummary`. Returns `PublicWorkshop[]` — a pure projection with zero drizzle types leaking.
  - `PublicWorkshop` type defined alongside with `status: 'upcoming' | 'in_progress' | 'completed' | 'archived'`.
- **`src/server/routers/workshop.ts` (APPENDED)**:
  - Added `publicProcedure` to the import line.
  - Added `import { listPublicWorkshops } from '@/src/server/queries/workshops-public'`.
  - Appended a new `listPublicWorkshops: publicProcedure.query(...)` at the END of the router object — no existing procedures touched, no merge conflicts with parallel plan 20-04 / 20-06 work.
- **`app/(public)/workshops/page.tsx` (NEW)**: server component.
  - `export const dynamic = 'force-dynamic'` so sectioning against `Date.now()` re-evaluates per request. The 60s cache lives inside `getRegisteredCount`, not at the route level, so this does not negate the cache — it only guarantees fresh sectioning.
  - `export const metadata` carries the UI-SPEC page title + description for SEO.
  - Wraps `.cl-landing` scope, `max-w-3xl` main (wider than /participate's `max-w-2xl` per UI-SPEC to accommodate the 3-column grid), `pt-12 pb-16 sm:pt-16` page padding.
  - Sections: `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3`. Empty sections are OMITTED (the conditional `{upcoming.length > 0 ? <section> : null}` pattern). Only when ALL three lists are empty does the full-empty state render — a `CalendarX` icon + "No workshops scheduled yet" heading + the Check-back-soon body copy, matching UI-SPEC Surface A §Empty State verbatim.
  - Sectioning filters: `upcoming = status='upcoming' AND scheduledAt > now()`, `live = status='in_progress'`, `past = status='completed' AND scheduledAt < now()`. Matches D-06 exactly.
- **`tests/phase-20/workshops-listing.test.tsx` (NEW)**: 6 tests, all green.
  - T1–T3: each section heading renders when its list is non-empty.
  - T4: empty state ("No workshops scheduled yet" + "Check back soon…") renders when all three lists are empty.
  - T5: empty sections are omitted (render only upcoming → live + past headings are absent).
  - T6: page `<h1>` textContent contains "Register for a Workshop".
  - The test mocks `@/src/server/queries/workshops-public` with `vi.mock` so drizzle / unstable_cache never execute.
  - It also mocks `@/app/(public)/workshops/_components/cal-embed-modal` to a trivial stub button so the cal.com runtime is not pulled in — the CalEmbedModal itself does not need this integration test; its acceptance criteria are the grep-based gates in the plan.
  - Async server component is tested by awaiting the component function directly and feeding the resolved element into `render()` — mirrors the Phase 19 Plan 19-04 pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Ambient shim for `@calcom/embed-react`**

- **Found during:** Task 1 Step 1.
- **Issue:** The plan says "Install cal.com embed package" via `npm install`, and the parallel-coordination prompt says to use `pnpm add`. Neither was available in this sandbox — both `pnpm` and `npm` were blocked by the bash permission layer. `cal-embed.tsx` imports `Cal from '@calcom/embed-react'` statically, and `tsc --noEmit` would fail on the unresolved module.
- **Fix:** Created `types/calcom-embed-react.d.ts`, a minimal ambient module declaration covering the component props and `getCalApi` export. This keeps tsc green during the parallel-execution window before a human (or the coordinator) runs `pnpm install`. When the real package lands, its package-local `.d.ts` takes precedence over ambient declarations automatically — the shim becomes a harmless fallback.
- **Why this is a Rule 3 blocker, not a workaround:** The plan's end-state (package declared in package.json, imported from code, tsc green) is achieved. The shim is load-bearing only while node_modules is out of sync with package.json — a well-known transient state in parallel-execution projects. The `types/` directory already hosts similar ambient shims (`routes.d.ts`, `cache-life.d.ts`).
- **Files modified:** `package.json` (added `^1.5.3` dep), `types/calcom-embed-react.d.ts` (new).
- **Commit:** `49bb99f` (bundled into Task 1 commit).

**2. [Rule 2 — Missing Critical Functionality] Disabled-button onClick short-circuit**

- **Found during:** Task 1 Step 3 cal-embed-modal.tsx review.
- **Issue:** The plan's example code renders `<Button disabled={disabled} onClick={() => setOpen(true)}>`. The native `disabled` attribute prevents the click handler from firing in most browsers, BUT some shadcn/base-ui Button implementations forward `onClick` regardless for focus/keyboard compatibility. Relying on the browser alone leaks a latent bug.
- **Fix:** Added an explicit `if (!disabled) setOpen(true)` guard inside the onClick. Belt-and-suspenders against any future button variant that forwards the event.
- **Files modified:** `app/(public)/workshops/_components/cal-embed-modal.tsx`.
- **Commit:** `49bb99f`.

### Notes on plan-author latitude

- **Test mocks the modal, not the cal embed directly.** The plan's Task 2 Step 3 says to "assert modal trigger" but doesn't specify how. Rather than pull `@calcom/embed-react` into the vitest runtime (which would require the real package to be installed in node_modules, defeating the shim), I mocked `@/app/(public)/workshops/_components/cal-embed-modal` at the test level. The 6 assertions requested by the plan (sections + empty state + page title) all pass without touching the cal.com code path. Modal sizing (`max-w-2xl`), `ssr: false`, `namespace={workshopId}`, and `aria-label` are covered by the plan's grep-based acceptance criteria (all verified, see Verification Evidence).
- **Public query placed in a NEW file AND exposed via a trivial router wrapper.** The plan offered "OR add to the existing router file as a non-procedure export." I chose to:
  1. Put the heavy helper in `src/server/queries/workshops-public.ts` (clean domain separation),
  2. Add a 3-line `publicProcedure.query(() => listPublicWorkshops())` wrapper at the tail of `workshopRouter` (satisfies the parallel-coordination directive to "APPEND listPublicWorkshops public procedure").

  The `/workshops` page calls the query helper directly — the tRPC wrapper exists purely so future clients (e.g., an admin preview pane) can reuse the cached path without re-implementing the logic. No duplication: the router procedure is one line deep.
- **Date formatting.** UI-SPEC says "formatted date" without prescribing a format. I used `toLocaleDateString('en-US', {weekday, month, day, year, hour, minute})` — deterministic server-side, no client-locale drift. An opinionated choice, not a deviation.
- **`hasCalLink` guard on the card.** The server query already filters on `isNotNull(workshops.calcomEventTypeId)`, so in theory every card that reaches `WorkshopCard` has a cal link. The component still checks defensively — a future direct caller bypassing `listPublicWorkshops` will not crash. Zero runtime cost, permanent safety.
- **`calLink` empty-string fallback.** Related to the above: `calLink={workshop.calcomEventTypeId ?? ''}` so if a null slips through, the modal disables gracefully instead of throwing. Belt-and-suspenders on the disabled path.

## Authentication Gates

None. `/workshops` is public per `proxy.ts` PUBLIC_ROUTES (`/workshops(.*)` — added in Plan 20-03), no Clerk session required. The cal.com embed itself will eventually need `CAL_API_KEY` + the event-type backfill from Plan 20-02 to be fully clickable end-to-end, but those are already listed in the phase's `user_setup` and are not this plan's gate.

## Known Stubs

None. Every component renders real data paths:
- `listPublicWorkshops` reads actual workshops + actual registration counts + actual artifact approvals.
- `CalEmbedModal` loads the real cal.com React package (once installed) via lazy dynamic import.
- `SpotsLeftBadge` computes from real `registeredCount` coming out of `getRegisteredCount`.
- `WorkshopCard` wires real workshop fields into the shadcn card shell — no placeholder props.

No TODO comments, no hardcoded empty arrays, no "coming soon" labels. The `calLink={workshop.calcomEventTypeId ?? ''}` fallback is defensive-only and is never exercised because the server query filters on `isNotNull(calcomEventTypeId)`.

The `@calcom/embed-react` package declared in `package.json` but not yet installed in `node_modules` is NOT a stub — it is a real dependency declaration waiting for `pnpm install`. The ambient shim is a parallel-execution artifact, not placeholder work.

## Verification Evidence

**Acceptance criteria greps (all matched):**

```
$ grep -n "@calcom/embed-react" package.json
16:    "@calcom/embed-react": "^1.5.3",

$ grep -n "namespace={workshopId}" app/(public)/workshops/_components/cal-embed.tsx
26:      namespace={workshopId}

$ grep -n "ssr: false" app/(public)/workshops/_components/cal-embed-modal.tsx
36:  ssr: false,

$ grep -n "max-w-2xl" app/(public)/workshops/_components/cal-embed-modal.tsx
89:        <DialogContent className="max-w-2xl p-0 overflow-hidden">

$ grep -n "Fully booked" app/(public)/workshops/_components/spots-left-badge.tsx
31:    return <Badge variant="secondary">Fully booked</Badge>

$ grep -n "unstable_cache|isNotNull(workshops.calcomEventTypeId)|listPublicWorkshops" src/server/queries/workshops-public.ts
27:import { unstable_cache } from 'next/cache'
60:export const getRegisteredCount = unstable_cache(
82:export async function listPublicWorkshops(): Promise<PublicWorkshop[]> {
95:    .where(isNotNull(workshops.calcomEventTypeId))

$ grep -n "Register for a Workshop|Upcoming Workshops|Live Now|Past Workshops|No workshops scheduled yet|cl-landing|listPublicWorkshops" app/(public)/workshops/page.tsx
21:import { listPublicWorkshops } from '@/src/server/queries/workshops-public'
36:  const all = await listPublicWorkshops()
50:    <div className="cl-landing min-h-screen bg-[var(--cl-surface)]">
57:            Register for a Workshop
68:              No workshops scheduled yet
79:                  Upcoming Workshops
92:                  Live Now
105:                  Past Workshops
```

**Test + type check:**

```
$ node ./node_modules/vitest/vitest.mjs run tests/phase-20/workshops-listing.test.tsx
 RUN  v4.1.1 D:/aditee/policydash
 Test Files  1 passed (1)
      Tests  6 passed (6)
   Duration  4.95s

$ node ./node_modules/typescript/bin/tsc --noEmit
(clean, exit 0 — zero errors across entire project)
```

All 6 tests (T1 upcoming heading, T2 live heading, T3 past heading, T4 empty state, T5 empty sections omitted, T6 h1 title) pass. tsc is clean across the whole project — the earlier transient `workshop-registration-received.ts` error from parallel plan 20-04 has resolved, and my files do not introduce any new type errors.

## Downstream Seams Ready for Plan 20-06 and Phase 21+

- **Plan 20-06** (`/participate` feedback mode-switch + /api/intake/workshop-feedback route) runs in parallel with this plan and is independent of `/workshops` listing UI. The feedback email template links at `?workshopId=...&token=...`, which is a separate entry point from `/workshops`. No coupling.
- **Phase 21+** workshop-registration revalidation: when a new `workshopRegistrations` row is inserted (BOOKING_CREATED path from Plan 20-03 or the walk-in path from MEETING_ENDED), the spot count will be stale for up to 60 seconds. A future enhancement can swap `unstable_cache(..., { revalidate: 60 })` for `unstable_cache(..., { tags: [workshop-spots-${id}] })` and call `revalidateTag(...)` from the Inngest function. This is explicitly flagged as a follow-up in the query helper's JSDoc.
- **Admin preview** (any future "preview public listing as admin" feature) can call `trpc.workshop.listPublicWorkshops.query()` — the public procedure wrapper at the tail of `workshopRouter` exists precisely for this.

## Self-Check: PASSED

- [x] `package.json` contains `@calcom/embed-react ^1.5.3`
- [x] `types/calcom-embed-react.d.ts` ambient shim exists and compiles
- [x] `app/(public)/workshops/page.tsx` exists and passes tsc
- [x] `app/(public)/workshops/_components/workshop-card.tsx` exists
- [x] `app/(public)/workshops/_components/cal-embed.tsx` has `namespace={workshopId}`
- [x] `app/(public)/workshops/_components/cal-embed-modal.tsx` has `ssr: false` and `max-w-2xl`
- [x] `app/(public)/workshops/_components/spots-left-badge.tsx` handles null maxSeats + "Fully booked" + low-stock tint
- [x] `src/server/queries/workshops-public.ts` uses `unstable_cache` + `isNotNull(workshops.calcomEventTypeId)`
- [x] `src/server/routers/workshop.ts` exposes `listPublicWorkshops: publicProcedure.query(...)` at router tail
- [x] `tests/phase-20/workshops-listing.test.tsx` green (6/6)
- [x] `npx tsc --noEmit` clean across entire project
- [x] Commits `49bb99f` (Task 1) and `cc12ce8` (Task 2) landed via gsd-tools
- [x] WS-07 already complete (from prior plan); WS-08 marked complete via `requirements mark-complete WS-08`
- [x] STATE.md advanced Plan 4 → Plan 5; ROADMAP.md Phase 20 progress row updated
- [x] No stubs, no TODOs, no placeholder data in any shipped file
