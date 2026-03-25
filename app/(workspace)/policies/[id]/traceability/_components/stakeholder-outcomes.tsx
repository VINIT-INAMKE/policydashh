'use client'

import { useMemo } from 'react'
import { User, CheckCircle, Info } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge, type FeedbackStatus } from '../../feedback/_components/status-badge'

interface StakeholderOutcomesProps {
  documentId: string
}

interface OutcomeRow {
  feedbackId: string
  readableId: string
  title: string
  status: string
  decisionRationale: string | null
  resolvedInVersionId: string | null
  versionLabel: string | null
  sectionId: string | null
  sectionTitle: string | null
  createdAt: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function StakeholderOutcomes({ documentId }: StakeholderOutcomesProps) {
  const outcomesQuery = trpc.traceability.stakeholderOutcomes.useQuery({
    documentId,
  })

  const items = (outcomesQuery.data ?? []) as OutcomeRow[]

  // Summary stats
  const stats = useMemo(() => {
    const total = items.length
    const accepted = items.filter(
      (i) => i.status === 'accepted' || i.status === 'partially_accepted'
    ).length
    const rejected = items.filter((i) => i.status === 'rejected').length
    const pending = items.filter(
      (i) => i.status === 'submitted' || i.status === 'under_review'
    ).length
    return { total, accepted, rejected, pending }
  }, [items])

  // Loading state
  if (outcomesQuery.isLoading) {
    return (
      <div className="mx-auto max-w-[800px] p-6">
        {/* Stats skeleton */}
        <div className="mb-6 flex gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24" />
          ))}
        </div>
        {/* Card skeletons */}
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4 ring-1 ring-foreground/10">
              <Skeleton className="mb-2 h-4 w-1/2" />
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-[800px] p-6">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <User className="size-12 text-muted-foreground" />
          <p className="mt-4 text-[14px] text-muted-foreground">
            No feedback outcomes to display.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[800px] p-6">
      {/* Summary stats row */}
      <div className="mb-6 flex gap-6">
        <div className="flex flex-col">
          <span className="text-[20px] font-semibold leading-[1.2]">
            {stats.total}
          </span>
          <span className="text-[12px] font-normal text-muted-foreground">
            Total
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[20px] font-semibold leading-[1.2]">
            {stats.accepted}
          </span>
          <span className="text-[12px] font-normal text-muted-foreground">
            Accepted
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[20px] font-semibold leading-[1.2]">
            {stats.rejected}
          </span>
          <span className="text-[12px] font-normal text-muted-foreground">
            Rejected
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[20px] font-semibold leading-[1.2]">
            {stats.pending}
          </span>
          <span className="text-[12px] font-normal text-muted-foreground">
            Pending
          </span>
        </div>
      </div>

      {/* Outcome cards */}
      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <Card key={item.feedbackId}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="shrink-0 border-transparent font-mono text-[12px]"
                  >
                    {item.readableId}
                  </Badge>
                  <span className="truncate text-[14px] font-semibold">
                    {item.title}
                  </span>
                </div>
                <StatusBadge status={item.status as FeedbackStatus} />
              </div>
              <div className="text-[12px] font-normal text-muted-foreground">
                {item.sectionTitle ?? 'No section'}
                {' \u00B7 '}
                {formatDate(item.createdAt)}
              </div>
            </CardHeader>

            <CardContent>
              {/* Decision rationale */}
              {item.decisionRationale && (
                <p className="text-[14px] font-normal leading-[1.5]">
                  Decision: {item.decisionRationale}
                </p>
              )}

              {/* Version influence note */}
              {item.resolvedInVersionId && item.versionLabel && (
                <div className="mt-2 flex items-center gap-1.5">
                  <CheckCircle className="size-3 text-green-600" />
                  <span className="text-[12px] font-normal text-muted-foreground">
                    Influenced version {item.versionLabel}
                  </span>
                </div>
              )}
            </CardContent>

            {/* Footer for rejected items without version influence */}
            {item.status === 'rejected' && !item.resolvedInVersionId && (
              <CardFooter>
                <div className="flex items-center gap-1.5">
                  <Info className="size-3 text-muted-foreground" />
                  <span className="text-[12px] font-normal text-muted-foreground">
                    No version influence recorded
                  </span>
                </div>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
