import { describe, it, vi, beforeAll } from 'vitest'

/**
 * Phase 28 Wave 0 — RED contract for app/research/items/page.tsx (RESEARCH-09).
 *
 * Locks the listing page contract: header copy, card count, anonymous author
 * rendering, pagination disabled states, aria-live announcement, searchParams
 * plumbing, empty states. Plan 28-02 must turn these GREEN.
 *
 * Variable-path dynamic import (canonical Phase 16/17/19/20.5/21/22/26/27
 * pattern) defers module resolution until Plan 28-02 ships
 * app/research/items/page.tsx.
 */

vi.mock('@/src/server/queries/research-public', () => ({
  listPublishedResearchItems: vi.fn(),
}))

let ResearchItemsPage: any
beforeAll(async () => {
  const segs = ['@', 'app', 'research', 'items', 'page']
  try {
    const mod = await import(/* @vite-ignore */ segs.join('/'))
    ResearchItemsPage = mod.default
  } catch {
    // Intentional: Wave 0 RED state. Plan 28-02 will make this import succeed.
    ResearchItemsPage = null
  }
})

describe('/research/items listing — RESEARCH-09', () => {
  it.todo('renders H1 "Published Research"')
  it.todo('renders N cards when listPublishedResearchItems returns N items')
  it.todo('renders anonymous author as "Source: Confidential" on cards with isAuthorAnonymous=true')
  it.todo('Previous button disabled when offset=0')
  it.todo('Next button disabled when offset + 40 >= total')
  it.todo('aria-live="polite" region contains "Showing items X-Y of Z"')
  it.todo('forwards searchParams (document/type/from/to/sort/offset) to query helper')
  it.todo('renders "No published research yet" when items empty and no filters')
  it.todo('renders "No research items match these filters" when items empty and filters active')
})
