/**
 * Shared helpers for the Research Module UI surface (Phase 27 D-05).
 *
 * Single source of truth for the anonymous-author display rule. Both
 * the create/edit form's AnonymousPreviewCard AND the detail-page
 * author rendering import shouldHideAuthors so the preview never
 * disagrees with the final render (Pitfall 4).
 *
 * Phase 28 public listing will also import this for /research/items.
 */

export interface ShouldHideAuthorsInput {
  isAuthorAnonymous: boolean
}

export function shouldHideAuthors(item: ShouldHideAuthorsInput): boolean {
  return item.isAuthorAnonymous === true
}

/**
 * Render-ready author string for display. Returns "Source: Confidential"
 * when anonymous, otherwise comma-joins the author array. Returns a
 * muted placeholder string when no authors are present AND the item is
 * not anonymous (callers should treat this as "unknown" and render in
 * muted-foreground).
 */
export function formatAuthorsForDisplay(item: {
  isAuthorAnonymous: boolean
  authors: string[] | null
}): string {
  if (shouldHideAuthors(item)) return 'Source: Confidential'
  if (!item.authors || item.authors.length === 0) return 'Unknown author'
  return `Authors: ${item.authors.join(', ')}`
}
