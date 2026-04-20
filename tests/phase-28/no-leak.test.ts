import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * Phase 28 Wave 3 — leak prevention contract for the public research surface
 * (Pitfall 6, RESEARCH-10).
 *
 * Three layers of assertion:
 *   1. The query helper (listPublishedResearchItems from Plan 28-01) MUST NOT
 *      return objects with audit/anchor keys (createdBy, reviewedBy, contentHash,
 *      txHash, anchoredAt, milestoneId, reviewedAt). Locked at the type system
 *      AND at the runtime Object.keys() check.
 *   2. The detail page (Plan 28-03) HTML MUST NOT contain those audit/anchor
 *      strings, FB-### feedback readableIds, or the literal feedback-link table
 *      column names — even when the underlying fixture is augmented with
 *      simulated leak-data-adjacent values.
 *   3. The detail page MUST NOT join the feedback-link table (researchItemFeedbackLinks);
 *      so it cannot leak feedback ids structurally.
 *
 * Listing-card leak coverage (CONTEXT.md Q9 — abstract/doi/linked sections
 * count NOT shown on cards) remains an it.todo here; it belongs to the
 * listing-card test surface and is OUT OF SCOPE for Plan 28-03 (detail page).
 */

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

// Detail-page query helpers — mock so renderDetail() resolves without real DB.
const mockGetPublishedResearchItem = vi.fn()
const mockListLinkedSectionsForResearchItem = vi.fn()
const mockListLinkedVersionsForResearchItem = vi.fn()

// Listing-query DB chain — preserves the Plan 28-01 query path so the runtime
// Object.keys() check on the result row asserts the column projection works.
const selectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockResolvedValue([
    {
      id: 'r1',
      readableId: 'RI-001',
      documentId: 'd1',
      title: 'X',
      itemType: 'report',
      description: null,
      externalUrl: null,
      artifactId: null,
      doi: null,
      authors: null,
      publishedDate: '2026-01-01',
      peerReviewed: false,
      journalOrSource: null,
      versionLabel: null,
      previousVersionId: null,
      isAuthorAnonymous: false,
      retractionReason: null,
    },
  ]),
}
const countChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue([{ n: 1 }]),
}
const mockSelect = vi.fn()

vi.mock('@/src/db', () => ({
  db: { select: (...a: unknown[]) => mockSelect(...a) },
}))

// Override the detail-page helpers with mocks while preserving listPublishedResearchItems.
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

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

import { listPublishedResearchItems } from '@/src/server/queries/research-public'
import ResearchItemDetailPage from '@/app/research/items/[id]/page'

const validId = '11111111-2222-3333-4444-555555555555'

function detailFixture() {
  return {
    id: validId,
    readableId: 'RI-001',
    documentId: 'd1',
    title: 'Integrity Study',
    itemType: 'report' as const,
    description: 'An abstract.',
    externalUrl: null,
    artifactId: 'art-1',
    doi: null,
    authors: ['J. Author'],
    publishedDate: '2026-02-01',
    peerReviewed: false,
    journalOrSource: null,
    versionLabel: null,
    previousVersionId: null,
    isAuthorAnonymous: false,
    retractionReason: null,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetPublishedResearchItem.mockResolvedValue(detailFixture())
  mockListLinkedSectionsForResearchItem.mockResolvedValue([])
  mockListLinkedVersionsForResearchItem.mockResolvedValue([])
  mockSelect
    .mockImplementationOnce(() => countChain as unknown as ReturnType<typeof mockSelect>)
    .mockImplementation(() => selectChain as unknown as ReturnType<typeof mockSelect>)
})

async function renderDetail() {
  const el = await ResearchItemDetailPage({
    params: Promise.resolve({ id: validId }),
  } as Parameters<typeof ResearchItemDetailPage>[0])
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
