'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

interface TraceabilityChainBadgeProps {
  feedbackReadableId: string
  crReadableId?: string | null
  sectionTitle?: string | null
  versionLabel?: string | null
  documentId: string
  feedbackId?: string
  crId?: string | null
}

export function TraceabilityChainBadge({
  feedbackReadableId,
  crReadableId,
  sectionTitle,
  versionLabel,
  documentId,
  crId,
}: TraceabilityChainBadgeProps) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {/* Feedback badge */}
      <Link href={`/policies/${documentId}/feedback`}>
        <Badge
          variant="secondary"
          className="border-transparent font-mono text-[12px]"
        >
          {feedbackReadableId}
        </Badge>
      </Link>

      <span className="mx-1 text-muted-foreground">&rarr;</span>

      {/* CR badge */}
      {crReadableId && crId ? (
        <Link href={`/policies/${documentId}/change-requests/${crId}`}>
          <Badge
            variant="secondary"
            className="border-transparent font-mono text-[12px]"
          >
            {crReadableId}
          </Badge>
        </Link>
      ) : (
        <span className="text-[12px] text-muted-foreground">&mdash;</span>
      )}

      <span className="mx-1 text-muted-foreground">&rarr;</span>

      {/* Section badge */}
      {sectionTitle ? (
        <Badge variant="secondary" className="border-transparent text-[12px]">
          {sectionTitle}
        </Badge>
      ) : (
        <span className="text-[12px] text-muted-foreground">&mdash;</span>
      )}

      <span className="mx-1 text-muted-foreground">&rarr;</span>

      {/* Version badge */}
      {versionLabel ? (
        <Link href={`/policies/${documentId}/versions`}>
          <Badge
            variant="secondary"
            className="border-transparent font-mono text-[12px]"
          >
            {versionLabel}
          </Badge>
        </Link>
      ) : (
        <span className="text-[12px] text-muted-foreground">&mdash;</span>
      )}
    </div>
  )
}
