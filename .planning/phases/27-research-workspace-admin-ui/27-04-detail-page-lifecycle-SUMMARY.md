---
phase: 27-research-workspace-admin-ui
plan: 04
subsystem: ui
tags: [next-app-router, trpc, shadcn, alert-dialog, lifecycle, rbac, decision-log, research-module]

# Dependency graph
requires:
  - phase: 26-research-module-data-server
    provides: research.submitForReview/approve/reject/retract mutations, research.getById query, transitionResearch service (R6 invariant), workflow_transitions table
  - phase: 27-01-router-upload-wave0
    provides: research.listTransitions tRPC query (decision-log data source), shouldHideAuthors / formatAuthorsForDisplay helpers
  - phase: 27-02-list-page-nav
    provides: ResearchStatusBadge component, /research-manage list page (back-target for detail row Link)
  - phase: 27-03-create-edit-pages
    provides: research.create / research.update extended with artifact metadata, /research-manage/[id]/edit route (Edit button target)
provides:
  - "/research-manage/[id] detail page (admin/policy_lead/research_lead, role-scoped via tRPC)"
  - ResearchDecisionLog component (workflow_transitions list with metadata→rationale mapping)
  - ResearchLifecycleActions component (permission-derived sidebar with submit/approve/reject/retract; inline reject expand + Alert-Dialog retract)
affects:
  - 27-05 (link pickers will replace the 'Linked Entities' placeholder block on this page)
  - 27-06 (dashboard widgets navigate to this page from row Link / 'Research Awaiting Review' StatCard)
  - 28-public-research-items-listing (public surface mirrors author display via shouldHideAuthors / formatAuthorsForDisplay)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Permission-derived visibility matrix on a sidebar action card: can(role, permission) AND status check AND ownership check (research_lead-style row scope) — server-side requirePermission + transitionResearch is the authorization truth, client just hides what won't work"
    - "Dual-invalidate on every lifecycle mutation: utils.research.getById.invalidate({id}) + utils.research.listTransitions.invalidate({id}) so the metadata header AND the decision log re-fetch in the same render pass after a transition"
    - "Inline expand pattern for destructive actions with rationale (Reject): button → state-flip to Textarea + 'Submit Rejection' (disabled until trim().length >= 1) + Cancel ghost — no modal, no separate dialog"
    - "Alert-Dialog pattern for destructive actions (Retract) with required textarea inside dialog body (not just title+description); 'Confirm Retract' AlertDialogAction disabled until trim().length >= 1; reason cleared on cancel/close via onOpenChange callback"
    - "Decision-log component does its own fetch (researchItemId prop only) using listTransitions, mapping workflow_transitions.metadata JSONB (rejectionReason | retractionReason) → rationale field per D-13 — single source of truth for transition rendering"
    - "Detail page uses formatAuthorsForDisplay (D-05 single source of truth) so author rendering matches AnonymousPreviewCard form preview EXACTLY — Pitfall 4 closed across both surfaces"

key-files:
  created:
    - "app/research-manage/[id]/_components/research-decision-log.tsx — 127 lines, wraps trpc.research.listTransitions, maps metadata JSONB → rationale per D-13"
    - "app/research-manage/[id]/_components/lifecycle-actions.tsx — 288 lines, ResearchLifecycleActions sidebar card with full RBAC matrix + inline reject + Alert-Dialog retract"
    - "app/research-manage/[id]/page.tsx — 213 lines, two-column detail page wiring metadata header + decision log + lifecycle actions + 'Linked Entities' placeholder for Plan 05"
  modified: []

