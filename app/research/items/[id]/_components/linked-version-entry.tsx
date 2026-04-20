/**
 * Phase 28 Plan 28-03 — LinkedVersionEntry server component for the public detail page (RESEARCH-10).
 *
 * Renders one linked policy version as an internal link card pointing at
 * /portal/{documentId}?v={versionLabel} (Phase 21 portal version-selector deep-link).
 *
 * Pure server component. Source of the props is
 * listLinkedVersionsForResearchItem() in src/server/queries/research-public.ts
 * (Plan 28-01), which filters documentVersions.isPublished=true at the query
 * level (OQ2 resolution) so the public detail page never offers a
 * /portal deep-link that would 404.
 *
 * Visual treatment: version label rendered in the merged-CR pill style
 * (--status-cr-merged-bg / --status-cr-merged-text tokens) per UI-SPEC Surface B.
 */
import Link from 'next/link'
import { format } from 'date-fns'

export interface LinkedVersionEntryProps {
  documentId: string
  versionLabel: string
  documentTitle: string
  publishedAt: Date | null
}

export function LinkedVersionEntry({
  documentId,
  versionLabel,
  documentTitle,
  publishedAt,
}: LinkedVersionEntryProps) {
  return (
    <Link
      href={`/portal/${documentId}?v=${versionLabel}`}
      className="block"
      aria-label={`${versionLabel} of ${documentTitle}`}
    >
      <div className="flex items-center gap-3 rounded-md border bg-card px-4 py-3 hover:bg-muted/30 transition-colors">
        <span className="inline-flex items-center rounded-full bg-[var(--status-cr-merged-bg)] px-2 py-0.5 text-xs font-medium text-[var(--status-cr-merged-text)]">
          {versionLabel}
        </span>
        <span className="text-sm text-foreground">{documentTitle}</span>
        {publishedAt && (
          <time
            dateTime={publishedAt.toISOString()}
            className="ml-auto text-xs text-muted-foreground"
          >
            {format(publishedAt, 'MMM d, yyyy')}
          </time>
        )}
      </div>
    </Link>
  )
}
