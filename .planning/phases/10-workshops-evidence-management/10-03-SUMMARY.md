---
phase: 10-workshops-evidence-management
plan: 03
subsystem: ui
tags: [evidence, feedback, filters, date-fns, trpc, role-gating]

requires:
  - phase: 10-01
    provides: "claimsWithoutEvidence tRPC endpoint, listByFeedback with uploaderName join"
provides:
  - "/feedback/evidence-gaps full page with document/section/type filters"
  - "Evidence list with uploader name and relative timestamp (EV-04 UI)"
  - "Research lead dashboard links to /feedback/evidence-gaps"
affects: [11-collaboration]

tech-stack:
  added: []
  patterns:
    - "Client-side multi-filter over full tRPC query result (Phase 4 pattern)"
    - "base-ui Select onValueChange accepts string | null"

key-files:
  created:
    - app/(workspace)/feedback/evidence-gaps/page.tsx
  modified:
    - app/(workspace)/policies/[id]/feedback/_components/evidence-list.tsx
    - app/(workspace)/dashboard/_components/research-lead-dashboard.tsx

key-decisions:
  - "Client-side filtering for evidence-gaps (fetch all, filter locally) matching Phase 4 multi-filter pattern"
  - "Role check via trpc.user.getMe client-side query with router.replace redirect"
  - "Select filter uses __all__ sentinel value since base-ui Select does not support empty string"

patterns-established:
  - "Role-gated client page: useQuery getMe, check role, redirect if not allowed"

requirements-completed: [EV-03, EV-04]

duration: 3min
completed: 2026-03-26
---

# Phase 10 Plan 03: Evidence Gaps Page and EV-04 Evidence Metadata Summary

**Claims Without Evidence full page with filters/table for Research Lead, evidence list uploader metadata display, dashboard link update**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-26T07:48:12Z
- **Completed:** 2026-03-26T07:51:41Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- New /feedback/evidence-gaps page with role gate (research_lead + admin), document/section/type filters, results table with attach evidence action
- Enhanced evidence-list.tsx with uploaderName display, type badge (File/Link), and relative timestamp via formatDistanceToNow
- Updated research-lead-dashboard.tsx links from /feedback?evidence=none to /feedback/evidence-gaps

## Task Commits

Each task was committed atomically:

1. **Task 1: Claims Without Evidence page + evidence list EV-04 enhancement + dashboard link** - `c6f30eb` (feat)

## Files Created/Modified
- `app/(workspace)/feedback/evidence-gaps/page.tsx` - Claims Without Evidence full page with three Select filters and Table results
- `app/(workspace)/policies/[id]/feedback/_components/evidence-list.tsx` - Enhanced with uploaderName, type badge, relative timestamp
- `app/(workspace)/dashboard/_components/research-lead-dashboard.tsx` - Updated "Review Evidence" and "View all evidence gaps" links

## Decisions Made
- Client-side filtering over full tRPC query result (matches Phase 4 multi-filter pattern rather than multiple server calls)
- Role gate implemented as client-side check via trpc.user.getMe with router.replace redirect (simpler than Server Component wrapper for a client-interactive page)
- Used __all__ sentinel value for Select filters since base-ui Select typed to string does not elegantly handle empty/null default

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Select onValueChange type signature**
- **Found during:** Task 1 (Evidence gaps page)
- **Issue:** base-ui Select.Root onValueChange callback receives `string | null`, not `string`. TypeScript error on all three filter handlers.
- **Fix:** Updated handler signatures to accept `string | null` with null guard
- **Files modified:** app/(workspace)/feedback/evidence-gaps/page.tsx
- **Verification:** npx tsc --noEmit shows no errors in our files
- **Committed in:** c6f30eb (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type fix required for base-ui compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Evidence management UI complete (EV-03 and EV-04 requirements fulfilled)
- Phase 10 all plans complete, ready for Phase 11

---
*Phase: 10-workshops-evidence-management*
*Completed: 2026-03-26*
