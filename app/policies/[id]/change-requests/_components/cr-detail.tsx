'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft, MessageSquareWarning } from 'lucide-react'
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
  // A7: pull the workflow-transition log so we can surface the most
  // recent REQUEST_CHANGES rationale prominently when the CR is back in
  // drafting — owners shouldn't have to scroll to the decision log to
  // learn what they need to fix.
  const transitionsQuery = trpc.changeRequest.listTransitions.useQuery({ crId })
  const meQuery = trpc.user.getMe.useQuery()
  const role = meQuery.data?.role
  const canManageCR = role === 'admin' || role === 'policy_lead'
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

  // A13: distinguish query errors from a clean "not found" miss. A transient
  // network error used to render the same plain "Change request not found"
  // message as a 404, leaving the user with no way to recover other than
  // refreshing the page.
  if (crQuery.isError) {
    const code = crQuery.error.data?.code
    if (code !== 'NOT_FOUND') {
      return (
        <div className="mx-auto flex max-w-[800px] flex-col items-center gap-4 py-12">
          <AlertTriangle className="size-10 text-amber-500" aria-hidden="true" />
          <div className="text-center">
            <p className="text-sm font-semibold">Couldn&apos;t load this change request.</p>
            <p className="mt-1 max-w-[400px] text-xs text-muted-foreground">
              {crQuery.error.message ||
                'Something went wrong while loading the change request. Check your connection and try again.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => crQuery.refetch()}
              disabled={crQuery.isFetching}
            >
              {crQuery.isFetching ? 'Retrying…' : 'Retry'}
            </Button>
            <Link
              href={`/policies/${documentId}/change-requests`}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Back to Change Requests
            </Link>
          </div>
        </div>
      )
    }
  }

  const cr = crQuery.data

  if (!cr) {
    return (
      <div className="mx-auto max-w-[800px] py-8">
        <p className="text-sm text-muted-foreground">Change request not found.</p>
      </div>
    )
  }

  // A7: find the most-recent REQUEST_CHANGES transition and surface its
  // rationale at the top of the page whenever the CR is still open (i.e.
  // not yet merged or closed). The XState machine routes REQUEST_CHANGES
  // back to `in_review`, so the banner is primarily visible while the
  // reviewer's notes are actionable. The same rationale also lives in
  // the decision log below but owners missed it there.
  const transitions = transitionsQuery.data ?? []
  const latestRequestChanges = [...transitions]
    .reverse()
    .find((t) => {
      const meta = t.metadata as Record<string, unknown> | null
      return meta?.event === 'REQUEST_CHANGES'
    })
  const requestChangesRationale =
    latestRequestChanges &&
    ((latestRequestChanges.metadata as Record<string, unknown> | null)?.rationale as string | undefined)
  const showRequestChangesBanner =
    (cr.status === 'drafting' || cr.status === 'in_review') && requestChangesRationale

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

      {/* A7: surface the reviewer's "Request Changes" rationale prominently
          when the CR has been bounced back to drafting. The rationale also
          lives in the decision log below but owners missed it there. */}
      {showRequestChangesBanner && (
        <div
          role="status"
          className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/40"
        >
          <MessageSquareWarning className="mt-0.5 size-5 flex-shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-100">
              Changes requested
            </p>
            <p className="text-[14px] leading-[1.5] text-amber-900 dark:text-amber-100">
              {requestChangesRationale}
            </p>
          </div>
        </div>
      )}

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

      {/* Approval / merge / closure metadata (G4) */}
      {(cr.approvedAt || cr.mergedAt || cr.closureRationale) && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-4">
          {cr.approvedAt && (
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-muted-foreground">Approved</span>
              <span className="font-normal">
                {formatDate(cr.approvedAt as unknown as string)}
              </span>
              {cr.approverName && (
                <>
                  <span className="text-muted-foreground">by</span>
                  <span className="font-normal">{cr.approverName}</span>
                </>
              )}
            </div>
          )}
          {cr.mergedAt && (
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-muted-foreground">Merged</span>
              <span className="font-normal">
                {formatDate(cr.mergedAt as unknown as string)}
              </span>
              {cr.mergerName && (
                <>
                  <span className="text-muted-foreground">by</span>
                  <span className="font-normal">{cr.mergerName}</span>
                </>
              )}
              {cr.mergedVersionLabel && (
                <>
                  <span className="text-muted-foreground">into</span>
                  <Badge variant="secondary" className="font-mono text-[12px]">
                    {cr.mergedVersionLabel}
                  </Badge>
                </>
              )}
            </div>
          )}
          {cr.closureRationale && (
            <div className="space-y-1">
              <div className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
                Closure Rationale
              </div>
              <p className="text-[14px] font-normal leading-[1.5]">
                {cr.closureRationale}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Lifecycle Actions */}
      {canManageCR && (
        <CRLifecycleActions
          crId={cr.id}
          readableId={cr.readableId}
          title={cr.title}
          status={cr.status as CRStatus}
          documentId={documentId}
          onStatusChange={handleStatusChange}
        />
      )}

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
            sectionTitle: fb.sectionTitle ?? null,
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
          canManage={canManageCR}
        />
      </div>

      <Separator />

      {/* Decision Log */}
      <CRDecisionLog crId={cr.id} />
    </div>
  )
}
