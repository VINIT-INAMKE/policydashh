'use client'

import { CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const BUCKET_LABEL: Record<string, string> = {
  government: 'Government',
  industry: 'Industry',
  legal: 'Legal',
  academia: 'Academia',
  civil_society: 'Civil Society',
  internal: 'Internal',
}

interface Props {
  email: string
  orgType: string
}

export function ParticipateSuccess({ email, orgType }: Props) {
  const bucketLabel = BUCKET_LABEL[orgType] ?? 'Stakeholder'

  return (
    <Card
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-4 px-6 py-12 text-center"
    >
      <CheckCircle2
        className="h-12 w-12"
        style={{ color: 'var(--cl-tertiary-fixed-dim, #66dd8b)' }}
        aria-hidden="true"
      />
      <h2
        className="text-xl font-semibold text-[var(--cl-on-surface)]"
        tabIndex={-1}
      >
        You&apos;re on the list.
      </h2>
      <p className="max-w-md text-base leading-relaxed text-muted-foreground">
        We&apos;ve received your request to join the {bucketLabel} consultation. Check your inbox at{' '}
        <span className="font-medium text-[var(--cl-on-surface)]">{email}</span> for next steps - your invitation will arrive within a few minutes.
      </p>
      <Badge variant="secondary">{bucketLabel}</Badge>

      <Separator className="my-4 w-full max-w-xs" />

      <p className="text-sm font-semibold text-muted-foreground">While you wait:</p>
      <ul className="flex flex-col gap-2 text-sm">
        <li>
          <a href="/portal" className="text-[var(--cl-primary,#000a1e)] underline-offset-4 hover:underline">
            → View published policies
          </a>
        </li>
      </ul>
    </Card>
  )
}
