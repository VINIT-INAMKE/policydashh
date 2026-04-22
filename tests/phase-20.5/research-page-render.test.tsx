import { describe, it, expect, beforeAll } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'

/**
 * Phase 20.5 Wave 0 - RED contract for PUB-06 /research page render.
 *
 * Locks four render rules Plan 20.5-02 must satisfy:
 *   A. Hero heading "Understanding the Landscape"
 *   B. Four anchor section ids: overview, key-themes, outputs, join-consultation
 *   C. PDF download anchor with href + download attribute
 *   D. Join Consultation CTA linking to /participate
 *
 * Imports the page component via variable-path dynamic import so vitest
 * collection does not fail before app/(public)/research/page.tsx exists.
 */

let ResearchPage: any
beforeAll(async () => {
  // Page lives at app/research/page.tsx - the (public) route group was
  // proposed in the Wave 0 plan but never shipped.
  const segs = ['@', 'app', 'research', 'page']
  const mod = await import(/* @vite-ignore */ segs.join('/'))
  ResearchPage = mod.default
})

describe('/research page - PUB-06', () => {
  it('renders hero heading "Understanding the Landscape"', async () => {
    const html = renderToStaticMarkup(React.createElement(ResearchPage))
    expect(html).toContain('Understanding the Landscape')
  })

  it('renders four anchor section ids', async () => {
    const html = renderToStaticMarkup(React.createElement(ResearchPage))
    expect(html).toContain('id="overview"')
    expect(html).toContain('id="key-themes"')
    expect(html).toContain('id="outputs"')
    expect(html).toContain('id="join-consultation"')
  })

  it('renders the "Coming soon" notice for the full research report', async () => {
    // The inline PDF download anchor that shipped in an early draft was
    // removed when the full report was put under review. The page now shows
    // a "Coming soon" notice under the Research Outputs section. Lock that
    // copy so the test goes RED if the notice gets dropped without the
    // download link being reinstated.
    const html = renderToStaticMarkup(React.createElement(ResearchPage))
    expect(html).toContain('Coming soon')
    expect(html).toContain('research report is being finalised')
  })

  it('renders Join Consultation CTA linking to /participate', async () => {
    const html = renderToStaticMarkup(React.createElement(ResearchPage))
    expect(html).toContain('href="/participate"')
    expect(html).toContain('Join Consultation')
  })
})
