'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog as SheetPrimitive } from '@base-ui/react/dialog'
import { cn } from '@/lib/utils'
import { trpc } from '@/src/trpc/client'
import type { Role } from '@/src/lib/constants'
import { TriageActions } from './triage-actions'
import { DecisionLog } from './decision-log'
import { EvidenceList } from './evidence-list'
import { StatusBadge, type FeedbackStatus } from './status-badge'

interface FeedbackDetailSheetProps {
  feedbackId: string | null
  // R7: optional documentId scope passed by the inbox so a crafted
  // ?selected=<id from a different policy> returns NOT_FOUND instead of
  // cross-leaking a feedback item across policies. When omitted the sheet
  // falls back to the unscoped lookup for non-inbox callers (e.g. global
  // feedback detail page).
  documentId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    high: 'bg-[var(--status-priority-high-bg)] text-destructive',
    medium: 'bg-[var(--status-priority-medium-bg)] text-[var(--status-priority-medium-text)]',
    low: 'bg-muted text-muted-foreground',
  }
  return (
    <Badge variant="secondary" className={cn('border-0 text-xs', styles[priority] ?? '')}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  )
}

function SheetSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

export function FeedbackDetailSheet({
  feedbackId,
  documentId,
  open,
  onOpenChange,
}: FeedbackDetailSheetProps) {
  // R7: scope the getById lookup by the calling page's documentId when
  // provided. A crafted ?selected= pointing at another policy returns
  // NOT_FOUND before the ownership / read_all branch is even reached.
  const feedbackQuery = trpc.feedback.getById.useQuery(
    { id: feedbackId!, documentId },
    { enabled: !!feedbackId },
  )

  const transitionsQuery = trpc.feedback.listTransitions.useQuery(
    { feedbackId: feedbackId! },
    { enabled: !!feedbackId },
  )

  const meQuery = trpc.user.getMe.useQuery()
  const role = meQuery.data?.role as Role | undefined

  const utils = trpc.useUtils()

  function handleStatusChange() {
    if (feedbackId) {
      utils.feedback.getById.invalidate({ id: feedbackId })
      utils.feedback.listTransitions.invalidate({ feedbackId })
      utils.feedback.list.invalidate()
    }
  }

  const feedback = feedbackQuery.data
  const transitions = transitionsQuery.data ?? []

  // Map transitions to DecisionLog format. R22: include the PK id so the
  // DecisionLog can use it as the React key instead of the collision-
  // prone `toState+timestamp` composite.
  const decisionLogTransitions = transitions.map((t) => ({
    id: t.id,
    fromState: t.fromState,
    toState: t.toState,
    actorName: t.actorName,
    timestamp: typeof t.timestamp === 'string' ? t.timestamp : new Date(t.timestamp as unknown as string).toISOString(),
    rationale: t.metadata && typeof t.metadata === 'object' && 'rationale' in t.metadata
      ? (t.metadata as Record<string, unknown>).rationale as string | null
      : null,
  }))

  // feedback:review - admin, policy_lead only
  const canTriage = role === 'admin' || role === 'policy_lead'
  // evidence:upload - admin, policy_lead, research_lead, workshop_moderator, stakeholder (NOT observer, auditor)
  const canAddEvidence = role === 'admin' || role === 'policy_lead' || role === 'research_lead' || role === 'workshop_moderator' || role === 'stakeholder'

  return (
    <SheetPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-black/10 backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <SheetPrimitive.Popup
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-background shadow-lg outline-none sm:max-w-[480px]',
            'data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right',
            'duration-200',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <SheetPrimitive.Title className="sr-only">
              Feedback Detail
            </SheetPrimitive.Title>
            <SheetPrimitive.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close feedback detail"
                />
              }
            >
              <X className="size-4" />
            </SheetPrimitive.Close>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            {feedbackQuery.isLoading ? (
              <SheetSkeleton />
            ) : feedback ? (
              <div className="space-y-6 p-6">
                {/* ID + Status badges */}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {feedback.readableId}
                  </Badge>
                  <StatusBadge status={feedback.status as FeedbackStatus} />
                </div>

                {/* Title */}
                <h2 className="text-xl font-semibold leading-tight">
                  {feedback.title}
                </h2>

                {/* Metadata row */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {feedback.submitterOrgType && (
                    <Badge variant="outline" className="text-xs">
                      {feedback.submitterOrgType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Badge>
                  )}
                  <span>
                    {feedback.isAnonymous
                      ? 'Anonymous'
                      : feedback.submitterName ?? 'Unknown'}
                  </span>
                  <span>&middot;</span>
                  <span>{formatDate(feedback.createdAt as unknown as string)}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={feedback.priority} />
                  <Badge variant="outline" className="text-xs">
                    {feedback.feedbackType.charAt(0).toUpperCase() +
                      feedback.feedbackType.slice(1)}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {feedback.impactCategory.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Badge>
                </div>

                <Separator />

                {/* Body text */}
                <p className="text-sm leading-relaxed">{feedback.body}</p>

                {/* Suggested change */}
                {feedback.suggestedChange && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                      Suggested Change
                    </h3>
                    <div className="rounded-md bg-muted p-4 text-sm">
                      {feedback.suggestedChange}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Evidence section */}
                <EvidenceList
                  feedbackId={feedback.id}
                  canAdd={canAddEvidence}
                />

                <Separator />

                {/* Decision Log */}
                <DecisionLog transitions={decisionLogTransitions} />
              </div>
            ) : (
              <div className="p-6 text-sm text-muted-foreground">
                Feedback not found.
              </div>
            )}
          </ScrollArea>

          {/* Triage Actions - sticky bottom */}
          {feedback && canTriage && (
            <div className="border-t bg-background px-6 py-4">
              <TriageActions
                feedbackId={feedback.id}
                feedbackReadableId={feedback.readableId}
                status={feedback.status as FeedbackStatus}
                onStatusChange={handleStatusChange}
              />
            </div>
          )}
        </SheetPrimitive.Popup>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  )
}
