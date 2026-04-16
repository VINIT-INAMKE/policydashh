import { describe, it, expect, vi, beforeAll } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'

/**
 * Phase 20.5 Wave 0 - RED contract for PUB-07 /framework no-drafts empty state.
 *
 * Locks the empty-state copy Plan 20.5-03 must render when zero policy
 * documents have isPublicDraft=true:
 *   - Heading: "No drafts under consultation"
 *   - Body:    "No framework documents are currently open for public review."
 *
 * Imports the page component via variable-path dynamic import so vitest
 * collection does not fail before app/(public)/framework/page.tsx exists.
 */

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    })),
  },
}))
vi.mock('@/src/db', () => ({ db: dbMock }))

let FrameworkPage: any
beforeAll(async () => {
  const segs = ['@', 'app', '(public)', 'framework', 'page']
  const mod = await import(/* @vite-ignore */ segs.join('/'))
  FrameworkPage = mod.default
})

describe('/framework page - PUB-07 empty state', () => {
  it('renders "No drafts under consultation" heading when zero isPublicDraft docs', async () => {
    const element = await FrameworkPage()
    const html = renderToStaticMarkup(element)
    expect(html).toContain('No drafts under consultation')
  })

  it('renders empty-state body copy per UI-SPEC', async () => {
    const element = await FrameworkPage()
    const html = renderToStaticMarkup(element)
    expect(html).toContain(
      'No framework documents are currently open for public review.',
    )
  })
})
