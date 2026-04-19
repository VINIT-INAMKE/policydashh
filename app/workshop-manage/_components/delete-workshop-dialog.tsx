'use client'

import { useState } from 'react'
import { trpc } from '@/src/trpc/client'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Loader2 } from 'lucide-react'

interface DeleteWorkshopDialogProps {
  workshopId: string
  workshopTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// D12: the server returns BAD_REQUEST with a prefix-encoded message shape
// `ACTIVE_REGISTRATIONS:<n>:<human-readable>` when the workshop has active
// registrations and `force` wasn't passed. Parse the count out of it so the
// dialog can swap into a force-confirm state instead of surfacing a generic
// "try again" toast that drops the number.
const ACTIVE_REGISTRATIONS_PREFIX = 'ACTIVE_REGISTRATIONS:'

function parseActiveCount(errorMessage: string | undefined | null): number | null {
  if (!errorMessage || !errorMessage.startsWith(ACTIVE_REGISTRATIONS_PREFIX)) return null
  const rest = errorMessage.slice(ACTIVE_REGISTRATIONS_PREFIX.length)
  const idx = rest.indexOf(':')
  const numPart = idx >= 0 ? rest.slice(0, idx) : rest
  const parsed = Number.parseInt(numPart, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function DeleteWorkshopDialog({
  workshopId,
  workshopTitle,
  open,
  onOpenChange,
}: DeleteWorkshopDialogProps) {
  const utils = trpc.useUtils()
  // D12: when the first delete surfaces an active-registration error, we
  // stash the count and flip the dialog into its force-confirm state.
  const [forceActiveCount, setForceActiveCount] = useState<number | null>(null)

  const deleteMutation = trpc.workshop.delete.useMutation({
    onSuccess: () => {
      toast.success('Workshop deleted.')
      utils.workshop.list.invalidate()
      setForceActiveCount(null)
      onOpenChange(false)
    },
    onError: (error) => {
      const activeCount = parseActiveCount(error?.message)
      if (activeCount !== null && activeCount > 0) {
        // Flip into the force-confirm branch -- do NOT close the dialog,
        // don't toast. The UI below renders a secondary confirm prompt
        // with the exact count.
        setForceActiveCount(activeCount)
        return
      }
      toast.error('Could not delete the workshop. Try again.')
    },
  })

  const handleOpenChange = (next: boolean) => {
    if (!next) setForceActiveCount(null)
    onOpenChange(next)
  }

  const isForceBranch = forceActiveCount !== null && forceActiveCount > 0

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isForceBranch ? 'Force-delete workshop?' : 'Delete Workshop'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isForceBranch ? (
              <>
                This workshop has <strong>{forceActiveCount}</strong> active
                registration{forceActiveCount === 1 ? '' : 's'}. Deleting it will
                drop all of their registrations. This action cannot be undone.
              </>
            ) : (
              <>
                This will permanently delete &ldquo;{workshopTitle}&rdquo; and all
                its artifacts. This action cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Workshop</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() =>
              deleteMutation.mutate(
                isForceBranch
                  ? { workshopId, force: true }
                  : { workshopId },
              )
            }
          >
            {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {isForceBranch ? 'Delete anyway' : 'Delete Workshop'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
