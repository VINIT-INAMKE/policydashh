'use client'

import { use, useState } from 'react'
import { notFound } from 'next/navigation'
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
  const [, force] = useState(0)
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
          onMutated={() => force((n) => n + 1)}
        />
      </div>
    </div>
  )
}
