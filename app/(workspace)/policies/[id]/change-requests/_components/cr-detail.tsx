'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { CRStatusBadge, type CRStatus } from './cr-status-badge'
import { CRLifecycleActions } from './cr-lifecycle-actions'
import { LinkedFeedbackList } from './linked-feedback-list'
import { AffectedSectionsTable } from './affected-sections-table'
import { CRDecisionLog } from './cr-decision-log'
import { trpc } from '@/src/trpc/client'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function CRDetailSkeleton() {
  return (
    <div className="mx-auto max-w-[800px] space-y-6 py-8">
      {/* Back link skeleton */}
      <Skeleton className="h-7 w-48" />
      {/* ID badge */}
      <Skeleton className="h-5 w-20" />
      {/* Title */}
      <Skeleton className="h-6 w-2/3" />
      {/* Metadata rows */}
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-1/2" />
      {/* Description */}
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      {/* Actions row */}
      <Skeleton className="h-9 w-48" />
    </div>
  )
}

interface CRDetailProps {
  crId: string
  documentId: string
}

export function CRDetail({ crId, documentId }: CRDetailProps) {
  const crQuery = trpc.changeRequest.getById.useQuery({ id: crId })
  const utils = trpc.useUtils()

  function handleStatusChange() {
    utils.changeRequest.getById.invalidate({ id: crId })
    utils.changeRequest.listTransitions.invalidate({ crId })
    utils.changeRequest.list.invalidate()
  }

  function handleSectionsChange() {
    utils.changeRequest.getById.invalidate({ id: crId })
  }

  if (crQuery.isLoading) {
    return <CRDetailSkeleton />
  }

  const cr = crQuery.data

  if (!cr) {
    return (
      <div className="mx-auto max-w-[800px] py-8">
        <p className="text-sm text-muted-foreground">Change request not found.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[800px] space-y-6 py-8">
      {/* Back link */}
      <Link href={`/policies/${documentId}/change-requests`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="size-4" />
          Back to Change Requests
        </Button>
      </Link>

      {/* CR-NNN badge */}
      <Badge
        variant="secondary"
        className="font-mono text-[14px]"
        aria-label={`Change Request ID ${cr.readableId}`}
      >
        {cr.readableId}
      </Badge>

      {/* Title */}
      <h1 className="text-[20px] font-semibold leading-[1.2]">{cr.title}</h1>

      {/* Status badge */}
      <CRStatusBadge status={cr.status as CRStatus} />

      {/* Owner row */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-normal text-muted-foreground">Owner</span>
        <span className="text-[14px] font-normal">{cr.ownerName ?? 'Unknown'}</span>
      </div>

      {/* Created/Updated row */}
      <div className="flex items-center gap-2 text-[12px] font-normal text-muted-foreground">
        <span>Created {formatDate(cr.createdAt as unknown as string)}</span>
        <span>&middot;</span>
        <span>Updated {formatDate(cr.updatedAt as unknown as string)}</span>
      </div>

      <Separator />

      {/* Description section */}
      <div className="space-y-2">
        <h2 className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
          DESCRIPTION
        </h2>
        <p className="text-[14px] font-normal leading-[1.5]">
          {cr.description}
        </p>
      </div>

      {/* Lifecycle Actions */}
      <CRLifecycleActions
        crId={cr.id}
        readableId={cr.readableId}
        title={cr.title}
        status={cr.status as CRStatus}
        documentId={documentId}
        onStatusChange={handleStatusChange}
      />

      <Separator />

      {/* Linked Feedback */}
      <div className="space-y-3">
        <h2 className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
          LINKED FEEDBACK
        </h2>
        <LinkedFeedbackList
          documentId={documentId}
          linkedFeedback={cr.linkedFeedback.map((fb) => ({
            id: fb.feedbackId,
            readableId: fb.readableId,
            title: fb.title,
            status: fb.status,
            sectionTitle: null,
          }))}
        />
      </div>

      <Separator />

      {/* Affected Sections */}
      <div className="space-y-3">
        <h2 className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
          AFFECTED SECTIONS
        </h2>
        <AffectedSectionsTable
          crId={cr.id}
          crStatus={cr.status as CRStatus}
          linkedSections={cr.linkedSections.map((s) => ({
            id: s.sectionId,
            title: s.title,
          }))}
          documentId={documentId}
          onSectionsChange={handleSectionsChange}
        />
      </div>

      <Separator />

      {/* Decision Log */}
      <CRDecisionLog crId={cr.id} />
    </div>
  )
}
