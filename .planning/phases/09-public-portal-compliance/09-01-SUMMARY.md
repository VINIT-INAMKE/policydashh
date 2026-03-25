---
phase: 09-public-portal-compliance
plan: 01
subsystem: ui
tags: [next.js, tiptap, react-pdf, drizzle, server-components, public-portal, privacy]

# Dependency graph
requires:
  - phase: 06-versioning
    provides: documentVersions schema with isPublished, sectionsSnapshot, changelog JSONB
  - phase: 04-feedback-system
    provides: feedbackItems schema with isAnonymous, feedbackType, status
  - phase: 03-block-editor
    provides: Tiptap JSON content format stored in section snapshots
  - phase: 01-foundation-auth
    provides: Clerk proxy.ts middleware with createRouteMatcher
provides:
  - Public portal home page listing published policies (/portal)
  - Published policy detail with section nav and version selector (/portal/[policyId])
  - Public changelog with privacy-stripped version history (/portal/[policyId]/changelog)
  - Consultation summary with aggregate counts and isAnonymous enforcement (/portal/[policyId]/consultation-summary)
  - PDF export route for published versions (/api/export/policy-pdf/[versionId])
  - Tiptap JSON to HTML renderer (src/lib/tiptap-html-renderer.ts)
  - Accordion and collapsible shadcn components (base-ui primitives)
affects: [10-workshops, 11-collaboration]

# Tech tracking
tech-stack:
  added: [accordion (base-ui), collapsible (base-ui)]
  patterns: [public route group with no auth, direct Drizzle queries in Server Components, Tiptap JSON to HTML rendering, privacy enforcement via isAnonymous nulling]

key-files:
  created:
    - app/(public)/layout.tsx
    - app/(public)/portal/page.tsx
    - app/(public)/portal/_components/public-policy-card.tsx
    - app/(public)/portal/[policyId]/page.tsx
    - app/(public)/portal/[policyId]/_components/public-version-selector.tsx
    - app/(public)/portal/[policyId]/_components/public-section-nav.tsx
    - app/(public)/portal/[policyId]/_components/public-policy-content.tsx
    - app/(public)/portal/[policyId]/changelog/page.tsx
    - app/(public)/portal/[policyId]/consultation-summary/page.tsx
    - app/(public)/portal/[policyId]/consultation-summary/_components/consultation-summary-accordion.tsx
    - app/api/export/policy-pdf/[versionId]/route.tsx
    - src/lib/tiptap-html-renderer.ts
    - components/ui/accordion.tsx
    - components/ui/collapsible.tsx
  modified:
    - proxy.ts

key-decisions:
  - "Tiptap HTML renderer is a pure string-concatenation function with no React dependencies, supporting all Phase 3 block types"
  - "Accordion and collapsible components manually created from base-ui primitives instead of npx shadcn install"
  - "PublicSectionNav handles both desktop (sticky sidebar with IntersectionObserver) and mobile (select dropdown) modes via a mobile prop"
  - "Consultation summary uses client-side filtering of resolved statuses after Drizzle query (avoids drizzle-orm inArray for enum arrays)"
  - "PDF export uses renderTiptapToText for plain text in PDF (editorial formatting not needed for download)"

patterns-established:
  - "Public route group: (public) layout with zero auth imports, standalone header/footer"
  - "Privacy enforcement: unconditionally null out submitter identity for anonymous submissions on public routes"
  - "Changelog sanitization: only render entry.summary and resolved section titles, never CR IDs or feedback IDs"
  - "Version switching via URL searchParam ?version= for SSR-based version selection"

requirements-completed: [PUB-01, PUB-02, PUB-03, PUB-04, PUB-05]

# Metrics
duration: 17min
completed: 2026-03-25
---

# Phase 9 Plan 1: Public Portal Summary

**Public read-only portal with 5 pages, privacy-enforced consultation summaries, Tiptap HTML renderer, and PDF export for published policy versions**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-25T10:47:57Z
- **Completed:** 2026-03-25T11:04:51Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Built complete public portal with no authentication dependencies (PUB-01)
- Created Tiptap JSON to HTML renderer handling paragraphs, headings, callouts, code blocks, blockquotes, lists, tables, images, and inline marks
- Privacy enforcement on all public routes: changelog strips CR IDs and feedback IDs (PUB-02, PUB-05), consultation summary nulls identity for anonymous submissions (PUB-03, PUB-05)
- PDF export of published versions via react-pdf without authentication (PUB-04)
- Two-column layout with sticky section navigation and IntersectionObserver active tracking

