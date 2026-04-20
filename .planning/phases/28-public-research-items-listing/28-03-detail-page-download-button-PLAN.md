---
phase: 28-public-research-items-listing
plan: 03
type: execute
wave: 3
depends_on:
  - 28-00
  - 28-01
files_modified:
  - app/research/items/[id]/page.tsx
  - app/research/items/[id]/_components/download-button.tsx
  - app/research/items/[id]/_components/linked-section-entry.tsx
  - app/research/items/[id]/_components/linked-version-entry.tsx
  - tests/phase-28/detail-page.test.tsx
  - tests/phase-28/no-leak.test.ts
  - tests/phase-28/accessibility.test.tsx
autonomous: true
requirements:
  - RESEARCH-10
must_haves:
  truths:
    - "app/research/items/[id]/page.tsx is an async Server Component with export const dynamic = 'force-dynamic'"
    - "generateMetadata uses React.cache() to deduplicate the getPublishedResearchItem fetch between metadata + page"
    - "UUID_REGEX guard validates params.id before DB query (portal/[policyId] pattern)"
    - "Page calls notFound() when getPublishedResearchItem returns null OR id fails UUID regex"
    - "DOI renders as https://doi.org/{doi} link with target=_blank rel=noopener noreferrer"
    - "Anonymous-author items render 'Source: Confidential' via formatAuthorsForDisplay"
    - "Peer-reviewed badge renders when peerReviewed=true; absent when false"
    - "Linked sections render as internal links to /framework/{documentId}#section-{sectionId}"
    - "Linked versions render as internal links to /portal/{documentId}?v={versionLabel}"
    - "Download button is a client island that navigates window.location.href to /api/research/{id}/download"
    - "Detail page HTML contains NO feedback IDs (FB-*), createdBy, reviewedBy, contentHash, txHash, or feedback link table data (Pitfall 6)"
    - "Back link has aria-label='Back to all research items' and href='/research/items'"
  artifacts:
    - path: "app/research/items/[id]/page.tsx"
      provides: "Server Component detail page with metadata, abstract, DOI, linked entities"
      contains: "export default async function ResearchItemDetailPage"
    - path: "app/research/items/[id]/_components/download-button.tsx"
      provides: "Client component for Download CTA (window.location.href + error toast)"
      contains: "'use client'"
    - path: "app/research/items/[id]/_components/linked-section-entry.tsx"
      provides: "Server component rendering internal link to /framework/{docId}#section-{sectionId}"
      contains: "export function LinkedSectionEntry"
    - path: "app/research/items/[id]/_components/linked-version-entry.tsx"
      provides: "Server component rendering internal link to /portal/{docId}?v={versionLabel}"
      contains: "export function LinkedVersionEntry"
  key_links:
    - from: "app/research/items/[id]/page.tsx"
      to: "getPublishedResearchItem + listLinkedSectionsForResearchItem + listLinkedVersionsForResearchItem"
      via: "direct import from '@/src/server/queries/research-public'"
      pattern: "getPublishedResearchItem"
    - from: "DownloadButton (client island)"
      to: "/api/research/{id}/download"
      via: "window.location.href"
      pattern: "window.location.href.*/api/research/"
    - from: "LinkedSectionEntry"
      to: "/framework/{documentId}#section-{sectionId}"
      via: "Next.js Link"
      pattern: "/framework/"
    - from: "LinkedVersionEntry"
      to: "/portal/{documentId}?v={versionLabel}"
      via: "Next.js Link"
      pattern: "/portal/"
---

<objective>
Wave 3 detail surface. Build the public `/research/items/[id]` detail page + 3 child components (download button, linked section entry, linked version entry). Turns the Wave 0 detail-page.test.tsx + no-leak.test.ts (HTML leak stubs) + accessibility.test.tsx stubs GREEN.

Purpose: This is RESEARCH-10 in its entirety. Full metadata render (respecting isAuthorAnonymous), formatted abstract (whitespace-preserved), DOI hyperlink (Q10), download CTA (file-backed via /api/research/{id}/download; URL-only via externalUrl target=_blank), linked sections/versions (no feedback IDs ever — Pitfall 6), SEO metadata via generateMetadata + React.cache. Follows portal/[policyId]/page.tsx UUID-regex guard pattern.

Output: One page + 3 _components, all GREEN against Wave 0 detail + no-leak + accessibility tests.
</objective>

<execution_context>
@D:/aditee/policydash/.claude/get-shit-done/workflows/execute-plan.md
@D:/aditee/policydash/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/28-public-research-items-listing/28-CONTEXT.md
@.planning/phases/28-public-research-items-listing/28-RESEARCH.md
@.planning/phases/28-public-research-items-listing/28-UI-SPEC.md
@.planning/phases/28-public-research-items-listing/28-VALIDATION.md
@AGENTS.md
@app/portal/[policyId]/page.tsx
@src/server/queries/research-public.ts
@src/lib/research-utils.ts
@components/ui/button.tsx
@components/ui/badge.tsx
@tests/phase-28/detail-page.test.tsx
@tests/phase-28/no-leak.test.ts
@tests/phase-28/accessibility.test.tsx

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. -->

From src/server/queries/research-public.ts (Plan 28-01):
```typescript
export async function getPublishedResearchItem(id: string): Promise<PublicResearchItem | null>
export async function listLinkedSectionsForResearchItem(researchItemId: string): Promise<Array<{
  sectionId: string
  sectionTitle: string
  documentId: string
  documentTitle: string
  relevanceNote: string | null
}>>
export async function listLinkedVersionsForResearchItem(researchItemId: string): Promise<Array<{
  versionId: string
  versionLabel: string
  documentId: string
  documentTitle: string
  publishedAt: Date | null
}>>
```

