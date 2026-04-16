'use client'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { trpc } from '@/src/trpc/client'
import { MilestoneCard } from './milestone-card'
import { CreateMilestoneDialog } from './create-milestone-dialog'
import type { MilestoneStatus } from './milestone-status-badge'

interface MilestoneListProps {
  documentId: string
  canManage: boolean
}

export function MilestoneList({ documentId, canManage }: MilestoneListProps) {
  const { data, isLoading } = trpc.milestone.list.useQuery({ documentId })

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  const milestones = data ?? []

  if (milestones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <div className="text-center">
          <h3 className="text-sm font-semibold">No milestones yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a milestone to group versions, workshops, feedback, and evidence for Cardano anchoring.
          </p>
        </div>
        {canManage ? (
          <CreateMilestoneDialog
            documentId={documentId}
            trigger={<Button variant="default">Create milestone</Button>}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {milestones.map((m) => (
        <MilestoneCard
          key={m.id}
          documentId={documentId}
          milestone={{
            id: m.id,
            title: m.title,
            description: m.description,
            status: m.status as MilestoneStatus,
            createdAt: m.createdAt,
          }}
        />
      ))}
    </div>
  )
}
