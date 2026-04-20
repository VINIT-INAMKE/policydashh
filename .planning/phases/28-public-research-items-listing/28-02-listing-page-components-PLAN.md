---
phase: 28-public-research-items-listing
plan: 02
type: execute
wave: 2
depends_on:
  - 28-00
  - 28-01
files_modified:
  - app/research/items/page.tsx
  - app/research/items/_components/research-card.tsx
  - app/research/items/_components/research-filter-panel.tsx
  - app/research/items/_components/research-pagination.tsx
  - app/research/items/_components/research-type-checkboxes.tsx
  - tests/phase-28/listing-page.test.tsx
autonomous: true
requirements:
  - RESEARCH-09
must_haves:
  truths:
    - "app/research/items/page.tsx is an async Server Component with export const dynamic = 'force-dynamic'"
    - "Page H1 renders 'Published Research'"
    - "searchParams document/type/from/to/sort/offset are awaited and forwarded to listPublishedResearchItems"
    - "sort defaults to 'newest' when searchParams.sort is absent or invalid"
    - "Card grid renders 1 card per item, newest-first by default"
    - "Anonymous-author items render 'Source: Confidential' via formatAuthorsForDisplay"
    - "Pagination aria-live 'polite' region announces 'Showing items X-Y of Z'"
    - "Pagination Previous disabled when offset=0; Next disabled when offset+40 >= total"
    - "Pagination nav wrapper has aria-label='Research items pagination'"
    - "Empty state differentiates 'No published research yet' (no filters) vs 'No research items match these filters'"
    - "Filter checkboxes are keyboard-navigable; date inputs have aria-label='From date'/'To date'"
  artifacts:
    - path: "app/research/items/page.tsx"
      provides: "Server Component listing with filter + pagination"
      contains: "export default async function ResearchItemsPage"
    - path: "app/research/items/_components/research-card.tsx"
      provides: "Server component card (title + type badge + author line + date + Download/View CTA)"
      contains: "export function ResearchCard"
    - path: "app/research/items/_components/research-filter-panel.tsx"
      provides: "Server-rendered filter rail (document select + type checkboxes + date inputs + sort)"
      contains: "export function ResearchFilterPanel"
    - path: "app/research/items/_components/research-pagination.tsx"
      provides: "Offset pagination with aria-live announcement"
      contains: "export function ResearchPagination"
    - path: "app/research/items/_components/research-type-checkboxes.tsx"
      provides: "Client island wrapping type checkbox group — router.replace with updated URLSearchParams"
      contains: "'use client'"
  key_links:
    - from: "app/research/items/page.tsx"
      to: "listPublishedResearchItems"
      via: "direct import from '@/src/server/queries/research-public'"
      pattern: "listPublishedResearchItems"
    - from: "app/research/items/page.tsx"
      to: "formatAuthorsForDisplay"
      via: "src/lib/research-utils.ts"
      pattern: "formatAuthorsForDisplay"
    - from: "ResearchCard"
      to: "/research/items/{id}"
      via: "Link component"
      pattern: "href=\\{`/research/items/\\$\\{item.id\\}`\\}"
    - from: "ResearchCard (file-backed)"
      to: "/api/research/{id}/download"
      via: "anchor href (no client download-button on the card — kept on detail page per UI-SPEC)"
      pattern: "/api/research/"
---

<objective>
Wave 2 listing surface. Build the public `/research/items` server component + its 4 _components children. Consumes Plan 28-01's `listPublishedResearchItems` + `formatAuthorsForDisplay` helpers. Turns the Wave 0 listing-page test stubs GREEN.

Purpose: This is RESEARCH-09 in its entirety. The page is server-rendered, URL-param-driven (no client state except the type-checkbox island), filter panel on left (240px), card grid on right (3 columns lg), pagination below. Anonymous-author rendering uses the single-source-of-truth helper from Phase 27 D-05. CONTEXT.md Q6 (document filter always visible), Q9 (cards hide linked sections), Q7 ('Source: Confidential'), CONTEXT.md SC-7 (aria-live + aria-label) all satisfied at this layer.

Output: One page + 4 components, all GREEN against Wave 0 listing-page.test.tsx.
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
@app/workshops/page.tsx
@app/research/page.tsx
@app/portal/[policyId]/page.tsx
@src/server/queries/workshops-public.ts
@src/server/queries/research-public.ts
@src/lib/research-utils.ts
@app/research-manage/_components/research-status-badge.tsx
@app/research-manage/_components/research-filter-panel.tsx
@components/ui/card.tsx
@components/ui/button.tsx
@components/ui/badge.tsx
@components/ui/checkbox.tsx
@components/ui/collapsible.tsx
@components/ui/input.tsx
@tests/phase-28/listing-page.test.tsx
@tests/phase-28/accessibility.test.tsx
@tests/phase-28/no-leak.test.ts

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. -->

