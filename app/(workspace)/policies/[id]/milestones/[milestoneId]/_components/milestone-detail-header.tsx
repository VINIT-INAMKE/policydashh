'use client'

import { useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { trpc } from '@/src/trpc/client'
import { MilestoneStatusBadge, type MilestoneStatus } from '../../_components/milestone-status-badge'
import { MilestoneSlotStatus, type SlotType } from './milestone-slot-status'
import { MarkReadyErrorDisplay, type UnmetSlot } from './mark-ready-error-display'
import { RetryAnchorButton } from './retry-anchor-button'

interface SlotStatusRow {
  type: SlotType
  required: number
  actual: number
  met: boolean
}

interface MilestoneDetailHeaderProps {
  milestoneId: string
  documentId: string
  title: string
  description: string | null
  status: MilestoneStatus
  contentHash: string | null
  txHash: string | null
  anchoredAt: string | null
  slotStatus: SlotStatusRow[]
  canManage: boolean
}

export function MilestoneDetailHeader(props: MilestoneDetailHeaderProps) {
  const utils = trpc.useUtils()
  const [unmet, setUnmet] = useState<UnmetSlot[]>([])

  const markReadyMutation = trpc.milestone.markReady.useMutation({
    onSuccess: () => {
      toast.success('Milestone marked ready')
      setUnmet([])
      utils.milestone.getById.invalidate({ milestoneId: props.milestoneId })
      utils.milestone.list.invalidate({ documentId: props.documentId })
    },
    onError: (err) => {
      // Parse structured unmet-slot error from cause, if present
      const cause = (err as unknown as { data?: { cause?: { unmet?: UnmetSlot[] } } }).data?.cause
      if (cause?.unmet && cause.unmet.length > 0) {
        setUnmet(cause.unmet)
      }
      toast.error('Failed to mark milestone ready')
    },
  })

  const requiredSlots = props.slotStatus.filter((s) => s.required > 0)
  const allMet = requiredSlots.length > 0 && requiredSlots.every((s) => s.met)
  const isReadOnly =
    props.status === 'ready' ||
    props.status === 'anchoring' ||
    props.status === 'anchored'

  const markReadyDisabled = !props.canManage || !allMet || isReadOnly || markReadyMutation.isPending
  const disabledTitle = isReadOnly
    ? 'Milestone is read-only'
    : !allMet
      ? 'All required slots must be met'
      : undefined

  return (
    <header className="border-b border-border px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold">{props.title}</h1>
            <MilestoneStatusBadge status={props.status} />
          </div>
          {props.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{props.description}</p>
          ) : null}
        </div>

        {props.status === 'defining' && props.canManage ? (
          <Button
            variant="default"
            onClick={() => markReadyMutation.mutate({ milestoneId: props.milestoneId })}
            disabled={markReadyDisabled}
            title={disabledTitle}
          >
            {markReadyMutation.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                Marking ready…
              </>
            ) : (
              'Mark ready'
            )}
          </Button>
        ) : props.status === 'anchoring' && props.canManage ? (
          <RetryAnchorButton milestoneId={props.milestoneId} />
        ) : null}
      </div>

      {requiredSlots.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-3">
          {requiredSlots.map((s) => (
            <MilestoneSlotStatus
              key={s.type}
              type={s.type}
              required={s.required}
              actual={s.actual}
              met={s.met}
            />
          ))}
        </div>
      ) : null}

      {props.contentHash ? (
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">SHA256:</span>{' '}
          <code className="font-mono text-xs text-muted-foreground">{props.contentHash}</code>
        </p>
      ) : null}

      {props.status === 'anchored' && props.txHash ? (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">TX:</span>{' '}
            <code className="font-mono text-xs text-muted-foreground">
              <span className="md:hidden">{props.txHash.slice(0, 8)}…{props.txHash.slice(-8)}</span>
              <span className="hidden md:inline">{props.txHash}</span>
            </code>
          </p>
          {props.anchoredAt ? (
            <p className="text-xs text-muted-foreground">
              Anchored {format(new Date(props.anchoredAt), 'MMM d, yyyy')}
            </p>
          ) : null}
          <a
            href={`https://preview.cardanoscan.io/transaction/${props.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View transaction on Cardanoscan preview-net"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            <ExternalLink className="size-3" aria-hidden="true" />
            View on Cardanoscan (preview-net)
          </a>
        </div>
      ) : null}

      <MarkReadyErrorDisplay unmet={unmet} />
    </header>
  )
}
