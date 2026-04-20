/**
 * Phase 28 Plan 28-02 — public /research/items listing page (RESEARCH-09).
 *
 * Server Component. Unauthenticated (proxy.ts whitelists /research(.*) — same
 * matcher already covers this route. The new /api/research(.*) goes in
 * Plan 28-04). Direct Drizzle via research-public.ts helper (Pitfall 1:
 * the listPublic tRPC procedure is protectedProcedure, bypassed here per
 * STATE.md Phase 26 decision).
 *
 * Filter panel (left 240px): document Select + type checkbox group + from/to
 * dates + sort. Filter changes submit the form and navigate with updated URL
 * params. Pagination (below grid): offset-based, 40 per page, aria-live
 * announcement.
 *
 * URL state (28-RESEARCH.md §URL-State Strategy):
 *   ?document={uuid}     filter by policy document (Q6: always visible)
 *   ?type={csv}          filter by research type (comma-separated per OQ1)
 *   ?from=YYYY-MM-DD     lower bound on publishedDate
 *   ?to=YYYY-MM-DD       upper bound on publishedDate
 *   ?sort=newest|oldest  default 'newest'
 *   ?offset={n}          pagination offset
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
  description:
    "Browse citable research informing India's blockchain policy consultation.",
}

// force-dynamic: searchParams must re-evaluate on every request. unstable_cache
// inside listPublishedResearchItems handles query-level caching at 60s TTL.
export const dynamic = 'force-dynamic'

const VALID_TYPES: readonly ResearchItemType[] = [
  'report',
  'paper',
  'dataset',
  'memo',
  'interview_transcript',
  'media_coverage',
  'legal_reference',
  'case_study',
]

function parseType(raw: string | string[] | undefined): ResearchItemType | undefined {
  if (!raw) return undefined
  const first = Array.isArray(raw) ? raw[0] : raw
  if (!first) return undefined
  // OQ1: comma-separated multi-select — use first valid value for DB query.
  const candidate = first.split(',')[0]?.trim()
  if (candidate && (VALID_TYPES as readonly string[]).includes(candidate)) {
    return candidate as ResearchItemType
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
    documentId,
    itemType,
    from,
    to,
    sort,
    offset,
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
              <FileSearch
                className="h-10 w-10 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-base font-semibold text-[var(--cl-on-surface)]">
                {hasAnyFilter
                  ? 'No research items match these filters'
                  : 'No published research yet'}
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
