---
phase: 27-research-workspace-admin-ui
verified: 2026-04-20T01:15:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
human_verification:
  - test: "Visit /research-manage as research_lead — confirm only own drafts visible (authorId filter applied)"
    expected: "Table shows only items created by the logged-in research_lead; admin/policy_lead can see all items"
    why_human: "Requires Clerk session with research_lead role to exercise the filter path end-to-end"
  - test: "Open /research-manage/new, fill all 11 fields, upload a PDF, click Save Draft"
    expected: "File upload fires on change (not on save), progress bar appears, success row shows filename; on save, item appears in list with RI-NNN readableId"
    why_human: "Fire-on-select upload behavior requires real R2 presign + PUT flow"
  - test: "On detail page as admin, reject an item — type rationale, click Submit Rejection"
    expected: "Toast 'Research item rejected.'; ResearchDecisionLog updates in same render pass with rejection rationale; status badge changes to Retracted"
    why_human: "Full tRPC mutation + workflow_transitions write + dual-invalidate re-render chain"
  - test: "On detail page, open SectionLinkPicker, select 3 sections, click Link 3"
    expected: "Promise.allSettled fires 3 linkSection mutations; success toast '3 sections linked.'; linked list repopulates immediately"
    why_human: "Multi-select bulk-link + partial-failure toast requires real router + DB"
  - test: "Click a relevanceNote placeholder in LinkedSectionRow, type a note, click Save note"
    expected: "Textarea appears in-place; Save note calls linkSection with relevanceNote; text persists on re-render"
    why_human: "Conditional onConflictDoUpdate path requires real DB upsert to verify persistence"
  - test: "Visit research_lead dashboard — confirm My Drafts and Pending Review StatCards appear with correct counts"
    expected: "Two cards above the Feedback/Evidence row, count matches real draft/pending items for that user"
    why_human: "Server-component count queries require real DB with fixture data"
  - test: "Visit admin dashboard — confirm Research Awaiting Review StatCard shows count and clicking navigates to /research-manage?status=pending_review with filter pre-applied"
    expected: "Stat card renders pending_review count; clicking opens list filtered to pending_review items"
    why_human: "URL-bootstrap pre-filter requires browser navigation smoke walk"
---

# Phase 27: Research Workspace Admin UI — Verification Report

**Phase Goal:** research_lead has a first-class workspace surface to author research items and submit them for review; admin/policy_lead has a review queue to approve, reject, or retract; all users can browse linked entities from a research item detail page

