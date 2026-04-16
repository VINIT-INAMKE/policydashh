'use client'

import { VersionStatusBadge } from './version-status-badge'

interface VersionCardVersion {
  id: string
  versionLabel: string
  isPublished: boolean
  publishedAt: string | null
  createdAt: string
  creatorName: string | null
}

interface VersionCardProps {
  version: VersionCardVersion
  isSelected: boolean
  onSelect: (id: string) => void
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function VersionCard({ version, isSelected, onSelect }: VersionCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(version.id)}
      className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
        isSelected
          ? 'border-l-2 border-primary bg-background'
          : 'hover:bg-background/50'
      }`}
      aria-label={`Version ${version.versionLabel}, ${version.isPublished ? 'Published' : 'Draft'}, created ${formatDate(version.createdAt)}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">
          {version.versionLabel}
        </span>
        <VersionStatusBadge
          isPublished={version.isPublished}
          publishedAt={version.publishedAt}
        />
      </div>
      <div className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
        <span>{formatDate(version.createdAt)}</span>
        {version.creatorName && (
          <>
            <span>&middot;</span>
            <span>{version.creatorName}</span>
          </>
        )}
      </div>
    </button>
  )
}
