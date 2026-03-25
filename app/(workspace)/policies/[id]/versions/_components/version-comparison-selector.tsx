'use client'

interface VersionListItem {
  id: string
  versionLabel: string
  isPublished: boolean
  publishedAt: string | null
  createdAt: string
  creatorName: string | null
}

interface VersionComparisonSelectorProps {
  versions: VersionListItem[]
  documentId: string
  currentVersionId: string
}

// Stub -- replaced in Task 2
export function VersionComparisonSelector(_props: VersionComparisonSelectorProps) {
  return null
}