key-decisions:
  - "Authors display uses formatAuthorsForDisplay then strips 'Authors: ' prefix and rewrites 'Source: Confidential' → 'Confidential' for the metadata grid label cell — keeps the helper as single source of truth while letting the grid carry its own dt/dd label semantics. AnonymousPreviewCard (Plan 03 form preview) renders the unmodified helper output for live-preview parity; detail page strips to fit the dt/dd grid pattern."
  - "ArtifactDownloadLink intentionally a 'Attachment on file' placeholder showing first-8-chars of artifactId. The evidence module does not currently expose a getArtifact tRPC query (Phase 26 schema choice — research.getById returns just the research_items row). Phase 28 public listing will add presigned-GET plumbing; until then a follow-up plan can either denormalize artifactFileName/Size onto research_items or extend research.getById to JOIN evidence_artifacts. Documented inline in the file's JSDoc."
  - "'Linked Entities' placeholder block (`<Separator />` + heading + 'Link pickers ship in Plan 05.' caption) shipped as the seam Plan 05 will replace — keeps the detail page complete now (no broken layout) while leaving the exact insertion point unambiguous."
  - "AlertDialog confirmed to support `open` / `onOpenChange` props directly via @base-ui/react (verified in delete-section-dialog.tsx + delete-policy-dialog.tsx + delete-workshop-dialog.tsx — all three use the exact same pattern). The shadcn AlertDialog wrapper just forwards to AlertDialogPrimitive.Root which is base-ui's controlled-by-default Root. No prop adaptation needed."
  - "AlertDialogAction click handler does NOT need preventDefault before calling the mutation. delete-section-dialog uses preventDefault to stop dialog auto-close on click; here we WANT the dialog to close after a successful retract (handled by onSuccess setRetractDialogOpen(false)). On error the toast appears and the dialog stays open via early-return mutation behavior, since onSuccess is the only place that closes it."
  - "Reject button is destructive variant (matches UI-SPEC color contract — destructive reserved for Reject + Retract + Alert-Dialog confirm only). Approve button uses default (accent) variant — matches UI-SPEC accent reserved for Approve + Submit for Review + Save Draft + Create Research Item CTA."
  - "research_lead with admin/policy_lead bypass: showSubmit/showEdit conditions check `(isOwner || isAdminRole)` so admin viewing a research_lead's draft sees Submit + Edit (admin can act on any item, not just own). research_lead viewing another user's draft sees nothing. This matches the server-side assertOwnershipOrBypass pattern from Plan 26-05 — defense in depth between client visibility and server authorization."

requirements-completed:
  - RESEARCH-07

# Metrics
duration: ~10 min (resumed from API-error crash; Task 1 already committed inline as d779ab8 by orchestrator)
completed: 2026-04-19
---

# Phase 27 Plan 04: Detail Page + Lifecycle Actions Summary

**Two-column /research-manage/[id] detail page mounting metadata header + decision log + permission-derived lifecycle action sidebar (Submit / Edit / Approve / Reject inline / Retract via Alert-Dialog). Every successful mutation invalidates BOTH research.getById AND research.listTransitions so the metadata header + decision log re-fetch in the same render pass — D-14 RBAC visibility matrix encoded once on the client (UX) and enforced server-side by Phase 26's requirePermission + transitionResearch (R6 invariant authority).**

## Performance

- **Duration:** ~10 min (resumed execution after 3 prior agents hit API connectivity errors mid-plan)
- **Completed:** 2026-04-19T22:44:24Z
- **Tasks:** 3 (all auto)
- **Files modified:** 3 created, 0 modified

## Resume Context

Three prior gsd-executor agents hit API connectivity errors (HTTP 500 / dropped streams) mid-plan execution. This is the 4th attempt and ran cleanly on master:

- **Task 1 (ResearchDecisionLog)** — Written by 3rd agent, committed inline by orchestrator before that agent crashed pre-commit. Commit `d779ab8`. Verified file matched plan acceptance criteria before proceeding to Task 2.
- **Task 2 (ResearchLifecycleActions)** — Executed atomically in this run. Commit `e223309`.
- **Task 3 (detail page)** — Executed atomically in this run. Commit `b7d8d04`.

This SUMMARY documents the complete plan including Task 1's prior inline commit so the dependency graph + key-files + decisions are all captured in one record.

## Accomplishments

