import { Clock, CheckCircle2 } from 'lucide-react'

export type SectionStatus = 'draft' | 'under_review' | 'validated'

interface SectionStatusBadgeProps {
  status: SectionStatus
}

const LABELS: Record<SectionStatus, string> = {
  draft: 'Draft',
  under_review: 'Under Review',
  validated: 'Validated',
}

export function SectionStatusBadge({ status }: SectionStatusBadgeProps) {
  const baseClasses =
    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold'

  if (status === 'draft') {
    return (
      <span aria-label="Draft" className={`${baseClasses} bg-muted text-muted-foreground`}>
        {LABELS.draft}
      </span>
    )
  }

  if (status === 'under_review') {
    return (
      <span
        aria-label="Under Review"
        className={`${baseClasses} bg-[var(--status-cr-approved-bg)] text-[var(--status-cr-approved-text)]`}
      >
        <Clock className="size-3.5" />
        {LABELS.under_review}
      </span>
    )
  }

  // validated
  return (
    <span
      aria-label="Validated"
      className={`${baseClasses} bg-[var(--status-cr-merged-bg)] text-[var(--status-cr-merged-text)]`}
    >
      <CheckCircle2 className="size-3.5" />
      {LABELS.validated}
    </span>
  )
}
