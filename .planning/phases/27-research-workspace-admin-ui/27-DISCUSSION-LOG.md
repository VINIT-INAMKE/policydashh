# Phase 27: Research Workspace Admin UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 27-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 27-research-workspace-admin-ui
**Mode:** discuss (update pass over existing CONTEXT.md)
**Areas discussed:** Create/Edit surface shape, Link-picker architecture, List/queue layout, Dashboard widget shape, Navigation, Decision log rendering, Upload timing, Type↔mode coupling, Upload category, Anonymous preview placement

---

## Gray areas selected

Existing CONTEXT.md already captured scope IN/OUT, Q1–Q10 inheritance from Phase 26, risks, and dependencies. The update pass identified the remaining UI-shape ambiguities and the user selected all four of:

1. Create/Edit surface shape
2. Link-picker architecture
3. List/queue layout
4. Dashboard widget shape

---

## Create/Edit surface

### Create/Edit: dialog vs pages

| Option | Description | Selected |
|--------|-------------|----------|
| Pages (like workshop-manage) | /research-manage/new + /research-manage/[id]/edit as full pages. Refresh-safe. Matches workshop pattern. | ✓ |
| Two-step dialog (as earlier CONTEXT said) | Single Dialog with Step 1 metadata, Step 2 file/URL. CR CreateDialog style. | |
| Hybrid: create=page, edit=inline | New via page wizard; edit inline on detail page. | |

**User's choice:** Pages — supersedes the "two-step dialog" phrasing in the earlier CONTEXT draft.
**Notes:** 11 metadata fields + file-or-URL branch are too much for a dialog; refresh-safety wins.

### Upload timing

| Option | Description | Selected |
|--------|-------------|----------|
| On file-select, before save | Pick file → R2 presign → PUT → artifact row → green "Uploaded ✓". Save writes research_items referencing artifactId. | ✓ |
| On save (atomic) | Form holds File object; Save runs upload + artifact + research rows in sequence. | |

**User's choice:** On file-select, before save.
**Notes:** Matches existing artifact-attach-dialog pattern. Surfaces upload progress. Accepts orphan-artifact trade-off (noted as low-severity in CONTEXT Risks).

### Type ↔ upload-mode coupling

| Option | Description | Selected |
|--------|-------------|----------|
| Type drives mode auto | media_coverage/legal_reference → URL only; other types → file only. No manual toggle. | ✓ |
| Always show both, user picks | Both file + URL inputs always rendered. | |
| Toggle button per-item | Radio-group "File / External URL / Both" at top of form. | |

**User's choice:** Type drives mode auto.
**Notes:** `itemType` enum IS the toggle. Simpler form, no mis-fills.

### R2 upload category

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing 'document' | 32MB, PDF + DOC + DOCX only. Zero route.ts churn. | |
| Reuse existing 'evidence' | 32MB, broader: PDF + DOC + DOCX + images + audio/video. | |
| Add new 'research' category | Dedicated allowlist: PDF + DOC + DOCX + CSV + XLSX. Requires route.ts edit. | ✓ |

**User's choice:** Add new 'research' category.
**Notes:** Datasets (CSV/XLSX) aren't covered by existing categories. Dedicated allowlist is most precise and keeps the abuse surface tight.

### Anonymous-author preview placement

| Option | Description | Selected |
|--------|-------------|----------|
| Both — live preview in form + rendered on detail | Small preview card flips Authors ⇄ Source: Confidential as switch moves. Detail uses same helper. | ✓ |
| Detail page only | Plain checkbox + helper text; actual preview only on detail. | |

**User's choice:** Both.
**Notes:** Addresses the CONTEXT risk "Anonymous-author toggle must match the public rendering rule exactly" via a single `shouldHideAuthors(item)` helper.

---

## Link-picker architecture

### Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Three separate dialogs | SectionLinkPicker + VersionLinkPicker + FeedbackLinkPicker. Matches workshop pattern. | ✓ |
| One combined tabbed dialog | Single "Attach Links" dialog with Tabs[Sections \| Versions \| Feedback]. | |
| Inline accordion on detail page | Three collapsible sections embedded; no dialogs. | |

**User's choice:** Three separate dialogs.
**Notes:** Maximum code reuse with workshop's existing pattern. Version picker is the only new dialog shape (mirror section picker).

### relevanceNote entry

| Option | Description | Selected |
|--------|-------------|----------|
| After link, inline on detail page | Picker multi-selects only. Notes edited inline on detail-page section list (click-to-edit textarea). | ✓ |
| During picker selection | Each checked section reveals a textarea in the picker before "Link". | |
| Skip notes entirely v0.2 | Defer relevanceNote to v0.3; column stays NULL. | |

