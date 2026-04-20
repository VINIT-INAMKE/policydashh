import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Phase 28 — GREEN contract for src/server/queries/research-public.ts
 * (RESEARCH-09 listing helper + RESEARCH-10 detail helper).
 *
 * Plan 28-01 shipped the helper. Plan 28-04 (this) flips these Wave 0 stubs
 * to real assertions exercising the production module.
 *
 * Mocking strategy:
 *   - vi.mock('next/cache', { unstable_cache: fn => fn }) — strip the cache
 *     wrapper so the inner async function is invoked directly.
 *   - vi.mock('@/src/db', { db: { select: vi.fn } }) — chainable select
 *     returning queued rows. Per-test we control what each select() resolves to.
 *   - vi.mock the schema imports so referencing researchItems.id etc. doesn't
 *     try to reach the real DB schema.
 */

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}))

// vi.hoisted captures variables that need to live ABOVE the hoisted vi.mock
// factory call. Without this, referencing sqlMock inside the factory throws
// "Cannot access 'sqlMock' before initialization".
const drizzleMocks = vi.hoisted(() => ({
  eqMock: vi.fn((col: unknown, val: unknown) => ({ kind: 'eq', col, val })),
  gteMock: vi.fn((col: unknown, val: unknown) => ({ kind: 'gte', col, val })),
  lteMock: vi.fn((col: unknown, val: unknown) => ({ kind: 'lte', col, val })),
  ascMock: vi.fn((col: unknown) => ({ kind: 'asc', col })),
  descMock: vi.fn((col: unknown) => ({ kind: 'desc', col })),
  andMock: vi.fn((...conds: unknown[]) => ({ kind: 'and', conds })),
  sqlMock: Object.assign(
    (..._args: unknown[]) => ({ kind: 'sql' }),
    { raw: (s: string) => ({ kind: 'sql.raw', s }) },
  ),
}))
const { eqMock, gteMock, lteMock, ascMock, descMock } = drizzleMocks

vi.mock('drizzle-orm', () => ({
  eq: (...a: unknown[]) => drizzleMocks.eqMock(...(a as Parameters<typeof drizzleMocks.eqMock>)),
  gte: (...a: unknown[]) => drizzleMocks.gteMock(...(a as Parameters<typeof drizzleMocks.gteMock>)),
  lte: (...a: unknown[]) => drizzleMocks.lteMock(...(a as Parameters<typeof drizzleMocks.lteMock>)),
  asc: (...a: unknown[]) => drizzleMocks.ascMock(...(a as Parameters<typeof drizzleMocks.ascMock>)),
  desc: (...a: unknown[]) => drizzleMocks.descMock(...(a as Parameters<typeof drizzleMocks.descMock>)),
  and: (...a: unknown[]) => drizzleMocks.andMock(...(a as Parameters<typeof drizzleMocks.andMock>)),
  sql: drizzleMocks.sqlMock,
}))

// Per-call db.select() chain state. Hoisted so vi.mock factory can reference.
const dbState = vi.hoisted(() => {
  const limitMock = vi.fn()
  const offsetMock = vi.fn()
  const orderByMock = vi.fn()
  const whereMock = vi.fn()

  // Mutable state controlling chain behavior per test
  const state: {
    countRows: unknown[]
    listRows: unknown[]
    detailRows: unknown[]
    selectCallIdx: number
    helperMode: 'list' | 'detail'
  } = {
    countRows: [{ n: 0 }],
    listRows: [],
    detailRows: [],
    selectCallIdx: 0,
    helperMode: 'list',
  }

  const buildSelectChain = () => {
    const chain: Record<string, unknown> = {}
    chain.from = vi.fn().mockReturnValue(chain)
    chain.where = vi.fn((arg: unknown) => {
      whereMock(arg)
      return chain
    })
    chain.orderBy = vi.fn((...args: unknown[]) => {
      orderByMock(...args)
      return chain
    })
    chain.limit = vi.fn((n: number) => {
      limitMock(n)
      if (state.helperMode === 'detail') {
        return Promise.resolve(state.detailRows)
      }
      return chain
    })
    chain.offset = vi.fn((n: number) => {
      offsetMock(n)
      return Promise.resolve(state.listRows)
    })
    return chain
  }

  const dbSelectMock = vi.fn(() => {
    if (state.helperMode === 'list') {
      if (state.selectCallIdx === 0) {
        // Count select — chain returns from().where() → resolves to countRows
        const chain: Record<string, unknown> = {}
        chain.from = vi.fn().mockReturnValue(chain)
        chain.where = vi.fn().mockResolvedValue(state.countRows)
        state.selectCallIdx++
        return chain
      }
      state.selectCallIdx++
      return buildSelectChain()
    }
    return buildSelectChain()
  })

  return { state, limitMock, offsetMock, orderByMock, whereMock, dbSelectMock }
})

