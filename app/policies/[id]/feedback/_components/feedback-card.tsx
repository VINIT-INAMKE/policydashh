'use client'

import { formatDistanceToNow } from 'date-fns'
import { Paperclip } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge, type FeedbackStatus } from './status-badge'
import { cn } from '@/lib/utils'

export interface FeedbackItem {
  id: string
  readableId: string
  sectionId: string
  documentId: string
  feedbackType: string
  priority: string
  impactCategory: string
  title: string
  body: string
  status: string
  isAnonymous: boolean
  submitterName: string | null
  submitterOrgType: string | null
  createdAt: string
  sectionTitle?: string
  hasEvidence?: boolean
}

interface FeedbackCardProps {
  feedback: FeedbackItem
  onClick: () => void
  isActive: boolean
}

const priorityStyles: Record<string, string> = {
  high: 'bg-[var(--status-priority-high-bg)] text-destructive border-transparent',
  medium: 'bg-[var(--status-priority-medium-bg)] text-[var(--status-priority-medium-text)] border-transparent',
  low: 'bg-muted text-muted-foreground border-transparent',
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
}

export function FeedbackCard({ feedback, onClick, isActive }: FeedbackCardProps) {
  const date = new Date(feedback.createdAt)
  const timeAgo = formatDistanceToNow(date, { addSuffix: true })

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:border-primary/20 hover:shadow-sm',
        isActive && 'border-primary'
      )}
      onClick={onClick}
    >
      <CardHeader className="gap-2">
        {/* Badge row */}
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-xs">
            {capitalize(feedback.feedbackType)}
          </Badge>
          <Badge
            variant="secondary"
            className={cn('text-xs', priorityStyles[feedback.priority])}
          >
            {capitalize(feedback.priority)}
          </Badge>
          <Badge
            variant="secondary"
            className="border-transparent font-mono text-[12px]"
            aria-label={`Feedback ID ${feedback.readableId}`}
          >
            {feedback.readableId}
          </Badge>
          <div className="ml-auto">
            <StatusBadge status={feedback.status as FeedbackStatus} />
          </div>
        </div>
        {/* Title */}
        <div className="truncate text-[14px] font-semibold leading-snug">
          {feedback.title}
        </div>
        {/* Section name */}
        {feedback.sectionTitle && (
          <div className="text-[12px] font-normal leading-[1.4] text-muted-foreground">
            {feedback.sectionTitle}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {/* Body preview */}
        <p className="line-clamp-2 text-[14px] font-normal leading-[1.5] text-muted-foreground">
          {feedback.body}
        </p>
      </CardContent>

      <CardFooter className="gap-2">
        {/* Org type */}
        {feedback.submitterOrgType && (
          <span className="text-[12px] text-muted-foreground">
            {capitalize(feedback.submitterOrgType)}
          </span>
        )}
        {/* Anonymous badge */}
        {feedback.isAnonymous && (
          <Badge variant="secondary" className="border-transparent text-[12px]">
            Anonymous
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          {/* Evidence indicator */}
          {feedback.hasEvidence && (
            <Paperclip className="size-3 text-muted-foreground" />
          )}
          {/* Date */}
          <span className="text-[12px] text-muted-foreground">
            {timeAgo}
          </span>
        </div>
      </CardFooter>
    </Card>
  )
}