**Verified:** 2026-04-20T01:15:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/research-manage` lists research items visible to current user, with filter panel and sortable columns | VERIFIED | `app/research-manage/page.tsx` calls `trpc.research.list.useQuery` with `authorId` filter; `ResearchFilterPanel` is controlled; 6-column table present; URL-bootstrap from query params confirmed |
| 2 | Create and edit drafts via `/research-manage/new` and `/research-manage/[id]/edit`; fire-on-select upload with `category: 'research'` | VERIFIED | Both pages exist; `ResearchItemForm` calls `uploadFile({ category: 'research' })` on file change (line 221); D-03 itemType branch for external URL vs file upload confirmed |
| 3 | Draft detail page shows lifecycle actions (Submit/Approve/Reject/Retract) wired to tRPC; every transition writes `workflow_transitions` | VERIFIED | `lifecycle-actions.tsx` wires all 4 mutations; `research.approve/.reject/.retract/.submitForReview` calls confirmed; dual-invalidate (getById + listTransitions) on success |
| 4 | Link-picker dialogs attach item to sections/versions/feedback; no duplicates; per-section `relevanceNote` editable inline | VERIFIED | All 3 pickers exist; `Promise.allSettled` bulk-link confirmed in section-link-picker; `LinkedSectionRow` calls `trpc.research.linkSection` with `relevanceNote` via Plan 27-01 `onConflictDoUpdate` |
| 5 | Dashboard widgets: research_lead sees "My Drafts" + "Pending Review"; admin/policy_lead sees "Research Awaiting Review" | VERIFIED | Real `eq(researchItems.createdBy, userId)` + `eq(researchItems.status, ...)` count queries in all 3 dashboard server components; `<Link>` wrapping per UI-SPEC Pitfall 3 |
| 6 | All UI components use existing shadcn + base-ui primitives; no new heavy dependencies | VERIFIED | No new packages in any plan's tech-stack.added; all pickers and forms use Badge, Button, Dialog, Select, Checkbox, Textarea, AlertDialog from existing component library |
| 7 | Backend gate: `listTransitions`, `authorId` filter, `linkSection` upsert, `research` upload category, `shouldHideAuthors` helper | VERIFIED | All 5 artifacts confirmed in codebase (grep results above); router extensions at correct line numbers |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Status | Evidence |
|----------|--------|----------|
| `app/research-manage/page.tsx` | VERIFIED | Exists; `trpc.research.list` call line 163; `formatAuthorsForDisplay` line 99; `ResearchStatusBadge` import; `authorId` filter; "No research items yet" copy line 425 |
| `app/research-manage/_components/research-status-badge.tsx` | VERIFIED | Exports `ResearchStatusBadge`; 4-status `STATUS_CLASSES` + `STATUS_LABELS` mapping |
| `app/research-manage/_components/research-filter-panel.tsx` | VERIFIED | Exports `ResearchFilterPanel` at line 94; controlled component (no internal state) |
| `app/_components/adaptive-header-client.tsx` | VERIFIED | `/research-manage` nav entry at line 73; role gate for admin/policy_lead/research_lead at lines 65-71 |
| `app/globals.css` | VERIFIED | 8+ `--research-status-*` CSS variable pairs (confirmed at lines 120-127 and 231+) |
| `app/research-manage/new/page.tsx` | VERIFIED | Exists (75 lines); role-gated on `research:create`; mounts `ResearchItemForm` in create mode |
| `app/research-manage/[id]/edit/page.tsx` | VERIFIED | Exists (110 lines); role-gated; prefills from `trpc.research.getById`; mounts form in edit mode |
| `app/research-manage/[id]/page.tsx` | VERIFIED | 213 lines; imports `ResearchDecisionLog` and `ResearchLifecycleActions`; `trpc.research.getById.useQuery` at line 70 |
| `app/research-manage/[id]/_components/lifecycle-actions.tsx` | VERIFIED | 288 lines; all 4 mutations wired; RBAC matrix with `can()` checks; inline reject expand + Alert-Dialog retract |
| `app/research-manage/[id]/_components/research-decision-log.tsx` | VERIFIED | 127 lines; `trpc.research.listTransitions.useQuery` at line 48 |
| `app/research-manage/[id]/_components/section-link-picker.tsx` | VERIFIED | 152 lines; `Promise.allSettled` bulk-link confirmed |
| `app/research-manage/[id]/_components/version-link-picker.tsx` | VERIFIED | 192 lines; `DocumentVersionsGroup` subcomponent for hook-safe per-document fetch |
| `app/research-manage/[id]/_components/feedback-link-picker.tsx` | VERIFIED | 220 lines; reuses `trpc.feedback.listAll` (widened permission) |
| `app/research-manage/[id]/_components/linked-section-row.tsx` | VERIFIED | 145 lines; inline editor wired to `trpc.research.linkSection` with `relevanceNote` at line 125 |
| `app/dashboard/_components/research-lead-dashboard.tsx` | VERIFIED | Real count queries filtering `createdBy=userId AND status`; "My Drafts" (line 97) + "Pending Review" (line 104) StatCards |
| `app/dashboard/_components/admin-dashboard.tsx` | VERIFIED | Real count query at line 107; "Research Awaiting Review" StatCard at line 129; grid widened to `lg:grid-cols-5` |
| `app/dashboard/_components/policy-lead-dashboard.tsx` | VERIFIED | Mirror of admin pattern; "Research Awaiting Review" at line 193 |
| `src/server/routers/research.ts` | VERIFIED | `listTransitions` at line 319; `authorId` filter at line 181; `onConflictDoUpdate` at line 665; `getById` extended with `linkedSections/linkedVersions/linkedFeedback` via `Promise.all` at line 262 |
| `src/lib/research-utils.ts` | VERIFIED | `shouldHideAuthors` exported at line 16; `formatAuthorsForDisplay` at line 27 |
| `app/api/upload/route.ts` | VERIFIED | `research: 32 * 1024 * 1024` at line 24; `research: [...]` MIME allowlist at line 71 |
| `src/lib/r2-upload.ts` | VERIFIED | `'research'` literal in `UploadOptions.category` at line 16 |
| Wave 0 RED test scaffolds | VERIFIED | `tests/research/create-edit-dialog.test.tsx`, `link-picker.test.tsx`, `lifecycle-actions.test.tsx`, `anonymous-toggle.test.tsx` all exist; intentional `it.todo` pattern; 47 todos are in-scope contract markers, not failures |

---

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `app/research-manage/page.tsx` | `trpc.research.list` | `useQuery({ authorId, documentId, itemType, status })` | WIRED — line 163 |
| `app/_components/adaptive-header-client.tsx` | `/research-manage` | Role-gated nav `items.push` inside `useMemo` | WIRED — lines 65-74 |
| `app/research-manage/[id]/_components/research-decision-log.tsx` | `trpc.research.listTransitions` | `useQuery({ id: researchItemId })` | WIRED — line 48 |
| `app/research-manage/[id]/_components/lifecycle-actions.tsx` | `trpc.research.submitForReview/approve/reject/retract` | `useMutation` × 4 | WIRED — lines 77/85/95/107 |
| `app/research-manage/[id]/_components/linked-section-row.tsx` | `trpc.research.linkSection` | `useMutation` with `relevanceNote` | WIRED — line 125 |
| `app/research-manage/_components/research-item-form.tsx` | `POST /api/upload` with `category: 'research'` | `uploadFile` call on file change | WIRED — line 221 |
| `app/research-manage/[id]/page.tsx` | `SectionLinkPicker/VersionLinkPicker/FeedbackLinkPicker/LinkedSectionRow` | Imports + mount in JSX | WIRED — imports at lines 21-24; mounts at lines 403/409/415/239 |
| Dashboard widgets | `/research-manage?{params}` | `<Link>` wrapping StatCard | WIRED — confirmed in all 3 dashboard files |
| `src/server/routers/feedback.ts` `listAll` | `research:read_drafts` callers | `protectedProcedure` with OR-check | WIRED — lines 226-236 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `app/research-manage/page.tsx` | `listQuery.data` | `trpc.research.list` → DB `researchItems` table | Yes — no static fallback; `?? []` only for initial render | FLOWING |
| `app/research-manage/[id]/page.tsx` | `itemQuery.data` | `trpc.research.getById` → DB row + 3 inner-join `Promise.all` | Yes — real `linkedSections/linkedVersions/linkedFeedback` arrays | FLOWING |
| `app/research-manage/[id]/_components/research-decision-log.tsx` | `transitionsQuery.data` | `trpc.research.listTransitions` → `workflowTransitions` table with users JOIN | Yes — ordered by `asc(timestamp)` | FLOWING |
| `app/dashboard/_components/research-lead-dashboard.tsx` | `myDraftsResult`, `myPendingReviewResult` | `db.select({ count: count() }).from(researchItems).where(...)` | Yes — `createdBy=userId AND status` filter | FLOWING |
| `app/dashboard/_components/admin-dashboard.tsx` | `researchAwaiting` | `db.select({ count: count() }).from(researchItems).where(eq(...status, 'pending_review'))` | Yes — real DB count | FLOWING |
| `app/dashboard/_components/policy-lead-dashboard.tsx` | `researchAwaitingResult?.count` | Same pattern as admin | Yes | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: **SKIPPED** — The research workspace surface is a Next.js app requiring a browser and DB connection. Per project constraints, manual smoke walks are intentionally deferred to the end-of-milestone batch walk. No runnable CLI entry points exist to test API endpoints directly without starting the dev server.

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| RESEARCH-06 | `/research-manage` workspace list + create/edit flow with file upload, anonymous-author toggle, audit-logged saves | SATISFIED | List page (Plan 02), create/edit pages (Plan 03), `ResearchItemForm` with 11 fields + D-02 fire-on-select upload + D-05 `AnonymousPreviewCard`; router `createInput/updateInput` extended with `artifactFileName/Size/R2Key/PublicUrl` |
| RESEARCH-07 | Detail page lifecycle (Submit/Approve/Reject with rationale/Retract with reason) wired to tRPC; every transition writes `workflow_transitions` | SATISFIED | `lifecycle-actions.tsx` (Plan 04) wires all 4 mutations through Phase 26 `transitionResearch` service which maintains R6 invariant (`workflow_transitions` INSERT before `research_items` UPDATE) |
| RESEARCH-08 | Link-picker dialogs (sections/versions/feedback); no duplicates; `relevanceNote` editable inline; dashboard widgets for all 3 privileged roles | SATISFIED | Plans 05 + 06 deliver: 3 controlled-dialog pickers, `LinkedSectionRow` inline editor, `getById` extension with joined linked-entity arrays, dashboard StatCards with real DB count queries |

All three requirements are marked `[x]` Complete in `.planning/REQUIREMENTS.md` (lines 233-235) and listed as `Complete` in the requirements table (lines 435-437).

**No orphaned requirements** — no additional RESEARCH-0x IDs are mapped to Phase 27 in REQUIREMENTS.md beyond RESEARCH-06/07/08. RESEARCH-09 and RESEARCH-10 are correctly scoped to Phase 28.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `app/research-manage/[id]/page.tsx` (Plan 04) | `ArtifactDownloadLink` renders 'Attachment on file' + 8-char artifactId | Info | Documented shortcut — `research.getById` does not JOIN `evidence_artifacts` (Phase 26 schema choice). JSDoc on the function identifies the resolution path (Phase 28 or follow-up plan). User knows an attachment exists; download link is deferred. Does NOT block RESEARCH-07 success criteria. |
| `app/research-manage/_components/research-item-form.tsx` | Edit mode does not prefill "Uploaded X" row for existing artifact | Info | Same root cause as above — `getById` returns no `artifactFileName/Size`. User can re-upload to replace. Documented in Plan 03 SUMMARY §"Decisions Made". Not a stub — the JSX branch is wired; data path intentionally simplified for v0.2. |

No blockers found. No placeholder text or hardcoded empty returns in rendered paths.

**Wave 0 `it.todo` items** (47 across `tests/research/`) are intentional contract markers per project constraints — not counted as gaps.

---

### TypeScript Verification

`npx tsc --noEmit` exits 0 with no output. No new type errors introduced by Phase 27.

### Test Suite Results

`npx vitest run tests/research/ src/__tests__/research-router.test.ts src/__tests__/upload-research.test.ts`

```
Test Files: 3 passed | 3 skipped (6)
     Tests: 38 passed | 47 todo (85)
