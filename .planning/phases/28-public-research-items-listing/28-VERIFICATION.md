---
phase: 28-public-research-items-listing
verified: 2026-04-20T19:20:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Browser smoke walk: visit /research, click 'Browse published research', land on /research/items, apply filters, click into a detail page, click Download"
    expected: "File download triggers via presigned R2 GET without Clerk sign-in redirect; all filter combinations yield correct results; pagination maintains filter state"
    why_human: "Requires running dev server, real R2 credentials, and published items in DB. Deferred to v0.2 milestone smoke walk per project policy."
---

# Phase 28: public-research-items-listing Verification Report

**Phase Goal:** Public visitors can browse and download all published research items, filter by type, date, and policy document, and navigate to the policy sections each item informs.
**Verified:** 2026-04-20T19:20:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/research/items` server component renders `status='published'` items with query-param filters; newest-first default | VERIFIED | `app/research/items/page.tsx` exists, `export const dynamic = 'force-dynamic'`, awaits `searchParams: Promise<{...}>`, calls `listPublishedResearchItems({ documentId, itemType, from, to, sort, offset })` with `parseSort` defaulting to `'newest'`; helper enforces `eq(researchItems.status, 'published')` at line 111 of `research-public.ts` |
| 2 | Card layout matches UI-SPEC: title, type badge, authors (or "Source: Confidential"), publishedDate, download-or-external-link CTA; ≥40 cards/page with pagination | VERIFIED | `research-card.tsx` renders type badge, title Link, `formatAuthorsForDisplay` author line, `<time>` pubDate, conditional Download anchor or View Source anchor; `PAGE_SIZE = 40` const in `research-public.ts`; `ResearchPagination` with `aria-live="polite"` and `<nav aria-label="Research items pagination">` |
| 3 | Existing `/research` static page has "Browse published research" CTA linking to `/research/items` without modifying existing prose | VERIFIED | `app/research/page.tsx` line 89–97: `<section id="browse-research">` with `<Button variant="outline">Browse published research</Button>` linking to `/research/items`; prior headings "Understanding the Landscape", "Shape This Policy", "Research Outputs" untouched |
| 4 | `/research/items/[id]` detail page shows metadata, formatted abstract, DOI as `https://doi.org/{doi}` link, download button using presigned R2 GET (24h TTL) for file-backed items OR externalUrl for link-only types | VERIFIED | `app/research/items/[id]/page.tsx`: DOI rendered as `href={\`https://doi.org/${item.doi}\`}` (line 178); `<DownloadButton>` for `item.artifactId` path; external anchor for `item.externalUrl` path; `getDownloadUrl(r2Key, 86_400)` in download route (`DOWNLOAD_TTL_SECONDS = 86_400`); abstract uses `whitespace-pre-line` |
| 5 | Detail page links sections via `research_item_section_links → /framework/[documentId]#section-{sectionId}` and versions via `research_item_version_links → /portal/[documentId]?v=<label>`; no feedback IDs or stakeholder names leak | VERIFIED | `LinkedSectionEntry` renders `href={\`/framework/${documentId}#section-${sectionId}\`}`; `LinkedVersionEntry` renders `href={\`/portal/${documentId}?v=${versionLabel}\`}`; `PUBLIC_COLUMNS` const in `research-public.ts` (17 columns only) excludes `createdBy`, `reviewedBy`, `contentHash`, `txHash`, `anchoredAt`, `milestoneId`; no-leak test 6/6 GREEN |
| 6 | `proxy.ts` whitelists `/api/research(.*)` for presigned download | VERIFIED | `proxy.ts` line 19–20: `// Phase 28 - public research items download endpoint (RESEARCH-10 presigned GET)` + `'/api/research(.*)'` inside `createRouteMatcher([...])`; `proxy-public-routes.test.ts` 3/3 GREEN |
| 7 | Accessibility: filter controls keyboard-navigable, pagination announced via `aria-live`, card download CTA has descriptive `aria-label` | VERIFIED | `ResearchFilterPanel` uses `<form method="get">` (native keyboard nav); `ResearchPagination` renders `<div aria-live="polite">` "Showing items X-Y of Z" + `<nav aria-label="Research items pagination">`; ResearchCard CTAs have `aria-label="Download {title} ({typeLabel})"` and `aria-label="Open external source for {title} (opens in new tab)"`; `accessibility.test.tsx` 7/7 GREEN |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Description | Status | Details |
|----------|-------------|--------|---------|
| `src/server/queries/research-public.ts` | 4 public query helpers + `PublicResearchItem` type + `PAGE_SIZE=40` + `PUBLIC_COLUMNS` | VERIFIED | 214 lines; exports `listPublishedResearchItems`, `getPublishedResearchItem`, `listLinkedSectionsForResearchItem`, `listLinkedVersionsForResearchItem`; `unstable_cache` at 60s revalidate |
| `app/api/research/[id]/download/route.ts` | Presigned R2 GET route handler | VERIFIED | 98 lines; `GET` with async params, rate-limit (10/60s), 4 × 404 paths, 429+Retry-After, `DOWNLOAD_TTL_SECONDS = 86_400`, R2 key derivation, 302 redirect |
| `app/research/items/page.tsx` | Listing server component | VERIFIED | 180 lines; `force-dynamic`, async `searchParams`, all 6 query params parsed, `listPublishedResearchItems` called, grid + pagination + empty-state rendered |
| `app/research/items/_components/research-card.tsx` | Card component | VERIFIED | 101 lines; type badge, title link, `formatAuthorsForDisplay`, `<time>`, conditional Download/View Source CTA with descriptive `aria-label` |
| `app/research/items/_components/research-filter-panel.tsx` | Filter rail | VERIFIED | async server component; `<form method="get">` wrapping Document Select + type checkboxes + From/To dates + Sort + Apply/Clear |
| `app/research/items/_components/research-type-checkboxes.tsx` | Type checkbox client island | VERIFIED | `'use client'`; `router.replace` on toggle; comma-separated CSV encoding; resets `?offset` |
| `app/research/items/_components/research-pagination.tsx` | Offset pagination | VERIFIED | `<nav aria-label="Research items pagination">`, `<div aria-live="polite">`, Previous/Next with disabled states |
| `app/research/items/[id]/page.tsx` | Detail server component | VERIFIED | 261 lines; `force-dynamic`, `generateMetadata`, `React.cache`, UUID guard, `Promise.all` linked sections+versions, DOI link, abstract with `whitespace-pre-line`, `notFound()` paths |
| `app/research/items/[id]/_components/download-button.tsx` | Download client island | VERIFIED | `'use client'`; `window.location.href` assignment; spinner+toast; `aria-label="Download {title} ({itemType})"` |
| `app/research/items/[id]/_components/linked-section-entry.tsx` | Section link entry | VERIFIED | `href=/framework/${documentId}#section-${sectionId}`; pure server component |
| `app/research/items/[id]/_components/linked-version-entry.tsx` | Version link entry | VERIFIED | `href=/portal/${documentId}?v=${versionLabel}`; `isPublished=true` filtered at query layer |
| `app/research/page.tsx` (modified) | Browse CTA addition | VERIFIED | `<section id="browse-research">` with `Browse published research` button at line 89; existing prose sections intact |
| `proxy.ts` (modified) | `/api/research(.*)` whitelist | VERIFIED | Line 19–20: Phase 28 comment + `'/api/research(.*)'` in `isPublicRoute` matcher |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `app/research/items/page.tsx` | `src/server/queries/research-public.ts` | `import { listPublishedResearchItems }` + direct call | WIRED | Line 27 import, line 97 call with all opts |
| `app/research/items/_components/research-card.tsx` | `/api/research/[id]/download` | `href={\`/api/research/${item.id}/download\`}` | WIRED | Line 79; Download anchor on `item.artifactId` path |
| `app/research/items/[id]/page.tsx` | `src/server/queries/research-public.ts` | `import { getPublishedResearchItem, listLinkedSectionsForResearchItem, listLinkedVersionsForResearchItem }` | WIRED | Lines 31–38; all three called in page body |
| `app/research/items/[id]/_components/download-button.tsx` | `/api/research/[id]/download` | `window.location.href = \`/api/research/${itemId}/download\`` | WIRED | Line 48 in `handleDownload` |
| `app/api/research/[id]/download/route.ts` | `src/lib/r2.ts` | `import { R2_PUBLIC_URL, getDownloadUrl }` + `getDownloadUrl(r2Key, 86_400)` | WIRED | Lines 29, 93 |
| `app/api/research/[id]/download/route.ts` | `src/lib/rate-limit.ts` | `import { consume, getClientIp }` + `consume(\`research-download:ip:${ip}\`, ...)` | WIRED | Lines 30, 42 |
| `app/api/research/[id]/download/route.ts` | `src/db/schema/research` + `src/db/schema/evidence` | Drizzle selects on `researchItems` + `evidenceArtifacts` | WIRED | Lines 55–63 (item), 73–77 (artifact) |
| `proxy.ts` | `/api/research/[id]/download/route.ts` | `'/api/research(.*)'` in `isPublicRoute` matcher | WIRED | Line 20; unblocks unauthenticated download |
| `app/research/page.tsx` | `app/research/items/page.tsx` | `<Link href="/research/items">` | WIRED | Line 94 |
| `app/research/items/[id]/page.tsx` | `LinkedSectionEntry` | `href={\`/framework/${documentId}#section-${sectionId}\`}` | WIRED | `linked-section-entry.tsx` line 33 |
| `app/research/items/[id]/page.tsx` | `LinkedVersionEntry` | `href={\`/portal/${documentId}?v=${versionLabel}\`}` | WIRED | `linked-version-entry.tsx` line 34 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `app/research/items/page.tsx` | `{ items, total }` | `listPublishedResearchItems(opts)` → `unstable_cache` → `db.select(PUBLIC_COLUMNS).from(researchItems).where(and(eq(status,'published'),…)).orderBy(…).limit(40).offset(n)` | Yes — Drizzle query with real `where`+`orderBy`+`limit`+`offset` clauses | FLOWING |
| `app/research/items/[id]/page.tsx` | `item`, `linkedSections`, `linkedVersions` | `getPublishedResearchItem(id)` → `unstable_cache` → `db.select(PUBLIC_COLUMNS).from(researchItems).where(and(eq(id,id),eq(status,'published')))` + `listLinkedSectionsForResearchItem` + `listLinkedVersionsForResearchItem` (inner-join queries) | Yes — three real Drizzle queries with join and filter clauses | FLOWING |
| `app/api/research/[id]/download/route.ts` | `presignedUrl` | `getDownloadUrl(r2Key, 86_400)` where `r2Key` is derived from a real DB artifact row | Yes — DB query → R2 key derivation → `getDownloadUrl`; returns 302 redirect | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — dev server not started per project policy (defer browser smoke walks to milestone-end). Test suite (65/65 GREEN) and TypeScript check (zero errors) serve as the automated behavioral gate.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RESEARCH-09 | 28-01, 28-02, 28-04 | Public listing of published research items with filters and pagination | SATISFIED | `app/research/items/page.tsx` + query helper + 4 components shipped; `.planning/REQUIREMENTS.md` line 440: `\| RESEARCH-09 \| Phase 28 \| Complete \|` |
| RESEARCH-10 | 28-01, 28-03, 28-04 | Detail page + presigned R2 download + linked sections/versions | SATISFIED | `app/research/items/[id]/page.tsx` + download route + 3 components shipped; `.planning/REQUIREMENTS.md` line 441: `\| RESEARCH-10 \| Phase 28 \| Complete \|` |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/research/items/[id]/_components/linked-section-entry.tsx` | 11 | `researchItemFeedbackLinks` appears in JSDoc comment | INFO | JSDoc only — not rendered to HTML. The comment documents the intentional Pitfall-6 exclusion. The no-leak test (6/6 GREEN) confirms the string never appears in rendered output. Not a leak. |

No blockers or warnings found. The single info item is a documentation comment, not a runtime data leak.

---

### Human Verification Required

#### 1. End-to-end download smoke walk

**Test:** Visit `/research`, click "Browse published research", land on `/research/items`. Apply a type filter and a date filter. Click into a detail page for a file-backed item. Click Download.
**Expected:** File download triggers via presigned R2 GET URL without Clerk sign-in redirect; browser follows HTTP 302 natively. Return to listing and verify filter state persists in URL.
**Why human:** Requires running dev server + real R2 credentials + a published item with an attached artifact in the DB. Deferred to v0.2 milestone smoke walk per project policy (`feedback_defer_smoke_walks.md`).

---

### Gaps Summary

None. All 7 observable truths verified against the actual codebase. All 13 required artifacts exist, are substantive, and are wired to real data sources. Both RESEARCH-09 and RESEARCH-10 are marked complete in REQUIREMENTS.md. The phase-28 test suite runs 65/65 GREEN with 0 todo and 0 failed. TypeScript emits zero errors. The only deferred item is the browser smoke walk, which is project policy for all phases.

---

### Pre-existing Test Failures (Baseline — Not Regressions)

The 17 pre-existing failing test files documented in `deferred-items.md` (69 tests across phases 19/20/20.5/21) are confirmed unchanged from the Plan 26-05 baseline. Phase 28 contributes zero new test failures and +110 passing tests (Phases 27+28 combined) since the Phase 26-05 snapshot.

---

_Verified: 2026-04-20T19:20:00Z_
_Verifier: Claude (gsd-verifier)_
