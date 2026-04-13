---
phase: 07-traceability-search
verified: 2026-04-13T00:00:00Z
status: passed
score: 9/10 truths verified (truth #10 re-verified; TRACE-01 REQUIREMENTS.md discrepancy is a separate docs-only concern outside Phase 15 scope)
re_verification: true
re_verified_note: "FIX-06 re-verified 2026-04-13 — PolicyTabBar includes a Traceability entry (lines 33–38) with canViewTrace role gating. Added in v0.1 Phase 13-03; confirmed reachable in v0.2 Phase 15."
gaps:
  - truth: "Traceability link appears in workspace navigation or policy sub-navigation"
    status: failed
    reason: "No navigation entry points to /policies/[id]/traceability exist anywhere outside the page itself. workspace-nav.tsx has no traceability link. Policy detail page.tsx has no link. No policy sub-nav exists. The page is only reachable by direct URL."
    artifacts:
      - path: "app/(workspace)/_components/workspace-nav.tsx"
        issue: "navItems array contains only Dashboard, Policies, Feedback — no Traceability entry"
      - path: "app/(workspace)/policies/[id]/page.tsx"
        issue: "No link or button pointing to /policies/[id]/traceability"
    missing:
      - "Add a navigation link to /policies/[id]/traceability from the policy detail page or a policy sub-nav component"

  - truth: "TRACE-01 — Full traceability chain is visible and queryable (Feedback -> CR -> Section -> Version)"
    status: partial
    reason: "The traceability.matrix procedure joins Feedback -> CR -> Section -> Version with LEFT JOINs and returns the full chain. The matrix table renders all four columns with data (or '--' for nulls). The chain is technically present in the data layer and visible in the UI. However REQUIREMENTS.md still marks TRACE-01 as Pending (unchecked), and the requirement description says the chain must be 'visible, queryable, and exportable' — the first two are true; export is covered by TRACE-06. The gap is that the REQUIREMENTS.md checkbox was not updated to reflect implementation, creating a discrepancy. The underlying implementation is complete."
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "TRACE-01 marked [ ] Pending at line 75 despite matrix procedure and UI implementing the full FB->CR->Section->Version chain"
    missing:
      - "Update REQUIREMENTS.md to mark TRACE-01 as [x] Complete (or document a concrete gap in what 'full traceability chain' means beyond what is implemented)"

human_verification:
  - test: "Navigate to /policies/[id]/traceability — verify all 4 tabs render without errors"
    expected: "Matrix tab shows filter panel + table; By Section shows section selector; By Stakeholder shows stat cards; Search tab shows input"
    why_human: "Cannot run the Next.js app in this environment"
  - test: "Export CSV button — click and verify download triggers"
    expected: "Browser downloads a .csv file with correct columns: Feedback ID, Feedback Title, Status, Decision Rationale, Org Type, CR ID, CR Title, CR Status, Section, Version, Date Submitted"
    why_human: "Requires running server and browser interaction"
  - test: "Export PDF button — click and verify download triggers"
    expected: "Browser downloads a .pdf file with traceability matrix table"
    why_human: "Requires running server; @react-pdf/renderer dynamic import may have issues in Next.js App Router that only manifest at runtime"
  - test: "Search tab — type at least 2 characters and verify all 3 scope tabs show result counts"
    expected: "Feedback, Policy Content, Change Requests tabs each show a count; results render with highlighted match text"
    why_human: "Requires running server and client"
---

# Phase 7: Traceability & Search Verification Report

**Phase Goal:** The full feedback-to-version traceability chain is visible, queryable, and exportable -- proving the platform's core value proposition
**Verified:** 2026-03-25 (re-verified 2026-04-13)
**Status:** passed (re-verified 2026-04-13)
**Re-verification:** Yes — re-verified 2026-04-13 in v0.2 Phase 15

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `traceability.matrix` returns flat rows with feedbackReadableId, crReadableId, sectionTitle, versionLabel, decisionRationale | VERIFIED | Lines 79-97 of traceability.ts — select shape confirmed |
| 2 | `traceability.matrix` accepts filters: orgType, sectionId, decisionOutcome, versionFromLabel, versionToLabel | VERIFIED | Lines 22-31 of traceability.ts — full filter input schema |
| 3 | `traceability.sectionChain`, `stakeholderOutcomes`, `searchFeedback`, `searchSections`, `searchCRs` procedures exist and have real DB queries | VERIFIED | All 6 procedures in traceability.ts (332 lines), each with substantive Drizzle ORM queries |
| 4 | GET /api/export/traceability/csv returns text/csv with Content-Disposition attachment header | VERIFIED | csv/route.ts line 143-148 — `'Content-Type': 'text/csv'`, `'Content-Disposition': 'attachment; filename="traceability-...'` |
| 5 | GET /api/export/traceability/pdf returns application/pdf with Content-Disposition attachment header | VERIFIED | pdf/route.tsx lines 152-157 — `'Content-Type': 'application/pdf'`, attachment header confirmed |
| 6 | User can see traceability matrix grid with 6 columns (Feedback, CR, Section, Version, Decision, Rationale) and filter panel | VERIFIED | matrix-table.tsx (247 lines) renders all 6 columns with sticky first column; matrix-filter-panel.tsx (278 lines) has org type, section, decision, version range |
| 7 | User can view per-section "What changed and why" with version transition cards | VERIFIED | section-chain-view.tsx (265 lines) — uses `trpc.traceability.sectionChain`, groups by version, renders Card per version group with CR links and feedback list |
| 8 | User can view per-stakeholder feedback outcomes with version influence labels | VERIFIED | stakeholder-outcomes.tsx (194 lines) — uses `trpc.traceability.stakeholderOutcomes`, renders stat cards + "Influenced version {label}" |
| 9 | Search view fires 3 parallel tRPC queries with debounce and match highlighting | VERIFIED | search-view.tsx (321 lines) — `useDebounce(query, 400)`, 3 `useQuery` calls, `enabled: debouncedQuery.length >= 2`; search-result-card.tsx has `<mark>` highlighting |
| 10 | Traceability link appears in workspace navigation or policy sub-navigation | FAILED | workspace-nav.tsx has only Dashboard/Policies/Feedback; policy detail page.tsx has no traceability link; no policy sub-nav exists |

**Score:** 9/10 truths verified (truth #10 failed; truth #1-9 all pass)

Note: Score 8/10 in frontmatter reflects 2 concerns — the navigation gap (truth #10) and the TRACE-01 REQUIREMENTS.md discrepancy.

---

### Required Artifacts

| Artifact | Min Lines | Actual Lines | Status | Details |
|----------|-----------|--------------|--------|---------|
| `src/server/routers/traceability.ts` | — | 332 | VERIFIED | 6 procedures: matrix, sectionChain, stakeholderOutcomes, searchFeedback, searchSections, searchCRs; exports `traceabilityRouter` |
| `src/lib/permissions.ts` | — | 60 | VERIFIED | `trace:read` at line 50, `trace:export` at line 51 |
| `app/api/export/traceability/csv/route.ts` | — | 149 | VERIFIED | GET handler, Papa.unparse, Content-Disposition attachment |
| `app/api/export/traceability/pdf/route.tsx` | — | 158 | VERIFIED | GET handler, renderToBuffer (dynamic import), application/pdf header |
| `app/api/export/traceability/pdf/_document/traceability-pdf.tsx` | — | 123 | VERIFIED | @react-pdf/renderer Document/Page/Text/View, 7-column layout |
| `app/(workspace)/policies/[id]/traceability/page.tsx` | 40 | 189 | VERIFIED | 4-tab layout, URL query param sync, tRPC matrix query |
| `app/(workspace)/policies/[id]/traceability/_components/matrix-table.tsx` | 60 | 247 | VERIFIED | 6 columns, sticky first column, deduplication, tooltip on rationale |
| `app/(workspace)/policies/[id]/traceability/_components/matrix-filter-panel.tsx` | 40 | 278 | VERIFIED | FILTERS heading, org type checkboxes, section select, decision checkboxes, version range selects |
| `app/(workspace)/policies/[id]/traceability/_components/section-chain-view.tsx` | 40 | 265 | VERIFIED | sectionChain query, groupByVersion utility, "Select a section", "No changes recorded" |
| `app/(workspace)/policies/[id]/traceability/_components/stakeholder-outcomes.tsx` | 40 | 194 | VERIFIED | stakeholderOutcomes query, "Influenced version", "No feedback outcomes" |
| `app/(workspace)/policies/[id]/traceability/_components/export-actions.tsx` | 20 | 103 | VERIFIED | Export CSV / Export PDF buttons, fetch + blob download, loading states, sonner toast on error |
| `app/(workspace)/policies/[id]/traceability/_components/search-view.tsx` | 80 | 321 | VERIFIED | Full implementation (not stub): debounce, 3 parallel queries, scope tabs, CR inline filters |
| `app/(workspace)/policies/[id]/traceability/_components/search-result-card.tsx` | 40 | 221 | VERIFIED | FeedbackResultCard, SectionResultCard, CRResultCard, HighlightedText with `<mark>` |
| `app/(workspace)/policies/[id]/traceability/_components/traceability-chain-badge.tsx` | — | 80 | VERIFIED | FB->CR->Section->Version inline chain with clickable badges |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `traceability.ts` | `changeRequests.ts` schema | Drizzle JOIN crFeedbackLinks, crSectionLinks, changeRequests, documentVersions | WIRED | Lines 98-107 — all 5 LEFT JOINs present in matrix query |
| `traceability.ts` | `permissions.ts` | `requirePermission('trace:read')` | WIRED | Line 21 `matrix: requirePermission('trace:read')`, line 127 `sectionChain: requirePermission('trace:read')`, line 203 `searchFeedback: requirePermission('feedback:read_all')` |
| `_app.ts` | `traceability.ts` | `traceability: traceabilityRouter` | WIRED | Lines 10-11 — import confirmed; line 21 registration confirmed |
| `csv/route.ts` | `permissions.ts` | `can(role, 'trace:export')` | WIRED | Line 27 `can(user.role as Role, 'trace:export')` |
| `pdf/route.tsx` | `permissions.ts` | `can(role, 'trace:export')` | WIRED | Line 26 `can(user.role as Role, 'trace:export')` |
| `page.tsx` | `traceability.ts` | `trpc.traceability.matrix.useQuery` | WIRED | Line 55 in page.tsx |
| `export-actions.tsx` | `csv/route.ts` | `fetch('/api/export/traceability/csv')` | WIRED | Line 51 in export-actions.tsx |
| `export-actions.tsx` | `pdf/route.tsx` | `fetch('/api/export/traceability/pdf')` | WIRED | Line 63 in export-actions.tsx |
| `workspace-nav.tsx` | `traceability/page.tsx` | Link href containing traceability | NOT WIRED | workspace-nav.tsx has no traceability entry; no other nav component links to the page |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `matrix-table.tsx` | `rows: MatrixRow[]` | `trpc.traceability.matrix.useQuery` in page.tsx → DB multi-table JOIN in traceability.ts | Yes — Drizzle LEFT JOIN across 6 tables, limit/offset, anonymity enforcement | FLOWING |
| `section-chain-view.tsx` | `chainQuery.data` | `trpc.traceability.sectionChain.useQuery({ sectionId })` → DB JOIN in traceability.ts | Yes — INNER JOIN policySections → crSectionLinks → changeRequests → crFeedbackLinks → feedbackItems | FLOWING |
| `stakeholder-outcomes.tsx` | `outcomesQuery.data` | `trpc.traceability.stakeholderOutcomes.useQuery({ documentId })` → DB query filtered by `ctx.user.id` | Yes — WHERE submitterId = targetUserId, LEFT JOIN documentVersions, policySections | FLOWING |
| `search-view.tsx` | `feedbackResults.data`, `sectionResults.data`, `crResults.data` | 3 parallel `useQuery` calls → 3 procedures in traceability.ts | Yes — ILIKE queries with escaping, limit 50 each | FLOWING |
| `csv/route.ts` | `csvData` | Direct DB query mirroring matrix JOIN | Yes — Papa.unparse on real DB rows | FLOWING |
| `pdf/route.tsx` | `matrixRows` | Direct DB query mirroring matrix JOIN | Yes — renderToBuffer with real DB rows | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED (requires running Next.js server — cannot invoke without starting the application)

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TRACE-01 | 07-01-PLAN | Full traceability chain: Feedback -> CR -> Section -> Version | PARTIAL | Chain data model is complete (feedbackItems JOIN crFeedbackLinks JOIN changeRequests JOIN crSectionLinks JOIN policySections JOIN documentVersions). Matrix procedure returns the full chain. REQUIREMENTS.md checkbox is unchecked (line 75). The chain exists but the requirements tracker was not updated. |
| TRACE-02 | 07-01, 07-02-PLAN | Traceability matrix view: grid with decision rationale | SATISFIED | matrix-table.tsx renders 6 columns (Feedback, CR, Section, Version, Decision, Rationale) with deduplication and sticky first column. REQUIREMENTS.md marks [x]. |
| TRACE-03 | 07-01, 07-02-PLAN | Filter by org type, section, decision outcome, version range | SATISFIED | matrix-filter-panel.tsx exposes all 4 filter groups; traceability.ts matrix procedure accepts all 4 filter inputs. REQUIREMENTS.md marks [x]. |
| TRACE-04 | 07-01, 07-02-PLAN | Per-section "What changed and why" view | SATISFIED | section-chain-view.tsx with sectionChain tRPC query, groupByVersion utility, version transition Cards. REQUIREMENTS.md marks [x]. |
| TRACE-05 | 07-01, 07-02-PLAN | Per-stakeholder feedback outcomes with version influence | SATISFIED | stakeholder-outcomes.tsx with summary stats and "Influenced version {label}" per card. REQUIREMENTS.md marks [x]. |
| TRACE-06 | 07-01, 07-02-PLAN | Export traceability matrix as CSV and PDF | SATISFIED | Two Route Handlers at /api/export/traceability/csv and /pdf, both with Content-Disposition attachment headers and trace:export permission check. REQUIREMENTS.md marks [x]. |
| SRCH-01 | 07-01, 07-03-PLAN | Filter feedback by section, stakeholder type, priority, status, impact category, feedback type | PARTIAL | Backend: feedback.list now accepts orgType, sectionId, status, feedbackType, priority, impactCategory (all 6 SRCH-01 filters). UI: feedback-inbox.tsx sends sectionId, status, feedbackType, priority, impactCategory to tRPC; orgType is filtered client-side. All filters are functionally available to users. REQUIREMENTS.md marks [ ] Pending — not updated. |
| SRCH-02 | 07-01, 07-03-PLAN | Full-text search across feedback content | SATISFIED | searchFeedback procedure uses ILIKE on title+body with escaping, limit 50. search-view.tsx renders FeedbackResultCard with HighlightedText. REQUIREMENTS.md marks [ ] Pending — not updated. |
| SRCH-03 | 07-01, 07-03-PLAN | Search policy document content across sections | PARTIAL | searchSections searches section TITLES only (v1 design decision documented in plan: "JSONB ILIKE on content is unreliable"). REQUIREMENTS.md says "policy document content across sections" which implies content search. Title-only is a deliberate scoping decision, not an oversight. REQUIREMENTS.md marks [ ] Pending — not updated. |
| SRCH-04 | 07-01, 07-03-PLAN | Filter CRs by status, section, linked feedback | SATISFIED | searchCRs procedure accepts status, sectionId (via crSectionLinks subquery), feedbackId (via crFeedbackLinks subquery). CR inline filters in search-view.tsx. changeRequest.list accepts feedbackQuery. REQUIREMENTS.md marks [ ] Pending — not updated. |

**Orphaned Requirements Check:** All 10 requirement IDs (TRACE-01 through TRACE-06, SRCH-01 through SRCH-04) appear in plan frontmatter. No orphaned requirements found.

**REQUIREMENTS.md status discrepancy:** TRACE-01, SRCH-01, SRCH-02, SRCH-03, SRCH-04 are all implemented but REQUIREMENTS.md still shows them as [ ] Pending. This is a documentation gap — the implementations exist but the tracker was not updated.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `stakeholder-outcomes.tsx` | 38 | `trpc.traceability.stakeholderOutcomes.useQuery` — no userId selector visible; Admin/Policy Lead cannot currently select another user to view their outcomes | Warning | TRACE-05 plan spec says "For Policy Lead/Admin, add userId?: uuid to view another user's outcomes." The procedure accepts userId input but the UI has no user selector component for privileged roles. Stakeholders can see their own — admin/policy_lead view is incomplete. |
| `feedback-inbox.tsx` | 56-57 | orgType is filtered client-side, not passed to tRPC | Info | Server accepts orgType but UI doesn't use it — client downloads all feedback and filters locally. Works correctly, suboptimal for large datasets. Not a blocker. |

---

### Human Verification Required

#### 1. Full navigation flow to traceability page

**Test:** From the Policies list, click a policy, look for a Traceability navigation option.
**Expected:** A link, tab, or button labeled "Traceability" should be discoverable without knowing the URL.
**Why human:** No programmatic way to verify discoverability — only a browser can confirm whether the page is reachable through normal navigation.

#### 2. PDF export runtime behavior

**Test:** Click "Export PDF" on the traceability page.
**Expected:** A PDF file downloads containing the traceability matrix table with rows.
**Why human:** `@react-pdf/renderer` uses a dynamic import (`await import('@react-pdf/renderer')`). The renderToBuffer call works correctly in the file but may fail at runtime in Next.js App Router due to ESM/CJS compatibility issues with the renderer. Only a live browser test can confirm.

#### 3. By Stakeholder admin selector

**Test:** Log in as Admin or Policy Lead, navigate to By Stakeholder tab.
**Expected:** A user selector dropdown should appear allowing viewing of another user's outcomes.
**Why human:** The UI (`stakeholder-outcomes.tsx`) does not implement the user selector — it always passes `ctx.user.id` from the procedure. Admin/Policy Lead cannot currently view another stakeholder's outcomes through the UI (though the backend supports it via `userId` input).

---

### Gaps Summary

**1 blocking gap:**

The traceability page at `/policies/[id]/traceability` is reachable only by direct URL. There is no link to it from the workspace nav, the policy detail page, or any other navigation component. This means users cannot discover the feature through normal product navigation. The `workspace-nav.tsx` was intentionally left unchanged (documented in SUMMARY), but the plan required a traceability link to appear "in workspace navigation or policy sub-navigation" — no such link was added anywhere.

**4 REQUIREMENTS.md documentation gaps (non-blocking):**

TRACE-01, SRCH-01, SRCH-02, SRCH-03, SRCH-04 are all implemented to varying degrees but REQUIREMENTS.md still marks them as Pending. The implementations exist; the tracker was not updated after the phase completed.

**1 partial implementation (warning):**

The By Stakeholder tab (`stakeholder-outcomes.tsx`) does not expose the Admin/Policy Lead user selector that the plan specified. Admins can only see their own outcomes through the UI — the backend supports per-user viewing but the selector was not built.

---

_Verified: 2026-03-25_
_Verifier: Claude (gsd-verifier)_