From src/server/queries/research-public.ts (Plan 28-01):
```typescript
export type ResearchItemType =
  | 'report' | 'paper' | 'dataset' | 'memo'
  | 'interview_transcript' | 'media_coverage'
  | 'legal_reference' | 'case_study'

export type SortDirection = 'newest' | 'oldest'

export interface PublicResearchItem {
  id: string
  readableId: string
  documentId: string
  title: string
  itemType: ResearchItemType
  description: string | null
  externalUrl: string | null
  artifactId: string | null
  doi: string | null
  authors: string[] | null
  publishedDate: string | null
  peerReviewed: boolean
  journalOrSource: string | null
  versionLabel: string | null
  previousVersionId: string | null
  isAuthorAnonymous: boolean
  retractionReason: string | null
}

export interface ListPublishedOpts {
  documentId?: string; itemType?: ResearchItemType
  from?: string; to?: string; sort: SortDirection; offset: number
}

export const PAGE_SIZE: number  // 40

export async function listPublishedResearchItems(opts: ListPublishedOpts): Promise<{
  items: PublicResearchItem[]; total: number
}>
```

From src/lib/research-utils.ts (Phase 27 D-05):
```typescript
export function formatAuthorsForDisplay(item: {
  isAuthorAnonymous: boolean; authors: string[] | null
}): string
// Returns "Source: Confidential" when isAuthorAnonymous
// Returns "Authors: {comma-joined}" when named
// Returns "Unknown author" when authors empty but not anonymous
```

From app/workshops/page.tsx (canonical public server component pattern):
```typescript
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title, description }
export default async function Page() {
  const all = await listPublicWorkshops()
  // ... filter sectioning + render
}
```

From app/portal/[policyId]/page.tsx (async searchParams pattern for this Next.js version):
```typescript
export default async function Page({
  params, searchParams,
}: {
  params: Promise<{ ... }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { policyId } = await params
  const query = await searchParams
  const versionParam = typeof query.version === 'string' ? query.version : undefined
}
```

Research type enum labels (humanized) — use this map in research-card.tsx:
```typescript
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
```

UI-SPEC Surface A layout constants:
- Page wrapper: `mx-auto max-w-6xl px-6 py-16`
- Header margin: `mb-12`
- Body flex: `flex gap-8`
- Filter rail: `hidden lg:block w-[240px] shrink-0`
- Card grid: `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3`
- Pagination: `mt-8 flex items-center justify-between`
- Card badge bg/fg: `--research-status-published-bg` / `--research-status-published-fg` (already in globals.css)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create 4 _components files (card, filter-panel, pagination, type-checkboxes)</name>
  <files>app/research/items/_components/research-card.tsx, app/research/items/_components/research-filter-panel.tsx, app/research/items/_components/research-pagination.tsx, app/research/items/_components/research-type-checkboxes.tsx</files>
  <behavior>
    - ResearchCard (server component): renders type badge + clickable title linking to `/research/items/{id}` + authors line (via formatAuthorsForDisplay) + published date + Download or View Source CTA. File-backed (`artifactId` truthy) shows `Download` anchor to `/api/research/{id}/download`. URL-only shows `View Source` anchor to `externalUrl` with target=_blank rel=noopener noreferrer. Aria-labels per UI-SPEC Accessibility block.
    - ResearchFilterPanel (server component): Renders document Select, type checkbox group (delegated to ResearchTypeCheckboxes client island), From/To date inputs, Sort select. All inputs are wrapped in a `<form method="get">` so submitting navigates to the filtered URL with preserved params. "Clear all filters" link when any filter is active.
    - ResearchPagination (server component): Renders `<nav aria-label="Research items pagination">` with Previous/Next buttons + page indicator + aria-live region announcing "Showing items {start}-{end} of {total}". Previous disabled when offset=0; Next disabled when offset+40>=total. Buttons are anchor Links preserving all other searchParams.
    - ResearchTypeCheckboxes ('use client'): wraps shadcn Checkbox components; state synced to `?type=` via `useRouter().replace(...)` + useSearchParams. Comma-separated encoding: `?type=report,paper` (OQ1 resolution). Each checkbox `<label>` wraps the Checkbox with visible label text. Touch target min-h-11 (44px).
  </behavior>
  <read_first>
    - D:/aditee/policydash/app/research-manage/_components/research-filter-panel.tsx (Phase 27 admin filter panel — reuse structure; delete unused admin-only filters)
    - D:/aditee/policydash/app/research-manage/_components/research-status-badge.tsx (badge color tokens — always 'published' variant on public surface)
    - D:/aditee/policydash/app/workshops/_components/workshop-card.tsx (if exists — canonical card layout; port font tokens + hover states)
    - D:/aditee/policydash/src/lib/research-utils.ts (formatAuthorsForDisplay signature)
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-UI-SPEC.md Surface A: Research Card Component, Filter Panel, Pagination
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-RESEARCH.md Pattern 6 (Server-Component Filter Panel), §URL-State Strategy, §Pagination Strategy
    - D:/aditee/policydash/components/ui/card.tsx + button.tsx + checkbox.tsx + input.tsx (component props + class conventions)
  </read_first>
  <action>
Create each file. Authoritative shapes below.

