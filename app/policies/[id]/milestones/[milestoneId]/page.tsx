'use client'

import { use } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { trpc } from '@/src/trpc/client'
import { MilestoneDetailHeader } from './_components/milestone-detail-header'
import { MilestoneDetailTabs } from './_components/milestone-detail-tabs'
import type { MilestoneStatus } from '../_components/milestone-status-badge'

export default function MilestoneDetailPage({
  params,
}: {
  params: Promise<{ id: string; milestoneId: string }>
}) {
  const { id: documentId, milestoneId } = use(params)
  // D18: drop the redundant `force` state — the tabs call
  // `utils.milestone.getById.invalidate()` which re-renders this tree via
  // tRPC's reactive cache. The old `force` counter never did anything useful.
  const milestoneQuery = trpc.milestone.getById.useQuery({ milestoneId })
  const { data, isLoading, error } = milestoneQuery
  // A4: derive canManage from the signed-in user's role instead of hardcoding
  // `true`. A stakeholder or workshop_moderator visiting this page was
  // previously shown the "Mark ready" button and attach/detach toggles —
  // the server rejected the click but the UI gave a confusing experience.
  const meQuery = trpc.user.getMe.useQuery()
  const canManage =
    meQuery.data?.role === 'admin' || meQuery.data?.role === 'policy_lead'

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // A14: only delegate to notFound() for true NOT_FOUND results. A transient
  // network error or INTERNAL_SERVER_ERROR used to render the generic 404
  // page with no way to retry — users couldn't tell if the milestone was
  // actually missing or if the server was just flaky.
  if (error) {
    if (error.data?.code === 'NOT_FOUND') {
      return notFound()
    }
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        <AlertTriangle className="size-10 text-amber-500" aria-hidden="true" />
        <div className="text-center">
          <p className="text-sm font-semibold">Couldn&apos;t load this milestone.</p>
          <p className="mt-1 max-w-[400px] text-xs text-muted-foreground">
            {error.message ||
              'Something went wrong while loading the milestone. Check your connection and try again.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => milestoneQuery.refetch()}
            disabled={milestoneQuery.isFetching}
          >
            {milestoneQuery.isFetching ? 'Retrying…' : 'Retry'}
          </Button>
          <Link
            href={`/policies/${documentId}/milestones`}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Back to milestones
          </Link>
        </div>
      </div>
    )
  }

  if (!data) {
    return notFound()
  }

  const { milestone, slotStatus } = data
  const status = milestone.status as MilestoneStatus
  const isReadOnly = status === 'ready' || status === 'anchoring' || status === 'anchored'

  return (
    <div className="flex h-full flex-col">
      {/* D16: breadcrumb back to the milestones list. */}
      <div className="px-6 pt-4">
        <Link
          href={`/policies/${documentId}/milestones`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          Back to milestones
        </Link>
      </div>
      <MilestoneDetailHeader
        milestoneId={milestone.id}
        documentId={documentId}
        title={milestone.title}
        description={milestone.description}
        status={status}
        contentHash={milestone.contentHash}
        txHash={milestone.txHash ?? null}
        anchoredAt={milestone.anchoredAt ? new Date(milestone.anchoredAt).toISOString() : null}
        slotStatus={slotStatus}
        canManage={canManage}
      />
      <div className="flex-1 overflow-y-auto px-6">
        <MilestoneDetailTabs
          milestoneId={milestone.id}
          documentId={documentId}
          isReadOnly={isReadOnly || !canManage}
          onMutated={() => {}}
        />
      </div>
    </div>
  )
}
