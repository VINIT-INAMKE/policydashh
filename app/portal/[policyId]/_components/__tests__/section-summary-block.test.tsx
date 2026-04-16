import { describe, it, expect } from 'vitest'

async function loadBlock() {
  const segs = ['@', 'app', '(public)', 'portal', '[policyId]', '_components', 'section-summary-block']
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
