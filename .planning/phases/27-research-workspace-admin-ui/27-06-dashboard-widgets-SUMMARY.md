---
phase: 27-research-workspace-admin-ui
plan: 06
subsystem: ui
tags: [next-server-components, drizzle, dashboard, stat-cards, widget-integration, research-module]

# Dependency graph
requires:
  - phase: 26-research-module-data-server
    provides: researchItems table + status enum (draft / pending_review / published / retracted), createdBy FK to users
  - phase: 27-02-list-page-nav
    provides: /research-manage list page with URL-bootstrap (D-09) — reads ?author=me, ?status= query params and pre-applies filters
provides:
  - research_lead dashboard surface with My Drafts + Pending Review StatCards (D-10)
  - admin dashboard Research Awaiting Review StatCard (D-11)
  - policy_lead dashboard Research Awaiting Review StatCard (D-11 mirror)
affects:
  - 28-public-research-items-listing (mirrors author-display rule via shouldHideAuthors helper — no widget overlap, distinct surface)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-component dashboard widget queries ride existing Promise.all destructure (no additional DB round-trips)"
    - "StatCard wrapped in Next.js Link for navigation (StatCard is presentational only — link handled by parent per UI-SPEC Pitfall 3)"
    - "Widget→list-page navigation via pre-applied URL query params (D-09): clicking widget lands user on filtered list, single source of truth for the queue"
    - "Per-role dashboard widget split: research_lead sees own scope (createdBy=userId AND status), admin/policy_lead see all-author moderation queue (status=pending_review only)"
    - "Grid widening pattern (lg:grid-cols-4 → lg:grid-cols-5) when adding a fifth StatCard to existing stat row — no responsive media-query refactor needed"

key-files:
  created: []
  modified:
    - "app/dashboard/_components/research-lead-dashboard.tsx — +46 lines: researchItems import + and import + FileText/Clock icons + 2 count queries in Promise.all + 2-card prepended StatCard row with Link wraps"
    - "app/dashboard/_components/admin-dashboard.tsx — +19 lines: researchItems import + Microscope icon + 1 count query in Promise.all + researchAwaiting variable + fifth StatCard wrapped in Link, grid widened to lg:grid-cols-5"
    - "app/dashboard/_components/policy-lead-dashboard.tsx — +18 lines: researchItems import + Microscope icon + 1 count query in Promise.all + fifth StatCard wrapped in Link, grid widened to lg:grid-cols-5"

key-decisions:
  - "Position research_lead StatCards ABOVE existing evidence stat row (prepend) per UI-SPEC §Dashboard widget additions D-10 — research is the first thing a research_lead sees on login. Drafts/Pending Review surface their workflow stake before evidence-gap maintenance work."
  - "Widen admin + policy_lead stat row from lg:grid-cols-4 to lg:grid-cols-5 (append fifth card) rather than create a new stat row — keeps the dashboard chrome compact. UI-SPEC permitted either approach (D-11: 'append to existing stat grid if it has spare columns OR own row'); spare-column path chosen for visual density."
  - "Icon choices: FileText (My Drafts) + Clock (Pending Review) for research_lead — semantic match for 'document being drafted' and 'awaiting moderator review'. Microscope (Research Awaiting Review) for admin/policy_lead — distinguishes the research review queue from the existing FileText (Active Policies) and MessageSquare (Open Feedback) cards in the same row."
  - "Use inline `value={researchAwaitingResult?.count ?? 0}` on policy_lead dashboard (no intermediate variable) but `value={researchAwaiting}` on admin dashboard (with intermediate variable matching the existing pattern of `totalUsers`, `activePolicies`, etc.). Plan explicitly allowed either; matched local file convention on each side."
  - "Wrap StatCard in Next.js Link directly (StatCard is presentational, NOT a link). UI-SPEC §Dashboard widget integration Pitfall 3 says StatCard does not accept an href prop — clicks are added by the parent via Link wrapping. Same Link-wrap pattern applied across all 5 new StatCards."
  - "URL query param contract per D-09: research_lead's `?author=me&status=draft` and `?author=me&status=pending_review` rely on Plan 27-02's URL-bootstrap. admin/policy_lead's `?status=pending_review` lands on the all-author filtered view (no author filter). The list page's filter panel (Plan 27-02) reads these params on mount and pre-applies them — verified the route exists in Plan 27-02 SUMMARY (page.tsx 453 lines, filter-panel 240 lines, both committed in 27-02)."
  - "All 3 new count queries ride the existing Promise.all blocks (no sequential round-trips). research_lead Promise.all extends from 3 → 5 entries; admin from 6 → 7; policy_lead from 7 → 8. Dashboard load remains a single batched DB request per role."

