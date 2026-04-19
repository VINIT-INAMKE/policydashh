'use client'

import { useState, useMemo, useEffect } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { useSearchParams } from 'next/navigation'
import { MessageSquare, FileText, ExternalLink, Paperclip } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  StatusBadge,
  type FeedbackStatus,
} from '@/app/policies/[id]/feedback/_components/status-badge'

/**
 * My Outcomes tab - caller's own feedback submissions with inline decision log.
 *
 * Role gating happens at the parent GlobalFeedbackTabs level; this component
 * assumes the viewer is allowed to see their own outcomes.
 *
 * Uses trpc.feedback.listOwn which is caller-scoped by design. Per
 * E14/E18:
 *   - Renders the full `workflow_transitions` log (start-review, decision,
 *     close) with reviewer name and timestamp, not just the latest
 *     decisionRationale field.
 *   - Shows "Under Review" entries for submitted → under_review transitions
 *     (previously collapsed to "No decisions recorded yet").
 *   - Surfaces linked evidence so the submitter can confirm artifacts they
 *     attached earlier made it into the review loop.
 */
export function MyOutcomesTab() {
  const searchParams = useSearchParams()
  const initialSelected = searchParams.get('selected')
  const feedbackQuery = trpc.feedback.listOwn.useQuery()
  const [expandedId, setExpandedId] = useState<string | null>(initialSelected)

  const items = feedbackQuery.data ?? []

  // Honor ?selected=<id> on first mount and scroll the row into view so
  // notification deep-links land on the right item.
  useEffect(() => {
    if (!initialSelected) return
    const el = document.getElementById(`outcome-row-${initialSelected}`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [initialSelected])

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
          return (
            <div key={item.id} id={`outcome-row-${item.id}`}>
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
                <OutcomeDetails feedbackId={item.id} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * OutcomeDetails - expanded view for a single outcome row. Fetches the
 * full workflow-transitions log and attached evidence so the submitter
 * can see the entire review history, not just the most recent decision.
 *
 * E18: transitions include submitted → under_review so callers see
 * "Under Review" context instead of "No decisions recorded yet".
 */
function OutcomeDetails({ feedbackId }: { feedbackId: string }) {
  const transitionsQuery = trpc.feedback.listTransitions.useQuery({ feedbackId })
  const evidenceQuery = trpc.evidence.listByFeedback.useQuery({ feedbackId })

  const transitions = transitionsQuery.data ?? []
  const evidence = evidenceQuery.data ?? []

  return (
    <div className="rounded-b-md bg-muted px-4 py-3">
      {/* Decision log */}
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
          Decision log
        </span>
        {transitionsQuery.isLoading ? (
          <Skeleton className="h-6 w-full" />
        ) : transitions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activity recorded yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {transitions.map((t) => {
              const rationale =
                t.metadata && typeof t.metadata === 'object' && 'rationale' in t.metadata
                  ? ((t.metadata as Record<string, unknown>).rationale as string | null)
                  : null
              const ts = typeof t.timestamp === 'string'
                ? t.timestamp
                : new Date(t.timestamp as unknown as string).toISOString()
              return (
                <li key={t.id} className="flex flex-col gap-0.5 rounded-md bg-background/60 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {formatStateLabel(t.toState)}
                    </span>
                    <span>&middot;</span>
                    <span>{t.actorName ?? 'System'}</span>
                    <span>&middot;</span>
                    <span>{format(new Date(ts), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                  {rationale ? (
                    <p className="text-[14px] font-normal leading-[1.5]">
                      {rationale}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Evidence */}
      {(evidence.length > 0 || evidenceQuery.isLoading) && (
        <>
          <Separator className="my-3" />
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
              Linked evidence
            </span>
            {evidenceQuery.isLoading ? (
              <Skeleton className="h-6 w-full" />
            ) : (
              <ul className="flex flex-col gap-1">
                {evidence.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-sm">
                    {e.type === 'link' ? (
                      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : e.type === 'file' ? (
                      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-foreground hover:underline"
                    >
                      {e.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function formatStateLabel(state: string): string {
  return state
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