- `/research-manage/[id]` detail page renders metadata header (title, ResearchStatusBadge, RI-NNN chip, formatted item type), 5-field metadata grid (authors via shouldHideAuthors, published date, journal/source, DOI link, peer reviewed), full description prose with `whitespace-pre-wrap`, conditional ExternalUrl button OR ArtifactDownloadLink placeholder, ResearchDecisionLog below the artifact row, and a 'Linked Entities' placeholder block reserved for Plan 05.
- Right sidebar mounts ResearchLifecycleActions card derived from `currentUserRole`, `status`, `createdBy === currentUserId`, with the full visibility matrix: Submit (research:submit_review on draft), Edit (research:manage_own on draft|pending_review), Approve (research:publish on pending_review), Reject (research:publish on pending_review — inline expand), Retract (research:retract on published — Alert-Dialog confirmation).
- ResearchDecisionLog wraps `trpc.research.listTransitions` (Plan 27-01) and maps the metadata JSONB column (`rejectionReason` | `retractionReason`) to a `rationale` field, mirroring the markup of `app/policies/[id]/feedback/_components/decision-log.tsx` per D-13 (zero new visual design).
- Every lifecycle mutation success invalidates BOTH `utils.research.getById.invalidate({id})` AND `utils.research.listTransitions.invalidate({id})` so the metadata header (status badge) AND the decision log (new transition row) both re-render after a transition without the user having to refresh.
- All UI-SPEC copy strings used verbatim — toast messages ('Submitted for review.', 'Research item approved and published.', 'Research item rejected.', 'Research item retracted.'), Alert-Dialog title ('Retract this research item?'), Alert-Dialog body ('This will remove it from all public surfaces. Provide a reason — this is recorded in the audit log.'), button labels (Submit Rejection, Confirm Retract, Cancel), Label text (Rejection reason (required), Retraction reason (required)).
- TypeScript clean (`npx tsc --noEmit` exits 0) after each task; full Phase 27 research test suite still GREEN at the same baseline as Plan 27-01 (5 GREEN + 44 todo — todos belong to Plans 27-04..06 wave-0 contracts not yet flipped, intentional and documented in Plan 27-01 SUMMARY).

## Task Commits

1. **Task 1 — ResearchDecisionLog component** — `d779ab8` (feat) — committed inline by orchestrator after 3rd agent crashed at API connectivity error pre-commit
2. **Task 2 — ResearchLifecycleActions component** — `e223309` (feat)
3. **Task 3 — /research-manage/[id] detail page** — `b7d8d04` (feat)

**Plan metadata commit:** pending (this SUMMARY + STATE.md + ROADMAP.md update)

## Files Created/Modified

**Created (3 source files):**

- `app/research-manage/[id]/_components/research-decision-log.tsx` — 127 lines. `'use client'`. Wraps `trpc.research.listTransitions.useQuery({ id: researchItemId })`. Maps `workflow_transitions.metadata` JSONB to a `rationale` field (`md?.rejectionReason ?? md?.retractionReason ?? null`). Renders Skeleton during load; 'No decisions recorded yet.' on empty; otherwise an asc-by-timestamp list of `{ fromState badge → ArrowRight → toState badge }` rows with actor name + relative time + optional rationale paragraph. Uses lucide ArrowRight icon, shadcn Badge (secondary variant), Separator between rows.
- `app/research-manage/[id]/_components/lifecycle-actions.tsx` — 288 lines. `'use client'`. Permission-derived visibility matrix using `can(currentUserRole, 'research:*')`. Five mutations wired: `submitForReview`, `approve`, `reject`, `retract`, plus an Edit `<Button render={<Link href={`/research-manage/${itemId}/edit`} />} />`. Reject uses inline `useState` expand pattern: button → state-flip to Label + Textarea + 'Submit Rejection' (destructive, disabled until `trim().length >= 1`) + Cancel (ghost). Retract uses `<AlertDialog open onOpenChange>` from `@base-ui/react` with required Textarea inside dialog body, 'Confirm Retract' AlertDialogAction (destructive class, disabled until `trim().length >= 1`); reason auto-clears on dialog close. Each mutation's `onSuccess` calls a shared `invalidateAll()` that hits both `getById` and `listTransitions`. Empty state ('No actions available in this state.') shown when the visibility matrix produces zero buttons.
- `app/research-manage/[id]/page.tsx` — 213 lines. `'use client'`. Two-column layout (`flex flex-col gap-6 lg:flex-row` — main column flex-1, right sidebar `w-full lg:w-80 lg:shrink-0`). Mounts `meQuery = trpc.user.getMe.useQuery()` + `itemQuery = trpc.research.getById.useQuery({ id })`. Skeleton loading state for both queries. Main column: title + ResearchStatusBadge header, RI-NNN font-mono Badge + formatted item type caption, 2-col metadata `<dl>` grid (Authors via formatAuthorsForDisplay with prefix-strip, Published date, Journal, DOI as external link, Peer Reviewed yes/no), description with `whitespace-pre-wrap`, conditional ExternalUrl button (lucide ExternalLink icon) OR ArtifactDownloadLink placeholder (lucide Download icon, 'Attachment on file' + 8-char artifactId caption), Separator, ResearchDecisionLog, Separator, 'Linked Entities' placeholder (Plan 05 seam). Right sidebar: rounded-lg border bg-card with ResearchLifecycleActions inside. Cast `me.role` to `Role | null` for the lifecycle props.

## Decisions Made

