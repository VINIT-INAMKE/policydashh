'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { toast } from 'sonner'

const MIN_RATIONALE_LENGTH = 20
const MAX_RATIONALE_LENGTH = 2000

interface RequestChangesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  crId: string
  onRequested: () => void
}

export function RequestChangesDialog({
  open,
  onOpenChange,
  crId,
  onRequested,
}: RequestChangesDialogProps) {
  const [rationale, setRationale] = useState('')

  const requestChangesMutation = trpc.changeRequest.requestChanges.useMutation({
    onSuccess: () => {
      toast.success('Change request sent back for revisions.')
      setRationale('')
      onOpenChange(false)
      onRequested()
    },
    onError: () => {
      toast.error("Couldn't update the change request status. Your changes were not saved.")
    },
  })

  const canConfirm = rationale.trim().length >= MIN_RATIONALE_LENGTH

  function handleConfirm() {
    if (!canConfirm) return
    requestChangesMutation.mutate({
      id: crId,
      rationale: rationale.trim(),
    })
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setRationale('')
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Request Changes</DialogTitle>
          <DialogDescription>
            Send this change request back for revisions. Your rationale will be
            recorded in the decision log and visible to the owner.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label
            htmlFor="request-changes-rationale"
            className="text-sm font-medium leading-none"
          >
            Rationale *
          </label>
          <Textarea
            id="request-changes-rationale"
            placeholder="Explain what changes are needed before this can be merged."
            rows={6}
            className="min-h-[96px]"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            maxLength={MAX_RATIONALE_LENGTH}
            required
            disabled={requestChangesMutation.isPending}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            20 character minimum &middot; {rationale.length}/{MAX_RATIONALE_LENGTH}
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={requestChangesMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            disabled={!canConfirm || requestChangesMutation.isPending}
            onClick={handleConfirm}
            className={requestChangesMutation.isPending ? 'pointer-events-none' : ''}
          >
            {requestChangesMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Send for Revisions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