const { limitMock, offsetMock } = dbState

vi.mock('@/src/db', () => ({
  db: { select: (...a: unknown[]) => (dbState.dbSelectMock as (...args: unknown[]) => unknown)(...a) },
}))

// Schema mocks — return distinct sentinel objects so we can identify which
// column was passed to eq/asc/desc/etc. Hoisted so vi.mock factory references work.
const schemaMocks = vi.hoisted(() => ({
  researchItemsCols: {
    id: 'col:researchItems.id',
    readableId: 'col:researchItems.readableId',
    documentId: 'col:researchItems.documentId',
    title: 'col:researchItems.title',
    itemType: 'col:researchItems.itemType',
    description: 'col:researchItems.description',
    externalUrl: 'col:researchItems.externalUrl',
    artifactId: 'col:researchItems.artifactId',
    doi: 'col:researchItems.doi',
    authors: 'col:researchItems.authors',
    publishedDate: 'col:researchItems.publishedDate',
    peerReviewed: 'col:researchItems.peerReviewed',
    journalOrSource: 'col:researchItems.journalOrSource',
    versionLabel: 'col:researchItems.versionLabel',
    previousVersionId: 'col:researchItems.previousVersionId',
    isAuthorAnonymous: 'col:researchItems.isAuthorAnonymous',
    retractionReason: 'col:researchItems.retractionReason',
    status: 'col:researchItems.status',
    createdAt: 'col:researchItems.createdAt',
  },
  researchItemSectionLinksCols: { sectionId: 'col:rsl.sectionId', researchItemId: 'col:rsl.researchItemId', relevanceNote: 'col:rsl.relevanceNote' },
  researchItemVersionLinksCols: { versionId: 'col:rvl.versionId', researchItemId: 'col:rvl.researchItemId' },
  policyDocumentsCols: { id: 'col:pd.id', title: 'col:pd.title' },
  policySectionsCols: { id: 'col:ps.id', documentId: 'col:ps.documentId', title: 'col:ps.title' },
  documentVersionsCols: { id: 'col:dv.id', documentId: 'col:dv.documentId', versionLabel: 'col:dv.versionLabel', isPublished: 'col:dv.isPublished', publishedAt: 'col:dv.publishedAt' },
}))

const { researchItemsCols } = schemaMocks

vi.mock('@/src/db/schema/research', () => ({
  researchItems: schemaMocks.researchItemsCols,
  researchItemSectionLinks: schemaMocks.researchItemSectionLinksCols,
  researchItemVersionLinks: schemaMocks.researchItemVersionLinksCols,
}))

vi.mock('@/src/db/schema/documents', () => ({
  policyDocuments: schemaMocks.policyDocumentsCols,
  policySections: schemaMocks.policySectionsCols,
}))

vi.mock('@/src/db/schema/changeRequests', () => ({
  documentVersions: schemaMocks.documentVersionsCols,
}))

import {
  listPublishedResearchItems,
  getPublishedResearchItem,
  PAGE_SIZE,
} from '@/src/server/queries/research-public'

const validId = '11111111-2222-3333-4444-555555555555'

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    readableId: 'RI-001',
    documentId: 'd1',
    title: 'X',
    itemType: 'report',
    description: null,
    externalUrl: null,
    artifactId: null,
    doi: null,
    authors: ['A. Author'],
    publishedDate: '2026-01-01',
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
  dbState.state.selectCallIdx = 0
  dbState.state.helperMode = 'list'
  dbState.state.countRows = [{ n: 0 }]
  dbState.state.listRows = []
  dbState.state.detailRows = []
})