- **AlertDialog open/onOpenChange API verified before use.** Plan 27-04 instructions called for checking the AlertDialog API in `components/ui/alert-dialog.tsx` and grepping existing usage. Confirmed the wrapper forwards to `AlertDialogPrimitive.Root` from `@base-ui/react/alert-dialog` which IS controlled (open + onOpenChange props work directly). Also confirmed via existing usage in delete-section-dialog.tsx, delete-policy-dialog.tsx, delete-workshop-dialog.tsx, public-draft-toggle.tsx, reprovision-cal-button.tsx — all five call sites use the same `<AlertDialog open={x} onOpenChange={setX}>` pattern. No prop adaptation needed.
- **AlertDialogAction click handler omits preventDefault.** delete-section-dialog uses `e.preventDefault()` to stop dialog auto-close on click; here we WANT the dialog to close after a successful retract (handled by onSuccess `setRetractDialogOpen(false)`). On error the toast appears and the dialog stays open because the onSuccess close branch never runs. Cleaner UX than always-close-on-click + reopen-on-error.
- **Author display strips 'Authors: ' prefix and rewrites 'Source: Confidential' → 'Confidential'.** formatAuthorsForDisplay returns the full UI-SPEC copywriting strings ('Authors: X, Y' / 'Source: Confidential' / 'Unknown author') for the AnonymousPreviewCard's standalone-card surface. The detail page metadata grid uses a `<dt>` ('Authors') + `<dd>` cell pattern, so the helper output is rewritten in-place: `.replace(/^Authors: /, '').replace('Source: Confidential', 'Confidential')`. Single source of truth for the anonymous-author RULE preserved (helper is the only place it's encoded); just the rendering envelope differs between the two surfaces. Documented inline.
- **ArtifactDownloadLink as documented placeholder.** Phase 26's `research.getById` returns just the `research_items` row (no JOIN with `evidence_artifacts`), so we have an `artifactId` but no fileName/size/url for download. Render a muted `<div>` with lucide Download icon + 'Attachment on file' + first-8-chars artifactId monospace caption. Phase 28 public listing or a follow-up plan can add `trpc.evidence.getArtifact` (or denormalize artifact metadata onto research_items) at which point this component swaps to filename + size + presigned-GET download. JSDoc on the function documents the shortcut.
- **'Linked Entities' placeholder as a discoverable Plan 05 seam.** Renders a `<Separator />` + heading 'Linked Entities' + caption 'Link pickers ship in Plan 05.' below the decision log. Plan 05 will replace this block with three picker triggers + linked lists for sections / versions / feedback. Shipping the placeholder now keeps the detail page complete (no broken layout, no missing visual element) while leaving the exact insertion point unambiguous via the 'Plan 05' grep marker.
- **Visibility matrix ownership check uses (isOwner || isAdminRole) for showSubmit + showEdit.** Plan 26-05's `assertOwnershipOrBypass` pattern: research_lead is gated to own items; admin/policy_lead bypass ownership entirely. Mirrored on the client so admin viewing a research_lead's draft sees Submit + Edit buttons (admin CAN act on any item, not just own); research_lead viewing another user's draft sees no buttons (matches server 403). Defense in depth — server is the authorization truth, client visibility just hides what won't work.
- **Reject is destructive variant per UI-SPEC color contract.** UI-SPEC reserves destructive for Reject + Retract + Alert-Dialog confirm buttons only. Approve uses default (accent) variant. Submit for Review and Edit use default and outline respectively (Submit is a positive workflow action; Edit is neutral navigation).

## Deviations from Plan

None — plan executed exactly as written.

All three tasks landed verbatim from the plan's `<action>` blocks. AlertDialog API matched the plan's anticipation (controlled by default, no adaptation needed). The plan-suggested `formatAuthorsForDisplay` author display rewrite for the dt/dd grid was applied exactly as the plan's example showed. Acceptance criteria all pass (verified with grep -nc for each pattern; the two `?`-containing patterns false-failed under bash quote-escape but the raw substring is present and grep -nc returns 1 as expected for those).

**Total deviations:** 0.
**Impact on plan:** None.

## AlertDialog API Used

`@base-ui/react/alert-dialog` `AlertDialogPrimitive.Root` is **controlled by default** — `open` + `onOpenChange` props work directly on the `<AlertDialog>` wrapper from `@/components/ui/alert-dialog`. Verified in 5 existing call sites:

- `app/policies/[id]/_components/delete-section-dialog.tsx:45`
- `app/policies/_components/delete-policy-dialog.tsx`
- `app/workshop-manage/_components/delete-workshop-dialog.tsx`
- `app/policies/[id]/_components/public-draft-toggle.tsx`
- `app/workshop-manage/[id]/_components/reprovision-cal-button.tsx`

All use the exact pattern: `<AlertDialog open={state} onOpenChange={setState}>`. No prop adaptation needed.

## Artifact Download Shortcut

Detail page renders an `ArtifactDownloadLink` that shows 'Attachment on file' + first-8-chars artifactId in monospace caption. **Why a placeholder:**

- `trpc.research.getById` returns just the `research_items` row (no JOIN with `evidence_artifacts`).
- Phase 26 schema choice — separate JOIN expansion deferred per evidence module API surface.
- Plan 27-03 SUMMARY documented the same edit-mode prefill shortcut on the form (artifact filename/size unavailable in edit mode for the same reason).

**Resolution path:** Phase 28 public listing will add presigned-GET plumbing for the public `/research/items` surface. Alternatively, a follow-up plan can extend `research.getById` to JOIN `evidence_artifacts` and surface fileName / fileSize / publicUrl, at which point this `ArtifactDownloadLink` component swaps the placeholder for a real download button. JSDoc on the function documents the shortcut so the next plan author finds it.

## Linked Entities Placeholder

Detail page renders this block at the bottom of the main column:

```tsx
{/* Linked entities placeholder — Plan 05 replaces this block */}
<Separator />
<div className="space-y-2">
  <h2 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
    Linked Entities
  </h2>
  <p className="text-sm text-muted-foreground">
    Link pickers ship in Plan 05.
  </p>
</div>
```

Plan 27-05 will replace this with three picker triggers (`SectionLinkPicker`, `VersionLinkPicker`, `FeedbackLinkPicker`) + linked lists for sections / versions / feedback. The placeholder ships now so the detail page is complete (no broken layout) and the exact insertion point is unambiguous via the 'Plan 05' grep marker (3 hits in page.tsx).

## Issues Encountered

- **Three prior agents hit API connectivity errors mid-plan.** This is the 4th execution attempt for Plan 27-04. Prior crashes were infrastructure (HTTP 500 / dropped streams), not deviations or code issues. Task 1 was written by the 3rd agent and committed inline by the orchestrator before that agent crashed pre-commit (commit `d779ab8`). This run resumed from Task 2 cleanly. Per resume guidance, each task in this run was committed immediately after creation and verification — no batched-commit risk if another API error had hit.
- **Pre-existing test failures unchanged.** Plan 27-01 SUMMARY documented 69 pre-existing failures across 17 files (Phases 19, 20, 20.5, EV-07, etc.) tracked in `deferred-items.md`. No new failures introduced by this plan; the research test suite delta is +0 GREEN +0 RED (5 GREEN + 44 todo, identical to Plan 27-01 baseline because Plan 27-04's lifecycle-actions.test.tsx 16 todos remain todos for now — flipping them to real assertions is a follow-up task that requires a render-test environment with @testing-library/react which is in scope for a Wave 0 GREEN-conversion plan, not this Wave 2 implementation plan).
- **Acceptance grep false-failure on `?` and apostrophe-containing patterns.** Two acceptance criteria patterns (`'Retract this research item?'` and `'Confirm Retract'`) returned grep count 0 under the bash quote-escape wrapper, but the raw substrings ARE present in the file (verified with simpler `grep -nc "Retract this research item?"` returning 1). Cosmetic shell-escape issue, not a real acceptance failure. All UI-SPEC copy strings verified verbatim in the source.

## Known Stubs

The 'Linked Entities' placeholder is a **documented Plan 05 seam**, NOT a stub — Plan 05 is the next plan in the phase wave and will replace the block with picker triggers + linked lists. The placeholder is intentional, complete-on-its-own (the detail page renders without visual breakage), and unambiguous about its replacement (3× 'Plan 05' grep markers in the page).

The `ArtifactDownloadLink` is a **documented Phase 28 / follow-up shortcut** — the JSDoc on the function explains why the presigned-GET plumbing isn't here yet (Phase 26 schema choice — research.getById doesn't JOIN evidence_artifacts) and what the follow-up looks like (extend getById to JOIN, OR Phase 28 public listing adds presigned-GET, OR denormalize artifact metadata onto research_items). The placeholder renders the artifactId so the user knows an attachment exists; the download link itself is the deferred work.