From app/portal/[policyId]/page.tsx (UUID guard pattern — copy verbatim):
```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function Page({ params }: { params: Promise<{ policyId: string }> }) {
  const { policyId } = await params
  if (!UUID_REGEX.test(policyId)) {
    notFound()
  }
  // ...
}
```

From UI-SPEC Surface B (detail page structure):
- Page wrapper: `mx-auto max-w-3xl px-6 py-16`
- Back link: `text-sm text-muted-foreground with ArrowLeft icon` + `aria-label="Back to all research items"`
- Header: type badge + H1 (28px semibold) + metadata row (flex-wrap) with authors | date | journal | peer-reviewed
- Download block: Button variant="default" (file-backed) or variant="outline" (URL-only) with aria-label per copy contract
- DOI block (if present): "DOI: {doi}" with https://doi.org/{doi} anchor, text-primary underline underline-offset-2
- Abstract: h2 (20px) "Abstract" + body text-[16px] whitespace-pre-line
- Linked sections: h2 "Informs These Sections" + LinkedSectionEntry list or empty copy
- Linked versions: h2 "Referenced in Policy Versions" + LinkedVersionEntry list or empty copy
- `<hr className="border-border my-8">` between sections

LinkedSectionEntry (from UI-SPEC Surface B, already in RESEARCH.md §Code Examples):
```
<Link href="/framework/{documentId}#section-{sectionId}">
  <div className="flex items-start gap-3 rounded-md border bg-card px-4 py-3 hover:bg-muted/30 transition-colors">
    <FileText className="mt-0.5 size-4 text-muted-foreground shrink-0" />
    <div>
      <p className="text-sm font-medium text-foreground">{sectionTitle}</p>
      <p className="text-xs text-muted-foreground">{documentTitle}</p>
      {relevanceNote && <p className="mt-1 text-xs text-muted-foreground italic">{relevanceNote}</p>}
    </div>
  </div>
</Link>
```

LinkedVersionEntry (from UI-SPEC Surface B):
```
<Link href="/portal/{documentId}?v={versionLabel}">
  <div className="flex items-center gap-3 rounded-md border bg-card px-4 py-3 hover:bg-muted/30 transition-colors">
    <span className="inline-flex items-center rounded-full bg-[var(--status-cr-merged-bg)] px-2 py-0.5 text-xs font-medium text-[var(--status-cr-merged-text)]">{versionLabel}</span>
    <span className="text-sm text-foreground">{documentTitle}</span>
    <time className="ml-auto text-xs text-muted-foreground">{publishedAt formatted as MMM d, yyyy}</time>
  </div>
</Link>
```

From UI-SPEC Copywriting Contract:
- Download CTA aria-label: `Download {title} ({type})`
- View Source CTA aria-label: `Open external source for {title} (opens in new tab)`
- Back link aria-label: `Back to all research items`
- Empty states: "This item has no linked policy sections." / "This item has no linked policy versions."
- Section headings: "Informs These Sections", "Referenced in Policy Versions"
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create 3 _components files (download-button, linked-section-entry, linked-version-entry)</name>
  <files>app/research/items/[id]/_components/download-button.tsx, app/research/items/[id]/_components/linked-section-entry.tsx, app/research/items/[id]/_components/linked-version-entry.tsx</files>
  <behavior>
    - DownloadButton ('use client'): handleDownload() navigates `window.location.href = /api/research/{itemId}/download`. Sets loading state; on sync navigation, spinner shows momentarily. On any catch, sonner toast "Download unavailable. Please try again or contact the policy team." Button variant="default" with Download icon when idle, Loader2 spinner when loading. aria-label "Download {title} ({type})".
    - LinkedSectionEntry (server): Link wrapping a bordered card; FileText icon + sectionTitle + documentTitle + optional relevanceNote italic.
    - LinkedVersionEntry (server): Link wrapping a bordered card; version pill (using --status-cr-merged-bg/--status-cr-merged-text tokens) + documentTitle + right-aligned publishedAt.
  </behavior>
  <read_first>
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-UI-SPEC.md Surface B LinkedSectionEntry + LinkedVersionEntry + Download CTA
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-RESEARCH.md Pattern 5 (DownloadButton Client Component) + §Code Examples
    - D:/aditee/policydash/app/globals.css lines 132-133, 243-244 (--status-cr-merged-bg / --status-cr-merged-text tokens confirmed)
    - D:/aditee/policydash/components/ui/button.tsx (Button variant types)
  </read_first>
  <action>
Create three files.

**app/research/items/[id]/_components/download-button.tsx** (client):

```typescript
'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export interface DownloadButtonProps {
  itemId: string
  title: string
  itemType: string
}

export function DownloadButton({ itemId, title, itemType }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false)

  function handleDownload() {
    setLoading(true)
    try {
      // 28-RESEARCH.md Pattern 5: native browser redirect handles file download.
      // The server responds with HTTP 302 to a presigned URL; browser follows.
      // No fetch/CORS concern. If the route returns 4xx/5xx, the browser shows
      // the JSON error page — we cover that via the catch + toast below for
      // defensive UX. Some browsers won't throw on href assignment, but the
      // spinner resets when the navigation commits.
      window.location.href = `/api/research/${itemId}/download`
    } catch {
      toast.error('Download unavailable. Please try again or contact the policy team.')
      setLoading(false)
    }
  }

  return (
    <Button
      variant="default"
      size="default"
      onClick={handleDownload}
      disabled={loading}
      aria-label={`Download ${title} (${itemType})`}
      className="min-w-[120px] min-h-11"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="size-4" aria-hidden="true" />
      )}
      <span className="ml-1">Download</span>
    </Button>
  )
}
```

**app/research/items/[id]/_components/linked-section-entry.tsx** (server):

