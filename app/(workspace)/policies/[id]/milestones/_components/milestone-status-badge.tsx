'use client'

import { CheckCircle, Loader2, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type MilestoneStatus = 'defining' | 'ready' | 'anchoring' | 'anchored'

const STATUS_CONFIG = {
  defining: {
    label: 'Defining',
    className: 'bg-muted text-muted-foreground border-transparent',
    Icon: null,
  },
  ready: {
    label: 'Ready',
    className:
      'bg-[var(--status-cr-approved-bg)] text-[var(--status-cr-approved-text)] border-transparent',
    Icon: CheckCircle,
  },
  anchoring: {
    label: 'Anchoring',
    className: 'bg-primary/10 text-primary border-transparent',
    Icon: Loader2,
  },
  anchored: {
    label: 'Anchored',
    className:
      'bg-[var(--status-cr-merged-bg)] text-[var(--status-cr-merged-text)] border-transparent',
    Icon: Lock,
  },
} as const

interface MilestoneStatusBadgeProps {
  status: MilestoneStatus
  className?: string
}

export function MilestoneStatusBadge({ status, className }: MilestoneStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.Icon
  return (
    <Badge
      variant="secondary"
      aria-label={config.label}
      className={cn('inline-flex items-center gap-1', config.className, className)}
    >
      {Icon ? (
        <Icon
          className={cn('size-3', status === 'anchoring' && 'animate-spin')}
          aria-hidden="true"
        />
      ) : null}
      <span className="text-xs font-semibold">{config.label}</span>
    </Badge>
  )
}