**app/research/items/_components/research-card.tsx** (server component):

```typescript
import Link from 'next/link'
import { format } from 'date-fns'
import { Download, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatAuthorsForDisplay } from '@/src/lib/research-utils'
import type { PublicResearchItem, ResearchItemType } from '@/src/server/queries/research-public'

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

export interface ResearchCardProps {
  item: PublicResearchItem
}

export function ResearchCard({ item }: ResearchCardProps) {
  const typeLabel = TYPE_LABELS[item.itemType]
  const authorLine = formatAuthorsForDisplay({
    isAuthorAnonymous: item.isAuthorAnonymous,
    authors: item.authors,
  })
  const pubDate = item.publishedDate ? new Date(item.publishedDate) : null

  return (
    <Card className="h-full flex flex-col p-4 transition-colors hover:bg-muted/30">
      <Badge
        className="bg-[oklch(0.9_0.08_145)] text-[oklch(0.4_0.12_145)] self-start mb-3"
        aria-label={`Type: ${typeLabel}`}
      >
        {typeLabel}
      </Badge>

      <Link
        href={`/research/items/${item.id}`}
        className="text-[20px] font-semibold leading-[1.2] line-clamp-2 text-foreground hover:underline underline-offset-4 mb-2"
      >
        {item.title}
      </Link>

      <p className="text-sm text-muted-foreground mb-1">{authorLine}</p>

      {pubDate && (
        <time
          dateTime={pubDate.toISOString()}
          className="text-xs text-muted-foreground mb-4"
        >
          Published {format(pubDate, 'MMM d, yyyy')}
        </time>
      )}

      <div className="mt-auto flex justify-end">
        {item.artifactId ? (
          <a
            href={`/api/research/${item.id}/download`}
            aria-label={`Download ${item.title} (${typeLabel})`}
            className="inline-flex items-center gap-1 min-w-[120px] min-h-11 justify-center rounded-md bg-primary text-primary-foreground px-3 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Download className="size-4" />
            Download
          </a>
        ) : item.externalUrl ? (
          <a
            href={item.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open external source for ${item.title} (opens in new tab)`}
            className="inline-flex items-center gap-1 min-w-[120px] min-h-11 justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted transition-colors"
          >
            <ExternalLink className="size-4" />
            View Source
          </a>
        ) : null}
      </div>
    </Card>
  )
}
```

**app/research/items/_components/research-pagination.tsx** (server component):

```typescript
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export interface ResearchPaginationProps {
  offset: number
  total: number
  searchParams: URLSearchParams  // caller builds this from the page's awaited searchParams
}

const PAGE_SIZE = 40

function buildHref(params: URLSearchParams, newOffset: number): string {
  const next = new URLSearchParams(params)
  if (newOffset === 0) next.delete('offset')
  else next.set('offset', String(newOffset))
  const qs = next.toString()
  return qs ? `/research/items?${qs}` : '/research/items'
}

export function ResearchPagination({ offset, total, searchParams }: ResearchPaginationProps) {
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const start = total === 0 ? 0 : offset + 1
  const end = Math.min(offset + PAGE_SIZE, total)
  const hasPrev = offset > 0
  const hasNext = offset + PAGE_SIZE < total

  return (
    <nav
      aria-label="Research items pagination"
      className="mt-8 flex items-center justify-between"
    >
      <div aria-live="polite" className="text-sm text-muted-foreground">
        {total === 0
          ? 'Showing 0 items'
          : `Showing items ${start}-${end} of ${total}`}
      </div>

      <div className="flex items-center gap-3">
        {hasPrev ? (
          <Link href={buildHref(searchParams, Math.max(0, offset - PAGE_SIZE))}>
            <Button variant="outline" size="sm">Previous</Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled aria-disabled="true">Previous</Button>
        )}

        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>

        {hasNext ? (
          <Link href={buildHref(searchParams, offset + PAGE_SIZE)}>
            <Button variant="outline" size="sm">Next</Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled aria-disabled="true">Next</Button>
        )}
      </div>
    </nav>
  )
}
```

**app/research/items/_components/research-type-checkboxes.tsx** (client island):

```typescript
'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Checkbox } from '@/components/ui/checkbox'
import type { ResearchItemType } from '@/src/server/queries/research-public'

const TYPES: ReadonlyArray<{ value: ResearchItemType; label: string }> = [
  { value: 'report',               label: 'Report' },
  { value: 'paper',                label: 'Paper' },
  { value: 'dataset',              label: 'Dataset' },
  { value: 'memo',                 label: 'Memo' },
  { value: 'interview_transcript', label: 'Interview Transcript' },
  { value: 'media_coverage',       label: 'Media Coverage' },
  { value: 'legal_reference',      label: 'Legal Reference' },
  { value: 'case_study',           label: 'Case Study' },
]