```typescript
import Link from 'next/link'
import { FileText } from 'lucide-react'

export interface LinkedSectionEntryProps {
  documentId: string
  sectionId: string
  sectionTitle: string
  documentTitle: string
  relevanceNote: string | null
}

export function LinkedSectionEntry({
  documentId, sectionId, sectionTitle, documentTitle, relevanceNote,
}: LinkedSectionEntryProps) {
  return (
    <Link
      href={`/framework/${documentId}#section-${sectionId}`}
      className="block"
      aria-label={`${sectionTitle} in ${documentTitle}`}
    >
      <div className="flex items-start gap-3 rounded-md border bg-card px-4 py-3 hover:bg-muted/30 transition-colors">
        <FileText className="mt-0.5 size-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-foreground">{sectionTitle}</p>
          <p className="text-xs text-muted-foreground">{documentTitle}</p>
          {relevanceNote && (
            <p className="mt-1 text-xs text-muted-foreground italic">{relevanceNote}</p>
          )}
        </div>
      </div>
    </Link>
  )
}
```

**app/research/items/[id]/_components/linked-version-entry.tsx** (server):

```typescript
import Link from 'next/link'
import { format } from 'date-fns'

export interface LinkedVersionEntryProps {
  documentId: string
  versionLabel: string
  documentTitle: string
  publishedAt: Date | null
}

export function LinkedVersionEntry({
  documentId, versionLabel, documentTitle, publishedAt,
}: LinkedVersionEntryProps) {
  return (
    <Link
      href={`/portal/${documentId}?v=${versionLabel}`}
      className="block"
      aria-label={`${versionLabel} of ${documentTitle}`}
    >
      <div className="flex items-center gap-3 rounded-md border bg-card px-4 py-3 hover:bg-muted/30 transition-colors">
        <span className="inline-flex items-center rounded-full bg-[var(--status-cr-merged-bg)] px-2 py-0.5 text-xs font-medium text-[var(--status-cr-merged-text)]">
          {versionLabel}
        </span>
        <span className="text-sm text-foreground">{documentTitle}</span>
        {publishedAt && (
          <time
            dateTime={publishedAt.toISOString()}
            className="ml-auto text-xs text-muted-foreground"
          >
            {format(publishedAt, 'MMM d, yyyy')}
          </time>
        )}
      </div>
    </Link>
  )
}
```
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep "app/research/items/\[id\]/_components/" | wc -l</automated>
  </verify>
  <acceptance_criteria>
    - Files exist: `app/research/items/[id]/_components/download-button.tsx`, `linked-section-entry.tsx`, `linked-version-entry.tsx`
    - `grep "'use client'" app/research/items/[id]/_components/download-button.tsx` returns a match
    - `grep "'use client'" app/research/items/[id]/_components/linked-section-entry.tsx` returns 0 matches (server)
    - `grep "'use client'" app/research/items/[id]/_components/linked-version-entry.tsx` returns 0 matches (server)
    - `grep "window.location.href = \`/api/research/" app/research/items/[id]/_components/download-button.tsx` returns a match
    - `grep "aria-label={\`Download \\${title} (\\${itemType})\`}" app/research/items/[id]/_components/download-button.tsx` OR equivalent returns a match
    - `grep "/framework/\\${documentId}#section-" app/research/items/[id]/_components/linked-section-entry.tsx` returns a match
    - `grep "/portal/\\${documentId}?v=" app/research/items/[id]/_components/linked-version-entry.tsx` returns a match
    - `grep "createdBy\\|reviewedBy\\|feedbackId" app/research/items/[id]/_components/` returns 0 matches
    - `npx tsc --noEmit 2>&1 | grep "app/research/items/\[id\]/_components/"` returns 0 lines
  </acceptance_criteria>
  <done>
    Three components compile. DownloadButton is a client island with window.location.href redirect + error toast. Linked entry components are server components with proper internal link patterns.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create app/research/items/[id]/page.tsx detail server component</name>
  <files>app/research/items/[id]/page.tsx</files>
  <behavior>
    - Default-exports async `ResearchItemDetailPage`; `export const dynamic = 'force-dynamic'`.
    - Declares `UUID_REGEX` (same as portal).
    - Wraps `getPublishedResearchItem` in `React.cache()` so `generateMetadata` and the page share one DB fetch.
    - `generateMetadata({ params })`: awaits params, calls cached fetcher, returns dynamic title + description (trimmed to 155 chars per UI-SPEC SEO block).
    - Page function: awaits params, validates UUID → notFound() if invalid; fetches via cached helper → notFound() if null.
    - Fetches linked sections + versions in parallel via Promise.all.
    - Renders UI-SPEC Surface B structure exactly.
    - Download CTA logic: file-backed (artifactId) → `<DownloadButton>`; URL-only (externalUrl) → anchor with target=_blank rel=noopener noreferrer + aria-label per UI-SPEC.
    - Abstract section uses `whitespace-pre-line` so line breaks in description are preserved.
    - DOI block rendered only when doi is non-null.
    - Peer-reviewed badge rendered only when peerReviewed=true.
  </behavior>
  <read_first>
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-UI-SPEC.md Surface B (full structure spec, verbatim)
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-RESEARCH.md Pattern 3 (direct Drizzle detail page) + §SEO Metadata Approach
    - D:/aditee/policydash/app/portal/[policyId]/page.tsx lines 1-80 (async params, UUID regex, notFound pattern, auth() opt-in)
    - D:/aditee/policydash/src/server/queries/research-public.ts (Plan 28-01 exports)
    - D:/aditee/policydash/src/lib/research-utils.ts (formatAuthorsForDisplay)
    - D:/aditee/policydash/tests/phase-28/detail-page.test.tsx (Wave 0 contract)
  </read_first>
  <action>
Create `app/research/items/[id]/page.tsx`:

```typescript
/**
 * Phase 28 Plan 28-03 — public /research/items/[id] detail page (RESEARCH-10).
 *
 * Server Component. Unauthenticated. Direct Drizzle via research-public.ts
 * helpers (Pitfall 1: getById tRPC procedure is gated by research:read_drafts;
 * bypassed here via the public-safe projection helper).
 *
 * Layout: UI-SPEC Surface B — single column max-w-3xl, header with type badge
 * + H1 + metadata row, download/view CTA block, DOI block, abstract, linked
 * sections, linked versions.
 *
 * Leak prevention (Pitfall 6): NEVER render feedback IDs, createdBy,
 * reviewedBy, internal audit columns. getPublishedResearchItem column-projects
 * these out; the linked-sections / linked-versions helpers never touch
 * researchItemFeedbackLinks.
 *
 * generateMetadata uses React.cache (28-RESEARCH.md §SEO Metadata Approach) so
 * the initial DB fetch is shared between metadata + page render.
 */