**User's choice:** After link, inline on detail page.
**Notes:** Supports late additions and edits without re-opening the dialog; doesn't block bulk linking.

---

## List / queue layout

### /research-manage list

| Option | Description | Selected |
|--------|-------------|----------|
| Table + filter panel | Sortable columns, left-rail filters. Matches /feedback and /audit. | ✓ |
| Card grid like workshop | 3-col card grid. | |
| Hybrid: table default, toggle to cards | Table by default; toggle button flips to cards. | |

**User's choice:** Table + filter panel.
**Notes:** Columns: ReadableID, Title, Type, Status, Author, Date. Default sort: updatedAt DESC.

### Admin review queue surface

| Option | Description | Selected |
|--------|-------------|----------|
| Status filter only | Same /research-manage list; admin lands with status=pending_review preselected via widget link. | ✓ |
| Separate /research-manage/review route | Dedicated page optimized for rapid approve/reject. | |
| Tab on list page | Tabs[All \| Pending Review \| Published \| Retracted]. | |

**User's choice:** Status filter only.
**Notes:** One surface, one code path, one set of tests. Dedicated review route deferred to v0.3.

---

## Dashboard widget shape

### research_lead widget

| Option | Description | Selected |
|--------|-------------|----------|
| Two StatCards only | My Drafts + Pending Review (mine), each clicks to filtered /research-manage. | ✓ |
| StatCards + list of last 3 drafts | StatCards on top, below a small card listing 3 most-recent drafts. | |
| Single combined "My Research" card | One card with both counts + 5-row mini table of drafts. | |

**User's choice:** Two StatCards only.
**Notes:** Minimal, matches Phase 24 inactive-users widget pattern.

### admin / policy_lead widget

| Option | Description | Selected |
|--------|-------------|----------|
| StatCard "Research Awaiting Review: N" | One card, clicks to /research-manage?status=pending_review. | ✓ |
| StatCard + 3-row list | Count + 3 oldest-pending items with inline Review → buttons. | |
| Skip widget v0.2 | Admin navigates from nav, filters by status. | |

**User's choice:** StatCard.
**Notes:** Clean, one query, one click-through to the filtered list.

---

## Navigation

### Nav entry point

| Option | Description | Selected |
|--------|-------------|----------|
| Workspace sidebar, gated by role | "Research" item visible to admin/policy_lead/research_lead only. | ✓ |
| PolicyTabBar on each policy detail | Tab appears on /policies/[id]/research. | |
| Both sidebar + per-policy tab | Global listing from sidebar + per-policy filtered view from tab. | |

**User's choice:** Workspace sidebar, role-gated.
**Notes:** Research is cross-policy; sidebar is the natural home. Mirrors /workshop-manage and /feedback sidebar entries.

---

## Decision log rendering

### Log UI style

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse FeedbackDecisionLog pattern | Inline list, status-chip, actor, timestamp, rationale/retraction reason when present. | ✓ |
| Timeline vertical | Chronological vertical line with dots. | |
| Plain table | DataTable[From, To, Actor, Date, Reason]. | |

**User's choice:** Reuse FeedbackDecisionLog pattern.
**Notes:** Zero new visual design; keeps the workspace chrome consistent across feedback / CR / research.

---

## Claude's Discretion

Captured in CONTEXT.md `<decisions>` → "Claude's Discretion" section. Summary:
- Exact form field ordering
- Filter panel collapse on mobile
- Loading skeleton shapes
- Toast copy
- Table row hover/selected states
- Keyboard navigation within link-pickers

---

## Deferred Ideas

- Rich-text abstract editor (textarea + markdown rendering sufficient for v0.2)
- Bulk CSV import of research items
- Email notifications on status change
- Per-research-item Cardano anchoring (milestone-only per Phase 26 Q4)
- Authorship transfer mutation (Phase 26 Q8)
- DOI external validation (Phase 26 Q10)
- Public `/research/items` listing + detail — Phase 28
- Dedicated /research-manage/review route with keyboard-shortcut triage — D-09 defers this to v0.3

---

## Notes on the update pass

The existing 27-CONTEXT.md already captured scope IN/OUT, user decisions from QUESTIONS.md, dependencies, key files likely touched, and risks. The update pass:

1. Replaced the "two-step Create/Edit dialog" phrasing with the dedicated-pages decision (D-01).
2. Added upload-flow + type-coupling + R2-category specifics (D-02, D-03, D-04).
3. Locked link-picker architecture (D-06) and relevanceNote UX (D-07).
4. Locked list-page shape and review-queue approach (D-08, D-09).
5. Locked dashboard widget shape (D-10, D-11).
6. Added navigation and decision-log-rendering decisions (D-12, D-13).
7. Added the canonical_refs section (was missing in v1 of this CONTEXT).
8. Added code_context section with reusable assets and established patterns.
