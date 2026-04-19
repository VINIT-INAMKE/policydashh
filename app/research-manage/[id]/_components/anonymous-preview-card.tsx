import { Card } from '@/components/ui/card'
import { shouldHideAuthors } from '@/src/lib/research-utils'

/**
 * AnonymousPreviewCard — Phase 27 D-05 (RESEARCH-06 SC-2).
 *
 * Live preview of how the author attribution will render on public surfaces.
 * Renders directly below the `isAuthorAnonymous` Switch on the create/edit
 * form. Updates client-side only — no server round-trip — by re-deriving
 * `shouldHideAuthors` on each render.
 *
 * D-05 single-source-of-truth invariant (Pitfall 4):
 *   The detail page author rendering AND the future Phase 28 public listing
 *   both call `shouldHideAuthors` from `src/lib/research-utils`. By importing
 *   the same helper here, the preview text can never disagree with the final
 *   rendered output for a given (isAuthorAnonymous, authors) pair.
 *
 * Copywriting (per UI-SPEC §"Copywriting Contract"):
 *   - hidden: "Source: Confidential"
 *   - named:  "Authors: {comma-joined names}"
 *   - empty named: "Authors: (none specified)"
 */

export interface AnonymousPreviewCardProps {
  isAuthorAnonymous: boolean
  authors: string[]
}

export function AnonymousPreviewCard({
  isAuthorAnonymous,
  authors,
}: AnonymousPreviewCardProps) {
  // D-05: single source of truth — uses shouldHideAuthors which detail
  // page and Phase 28 public listing will ALSO consume.
  const hide = shouldHideAuthors({ isAuthorAnonymous })
  const named = authors.filter((a) => a.trim().length > 0)
  const displayText = hide
    ? 'Source: Confidential'
    : named.length > 0
      ? `Authors: ${named.join(', ')}`
      : 'Authors: (none specified)'

  return (
    <Card className="bg-muted p-2">
      <p className="text-xs text-muted-foreground">
        Preview: <span className="font-medium text-foreground">{displayText}</span>
      </p>
    </Card>
  )
}
