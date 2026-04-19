'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { VersionStatusBadge } from './version-status-badge'
import { VersionChangelog } from './version-changelog'
import { PublishDialog } from './publish-dialog'
import { VersionComparisonSelector } from './version-comparison-selector'
import { SummaryReviewCard } from './summary-review-card'

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function VersionDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-4 w-1/3" />
      <Separator />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  )
}

interface VersionListItem {
  id: string
  versionLabel: string
  isPublished: boolean
  publishedAt: string | null
  createdAt: string
  creatorName: string | null
}

interface VersionDetailProps {
  versionId: string
  documentId: string
  documentTitle?: string
  versions: VersionListItem[]
  canPublish?: boolean
}

export function VersionDetail({ versionId, documentId, documentTitle, versions, canPublish = false }: VersionDetailProps) {
  const [publishOpen, setPublishOpen] = useState(false)

  const versionQuery = trpc.version.getById.useQuery(
    { id: versionId },
    { enabled: !!versionId },
  )

  if (versionQuery.isLoading) {
    return <VersionDetailSkeleton />
  }

  const version = versionQuery.data

  if (!version) {
    return (
      <p className="text-sm text-muted-foreground">Version not found.</p>
    )
  }

  const changelog = version.changelog as Array<{
    crId: string | null
    crReadableId: string | null
    crTitle: string
    summary: string
    feedbackIds: string[]
    affectedSectionIds: string[]
  }> | null

  return (
    <div className="space-y-6">
      {/* Version label */}
      <h2 className="font-mono text-[20px] font-semibold leading-[1.2]">
        {version.versionLabel}
      </h2>

      {/* Status badge */}
      <VersionStatusBadge
        isPublished={version.isPublished}
        publishedAt={version.publishedAt as string | null}
      />

      {/* Metadata rows */}
      <div className="space-y-1">
        <p className="text-[12px] font-normal text-muted-foreground">
          Created by {version.creatorName ?? 'Unknown'} on{' '}
          {formatDateTime(version.createdAt as unknown as string)}
        </p>
        {version.crId ? (
          <p className="text-[12px] font-normal text-muted-foreground">
            From merge of{' '}
            <Link
              href={`/policies/${documentId}/change-requests/${version.crId}`}
              className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] hover:underline"
            >
              CR
            </Link>
          </p>
        ) : (
          <p className="text-[12px] font-normal text-muted-foreground">
            Manually created
          </p>
        )}
        {version.isPublished && version.publishedAt && (
          <p className="text-[12px] font-normal text-muted-foreground">
            Published on {formatDateTime(version.publishedAt as unknown as string)}
          </p>
        )}
      </div>

      <Separator />

      {/* Changelog */}
      <VersionChangelog changelog={changelog} />

      {/* Publish button or immutable indicator */}
      {version.isPublished ? (
        <p className="text-[14px] font-normal text-muted-foreground">
          This version is published and immutable. No further edits are possible.
        </p>
      ) : canPublish ? (
        <Button
          variant="default"
          onClick={() => setPublishOpen(true)}
          aria-label={`Publish version ${version.versionLabel}`}
        >
          <Lock className="size-4" />
          Publish Version
        </Button>
      ) : null}

      {/* Consultation summary moderator review - only for published versions */}
      {version.isPublished && (
        <>
          <Separator />
          <SummaryReviewCard versionId={version.id} />
        </>
      )}

      <Separator />

      {/* Diff section */}
      <h3 className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
        SECTION DIFF
      </h3>
      <VersionComparisonSelector
        versions={versions}
        documentId={documentId}
        currentVersionId={versionId}
      />

      {/* Publish dialog */}
      {canPublish && (
        <PublishDialog
          open={publishOpen}
          onOpenChange={setPublishOpen}
          versionId={version.id}
          versionLabel={version.versionLabel}
          documentTitle={documentTitle ?? ''}
          changelog={changelog}
        />
      )}
    </div>
  )
}
