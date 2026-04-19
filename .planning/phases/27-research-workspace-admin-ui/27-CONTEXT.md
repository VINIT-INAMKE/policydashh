# Phase 27: Research Workspace Admin UI - Context

**Gathered:** 2026-04-19 (updated — assumption-grade decisions folded in)
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the workspace-side UI for the research module shipped by Phase 26: `research_lead` can author and submit research items for review; `admin` + `policy_lead` can approve/reject/retract; all authenticated users can browse linked entities from a research-item detail page. Dashboard widgets surface draft/review counts.

Public surfaces (`/research/items` listing + detail) are **Phase 28**. Schema, tRPC router, permissions, lifecycle, and manifest-entry extensions are **Phase 26** and not revisited here.

</domain>

<decisions>
## Implementation Decisions

### Create/Edit surface
- **D-01:** Dedicated **pages** at `/research-manage/new` and `/research-manage/[id]/edit`, not a two-step dialog. Mirrors `/workshop-manage/new` pattern exactly — refresh-safe, room for 11 metadata fields + upload progress, no state loss on accidental close. Supersedes the "two-step dialog" language in the earlier draft of this CONTEXT.
- **D-02:** File upload fires **on file-select, before save**. Flow: pick file → `POST /api/upload` presign → `PUT` to R2 → `evidence_artifacts` row inserted → UI shows green "Uploaded ✓ name.pdf · 2.3 MB". `Save` then writes the `research_items` row referencing `artifactId`. Matches existing `artifact-attach-dialog.tsx` pattern.
- **D-03:** `itemType` **auto-drives** the upload-mode branch:
  - `media_coverage` / `legal_reference` → External-URL input only, file input hidden.
  - All other types → file input only, URL input hidden.
  - No manual "File vs URL" toggle; the type enum IS the toggle.

