'use client'

interface ChangelogEntry {
  crId: string | null
  crReadableId: string | null
  crTitle: string
  summary: string
  feedbackIds: string[]
  affectedSectionIds: string[]
}

interface PublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  versionId: string
  versionLabel: string
  documentTitle: string
  changelog: ChangelogEntry[] | null
}

// Stub -- replaced in Task 2
export function PublishDialog(_props: PublishDialogProps) {
  return null
}
