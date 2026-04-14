import { describe, it, expect, beforeAll } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'

/**
 * Phase 20.5 Wave 0 — RED contract for PUB-06 /research page render.
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
  const segs = ['@', 'app', '(public)', 'research', 'page']
  const mod = await import(/* @vite-ignore */ segs.join('/'))
  ResearchPage = mod.default
})

describe('/research page — PUB-06', () => {
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

  it('renders PDF download anchor with download attribute', async () => {
    const html = renderToStaticMarkup(React.createElement(ResearchPage))
    expect(html).toContain('href="/research/consultation-research-report.pdf"')
    expect(html).toMatch(
      /href="\/research\/consultation-research-report\.pdf"[^>]*download/,
    )
  })

  it('renders Join Consultation CTA linking to /participate', async () => {
    const html = renderToStaticMarkup(React.createElement(ResearchPage))
    expect(html).toContain('href="/participate"')
    expect(html).toContain('Join Consultation')
  })
})