### R2 upload category
- **D-04:** Add a **new `'research'` category** to `app/api/upload/route.ts`. Allowlist: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/csv`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Max size 32 MB. Dedicated category is required because research supports datasets (CSV/XLSX) that neither `document` nor `evidence` permit. Interview transcripts stored as `recording` category continue to flow through the existing workshop recording pipeline and can be elevated to research items via `artifactId` reference (per INTEGRATION.md §2) — no MIME duplication.

### Anonymous-author preview
- **D-05:** **Live preview in the edit form AND rendered on the detail page.** A small `<AnonymousPreviewCard>` below the `isAuthorAnonymous` toggle flips between `Authors: X, Y` and `Source: Confidential` as the switch moves. The detail page uses the identical helper (`shouldHideAuthors(item)`) to render public-facing author lines. Single source of truth prevents the Phase 27 risk listed earlier ("Anonymous-author toggle must match the public rendering rule exactly").

### Link-picker architecture
- **D-06:** **Three separate dialogs**, one per link type: `SectionLinkPicker`, `VersionLinkPicker` (new — mirrors section picker), `FeedbackLinkPicker`. Matches the workshop detail-page pattern in `app/workshop-manage/[id]/_components/`. Each dialog is controlled (`open` + `onOpenChange` props), uses `Checkbox` multi-select, and fires `Promise.allSettled` bulk-link with consolidated toast. Version picker reuses `trpc.document.list({ includeSections:true })` + per-document version query.
- **D-07:** `relevanceNote` per section-link is **not** captured in the picker. After a section is linked, the detail page section list renders each link as a row with a click-to-edit inline textarea. Keeps the picker focused on multi-select; supports late additions and edits without re-opening the dialog. Nothing blocks bulk linking with empty notes.

### List & queue layout
- **D-08:** `/research-manage` is a **Table with sortable columns + left-rail filter panel**. Columns: ReadableID (`RI-NNN`), Title, Type, Status (status chip), Author(s), Published/Updated Date. Filter panel: Document (Select), Type (multi-checkbox), Status (multi-checkbox), Author (Select → users list filtered to `research_lead + admin + policy_lead`). Default sort: `updatedAt DESC`. Matches the `/feedback` and `/audit` table patterns. No card grid.
- **D-09:** **No separate review queue route.** Admin review is the same `/research-manage` list with `?status=pending_review` pre-selected via the dashboard widget link. One surface, one code path, one set of tests.

### Dashboard widgets
- **D-10:** `research_lead` dashboard: **two StatCards only** — `My Drafts: N` (links to `/research-manage?author=me&status=draft`) and `Pending Review (mine): N` (links to `/research-manage?author=me&status=pending_review`). No inline item list. Same sizing/spacing as the existing `ResearchLeadDashboard` StatCard row.
- **D-11:** `admin` + `policy_lead` dashboard: **one StatCard** — `Research Awaiting Review: N` (links to `/research-manage?status=pending_review`). Scoped to `WHERE status='pending_review'` across all documents. Admin-only card (policy_lead sees the same count via shared permission).

### Navigation
- **D-12:** Add a **"Research" item to the workspace sidebar** (`app/_components/adaptive-header-client.tsx` or its current sidebar analogue), gated by role: visible to `admin`, `policy_lead`, `research_lead`. Not visible to stakeholders, observers, auditors, workshop_moderators in the workspace chrome (they still get public surfaces in Phase 28). Mirrors the existing `/workshop-manage` and `/feedback` sidebar entries. No per-policy PolicyTabBar entry — research is cross-policy.

### Decision log rendering
- **D-13:** Detail-page "Decision Log" **reuses the FeedbackDecisionLog component pattern** (`app/policies/[id]/feedback/_components/decision-log.tsx`). Inline list, status-chip per transition, actor name + timestamp, rationale shown when `metadata.rejectionReason` is present, retraction reason shown when `metadata.retractionReason` is present. Zero new visual design. Data source: `trpc.research.listTransitions` (add if missing — trivial extension to existing router; check before adding).

### Lifecycle action RBAC
- **D-14:** Lifecycle action buttons on the detail page are **permission-derived, not role-derived** in the UI. `trpc.user.getMe` returns the user; UI computes `can(role, 'research:submit_review')`, `can(role, 'research:publish')`, `can(role, 'research:retract')` via the same `src/lib/permissions.ts` helper the server uses. Server-side `requirePermission` in the router is still the authorization truth; client-side gating is purely UX (prevents clicks that would 403). Addresses the "RBAC drift between UI and router" risk.

### Claude's Discretion
- Exact form field ordering inside the create/edit page.
- Filter panel collapse behaviour on mobile.
- Loading skeleton shapes.
- Toast copy for each mutation.
- Table row hover / selected visual states.
- Keyboard navigation within link-picker dialogs.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Domain + integration (authoritative for this module)
- `.planning/research/research-module/DOMAIN.md` — entity model, taxonomy, state machine, versioning pattern, public surface taxonomy
- `.planning/research/research-module/INTEGRATION.md` — connection to evidence_artifacts, workshops, document_versions, milestones, CRs/feedback, Cardano, public shell, RBAC
- `.planning/research/research-module/QUESTIONS.md` — Q1–Q10 decision log (all resolved in Phase 26 CONTEXT)
- `.planning/research/research-module/PATTERNS.md` — implementation patterns

### Phase 26 artefacts (data + server this phase consumes)
- `.planning/phases/26-research-module-data-server/26-CONTEXT.md` — locked data/RBAC/state decisions
- `.planning/phases/26-research-module-data-server/26-SUMMARY.md` → (see individual plan summaries in that directory)
- `src/db/schema/research.ts` — `research_items` + 3 link tables + 2 enums
- `src/server/routers/research.ts` — 15-procedure tRPC router
- `src/server/services/research.service.ts` — `transitionResearch` (R6 invariant)
- `src/server/services/research.lifecycle.ts` — `VALID_TRANSITIONS` guard
- `src/lib/permissions.ts` — 7 `research:*` permissions + role grants (Q3 moderation gate)
- `src/lib/constants.ts` — `RESEARCH_*` ACTIONS

### Project-level requirements
- `.planning/REQUIREMENTS.md` — register `RESEARCH-06`, `RESEARCH-07`, `RESEARCH-08` in this phase's Wave 0
- `.planning/ROADMAP.md` Phase 27 entry — success criteria 1–7

### Reference implementations to follow
- `app/workshop-manage/page.tsx` + `app/workshop-manage/new/page.tsx` + `app/workshop-manage/[id]/page.tsx` — pattern for list + new + detail pages
- `app/workshop-manage/[id]/_components/section-link-picker.tsx` — controlled-dialog multi-select link picker
- `app/workshop-manage/[id]/_components/feedback-link-picker.tsx` — controlled-dialog with search + filter
- `app/workshop-manage/[id]/_components/artifact-attach-dialog.tsx` — R2 upload dialog + artifact row creation
- `app/policies/[id]/feedback/_components/decision-log.tsx` — decision log UI pattern (D-13)
- `app/policies/[id]/change-requests/_components/cr-decision-log.tsx` — second reference for decision log
- `app/dashboard/_components/research-lead-dashboard.tsx` — current RL dashboard (extend with new StatCards)
- `app/dashboard/_components/admin-dashboard.tsx` — current admin dashboard (add review-queue StatCard)
- `app/api/upload/route.ts` — R2 upload endpoint; add `'research'` category per D-04
- `src/lib/r2.ts` — `getUploadUrl` + `generateStorageKey` + `getPublicUrl`

### Project policy docs
- `.planning/PROJECT.md` — Key Decisions table, Active work, Constraints (privacy-first, traceability-non-negotiable)
- `.planning/STATE.md` — current position (Phase 27, no plans started)

### Previously relevant for pattern consistency
- `app/policies/[id]/change-requests/_components/cr-detail.tsx` — CR detail + lifecycle action layout analogue
- `app/_components/adaptive-header-client.tsx` — sidebar nav location for D-12

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **shadcn primitives shipped:** Dialog, Sheet, Tabs, Select, Switch, Command, RadioGroup, Popover, Textarea, ScrollArea, Table, Tooltip, Skeleton, Checkbox, Badge, Card, Input, Label, Alert-Dialog, Dropdown-Menu, Input-Group, Progress, Separator, Sonner (toaster). No new primitive needed for Phase 27.
- **`trpc.research.*` (15 procs)** — already shipped in Phase 26. List, listPublic, getById, create, update, submitForReview, approve, reject, retract, linkSection, unlinkSection, linkVersion, unlinkVersion, linkFeedback, unlinkFeedback.
- **`trpc.document.list({ includeSections:true })`** — used by workshop section-link-picker; directly reusable for research section picker.
- **`trpc.feedback.listAll`** — shipped in Phase 12; reuse in research feedback-link-picker.
- **`StatCard` component** (`app/dashboard/_components/stat-card.tsx`) — reusable for D-10 and D-11 widgets.
- **Role resolution pattern** (`trpc.user.getMe.useQuery()`) — used in workshop-manage and dashboard; reuse for D-14 client-side permission gating.
- **Existing Phase 4 `status-badge.tsx`** if present — else mint a `ResearchStatusBadge` matching the Phase 5 CR status-badge style.

### Established patterns
- **Page shell + `_components/` directory** per feature (workshop-manage, policies, feedback, dashboard). Follow exactly.
- **Controlled dialog props** `{ open, onOpenChange }` pattern (Phase 12 fix) — pure dialog content, parent owns trigger + state. Use for all three link-pickers per D-06.
- **`Promise.allSettled` bulk-link + consolidated toast** (Phase 21 pattern). Apply to link mutations.
- **Fire-and-forget `writeAuditLog`** pattern — already in router, nothing to do in UI.
- **`z.guid()` over `z.uuid()`** (Phase 16+ precedent) — use for any Zod validation of UUID fields inside client-side forms if needed.
- **Sequential DB queries in server components** (Phase 8 pattern) — dashboard widgets use server-component DB queries, not tRPC.
- **Client-side multi-filter** (Phase 4 pattern) — server list query accepts single filter values; client filters down for multi-select where needed. For `/research-manage` filter panel, prefer server-side multi-select support in `research.list` if already available; else client-filter.
- **Navigation role gating** via `trpc.user.getMe` + conditional render in layout client component (Phase 13-04 pattern). Apply to D-12.

### Integration points
- **`app/api/upload/route.ts`** — add `'research'` case to `ALLOWED_TYPES` + `MAX_FILE_SIZE` (D-04). No other changes.
- **`app/_components/adaptive-header-client.tsx`** (or current sidebar file) — add "Research" nav item (D-12), role-gated.
- **`app/dashboard/_components/research-lead-dashboard.tsx`** — add two StatCards above existing evidence section (D-10).
- **`app/dashboard/_components/admin-dashboard.tsx`** — add one StatCard (D-11).
- **`app/dashboard/_components/policy-lead-dashboard.tsx`** — add same StatCard as admin (D-11 mirror).
- **No schema, no router, no service changes.** Phase 26 is the boundary; this phase is pure UI.

### Risks
- **RBAC drift between UI and router** — addressed by D-14: UI computes via same `src/lib/permissions.ts` `can()` helper as server. Tests should cover all 7 roles.
- **Anonymous-author rule mismatch** — addressed by D-05: single `shouldHideAuthors(item)` helper shared between edit-form preview, detail page, and (later) Phase 28 public listing.
- **Link-picker perf on long lists** — section picker may load hundreds of sections. Workshop pattern flattens all sections from `trpc.document.list`; if perf degrades past ~200 sections, add document-scoped filtering in the picker before shipping. Not a v0.2 blocker.
- **File upload orphan rows** — if upload succeeds but the user abandons the form, an `evidence_artifacts` row exists with no `research_items` referrer. Accept as low-severity cleanup-later (same trade-off as workshop artifact attach). No cleanup job in Phase 27.
- **Parallel wave race during plan execution** — Phase 20/21/26 all hit `git commit --parallel` mis-labelling once. Call out in plan splits that UI surfaces (list, detail, new, dashboard widgets) are independent and can wave in parallel.

</code_context>

<specifics>
## Specific Ideas

- The decision log should feel like the feedback/CR ones — familiar chrome keeps the workspace coherent.
- The anonymous-author preview should be obviously visible while editing so the research_lead never ships the wrong attribution state.
- Reuse wherever possible — Phase 27 is a surface phase, not a pattern phase.
- No new shadcn primitives.

</specifics>

<deferred>
## Deferred Ideas

- **Rich-text abstract editor** — textarea + markdown rendering on detail page is sufficient for v0.2; Tiptap integration deferred.
- **Bulk CSV import of research items** — out of scope; manual create only.
- **Email notifications on status change** — deferred to v0.3; revisit if research queue gets noisy.
- **Per-research-item Cardano anchoring** — locked to milestone-only in Phase 26 Q4; revisit in v0.3 if use case emerges.
- **Authorship transfer mutation** — locked deferred in Phase 26 Q8; admin can always manage any item.
- **DOI external validation** — locked to plain-text in Phase 26 Q10; browser link-follow handles resolution.
- **Public `/research/items` listing + detail** — Phase 28, not this phase.
- **Dedicated /research-manage/review route with keyboard-shortcut triage** — D-09 favors status-filter reuse; can be split out in v0.3 if queue volume justifies the surface.

</deferred>

---

*Phase: 27-research-workspace-admin-ui*
*Context gathered: 2026-04-19 (discuss-phase update pass)*
