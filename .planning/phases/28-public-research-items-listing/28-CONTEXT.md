# Phase 28 Context — Public `/research/items` Listing & Detail

## Goal
Public visitors can browse and download all published research items, filter by type, date, and policy document, and navigate to the policy sections each item informs.

## Scope (IN)
- NEW `/research/items` public listing (server component) with:
  - Query-param-driven filters: `?document=` (doc UUID), `?type=` (enum), `?from=YYYY-MM-DD`, `?to=YYYY-MM-DD`, `?sort=newest|oldest`
  - Card layout: title, type badge, authors (or "Source: Confidential"), publishedDate, download/external-link CTA
  - Simple pagination (`?offset=`) ≥40 cards/page
- NEW `/research/items/[id]` public detail page with:
  - Full metadata (respecting `isAuthorAnonymous`)
  - Formatted abstract (plain text, line-breaks preserved)
  - DOI rendered as `https://doi.org/{doi}` link (Q10)
  - Download button:
    - file-backed types: call new `trpc.research.getPresignedDownload` (server-action or route handler) returning 24h presigned R2 GET URL
    - URL-only types: external link with `target="_blank" rel="noopener noreferrer"`
  - Linked sections list: internal links to `/framework/[documentId]#section-{sectionId}`
  - Linked versions list: internal links to `/portal/[documentId]?v=<label>`
  - NO feedback IDs, NO stakeholder names, NO internal metadata visible
- MOD existing `/research` (static page): add "Browse published research" CTA card linking to `/research/items`; no prose changes.
- `proxy.ts` requires no new matcher (existing `/research(.*)` wildcard covers the new routes).
- Accessibility: filter controls keyboard-accessible, pagination announced via `aria-live`, card download CTA carries descriptive `aria-label`.
- Lighthouse ≥90 on public detail page.
- Register `RESEARCH-09`, `RESEARCH-10` in `.planning/REQUIREMENTS.md`.

## Scope (OUT)
- No authentication required for the listing/detail pages.
- No in-page preview of file content (download only).
- No RSS/Atom feed (revisit v0.3 if demand).
- No full-text search across research content (v0.3 feature).
- No citation-export (BibTeX/APA) — plain DOI and metadata only.

## User decisions
- Q6 accept: document filter facet visible even with one policy (future-proofs for multi-policy).
- Q9 accept: listing cards do NOT show linked sections — detail page only.
- Q7 accept: anonymous authors render as "Source: Confidential".
- Q10 accept: DOI as plain text rendered as link.

## Dependencies
- Phase 26 (public tRPC `listPublic` proc + `getPresignedDownload`)
- Phase 27 (published items available to list)
- Existing public layout (`app/(public)/layout.tsx`), existing `.cl-landing` theme
- Existing `/portal` and `/framework` routes for deep-links

## Key files likely touched
- NEW `app/(public)/research/items/page.tsx`
- NEW `app/(public)/research/items/[id]/page.tsx`
- NEW `app/(public)/research/items/_components/` (research-filter-panel, research-card, pagination, download-button)
- NEW `app/api/research/[id]/download/route.ts` (presigned R2 GET endpoint, rate-limited, respects `isPublished`)
- MOD `app/(public)/research/page.tsx` — append Browse-CTA card (no prose change)
- NEW `tests/phase-28/*.test.tsx` — server component render, filter URL sync, anonymous-author rendering, presigned URL expiry

## Risks
- **Public leak**: any proc/route used by this page must enforce `status = 'published'`; add a dedicated `listPublic` rather than reusing `list`.
- **Presigned URL abuse**: rate-limit the download route per-IP (reuse `src/lib/rate-limit.ts`); verify `isPublished` at request time.
- **Cache staleness**: use `unstable_cache` with short TTL (60s) on the listing query — consistent with `/workshops` Phase 20 pattern.
- **URL-state sprawl**: encode filters via `useSearchParams`/`router.replace` to keep shareable URLs; mirror Phase 21 framework patterns.
- **SEO**: include `<title>`, `<meta description>`, and a sitemap entry for `/research/items` (server-rendered).

## Success criteria
See ROADMAP.md Phase 28 entry (criteria 1–7).

## Artefacts produced by this phase
- Public listing + detail pages
- Presigned download route
- CTA addition to existing `/research`
- Component/integration tests
- Registered requirements