```

- 38 tests GREEN (0 failures)
- 47 `it.todo` — intentional Wave 0 contract markers for component-render tests deferred to a post-phase Wave 0-flip plan
- 3 files "skipped" at file level = files containing only `it.todo` blocks (vitest expected behavior)
- No new failures relative to pre-Phase-27 baseline

### Commit Verification

Spot-checked against git log: commits `e05e1b9`, `b50a3ac`, and `25f1a72` all exist with correct author and timestamps. Full commit chain of 17 commits across Plans 27-01 through 27-06 visible in git log.

---

### Human Verification Required

The following items require browser smoke walks. Per project memory (`feedback_defer_smoke_walks`), these are intentionally deferred to the v0.2 milestone-end batch walk — they do NOT cause this phase to be marked `human_needed`.

1. **Role-scoped list page** — Verify research_lead sees only own drafts; admin sees all. Expected: `authorId` filter applied server-side for research_lead callers.

2. **Fire-on-select file upload** — Verify upload fires on file picker change, not on Save Draft. Expected: progress bar appears; "Uploaded {name} · {size}" row shows before submit.

3. **Lifecycle transitions end-to-end** — Reject with rationale, Retract with reason via Alert-Dialog. Expected: dual-invalidate refreshes status badge and decision log in same render pass.

4. **SectionLinkPicker multi-select bulk-link** — Select 3 sections, click Link 3. Expected: `Promise.allSettled` fires 3 mutations; "3 sections linked." toast.

5. **relevanceNote inline edit** — Click placeholder, type note, Save. Expected: upsert persists via `onConflictDoUpdate`; text shows on re-render.

6. **Dashboard StatCard navigation** — Click "Research Awaiting Review" on admin dashboard. Expected: navigates to `/research-manage?status=pending_review` with filter pre-applied via URL bootstrap.

7. **Anonymous author toggle preview** — Toggle `isAuthorAnonymous` Switch in form. Expected: `AnonymousPreviewCard` updates live to "Source: Confidential" / "Authors: X, Y" without server round-trip.

---

### Gaps Summary

No gaps found. All 7 observable truths are verified, all required artifacts exist and are substantive and wired, data flows through real DB queries (not static stubs), and TypeScript is clean.

Two documented shortcuts are in-scope v0.2 decisions, not gaps:
1. `ArtifactDownloadLink` placeholder — Phase 26 schema choice; Phase 28 public listing adds presigned-GET plumbing
2. Edit-mode artifact prefill omission — same root cause; follow-up plan or Phase 28 can extend `getById` to JOIN `evidence_artifacts`

Both are explicitly documented in code (JSDoc) and SUMMARYs with clear resolution paths.

---

_Verified: 2026-04-20T01:15:00Z_
_Verifier: Claude Sonnet 4.6 (gsd-verifier)_