patterns-established:
  - "Pattern: dashboard widget = Link-wrapped StatCard with pre-applied URL query params landing on existing list page (not a separate widget detail surface)"
  - "Pattern: per-role widget scope (createdBy=userId AND status filter for owners; status-only filter for moderators) — same widget label can mean different scopes per role via the URL params"

requirements-completed:
  - RESEARCH-08

# Metrics
duration: 8 min
completed: 2026-04-19
---

# Phase 27 Plan 06: Dashboard Widgets Summary

**Three dashboards extended with research StatCards: research_lead gets My Drafts + Pending Review (own scope), admin and policy_lead get Research Awaiting Review (moderation queue, all authors). Each StatCard is wrapped in Next.js Link navigating to /research-manage with pre-applied filter query params per D-09 (URL-bootstrap on the list page reads ?author=me and ?status= and pre-applies them). All count queries ride the existing Promise.all in each server-component dashboard — zero additional DB round-trips. RESEARCH-08 SC-5 satisfied for all 3 privileged roles.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-19T23:01:20Z
- **Completed:** 2026-04-19T23:09:45Z
- **Tasks:** 3 (all auto)
- **Files modified:** 3 modified, 0 created

## Accomplishments

- **research_lead dashboard** prepends a 2-column StatCard row above the existing Feedback Without Evidence / Total Evidence Items row. New cards: "My Drafts" (FileText icon) → `/research-manage?author=me&status=draft`; "Pending Review" (Clock icon) → `/research-manage?author=me&status=pending_review`. Both queries filter `createdBy=userId AND status=...` so the research_lead sees ONLY their own items.
- **admin dashboard** appends a fifth StatCard to the existing 4-card stat row (grid widened from lg:grid-cols-4 → lg:grid-cols-5). New card: "Research Awaiting Review" (Microscope icon) → `/research-manage?status=pending_review`. Query filters `status=pending_review` only (all authors) so admins see the full moderation queue.
- **policy_lead dashboard** mirrors the admin StatCard exactly — same label, same Link target, same icon, same query, same grid widening. Plan-spec mirror per UI-SPEC §"Dashboard widget additions" D-11 ("admin + policy_lead same card").
- All 5 new StatCards wrapped in `<Link>` directly (StatCard is presentational only per UI-SPEC §Dashboard widget integration Pitfall 3). Link is already imported in all 3 dashboard files.
- All 3 new `db.select({ count: count() }).from(researchItems)...` queries ride the existing Promise.all blocks — no additional DB round-trips. Dashboard load latency unchanged.
- TypeScript clean (`npx tsc --noEmit` exits 0) after each task; full Phase 27 research test suite still GREEN at the same baseline as Plans 27-01..04 (5 GREEN + 44 todo — todos belong to Plans 27-04..05 wave-0 contracts not yet flipped, intentional and documented in Plan 27-01 SUMMARY).
- Per-task atomic commits per resilience guidance — Task 1, Task 2, Task 3 each committed in its own commit immediately after verification, no batched-commit risk if API connectivity dropped mid-plan.

## Task Commits

1. **Task 1 — research-lead-dashboard.tsx (My Drafts + Pending Review)** — `b50a3ac` (feat)
2. **Task 2 — admin-dashboard.tsx (Research Awaiting Review)** — `9c6dc93` (feat)
3. **Task 3 — policy-lead-dashboard.tsx (Research Awaiting Review mirror)** — `91e7c44` (feat)

**Plan metadata commit:** pending (this SUMMARY + STATE.md + ROADMAP.md update)

