'use client'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowRight } from 'lucide-react'

interface Transition {
  // R22: include the workflowTransitions row id so React keys are unique
  // even when two transitions of the same feedback item land in the same
  // second with the same toState (possible with backfilled data or
  // sub-second precision). The previous key `${toState}-${timestamp}`
  // triggered React's duplicate-key warning and could render one row
  // twice or skip one. id is already returned by listTransitions.
  id: string
  fromState: string | null
  toState: string
  actorName: string | null
  timestamp: string
  rationale: string | null
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
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

export function DecisionLog({ transitions }: { transitions: Transition[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
        Decision Log
      </h3>
      {transitions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No decisions recorded yet.
        </p>
      ) : (
        <div className="space-y-0">
          {transitions.map((transition, index) => (
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
