'use client'

import { Lock } from 'lucide-react'

interface VersionStatusBadgeProps {
  isPublished: boolean
  publishedAt?: string | null
}

export function VersionStatusBadge({ isPublished }: VersionStatusBadgeProps) {
  if (isPublished) {
    // All published versions are immutable in Phase 6 -- use indigo treatment
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-[var(--status-cr-merged-bg)] px-2 py-0.5 text-xs font-medium text-[var(--status-cr-merged-text)]"
        aria-label="This version is immutable"
      >
        <Lock className="size-3.5" />
        Published &middot; Immutable
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      Draft
    </span>
  )
}