## Files Created/Modified

**Modified (3 source files):**

- `app/dashboard/_components/research-lead-dashboard.tsx` (+46 lines)
  - Added imports: `researchItems` from `@/src/db/schema/research`; `and` to drizzle-orm import; `FileText, Clock` to lucide-react import
  - Extended Promise.all destructure from 3 → 5 entries: `[feedbackWithoutEvidence, [totalEvidenceResult], [totalFeedbackResult], [myDraftsResult], [myPendingReviewResult]]`
  - Added 2 count queries: `db.select({ count: count() }).from(researchItems).where(and(eq(researchItems.createdBy, userId), eq(researchItems.status, 'draft')))` and the analogous `pending_review` variant
  - Prepended new 2-column StatCard row ABOVE existing Feedback/Evidence stat row: My Drafts + Pending Review, both wrapped in `<Link href="/research-manage?author=me&status=...">`
- `app/dashboard/_components/admin-dashboard.tsx` (+19 lines)
  - Added imports: `researchItems`, `Microscope`
  - Extended Promise.all destructure from 6 → 7 entries (added `[researchAwaitingResult]` at end)
  - Added 1 count query: `db.select({ count: count() }).from(researchItems).where(eq(researchItems.status, 'pending_review'))`
  - Added local variable `const researchAwaiting = researchAwaitingResult?.count ?? 0`
  - Widened stat row grid from `lg:grid-cols-4` → `lg:grid-cols-5`
  - Appended fifth StatCard wrapped in `<Link href="/research-manage?status=pending_review">`: "Research Awaiting Review" with Microscope icon
- `app/dashboard/_components/policy-lead-dashboard.tsx` (+18 lines)
  - Added imports: `researchItems`, `Microscope`
  - Extended Promise.all destructure from 7 → 8 entries (added `[researchAwaitingResult]` at end)
  - Added 1 count query: same as admin dashboard
  - Widened stat row grid from `lg:grid-cols-4` → `lg:grid-cols-5`
  - Appended fifth StatCard wrapped in `<Link href="/research-manage?status=pending_review">`: "Research Awaiting Review" with Microscope icon (used inline `value={researchAwaitingResult?.count ?? 0}` rather than intermediate variable — local-file convention)

## Icon Choices

| Card | Icon | Rationale |
| ---- | ---- | --------- |
| My Drafts | `FileText` (lucide-react) | Universal "document being drafted" semantic — matches the existing `FileText` icon used for `Active Policies` (admin) without conflict because the cards live on different dashboards |
| Pending Review | `Clock` (lucide-react) | "Waiting for review" semantic — clock conveys queued/pending state; distinct from `MessageSquare` (Open Feedback) and `GitPullRequest` (Active CRs) |
| Research Awaiting Review (admin + policy_lead) | `Microscope` (lucide-react) | Research-domain semantic — visually distinguishes the research review queue from `FileText` (Active Policies), `MessageSquare` (Open Feedback), `BookOpen` (Versions), `Users` (Total Users) in the same row. No collision with existing icons in either admin or policy_lead dashboards. |

## Final Grid Adjustments

| Dashboard | Before | After | Reason |
| --------- | ------ | ----- | ------ |
| research_lead | `grid grid-cols-2 gap-4` (one row, 2 cards) | UNCHANGED for evidence row + NEW prepended `grid grid-cols-2 gap-4` row (2 research cards) | UI-SPEC D-10 specifies a 2-column row; prepend keeps layout symmetric with the evidence row below |
| admin | `grid grid-cols-2 gap-4 lg:grid-cols-4` (2 rows mobile / 1 row desktop, 4 cards) | `grid grid-cols-2 gap-4 lg:grid-cols-5` (still 2 rows mobile / 1 row desktop, 5 cards) | Append-fifth-card path chosen per UI-SPEC D-11 ("append to existing stat grid if it has spare columns") |
| policy_lead | `grid grid-cols-2 gap-4 lg:grid-cols-4` (same as admin) | `grid grid-cols-2 gap-4 lg:grid-cols-5` (same as admin) | Mirror — matches admin layout exactly per D-11 |