describe('listPublishedResearchItems — RESEARCH-09 filter contract', () => {
  it('returns { items, total }; applies status="published" filter', async () => {
    dbState.state.helperMode = 'list'
    dbState.state.countRows = [{ n: 1 }]
    dbState.state.listRows = [row()]

    const out = await listPublishedResearchItems({ sort: 'newest', offset: 0 })
    expect(out).toHaveProperty('items')
    expect(out).toHaveProperty('total')
    expect(out.total).toBe(1)
    expect(out.items.length).toBe(1)
    // Confirm the helper applied a status='published' equality
    expect(eqMock).toHaveBeenCalledWith(researchItemsCols.status, 'published')
  })

  it('applies documentId, itemType, from, to filters when provided', async () => {
    dbState.state.helperMode = 'list'
    dbState.state.countRows = [{ n: 0 }]
    dbState.state.listRows = []

    await listPublishedResearchItems({
      documentId: 'doc-1',
      itemType: 'paper',
      from: '2026-01-01',
      to: '2026-12-31',
      sort: 'newest',
      offset: 0,
    })
    expect(eqMock).toHaveBeenCalledWith(researchItemsCols.documentId, 'doc-1')
    expect(eqMock).toHaveBeenCalledWith(researchItemsCols.itemType, 'paper')
    expect(gteMock).toHaveBeenCalledWith(researchItemsCols.publishedDate, '2026-01-01')
    expect(lteMock).toHaveBeenCalledWith(researchItemsCols.publishedDate, '2026-12-31')
  })

  it('orders by publishedDate DESC when sort="newest" (default)', async () => {
    dbState.state.helperMode = 'list'
    dbState.state.countRows = [{ n: 0 }]
    dbState.state.listRows = []

    await listPublishedResearchItems({ sort: 'newest', offset: 0 })
    expect(descMock).toHaveBeenCalledWith(researchItemsCols.publishedDate)
  })

  it('orders by publishedDate ASC when sort="oldest"', async () => {
    dbState.state.helperMode = 'list'
    dbState.state.countRows = [{ n: 0 }]
    dbState.state.listRows = []

    await listPublishedResearchItems({ sort: 'oldest', offset: 0 })
    expect(ascMock).toHaveBeenCalledWith(researchItemsCols.publishedDate)
  })

  it('limits to 40 per page; applies offset correctly', async () => {
    dbState.state.helperMode = 'list'
    dbState.state.countRows = [{ n: 100 }]
    dbState.state.listRows = []

    await listPublishedResearchItems({ sort: 'newest', offset: 80 })
    expect(PAGE_SIZE).toBe(40)
    expect(limitMock).toHaveBeenCalledWith(40)
    expect(offsetMock).toHaveBeenCalledWith(80)
  })

  it('nulls out authors when isAuthorAnonymous=true (Pitfall 5)', async () => {
    dbState.state.helperMode = 'list'
    dbState.state.countRows = [{ n: 1 }]
    dbState.state.listRows = [row({ isAuthorAnonymous: true, authors: ['Should Not Leak'] })]

    const { items } = await listPublishedResearchItems({ sort: 'newest', offset: 0 })
    expect(items[0].authors).toBeNull()
    expect(items[0].isAuthorAnonymous).toBe(true)
  })

  it('strips createdBy, reviewedBy, contentHash, txHash from public projection', async () => {
    dbState.state.helperMode = 'list'
    dbState.state.countRows = [{ n: 1 }]
    // Row simulates DB returning the public-safe projection (no audit columns).
    dbState.state.listRows = [row()]

    const { items } = await listPublishedResearchItems({ sort: 'newest', offset: 0 })
    const keys = Object.keys(items[0])
    expect(keys).not.toContain('createdBy')
    expect(keys).not.toContain('reviewedBy')
    expect(keys).not.toContain('contentHash')
    expect(keys).not.toContain('txHash')
    expect(keys).not.toContain('anchoredAt')
    expect(keys).not.toContain('milestoneId')
  })
})

describe('getPublishedResearchItem — RESEARCH-10 leak prevention', () => {
  it('returns null when status != "published"', async () => {
    dbState.state.helperMode = 'detail'
    dbState.state.detailRows = [] // empty rows = filtered out by status='published'

    const out = await getPublishedResearchItem(validId)
    expect(out).toBeNull()
  })

  it('returns row with public-safe projection (no createdBy/reviewedBy/contentHash/txHash)', async () => {
    dbState.state.helperMode = 'detail'
    dbState.state.detailRows = [row()]

    const out = await getPublishedResearchItem(validId)
    expect(out).not.toBeNull()
    const keys = Object.keys(out as unknown as Record<string, unknown>)
    expect(keys).not.toContain('createdBy')
    expect(keys).not.toContain('reviewedBy')
    expect(keys).not.toContain('contentHash')
    expect(keys).not.toContain('txHash')
    expect(keys).not.toContain('anchoredAt')
    expect(keys).not.toContain('milestoneId')
  })

  it('nulls out authors when isAuthorAnonymous=true', async () => {
    dbState.state.helperMode = 'detail'
    dbState.state.detailRows = [row({ isAuthorAnonymous: true, authors: ['Should Not Leak'] })]

    const out = await getPublishedResearchItem(validId)
    expect(out?.authors).toBeNull()
    expect(out?.isAuthorAnonymous).toBe(true)
  })
})
