---
phase: 13-ux-consolidation-navigation
plan: 02
subsystem: navigation
tags: [breadcrumb, layout, ux, client-component, trpc, accessibility]
requires:
  - Phase 02: WorkspaceLayout + WorkspaceNav client component with usePathname
  - Phase 02: tRPC client hook surface (@/src/trpc/client)
  - Phase 02: document.getById query
  - Phase 10: workshop.getById query
  - components/ui/skeleton (shadcn base-nova)
  - lucide-react ChevronRight icon
provides:
  - Breadcrumb client component at app/(workspace)/_components/breadcrumb.tsx
  - Workspace layout flex-column h-screen height chain (enables Plan 03 tab bar)
  - Full-depth breadcrumb rendering on every workspace page
affects:
  - app/(workspace)/layout.tsx (outer div, header, main restructured)
  - All workspace pages gain a 36px breadcrumb row below the header
tech-stack:
  added: []
  patterns:
    - Mocking next/navigation + next/link + tRPC client for isolated component tests
    - Hybrid label resolution (route map + entity-name lookup by segment position)
    - null-label sentinel for loading state (renders Skeleton at call site)
key-files:
  created:
    - app/(workspace)/_components/breadcrumb.tsx
    - src/__tests__/breadcrumb.test.tsx
  modified:
    - app/(workspace)/layout.tsx
decisions:
  - Loading state expressed as null label (not isLoading flag) to keep Crumb type simple
  - Mobile collapse hides middle crumbs via hidden sm:inline (no ellipsis)
  - Entity detection by segment position (segment[1]) rather than regex anywhere in path — avoids querying wrong entity on nested IDs
  - next/link mocked to plain <a> in tests for router-free rendering
metrics:
  duration: 11min
  tasks: 2
  files: 3
  tests_added: 8
  completed: 2026-04-12
---

# Phase 13 Plan 02: Breadcrumb Component + Workspace Layout Flex-Column Summary

Breadcrumb client component using usePathname + tRPC entity lookups, integrated below the workspace header; workspace layout refactored to flex-column h-screen so Plan 03 can stack a tab bar without hardcoded pixel offsets.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Create Breadcrumb client component with tests (TDD) | b648826 | app/(workspace)/_components/breadcrumb.tsx, src/__tests__/breadcrumb.test.tsx |
| 2 | Integrate Breadcrumb into workspace layout + flex-column refactor | 7af6465 | app/(workspace)/layout.tsx |

## What Was Built

### Breadcrumb component (`app/(workspace)/_components/breadcrumb.tsx`)

Client component that parses `usePathname()` into crumbs and resolves labels via a hybrid strategy:

- **Non-UUID segments** → looked up in `ROUTE_LABELS` map (policies, dashboard, feedback, workshops, change-requests → "Change Requests", versions, traceability, notifications, outcomes → "My Outcomes", evidence-gaps → "Evidence Gaps", users, audit). Unknown segments get a capitalised fallback.
- **UUID segments at position 1 under `/policies`** → resolved via `trpc.document.getById.useQuery` (enabled only when policy UUID present).
- **UUID segments at position 1 under `/workshops`** → resolved via `trpc.workshop.getById.useQuery`.
- **Other UUIDs** (e.g. section IDs, feedback IDs) → fallback to 8-char id prefix (can be upgraded later once those entities have client queries; for Plan 02 scope the primary focus is policy + workshop title crumbs).

A **null label** is the loading sentinel → renders `<Skeleton className="h-4 w-24" />` inline. Once tRPC returns the entity, the crumb rerenders with the real title.

Rendering contract from 13-UI-SPEC.md:
- `<nav aria-label="Breadcrumb">` wrapping `<ol class="flex items-center gap-1 text-sm">`
- Row styling: `shrink-0 border-b border-border bg-muted/50 px-6 py-2` (36px row)
- Separator: `<ChevronRight class="h-3 w-3 text-muted-foreground" aria-hidden />`
- Ancestor link: `text-muted-foreground transition-colors hover:text-foreground`
- Current page: `<span class="font-medium text-foreground" aria-current="page">`
- Mobile collapse: middle crumbs get `hidden sm:inline`; first and direct-parent and current always visible.

