import { describe, it } from 'vitest'

/**
 * Phase 28 Wave 0 — RED contract for a11y (CONTEXT.md SC-7).
 *
 * Plan 28-02 + 28-03 must satisfy aria-label / target+rel / aria-live + nav
 * aria-label requirements from the UI-SPEC accessibility block.
 *
 * No vi.mock setup here — these are stubs locking the contract; the
 * implementing plans will instantiate the renderers + fixtures.
 */

describe('/research/items accessibility — SC-7', () => {
  it.todo('download button has aria-label matching /Download .+ \\(.+\\)/ pattern')
  it.todo('filter <input type="date"> for "from" has aria-label="From date"')
  it.todo('filter <input type="date"> for "to" has aria-label="To date"')
  it.todo('pagination <nav> wrapper has aria-label="Research items pagination"')
  it.todo('external-link CTA on URL-only items has target="_blank" AND rel="noopener noreferrer"')
  it.todo('Back link on detail page has aria-label="Back to all research items"')
  it.todo('clear-filters link has aria-label="Clear all filters"')
})
