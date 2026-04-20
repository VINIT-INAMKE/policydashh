import { describe, it } from 'vitest'

/**
 * Phase 28 Wave 0 — RED contract for public surface leak prevention (Pitfall 6).
 *
 * Asserts that the public listing + detail server components never emit HTML
 * containing feedback IDs (FB-### readableIds), createdBy, reviewedBy, or
 * internal audit fields (contentHash, txHash, anchoredAt) — even when the
 * fixture has a linked feedback item with a readableId like FB-042.
 *
 * Plan 28-01 (query layer) and Plans 28-02/28-03 (listing + detail pages)
 * must turn these GREEN by:
 *   - Plan 28-01: column-projecting OUT createdBy/reviewedBy/contentHash/txHash
 *     in listPublishedResearchItems + getPublishedResearchItem
 *   - Plan 28-03: NOT joining researchItemFeedbackLinks on the public detail
 *     server component (only researchItemSectionLinks + researchItemVersionLinks)
 *
 * No vi.mock setup here — these are stubs locking the contract; the
 * implementing plans will instantiate the renderers + fixtures.
 */

describe('public research detail — leak prevention RESEARCH-10', () => {
  it.todo('detail-page HTML does NOT contain "createdBy" or "reviewedBy" strings')
  it.todo('detail-page HTML does NOT contain "FB-" readableId pattern even when linkedFeedback fixture exists')
  it.todo('detail-page HTML does NOT contain "contentHash", "txHash", "anchoredAt"')
  it.todo('detail-page HTML does NOT contain feedbackLinks / researchItemFeedbackLinks DB column names')
  it.todo('listing-page card HTML does NOT contain abstract, doi, linked sections count (CONTEXT.md Q9)')
  it.todo('listing query result objects do NOT expose createdBy, reviewedBy, contentHash, txHash keys')
})
