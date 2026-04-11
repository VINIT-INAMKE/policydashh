# Phase 12: Workshop System Fix - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix workshop artifacts, section linking, and feedback linking to work end-to-end. Four concrete bugs: section link picker can't fetch sections, feedback link picker has no selection UI, duplicate section/feedback rendering between detail page and picker components, and orphaned DialogTrigger when pickers are controlled externally.

Requirements: Fix section link picker (document.list returns no sections), build feedback link picker selection UI, remove duplicate section/feedback rendering between detail page and picker components, fix orphaned DialogTrigger when pickers controlled externally.

</domain>

<decisions>
## Implementation Decisions

### Section Link Picker Fix
- **D-01:** Expand the existing `document.list` tRPC query with an `includeSections` option so it returns nested sections when the picker needs them. No new endpoint.
- **D-02:** Each section in the picker shows: title, block count, and status (draft/published). Provides enough context for informed linking.

### Feedback Link Picker UI
- **D-03:** Display feedback items as small cards in the picker — each card shows author, excerpt (~80 chars), sentiment/type badge, and submission date. Multi-select checkboxes for linking.
- **D-04:** Picker includes text search across feedback content plus a filter by feedback type (comment, suggestion, concern, etc.).

### Duplicate Rendering Cleanup
- **D-05:** Detail page owns the display of linked sections and feedback. Pickers handle selection/linking only — no rendering of linked items inside picker components. Clean separation: picker = select, page = display.

### DialogTrigger Cleanup
- **D-06:** Remove Dialog/DialogTrigger wrappers from inside picker components. Pickers become pure dialog content. Parent page.tsx owns the Dialog component and trigger button, passing open/onOpenChange to the picker content.

### Claude's Discretion
- Exact card layout and spacing for feedback items in picker
- Search debounce timing and filter UI placement
- How to handle the `includeSections` parameter in the document router (Prisma include vs separate query)
- Error states for failed section/feedback fetches in pickers
- Loading skeleton design for picker dialogs

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Workshop components
- `app/(workspace)/workshops/[id]/page.tsx` — Workshop detail page, manages dialog state for all 3 pickers
- `app/(workspace)/workshops/[id]/_components/section-link-picker.tsx` — Section picker with broken document.list call
- `app/(workspace)/workshops/[id]/_components/feedback-link-picker.tsx` — Feedback picker, currently placeholder only
- `app/(workspace)/workshops/[id]/_components/artifact-attach-dialog.tsx` — Artifact dialog, same orphaned DialogTrigger pattern

### Backend
- `src/server/routers/document.ts` — Document router, document.list query that needs includeSections option
- `src/server/routers/workshop.ts` — Workshop router with link/unlink mutations

### Prior phase context
- `.planning/phases/10-workshops-evidence-management/10-CONTEXT.md` — Phase 10 decisions establishing workshop architecture

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `section-link-picker.tsx`: Has working link/unlink mutation logic — only the data fetching is broken
- `feedback-link-picker.tsx`: Has unlink mutation already implemented — needs fetch + select + link
- `artifact-attach-dialog.tsx`: Working reference for dialog content pattern (after DialogTrigger removal)

### Established Patterns
- tRPC router pattern with Prisma queries in `src/server/routers/`
- Dialog controlled externally via `open`/`onOpenChange` props from parent page
- Workshop detail page manages all picker dialog state (lines 34-36): attachDialogOpen, sectionPickerOpen, feedbackPickerOpen

### Integration Points
- `document.list` query modification affects any consumer of that endpoint — need `includeSections` to be opt-in
- Feedback picker needs a tRPC query for fetching feedback items (likely `feedback.list` or similar)
- Parent page.tsx dialog state management stays — pickers just lose their internal Dialog wrappers

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-workshop-system-fix*
*Context gathered: 2026-04-12*