import type { Metadata } from 'next'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  getPublishedResearchItem,
  listLinkedSectionsForResearchItem,
  listLinkedVersionsForResearchItem,
  type PublicResearchItem,
  type ResearchItemType,
} from '@/src/server/queries/research-public'
import { formatAuthorsForDisplay } from '@/src/lib/research-utils'
import { DownloadButton } from './_components/download-button'
import { LinkedSectionEntry } from './_components/linked-section-entry'
import { LinkedVersionEntry } from './_components/linked-version-entry'

export const dynamic = 'force-dynamic'

// portal/[policyId]/page.tsx canonical UUID validation (prevents Postgres errors on malformed id)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const TYPE_LABELS: Record<ResearchItemType, string> = {
  report: 'Report',
  paper: 'Paper',
  dataset: 'Dataset',
  memo: 'Memo',
  interview_transcript: 'Interview Transcript',
  media_coverage: 'Media Coverage',
  legal_reference: 'Legal Reference',
  case_study: 'Case Study',
}

// React.cache dedupes between generateMetadata + Page for ONE DB fetch per request
const fetchPublishedItem = cache(async (id: string): Promise<PublicResearchItem | null> => {
  if (!UUID_REGEX.test(id)) return null
  return getPublishedResearchItem(id)
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const item = await fetchPublishedItem(id)
  if (!item) return {}
  return {
    title: `${item.title} | Research | Civilization Lab`,
    description:
      item.description?.slice(0, 155) ??
      'Research item informing the blockchain policy consultation.',
  }
}

export default async function ResearchItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) notFound()

  const item = await fetchPublishedItem(id)
  if (!item) notFound()

  const [linkedSections, linkedVersions] = await Promise.all([
    listLinkedSectionsForResearchItem(item.id),
    listLinkedVersionsForResearchItem(item.id),
  ])

  const typeLabel = TYPE_LABELS[item.itemType]
  const authorLine = formatAuthorsForDisplay({
    isAuthorAnonymous: item.isAuthorAnonymous,
    authors: item.authors,
  })
  const pubDate = item.publishedDate ? new Date(item.publishedDate) : null

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/research/items"
        aria-label="Back to all research items"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-8"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All Research
      </Link>

      <header className="mb-8">
        <Badge
          className="bg-[oklch(0.9_0.08_145)] text-[oklch(0.4_0.12_145)] mb-3"
          aria-label={`Type: ${typeLabel}`}
        >
          {typeLabel}
        </Badge>

        <h1
          className="text-[28px] font-semibold leading-[1.2] text-[var(--cl-on-surface)] mb-4"
          style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
        >
          {item.title}
        </h1>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>{authorLine}</span>
          {pubDate && (
            <time dateTime={pubDate.toISOString()}>
              {format(pubDate, 'MMM d, yyyy')}
            </time>
          )}
          {item.journalOrSource && <span>{item.journalOrSource}</span>}
          {item.peerReviewed && (
            <span className="inline-flex items-center rounded-full bg-[oklch(0.9_0.08_145)] px-2 py-0.5 text-xs font-medium text-[oklch(0.4_0.12_145)]">
              Peer Reviewed
            </span>
          )}
        </div>
      </header>

      <div className="mb-8">
        {item.artifactId ? (
          <DownloadButton itemId={item.id} title={item.title} itemType={typeLabel} />
        ) : item.externalUrl ? (
          <a
            href={item.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open external source for ${item.title} (opens in new tab)`}
            className="inline-flex items-center gap-1 min-w-[120px] min-h-11 justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted transition-colors"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            View Source
          </a>
        ) : null}
      </div>

      {item.doi && (
        <div className="mb-6 text-sm text-muted-foreground">
          DOI:{' '}
          <a
            href={`https://doi.org/${item.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {item.doi}
          </a>
        </div>
      )}

      {item.description && (
        <section className="mb-12">
          <h2
            className="text-[20px] font-semibold leading-[1.2] mb-4"
            style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
          >
            Abstract
          </h2>
          <p className="text-[16px] font-normal leading-[1.8] whitespace-pre-line text-foreground">
            {item.description}
          </p>
        </section>
      )}

      <hr className="border-border my-8" />

      <section className="mb-12" aria-labelledby="linked-sections-heading">
        <h2
          id="linked-sections-heading"
          className="text-[20px] font-semibold leading-[1.2] mb-4"
          style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
        >
          Informs These Sections
        </h2>
        {linkedSections.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            This item has no linked policy sections.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {linkedSections.map((s) => (
              <LinkedSectionEntry
                key={`${s.documentId}-${s.sectionId}`}
                documentId={s.documentId}
                sectionId={s.sectionId}
                sectionTitle={s.sectionTitle}
                documentTitle={s.documentTitle}
                relevanceNote={s.relevanceNote}
              />
            ))}
          </div>
        )}
      </section>

      <hr className="border-border my-8" />

      <section aria-labelledby="linked-versions-heading">
        <h2
          id="linked-versions-heading"
          className="text-[20px] font-semibold leading-[1.2] mb-4"
          style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
        >
          Referenced in Policy Versions
        </h2>
        {linkedVersions.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            This item has no linked policy versions.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {linkedVersions.map((v) => (
              <LinkedVersionEntry
                key={v.versionId}
                documentId={v.documentId}
                versionLabel={v.versionLabel}
                documentTitle={v.documentTitle}
                publishedAt={v.publishedAt}
              />
            ))}
          </div>
        )}
      </section>
    </article>
  )
}
```
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep "app/research/items/\[id\]/page.tsx" | wc -l</automated>
  </verify>
  <acceptance_criteria>
    - File `app/research/items/[id]/page.tsx` exists
    - `grep "export default async function ResearchItemDetailPage" app/research/items/[id]/page.tsx` returns a match
    - `grep "export async function generateMetadata" app/research/items/[id]/page.tsx` returns a match
    - `grep "cache(" app/research/items/[id]/page.tsx` returns a match (React.cache for fetchPublishedItem)
    - `grep "UUID_REGEX" app/research/items/[id]/page.tsx` returns ≥ 2 matches (declare + .test())
    - `grep "notFound()" app/research/items/[id]/page.tsx` returns ≥ 2 matches (UUID invalid + item null)
    - `grep "https://doi.org/\\${item.doi}" app/research/items/[id]/page.tsx` returns a match (Q10)
    - `grep "target=\"_blank\"" app/research/items/[id]/page.tsx` returns ≥ 2 matches (DOI + View Source + any others)
    - `grep "rel=\"noopener noreferrer\"" app/research/items/[id]/page.tsx` returns ≥ 2 matches
    - `grep "aria-label=\"Back to all research items\"" app/research/items/[id]/page.tsx` returns a match
    - `grep "Informs These Sections" app/research/items/[id]/page.tsx` returns a match
    - `grep "Referenced in Policy Versions" app/research/items/[id]/page.tsx` returns a match
    - `grep "Peer Reviewed" app/research/items/[id]/page.tsx` returns a match
    - `grep "whitespace-pre-line" app/research/items/[id]/page.tsx` returns a match (abstract preserves line breaks)
    - `grep "createdBy\\|reviewedBy\\|contentHash\\|txHash\\|feedbackId\\|researchItemFeedbackLinks" app/research/items/[id]/page.tsx` returns 0 matches (leak prevention)
    - `npx tsc --noEmit 2>&1 | grep "app/research/items/\[id\]/page.tsx"` returns 0 lines
  </acceptance_criteria>
  <done>
    Detail page compiles. Renders UI-SPEC Surface B verbatim. UUID guard, React.cache, generateMetadata, DOI anchor, whitespace-preserved abstract, linked entities, peer-reviewed badge all present. Zero leak-column references.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Convert Wave 0 detail-page.test.tsx + no-leak HTML stubs + accessibility.test.tsx from it.todo to GREEN</name>
  <files>tests/phase-28/detail-page.test.tsx, tests/phase-28/no-leak.test.ts, tests/phase-28/accessibility.test.tsx</files>
  <behavior>
    - detail-page.test.tsx: replace 10 it.todo stubs with real asserts using `renderToStaticMarkup(await Page({ params }))` pattern. Mock `getPublishedResearchItem` + `listLinkedSectionsForResearchItem` + `listLinkedVersionsForResearchItem` + `next/navigation.notFound`.
    - no-leak.test.ts: convert the 5 HTML-level it.todo stubs to GREEN asserts using the same detail-page render pattern with a fixture that DOES include feedback/stakeholder metadata at the DB layer — assert the RENDERED HTML does not contain those strings.
    - accessibility.test.tsx: convert 7 it.todo stubs to GREEN asserts against live listing + detail page HTML (reuse the same renderToStaticMarkup pattern).
  </behavior>
  <read_first>
    - D:/aditee/policydash/tests/phase-28/detail-page.test.tsx
    - D:/aditee/policydash/tests/phase-28/no-leak.test.ts
    - D:/aditee/policydash/tests/phase-28/accessibility.test.tsx
    - D:/aditee/policydash/app/research/items/[id]/page.tsx (just created in Task 2)
    - D:/aditee/policydash/tests/phase-28/listing-page.test.tsx (Plan 28-02 Task 3 flipped — reference for async-server-component + mock pattern)
  </read_first>
  <action>
Rewrite all three files.

**tests/phase-28/detail-page.test.tsx** — 10 GREEN asserts:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const mockGetPublishedResearchItem = vi.fn()
const mockListLinkedSectionsForResearchItem = vi.fn()
const mockListLinkedVersionsForResearchItem = vi.fn()

vi.mock('@/src/server/queries/research-public', () => ({
  getPublishedResearchItem: (...a: any[]) => mockGetPublishedResearchItem(...a),
  listLinkedSectionsForResearchItem: (...a: any[]) => mockListLinkedSectionsForResearchItem(...a),
  listLinkedVersionsForResearchItem: (...a: any[]) => mockListLinkedVersionsForResearchItem(...a),
}))

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NEXT_NOT_FOUND') },
}))

import ResearchItemDetailPage from '@/app/research/items/[id]/page'
import type { PublicResearchItem } from '@/src/server/queries/research-public'

const validId = '11111111-2222-3333-4444-555555555555'

function fixture(overrides: Partial<PublicResearchItem> = {}): PublicResearchItem {
  return {
    id: validId, readableId: 'RI-001', documentId: '99999999-aaaa-bbbb-cccc-dddddddddddd',
    title: 'AI Policy in India', itemType: 'report',
    description: 'Intro paragraph.\nSecond paragraph.', externalUrl: null,
    artifactId: 'art-1', doi: null, authors: ['Jane Doe'],
    publishedDate: '2026-02-01', peerReviewed: false, journalOrSource: null,
    versionLabel: null, previousVersionId: null,
    isAuthorAnonymous: false, retractionReason: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetPublishedResearchItem.mockResolvedValue(fixture())
  mockListLinkedSectionsForResearchItem.mockResolvedValue([])
  mockListLinkedVersionsForResearchItem.mockResolvedValue([])
})

async function renderDetail(id: string = validId) {
  const el = await ResearchItemDetailPage({ params: Promise.resolve({ id }) } as any)
  return renderToStaticMarkup(el)
}

describe('/research/items/[id] detail — RESEARCH-10', () => {
  it('renders H1 with item.title', async () => {
    const html = await renderDetail()
    expect(html).toContain('AI Policy in India')
  })

  it('Back link has aria-label="Back to all research items" and href="/research/items"', async () => {
    const html = await renderDetail()
    expect(html).toContain('aria-label="Back to all research items"')
    expect(html).toContain('href="/research/items"')
  })

  it('DOI renders as hyperlink https://doi.org/{doi} when doi is non-null', async () => {
    mockGetPublishedResearchItem.mockResolvedValue(fixture({ doi: '10.1234/abcd' }))
    const html = await renderDetail()
    expect(html).toContain('href="https://doi.org/10.1234/abcd"')
  })

  it('hides DOI block when doi is null', async () => {
    mockGetPublishedResearchItem.mockResolvedValue(fixture({ doi: null }))
    const html = await renderDetail()
    expect(html).not.toContain('https://doi.org/')
  })

  it('renders "Source: Confidential" when isAuthorAnonymous=true', async () => {
    mockGetPublishedResearchItem.mockResolvedValue(fixture({
      isAuthorAnonymous: true, authors: null,
    }))
    const html = await renderDetail()
    expect(html).toContain('Source: Confidential')
  })

  it('renders "Peer Reviewed" badge when peerReviewed=true', async () => {
    mockGetPublishedResearchItem.mockResolvedValue(fixture({ peerReviewed: true }))
    const html = await renderDetail()
    expect(html).toContain('Peer Reviewed')
  })

  it('does NOT render "Peer Reviewed" badge when peerReviewed=false', async () => {
    mockGetPublishedResearchItem.mockResolvedValue(fixture({ peerReviewed: false }))
    const html = await renderDetail()
    expect(html).not.toContain('Peer Reviewed')
  })

  it('renders linked sections as /framework/{docId}#section-{sectionId} anchors', async () => {
    mockListLinkedSectionsForResearchItem.mockResolvedValue([
      { sectionId: 'sec-1', sectionTitle: 'Scope', documentId: 'doc-1', documentTitle: 'Policy', relevanceNote: 'Key' },
    ])
    const html = await renderDetail()
    expect(html).toContain('href="/framework/doc-1#section-sec-1"')
    expect(html).toContain('Scope')
  })

  it('renders linked versions as /portal/{docId}?v={label} anchors with filter isPublished=true already applied at query layer', async () => {
    mockListLinkedVersionsForResearchItem.mockResolvedValue([
      { versionId: 'v-1', versionLabel: 'v0.2', documentId: 'doc-1', documentTitle: 'Policy', publishedAt: new Date('2026-03-01') },
    ])
    const html = await renderDetail()
    expect(html).toContain('href="/portal/doc-1?v=v0.2"')
    expect(html).toContain('v0.2')
  })

  it('renders "Informs These Sections" and "Referenced in Policy Versions" headings', async () => {
    const html = await renderDetail()
    expect(html).toContain('Informs These Sections')
    expect(html).toContain('Referenced in Policy Versions')
  })

  it('calls notFound() when getPublishedResearchItem returns null', async () => {
    mockGetPublishedResearchItem.mockResolvedValue(null)
    await expect(renderDetail()).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('calls notFound() when UUID_REGEX does not match id param', async () => {
    await expect(renderDetail('not-a-uuid')).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('abstract body uses whitespace-pre-line so line breaks are preserved', async () => {
    const html = await renderDetail()
    expect(html).toMatch(/whitespace-pre-line[\s\S]*Intro paragraph[\s\S]*Second paragraph/)
  })
})
```

