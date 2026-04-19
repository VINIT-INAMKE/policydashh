import { describe, it, expect, vi } from 'vitest'
import { shouldHideAuthors, formatAuthorsForDisplay } from '@/src/lib/research-utils'

vi.mock('server-only', () => ({}))

// GREEN tests — shouldHideAuthors is shipped in Plan 01 Task 1.
// These lock the D-05 single-source-of-truth invariant: the preview
// card AND the detail page both call this helper, so flipping the
// Switch must change both surfaces identically.
describe('RESEARCH-06: shouldHideAuthors pure helper (D-05)', () => {
  it('returns true when isAuthorAnonymous is true', () => {
    expect(shouldHideAuthors({ isAuthorAnonymous: true })).toBe(true)
  })

  it('returns false when isAuthorAnonymous is false', () => {
    expect(shouldHideAuthors({ isAuthorAnonymous: false })).toBe(false)
  })
})

describe('RESEARCH-06: formatAuthorsForDisplay (D-05 + UI-SPEC copywriting)', () => {
  it('returns exactly "Source: Confidential" when anonymous', () => {
    expect(
      formatAuthorsForDisplay({ isAuthorAnonymous: true, authors: ['Alice'] })
    ).toBe('Source: Confidential')
  })

  it('returns exactly "Authors: Alice, Bob" when named with authors', () => {
    expect(
      formatAuthorsForDisplay({ isAuthorAnonymous: false, authors: ['Alice', 'Bob'] })
    ).toBe('Authors: Alice, Bob')
  })

  it('returns "Unknown author" when not anonymous but authors is null', () => {
    expect(
      formatAuthorsForDisplay({ isAuthorAnonymous: false, authors: null })
    ).toBe('Unknown author')
  })
})

describe('RESEARCH-06: AnonymousPreviewCard component contract (Plan 03)', () => {
  it.todo('renders card with bg-muted, 8px padding, 12px caption text')
  it.todo('when isAuthorAnonymous=false and authors=["Alice"], renders text "Authors: Alice"')
  it.todo('when isAuthorAnonymous=true, renders text "Source: Confidential"')
  it.todo('updates live on Switch toggle — no server round-trip')
})