Mobile layout (`<lg`): all dashboards remain at `grid-cols-2`, so:
- research_lead mobile: 2-card research row ABOVE 2-card evidence row → 4 stat cards in 2 rows of 2
- admin mobile: 5 cards arranged as 2-2-1 (4 in 2 rows + 5th card on its own row) — acceptable per UI-SPEC §"Dashboard widget additions" (no specific mobile constraint stated, mobile multi-row tolerable for stat rows)
- policy_lead mobile: same 2-2-1 as admin

## Link URL Patterns Used

(Per Plan output spec — useful for Plan 27-02 URL bootstrap verification)

| Source | Link Target | Filter Semantics |
| ------ | ----------- | ---------------- |
| research-lead-dashboard.tsx — My Drafts | `/research-manage?author=me&status=draft` | Plan 27-02's filter-panel reads `?author=me` → resolves to current user via meQuery; reads `?status=draft` → applies status filter |
| research-lead-dashboard.tsx — Pending Review | `/research-manage?author=me&status=pending_review` | Same as above with `status=pending_review` |
| admin-dashboard.tsx — Research Awaiting Review | `/research-manage?status=pending_review` | Plan 27-02's filter-panel reads `?status=pending_review` only; no author filter → admin sees all authors |
| policy-lead-dashboard.tsx — Research Awaiting Review | `/research-manage?status=pending_review` | Same as admin |

All 4 URL patterns use the URL-bootstrap contract documented in Plan 27-02 SUMMARY ("Filter panel is fully controlled. State owned by list page so URL-bootstrap (?status=, ?author=me, ?document=, ?type=) works without panel re-mount."). Plan 27-02 supports `?author=me` directly (the meQuery resolves "me" to current userId at the list page level).

## Decisions Made

