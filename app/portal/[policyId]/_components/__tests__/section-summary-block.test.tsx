import { describe, it, expect } from 'vitest'

async function loadBlock() {
  // Component lives at app/portal/[policyId]/_components (no (public) route
  // group in this repo). The path was drafted against a proposed layout that
  // never landed; align with the actual module location.
  const segs = ['@', 'app', 'portal', '[policyId]', '_components', 'section-summary-block']
  const path = segs.join('/')
  return await import(/* @vite-ignore */ path)
}

describe('SectionSummaryBlock (PUB-09, LLM-08)', () => {
  it('exports SectionSummaryBlock as a React component', async () => {
    const mod = await loadBlock()
    expect(mod.SectionSummaryBlock).toBeDefined()
    expect(typeof mod.SectionSummaryBlock).toBe('function')
  })
})