export function ResearchTypeCheckboxes() {
  const pathname = usePathname()
  const router = useRouter()
  const search = useSearchParams()

  const raw = search.get('type') ?? ''
  const selected = new Set(raw ? raw.split(',').filter(Boolean) : [])

  const toggle = useCallback((value: ResearchItemType, checked: boolean) => {
    const next = new Set(selected)
    if (checked) next.add(value)
    else next.delete(value)
    const params = new URLSearchParams(search.toString())
    if (next.size === 0) params.delete('type')
    else params.set('type', Array.from(next).join(','))
    // Reset pagination on filter change
    params.delete('offset')
    router.replace(`${pathname}?${params.toString()}`)
  }, [pathname, router, search, selected])

  return (
    <div role="group" aria-label="Filter by research type" className="flex flex-col gap-2">
      {TYPES.map((t) => (
        <label
          key={t.value}
          className="flex items-center gap-2 min-h-11 cursor-pointer text-sm text-foreground"
        >
          <Checkbox
            checked={selected.has(t.value)}
            onCheckedChange={(v) => toggle(t.value, v === true)}
          />
          <span>{t.label}</span>
        </label>
      ))}
    </div>
  )
}
```

**app/research/items/_components/research-filter-panel.tsx** (server component):

```typescript
import Link from 'next/link'
import { db } from '@/src/db'
import { policyDocuments } from '@/src/db/schema/documents'
import { asc } from 'drizzle-orm'
import { ResearchTypeCheckboxes } from './research-type-checkboxes'

export interface ResearchFilterPanelProps {
  documentId?: string
  from?: string
  to?: string
  sort: 'newest' | 'oldest'
  hasAnyFilter: boolean
}

