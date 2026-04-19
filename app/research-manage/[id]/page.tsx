'use client'

import { useParams } from 'next/navigation'
import { Download, ExternalLink } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ResearchStatusBadge } from '../_components/research-status-badge'
import { ResearchDecisionLog } from './_components/research-decision-log'
import { ResearchLifecycleActions } from './_components/lifecycle-actions'
import { formatAuthorsForDisplay } from '@/src/lib/research-utils'
import type { Role } from '@/src/lib/constants'

/**
 * /research-manage/[id] — Phase 27 Plan 04 (RESEARCH-07).
 *
 * Two-column detail page that mounts:
 *   1. Metadata header (title, status badge, readableId chip, type)
 *   2. Metadata grid (authors via shouldHideAuthors, published date, journal,
 *      DOI, peer reviewed)
 *   3. Description prose
 *   4. Artifact link OR external URL
 *   5. ResearchDecisionLog (workflow_transitions via tRPC, Plan 04 Task 1)
 *   6. Linked Entities placeholder — Plan 05 replaces with picker triggers
 *
 * Right sidebar mounts ResearchLifecycleActions (Plan 04 Task 2) which
 * derives the visible button set from currentUserRole + status + ownership.
 *
 * Author display uses formatAuthorsForDisplay (D-05 single source of truth)
 * so the page renders identically to the AnonymousPreviewCard on the form.
 *
 * Artifact download is intentionally a "Attachment on file" placeholder
 * (presigned-GET plumbing deferred to Phase 28 public listing — see also
 * the Plan 03 SUMMARY edit-mode prefill shortcut).
 */

function formatItemType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function ResearchItemDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const meQuery = trpc.user.getMe.useQuery()
  const itemQuery = trpc.research.getById.useQuery({ id })

  if (itemQuery.isLoading || meQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="w-full lg:w-80 space-y-4">
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  const item = itemQuery.data
  const me = meQuery.data
  if (!item || !me) return null

  const authorDisplay = formatAuthorsForDisplay({
    isAuthorAnonymous: item.isAuthorAnonymous,
    authors: item.authors ?? null,
  })

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Main column */}
      <div className="flex-1 space-y-6">
        <div className="flex items-start gap-3">
          <h1 className="flex-1 text-xl font-semibold leading-tight">
            {item.title}
          </h1>
          <ResearchStatusBadge status={item.status} />
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Badge variant="secondary" className="font-mono">
            {item.readableId}
          </Badge>
          <span>{formatItemType(item.itemType)}</span>
        </div>

        {/* Metadata grid */}
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Authors</dt>
            <dd className="text-sm">
              {authorDisplay.replace(/^Authors: /, '').replace('Source: Confidential', 'Confidential')}
            </dd>
          </div>
          {item.publishedDate && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Published</dt>
              <dd className="text-sm">{item.publishedDate}</dd>
            </div>
          )}
          {item.journalOrSource && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Journal / Source</dt>
              <dd className="text-sm">{item.journalOrSource}</dd>
            </div>
          )}
          {item.doi && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">DOI</dt>
              <dd className="text-sm">
                <a
                  href={`https://doi.org/${item.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  {item.doi}
                </a>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Peer Reviewed</dt>
            <dd className="text-sm">{item.peerReviewed ? 'Yes' : 'No'}</dd>
          </div>
        </dl>

        {item.description && (
          <div className="space-y-2">
            <h2 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Description
            </h2>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {item.description}
            </p>
          </div>
        )}

        {/* Artifact / external URL */}
        {item.externalUrl && (
          <div>
            <Button
              variant="outline"
              onClick={() => window.open(item.externalUrl!, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="size-3.5" />
              Open External Source
            </Button>
          </div>
        )}
        {item.artifactId && (
          <div>
            <ArtifactDownloadLink artifactId={item.artifactId} />
          </div>
        )}

        <Separator />

        {/* Decision Log */}
        <ResearchDecisionLog researchItemId={item.id} />

        {/* Linked entities placeholder — Plan 05 replaces this block */}
        <Separator />
        <div className="space-y-2">
          <h2 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
            Linked Entities
          </h2>
          <p className="text-sm text-muted-foreground">
            Link pickers ship in Plan 05.
          </p>
        </div>
      </div>

      {/* Right sidebar */}
      <aside className="w-full lg:w-80 lg:shrink-0 space-y-4">
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <ResearchLifecycleActions
            itemId={item.id}
            status={item.status}
            createdBy={item.createdBy}
            currentUserId={me.id}
            currentUserRole={(me.role ?? null) as Role | null}
          />
        </div>
      </aside>
    </div>
  )
}

/**
 * Phase 27 shortcut: existing evidence module does not expose a
 * getArtifact tRPC query. Detail page shows a muted "Attachment on
 * file" row with a short artifactId caption. Phase 28 public listing
 * will add the presigned-GET plumbing (or a follow-up plan can extend
 * trpc.evidence with a getArtifact query — at which point this
 * component swaps the placeholder for filename + size + download link).
 */
function ArtifactDownloadLink({ artifactId }: { artifactId: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
      <Download className="size-4 text-muted-foreground" />
      <span>Attachment on file</span>
      <span className="ml-auto font-mono text-xs text-muted-foreground">
        {artifactId.slice(0, 8)}
      </span>
    </div>
  )
}
