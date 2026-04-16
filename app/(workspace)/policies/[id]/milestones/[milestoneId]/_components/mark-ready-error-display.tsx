'use client'

import { X } from 'lucide-react'

export interface UnmetSlot {
  type: 'versions' | 'workshops' | 'feedback' | 'evidence'
  required: number
  actual: number
}

const SLOT_LABELS = {
  versions: 'Versions',
  workshops: 'Workshops',
  feedback: 'Feedback',
  evidence: 'Evidence',
} as const

interface MarkReadyErrorDisplayProps {
  unmet: UnmetSlot[]
}

export function MarkReadyErrorDisplay({ unmet }: MarkReadyErrorDisplayProps) {
  if (unmet.length === 0) return null
  return (
    <div
      role="alert"
      className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3"
    >
      <h4 className="text-sm font-semibold text-destructive">
        Cannot mark ready - requirements not met
      </h4>
      <ul className="mt-2 space-y-1">
        {unmet.map((slot) => (
          <li
            key={slot.type}
            className="flex items-center gap-1 text-sm text-muted-foreground"
          >
            <X className="size-3.5 text-destructive" aria-hidden="true" />
            {SLOT_LABELS[slot.type]}: {slot.actual} linked, {slot.required} required
          </li>
        ))}
      </ul>
    </div>
  )
}
