/**
 * Phase 28 Plan 28-02 — public research listing card (RESEARCH-09).
 *
 * Server component (no client interactivity). Renders one published
 * research item per UI-SPEC Surface A "Research Card Component":
 *
 *   1. Type badge (green pill, --research-status-published-* tokens)
 *   2. Title link → /research/items/{id}
 *   3. Author line via formatAuthorsForDisplay (D-05 single source of truth;
 *      anonymous → "Source: Confidential")
 *   4. Published date as <time datetime>
 *   5. CTA: file-backed → Download anchor → /api/research/{id}/download;
 *      URL-only → External link with target=_blank rel=noopener noreferrer.
 *
 * Cards do NOT show: linked sections count, abstract, DOI, internal metadata
 * (CONTEXT.md Q9). Those are detail-page only.
 */
import Link from 'next/link'
import { format } from 'date-fns'
import { Download, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatAuthorsForDisplay } from '@/src/lib/research-utils'
import type { PublicResearchItem, ResearchItemType } from '@/src/server/queries/research-public'

const TYPE_LABELS: Record<ResearchItemType, string> = {
  report: 'Report',
  paper: 'Paper',
  dataset: 'Dataset',
  memo: 'Memo',
  interview_transcript: 'Interview Transcript',
  media_coverage: 'Media Coverage',
  legal_reference: 'Legal Reference',
  case_study: 'Case Study',
}

export interface ResearchCardProps {
  item: PublicResearchItem
}

export function ResearchCard({ item }: ResearchCardProps) {
  const typeLabel = TYPE_LABELS[item.itemType]
  const authorLine = formatAuthorsForDisplay({
    isAuthorAnonymous: item.isAuthorAnonymous,
    authors: item.authors,
  })
  const pubDate = item.publishedDate ? new Date(item.publishedDate) : null

  return (
    <Card className="h-full flex flex-col p-4 transition-colors hover:bg-muted/30">
      <Badge
        className="bg-[oklch(0.9_0.08_145)] text-[oklch(0.4_0.12_145)] self-start mb-3"
        aria-label={`Type: ${typeLabel}`}
      >
        {typeLabel}
      </Badge>

      <Link
        href={`/research/items/${item.id}`}
        className="text-[20px] font-semibold leading-[1.2] line-clamp-2 text-foreground hover:underline underline-offset-4 mb-2"
      >
        {item.title}
      </Link>

      <p className="text-sm text-muted-foreground mb-1">{authorLine}</p>

      {pubDate && (
        <time
          dateTime={pubDate.toISOString()}
          className="text-xs text-muted-foreground mb-4"
        >
          Published {format(pubDate, 'MMM d, yyyy')}
        </time>
      )}

      <div className="mt-auto flex justify-end">
        {item.artifactId ? (
          <a
            href={`/api/research/${item.id}/download`}
            aria-label={`Download ${item.title} (${typeLabel})`}
            className="inline-flex items-center gap-1 min-w-[120px] min-h-11 justify-center rounded-md bg-primary text-primary-foreground px-3 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Download className="size-4" />
            Download
          </a>
        ) : item.externalUrl ? (
          <a
            href={item.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open external source for ${item.title} (opens in new tab)`}
            className="inline-flex items-center gap-1 min-w-[120px] min-h-11 justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted transition-colors"
          >
            <ExternalLink className="size-4" />
            View Source
          </a>
        ) : null}
      </div>
    </Card>
  )
}
