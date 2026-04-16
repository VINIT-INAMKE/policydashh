'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { trpc } from '@/src/trpc/client'

export type EntityType = 'version' | 'workshop' | 'feedback' | 'evidence'

interface EntityRow {
  id: string
  displayName: string
  metadata?: string
  attached: boolean
}

interface MilestoneEntityTabProps {
  milestoneId: string
  documentId: string
  entityType: EntityType
  rows: EntityRow[]
  isLoading: boolean
  isReadOnly: boolean
  onMutated: () => void
}

const ENTITY_LABELS: Record<EntityType, { plural: string; singular: string }> = {
  version: { plural: 'versions', singular: 'Version' },
  workshop: { plural: 'workshops', singular: 'Workshop' },
  feedback: { plural: 'feedback', singular: 'Feedback' },
  evidence: { plural: 'evidence', singular: 'Evidence' },
}

export function MilestoneEntityTab({
  milestoneId,
  documentId,
  entityType,
  rows,
  isLoading,
  isReadOnly,
  onMutated,
}: MilestoneEntityTabProps) {
  const utils = trpc.useUtils()
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  const attachMutation = trpc.milestone.attachEntity.useMutation({
    onSuccess: () => {
      toast.success(`${ENTITY_LABELS[entityType].singular} added to milestone`)
    },
    onError: () => {
      toast.error('Failed to update milestone. Try again.')
    },
    onSettled: (_data, _err, variables) => {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(variables.entityId)
        return next
      })
      utils.milestone.getById.invalidate({ milestoneId })
      onMutated()
    },
  })

  const detachMutation = trpc.milestone.detachEntity.useMutation({
    onSuccess: () => {
      toast.success(`${ENTITY_LABELS[entityType].singular} removed from milestone`)
    },
    onError: () => {
      toast.error('Failed to update milestone. Try again.')
    },
    onSettled: (_data, _err, variables) => {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(variables.entityId)
        return next
      })
      utils.milestone.getById.invalidate({ milestoneId })
      onMutated()
    },
  })

  function toggle(row: EntityRow) {
    if (isReadOnly) return
    setPendingIds((prev) => new Set(prev).add(row.id))
    if (row.attached) {
      detachMutation.mutate({ milestoneId, entityType, entityId: row.id })
    } else {
      attachMutation.mutate({ milestoneId, entityType, entityId: row.id })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2 pt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    )
  }

  const attached = rows.filter((r) => r.attached)
  const available = rows.filter((r) => !r.attached)

  return (
    <div className="space-y-6 pt-4">
      <Section
        title="Attached"
        suffix={isReadOnly ? '(read-only)' : undefined}
        rows={attached}
        entityType={entityType}
        emptyMessage={`No ${ENTITY_LABELS[entityType].plural} attached yet.`}
        pendingIds={pendingIds}
        isReadOnly={isReadOnly}
        onToggle={toggle}
      />
      <Section
        title="Available"
        suffix={isReadOnly ? '(read-only)' : undefined}
        rows={available}
        entityType={entityType}
        emptyMessage={`No ${ENTITY_LABELS[entityType].plural} available to attach.`}
        pendingIds={pendingIds}
        isReadOnly={isReadOnly}
        onToggle={toggle}
      />
    </div>
  )
}

function Section({
  title,
  suffix,
  rows,
  entityType,
  emptyMessage,
  pendingIds,
  isReadOnly,
  onToggle,
}: {
  title: string
  suffix?: string
  rows: EntityRow[]
  entityType: EntityType
  emptyMessage: string
  pendingIds: Set<string>
  isReadOnly: boolean
  onToggle: (row: EntityRow) => void
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        {suffix ? <span className="ml-1 text-muted-foreground">{suffix}</span> : null}
      </h4>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {rows.map((row) => {
            const pending = pendingIds.has(row.id)
            const action = row.attached ? 'Remove' : 'Add'
            const preposition = row.attached ? 'from' : 'to'
            return (
              <li
                key={row.id}
                className="flex items-center gap-3 py-2"
              >
                <Checkbox
                  checked={row.attached}
                  disabled={isReadOnly || pending}
                  onCheckedChange={() => onToggle(row)}
                  aria-label={`${action} ${row.displayName} ${preposition} milestone`}
                  className={cn(isReadOnly && 'pointer-events-none opacity-50')}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{row.displayName}</p>
                  {row.metadata ? (
                    <p className="truncate text-xs text-muted-foreground">{row.metadata}</p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
