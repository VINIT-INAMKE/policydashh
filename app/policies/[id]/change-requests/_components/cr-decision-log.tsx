'use client'

import { Separator } from '@/components/ui/separator'
import { ArrowRight } from 'lucide-react'
import { CRStatusBadge, type CRStatus } from './cr-status-badge'
import { trpc } from '@/src/trpc/client'

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

interface CRDecisionLogProps {
  crId: string
}

export function CRDecisionLog({ crId }: CRDecisionLogProps) {
  const transitionsQuery = trpc.changeRequest.listTransitions.useQuery({ crId })
  const transitions = transitionsQuery.data ?? []

  return (
    <div className="space-y-3">
      <h2 className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
        DECISION LOG
      </h2>
      {transitions.length === 0 ? (
        <p className="text-[14px] font-normal text-muted-foreground">
          No transitions recorded yet.
        </p>
      ) : (
        <div className="space-y-0">
          {transitions.map((transition, index) => {
            const metadata = transition.metadata as Record<string, unknown> | null
            const rationale = metadata?.rationale as string | undefined
            const mergeSummary = metadata?.mergeSummary as string | undefined
            const timestamp = typeof transition.timestamp === 'string'
              ? transition.timestamp
              : new Date(transition.timestamp as unknown as string).toISOString()

            return (
              <div key={transition.id}>
                {index > 0 && <Separator className="my-3" />}
                <div className="space-y-1.5">
                  {/* Status change badges */}
                  <div className="flex items-center gap-2">
                    {transition.fromState && (
                      <>
                        <CRStatusBadge
                          status={transition.fromState as CRStatus}
                          className="text-xs"
                        />
                        <ArrowRight className="size-3 text-muted-foreground" />
                      </>
                    )}
                    <CRStatusBadge
                      status={transition.toState as CRStatus}
                      className="text-xs"
                    />
                  </div>

                  {/* Actor + timestamp */}
                  <p className="text-xs text-muted-foreground">
                    by {transition.actorName ?? 'Unknown'} &middot;{' '}
                    {formatRelativeTime(timestamp)}
                  </p>

                  {/* Rationale (if close event) */}
                  {rationale && (
                    <p className="text-sm leading-relaxed">{rationale}</p>
                  )}

                  {/* Merge summary (if merge event) */}
                  {mergeSummary && (
                    <p className="text-sm leading-relaxed">{mergeSummary}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