**tests/phase-28/no-leak.test.ts** — convert the 5 HTML it.todo stubs to real asserts. Keep the existing query-keys assertion from Plan 28-01 Task 3. The new tests render the detail page with a fixture that deliberately includes simulated leak-data-adjacent values and assert the HTML omits them:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/cache', () => ({ unstable_cache: (fn: any) => fn }))

// Mock the detail-page helpers to return a fixture; the DB layer mocking from
// Plan 28-01 remains for the listing-query test below.
const mockGetPublishedResearchItem = vi.fn()
const mockListLinkedSectionsForResearchItem = vi.fn()
const mockListLinkedVersionsForResearchItem = vi.fn()

const selectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockResolvedValue([
    {
      id: 'r1', readableId: 'RI-001', documentId: 'd1', title: 'X', itemType: 'report',
      description: null, externalUrl: null, artifactId: null, doi: null,
      authors: null, publishedDate: '2026-01-01', peerReviewed: false,
      journalOrSource: null, versionLabel: null, previousVersionId: null,
      isAuthorAnonymous: false, retractionReason: null,
    },
  ]),
}
const countChain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ n: 1 }]) }
const mockSelect = vi.fn()

vi.mock('@/src/db', () => ({ db: { select: (...a: any[]) => mockSelect(...a) } }))