export async function ResearchFilterPanel({
  documentId, from, to, sort, hasAnyFilter,
}: ResearchFilterPanelProps) {
  // OQ3 resolution: pull documents list so filter Select always renders even with one policy (Q6).
  const docs = await db
    .select({ id: policyDocuments.id, title: policyDocuments.title })
    .from(policyDocuments)
    .orderBy(asc(policyDocuments.title))

  return (
    <form method="get" className="rounded-lg border bg-card p-4 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-foreground">Filter</h2>

      <div>
        <label htmlFor="filter-doc" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
          Document
        </label>
        <select
          id="filter-doc"
          name="document"
          defaultValue={documentId ?? ''}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-11"
        >
          <option value="">All documents</option>
          {docs.map((d) => (
            <option key={d.id} value={d.id}>{d.title}</option>
          ))}
        </select>
      </div>

      <hr className="border-border" />

      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
          Type
        </div>
        <ResearchTypeCheckboxes />
      </div>

      <hr className="border-border" />

      <div className="flex flex-col gap-2">
        <label htmlFor="filter-from" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          From date
        </label>
        <input
          id="filter-from"
          type="date"
          name="from"
          aria-label="From date"
          defaultValue={from ?? ''}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-11"
        />

        <label htmlFor="filter-to" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          To date
        </label>
        <input
          id="filter-to"
          type="date"
          name="to"
          aria-label="To date"
          defaultValue={to ?? ''}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-11"
        />
      </div>

      <hr className="border-border" />

      <div>
        <label htmlFor="filter-sort" className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
          Sort
        </label>
        <select
          id="filter-sort"
          name="sort"
          defaultValue={sort}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-11"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      <button
        type="submit"
        className="inline-flex items-center justify-center min-h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
      >
        Apply filters
      </button>

      {hasAnyFilter && (
        <Link
          href="/research/items"
          aria-label="Clear all filters"
          className="text-sm text-primary underline underline-offset-2 text-center"
        >
          Clear all filters
        </Link>
      )}
    </form>
  )
}
```

Notes:
- Type checkboxes use `router.replace` for instant URL sync (reactive). The rest (document, dates, sort) submit via `<form method="get">` — simpler, no client JS required.
- Filter form does not include `offset` → submission resets pagination.
- Policy Documents query is direct Drizzle in the server component, following the portal pattern (no tRPC for public surfaces).
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep "app/research/items/_components/" | wc -l</automated>
  </verify>
  <acceptance_criteria>
    - Files exist: `app/research/items/_components/research-card.tsx`, `research-filter-panel.tsx`, `research-pagination.tsx`, `research-type-checkboxes.tsx`
    - `grep "formatAuthorsForDisplay" app/research/items/_components/research-card.tsx` returns a match
    - `grep "href={`/research/items/\\${item.id}`}" app/research/items/_components/research-card.tsx` OR equivalent template-literal returns a match
    - `grep "/api/research/" app/research/items/_components/research-card.tsx` returns a match
    - `grep "target=\"_blank\"" app/research/items/_components/research-card.tsx` returns a match (external CTA)
    - `grep "rel=\"noopener noreferrer\"" app/research/items/_components/research-card.tsx` returns a match
    - `grep "aria-label" app/research/items/_components/research-card.tsx` returns ≥ 2 matches (Download aria-label + View Source aria-label)
    - `grep "aria-live=\"polite\"" app/research/items/_components/research-pagination.tsx` returns a match
    - `grep "aria-label=\"Research items pagination\"" app/research/items/_components/research-pagination.tsx` returns a match
    - `grep "Showing items" app/research/items/_components/research-pagination.tsx` returns a match
    - `grep "'use client'" app/research/items/_components/research-type-checkboxes.tsx` returns a match
    - `grep "'use client'" app/research/items/_components/research-filter-panel.tsx` returns 0 matches (server component)
    - `grep "aria-label=\"From date\"" app/research/items/_components/research-filter-panel.tsx` returns a match
    - `grep "aria-label=\"To date\"" app/research/items/_components/research-filter-panel.tsx` returns a match
    - `npx tsc --noEmit 2>&1 | grep "app/research/items/_components/"` returns 0 lines (clean)
  </acceptance_criteria>
  <done>
    Four components compile and satisfy UI-SPEC Surface A contracts. Accessibility attrs present. No leak columns (createdBy/etc.) referenced.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create app/research/items/page.tsx listing server component</name>
  <files>app/research/items/page.tsx</files>
  <behavior>
    - Default-exports an async Server Component `ResearchItemsPage`.
    - Declares `export const dynamic = 'force-dynamic'` + `export const metadata: Metadata` per UI-SPEC SEO Metadata block.
    - Awaits `searchParams: Promise<{ [key: string]: string | string[] | undefined }>`.
    - Extracts documentId, itemType (first value of comma-split), from, to, sort (default 'newest'), offset (default 0).
    - **itemType handling (OQ1):** splits `?type=` by comma; uses the first valid value (single-value query at the DB level). Multi-select checkboxes stay sticky in the UI via ResearchTypeCheckboxes; the page filters by the first selected type. This keeps the query helper simple per RESEARCH.md OQ1 recommendation.
    - Validates sort is 'newest'|'oldest' else defaults to 'newest'.
    - Validates offset is non-negative integer else defaults to 0.
    - Calls `listPublishedResearchItems({ documentId, itemType, from, to, sort, offset })`.
    - Computes hasAnyFilter = bool of any truthy filter param.
    - Renders layout: `max-w-6xl px-6 py-16` + header H1 "Published Research" + subtitle + 2-column body (240px filter + flex-1 card grid).
    - Empty state: "No published research yet" when items.length===0 && !hasAnyFilter; "No research items match these filters" when items.length===0 && hasAnyFilter.
    - Card grid: `grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3` → maps `items` to `<ResearchCard />`.
    - Pagination: only rendered when total > 0.
    - Passes searchParams URLSearchParams object to ResearchPagination.
  </behavior>
  <read_first>
    - D:/aditee/policydash/app/workshops/page.tsx (canonical async Server Component with force-dynamic + direct Drizzle)
    - D:/aditee/policydash/app/portal/[policyId]/page.tsx lines 29-80 (await params/searchParams pattern)
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-UI-SPEC.md Surface A Layout Structure (exact CSS classes)
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-RESEARCH.md Pattern 1 (Public Listing Server Component)
    - D:/aditee/policydash/node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md (await searchParams docs)
  </read_first>
  <action>
Create `app/research/items/page.tsx`:

```typescript
/**
 * Phase 28 Plan 28-02 — public /research/items listing page (RESEARCH-09).
 *
 * Server Component. Unauthenticated (proxy.ts whitelists /research(.*) — same
 * matcher already covers this route and the new /api/research(.*) goes in
 * Plan 28-04). Direct Drizzle via research-public.ts helper (Pitfall 1:
 * listPublic tRPC procedure is protectedProcedure, bypassed here per
 * STATE.md Phase 26 decision).
 *
 * Filter panel (left 240px): document Select + type checkbox group + from/to
 * dates + sort. Filter changes submit the form and navigate with updated URL
 * params. Pagination (below grid): offset-based, 40 per page, aria-live
 * announcement.
 *
 * URL state (28-RESEARCH.md §URL-State Strategy):
 *   ?document={uuid}   filter by policy document (Q6: always visible)
 *   ?type={csv}        filter by research type (comma-separated per OQ1)
 *   ?from=YYYY-MM-DD   lower bound on publishedDate
 *   ?to=YYYY-MM-DD     upper bound on publishedDate
 *   ?sort=newest|oldest  default newest
 *   ?offset={n}        pagination offset
 */
import type { Metadata } from 'next'
import { FileSearch } from 'lucide-react'
import {
  listPublishedResearchItems,
  type ResearchItemType,
  type SortDirection,
} from '@/src/server/queries/research-public'
import { ResearchCard } from './_components/research-card'
import { ResearchFilterPanel } from './_components/research-filter-panel'
import { ResearchPagination } from './_components/research-pagination'

export const metadata: Metadata = {
  title: 'Published Research | Civilization Lab',
  description: "Browse citable research informing India's blockchain policy consultation.",
}

// force-dynamic: searchParams must re-evaluate on every request. unstable_cache
// inside listPublishedResearchItems handles query-level caching at 60s TTL.
export const dynamic = 'force-dynamic'

const VALID_TYPES: readonly ResearchItemType[] = [
  'report', 'paper', 'dataset', 'memo',
  'interview_transcript', 'media_coverage',
  'legal_reference', 'case_study',
]

