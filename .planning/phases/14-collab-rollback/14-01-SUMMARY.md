---
phase: 14-collab-rollback
plan: 01
subsystem: editor
tags: [tiptap, yjs, hocuspocus, rollback, deletion, collab, comments, presence]

# Dependency graph
requires:
  - phase: 11-real-time-collaboration
    provides: "Yjs/Hocuspocus presence UI + inline comments to be rolled back"
provides:
  - "10 standalone Wave-1 collab files removed from disk"
  - "src/lib/collaboration/ directory removed entirely"
  - "Collab-specific test files removed BEFORE their source (Pitfall 3 mitigation)"
  - "Clean deletion beachhead for Plan 02 block-editor.tsx refactor"
affects: [14-02, 14-03, 14-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-pruning deletion strategy: leaves first, tests before source"

key-files:
  created: []
  modified:
    - "app/(workspace)/policies/[id]/_components/presence-bar.tsx (deleted)"
    - "app/(workspace)/policies/[id]/_components/connection-status.tsx (deleted)"
    - "app/(workspace)/policies/[id]/_components/comment-thread.tsx (deleted)"
    - "app/(workspace)/policies/[id]/_components/comment-bubble.tsx (deleted)"
    - "app/(workspace)/policies/[id]/_components/comment-panel.tsx (deleted)"
    - "src/lib/hooks/use-presence.ts (deleted)"
    - "src/lib/collaboration/presence-colors.ts (deleted)"
    - "src/lib/collaboration/ (directory removed)"
    - "src/__tests__/inline-comment-mark.test.ts (deleted)"
    - "src/__tests__/build-extensions-collab.test.ts (deleted)"
    - "src/__tests__/comments-router.test.ts (deleted)"

key-decisions:
  - "Delete collab-specific tests in Task 1 before any source deletion to prevent test import-of-deleted-code crashes (Pitfall 3)"
  - "Leave block-editor.tsx untouched — its 4 transient broken imports (PresenceBar, CommentBubble, CommentPanel, getPresenceColor) are intentional and are resolved in Plan 02 Task 1"
  - "Use npm test (not tsc --noEmit) as the Wave-1 acceptance gate — the render test mocks BlockEditor via next/dynamic so the transient TS errors never surface at runtime"

patterns-established:
  - "Wave 1 leaf-pruning: delete tests first, then source files that have no inbound dependencies from remaining (non-slated-for-edit) code"

requirements-completed: [COLLAB-ROLLBACK-01]

# Metrics
duration: 5min
completed: 2026-04-13
---

# Phase 14 Plan 01: Collab Rollback Wave-1 Leaf Pruning Summary

**Deleted 10 standalone Yjs/Hocuspocus presence + inline-comment files (5 UI components, 1 hook, 1 utility, 3 tests) plus the empty src/lib/collaboration/ directory — establishes clean deletion beachhead for Plan 02's block-editor.tsx refactor, with zero new test failures beyond the pre-existing baseline.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-13T14:34:14Z
- **Completed:** 2026-04-13T14:39:25Z
- **Tasks:** 2
- **Files modified:** 10 deletions + 1 directory removal

## Accomplishments

- 3 collab-specific test files removed BEFORE their underlying source (Pitfall 3 mitigation)
- 5 standalone collab UI components removed (presence-bar, connection-status, comment-thread, comment-bubble, comment-panel)
- `usePresence` hook and `getPresenceColor`/`getInitials` utility removed
- `src/lib/collaboration/` directory removed entirely (was holding only `presence-colors.ts`)
- Full test suite still green excluding pre-existing baseline failures (21/23 suites pass, 295/297 tests pass — identical delta to pre-Wave-1 baseline)
- Render-gate test (`src/__tests__/section-content-view.test.tsx`) still green: 7/7 tests pass
- Remaining collab imports are confined to `block-editor.tsx` only (PresenceBar, CommentBubble, PendingComment, CommentPanel, getPresenceColor) — exactly as plan predicted; will be resolved in Plan 02 Task 1

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete 3 collab-specific test files** — `1fe1b5e` (chore)
2. **Task 2: Delete 7 standalone source files + empty src/lib/collaboration/ directory** — `d177a56` (chore)

## Files Created/Modified

**Deleted (10 files + 1 directory):**

Task 1 (`1fe1b5e`):
- `src/__tests__/inline-comment-mark.test.ts` — tested InlineComment mark (slated for removal in Plan 02)
- `src/__tests__/build-extensions-collab.test.ts` — tested collaboration option path in buildExtensions (Plan 02)
- `src/__tests__/comments-router.test.ts` — tested commentRouter procedures (Plan 03)

Task 2 (`d177a56`):
- `app/(workspace)/policies/[id]/_components/presence-bar.tsx` — Hocuspocus presence avatar bar
- `app/(workspace)/policies/[id]/_components/connection-status.tsx` — websocket connection indicator
- `app/(workspace)/policies/[id]/_components/comment-thread.tsx` — inline-comment reply thread UI
- `app/(workspace)/policies/[id]/_components/comment-bubble.tsx` — floating "Add comment" bubble
- `app/(workspace)/policies/[id]/_components/comment-panel.tsx` — right-dock comment panel (`trpc.comments.*` caller)
- `src/lib/hooks/use-presence.ts` — `usePresence(provider)` subscription hook
- `src/lib/collaboration/presence-colors.ts` — `getPresenceColor`/`getInitials`/`PRESENCE_COLORS` palette
- `src/lib/collaboration/` — now-empty directory, removed via `rmdir`

## Decisions Made

- **Deletion ordering: tests before source.** Per RESEARCH § Pitfall 3, deleting tests first prevents Vitest from failing on import of source modules that Plan 02/03 will remove. Three tests targeted code outside this plan's file set, so deleting them now decouples the waves.
- **Do not touch block-editor.tsx.** The plan explicitly reserves block-editor.tsx edits for Plan 02 Task 1. The render-gate test (`section-content-view.test.tsx`) mocks `next/dynamic` to stub BlockEditor, so the transient compile errors in block-editor.tsx do NOT surface during `npm test`.
- **Use `npm test` (not `tsc --noEmit`) as Wave-1 acceptance gate.** This is the signal the plan specified and the only one that reflects actual executable behavior given the `next/dynamic` mock.

## Deviations from Plan

None — plan executed exactly as written. The only note is a documentation clarification below.

**Note on baseline failures:** The executor prompt and RESEARCH.md § Open Questions 2 describe "3 pre-existing baseline failures" covering `feedback-permissions.test.ts` (2 failures) and `document-router-scope.test.ts` (1 failure). Direct baseline measurement (via `git stash -u` + `npm test`) showed the actual baseline is **2 failures** covering `feedback-permissions.test.ts` (2 test failures) and `section-assignments.test.ts` (1 suite failure — missing `DATABASE_URL` env var at test time, not related to `document-router-scope`). This is a documentation drift in the plan context, not a regression. Post-Wave-1 results match pre-Wave-1 baseline exactly:

| Metric | Pre-Wave-1 (stash) | Post-Task-1 | Post-Task-2 |
|---|---|---|---|
| Test Files | 2 failed / 24 passed (26) | 2 failed / 21 passed (23) | 2 failed / 21 passed (23) |
| Tests | 2 failed / 326 passed (328) | 2 failed / 295 passed (297) | 2 failed / 295 passed (297) |
| Failing suites | feedback-permissions + section-assignments | same | same |

The 3 test-file / 31 test drop between pre-Wave-1 and Post-Task-1 corresponds exactly to the 3 collab test files deleted in Task 1. Post-Task-2 is identical to Post-Task-1 because Task 2 only deletes source files, not tests.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Ready for Plan 02 (`14-02-PLAN.md`):** Block-editor refactor.
- Plan 02 Task 1 must remove the 4 remaining broken imports from `block-editor.tsx` (`PresenceBar`, `CommentBubble`/`PendingComment`, `CommentPanel`, `getPresenceColor`) plus the `HocuspocusProvider` runtime import.
- Plan 02 Task 1 must also remove all `providerRef.current` access sites, `useSession`/`useUser` from Clerk (collab-only), and the `commentPanelOpen`/`pendingComment`/`activeCommentId` state.
- The render-gate test is the correct acceptance signal for Plan 02 Task 1 as well.

**Render-gate test status:** `npm test -- src/__tests__/section-content-view.test.tsx` → 7/7 green.

**Grep verification (`from.*presence-bar|from.*comment-panel|from.*comment-bubble|from.*comment-thread|from.*use-presence|from.*presence-colors`):** only 4 hits, all inside `app/(workspace)/policies/[id]/_components/block-editor.tsx` — exactly matches the plan's expected transient state.

## Self-Check: PASSED

Verified claimed deletions and commit hashes exist:

**File deletions (10/10 absent):**
- ABSENT (OK): `app/(workspace)/policies/[id]/_components/presence-bar.tsx`
- ABSENT (OK): `app/(workspace)/policies/[id]/_components/connection-status.tsx`
- ABSENT (OK): `app/(workspace)/policies/[id]/_components/comment-thread.tsx`
- ABSENT (OK): `app/(workspace)/policies/[id]/_components/comment-bubble.tsx`
- ABSENT (OK): `app/(workspace)/policies/[id]/_components/comment-panel.tsx`
- ABSENT (OK): `src/lib/hooks/use-presence.ts`
- ABSENT (OK): `src/lib/collaboration/presence-colors.ts`
- ABSENT (OK): `src/__tests__/inline-comment-mark.test.ts`
- ABSENT (OK): `src/__tests__/build-extensions-collab.test.ts`
- ABSENT (OK): `src/__tests__/comments-router.test.ts`

**Directory removal:**
- DIR ABSENT (OK): `src/lib/collaboration/`

**Commits (2/2 found in git log):**
- FOUND: `1fe1b5e` — Task 1 (delete 3 collab tests)
- FOUND: `d177a56` — Task 2 (delete 7 source files + empty dir)

---
*Phase: 14-collab-rollback*
*Plan: 01*
*Completed: 2026-04-13*

