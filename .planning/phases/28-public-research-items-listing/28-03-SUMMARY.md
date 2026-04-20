---
phase: 28-public-research-items-listing
plan: 03
subsystem: ui
tags: [nextjs, server-component, react-cache, generate-metadata, public-surface, detail-page, leak-prevention, force-dynamic, accessibility]

# Dependency graph
requires:
  - phase: 26-research-module-data-server
    provides: research_items schema + ResearchItemType union consumed by TYPE_LABELS map
  - phase: 27-research-workspace-admin-ui
    provides: formatAuthorsForDisplay helper (D-05 single source of truth, anonymous-author rule)
  - phase: 28-00-wave0-red-test-stubs
    provides: tests/phase-28/detail-page.test.tsx (10 it.todo) + no-leak.test.ts (5 HTML it.todo) + accessibility.test.tsx (7 it.todo) — all flipped GREEN by Task 3
  - phase: 28-01-backend-query-download-route
    provides: getPublishedResearchItem + listLinkedSectionsForResearchItem + listLinkedVersionsForResearchItem helpers + PublicResearchItem type + GET /api/research/[id]/download route
  - phase: 28-02-listing-page-components
    provides: TYPE_LABELS pattern + formatAuthorsForDisplay reuse + async-server-component test pattern (mock query + await Page() + renderToStaticMarkup)
provides:
  - app/research/items/[id]/page.tsx — Server Component detail page (RESEARCH-10 in its entirety)
  - app/research/items/[id]/_components/download-button.tsx — 'use client' island, window.location.href to /api/research/{id}/download + sonner toast on synchronous throw
  - app/research/items/[id]/_components/linked-section-entry.tsx — Server component, internal Link to /framework/{docId}#section-{sectionId}
  - app/research/items/[id]/_components/linked-version-entry.tsx — Server component, internal Link to /portal/{docId}?v={versionLabel}
  - GREEN detail-page test (13 assertions): H1, Back link aria-label + href, DOI hyperlink, anonymous author, peer-reviewed badge presence/absence, linked sections/versions internal-link patterns, section headings, notFound() on null + invalid UUID, whitespace-pre-line abstract
  - GREEN no-leak HTML test (5 detail-page assertions + 1 listing-query assertion + 1 deferred it.todo): query result keys lack audit/anchor columns; rendered HTML omits createdBy/reviewedBy, FB-### feedback IDs, contentHash/txHash/anchoredAt, feedbackLinks column names
  - GREEN accessibility test (7 assertions): From/To date input aria-labels, pagination nav aria-label, URL-only target=_blank + rel=noopener noreferrer, Back link aria-label, Clear-filters aria-label, Download button aria-label
affects:
  - 28-04-research-cta-proxy-requirements — proxy.ts must add /api/research(.*) public matcher; otherwise the DownloadButton's href hits Clerk sign-in. Listing-card HTML it.todo stub remains in no-leak.test.ts as a 28-04 follow-up surface.

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "React.cache() pattern around the public-item fetcher: deduplicates the DB read between generateMetadata + Page within a single request (Next.js 16 §SEO Metadata Approach + node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md)"
    - "UUID guard inside the cached fetcher: validates the id once, returns null for malformed UUIDs so generateMetadata short-circuits to {} without throwing — Page-level UUID_REGEX.test() call still triggers notFound() for the page render path"
    - "Async-server-component test pattern (Phase 20 + Plan 28-02 + this plan): vi.mock the query helper at module level, await ResearchItemDetailPage({ params: Promise.resolve(...) }), then renderToStaticMarkup the returned React element. Used uniformly across detail-page + no-leak + accessibility tests."
    - "Render-components-directly accessibility test pattern: instead of going through ResearchItemsPage (which contains async ResearchFilterPanel and would hit React 19 sync-render Suspense bailout), render ResearchFilterPanel + ResearchPagination + ResearchCard separately so each assertion targets the actual subject component. Mocks usePathname/useRouter/useSearchParams in next/navigation for the ResearchTypeCheckboxes client island that ResearchFilterPanel includes."
    - "Pitfall 6 leak prevention at the UI seam: detail page imports PublicResearchItem (17 columns only, no createdBy/reviewedBy/contentHash/txHash/anchoredAt/milestoneId) — column projection at the query helper enforces leak prevention at the type system + at the rendered HTML."
    - "DownloadButton client island pattern: window.location.href assignment (not fetch) lets the browser follow the route handler's HTTP 302 to a presigned R2 GET URL natively — no CORS concern, no need to read the response body. Defensive try/catch + sonner toast covers the rare synchronous-throw case."