### Breadcrumb tests (`src/__tests__/breadcrumb.test.tsx`)

8 Vitest + @testing-library/react tests (spec required ≥ 7). Mocks:
- `next/navigation` → configurable `usePathname()`
- `next/link` → plain `<a>` (router-free)
- `@/src/trpc/client` → stub `trpc.document.getById.useQuery` / `trpc.workshop.getById.useQuery` with per-test `{ data, isLoading }` override

Coverage:
1. `/policies` → single "Policies" current-page crumb, no chevron, no link.
2. `/policies/{uuid}` (loading) → "Policies" link + chevron + `<Skeleton>` placeholder.
3. `/policies/{uuid}` (loaded) → "Policies" link + "Digital Economy Policy" current-page span.
4. `/policies/{uuid}/feedback` → 3 crumbs: "Policies" link, policy-title link, "Feedback" current.
5. `/policies/{uuid}/change-requests` → uses "Change Requests" (with space) from route map.
6. `/workshops` → single "Workshops" current-page crumb.
7. `/dashboard` → single "Dashboard" current-page crumb.
8. `/workshops/{uuid}` → `<nav aria-label="Breadcrumb">` present, workshop title has `aria-current="page"`.

All 8 passing.

### Workspace layout flex-column refactor (`app/(workspace)/layout.tsx`)

Before:
```tsx
<div className="min-h-screen">
  <header className="flex items-center justify-between border-b px-6 py-3">...</header>
  <main className="p-6">{children}</main>
</div>
```

After:
```tsx
<div className="flex h-screen flex-col">
  <header className="flex shrink-0 items-center justify-between border-b px-6 py-3">...</header>
  <Breadcrumb />
  <main className="flex-1 overflow-y-auto p-6">{children}</main>
</div>
```

Why flex-column is non-negotiable: Plan 03 introduces a policy tab bar layout (`app/(workspace)/policies/[id]/layout.tsx`) that needs to be a `flex-1 overflow-hidden` child with its own `min-h-0` content. Under the old `min-h-screen` + hardcoded `h-[calc(100vh-64px)]` chain, any nested full-height content would either scroll the outer viewport or clip. The new chain — `h-screen flex-col` → `shrink-0` header + `shrink-0` Breadcrumb + `flex-1 overflow-y-auto` main — lets Plan 03 swap `overflow-y-auto` for `overflow-hidden` in the nested policy layout without cascading height math.

## Decisions Made

1. **Null label = loading sentinel.** Chose `label: string | null` on the `Crumb` type rather than carrying a separate `isLoading` flag. Simpler rendering: `crumb.label === null ? <Skeleton/> : ...`. Downside: a route map miss also produces a capitalised fallback string (never null), so there is no ambiguity between "unknown" and "loading".
2. **Entity detection by segment position.** Only `segments[1]` under `/policies` or `/workshops` is treated as an entity UUID. This avoids firing a tRPC query for every UUID that happens to appear anywhere in the path (e.g. `/policies/{policyId}/feedback/{feedbackId}` — the feedback id falls through to the 8-char prefix fallback rather than triggering a stray document lookup).
3. **next/link mocked in tests.** Replaced with plain anchor so tests can assert `href` directly without a Next.js router context. Standard @testing-library pattern.
4. **No tab-segment mapping for nested section routes.** The spec's `READ first` lists route labels but doesn't require resolving `/policies/{uuid}/sections/{sectionId}` in Plan 02 — section title resolution is Plan 03 territory where `section.getById` is already fetched by the policy layout. Current behaviour: section UUID renders as 8-char prefix fallback. Plan 03 can extend the component or pass `sectionTitle` via context if needed.