- **Position research_lead StatCards ABOVE existing evidence stat row.** UI-SPEC D-10 explicitly says "prepend above existing stat row" — research is the first thing a research_lead sees on login. The plan's `<action>` block confirmed this prepend positioning. Done verbatim.
- **Widen admin + policy_lead grid lg:grid-cols-4 → lg:grid-cols-5.** UI-SPEC D-11 permitted either "append to existing stat grid if it has spare columns OR own row" — chose append for visual density (compact dashboard chrome). The plan's `<action>` block called this out explicitly.
- **Icon choices: FileText + Clock + Microscope.** Plan suggested "FileText + Clock + Microscope, or similar semantically distinct icons". Chose plan-suggested icons for predictable semantic match. No collision with existing icons in any dashboard (verified by reading each dashboard's import list before adding).
- **Use `eq(researchItems.status, 'draft')` and `eq(researchItems.status, 'pending_review')` (not constants).** Plan called out string-literal status filters. The `researchItemStatusEnum` is defined in `src/db/schema/research.ts` lines 25-27; Drizzle accepts string literals directly via the enum type definition. No constants module needed; matches the existing pattern in admin-dashboard for `inArray(feedbackItems.status, ['submitted', 'under_review'])`.
- **Local variable `researchAwaiting` on admin (matches `totalUsers`, `activePolicies`, etc. local convention) but inline `researchAwaitingResult?.count ?? 0` on policy_lead.** Plan explicitly allowed both patterns — matched the existing local file convention on each side. admin-dashboard uses an intermediate variable for every count; policy-lead-dashboard uses inline counts in the JSX. Conformed to file-local style.
- **No regression in evidence-row icons.** research-lead-dashboard.tsx already imports `AlertCircle, FileSearch, CheckCircle` — added `FileText, Clock` to the existing lucide import line, no separate import. admin-dashboard.tsx already imports `Users, FileText, BookOpen, MessageSquare` — added `Microscope` to the existing line. policy-lead-dashboard.tsx already imports `MessageSquare, GitPullRequest, FileText, BookOpen, BarChart2` — added `Microscope` to the existing line. Single-line imports preserved.
- **Wrap StatCard in `<Link>` directly (NOT inside Button render prop).** StatCard is presentational and accepts no `href` prop. UI-SPEC §"Dashboard widget integration Pitfall 3" calls this out. Used direct `<Link href="..."><StatCard ... /></Link>` wrapping — same as several existing rows in policy-lead-dashboard.tsx (e.g., the activeCRs map at line 260 wraps a div in a Link). Next.js 16 handles this client-side navigation natively.

## Deviations from Plan

None — plan executed exactly as written.

All three tasks landed verbatim from the plan's `<action>` blocks. Imports added exactly as specified, Promise.all extensions matched the destructure shapes in the plan, StatCard markup + Link wraps copied verbatim. Icon choices matched plan's suggested defaults (FileText + Clock + Microscope). Grid widening (lg:grid-cols-4 → lg:grid-cols-5) on admin + policy_lead matched plan's `<action>` exactly. UI-SPEC copy strings ("My Drafts", "Pending Review", "Research Awaiting Review") used verbatim per plan acceptance criteria.

**Total deviations:** 0 auto-fixed
**Impact on plan:** None. All acceptance criteria met without modification.

## Issues Encountered

- **Acceptance grep false-failure on apostrophe-quoted patterns under Windows bash.** Three acceptance criteria patterns (`'My Drafts'`, `'Pending Review'`, `eq(researchItems.status, 'draft')`, etc. as exact-quoted searches) returned 0 matches via the bash-quoted ripgrep wrapper, but the raw substrings ARE present in the files (line 97: `label="My Drafts"`, line 104: `label="Pending Review"`, line 63: `eq(researchItems.status, 'draft')`). Same shell-escape issue documented in Plan 27-04 SUMMARY. Verified actual file contents via `Read` tool (lines 91-107 in research-lead-dashboard.tsx, lines 119-132 in admin-dashboard.tsx, lines 182-196 in policy-lead-dashboard.tsx) — all UI-SPEC copy strings present verbatim.
- **Pre-existing test failures unchanged.** Plan 27-01 SUMMARY documented 69 pre-existing failures across 17 files (Phases 19, 20, 20.5, EV-07, etc.) tracked in `deferred-items.md`. No new failures introduced by this plan; the research test suite delta is +0 GREEN +0 RED (5 GREEN + 44 todo — identical to Plan 27-01..04 baseline). The 44 todos belong to Plans 27-04..05 wave-0 contracts (lifecycle-actions.test.tsx 16 + link-picker.test.tsx 15 + create-edit-dialog.test.tsx 10 + anonymous-toggle.test.tsx 4 = 45, but one was flipped GREEN in Plan 27-03). Plan 27-06 specifically adds NO Wave 0 RED contract (per Plan 27-01 SUMMARY: "Plan 27-06: dashboard widgets querying count() WHERE status='pending_review' (no Wave 0 contract file - direct DB query in server component)"), so no test todos were flipped here.
- **No dev-server smoke walk performed.** Per project memory `feedback_defer_smoke_walks` and project_constraint "Defer manual smoke walks (browser flows / dev server) — do NOT spin up the dev server". Visual verification is rolled into the v0.2 milestone-end batch smoke walk.

## Known Stubs

None. All shipped code is wired (no hardcoded empty arrays, no placeholder text in UI, no mock data). All 3 widgets render REAL counts from `researchItems` table queries; all Link targets navigate to a REAL existing route (`/research-manage` shipped by Plan 27-02 with URL-bootstrap support); all 5 StatCards have a defined query, defined icon, defined label, and defined navigation target. RESEARCH-08 SC-5 ("Dashboard widgets for research_lead + admin/policy_lead") fully satisfied with no follow-up work pending.

## User Setup Required

None. No external service configuration, no env vars, no migrations. All changes are pure code on top of Phase 26 (research_items schema) + Plan 27-02 (list page + URL-bootstrap) foundations.

## Next Phase Readiness

**Plan 27-05 (link-pickers) is the only remaining plan in Phase 27** — it is independent of dashboard widgets and was not affected by this plan. Plan 27-05 will replace the "Linked Entities" placeholder block in `app/research-manage/[id]/page.tsx` (Plan 27-04) with three picker components.

**Phase 28 (public research items listing) ready to start after Plan 27-05:**
- The `shouldHideAuthors` / `formatAuthorsForDisplay` helpers (Plan 27-01) are the single source of truth for author display — Phase 28 public listing imports the same helpers
- The `/research-manage` workspace listing (Plan 27-02) and `/research-manage/[id]` detail page (Plan 27-04) are the workspace mirrors that Phase 28's `/research/items` and `/research/items/[id]` public surfaces parallel
- Dashboard widgets (this plan) are workspace-only — Phase 28 public surface has no dashboard equivalent

**Hand-off contracts honored:**
- All 3 dashboard widgets follow the StatCard-in-Link pattern (UI-SPEC Pitfall 3 closed)
- All 4 widget→list URL patterns use Plan 27-02's URL-bootstrap contract (D-09)
- All 3 count queries ride existing Promise.all (no DB round-trip regression)
- All UI-SPEC copy strings verbatim (no copywriting drift)
- Per-role widget scope respected: research_lead = own items (createdBy=userId AND status), admin/policy_lead = all-author moderation queue (status=pending_review only)

**No blockers or concerns.** TypeScript clean (`npx tsc --noEmit` exits 0). Phase 27 research test suite GREEN at baseline (5 passed | 44 todo, no regressions). Phase 26 surface intact (research_items schema unchanged).

## Self-Check: PASSED

Verified all key-files exist on disk and contain the plan's acceptance markers:

- `app/dashboard/_components/research-lead-dashboard.tsx`: FOUND (203 lines after edits)
  - `researchItems` import line 9: FOUND
  - `and` in drizzle-orm import line 10: FOUND
  - `FileText, Clock` in lucide-react import line 11: FOUND
  - `[myDraftsResult]` + `[myPendingReviewResult]` destructure lines 34-35: FOUND
  - `eq(researchItems.createdBy, userId)` lines 62, 71: FOUND (2 occurrences)
  - `eq(researchItems.status, 'draft')` line 63: FOUND
  - `eq(researchItems.status, 'pending_review')` line 72: FOUND
  - `/research-manage?author=me&status=draft` line 93: FOUND
  - `/research-manage?author=me&status=pending_review` line 100: FOUND
  - `label="My Drafts"` line 97: FOUND
  - `label="Pending Review"` line 104: FOUND
- `app/dashboard/_components/admin-dashboard.tsx`: FOUND (210 lines after edits)
  - `researchItems` import line 9: FOUND
  - `Microscope` in lucide-react import line 12: FOUND
  - `[researchAwaitingResult]` destructure line 54: FOUND
  - `eq(researchItems.status, 'pending_review')` line 107: FOUND
  - `lg:grid-cols-5` line 119: FOUND
  - `/research-manage?status=pending_review` line 125: FOUND
  - `label="Research Awaiting Review"` line 129: FOUND
- `app/dashboard/_components/policy-lead-dashboard.tsx`: FOUND (~327 lines after edits)
  - `researchItems` import line 4: FOUND
  - `Microscope` in lucide-react import line 6: FOUND
  - `[researchAwaitingResult]` destructure line 41: FOUND
  - `eq(researchItems.status, 'pending_review')` line 92: FOUND
  - `lg:grid-cols-5` line 183: FOUND
  - `/research-manage?status=pending_review` line 189: FOUND
  - `label="Research Awaiting Review"` line 193: FOUND

Verified all 3 task commits exist in git log:

- `b50a3ac`: FOUND (feat 27-06: add My Drafts + Pending Review StatCards to research-lead-dashboard)
- `9c6dc93`: FOUND (feat 27-06: add Research Awaiting Review StatCard to admin-dashboard)
- `91e7c44`: FOUND (feat 27-06: mirror Research Awaiting Review StatCard onto policy-lead-dashboard)

TypeScript verification: `npx tsc --noEmit` exited 0 after each task.
Research test suite: `npx vitest run tests/research/` reports 5 passed | 44 todo (identical to Plans 27-01..04 baseline; no regressions).

---
*Phase: 27-research-workspace-admin-ui*
*Plan: 06-dashboard-widgets*
*Completed: 2026-04-19*