Both elements are **wired** (no hardcoded empty arrays, no mock data, no placeholder text without a clear plan-replacement path). Neither blocks the plan's stated goal (RESEARCH-07 success criteria 3: admin/policy_lead approve/reject/retract with mandatory rationale; every transition audited via workflow_transitions — all FOUR mutations are wired through real tRPC procedures with real workflow_transitions writes via Phase 26's transitionResearch service).

## User Setup Required

None. No external service configuration, no env vars, no migrations. All changes are pure code on top of Phase 26 + Plan 27-01 + Plan 27-02 + Plan 27-03 foundations.

## Next Phase Readiness

**Plan 05 (link-pickers) can now proceed:**
- 'Linked Entities' placeholder block in `app/research-manage/[id]/page.tsx` is the exact replacement target — grep for the 3× 'Plan 05' markers to find the insertion point.
- Plan 05 will mount three new picker components: `SectionLinkPicker`, `VersionLinkPicker`, `FeedbackLinkPicker` (per UI-SPEC §"Component Inventory"). Each is a controlled Dialog (`open` + `onOpenChange` parent-owned) with multi-checkbox + 'Link {N} selected' confirm.
- `relevanceNote` inline edit (D-07) on Linked Sections rows uses Plan 27-01's conditional `linkSection` upsert (`onConflictDoUpdate` when `relevanceNote !== undefined`).

**Plan 06 (dashboard widgets) can now proceed:**
- `ResearchStatusBadge` (Plan 27-02) ships the 4-status color contract — dashboard widgets should import, not re-implement.
- `/research-manage?status=pending_review` is the navigation target for the 'Research Awaiting Review' admin/policy_lead StatCard — Plan 27-02's filter-panel URL-bootstrap (D-09) supports this query-param prefilling.
- `/research-manage?author=me&status=draft` and `?author=me&status=pending_review` are the targets for the research_lead 'My Drafts' / 'Pending Review' widgets — same URL-bootstrap pattern.

**Future Wave 0 GREEN conversion:**
- `tests/research/lifecycle-actions.test.tsx` 16 todos still unfllipped — flipping them to real assertions requires `@testing-library/react` in the test env (or a comparable component-render harness). Recommend a dedicated Wave 0-flip plan after Plan 27-06 ships, when ALL of Phase 27's components exist on disk and a single test environment setup amortizes across all of them.

**Hand-off contracts honored:**
- All 4 lifecycle mutations (`submitForReview`, `approve`, `reject`, `retract`) call through Phase 26's `transitionResearch` service which encodes the R6 invariant (`workflow_transitions` INSERT before `research_items` UPDATE) — verified via Plan 26-04 GREEN tests, no client-side bypass possible.
- D-13 single source of truth for transition rendering: `ResearchDecisionLog` is the only place the metadata→rationale mapping is implemented. Future surfaces (audit log viewer, Phase 28 public detail) should import this component, not re-implement.
- D-14 RBAC visibility matrix encoded once on the client (UX) and enforced server-side by Phase 26's requirePermission. Server is the authorization truth; this component is UX guidance.
- D-05 single source of truth for author display: `formatAuthorsForDisplay` (Plan 27-01) used on detail page metadata grid AND AnonymousPreviewCard (Plan 27-03 form). Phase 28 public listing should import the same helper.

## Self-Check: PASSED

Verified all key-files exist on disk:

- `app/research-manage/[id]/_components/research-decision-log.tsx`: FOUND (127 lines)
- `app/research-manage/[id]/_components/lifecycle-actions.tsx`: FOUND (288 lines)
- `app/research-manage/[id]/page.tsx`: FOUND (213 lines)

Verified all 3 task commits exist in git log:

- `d779ab8`: FOUND (feat 27-04: ResearchDecisionLog component) — Task 1, committed inline by orchestrator after 3rd agent crashed pre-commit
- `e223309`: FOUND (feat 27-04: ResearchLifecycleActions component) — Task 2, this run
- `b7d8d04`: FOUND (feat 27-04: /research-manage/[id] detail page) — Task 3, this run

TypeScript verification: `npx tsc --noEmit` exited 0 after each task.
Research test suite: `npx vitest run tests/research/` reports 5 passed | 44 todo (identical to Plan 27-01 baseline; no regressions).

---
*Phase: 27-research-workspace-admin-ui*
*Plan: 04-detail-page-lifecycle*
*Completed: 2026-04-19*
