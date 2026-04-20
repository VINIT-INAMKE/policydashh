import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * Phase 28 Wave 3 — GREEN contract for app/research/items/[id]/page.tsx (RESEARCH-10).
 *
 * Locks: H1, Back link, DOI hyperlink, anonymous-author, peer-reviewed badge,
 * linked sections + versions internal links, notFound() branches (UUID + null),
 * whitespace-pre-line abstract.
 *
 * Async server component pattern (Phase 20 + Plan 28-02 precedent): await the
 * page function to resolve inner awaits, then pass the returned React element
 * to renderToStaticMarkup.
 */

const mockGetPublishedResearchItem = vi.fn()
const mockListLinkedSectionsForResearchItem = vi.fn()
const mockListLinkedVersionsForResearchItem = vi.fn()

vi.mock('@/src/server/queries/research-public', () => ({
  getPublishedResearchItem: (...a: unknown[]) => mockGetPublishedResearchItem(...a),
  listLinkedSectionsForResearchItem: (...a: unknown[]) =>
    mockListLinkedSectionsForResearchItem(...a),
  listLinkedVersionsForResearchItem: (...a: unknown[]) =>
    mockListLinkedVersionsForResearchItem(...a),
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

import ResearchItemDetailPage from '@/app/research/items/[id]/page'
import type { PublicResearchItem } from '@/src/server/queries/research-public'

const validId = '11111111-2222-3333-4444-555555555555'

function fixture(overrides: Partial<PublicResearchItem> = {}): PublicResearchItem {
  return {
    id: validId,
    readableId: 'RI-001',
    documentId: '99999999-aaaa-bbbb-cccc-dddddddddddd',
    title: 'AI Policy in India',
    itemType: 'report',
    description: 'Intro paragraph.\nSecond paragraph.',
    externalUrl: null,
    artifactId: 'art-1',
    doi: null,
    authors: ['Jane Doe'],
    publishedDate: '2026-02-01',
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
  mockGetPublishedResearchItem.mockResolvedValue(fixture())
  mockListLinkedSectionsForResearchItem.mockResolvedValue([])
  mockListLinkedVersionsForResearchItem.mockResolvedValue([])
})

async function renderDetail(id: string = validId) {
  const el = await ResearchItemDetailPage({
    params: Promise.resolve({ id }),
  } as Parameters<typeof ResearchItemDetailPage>[0])
  return renderToStaticMarkup(el)
}

describe('/research/items/[id] detail — RESEARCH-10', () => {
  it('renders H1 with item.title', async () => {
    const html = await renderDetail()
    expect(html).toContain('AI Policy in India')
  })

  it('renders Back link with aria-label="Back to all research items" and href="/research/items"', async () => {
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
    mockGetPublishedResearchItem.mockResolvedValue(
      fixture({ isAuthorAnonymous: true, authors: null }),
    )
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
      {
        sectionId: 'sec-1',
        sectionTitle: 'Scope',
        documentId: 'doc-1',
        documentTitle: 'Policy',
        relevanceNote: 'Key',
      },
    ])
    const html = await renderDetail()
    expect(html).toContain('href="/framework/doc-1#section-sec-1"')
    expect(html).toContain('Scope')
  })

  it('renders linked versions as /portal/{docId}?v={label} anchors (isPublished=true filter applied at query layer)', async () => {
    mockListLinkedVersionsForResearchItem.mockResolvedValue([
      {
        versionId: 'v-1',
        versionLabel: 'v0.2',
        documentId: 'doc-1',
        documentTitle: 'Policy',
        publishedAt: new Date('2026-03-01'),
      },
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
    expect(html).toMatch(
      /whitespace-pre-line[\s\S]*Intro paragraph[\s\S]*Second paragraph/,
    )
  })
})