## Deviations from Plan

**None — plan executed exactly as written.**

The only judgement call was accepting the 8-char UUID fallback for section/feedback/CR IDs (Plan 02 scope focuses on policy + workshop entity names per 13-UI-SPEC.md copywriting contract). This is consistent with D-03 "hybrid labels — use entity names where data is already loaded" — for deeper nesting we fall back gracefully rather than firing cross-cutting queries from the layout.

## Deferred Issues

Pre-existing TypeScript errors in `app/(workspace)/workshops/[id]/_components/section-link-picker.tsx` (lines 52) — already documented in `deferred-items.md` and out of scope per the Scope Boundary rule. These errors exist before this plan and are untouched by any Plan 13-02 change.

## Known Stubs

None. All files created by this plan wire real data sources:
- Breadcrumb reads live `usePathname()` and live tRPC queries (not mock data)
- Layout integration is a direct render, no placeholder text
- No `=[]`, `={}`, `"coming soon"`, or TODO sentinels introduced

## Verification

- `npx vitest run src/__tests__/breadcrumb.test.tsx` → **8/8 passing** (spec asked for ≥ 7)
- `npx tsc --noEmit` → **clean for all Plan 02 files**. Only remaining errors are the pre-existing `section-link-picker.tsx` issues documented in `deferred-items.md` (Phase 12 origin; confirmed identical via `git stash && npx tsc --noEmit`).
- Acceptance criteria (Task 2) all green:
  - `import { Breadcrumb } from './_components/breadcrumb'` present
  - `<Breadcrumb />` JSX tag present
  - `flex h-screen flex-col` on outer div
  - `shrink-0` on `<header>`
  - `flex-1 overflow-y-auto p-6` on `<main>`
  - `min-h-screen` removed

## Files Changed

**Created (2):**
- `app/(workspace)/_components/breadcrumb.tsx` — 138 lines, client component
- `src/__tests__/breadcrumb.test.tsx` — 166 lines, 8 tests

**Modified (1):**
- `app/(workspace)/layout.tsx` — outer div, header className, Breadcrumb insertion, main className (5 insertions / 3 deletions)

## Downstream Impact

- **Plan 03 (policy tab bar):** Can now use `flex-1 overflow-hidden` with a `flex-col` child chain (`tab-bar shrink-0` + `content flex-1 min-h-0 overflow-y-auto`) without hardcoded viewport-minus-offset math. The workspace layout guarantees a bounded-height main region.
- **Plan 03 (breadcrumb section titles):** The Breadcrumb currently falls back to 8-char prefixes for section UUIDs. Plan 03's policy layout already has section data loaded and can either (a) extend `Breadcrumb` with section-title resolution via tRPC section query, or (b) render a supplementary title breadcrumb inside the policy page. Recommend (a) — add `trpc.section.getById` lookup for `segments[3]` when `segments[0] === 'policies'` and `segments[2] === 'sections'`.
- **All workspace pages:** Gain a 36px breadcrumb row below the header. Pages that previously rendered their own "Back to X" ghost buttons (Plan 03 will remove them per D-04) now have canonical navigation via the breadcrumb row.

## Self-Check: PASSED

**Files verified on disk:**
- FOUND: app/(workspace)/_components/breadcrumb.tsx
- FOUND: src/__tests__/breadcrumb.test.tsx
- FOUND (modified): app/(workspace)/layout.tsx

**Commits verified in git log:**
- FOUND: b648826 feat(13-02): add Breadcrumb client component with full-depth navigation
- FOUND: 7af6465 feat(13-02): integrate Breadcrumb and refactor workspace layout to flex-column

**Tests verified green:** 8/8 passing.

**Acceptance criteria verified:** all grep substring checks for Task 2 pass; all TDD behaviours for Task 1 have a corresponding test (test count 8 ≥ required 7).
