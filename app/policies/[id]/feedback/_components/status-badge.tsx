import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type FeedbackStatus =
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'partially_accepted'
  | 'rejected'
  | 'closed'

const statusStyles: Record<FeedbackStatus, string> = {
  submitted: 'bg-muted text-muted-foreground',
  under_review: 'bg-primary/10 text-primary',
  accepted: 'bg-[var(--status-accepted-bg)] text-[var(--status-accepted-text)]',
  partially_accepted: 'bg-[var(--status-partial-bg)] text-[var(--status-partial-text)]',
  rejected: 'bg-[var(--status-rejected-bg)] text-destructive',
  closed: 'bg-muted text-muted-foreground',
}

const statusLabels: Record<FeedbackStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  accepted: 'Accepted',
  partially_accepted: 'Partially Accepted',
  rejected: 'Rejected',
  closed: 'Closed',
}

export function StatusBadge({
  status,
  className,
}: {
  status: FeedbackStatus
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
      aria-label={status}
    >
      {statusLabels[status]}
    </Badge>
  )
}
