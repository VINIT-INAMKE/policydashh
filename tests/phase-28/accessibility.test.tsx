import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * Phase 28 Wave 3 — accessibility contract for the public research surface (SC-7).
 *
 * Strategy: render each subject component directly rather than going through
 * the full listing page. Plan 28-02 established that renderToStaticMarkup
 * (sync renderer) bails on nested async server components with the React 19
 * "A component suspended" error. By rendering components in isolation here:
 *   - ResearchFilterPanel (async) is awaited at the test boundary, then
 *     statically rendered — yielding the From/To date input + Clear-filters
 *     link assertions.
 *   - ResearchPagination (sync) is rendered directly with a fixture — yielding
 *     the <nav aria-label="Research items pagination"> assertion.
 *   - ResearchCard (sync, URL-only fixture) — yielding the target=_blank +
 *     rel=noopener noreferrer assertion.
 *   - ResearchItemDetailPage (async) is awaited then rendered — yielding the
 *     Back-link aria-label + Download-button aria-label assertions.
 *
 * All async-DB dependencies are mocked at the @/src/db boundary so the panel's
 * policyDocuments fetch resolves to []. The detail page's research-public
 * helpers are mocked at the import boundary.
 */

const mockGetPublishedResearchItem = vi.fn()
const mockListLinkedSectionsForResearchItem = vi.fn()
const mockListLinkedVersionsForResearchItem = vi.fn()

const mockDbChain = {
  from: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockResolvedValue([]),
}

vi.mock('@/src/server/queries/research-public', async (orig) => {
  const original = await orig<typeof import('@/src/server/queries/research-public')>()
  return {
    ...original,
    getPublishedResearchItem: (...a: unknown[]) => mockGetPublishedResearchItem(...a),
    listLinkedSectionsForResearchItem: (...a: unknown[]) =>
      mockListLinkedSectionsForResearchItem(...a),
    listLinkedVersionsForResearchItem: (...a: unknown[]) =>
      mockListLinkedVersionsForResearchItem(...a),
  }
})

vi.mock('@/src/db', () => ({ db: { select: vi.fn(() => mockDbChain) } }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
  // ResearchTypeCheckboxes (client island consumed by ResearchFilterPanel) uses
  // usePathname / useRouter / useSearchParams. Stubbed for static render.
  usePathname: () => '/research/items',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

import { ResearchFilterPanel } from '@/app/research/items/_components/research-filter-panel'
import { ResearchPagination } from '@/app/research/items/_components/research-pagination'
import { ResearchCard } from '@/app/research/items/_components/research-card'
import ResearchItemDetailPage from '@/app/research/items/[id]/page'
import type { PublicResearchItem } from '@/src/server/queries/research-public'

const validId = '11111111-2222-3333-4444-555555555555'

const sampleItem: PublicResearchItem = {
  id: validId,
  readableId: 'RI-001',
  documentId: 'd1',
  title: 'Audit Study',
  itemType: 'report',
  description: 'Abstract.',
  externalUrl: null,
  artifactId: 'art-1',
  doi: null,
  authors: ['J. Doe'],
  publishedDate: '2026-01-01',
  peerReviewed: false,
  journalOrSource: null,
  versionLabel: null,
  previousVersionId: null,
  isAuthorAnonymous: false,
  retractionReason: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetPublishedResearchItem.mockResolvedValue(sampleItem)
  mockListLinkedSectionsForResearchItem.mockResolvedValue([])
  mockListLinkedVersionsForResearchItem.mockResolvedValue([])
  mockDbChain.orderBy.mockResolvedValue([])
})

async function renderFilterPanel(hasAnyFilter: boolean = false) {
  const el = await ResearchFilterPanel({
    documentId: undefined,
    from: undefined,
    to: undefined,
    sort: 'newest',
    hasAnyFilter,
  })
  return renderToStaticMarkup(el)
}

function renderPagination() {
  return renderToStaticMarkup(
    <ResearchPagination offset={0} total={50} searchParams={new URLSearchParams()} />,
  )
}

function renderCard(item: PublicResearchItem) {
  return renderToStaticMarkup(<ResearchCard item={item} />)
}

async function renderDetail() {
  const el = await ResearchItemDetailPage({
    params: Promise.resolve({ id: validId }),
  } as Parameters<typeof ResearchItemDetailPage>[0])
  return renderToStaticMarkup(el)
}

describe('/research/items accessibility — SC-7', () => {
  it('filter <input type="date"> for "from" has aria-label="From date"', async () => {
    const html = await renderFilterPanel()
    expect(html).toMatch(/aria-label="From date"/)
  })

  it('filter <input type="date"> for "to" has aria-label="To date"', async () => {
    const html = await renderFilterPanel()
    expect(html).toMatch(/aria-label="To date"/)
  })

  it('pagination <nav> wrapper has aria-label="Research items pagination"', () => {
    const html = renderPagination()
    expect(html).toContain('aria-label="Research items pagination"')
  })

  it('external-link CTA on URL-only items has target="_blank" AND rel="noopener noreferrer"', () => {
    const html = renderCard({
      ...sampleItem,
      artifactId: null,
      externalUrl: 'https://ext.example/x',
    })
    expect(html).toMatch(/href="https:\/\/ext\.example\/x"[^>]*target="_blank"/)
    expect(html).toMatch(/rel="noopener noreferrer"/)
  })

  it('Back link on detail page has aria-label="Back to all research items"', async () => {
    const html = await renderDetail()
    expect(html).toContain('aria-label="Back to all research items"')
  })

  it('clear-filters link has aria-label="Clear all filters" when a filter is active', async () => {
    const html = await renderFilterPanel(true)
    expect(html).toContain('aria-label="Clear all filters"')
  })

  it('detail download button has aria-label matching /^Download .+ \\(.+\\)$/', async () => {
    // DownloadButton renders <button aria-label="Download {title} ({itemType})">
    const html = await renderDetail()
    expect(html).toMatch(/aria-label="Download [^"]+ \([^"]+\)"/)
  })
})
