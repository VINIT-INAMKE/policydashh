'use client'

import { CheckCircle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SlotType = 'versions' | 'workshops' | 'feedback' | 'evidence'

const SLOT_LABELS: Record<SlotType, string> = {
  versions: 'Versions',
  workshops: 'Workshops',
  feedback: 'Feedback',
  evidence: 'Evidence',
}

interface MilestoneSlotStatusProps {
  type: SlotType
  required: number
  actual: number
  met: boolean
}

export function MilestoneSlotStatus({ type, required, actual, met }: MilestoneSlotStatusProps) {
  const Icon = met ? CheckCircle : X
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-sm',
        met
          ? 'text-[var(--status-cr-approved-text)]'
          : 'text-destructive',
      )}
    >
      <span className="font-semibold text-foreground">{SLOT_LABELS[type]}:</span>
      <span className="font-semibold">
        {actual} / {required}
      </span>
      <Icon className="size-3.5" aria-hidden="true" />
    </span>
  )
}
