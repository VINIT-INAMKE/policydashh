---
phase: 12-workshop-system-fix
plan: 02
subsystem: workshops
tags: [tRPC, feedback, picker, multi-select, search, filter, anonymity]

# Dependency graph
requires:
  - phase: 10-workshops-evidence-management
    provides: workshop router, linkFeedback mutation, workshop page
  - phase: 04-feedback-system
    provides: feedbackItems schema, feedback router, anonymity pattern
provides:
  - feedback.listAll tRPC query for cross-document feedback browsing
  - Full feedback picker with card UI, search, type filter, multi-select
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "workshop:manage permission for cross-document feedback access (avoids feedback:read_all restriction)"
    - "Lazy query with enabled:open for dialog-driven data fetching"

key-files:
  created: []
  modified:
    - src/server/routers/feedback.ts
    - app/(workspace)/workshops/[id]/_components/feedback-link-picker.tsx

key-decisions:
  - "listAll guarded by workshop:manage (not feedback:read_all) so workshop moderators can access feedback for linking"
  - "Client-side filtering for search and type filter (server returns all, client filters) following Phase 4 pattern"

patterns-established:
  - "workshop:manage as permission guard for workshop-adjacent data access"

requirements-completed: [FIX-02, FIX-03, FIX-04]

# Metrics
duration: 7min
completed: 2026-04-12
---

# Phase 12 Plan 02: Feedback Link Picker Summary

**feedback.listAll query with anonymity enforcement and full picker UI with card display, text search, type filter, and multi-select checkboxes**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-11T22:34:45Z
- **Completed:** 2026-04-11T22:41:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- New feedback.listAll tRPC query returning all feedback items across documents, guarded by workshop:manage permission with server-side anonymity enforcement
- Full feedback picker rewrite with card display (readableId, type badge, title, 80-char excerpt, author/Anonymous, date), text search across title+body, type filter dropdown, multi-select checkboxes
- Removed placeholder UI: no DialogTrigger, no internalOpen state, no unlinkMutation, no Badge list of linked items

## Task Commits

Each task was committed atomically:

1. **Task 1: Add feedback.listAll query to feedback router** - `ab95daf` (feat)
2. **Task 2: Rewrite feedback-link-picker.tsx with card UI, search, and type filter** - `bac87c4` (feat)

## Files Created/Modified
- `src/server/routers/feedback.ts` - Added listAll procedure with workshop:manage guard and anonymity enforcement
- `app/(workspace)/workshops/[id]/_components/feedback-link-picker.tsx` - Full rewrite: card UI, search, type filter, multi-select, pure dialog content

## Decisions Made
- listAll uses workshop:manage permission (not feedback:read_all) so workshop moderators can access all feedback for linking without requiring admin/policy_lead role
- Client-side filtering for search and type filter follows Phase 4 established pattern (server returns all, client filters locally)
- Select onValueChange handles null coercion (base-ui passes null on clear, state uses empty string)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed base-ui Select onValueChange null type mismatch**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** base-ui Select.onValueChange passes `string | null` but state setter expects `string`
- **Fix:** Wrapped with `(val) => setTypeFilter(val ?? '')` to coerce null to empty string
- **Files modified:** app/(workspace)/workshops/[id]/_components/feedback-link-picker.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** bac87c4 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type fix for base-ui compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Feedback picker is fully functional for workshop feedback linking
- Section link picker (12-01) handles the other picker path

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 12-workshop-system-fix*
*Completed: 2026-04-12*
