'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { MilestoneStatusBadge, type MilestoneStatus } from './milestone-status-badge'

interface MilestoneCardProps {
  documentId: string
  milestone: {
    id: string
    title: string
    description: string | null
    status: MilestoneStatus
    createdAt: string | Date
  }
}

export function MilestoneCard({ documentId, milestone }: MilestoneCardProps) {
  const createdLabel = new Date(milestone.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
  return (
    <Link
      href={`/policies/${documentId}/milestones/${milestone.id}`}
      className="block rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <Card className="flex items-center gap-4 p-4 transition hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{milestone.title}</h3>
            <MilestoneStatusBadge status={milestone.status} />
          </div>
          {milestone.description ? (
            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
              {milestone.description}
            </p>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">{createdLabel}</span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </Card>
    </Link>
  )
}
