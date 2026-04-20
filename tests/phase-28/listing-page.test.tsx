import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * Phase 28 Wave 2 — GREEN contract for app/research/items/page.tsx (RESEARCH-09).
 *
 * Locks: H1 + card count + anonymous author + pagination states + aria-live +
 * searchParams forwarding + empty-state branching + default sort.
 *
 * Async server components: await the component function, then pass the
 * resulting React element to renderToStaticMarkup. This is the canonical
 * pattern for testing async server components in vitest (Phase 20 precedent).
 */

const mockListPublishedResearchItems = vi.fn()

vi.mock('@/src/server/queries/research-public', () => ({
  listPublishedResearchItems: (...args: unknown[]) => mockListPublishedResearchItems(...args),
  // Type-only re-exports erase at compile time; runtime test never imports the types.
}))

// ResearchFilterPanel is itself an async Server Component (it fetches
// policyDocuments via direct Drizzle). renderToStaticMarkup is synchronous
// and cannot resolve async components — so we replace the panel with a
// trivial sync stub. The listing-page contract under test does not
// depend on the panel's internal markup; it only owns the page-level
// composition (header, grid, pagination, empty states).
vi.mock('@/app/research/items/_components/research-filter-panel', () => ({
  ResearchFilterPanel: () => null,
}))

import ResearchItemsPage from '@/app/research/items/page'
import type { PublicResearchItem } from '@/src/server/queries/research-public'

function fixture(overrides: Partial<PublicResearchItem> = {}): PublicResearchItem {
  return {
    id: 'r1',
    readableId: 'RI-001',
    documentId: 'd1',
    title: 'AI Safety in India',
    itemType: 'report',
    description: null,
    externalUrl: null,
    artifactId: 'a1',
    doi: null,
    authors: ['Jane Doe'],
    publishedDate: '2026-02-15',
    peerReviewed: false,
    journalOrSource: null,
    versionLabel: null,
    previousVersionId: null,
    isAuthorAnonymous: false,
    retractionReason: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListPublishedResearchItems.mockResolvedValue({ items: [], total: 0 })
})

async function renderPage(
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  // ResearchItemsPage is an async Server Component — await it to resolve any
  // inner awaits, then render the returned React element synchronously.
  const element = await ResearchItemsPage({
    searchParams: Promise.resolve(searchParams),
  } as Parameters<typeof ResearchItemsPage>[0])
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
    expect(html).toContain('>A<')
    expect(html).toContain('>B<')
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
    // disabled attribute present near "Previous"
    expect(html).toMatch(/disabled[^>]*>\s*Previous|Previous[\s\S]{0,500}?disabled/)
  })

  it('Next button disabled when offset + 40 >= total', async () => {
    mockListPublishedResearchItems.mockResolvedValue({
      items: [fixture()],
      total: 40,
    })
    const html = await renderPage({ offset: '0' })
    expect(html).toMatch(/disabled[^>]*>\s*Next|Next[\s\S]{0,500}?disabled/)
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
    expect(mockListPublishedResearchItems).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'd1',
        itemType: 'report',
        from: '2026-01-01',
        to: '2026-06-30',
        sort: 'oldest',
        offset: 40,
      }),
    )
  })

  it('defaults sort=newest when searchParams.sort is absent or invalid', async () => {
    await renderPage({ sort: 'gibberish' })
    expect(mockListPublishedResearchItems).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'newest' }),
    )
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