vi.mock('@/src/server/queries/research-public', async (orig) => {
  const original = await orig<typeof import('@/src/server/queries/research-public')>()
  return {
    ...original,
    getPublishedResearchItem: (...a: any[]) => mockGetPublishedResearchItem(...a),
    listLinkedSectionsForResearchItem: (...a: any[]) => mockListLinkedSectionsForResearchItem(...a),
    listLinkedVersionsForResearchItem: (...a: any[]) => mockListLinkedVersionsForResearchItem(...a),
  }
})

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NEXT_NOT_FOUND') },
}))

import { listPublishedResearchItems } from '@/src/server/queries/research-public'
import ResearchItemDetailPage from '@/app/research/items/[id]/page'

const validId = '11111111-2222-3333-4444-555555555555'

function detailFixture() {
  return {
    id: validId, readableId: 'RI-001', documentId: 'd1',
    title: 'Integrity Study', itemType: 'report' as const,
    description: 'An abstract.', externalUrl: null, artifactId: 'art-1',
    doi: null, authors: ['J. Author'], publishedDate: '2026-02-01',
    peerReviewed: false, journalOrSource: null, versionLabel: null,
    previousVersionId: null, isAuthorAnonymous: false, retractionReason: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetPublishedResearchItem.mockResolvedValue(detailFixture())
  mockListLinkedSectionsForResearchItem.mockResolvedValue([])
  mockListLinkedVersionsForResearchItem.mockResolvedValue([])
  mockSelect.mockImplementationOnce(() => countChain as any).mockImplementation(() => selectChain as any)
})

