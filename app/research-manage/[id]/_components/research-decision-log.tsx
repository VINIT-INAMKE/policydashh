'use client'

import { trpc } from '@/src/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowRight } from 'lucide-react'

/**
 * ResearchDecisionLog — Phase 27 D-13 (RESEARCH-07).
 *
 * Renders the workflow_transitions list for a research item using the
 * Plan 27-01 `trpc.research.listTransitions` query. Mirrors the markup of
 * `app/policies/[id]/feedback/_components/decision-log.tsx` (D-13: zero new
 * visual design) but does its own fetch so callers only need the item id.
 *
 * Metadata mapping (Phase 26 transitionResearch service):
 *   - reject  writes { rejectionReason } into workflow_transitions.metadata
 *   - retract writes { retractionReason } into workflow_transitions.metadata
 *   - submit / approve write null metadata
 * The decision log displays whichever value is present as a `rationale` line.
 */

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export interface ResearchDecisionLogProps {
  researchItemId: string
}

export function ResearchDecisionLog({ researchItemId }: ResearchDecisionLogProps) {
  const transitionsQuery = trpc.research.listTransitions.useQuery({ id: researchItemId })

  if (transitionsQuery.isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
          Decision Log
        </h3>
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  const transitions = transitionsQuery.data ?? []

  // Map metadata JSONB → rationale for DecisionLog semantics. Both reject
  // and retract fire through transitionResearch which writes one of these
  // keys to the metadata column. The DecisionLog displays whichever is
  // present.
  const mappedTransitions = transitions.map((t) => {
    const md = (t.metadata ?? null) as {
      rejectionReason?: string
      retractionReason?: string
    } | null
    const ts = t.timestamp
    return {
      id: t.id,
      fromState: t.fromState,
      toState: t.toState,
      actorName: t.actorName,
      timestamp: typeof ts === 'string'
        ? ts
        : (ts as unknown as Date).toISOString(),
      rationale: md?.rejectionReason ?? md?.retractionReason ?? null,
    }
  })

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
        Decision Log
      </h3>
      {mappedTransitions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>
      ) : (
        <div className="space-y-0">
          {mappedTransitions.map((transition, index) => (
            <div key={transition.id}>
              {index > 0 && <Separator className="my-3" />}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  {transition.fromState && (
                    <>
                      <Badge variant="secondary" className="text-xs">
                        {formatStatus(transition.fromState)}
                      </Badge>
                      <ArrowRight className="size-3 text-muted-foreground" />
                    </>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {formatStatus(transition.toState)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  by {transition.actorName ?? 'Unknown'} &middot;{' '}
                  {formatRelativeTime(transition.timestamp)}
                </p>
                {transition.rationale && (
                  <p className="text-sm leading-relaxed">
                    {transition.rationale}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
