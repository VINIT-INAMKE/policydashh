import { describe, it, vi, beforeEach } from 'vitest'

/**
 * Phase 28 Wave 0 — RED contract for src/server/queries/research-public.ts.
 *
 * Locks the filter/sort/offset semantics for listPublishedResearchItems and
 * the no-leak projection for getPublishedResearchItem. Plan 28-01 must turn
 * these GREEN by creating the query helper with the exact exports below.
 *
 * Mocking strategy: vi.mock('@/src/db') returns a chainable
 * select().from().where().orderBy().limit().offset() that resolves to a
 * test-controlled rows array. The TEST asserts the CONDITIONS + ORDER BY +
 * LIMIT + OFFSET objects the helper builds, not the raw SQL — matches the
 * Phase 26 research-router.test.ts pattern.
 *
 * Variable-path dynamic import (Phase 16/17/19/20.5/21/22/26/27 canonical):
 * the target module does not exist on disk yet (Plan 28-01 creates it). The
 * `segs.join('/')` form bypasses Vite's static import-analysis walker so
 * vitest collection does not fail before downstream plans land.
 */

vi.mock('@/src/db', () => ({
  db: {
    select: vi.fn(),
  },
}))

let listPublishedResearchItems: any
let getPublishedResearchItem: any

beforeEach(async () => {
  vi.clearAllMocks()
  const segs = ['@', 'src', 'server', 'queries', 'research-public']
  try {
    const mod = await import(/* @vite-ignore */ segs.join('/'))
    listPublishedResearchItems = mod.listPublishedResearchItems
    getPublishedResearchItem = mod.getPublishedResearchItem
  } catch {
    // Intentional: Wave 0 RED state. Plan 28-01 will make this import succeed.
    listPublishedResearchItems = null
    getPublishedResearchItem = null
  }
})

describe('listPublishedResearchItems — RESEARCH-09 filter contract', () => {
  it.todo('returns { items, total }; applies status="published" filter')
  it.todo('applies documentId, itemType, from, to filters when provided')
  it.todo('orders by publishedDate DESC when sort="newest" (default)')
  it.todo('orders by publishedDate ASC when sort="oldest"')
  it.todo('limits to 40 per page; applies offset correctly')
  it.todo('nulls out authors when isAuthorAnonymous=true (Pitfall 5)')
  it.todo('strips createdBy, reviewedBy, contentHash, txHash from public projection')
})

describe('getPublishedResearchItem — RESEARCH-10 leak prevention', () => {
  it.todo('returns null when status != "published"')
  it.todo('returns row with public-safe projection (no createdBy/reviewedBy/contentHash/txHash)')
  it.todo('nulls out authors when isAuthorAnonymous=true')
})
