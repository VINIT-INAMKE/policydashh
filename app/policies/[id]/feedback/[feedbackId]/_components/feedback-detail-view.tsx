'use client'

import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { trpc } from '@/src/trpc/client'
import type { Role } from '@/src/lib/constants'
import { TriageActions } from '../../_components/triage-actions'
import { DecisionLog } from '../../_components/decision-log'
import { EvidenceList } from '../../_components/evidence-list'
import { StatusBadge, type FeedbackStatus } from '../../_components/status-badge'
import { cn } from '@/lib/utils'

interface FeedbackDetailViewProps {
  documentId: string
  feedbackId: string
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

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-8 w-2/3" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-5 w-18" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-px w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-px w-full" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-px w-full" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}

export function FeedbackDetailView({ documentId, feedbackId }: FeedbackDetailViewProps) {
  // R7: scope the getById lookup by documentId so a crafted URL pointing
  // at a feedback item from another policy returns NOT_FOUND.
  const feedbackQuery = trpc.feedback.getById.useQuery(
    { id: feedbackId, documentId },
  )

  const transitionsQuery = trpc.feedback.listTransitions.useQuery(
    { feedbackId },
  )

  const meQuery = trpc.user.getMe.useQuery()
  const role = meQuery.data?.role as Role | undefined

  const utils = trpc.useUtils()

  function handleStatusChange() {
    utils.feedback.getById.invalidate({ id: feedbackId })
    utils.feedback.listTransitions.invalidate({ feedbackId })
    utils.feedback.list.invalidate()
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
  // evidence:upload - admin, policy_lead, research_lead, workshop_moderator, stakeholder
  const canAddEvidence = role === 'admin' || role === 'policy_lead' || role === 'research_lead' || role === 'workshop_moderator' || role === 'stakeholder'
  // section:manage - admin, policy_lead. Same set as canTriage today, but
  // checked separately because the editor is gated on `section:manage`,
  // not `feedback:review`.
  const canEditSection = role === 'admin' || role === 'policy_lead'

  const backHref = `/policies/${documentId}/feedback`
  // Deep-link to the section editor pre-loaded with the feedback id so
  // the editor can render a contextual banner ("Editing in response to
  // FB-014") and the lead's edit lands tied to the originating feedback
  // for auditability.
  const editSectionHref =
    feedbackQuery.data?.sectionId
      ? `/policies/${documentId}?section=${feedbackQuery.data.sectionId}&fromFeedback=${feedbackId}`
      : null

  return (
    <div className="min-h-screen bg-background">
      {/* Back navigation */}
      <div className="border-b px-4 py-2 lg:px-6">
        <Link href={backHref}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Feedback Inbox
          </Button>
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {feedbackQuery.isLoading ? (
          <PageSkeleton />
        ) : !feedback ? (
          // Not found: wrong policy scope, bad ID, or unauth
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-lg font-semibold">Feedback not found</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This feedback item does not exist or you do not have access to it.
            </p>
            <Link href={backHref} className="mt-6">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to Feedback Inbox
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ID + Status badges */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">
                {feedback.readableId}
              </Badge>
              <StatusBadge status={feedback.status as FeedbackStatus} />
            </div>

            {/* Title */}
            <h1 className="text-2xl font-semibold leading-tight">
              {feedback.title}
            </h1>

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

            {/* Priority + type + impact badges */}
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
                <h2 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                  Suggested Change
                </h2>
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

            {/* Triage Actions — bottom of page, reviewer reads full context first */}
            {canTriage && (
              <div className="border-t pt-6 mt-8">
                <TriageActions
                  feedbackId={feedback.id}
                  feedbackReadableId={feedback.readableId}
                  status={feedback.status as FeedbackStatus}
                  onStatusChange={handleStatusChange}
                />
                {/* Edit-in-response shortcut. Visible to anyone with
                    section:manage so they can jump straight from the
                    feedback into the editor with the originating
                    feedback id carried in the URL. */}
                {canEditSection && editSectionHref && (
                  <div className="mt-6 flex items-center justify-between rounded-md border border-border bg-muted/40 px-4 py-3">
                    <div className="text-sm">
                      <p className="font-medium">Address this feedback in the editor</p>
                      <p className="text-xs text-muted-foreground">
                        Opens the section editor with this feedback&apos;s context.
                      </p>
                    </div>
                    <Link href={editSectionHref}>
                      <Button size="sm">
                        <Pencil className="mr-1 size-3.5" aria-hidden="true" />
                        Edit section
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
