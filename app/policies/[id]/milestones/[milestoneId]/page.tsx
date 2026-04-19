'use client'

import { use } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
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
  const { data, isLoading, error } = trpc.milestone.getById.useQuery({ milestoneId })

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !data) {
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
        canManage
      />
      <div className="flex-1 overflow-y-auto px-6">
        <MilestoneDetailTabs
          milestoneId={milestone.id}
          documentId={documentId}
          isReadOnly={isReadOnly}
          onMutated={() => {}}
        />
      </div>
    </div>
  )
}
