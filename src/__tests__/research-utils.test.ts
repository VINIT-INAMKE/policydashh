/**
 * GREEN tests for src/lib/research-utils.ts (Plan 27-01 D-05).
 *
 * Single source of truth for the anonymous-author display rule. These
 * tests lock the contract that both the create/edit form's
 * AnonymousPreviewCard and the detail-page author rendering must call
 * the same shouldHideAuthors helper so the preview never disagrees with
 * the final render (Pitfall 4).
 *
 * Phase 28 public listing will also import this for /research/items.
 */

import { describe, it, expect } from 'vitest'
import { shouldHideAuthors, formatAuthorsForDisplay } from '@/src/lib/research-utils'

describe('shouldHideAuthors (D-05 single source of truth)', () => {
  it('returns true when isAuthorAnonymous is true', () => {
    expect(shouldHideAuthors({ isAuthorAnonymous: true })).toBe(true)
  })

  it('returns false when isAuthorAnonymous is false', () => {
    expect(shouldHideAuthors({ isAuthorAnonymous: false })).toBe(false)
  })
})

describe('formatAuthorsForDisplay (D-05 + UI-SPEC copywriting contract)', () => {
  it('returns exactly "Source: Confidential" when anonymous (even if authors provided)', () => {
    expect(
      formatAuthorsForDisplay({ isAuthorAnonymous: true, authors: ['Alice'] })
    ).toBe('Source: Confidential')
  })

  it('returns exactly "Authors: Alice, Bob" when named with multiple authors', () => {
    expect(
      formatAuthorsForDisplay({ isAuthorAnonymous: false, authors: ['Alice', 'Bob'] })
    ).toBe('Authors: Alice, Bob')
  })

  it('returns "Unknown author" when not anonymous but authors is null', () => {
    expect(
      formatAuthorsForDisplay({ isAuthorAnonymous: false, authors: null })
    ).toBe('Unknown author')
  })

  it('returns "Unknown author" when not anonymous but authors is empty array', () => {
    expect(
      formatAuthorsForDisplay({ isAuthorAnonymous: false, authors: [] })
    ).toBe('Unknown author')
  })

  it('returns exactly "Authors: Alice" with single author', () => {
    expect(
      formatAuthorsForDisplay({ isAuthorAnonymous: false, authors: ['Alice'] })
    ).toBe('Authors: Alice')
  })
})
