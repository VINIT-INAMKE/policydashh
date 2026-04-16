'use client'

import { useState, useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { MessageSquare } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  StatusBadge,
  type FeedbackStatus,
} from '@/app/(workspace)/policies/[id]/feedback/_components/status-badge'

/**
 * My Outcomes tab - caller's own feedback submissions with inline decision log.
 *
 * Role gating happens at the parent GlobalFeedbackTabs level; this component
 * assumes the viewer is allowed to see their own outcomes.
 *
 * Uses trpc.feedback.listOwn which is caller-scoped by design.
 */
export function MyOutcomesTab() {
  const feedbackQuery = trpc.feedback.listOwn.useQuery()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const items = feedbackQuery.data ?? []

  const stats = useMemo(() => {
    const total = items.length
    const accepted = items.filter(
      (i) => i.status === 'accepted' || i.status === 'partially_accepted'
    ).length
    const pending = items.filter(
      (i) => i.status === 'submitted' || i.status === 'under_review'
    ).length
    return { total, accepted, pending }
  }, [items])

  if (feedbackQuery.isLoading) {
    return (
      <div className="flex flex-col gap-2 pt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <MessageSquare className="size-12 text-muted-foreground" />
        <h2 className="mt-4 text-[20px] font-semibold leading-[1.2]">
          No feedback submitted yet
        </h2>
        <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
          Submit feedback on the sections you&apos;re assigned to. Your
          submissions and their outcomes will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pt-4">
      {/* Summary stats row */}
      <div className="flex gap-6">
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
            Accepted / Partially
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

      {/* Feedback items list */}
      <div className="flex flex-col gap-1">
        {items.map((item) => {
          const isExpanded = expandedId === item.id
          const hasDecision =
            item.status === 'accepted' ||
            item.status === 'partially_accepted' ||
            item.status === 'rejected' ||
            item.status === 'closed'

          return (
            <div key={item.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-t-md px-3 py-2 text-left transition-colors hover:bg-muted/50"
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <Badge
                  variant="secondary"
                  className="shrink-0 border-transparent font-mono text-[12px]"
                  aria-label={`Feedback ID ${item.readableId}`}
                >
                  {item.readableId}
                </Badge>

                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[14px] font-normal">
                    {item.title}
                  </span>
                  <span className="text-[12px] font-normal text-muted-foreground">
                    {formatDistanceToNow(new Date(item.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>

                <StatusBadge status={item.status as FeedbackStatus} />
              </button>

              {isExpanded && (
                <div className="rounded-b-md bg-muted px-4 py-3">
                  {hasDecision ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
                        Decision
                      </span>
                      <p className="text-[14px] font-normal leading-[1.5]">
                        {item.decisionRationale ?? 'No rationale provided.'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No decisions recorded yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
