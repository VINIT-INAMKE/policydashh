/**
 * Wave 0 RED contract for RESEARCH-08: link-picker dialogs.
 * Target modules: SectionLinkPicker / VersionLinkPicker / FeedbackLinkPicker
 * (Plan 27-05 creates).
 *
 * Each picker is a pure controlled dialog (parent owns open state),
 * Promise.allSettled bulk-link, partial-failure toast. Tests are
 * it.todo — they go GREEN when Plan 27-05 lands the components.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/src/db', () => ({ db: {} }))

describe('RESEARCH-08: SectionLinkPicker (research)', () => {
  it.todo('exports SectionLinkPicker with props { researchItemId, linkedSectionIds, open, onOpenChange }')
  it.todo('excludes already-linked sections from selectable list (mirrors workshop pattern)')
  it.todo('multi-select via Checkbox; selecting 3 sections fires 3 linkSection mutations via Promise.allSettled')
  it.todo('partial failure shows "Linked N of M. X failed" toast; full success shows "N sections linked" toast')
  it.todo('on close, selected state resets to empty array')
})

describe('RESEARCH-08: VersionLinkPicker', () => {
  it.todo('exports VersionLinkPicker with props { researchItemId, linkedVersionIds, open, onOpenChange }')
  it.todo('fetches versions via trpc.version.list per document (research items are per-document)')
  it.todo('multi-select multiple versions; linkVersion mutation fires for each via Promise.allSettled')
})

describe('RESEARCH-08: FeedbackLinkPicker (research)', () => {
  it.todo('exports FeedbackLinkPicker with props { researchItemId, linkedFeedbackIds, open, onOpenChange }')
  it.todo('reuses trpc.feedback.listAll (Phase 12 query)')
  it.todo('search + type filter narrow selectable list')
})

describe('RESEARCH-08: relevanceNote inline edit (D-07)', () => {
  it.todo('section link row renders relevanceNote text or "Add a relevance note…" placeholder')
  it.todo('clicking note text swaps in Textarea + Save/Cancel buttons')
  it.todo('Save note calls trpc.research.linkSection with { researchItemId, sectionId, relevanceNote } — relies on Plan 01 onConflictDoUpdate fix')
})