## Task Commits

Each task was committed atomically:

1. **Task 1: Public route group, layout, proxy whitelist, Tiptap HTML renderer, and portal home page** - `27653e7` (feat)
2. **Task 2: Policy detail page, changelog, consultation summary, and PDF export route** - `431b811` (feat)

## Files Created/Modified
- `proxy.ts` - Added /portal and /api/export/policy-pdf to public route whitelist
- `app/(public)/layout.tsx` - Standalone public layout with no auth, header with wordmark, footer with Internal Login link
- `app/(public)/portal/page.tsx` - Portal home listing published policies with card grid and empty state
- `app/(public)/portal/_components/public-policy-card.tsx` - Client component policy card with version badge and date
- `app/(public)/portal/[policyId]/page.tsx` - Policy detail with version selector, section nav, content rendering, and action buttons
- `app/(public)/portal/[policyId]/_components/public-version-selector.tsx` - Version dropdown with URL-based navigation
- `app/(public)/portal/[policyId]/_components/public-section-nav.tsx` - Sticky section nav (desktop) and select dropdown (mobile) with IntersectionObserver
- `app/(public)/portal/[policyId]/_components/public-policy-content.tsx` - Server component rendering Tiptap HTML with editorial typography
- `app/(public)/portal/[policyId]/changelog/page.tsx` - Sanitized changelog with no internal CR/feedback IDs
- `app/(public)/portal/[policyId]/consultation-summary/page.tsx` - Aggregate consultation summary with isAnonymous privacy enforcement
- `app/(public)/portal/[policyId]/consultation-summary/_components/consultation-summary-accordion.tsx` - Per-section accordion with type/outcome/org breakdowns
- `app/api/export/policy-pdf/[versionId]/route.tsx` - Public PDF export route using react-pdf/renderer
- `src/lib/tiptap-html-renderer.ts` - Recursive Tiptap JSON to HTML string renderer
- `components/ui/accordion.tsx` - Accordion component using base-ui primitives
- `components/ui/collapsible.tsx` - Collapsible component using base-ui primitives

## Decisions Made
- Tiptap HTML renderer created as pure function (no React) for server-side rendering in Server Components
- Accordion/collapsible components manually built from @base-ui/react primitives (npx shadcn install unavailable)
- PublicSectionNav unified component handles both desktop sticky nav and mobile select via `mobile` prop
- PDF export uses renderTiptapToText (plain text) since react-pdf does not render HTML
- Version selection uses URL searchParam for SSR compatibility (no client-side state)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manually created accordion and collapsible shadcn components**
- **Found during:** Task 2
- **Issue:** npx shadcn@latest add command was unavailable in execution environment
- **Fix:** Created components/ui/accordion.tsx and components/ui/collapsible.tsx manually using @base-ui/react/accordion and @base-ui/react/collapsible primitives, matching the project's shadcn base-nova pattern
- **Files modified:** components/ui/accordion.tsx, components/ui/collapsible.tsx
- **Verification:** TypeScript compilation passes, component API matches shadcn convention
- **Committed in:** 431b811 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed Server Component with client-side event handler**
- **Found during:** Task 2 (policy detail page)
- **Issue:** Mobile section select with onChange handler was inline in Server Component, which cannot have event handlers
- **Fix:** Moved mobile select into PublicSectionNav client component with a `mobile` prop
- **Files modified:** app/(public)/portal/[policyId]/page.tsx, app/(public)/portal/[policyId]/_components/public-section-nav.tsx
- **Verification:** No hydration errors, TypeScript passes
- **Committed in:** 431b811 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correct operation. No scope creep.

## Issues Encountered
- Buffer type incompatibility with Response constructor in react-pdf renderToBuffer output (pre-existing issue also in traceability PDF route). Applied `as unknown as BodyInit` cast.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data flows are wired to Drizzle queries against existing schema tables.

## Next Phase Readiness
- Public portal complete and ready for integration testing with published policy data
- Audit viewer (Plan 02) can proceed independently
- Workshop module (Phase 10) may need portal links added later

## Self-Check: PASSED

- All 15 created/modified files verified present on disk
- Commit 27653e7 (Task 1) verified in git log
- Commit 431b811 (Task 2) verified in git log
- No new TypeScript errors introduced (all errors are pre-existing)

---
*Phase: 09-public-portal-compliance*
*Completed: 2026-03-25*