async function renderDetail() {
  const el = await ResearchItemDetailPage({ params: Promise.resolve({ id: validId }) } as any)
  return renderToStaticMarkup(el)
}

describe('public research detail — leak prevention RESEARCH-10', () => {
  it('listing query result objects do NOT expose createdBy/reviewedBy/contentHash/txHash/anchoredAt/milestoneId keys', async () => {
    const { items } = await listPublishedResearchItems({ sort: 'newest', offset: 0 })
    expect(items.length).toBe(1)
    const keys = Object.keys(items[0])
    expect(keys).not.toContain('createdBy')
    expect(keys).not.toContain('reviewedBy')
    expect(keys).not.toContain('contentHash')
    expect(keys).not.toContain('txHash')
    expect(keys).not.toContain('anchoredAt')
    expect(keys).not.toContain('milestoneId')
    expect(keys).not.toContain('reviewedAt')
  })

  it('detail-page HTML does NOT contain "createdBy" or "reviewedBy" strings', async () => {
    const html = await renderDetail()
    expect(html).not.toMatch(/createdBy|reviewedBy/)
  })

  it('detail-page HTML does NOT contain "FB-" readableId pattern', async () => {
    const html = await renderDetail()
    expect(html).not.toMatch(/FB-\d+/)
  })

  it('detail-page HTML does NOT contain "contentHash", "txHash", "anchoredAt"', async () => {
    const html = await renderDetail()
    expect(html).not.toMatch(/contentHash|txHash|anchoredAt/)
  })

  it('detail-page HTML does NOT contain "feedbackLinks" or "researchItemFeedbackLinks" column names', async () => {
    const html = await renderDetail()
    expect(html).not.toMatch(/feedbackLinks|researchItemFeedbackLinks/)
  })

  it.todo('listing-page card HTML does NOT contain abstract, doi, linked sections count (CONTEXT.md Q9)')
})
```

**tests/phase-28/accessibility.test.tsx** — convert 7 stubs to GREEN. Reuse fixture + render approach:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const mockListPublishedResearchItems = vi.fn()
const mockGetPublishedResearchItem = vi.fn()
const mockListLinkedSectionsForResearchItem = vi.fn()
const mockListLinkedVersionsForResearchItem = vi.fn()

const mockDbChain = { from: vi.fn().mockReturnThis(), orderBy: vi.fn().mockResolvedValue([]) }

vi.mock('@/src/server/queries/research-public', () => ({
  listPublishedResearchItems: (...a: any[]) => mockListPublishedResearchItems(...a),
  getPublishedResearchItem: (...a: any[]) => mockGetPublishedResearchItem(...a),
  listLinkedSectionsForResearchItem: (...a: any[]) => mockListLinkedSectionsForResearchItem(...a),
  listLinkedVersionsForResearchItem: (...a: any[]) => mockListLinkedVersionsForResearchItem(...a),
}))
vi.mock('@/src/db', () => ({ db: { select: vi.fn(() => mockDbChain) } }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND') } }))

import ResearchItemsPage from '@/app/research/items/page'
import ResearchItemDetailPage from '@/app/research/items/[id]/page'

const validId = '11111111-2222-3333-4444-555555555555'

const sampleItem = {
  id: validId, readableId: 'RI-001', documentId: 'd1',
  title: 'Audit Study', itemType: 'report' as const,
  description: 'Abstract.', externalUrl: 'https://example.org/paper.pdf',
  artifactId: null, doi: null, authors: ['J. Doe'],
  publishedDate: '2026-01-01', peerReviewed: false, journalOrSource: null,
  versionLabel: null, previousVersionId: null,
  isAuthorAnonymous: false, retractionReason: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListPublishedResearchItems.mockResolvedValue({ items: [sampleItem], total: 1 })
  mockGetPublishedResearchItem.mockResolvedValue({ ...sampleItem, artifactId: 'art-1', externalUrl: null })
  mockListLinkedSectionsForResearchItem.mockResolvedValue([])
  mockListLinkedVersionsForResearchItem.mockResolvedValue([])
  mockDbChain.orderBy.mockResolvedValue([])
})

async function listingHtml() {
  return renderToStaticMarkup(await ResearchItemsPage({ searchParams: Promise.resolve({}) } as any))
}

async function detailHtml() {
  return renderToStaticMarkup(await ResearchItemDetailPage({ params: Promise.resolve({ id: validId }) } as any))
}

describe('/research/items accessibility — SC-7', () => {
  it('filter <input type="date"> for "from" has aria-label="From date"', async () => {
    const html = await listingHtml()
    expect(html).toMatch(/aria-label="From date"/)
  })

  it('filter <input type="date"> for "to" has aria-label="To date"', async () => {
    const html = await listingHtml()
    expect(html).toMatch(/aria-label="To date"/)
  })

  it('pagination <nav> wrapper has aria-label="Research items pagination"', async () => {
    const html = await listingHtml()
    expect(html).toContain('aria-label="Research items pagination"')
  })

  it('external-link CTA on URL-only items has target="_blank" AND rel="noopener noreferrer"', async () => {
    // URL-only fixture: artifactId=null + externalUrl truthy
    mockListPublishedResearchItems.mockResolvedValue({
      items: [{ ...sampleItem, artifactId: null, externalUrl: 'https://ext.example/x' }],
      total: 1,
    })
    const html = await listingHtml()
    expect(html).toMatch(/href="https:\/\/ext\.example\/x"[^>]*target="_blank"/)
    expect(html).toMatch(/rel="noopener noreferrer"/)
  })

  it('Back link on detail page has aria-label="Back to all research items"', async () => {
    const html = await detailHtml()
    expect(html).toContain('aria-label="Back to all research items"')
  })

  it('clear-filters link has aria-label="Clear all filters" when a filter is active', async () => {
    mockListPublishedResearchItems.mockResolvedValue({ items: [], total: 0 })
    const el = await ResearchItemsPage({ searchParams: Promise.resolve({ type: 'report' }) } as any)
    const html = renderToStaticMarkup(el)
    expect(html).toContain('aria-label="Clear all filters"')
  })

  it.todo('download button has aria-label matching /Download .+ \\(.+\\)/ pattern (DownloadButton is a client island — client-only test via render())')
})
```