key-files:
  created:
    - app/research/items/[id]/page.tsx
    - app/research/items/[id]/_components/download-button.tsx
    - app/research/items/[id]/_components/linked-section-entry.tsx
    - app/research/items/[id]/_components/linked-version-entry.tsx
  modified:
    - tests/phase-28/detail-page.test.tsx
    - tests/phase-28/no-leak.test.ts
    - tests/phase-28/accessibility.test.tsx

key-decisions:
  - "React.cache around fetchPublishedItem so generateMetadata + Page share ONE DB fetch — the Next.js 16 docs (14-metadata-and-og-images.md) endorse exactly this pattern. Putting UUID validation inside the cache wrapper means an invalid id resolves to null in both pathways without spurious DB queries OR uncaught Postgres errors."
  - "Page still re-runs UUID_REGEX.test() in the body so notFound() fires deterministically when the id is malformed — the cached fetcher returns null in that case, but the page-level test makes the intent explicit and enables short-circuit before triggering React.cache's lookup."
  - "DownloadButton uses window.location.href (not fetch) per UI-SPEC + 28-RESEARCH.md Pattern 5 — the route handler responds with HTTP 302; the browser follows the redirect natively, triggering file download. Defensive try/catch + sonner toast cover the rare synchronous-throw case (most browsers commit the navigation before any error surfaces)."
  - "LinkedSectionEntry + LinkedVersionEntry stay pure server components — no interactivity, no client JS. Receives props from the detail page's Promise.all(listLinkedSectionsForResearchItem, listLinkedVersionsForResearchItem) call which ALREADY filters documentVersions.isPublished=true at the query layer (Plan 28-01 OQ2 resolution) so we never offer a /portal deep-link that would 404."
  - "Detail page renders the type badge inline (using OKLCH tokens) rather than reusing ResearchStatusBadge from app/research-manage — that admin component encodes the full 4-state lifecycle (draft/pending_review/published/retracted); the public detail page only ever shows published items so a single inline badge is simpler than threading a fixed status through the admin component."
  - "Peer-reviewed badge is rendered inline in the metadata row (not as a separate Badge component) — avoids the visual cognitive load of two badge stacks; uses the same green OKLCH tokens as the type badge so the metadata row reads as a single colored highlight."
  - "Abstract uses whitespace-pre-line so line breaks in description are preserved (e.g. paragraph separation) without rendering raw \\n characters — matches how researchItems.description is captured in Phase 27's create form."
  - "Accessibility test renders ResearchFilterPanel directly (await + renderToStaticMarkup) rather than mocking it inside the listing page wrapper — Plan 28-02 had to mock the panel because the listing page render path hits the React 19 sync-render Suspense bailout. Rendering the panel directly here exercises the actual From/To/Clear-filters HTML the SC-7 contract requires."
  - "ResearchTypeCheckboxes client island consumed by ResearchFilterPanel imports usePathname/useRouter/useSearchParams from next/navigation. Stubbed those exports in the accessibility test's next/navigation mock so the panel's static render doesn't bail at the client-island hook boundary."

patterns-established:
  - "Pattern: React.cache around generateMetadata+Page shared DB fetch with embedded UUID validation. Single source of truth for 'this id resolves to null' — both metadata and page short-circuit to the not-found path without redundant DB queries."
  - "Pattern: Render-components-directly-in-tests when the parent page contains an async server component child that would suspend renderToStaticMarkup. Composes the contract from individual component renders rather than the page-wrapper render."
  - "Pattern: Detail-page download button as a tiny client island whose only job is window.location.href assignment + spinner + sonner-toast fallback. Smaller surface area than a fetch-then-redirect dance, no CORS, no need to parse the route response."

requirements-completed: [RESEARCH-10]

# Metrics
duration: 8min
completed: 2026-04-20
---

# Phase 28 Plan 28-03: Detail Page + Download Button + 2 Linked Entries Summary

**Public `/research/items/[id]` detail surface — async Server Component page + 3 children (1 client island for download CTA + 2 server components for linked sections/versions). Implements UI-SPEC Surface B end-to-end, satisfies all 13 detail-page Wave 0 assertions, all 5 HTML-leak assertions, and all 7 SC-7 accessibility assertions.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-20T13:09:42Z
- **Completed:** 2026-04-20T13:18:01Z
- **Tasks:** 3 of 3 executed
- **Files created:** 4 (1 page + 3 components)
- **Files modified:** 3 (Wave 0 test stubs)

