---
phase: 23-cardano-preview-net-anchoring
plan: 03
subsystem: ui
tags: [cardano, verified-badge, cardanoscan, public-portal, milestone-detail, retry-anchor]

# Dependency graph
requires:
  - phase: 23-cardano-preview-net-anchoring
    provides: txHash + anchoredAt columns on milestones and documentVersions, retryAnchor tRPC mutation
  - phase: 22-milestone-entity-hashing
    provides: MilestoneDetailHeader component, milestone status enum, milestone detail page
provides:
  - VerifiedBadge component with ShieldCheck icon, indigo treatment, Cardanoscan preview-net link
  - RetryAnchorButton component with loading state and tRPC mutation
  - Public portal shows Verified badges on anchored versions (2 locations) and anchored milestones (1 section)
  - Admin milestone detail shows Cardanoscan link + txHash when anchored, RetryAnchorButton when stuck
affects: [23-04-verification-e2e]

# Tech tracking
tech-stack:
  added: []
  patterns: [verified-badge-null-guard, responsive-txhash-truncation, cardanoscan-preview-link]

key-files:
  created:
    - app/(public)/portal/[policyId]/_components/verified-badge.tsx
    - app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/retry-anchor-button.tsx
  modified:
    - app/(public)/portal/[policyId]/_components/public-version-selector.tsx
    - app/(public)/portal/[policyId]/page.tsx
    - app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/milestone-detail-header.tsx
    - app/(workspace)/policies/[id]/milestones/[milestoneId]/page.tsx
    - src/server/routers/milestone.ts

key-decisions:
  - "VerifiedBadge rendered as <a> tag (not Button) for direct Cardanoscan navigation per D-10"
  - "RetryAnchorButton uses variant=outline (never destructive) since retry is safe/idempotent per D-15"
  - "Milestone verification section omitted entirely when no anchored milestones (no empty state UI)"
  - "[Rule 3] Added retryAnchor tRPC mutation to milestone router since Plan 02 not yet executed but UI component needs it"

patterns-established:
  - "VerifiedBadge null guard: returns null when txHash is null/undefined (D-11 no badge for unanchored)"
  - "Responsive txHash: md:hidden for truncated, hidden md:inline for full value"
  - "Cardanoscan link pattern: preview.cardanoscan.io/transaction/{txHash} with target=_blank rel=noopener noreferrer"

requirements-completed: [VERIFY-09]

# Metrics
duration: 6min
completed: 2026-04-16
---

# Phase 23 Plan 03: Anchor UI Status Summary

**VerifiedBadge + RetryAnchorButton components with public portal badge integration (3 locations) and admin milestone Cardanoscan link + retry control**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-16T12:56:32Z
- **Completed:** 2026-04-16T13:03:23Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created VerifiedBadge component with ShieldCheck icon, indigo treatment, Cardanoscan preview-net link, and null guard for unanchored entities
- Created RetryAnchorButton component with outline variant, 44px touch target, loading state spinner, and trpc.milestone.retryAnchor mutation
- Integrated Verified badges in 3 public portal locations: SelectItem inline, version header row, milestone verification section
- Extended MilestoneDetailHeader with Cardanoscan link, responsive txHash display, anchored date, and RetryAnchorButton for stuck anchoring state

## Task Commits

Each task was committed atomically:

1. **Task 1: Create VerifiedBadge + RetryAnchorButton components** - `584c9c4` (feat)
2. **Task 2: Integrate badges into public portal + admin milestone detail** - `afa9a16` (feat)

## Files Created/Modified
- `app/(public)/portal/[policyId]/_components/verified-badge.tsx` - Reusable VerifiedBadge: ShieldCheck icon, indigo bg, Cardanoscan <a> tag, null guard
- `app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/retry-anchor-button.tsx` - RetryAnchorButton: outline variant, 44px touch target, loading spinner, tRPC mutation
- `app/(public)/portal/[policyId]/_components/public-version-selector.tsx` - Extended with txHash prop + inline VerifiedBadge per SelectItem
- `app/(public)/portal/[policyId]/page.tsx` - Added txHash to versionOptions, VerifiedBadge in header row, anchored milestones query + Verification section
- `app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/milestone-detail-header.tsx` - Added txHash/anchoredAt props, Cardanoscan link, responsive txHash, RetryAnchorButton
- `app/(workspace)/policies/[id]/milestones/[milestoneId]/page.tsx` - Passes txHash + anchoredAt to MilestoneDetailHeader
- `src/server/routers/milestone.ts` - Added retryAnchor tRPC mutation (Rule 3 deviation)

## Decisions Made
- VerifiedBadge rendered as `<a>` tag (not Button) for direct Cardanoscan navigation -- links open in new tab with noopener noreferrer
- RetryAnchorButton uses `variant="outline"` (never destructive) -- retry is safe and idempotent per D-08 concurrency lock
- Milestone verification section omitted entirely when no anchored milestones exist (no empty state copy per UI-SPEC)
- Added retryAnchor tRPC mutation to milestone router as Rule 3 deviation since Plan 02 had not yet been executed but the UI component requires it

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added retryAnchor tRPC mutation to milestone router**
- **Found during:** Task 1 (RetryAnchorButton creation)
- **Issue:** Plan 02 (which would have added retryAnchor mutation) was not yet executed, but RetryAnchorButton requires trpc.milestone.retryAnchor to exist
- **Fix:** Added retryAnchor mutation to src/server/routers/milestone.ts -- validates status === 'anchoring', re-emits milestone.ready event via sendMilestoneReady, writes audit log
- **Files modified:** src/server/routers/milestone.ts
- **Verification:** TypeScript compilation succeeds for all modified files (pre-existing MeshSDK type errors from Plan 01 are unrelated)
- **Committed in:** 584c9c4 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for RetryAnchorButton to reference a real tRPC mutation. No scope creep -- mutation matches Plan 02 specification exactly.

## Issues Encountered
None.

## Known Stubs
None -- all components are fully wired to real DB queries and tRPC mutations. VerifiedBadge correctly renders null when txHash is absent (design intent, not a stub).

## Next Phase Readiness
- All 3 public portal badge locations are live, ready for visual verification
- Admin milestone detail header shows full anchoring lifecycle UI (defining -> ready -> anchoring -> anchored)
- retryAnchor mutation is wired and ready for Inngest function testing in Plan 04

## Self-Check: PASSED

All 7 created/modified files verified present. Both task commits (584c9c4, afa9a16) confirmed in git history.

---
*Phase: 23-cardano-preview-net-anchoring*
*Completed: 2026-04-16*
