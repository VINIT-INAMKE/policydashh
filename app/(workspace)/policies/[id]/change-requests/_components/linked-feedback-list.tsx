'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ExternalLink } from 'lucide-react'
import { StatusBadge, type FeedbackStatus } from '@/app/(workspace)/policies/[id]/feedback/_components/status-badge'

interface LinkedFeedbackItem {
  id: string
  readableId: string
  title: string
  status: string
  sectionTitle: string | null
}

interface LinkedFeedbackListProps {
  documentId: string
  linkedFeedback: LinkedFeedbackItem[]
}

export function LinkedFeedbackList({
  documentId,
  linkedFeedback,
}: LinkedFeedbackListProps) {
  if (linkedFeedback.length === 0) {
    return (
      <div className="rounded-md bg-muted p-4">
        <p className="text-[14px] font-normal text-muted-foreground">
          No feedback linked.
        </p>
      </div>
    )
  }

  return (
    <div className="max-h-[320px] overflow-y-auto rounded-md bg-muted p-4">
      {linkedFeedback.map((fb, index) => (
        <div key={fb.id}>
          {index > 0 && <Separator className="my-3" />}
          <div className="flex items-center gap-2">
            {/* FB-NNN badge */}
            <Badge
              variant="secondary"
              className="shrink-0 border-transparent font-mono text-[12px]"
              aria-label={`Feedback ID ${fb.readableId}`}
            >
              {fb.readableId}
            </Badge>

            {/* Title */}
            <span className="min-w-0 flex-1 truncate text-[14px] font-normal">
              {fb.title}
            </span>

            {/* Status badge */}
            <StatusBadge
              status={fb.status as FeedbackStatus}
              className="shrink-0"
            />

            {/* Section name */}
            {fb.sectionTitle && (
              <span className="shrink-0 text-[12px] text-muted-foreground">
                {fb.sectionTitle}
              </span>
            )}

            {/* External link */}
            <Link href={`/policies/${documentId}/feedback?selected=${fb.id}`}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Open feedback ${fb.readableId}`}
              >
                <ExternalLink className="size-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
