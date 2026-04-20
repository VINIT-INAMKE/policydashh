import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import ResearchPage from '@/app/research/page'

/**
 * Phase 28 Wave 0 — RED contract for /research page Browse CTA addition.
 *
 * Plan 28-04 Task 1 must append a "Browse published research" link section to
 * app/research/page.tsx without disturbing the existing prose. This test runs
 * against the live file today and will fail until that plan ships.
 *
 * Authentically RED today:
 *   - "Browse published research" copy not present yet (assertion 1 fails)
 *   - href="/research/items" not present yet (assertion 2 fails)
 *   - Existing "Understanding the Landscape" / "Join Consultation" /
 *     "Research Outputs" prose preserved (assertions 3-5 pass) — guards
 *     against accidental prose disruption when Plan 28-04 lands.
 */

describe('/research page — Browse CTA (CONTEXT.md Scope IN)', () => {
  it('contains "Browse published research" link text', () => {
    const html = renderToStaticMarkup(React.createElement(ResearchPage))
    expect(html).toContain('Browse published research')
  })

  it('link target is /research/items', () => {
    const html = renderToStaticMarkup(React.createElement(ResearchPage))
    expect(html).toMatch(/href="\/research\/items"/)
  })

  it('preserves existing "Understanding the Landscape" heading (prose not disturbed)', () => {
    const html = renderToStaticMarkup(React.createElement(ResearchPage))
    expect(html).toContain('Understanding the Landscape')
  })

  it('preserves existing "Join Consultation" CTA', () => {
    const html = renderToStaticMarkup(React.createElement(ResearchPage))
    expect(html).toContain('Join Consultation')
  })

  it('preserves the Research Outputs section (prose not disturbed)', () => {
    const html = renderToStaticMarkup(React.createElement(ResearchPage))
    expect(html).toContain('Research Outputs')
  })
})
