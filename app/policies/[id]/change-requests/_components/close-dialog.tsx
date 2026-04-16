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

interface CloseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  crId: string
  onClosed: () => void
}

export function CloseDialog({
  open,
  onOpenChange,
  crId,
  onClosed,
}: CloseDialogProps) {
  const [rationale, setRationale] = useState('')

  const closeMutation = trpc.changeRequest.close.useMutation({
    onSuccess: () => {
      toast.success('Change request closed.')
      setRationale('')
      onOpenChange(false)
      onClosed()
    },
    onError: () => {
      toast.error("Couldn't update the change request status. Your changes were not saved.")
    },
  })

  const canConfirm = rationale.trim().length >= MIN_RATIONALE_LENGTH

  function handleConfirm() {
    if (!canConfirm) return
    closeMutation.mutate({
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
          <DialogTitle>Close without Merging</DialogTitle>
          <DialogDescription>
            Closing this change request without merging will record your rationale.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {/* Rationale textarea */}
        <div className="space-y-2">
          <label
            htmlFor="closure-rationale"
            className="text-sm font-medium leading-none"
          >
            Closure Rationale *
          </label>
          <Textarea
            id="closure-rationale"
            placeholder="Explain why this change request is being closed without merging."
            rows={6}
            className="min-h-[96px]"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            maxLength={MAX_RATIONALE_LENGTH}
            required
            disabled={closeMutation.isPending}
            autoFocus
          />
          <p className="text-right text-xs text-muted-foreground">
            {rationale.length}/{MAX_RATIONALE_LENGTH}
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={closeMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!canConfirm || closeMutation.isPending}
            onClick={handleConfirm}
            className={closeMutation.isPending ? 'pointer-events-none' : ''}
          >
            {closeMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Close without Merging
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