function parseType(raw: string | string[] | undefined): ResearchItemType | undefined {
  if (!raw) return undefined
  const first = Array.isArray(raw) ? raw[0] : raw
  if (!first) return undefined
  // OQ1: comma-separated multi-select — use first valid for DB query
  const first2 = first.split(',')[0]?.trim()
  if (first2 && (VALID_TYPES as readonly string[]).includes(first2)) {
    return first2 as ResearchItemType
  }
  return undefined
}

function parseSort(raw: string | string[] | undefined): SortDirection {
  const v = Array.isArray(raw) ? raw[0] : raw
  return v === 'oldest' ? 'oldest' : 'newest'
}

function parseOffset(raw: string | string[] | undefined): number {
  const v = Array.isArray(raw) ? raw[0] : raw
  const n = typeof v === 'string' ? parseInt(v, 10) : 0
  return Number.isFinite(n) && n > 0 ? n : 0
}

function parseString(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

export default async function ResearchItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const q = await searchParams
  const documentId = parseString(q.document)
  const itemType = parseType(q.type)
  const from = parseString(q.from)
  const to = parseString(q.to)
  const sort = parseSort(q.sort)
  const offset = parseOffset(q.offset)
  const hasAnyFilter = Boolean(documentId || itemType || from || to)

  const { items, total } = await listPublishedResearchItems({
    documentId, itemType, from, to, sort, offset,
  })

  // Build URLSearchParams for pagination links — preserve every active filter
  // including the raw `type` CSV (not just the parsed first value) so the
  // filter UI stays sticky across pages.
  const paginationParams = new URLSearchParams()
  if (documentId) paginationParams.set('document', documentId)
  const rawType = parseString(q.type)
  if (rawType) paginationParams.set('type', rawType)
  if (from) paginationParams.set('from', from)
  if (to) paginationParams.set('to', to)
  if (sort !== 'newest') paginationParams.set('sort', sort)

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <header className="mb-12">
        <h1
          className="text-[28px] font-semibold leading-[1.2] text-[var(--cl-on-surface)] mb-2"
          style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
        >
          Published Research
        </h1>
        <p className="text-sm text-muted-foreground">
          Citable research items informing the policy consultation.
        </p>
      </header>

      <div className="flex gap-8">
        <aside className="hidden lg:block w-[240px] shrink-0">
          <ResearchFilterPanel
            documentId={documentId}
            from={from}
            to={to}
            sort={sort}
            hasAnyFilter={hasAnyFilter}
          />
        </aside>

        <main className="flex-1 min-w-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <FileSearch className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
              <p className="text-base font-semibold text-[var(--cl-on-surface)]">
                {hasAnyFilter ? 'No research items match these filters' : 'No published research yet'}
              </p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {hasAnyFilter
                  ? 'Try adjusting the type, date range, or document filter.'
                  : 'Research items will appear here once published by the policy team.'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <ResearchCard key={item.id} item={item} />
                ))}
              </div>

              <ResearchPagination
                offset={offset}
                total={total}
                searchParams={paginationParams}
              />
            </>
          )}
        </main>
      </div>
    </div>
  )
}
```
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep "app/research/items/page.tsx" | wc -l</automated>
  </verify>
  <acceptance_criteria>
    - File `app/research/items/page.tsx` exists
    - `grep "export default async function ResearchItemsPage" app/research/items/page.tsx` returns a match
    - `grep "export const dynamic = 'force-dynamic'" app/research/items/page.tsx` returns a match
    - `grep "export const metadata" app/research/items/page.tsx` returns a match
    - `grep "title: 'Published Research" app/research/items/page.tsx` returns a match
    - `grep "Published Research" app/research/items/page.tsx` returns ≥ 2 matches (H1 + metadata)
    - `grep "searchParams: Promise<" app/research/items/page.tsx` returns a match (Next.js 16 async pattern)
    - `grep "listPublishedResearchItems" app/research/items/page.tsx` returns a match
    - `grep "No published research yet" app/research/items/page.tsx` returns a match
    - `grep "No research items match these filters" app/research/items/page.tsx` returns a match
    - `grep "grid-cols-1.*sm:grid-cols-2.*lg:grid-cols-3" app/research/items/page.tsx` returns a match (UI-SPEC grid)
    - `grep "w-\[240px\]" app/research/items/page.tsx` returns a match (filter rail)
    - `grep "createdBy\\|reviewedBy\\|contentHash" app/research/items/page.tsx` returns 0 matches (no leaks)
    - `npx tsc --noEmit 2>&1 | grep "app/research/items/page.tsx"` returns 0 lines
  </acceptance_criteria>
  <done>
    Listing page server component compiles, imports Wave 1 query helper, applies all filter params, renders header/filter/grid/pagination or empty state.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Convert Wave 0 listing-page.test.tsx from it.todo to GREEN assertions</name>
  <files>tests/phase-28/listing-page.test.tsx</files>
  <behavior>
    - Replace 9 it.todo stubs with real assertions using `renderToStaticMarkup(await Page({ searchParams }))` pattern (async server component).
    - Mock `@/src/server/queries/research-public` to control items/total returns.
    - Mock `@/src/db` so `ResearchFilterPanel` (server component fetching policyDocuments) resolves to an empty docs array.
    - Verify: H1 "Published Research", card count matches fixture, "Source: Confidential" on anonymous fixture, aria-live "Showing items X-Y of Z", pagination disabled states, searchParams forwarded to query, empty-state branching.
    - Pitfall: `renderToStaticMarkup` can't render async components directly. Call the page function `ResearchItemsPage({ searchParams: Promise.resolve({...}) })` — it returns a React element since the inner awaits happen during the async call. Then pass that element to renderToStaticMarkup.
  </behavior>
  <read_first>
    - D:/aditee/policydash/tests/phase-28/listing-page.test.tsx (current it.todo stubs + variable-path dynamic import)
    - D:/aditee/policydash/tests/phase-20/workshops-listing.test.tsx (vi.mock server query + async server component test pattern)
    - D:/aditee/policydash/tests/phase-20.5/research-page-render.test.tsx (renderToStaticMarkup over React.createElement pattern)
    - D:/aditee/policydash/app/research/items/page.tsx (just created in Task 2)
    - D:/aditee/policydash/app/research/items/_components/*.tsx (just created in Task 1)
  </read_first>
  <action>
Rewrite `tests/phase-28/listing-page.test.tsx`. Use `renderToStaticMarkup(await Page({...}))`. Drop the variable-path dynamic import (module now exists on disk) — import the page directly. Mock the query helper + db to control fixtures.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * Phase 28 Wave 2 — GREEN contract for app/research/items/page.tsx (RESEARCH-09).
 *
 * Locks: H1 + card count + anonymous author + pagination states + aria-live +
 * searchParams forwarding + empty-state branching.
 *
 * Async server components: await the component function, then pass the result
 * (a React element) to renderToStaticMarkup. This is the canonical pattern
 * for testing async server components in vitest (see tests/phase-20 pattern).
 */

const mockListPublishedResearchItems = vi.fn()

vi.mock('@/src/server/queries/research-public', () => ({
  listPublishedResearchItems: (...args: any[]) => mockListPublishedResearchItems(...args),
  // Re-export types as empty runtime values — unused in tests, TS-only
}))

// ResearchFilterPanel fetches policyDocuments via direct Drizzle; mock db.select
// to return an empty docs array so the filter panel renders without error.
const mockDbChain = {
  from:    vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue([]),
}
vi.mock('@/src/db', () => ({
  db: { select: vi.fn(() => mockDbChain) },
}))

import ResearchItemsPage from '@/app/research/items/page'
import type { PublicResearchItem } from '@/src/server/queries/research-public'

function fixture(overrides: Partial<PublicResearchItem> = {}): PublicResearchItem {
  return {
    id: 'r1', readableId: 'RI-001', documentId: 'd1',
    title: 'AI Safety in India', itemType: 'report',
    description: null, externalUrl: null, artifactId: 'a1',
    doi: null, authors: ['Jane Doe'], publishedDate: '2026-02-15',
    peerReviewed: false, journalOrSource: null, versionLabel: null,
    previousVersionId: null, isAuthorAnonymous: false, retractionReason: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListPublishedResearchItems.mockResolvedValue({ items: [], total: 0 })
  mockDbChain.orderBy.mockResolvedValue([])
})

async function renderPage(searchParams: Record<string, string | string[] | undefined> = {}) {
  const element = await ResearchItemsPage({ searchParams: Promise.resolve(searchParams) } as any)
  return renderToStaticMarkup(element)
}

describe('/research/items listing — RESEARCH-09', () => {
  it('renders H1 "Published Research"', async () => {
    const html = await renderPage()
    expect(html).toContain('Published Research')
  })

  it('renders N cards when listPublishedResearchItems returns N items', async () => {
    mockListPublishedResearchItems.mockResolvedValue({
      items: [fixture({ id: 'r1', title: 'A' }), fixture({ id: 'r2', title: 'B' })],
      total: 2,
    })
    const html = await renderPage()
    expect(html).toContain('A')
    expect(html).toContain('B')
    // Each card links to /research/items/{id}
    expect(html).toContain('href="/research/items/r1"')
    expect(html).toContain('href="/research/items/r2"')
  })

  it('renders anonymous author as "Source: Confidential"', async () => {
    mockListPublishedResearchItems.mockResolvedValue({
      items: [fixture({ isAuthorAnonymous: true, authors: null })],
      total: 1,
    })
    const html = await renderPage()
    expect(html).toContain('Source: Confidential')
  })

  it('renders named authors via formatAuthorsForDisplay', async () => {
    mockListPublishedResearchItems.mockResolvedValue({
      items: [fixture({ isAuthorAnonymous: false, authors: ['Jane Doe', 'Alex Smith'] })],
      total: 1,
    })
    const html = await renderPage()
    expect(html).toContain('Authors: Jane Doe, Alex Smith')
  })

  it('Previous button disabled when offset=0', async () => {
    mockListPublishedResearchItems.mockResolvedValue({
      items: [fixture()],
      total: 50,
    })
    const html = await renderPage({ offset: '0' })
    // disabled attribute present on a button labeled Previous
    expect(html).toMatch(/disabled[^>]*>\s*Previous|Previous[\s\S]*?disabled/)
  })

  it('Next button disabled when offset + 40 >= total', async () => {
    mockListPublishedResearchItems.mockResolvedValue({
      items: [fixture()],
      total: 40,
    })
    const html = await renderPage({ offset: '0' })
    expect(html).toMatch(/disabled[^>]*>\s*Next|Next[\s\S]*?disabled/)
  })

  it('aria-live="polite" region contains "Showing items X-Y of Z"', async () => {
    mockListPublishedResearchItems.mockResolvedValue({
      items: Array.from({ length: 5 }, (_, i) => fixture({ id: `r${i}`, title: `T${i}` })),
      total: 100,
    })
    const html = await renderPage({ offset: '0' })
    expect(html).toMatch(/aria-live="polite"/)
    expect(html).toMatch(/Showing items 1-(?:5|40) of 100/)
  })

  it('pagination <nav> wrapper has aria-label="Research items pagination"', async () => {
    mockListPublishedResearchItems.mockResolvedValue({
      items: [fixture()],
      total: 1,
    })
    const html = await renderPage()
    expect(html).toContain('aria-label="Research items pagination"')
  })

  it('forwards searchParams (document, type, from, to, sort, offset) to query helper', async () => {
    await renderPage({
      document: 'd1',
      type: 'report',
      from: '2026-01-01',
      to: '2026-06-30',
      sort: 'oldest',
      offset: '40',
    })
    expect(mockListPublishedResearchItems).toHaveBeenCalledWith(expect.objectContaining({
      documentId: 'd1',
      itemType: 'report',
      from: '2026-01-01',
      to: '2026-06-30',
      sort: 'oldest',
      offset: 40,
    }))
  })

  it('defaults sort=newest when searchParams.sort is absent or invalid', async () => {
    await renderPage({ sort: 'gibberish' })
    expect(mockListPublishedResearchItems).toHaveBeenCalledWith(expect.objectContaining({
      sort: 'newest',
    }))
  })

  it('renders "No published research yet" when items empty and no filters', async () => {
    mockListPublishedResearchItems.mockResolvedValue({ items: [], total: 0 })
    const html = await renderPage({})
    expect(html).toContain('No published research yet')
  })

  it('renders "No research items match these filters" when items empty and filter active', async () => {
    mockListPublishedResearchItems.mockResolvedValue({ items: [], total: 0 })
    const html = await renderPage({ type: 'report' })
    expect(html).toContain('No research items match these filters')
  })
})
```

