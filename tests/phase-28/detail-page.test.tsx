import { describe, it, vi, beforeAll } from 'vitest'

/**
 * Phase 28 Wave 0 — RED contract for app/research/items/[id]/page.tsx (RESEARCH-10).
 *
 * Locks detail page contract: H1 title, Back link, DOI hyperlink, linked
 * sections + versions internal links, anonymous author, peer-reviewed badge,
 * notFound() branch.
 *
 * Variable-path dynamic import (canonical Phase 16/17/19/20.5/21/22/26/27
 * pattern) defers module resolution until Plan 28-03 ships
 * app/research/items/[id]/page.tsx.
 */

vi.mock('@/src/server/queries/research-public', () => ({
  getPublishedResearchItem: vi.fn(),
  listLinkedSectionsForResearchItem: vi.fn(),
  listLinkedVersionsForResearchItem: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

let ResearchItemDetailPage: any
beforeAll(async () => {
  const segs = ['@', 'app', 'research', 'items', '[id]', 'page']
  try {
    const mod = await import(/* @vite-ignore */ segs.join('/'))
    ResearchItemDetailPage = mod.default
  } catch {
    // Intentional: Wave 0 RED state. Plan 28-03 will make this import succeed.
    ResearchItemDetailPage = null
  }
})

describe('/research/items/[id] detail — RESEARCH-10', () => {
  it.todo('renders H1 with item.title')
  it.todo('renders Back link with aria-label="Back to all research items" and href="/research/items"')
  it.todo('DOI renders as <a href="https://doi.org/{doi}"> when doi present')
  it.todo('hides DOI section when doi is null')
  it.todo('renders linked sections as <a href="/framework/{documentId}#section-{sectionId}">')
  it.todo('renders linked versions as <a href="/portal/{documentId}?v={versionLabel}">')
  it.todo('renders "Source: Confidential" when isAuthorAnonymous=true')
  it.todo('renders "Peer Reviewed" badge when peerReviewed=true, absent when false')
  it.todo('calls notFound() when getPublishedResearchItem returns null')
  it.todo('calls notFound() when UUID_REGEX does not match id param')
})