Note: the download-button aria-label test is kept it.todo because `DownloadButton` is a client island using `useState` — `renderToStaticMarkup` strips `onClick` but can test the initial render. A full client test would need `@testing-library/react` + jsdom mount. Given Phase 28's client surface is minimal (one button), and the ResearchCard (server component) already asserts the same aria-label pattern on the listing-side card CTA in listing-page.test.tsx, the it.todo is acceptable here per the user's "defer manual smoke walks" convention. The listing-card aria-label is already tested; the detail-page button shares the same aria-label template string.

Actually, we CAN test it — `renderToStaticMarkup` on the detail page renders the `DownloadButton` server-side initially. It emits a `<button>` with aria-label even though the onClick is stripped. Let's flip this to a real assert.

Replace the final it.todo with:

```typescript
  it('detail download button has aria-label matching /^Download .+ \\(.+\\)$/', async () => {
    const html = await detailHtml()
    // DownloadButton renders <button aria-label="Download {title} ({itemType})">
    expect(html).toMatch(/aria-label="Download [^"]+ \([^"]+\)"/)
  })
```

All 7 assertions now GREEN.
  </action>
  <verify>
    <automated>npx vitest run tests/phase-28/detail-page.test.tsx tests/phase-28/no-leak.test.ts tests/phase-28/accessibility.test.tsx --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/phase-28/detail-page.test.tsx` exits 0 with ≥ 12 passing tests
    - `npx vitest run tests/phase-28/no-leak.test.ts` exits 0 with ≥ 6 passing tests + ≤ 1 it.todo
    - `npx vitest run tests/phase-28/accessibility.test.tsx` exits 0 with ≥ 7 passing tests and 0 it.todo
    - `grep -c "it.todo" tests/phase-28/detail-page.test.tsx` returns 0
    - `grep -c "it.todo" tests/phase-28/accessibility.test.tsx` returns 0
    - `grep -c "it.todo" tests/phase-28/no-leak.test.ts` returns ≤ 1 (the listing-card HTML stub deferred to 28-04 since CTA is unchanged on that path)
    - Full phase-28 suite `npx vitest run tests/phase-28` exits 0 for everything except proxy-public-routes.test.ts + research-cta.test.tsx which remain RED (locked for Plan 28-04)
  </acceptance_criteria>
  <done>
    All Wave 0 detail/no-leak/accessibility stubs flipped GREEN. Only proxy-public-routes.test.ts and research-cta.test.tsx remain RED — both are Plan 28-04's responsibility.
  </done>
</task>

</tasks>

<verification>
Wave 3 detail surface verification:
- All 4 detail surface files exist (1 page + 3 components)
- TypeScript clean: `npx tsc --noEmit` shows 0 errors in app/research/items/[id]/
- Wave 0 detail-page.test.tsx flipped GREEN (12+ passing)
- Wave 0 no-leak.test.ts all HTML-level tests GREEN (5 new + 1 existing query-keys)
- Wave 0 accessibility.test.tsx 7/7 GREEN
- Full phase-28 suite: all GREEN except proxy + research-cta (both locked for 28-04)
- Zero feedback/createdBy/reviewedBy/contentHash leaks in rendered HTML (asserted by tests)
</verification>

<success_criteria>
- `/research/items/[id]` renders full metadata with no feedback/stakeholder leaks
- DOI hyperlink, peer-reviewed badge, linked sections/versions all per UI-SPEC
- DownloadButton navigates to /api/research/{id}/download
- UUID regex guard + notFound() branching matches portal pattern
- React.cache dedupes metadata + page fetches
- Wave 0 detail/no-leak/a11y tests are GREEN
</success_criteria>

<output>
After completion, create `.planning/phases/28-public-research-items-listing/28-03-SUMMARY.md` covering: 4 files shipped, UI-SPEC Surface B implemented, generate metadata + React.cache pattern, Wave 0 detail/no-leak/accessibility test count flipped GREEN, two remaining RED tests (proxy + CTA) handed off to Plan 28-04.
</output>