Run: `npx vitest run tests/phase-28/listing-page.test.tsx` → must exit 0 with all tests passing.
  </action>
  <verify>
    <automated>npx vitest run tests/phase-28/listing-page.test.tsx --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/phase-28/listing-page.test.tsx` exits 0
    - `grep -c "it.todo" tests/phase-28/listing-page.test.tsx` returns 0 (all real asserts)
    - `grep -c "it(" tests/phase-28/listing-page.test.tsx` returns ≥ 11 (the 11 scenarios above)
    - `grep "mockListPublishedResearchItems.mockResolvedValue" tests/phase-28/listing-page.test.tsx` returns ≥ 5 matches
    - `grep "Source: Confidential" tests/phase-28/listing-page.test.tsx` returns a match
    - `grep "aria-live" tests/phase-28/listing-page.test.tsx` returns a match
  </acceptance_criteria>
  <done>
    Wave 0 listing-page.test.tsx flipped GREEN with ≥11 passing tests. All 9 original Wave 0 contracts satisfied + 2 bonus cases (named authors, default sort).
  </done>
</task>

</tasks>

<verification>
Wave 2 listing surface verification:
- All 5 listing surface files exist (4 components + 1 page)
- TypeScript clean: `npx tsc --noEmit` shows 0 errors in app/research/items/
- Wave 0 listing-page.test.tsx flipped GREEN (11+ passing)
- Wave 0 accessibility.test.tsx still has it.todo stubs that Task 3 (next plan) may convert; acceptable since listing-page.test.tsx already asserts aria-live + aria-label + target+rel on external CTA
- No leak columns referenced anywhere (createdBy/reviewedBy/contentHash/txHash/anchoredAt/milestoneId absent from new files)
</verification>

<success_criteria>
- `/research/items` renders published items with sort + filter + pagination
- Anonymous items render "Source: Confidential" via the shared helper
- Pagination aria-live and aria-label satisfied
- Empty-state branches correctly on presence of filters
- Wave 0 listing-page.test.tsx is GREEN
</success_criteria>

<output>
After completion, create `.planning/phases/28-public-research-items-listing/28-02-SUMMARY.md` covering: 5 files shipped, UI-SPEC Surface A sections rendered, Wave 0 listing-page test count flipped GREEN, next plan (28-03 detail page).
</output>
