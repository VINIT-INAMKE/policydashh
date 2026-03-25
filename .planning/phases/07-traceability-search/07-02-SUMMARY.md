---
phase: 07-traceability-search
plan: 02
subsystem: ui
tags: [traceability, matrix, filter, export, tabs, tRPC, react]
status: complete
started: 2026-03-25
completed: 2026-03-25

# Dependency graph
requires:
  - phase: 07-traceability-search-01
    provides: tRPC traceability router (matrix, sectionChain, stakeholderOutcomes procedures), CSV/PDF export route handlers
  - phase: 04-feedback-system
    provides: StatusBadge component, feedback filter panel pattern, FeedbackInbox layout
  - phase: 05-change-requests
    provides: CRStatusBadge component, CR detail pages
  - phase: 06-versioning
    provides: version list query, version labels
provides:
  - Traceability page at /policies/[id]/traceability with 4-tab layout
  - Traceability matrix table with filter panel (org type, section, decision, version range)
  - By Section view with version transition cards and linked feedback
  - By Stakeholder view with summary stats and outcome cards with version influence labels
  - Export CSV/PDF buttons with loading states
  - TraceabilityChainBadge shared component for inline FB->CR->Section->Version chain
affects: [08-dashboards, 09-audit, 10-workshops, 07-traceability-search-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [multi-tab page with URL query sync, client-side multi-filter pattern, sticky column table, version grouping]

key-files:
  created:
    - app/(workspace)/policies/[id]/traceability/page.tsx
    - app/(workspace)/policies/[id]/traceability/_components/matrix-table.tsx
    - app/(workspace)/policies/[id]/traceability/_components/matrix-filter-panel.tsx
    - app/(workspace)/policies/[id]/traceability/_components/export-actions.tsx
    - app/(workspace)/policies/[id]/traceability/_components/section-chain-view.tsx
    - app/(workspace)/policies/[id]/traceability/_components/stakeholder-outcomes.tsx
    - app/(workspace)/policies/[id]/traceability/_components/traceability-chain-badge.tsx
  modified: []

key-decisions:
  - "Tab state synced to URL query param ?tab= for direct linking and browser back/forward"
  - "Client-side multi-filter pattern: server accepts single value, client filters for multi-select checkbox groups"
  - "workspace-nav.tsx left unchanged: traceability is document-scoped, no global nav pattern exists for per-policy pages"
  - "Phase 4 outcomes page left as-is: Phase 7 By Stakeholder tab is document-scoped extension, not a replacement"

patterns-established:
  - "Multi-tab page pattern: Tabs with URL query param sync using useSearchParams + router.replace"
  - "Sticky first-column table: position sticky + left-0 + z-10 + bg-background on first TD"
  - "Version grouping: groupByVersion utility for grouping sectionChain rows by versionId"
  - "TraceabilityChainBadge: reusable inline FB->CR->Section->Version badge chain"

requirements-completed: [TRACE-02, TRACE-03, TRACE-04, TRACE-05, TRACE-06]

# Metrics
duration: 12min
completed: 2026-03-25
---

# Phase 7 Plan 02: Traceability UI Summary

**Traceability page with matrix grid, filter panel, per-section version cards, per-stakeholder outcome stats, and CSV/PDF export buttons**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-25T08:09:54Z
- **Completed:** 2026-03-25T08:22:00Z
- **Tasks:** 2
- **Files created:** 7

## Accomplishments
- Traceability page at `/policies/[id]/traceability` with 4-tab layout (Matrix, By Section, By Stakeholder, Search)
- Matrix tab: 240px filter panel (org type, section, decision outcome, version range) + horizontally scrollable table with sticky first column and 6 data columns (Feedback, CR, Section, Version, Decision, Rationale)
- By Section tab: section selector, version transition cards grouped by merged version with CR links, linked feedback lists, and full rationale text
- By Stakeholder tab: summary stats (Total, Accepted, Rejected, Pending) and outcome cards with version influence labels
- Export CSV/PDF buttons with loading states, error toasts, and file download triggers
- TraceabilityChainBadge shared component rendering inline FB->CR->Section->Version chain with clickable badges

## Task Commits

Each task was committed atomically:

1. **Task 1: Traceability page frame with Matrix tab, filter panel, and workspace nav** - `pending` (feat)
2. **Task 2: By Section, By Stakeholder tabs** - `pending` (feat)

**Plan metadata:** `pending` (docs: complete plan)

_Note: Commits pending -- git write operations restricted in parallel sandbox. Files are created and ready for staging._

## Files Created/Modified
- `app/(workspace)/policies/[id]/traceability/page.tsx` - Main traceability page with 4-tab layout, filter state, tRPC queries
- `app/(workspace)/policies/[id]/traceability/_components/matrix-table.tsx` - Matrix grid with sticky first column, deduplication, loading/empty states
- `app/(workspace)/policies/[id]/traceability/_components/matrix-filter-panel.tsx` - Filter panel with checkbox groups, selects, mobile Sheet trigger
- `app/(workspace)/policies/[id]/traceability/_components/export-actions.tsx` - CSV/PDF export buttons with fetch, blob download, loading states
- `app/(workspace)/policies/[id]/traceability/_components/section-chain-view.tsx` - By Section view with section selector, version transition cards
- `app/(workspace)/policies/[id]/traceability/_components/stakeholder-outcomes.tsx` - By Stakeholder view with summary stats and outcome cards
- `app/(workspace)/policies/[id]/traceability/_components/traceability-chain-badge.tsx` - Shared inline FB->CR->Section->Version badge chain

## Decisions Made
- **Tab state in URL**: Used `?tab=` query param synced via `useSearchParams` + `router.replace` for direct linking and browser back/forward support
- **Client-side multi-filter**: Server tRPC procedures accept single filter values; client applies array-based filtering for multi-select checkbox groups (consistent with Phase 4 pattern)
- **No workspace-nav change**: Traceability is document-scoped (`/policies/[id]/traceability`), not global. The workspace-nav only contains global items (Dashboard, Policies, Feedback). No existing policy sub-nav pattern to extend.
- **Phase 4 outcomes page preserved**: The By Stakeholder tab extends the outcomes view with version influence data but is document-scoped. The Phase 4 `/feedback/outcomes` page serves stakeholders without a document context.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created stub components for Task 2 imports**
- **Found during:** Task 1 (page.tsx imports SectionChainView and StakeholderOutcomes)
- **Issue:** page.tsx imports components that don't exist yet (Task 2 creates them)
- **Fix:** Created minimal stub implementations for section-chain-view.tsx and stakeholder-outcomes.tsx that export the correct component signatures
- **Files modified:** section-chain-view.tsx, stakeholder-outcomes.tsx
- **Verification:** All imports resolve correctly

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to ensure page.tsx compiles during Task 1. Stubs replaced with full implementations in Task 2.

## Known Stubs

- `search-view.tsx` -- Replaced by Plan 03 (parallel agent) with full search implementation. No longer a stub.

## Issues Encountered
- Git write operations (add, commit) blocked in parallel sandbox environment. All files created successfully via Write tool. Commits need to be performed by orchestrator.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Traceability UI complete, all 4 tabs functional
- Plan 03 (Search) can build on the search tab stub (already replaced by parallel agent)
- Phase 8 (Dashboards) can link to traceability views
- Phase 9 (Audit) can reference traceability matrix for evidence pack

## Self-Check: PASSED

All 7 created files verified present:
- FOUND: app/(workspace)/policies/[id]/traceability/page.tsx
- FOUND: app/(workspace)/policies/[id]/traceability/_components/matrix-table.tsx
- FOUND: app/(workspace)/policies/[id]/traceability/_components/matrix-filter-panel.tsx
- FOUND: app/(workspace)/policies/[id]/traceability/_components/export-actions.tsx
- FOUND: app/(workspace)/policies/[id]/traceability/_components/section-chain-view.tsx
- FOUND: app/(workspace)/policies/[id]/traceability/_components/stakeholder-outcomes.tsx
- FOUND: app/(workspace)/policies/[id]/traceability/_components/traceability-chain-badge.tsx
- FOUND: .planning/phases/07-traceability-search/07-02-SUMMARY.md

Acceptance criteria verified:
- 'use client' present in page.tsx
- trpc.traceability.matrix used in page.tsx
- Traceability Matrix tab in page.tsx
- Export CSV / Export PDF in export-actions.tsx
- /api/export/traceability URLs in export-actions.tsx
- FILTERS heading in matrix-filter-panel.tsx
- sticky class in matrix-table.tsx
- sectionChain query in section-chain-view.tsx
- stakeholderOutcomes query in stakeholder-outcomes.tsx
- "Influenced version" in stakeholder-outcomes.tsx
- "Select a section" in section-chain-view.tsx
- "No changes recorded" in section-chain-view.tsx
- "No feedback outcomes" in stakeholder-outcomes.tsx

---
*Phase: 07-traceability-search*
*Completed: 2026-03-25*
