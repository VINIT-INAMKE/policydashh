'use client'

import { Button } from '@/components/ui/button'
import { trpc } from '@/src/trpc/client'
import { toast } from 'sonner'

type WorkshopStatus = 'upcoming' | 'in_progress' | 'completed' | 'archived'

// F24: archived state now has an unarchive action ("completed") so an
// accidentally-archived workshop can be brought back without a DB patch.
// The router's ALLOWED_TRANSITIONS mirrors this (archived -> completed).
const NEXT_ACTION: Record<WorkshopStatus, { label: string; toStatus: Exclude<WorkshopStatus, 'upcoming'> } | null> = {
  upcoming:    { label: 'Start Workshop', toStatus: 'in_progress' },
  in_progress: { label: 'Mark Completed', toStatus: 'completed' },
  completed:   { label: 'Archive',        toStatus: 'archived' },
  archived:    { label: 'Unarchive',      toStatus: 'completed' },
}

const STATUS_BADGE: Record<WorkshopStatus, string> = {
  upcoming:    'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  completed:   'bg-green-100 text-green-800',
  archived:    'bg-slate-100 text-slate-800',
}

export function StatusTransitionButtons(props: {
  workshopId: string
  currentStatus: WorkshopStatus
  canManage: boolean
}) {
  const utils = trpc.useUtils()
  const mutation = trpc.workshop.transition.useMutation({
    onSuccess: (_result, vars) => {
      toast.success(`Workshop → ${vars.toStatus.replace('_', ' ')}`)
      utils.workshop.getById.invalidate({ workshopId: props.workshopId })
      utils.workshop.listChecklist.invalidate({ workshopId: props.workshopId })
    },
    onError: (err) => {
      toast.error(`Transition failed: ${err.message}`)
    },
  })

  const nextAction = NEXT_ACTION[props.currentStatus]

  return (
    <div className="flex items-center gap-3">
      <span
        className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE[props.currentStatus]}`}
      >
        {props.currentStatus.replace('_', ' ')}
      </span>
      {props.canManage && nextAction && (
        <Button
          size="sm"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              workshopId: props.workshopId,
              toStatus: nextAction.toStatus,
            })
          }
        >
          {mutation.isPending ? 'Working…' : nextAction.label}
        </Button>
      )}
    </div>
  )
}
