---
phase: 27-research-workspace-admin-ui
plan: 02
subsystem: ui
tags: [next-app-router, trpc, tanstack-query, shadcn, role-gates, list-page]

requires:
  - phase: 26-research-router
    provides: research.list query, research.list authorId filter (added in 27-01), research_items schema
  - phase: 27-01-router-upload-wave0
    provides: authorId filter on research.list, shouldHideAuthors / formatAuthorsForDisplay helpers
provides:
  - "/research-manage" list page (admin/policy_lead/research_lead)
  - ResearchStatusBadge component with 4-status color tokens
  - ResearchFilterPanel controlled component (Document / Type / Status / Author)
  - Sidebar nav entry for the workspace chrome
  - CSS variables --research-status-{draft,pending,published,retracted}-{bg,fg}
affects:
  - 27-03 (create page navigates back to list, uses same status badge)
  - 27-04 (detail page Link target from row, uses same status badge)
  - 27-05 (link pickers consume same list rendering primitives)
  - 27-06 (dashboard widgets navigate to list page with pre-applied query params)
  - 28-public-research-items-listing (public surface mirrors role-gating model)

tech-stack:
  added: []
  patterns:
    - "Client list page: meQuery → URL bootstrap → controlled filter state → trpc list query with keepPreviousData"
    - "Status badge component wrapping shadcn Badge with semantic CSS-variable color tokens"
    - "Role-gated nav items in adaptive-header-client.tsx useMemo"

key-files:
  created:
    - app/research-manage/page.tsx
    - app/research-manage/_components/research-status-badge.tsx
    - app/research-manage/_components/research-filter-panel.tsx
  modified:
    - app/_components/adaptive-header-client.tsx
    - app/globals.css

key-decisions:
  - "Controlled filter panel — parent owns state, panel is presentational. Lets list page do URL-bootstrap (D-09) without panel re-mount."
  - "Multi-select filters send only first value to server, then client-filter the rest. Matches Phase 4 pattern; avoids server-side OR-chain refactor."
  - "Author dropdown is admin-only (others get research_lead self-only via URL ?author=me)."
  - "Sidebar nav inserted after Workshop Manage, before Users — matches workspace mental model (Workshop / Research / Users / Audit)."

patterns-established:
  - "Pattern: client-component list page with controlled filter panel + tanstack-query + URL-bootstrap"
  - "Pattern: status badge as a thin shadcn Badge wrapper with semantic CSS-variable color tokens"
  - "Pattern: role-gated workspace nav entry inside the adaptive-header-client useMemo block"

requirements-completed:
  - RESEARCH-06
  - RESEARCH-07
  - RESEARCH-08

duration: 25min
completed: 2026-04-20
---

# Phase 27 Plan 02: List Page + Sidebar Nav

**`/research-manage` list page with role-scoped data, filter panel, sortable columns, and workspace sidebar nav for the three research-touching roles.**

## Performance

- **Duration:** ~25 min (Task 1 in agent run #1, Tasks 2–3 in inline run after API 500)
- **Tasks:** 3
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- `/research-manage` list page renders 6-column sortable table with role-scoped data, role-gated CTA, and copywriting-contract empty/loading states.
- `ResearchStatusBadge` component locks the 4-status color contract once for list, detail, and dashboard surfaces.
- `ResearchFilterPanel` is a controlled component — parent (list page) owns filter state so URL-bootstrap works (D-09).
- Sidebar nav surfaces Research for `admin`, `policy_lead`, and `research_lead` only — `stakeholder` and `observer` see no workspace entry (Phase 28 public surface gates them).

## Task Commits

1. **Task 1 — ResearchStatusBadge + CSS tokens** — `047afdf` (feat)
2. **Task 2 — list page + filter panel** — `bd8d5e4` (feat) *(committed inline after agent #2 crashed at API 500 between Write and Bash; on-disk artifacts type-checked clean before commit)*
3. **Task 3 — sidebar nav entry** — `2c3d3f8` (feat)

## Files Created/Modified
- `app/research-manage/page.tsx` — client list page (453 lines)
- `app/research-manage/_components/research-status-badge.tsx` — 4-status shadcn-Badge wrapper
- `app/research-manage/_components/research-filter-panel.tsx` — controlled filter panel (240px desktop rail / stacked mobile)
- `app/_components/adaptive-header-client.tsx` — `/research-manage` nav inserted between Workshop Manage and Users
- `app/globals.css` — `--research-status-*` color variable pairs (bg/fg × 4 statuses)

## Decisions Made
- **Filter panel is fully controlled.** State owned by list page so URL-bootstrap (`?status=`, `?author=me`, `?document=`, `?type=`) works without panel re-mount.
- **Author dropdown short-cut.** Non-admin sees only `[meQuery.data]` self-entry; URL `?author=me` still works. Avoids exposing a `trpc.user.list` for non-admins. Documented inline.
- **Multi-select filters: first value on server, rest client-side.** Matches the Phase 4 list pattern; no server OR-chain refactor needed for this milestone.
- **Mobile filter strategy.** Stacked-above-table; deferred Collapsible until UI-review surfaces friction (UI-SPEC explicitly allowed this shortcut).

## Deviations from Plan
None — plan executed as written. Two-agent crash at API 500 was infrastructure, not deviation; on-disk Task-2 artifacts matched plan acceptance criteria exactly before being committed inline.

## Issues Encountered
- Two consecutive `gsd-executor` agents crashed with API 500 mid-plan. First agent committed Task 1 cleanly. Second agent wrote Task 2 files (page.tsx 453 lines, filter-panel.tsx 233 lines) but crashed before commit. Files type-checked clean, matched all 12 acceptance-criteria patterns, and were committed inline. Task 3 done inline.

## Next Phase Readiness
- List page row `<Link>` targets `/research-manage/[id]` — Plan 27-04 must create that detail route.
- `/research-manage/new` CTA — Plan 27-03 must create that route.
- `ResearchStatusBadge` and CSS tokens are reusable — Plans 27-04 and 27-06 should import, not re-implement.
- Sidebar nav `/research-manage` entry is live for the three privileged roles; downstream plans don't need to re-touch chrome.

---
*Phase: 27-research-workspace-admin-ui*
*Plan: 02-list-page-nav*
*Completed: 2026-04-20*
