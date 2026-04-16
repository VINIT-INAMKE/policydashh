import { describe, it, expect } from 'vitest'

async function loadHeader() {
  // Variable-path dynamic import - module does not exist until Plan 21-02.
  const segs = ['@', 'app', '(public)', '_components', 'public-header']
  const path = segs.join('/')
  return await import(/* @vite-ignore */ path)
}

describe('PublicHeader (PUB-09)', () => {
  it('exports PublicHeader as a React component', async () => {
    const mod = await loadHeader()
    expect(mod.PublicHeader).toBeDefined()
    expect(typeof mod.PublicHeader).toBe('function')
  })
})
