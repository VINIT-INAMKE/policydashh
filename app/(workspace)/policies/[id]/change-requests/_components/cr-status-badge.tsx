import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type CRStatus = 'drafting' | 'in_review' | 'approved' | 'merged' | 'closed'

const statusStyles: Record<CRStatus, string> = {
  drafting: 'bg-muted text-muted-foreground',
  in_review: 'bg-primary/10 text-primary',
  approved: 'bg-[var(--status-cr-approved-bg)] text-[var(--status-cr-approved-text)]',
  merged: 'bg-[var(--status-cr-merged-bg)] text-[var(--status-cr-merged-text)]',
  closed: 'bg-muted text-muted-foreground',
}

const statusLabels: Record<CRStatus, string> = {
  drafting: 'Drafting',
  in_review: 'In Review',
  approved: 'Approved',
  merged: 'Merged',
  closed: 'Closed',
}

export function CRStatusBadge({
  status,
  className,
}: {
  status: CRStatus
  className?: string
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'border-transparent',
        statusStyles[status],
        className
      )}
      aria-label={statusLabels[status]}
    >
      {statusLabels[status]}
    </Badge>
  )
}