## Accomplishments

- **3 components** shipped under `app/research/items/[id]/_components/`:
  - **DownloadButton** (`'use client'` client island) — handleDownload navigates `window.location.href = /api/research/{itemId}/download`, lets the browser follow the route handler's HTTP 302 to the presigned R2 GET URL natively. Spinner via `Loader2` while loading; defensive try/catch + sonner toast "Download unavailable. Please try again or contact the policy team." for the rare synchronous-throw case. `aria-label="Download {title} ({itemType})"` per SC-7.
  - **LinkedSectionEntry** (server component) — wraps a `<Link href={`/framework/${documentId}#section-${sectionId}`}>` around a bordered card with `FileText` icon + sectionTitle + documentTitle + optional italic relevanceNote. Hover state via `hover:bg-muted/30 transition-colors`.
  - **LinkedVersionEntry** (server component) — wraps a `<Link href={`/portal/${documentId}?v=${versionLabel}`}>` around a bordered card with version label pill (using `--status-cr-merged-bg` / `--status-cr-merged-text` OKLCH tokens) + documentTitle + right-aligned `<time>` formatted "MMM d, yyyy". `publishedAt` already filtered to `isPublished=true` at the Plan 28-01 query layer (OQ2 resolution), so deep-links never 404.
- **`app/research/items/[id]/page.tsx`** shipped as the async Server Component composition root — `export const dynamic = 'force-dynamic'` + `export async function generateMetadata` + UUID_REGEX guard + React.cache wrapper around `getPublishedResearchItem`. `Promise.all` parallel fetch for linked sections + versions. Renders UI-SPEC Surface B verbatim: `<article className="mx-auto max-w-3xl px-6 py-16">` wrapper, Back link with `aria-label="Back to all research items"`, header with type badge + H1 + flex-wrap metadata row (authors / pubDate / journalOrSource / Peer Reviewed pill), download CTA block (DownloadButton for file-backed, external anchor for URL-only), DOI block (only when non-null) with `https://doi.org/{doi}` href + target=_blank + rel=noopener noreferrer, abstract with `whitespace-pre-line`, "Informs These Sections" + "Referenced in Policy Versions" sections separated by `<hr className="border-border my-8" />`.
- **3 Wave 0 test files flipped** from RED stubs to GREEN assertions:
  - `tests/phase-28/detail-page.test.tsx`: 10 it.todo → **13 GREEN** assertions covering H1, Back link aria-label + href, DOI hyperlink presence + absence, "Source: Confidential" anonymous-author, "Peer Reviewed" badge presence + absence, linked sections + versions internal-link patterns, section headings, notFound() on null fetch, notFound() on invalid UUID, whitespace-pre-line abstract preserves line breaks.
  - `tests/phase-28/no-leak.test.ts`: 5 HTML-level it.todo → **5 GREEN** detail-page leak-prevention asserts (createdBy/reviewedBy strings absent, FB-### pattern absent, contentHash/txHash/anchoredAt absent, feedbackLinks column names absent) + 1 GREEN listing-query Object.keys() check + **1 it.todo deferred to 28-04** (listing-card HTML check, since the listing card surface is unchanged in Plan 28-03).
  - `tests/phase-28/accessibility.test.tsx`: 7 it.todo → **7 GREEN** assertions covering From/To date input aria-labels, pagination nav aria-label, URL-only external CTA target=_blank + rel=noopener noreferrer, detail-page Back link aria-label, Clear-filters link aria-label, detail-page Download button aria-label.
- **Plan 28-04 unblocked**: detail surface is live; the only remaining work is the 2 atomic targets the Wave 0 RED files lock — `proxy.ts` `/api/research(.*)` whitelist + `app/research/page.tsx` Browse CTA insertion.

## Task Commits

Each task committed atomically with hooks enabled (Wave 3 solo-agent — no `--no-verify`):

1. **Task 1: 3 detail-page components (download button + linked section/version entries)** — `2210daa` (feat)
2. **Task 2: app/research/items/[id]/page.tsx detail server component** — `66d78cd` (feat)
3. **Task 3: Flip Wave 0 detail-page + no-leak HTML + accessibility stubs to GREEN** — `17e3d4c` (test)

**Plan metadata commit:** appended at the end of execution (this SUMMARY + STATE.md + ROADMAP.md update).

## Files Created/Modified

**Detail-page components (Task 1):**
- `app/research/items/[id]/_components/download-button.tsx` (66 lines) — `'use client'` island. Imports `useState` from react, `Download` + `Loader2` icons from lucide-react, `toast` from sonner, `Button` from `@/components/ui/button`. handleDownload sets loading state, assigns `window.location.href = /api/research/${itemId}/download`, catches the rare synchronous throw and shows a sonner toast. Button has `min-h-11` (44px) touch target + `aria-label={`Download ${title} (${itemType})`}`.
- `app/research/items/[id]/_components/linked-section-entry.tsx` (53 lines) — Pure server component. Takes documentId/sectionId/sectionTitle/documentTitle/relevanceNote props. Renders `<Link href={`/framework/${documentId}#section-${sectionId}`}>` wrapping a bordered card with FileText icon + section info. Optional italic relevanceNote.
- `app/research/items/[id]/_components/linked-version-entry.tsx` (54 lines) — Pure server component. Takes documentId/versionLabel/documentTitle/publishedAt props. Renders `<Link href={`/portal/${documentId}?v=${versionLabel}`}>` wrapping a bordered card with version pill (--status-cr-merged-bg/text tokens) + documentTitle + right-aligned formatted date. publishedAt nullable (filtered to isPublished=true upstream at query layer).

**Detail page (Task 2):**
- `app/research/items/[id]/page.tsx` (242 lines) — Async Server Component. `export const dynamic = 'force-dynamic'`. Imports `cache` from React + `notFound` from next/navigation + `format` from date-fns + `ArrowLeft` + `ExternalLink` icons from lucide-react + `Badge` from components/ui + helpers from `@/src/server/queries/research-public` + `formatAuthorsForDisplay` from `@/src/lib/research-utils` + the 3 child components. UUID_REGEX const matches portal/[policyId]/page.tsx exactly. TYPE_LABELS Record<ResearchItemType, string> map matches Plan 28-02's research-card.tsx pattern. fetchPublishedItem = cache(async (id) => UUID_REGEX validation, then call getPublishedResearchItem). generateMetadata returns dynamic title + description (sliced to 155 chars per UI-SPEC SEO block). Page body: await params → UUID guard → notFound() if invalid → await fetchPublishedItem → notFound() if null → Promise.all linked sections + versions. Renders UI-SPEC Surface B verbatim with all the prescribed Tailwind classes.

**Wave 0 test conversion (Task 3):**
- `tests/phase-28/detail-page.test.tsx` (170 lines) — Replaced 10 it.todo stubs + variable-path dynamic import with 13 GREEN assertions. Module-level vi.mock of `@/src/server/queries/research-public` (4 helpers) + vi.mock of `next/navigation` notFound (throws NEXT_NOT_FOUND). renderDetail(id) helper awaits ResearchItemDetailPage({ params: Promise.resolve({id}) }), renderToStaticMarkup the returned element. fixture() builder produces a baseline PublicResearchItem; per-test overrides inject doi/peerReviewed/isAuthorAnonymous values.
- `tests/phase-28/no-leak.test.ts` (175 lines) — Replaced 6 it.todo stubs with 6 real tests (5 GREEN + 1 it.todo intentionally deferred). Uses partial-mock pattern (`vi.mock(..., async (orig) => ({...await orig(), getPublishedResearchItem: mock, ...}))`) to override the detail-page helpers while preserving listPublishedResearchItems for the Object.keys() leak check. countChain + selectChain mocks the @/src/db.select call sequence the Plan 28-01 listing helper makes. The 1 deferred it.todo (listing-card HTML doesn't contain abstract/doi) belongs to the listing-card surface and is OUT OF SCOPE for Plan 28-03 (detail-page only).
- `tests/phase-28/accessibility.test.tsx` (155 lines) — Replaced 7 it.todo stubs with 7 GREEN assertions. Renders each subject component directly (ResearchFilterPanel for From/To/Clear-filters; ResearchPagination for nav aria-label; ResearchCard with URL-only fixture for target=_blank + rel; ResearchItemDetailPage for Back link + Download button). Required full next/navigation mock (notFound + usePathname + useRouter + useSearchParams) because ResearchTypeCheckboxes client island consumes the latter three via the panel composition.

## Decisions Made

- **React.cache() with embedded UUID validation** — fetchPublishedItem returns null for malformed UUIDs without spurious DB queries OR uncaught Postgres errors. generateMetadata sees null → returns {}; Page sees null → calls notFound(). Single source of truth for "this id is invalid."
- **Page-level UUID_REGEX.test() retained** — even though the cached fetcher would return null, calling notFound() at the page entry makes the intent explicit and provides a deterministic short-circuit before the React.cache lookup.
- **DownloadButton uses window.location.href, not fetch** — UI-SPEC + 28-RESEARCH.md Pattern 5 mandate this. Lets the browser follow the route handler's HTTP 302 to the presigned R2 GET URL natively — no CORS concern, no need to parse the route's response body. Defensive try/catch + sonner toast cover the rare synchronous-throw case.
- **LinkedSectionEntry + LinkedVersionEntry as pure server components** — no interactivity needed, no client JS. Both receive simple flat props from the detail-page's parallel Promise.all fetch.
- **Detail-page uses inline type badge (OKLCH tokens)** rather than reusing ResearchStatusBadge from app/research-manage — that admin component encodes the full 4-state lifecycle; the public detail page only ever shows published items so a single inline badge is simpler.
- **Peer-reviewed badge inline in metadata row** — avoids visual stacking; reuses the same green OKLCH tokens as the type badge so the metadata row reads as a single colored highlight.
- **Abstract uses whitespace-pre-line** — preserves line breaks captured by Phase 27's create form without rendering raw \n characters.
- **Accessibility test renders components directly** rather than going through ResearchItemsPage — Plan 28-02 had to mock ResearchFilterPanel inside the listing-page wrapper because the React 19 sync renderer bails on nested async server components. Rendering ResearchFilterPanel directly here exercises the actual From/To/Clear-filters HTML, satisfying SC-7 against the real subject component.
- **next/navigation mock includes usePathname/useRouter/useSearchParams** — ResearchTypeCheckboxes client island (consumed by ResearchFilterPanel) imports those three; the panel's static render bails at the client-island hook boundary without them. Stubbing them keeps the test surface intact.
- **No-leak test JSDoc comment refactor** — the page.tsx file initially had JSDoc comment lines listing audit-column names ("createdBy, reviewedBy, contentHash, txHash") as "intentionally EXCLUDED". Refactored those comments to describe the exclusions abstractly ("feedback identifiers, author/reviewer identity, internal audit columns, feedback-link table") so the literal grep test (acceptance criterion in the plan) returns 0 matches in the source file. Documentation intent preserved; production behavior unchanged. Matches the same pattern Plan 28-01 applied to research-public.ts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Refactored accessibility test to render components directly instead of going through ResearchItemsPage**

- **Found during:** Task 3 (running the GREEN test for the first time)
- **Issue:** The plan's `<action>` block for accessibility.test.tsx routed all 7 assertions through `ResearchItemsPage({ searchParams: ... })` + `renderToStaticMarkup`. This hit the React 19 sync-renderer Suspense error ("A component suspended while responding to synchronous input") because ResearchItemsPage embeds the async ResearchFilterPanel server component (Plan 28-02 documented the same bailout). 5 of 7 listing-side assertions failed this way.
- **Fix:** Restructured to render each subject component directly: `await ResearchFilterPanel({ ... })` for From/To/Clear-filters; `<ResearchPagination ... />` for the nav aria-label; `<ResearchCard item={...} />` for the URL-only target=_blank + rel; `await ResearchItemDetailPage({ params: ... })` for the Back link + Download button. Required adding usePathname/useRouter/useSearchParams to the next/navigation mock so the ResearchTypeCheckboxes client island (consumed by ResearchFilterPanel) doesn't bail at the hook boundary. The contract surface is preserved — each assertion still targets the actual subject component's HTML.
- **Files modified:** tests/phase-28/accessibility.test.tsx (initial test draft and final shipped version)
- **Commit:** 17e3d4c (Task 3 commit; the fix is part of the same commit since the test went from RED to GREEN in one revision pass)
- **Resolution:** All 7 tests GREEN. Same Suspense-bailout class of issue Plan 28-02 hit and resolved by mocking the filter panel — Plan 28-03 took the inverse approach (render the panel directly) so the SC-7 contract actually exercises the panel's HTML rather than mocking it away.

**2. [Rule 1 - Bug] Refactored leak-prevention JSDoc comments in page.tsx to satisfy the literal grep acceptance criterion**

- **Found during:** Task 2 verification (grep of audit-column names in page.tsx)
- **Issue:** The acceptance criterion for Task 2 specified `grep "createdBy\|reviewedBy\|contentHash\|txHash\|feedbackId\|researchItemFeedbackLinks" app/research/items/[id]/page.tsx` returns 0 matches. The first version of the file had JSDoc comment lines documenting the leak-prevention intent that contained those literal column names. JSDoc never reaches the rendered HTML (so the runtime no-leak test passed), but the literal source-grep returned matches.
- **Fix:** Refactored the JSDoc to describe the exclusions abstractly ("feedback identifiers, author/reviewer identity, internal audit columns", "feedback-link table"). Documentation intent preserved; no production behavior change.
- **Files modified:** app/research/items/[id]/page.tsx
- **Commit:** 66d78cd (same commit as the page.tsx initial creation; the fix happened pre-commit)
- **Resolution:** Source-level grep now returns 0 matches; runtime HTML test continues to confirm leak-free output. Matches the same pattern Plan 28-01 applied to research-public.ts on the same acceptance criterion.

**Total deviations:** 2 (both Rule 1/3 — auto-fixed inline, no impact on shipped surface).

**Impact on plan:** None on production behavior. Both fixes are mechanical adjustments that align the implementation with the plan's literal acceptance criteria while preserving the documented intent.

## Issues Encountered

- **React 19 sync-render Suspense bailout on accessibility test** — see Deviation 1 above. Resolved by restructuring the test to render each subject component directly.
- **Wave 0 RED siblings remain RED in `tests/phase-28`** — `proxy-public-routes.test.ts` (2 failures) and `research-cta.test.tsx` (2 failures) are intentionally RED per `28-VALIDATION.md` rows T4 and T7 (`❌ red` status). Both lock Plan 28-04's two atomic edits (proxy.ts append `/api/research(.*)` whitelist + `/research` page Browse CTA insertion). NOT a regression caused by this plan; explicitly OUT of scope per the plan's `<acceptance_criteria>` block.

## User Setup Required

None — Wave 3 detail surface is purely code. No external service configuration required. The DownloadButton points to `/api/research/${item.id}/download` (Plan 28-01 shipped the route, Plan 28-04 will whitelist it in `proxy.ts`); until then unauthenticated visitors clicking Download will get Clerk's sign-in redirect (expected mid-phase behavior, not a bug).

## Next Phase Readiness

**Plan 28-04 (CTA + proxy + REQUIREMENTS)** has its two atomic targets locked + URL surface confirmed live:
- proxy.ts: append `'/api/research(.*)'` + Phase 28 comment header → flips `proxy-public-routes.test.ts` GREEN (3/3)
- app/research/page.tsx: insert "Browse published research" CTA section linking to `/research/items` → flips `research-cta.test.tsx` GREEN (5/5)
- REQUIREMENTS.md: mark RESEARCH-09 + RESEARCH-10 complete

The 1 it.todo remaining in no-leak.test.ts (listing-card HTML check) is also handed off to Plan 28-04 since the listing-card surface is unchanged from Plan 28-02.

No blockers. The Wave 3 detail surface is the URL contract Plan 28-04 builds on top of.

## Self-Check: PASSED

Verified before final commit:
- [x] app/research/items/[id]/page.tsx EXISTS
- [x] app/research/items/[id]/_components/download-button.tsx EXISTS
- [x] app/research/items/[id]/_components/linked-section-entry.tsx EXISTS
- [x] app/research/items/[id]/_components/linked-version-entry.tsx EXISTS
- [x] tests/phase-28/detail-page.test.tsx MODIFIED (10 it.todo → 13 GREEN it())
- [x] tests/phase-28/no-leak.test.ts MODIFIED (6 it.todo → 5 GREEN it() + 1 deferred it.todo)
- [x] tests/phase-28/accessibility.test.tsx MODIFIED (7 it.todo → 7 GREEN it())
- [x] Commit 2210daa EXISTS in git log (Task 1: 3 components)
- [x] Commit 66d78cd EXISTS in git log (Task 2: page.tsx)
- [x] Commit 17e3d4c EXISTS in git log (Task 3: test conversion)
- [x] npx tsc --noEmit CLEAN (no errors anywhere)
- [x] tests/phase-28/detail-page.test.tsx: 13/13 PASS
- [x] tests/phase-28/no-leak.test.ts: 5/5 PASS + 1 todo
- [x] tests/phase-28/accessibility.test.tsx: 7/7 PASS

---
*Phase: 28-public-research-items-listing*
*Plan: 03*
*Completed: 2026-04-20*
