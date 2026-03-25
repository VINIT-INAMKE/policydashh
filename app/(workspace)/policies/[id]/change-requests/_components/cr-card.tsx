'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CRStatusBadge, type CRStatus } from './cr-status-badge'

export interface CRCardItem {
  id: string
  readableId: string
  documentId: string
  title: string
  description: string | null
  status: string
  ownerName: string | null
  feedbackCount: number
  sectionCount: number
  updatedAt: string
}

interface CRCardProps {
  cr: CRCardItem
}

export function CRCard({ cr }: CRCardProps) {
  const timeAgo = formatDistanceToNow(new Date(cr.updatedAt), { addSuffix: true })

  return (
    <Link
      href={`/policies/${cr.documentId}/change-requests/${cr.id}`}
      className="block"
    >
      <Card className="cursor-pointer transition-all hover:border-primary/20 hover:shadow-sm">
        <CardHeader className="gap-2">
          {/* Top row: CR-NNN badge | Title | Status badge */}
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="shrink-0 border-transparent font-mono text-[12px]"
              aria-label={`Change Request ID ${cr.readableId}`}
            >
              {cr.readableId}
            </Badge>
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold leading-snug">
              {cr.title}
            </span>
            <div className="ml-auto shrink-0">
              <CRStatusBadge status={cr.status as CRStatus} />
            </div>
          </div>
        </CardHeader>

        {/* Description */}
        {cr.description && (
          <CardContent>
            <p className="line-clamp-2 text-[14px] font-normal leading-[1.5] text-muted-foreground">
              {cr.description}
            </p>
          </CardContent>
        )}

        <CardFooter className="gap-2">
          {/* Owner name */}
          {cr.ownerName && (
            <span className="text-[12px] font-normal text-muted-foreground">
              {cr.ownerName}
            </span>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[12px] text-muted-foreground">
              {cr.sectionCount} {cr.sectionCount === 1 ? 'section' : 'sections'}
            </span>
            <span className="text-[12px] text-muted-foreground">
              {cr.feedbackCount} feedback
            </span>
            <span className="text-[12px] text-muted-foreground">
              {timeAgo}
            </span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  )
}
