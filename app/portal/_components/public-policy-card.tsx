'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { Card, CardHeader, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface PublicPolicyCardProps {
  policyId: string
  title: string
  description: string | null
  versionLabel: string
  publishedAt: string
}

export function PublicPolicyCard({
  policyId,
  title,
  description,
  versionLabel,
  publishedAt,
}: PublicPolicyCardProps) {
  return (
    <Link href={`/portal/${policyId}`} className="block">
      <Card className="h-full transition-colors hover:bg-muted/30">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-[20px] font-semibold leading-[1.2]">{title}</h2>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--status-cr-merged-bg)] px-2 py-0.5 text-xs font-medium text-[var(--status-cr-merged-text)]">
              {versionLabel} &middot; Published
            </span>
          </div>
          {description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
          )}
        </CardHeader>
        <CardFooter className="flex items-center justify-between">
          <time
            dateTime={publishedAt}
            className="text-xs text-muted-foreground"
          >
            Published {format(new Date(publishedAt), 'MMM d, yyyy')}
          </time>
          <Button variant="outline" size="sm" tabIndex={-1}>
            View Policy
          </Button>
        </CardFooter>
      </Card>
    </Link>
  )
}
