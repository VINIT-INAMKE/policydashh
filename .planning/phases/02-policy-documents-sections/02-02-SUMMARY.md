---
phase: 02-policy-documents-sections
plan: 02
subsystem: ui
tags: [shadcn, tailwind, trpc, react, next.js, dnd-kit, lucide, sonner]

# Dependency graph
requires:
  - phase: 02-policy-documents-sections
    plan: 01
    provides: "Document tRPC router with list/create/update/delete procedures, permission matrix"
  - phase: 01-foundation-auth
    provides: "Clerk auth, tRPC client/server setup, workspace layout"
provides:
  - "shadcn/ui initialized with Zinc palette and 16 components"
  - "@dnd-kit packages installed for section reordering"
  - "/policies page with card grid, empty state, loading skeleton"
  - "Create/Edit/Delete policy dialogs wired to tRPC mutations"
  - "Workspace navigation with Dashboard and Policies links"
  - "PolicyCard component with dropdown actions and relative timestamps"
affects: [02-03, 03-block-editor, 07-search]

# Tech tracking
tech-stack:
  added: [shadcn/ui, "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities", lucide-react, sonner, tw-animate-css, class-variance-authority]
  patterns:
    - "shadcn base-nova style with @base-ui/react primitives (not Radix)"
    - "Client component pages for tRPC hook usage ('use client')"
    - "Controlled dialog state with open/onOpenChange props"
    - "Dropdown stopPropagation on card with nested click handlers"
    - "Workspace nav as separate client component from server layout"

key-files:
  created:
    - app/(workspace)/policies/page.tsx
    - app/(workspace)/policies/_components/policy-card.tsx
    - app/(workspace)/policies/_components/create-policy-dialog.tsx
    - app/(workspace)/policies/_components/edit-policy-dialog.tsx
    - app/(workspace)/policies/_components/delete-policy-dialog.tsx
    - app/(workspace)/policies/_components/policy-list-skeleton.tsx
    - app/(workspace)/_components/workspace-nav.tsx
  modified:
    - app/(workspace)/layout.tsx
    - app/globals.css
    - app/layout.tsx
    - package.json
    - components.json

key-decisions:
  - "Toaster imported from sonner directly (not shadcn wrapper) to avoid next-themes ThemeProvider requirement"
  - "WorkspaceNav extracted as client component for usePathname active state detection in server layout"
  - "PolicyCard accepts updatedAt as Date | string to handle tRPC serialization"

patterns-established:
  - "Dialog pattern: open/onOpenChange controlled state, form submission inside DialogContent, DialogClose for discard"
  - "Card with dropdown: stopPropagation on trigger, dialog state managed in card component"
  - "Empty state pattern: centered icon, heading, body copy, CTA button"
  - "Loading skeleton pattern: card-shaped skeletons matching real card dimensions"

requirements-completed: [DOC-01, DOC-06]

# Metrics
duration: 13min
completed: 2026-03-25
---

# Phase 02 Plan 02: Policy List UI Summary

**shadcn/ui initialized with 16 components, /policies page with responsive card grid, and Create/Edit/Delete policy dialogs wired to tRPC document router**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-24T21:16:25Z
- **Completed:** 2026-03-24T21:29:24Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments
- shadcn/ui initialized with Zinc-based CSS variable palette and all 16 components needed for Phase 2
- /policies page with responsive 1/2/3-column card grid, empty state, and loading skeleton
- Full CRUD dialog flows: Create Policy, Edit Policy, Delete Policy with confirmation
- Workspace header navigation with Dashboard and Policies links (active state detection)
- All copy text matches UI-SPEC.md Copywriting Contract exactly

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize shadcn/ui and install all dependencies** - `4070b16` (chore)
2. **Task 2: Policy list page with card grid and CRUD dialogs** - `6e97303` (feat)

## Files Created/Modified
- `components.json` - shadcn configuration (base-nova style, neutral base color)
- `app/globals.css` - Full shadcn CSS variable palette with light/dark mode
- `app/layout.tsx` - Added Toaster from sonner for toast notifications
- `package.json` - Added shadcn, @dnd-kit, lucide-react, sonner dependencies
- `components/ui/*.tsx` - 16 shadcn components (button, card, dialog, input, textarea, label, separator, dropdown-menu, badge, skeleton, sonner, scroll-area, tooltip, alert-dialog, table, tabs)
- `app/(workspace)/layout.tsx` - Added WorkspaceNav component for navigation
- `app/(workspace)/_components/workspace-nav.tsx` - Client nav with active state detection
- `app/(workspace)/policies/page.tsx` - Policy list page with card grid, empty state, loading
- `app/(workspace)/policies/_components/policy-card.tsx` - Card with dropdown, badge, timestamp
- `app/(workspace)/policies/_components/create-policy-dialog.tsx` - Create dialog with tRPC mutation
- `app/(workspace)/policies/_components/edit-policy-dialog.tsx` - Edit dialog pre-populated with values
- `app/(workspace)/policies/_components/delete-policy-dialog.tsx` - AlertDialog with destructive confirm
- `app/(workspace)/policies/_components/policy-list-skeleton.tsx` - 3 skeleton cards matching layout

## Decisions Made
- Toaster imported from `sonner` directly rather than the shadcn wrapper to avoid requiring `next-themes` ThemeProvider
- WorkspaceNav extracted as a separate client component so the workspace layout can remain a server component
- PolicyCard accepts `updatedAt` as `Date | string` since tRPC serializes Date objects to strings over the wire
- shadcn initialized with base-nova style (uses @base-ui/react instead of Radix) as that is the current default

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed updatedAt type mismatch between tRPC response and component props**
- **Found during:** Task 2 (Policy list page)
- **Issue:** tRPC serializes Date to string over HTTP, but PolicyCard expected Date type
- **Fix:** Changed PolicyCard prop type to accept `Date | string`
- **Files modified:** app/(workspace)/policies/_components/policy-card.tsx
- **Verification:** TypeScript compilation succeeds with no errors in plan files
- **Committed in:** 6e97303 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type adjustment for correctness. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in `src/server/routers/audit.ts` (optional input type narrowing) -- not caused by this plan's changes, out of scope
- shadcn init overwrote globals.css but kept Tailwind v4 imports; cleaned up duplicate old CSS rules

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Policy list page ready for integration with policy detail page (Plan 03)
- All shadcn components installed for section sidebar, drag-drop, and content views
- @dnd-kit packages ready for section reordering in Plan 03
- Workspace navigation established for future route additions

## Self-Check: PASSED

All 11 files verified present. Both commit hashes (4070b16, 6e97303) verified in git log.

---
*Phase: 02-policy-documents-sections*
*Completed: 2026-03-25*
