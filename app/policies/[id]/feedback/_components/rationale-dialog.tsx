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

type Decision = 'accept' | 'partially_accept' | 'reject'

interface RationaleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  decision: Decision
  feedbackId: string
  feedbackReadableId: string
  onSuccess: () => void
}

const DECISION_CONFIG: Record<
  Decision,
  {
    title: string
    confirmLabel: string
    confirmVariant: 'default' | 'destructive'
    successToast: string
  }
> = {
  accept: {
    title: 'Accept Feedback',
    confirmLabel: 'Confirm Accept',
    confirmVariant: 'default',
    successToast: 'Feedback accepted.',
  },
  partially_accept: {
    title: 'Partially Accept Feedback',
    confirmLabel: 'Confirm Partial Accept',
    confirmVariant: 'default',
    successToast: 'Feedback partially accepted.',
  },
  reject: {
    title: 'Reject Feedback',
    confirmLabel: 'Confirm Reject',
    confirmVariant: 'destructive',
    successToast: 'Feedback rejected.',
  },
}

const MIN_RATIONALE_LENGTH = 20
const MAX_RATIONALE_LENGTH = 2000

export function RationaleDialog({
  open,
  onOpenChange,
  decision,
  feedbackId,
  feedbackReadableId,
  onSuccess,
}: RationaleDialogProps) {
  const [rationale, setRationale] = useState('')

  const config = DECISION_CONFIG[decision]

  const decideMutation = trpc.feedback.decide.useMutation({
    onSuccess: () => {
      toast.success(config.successToast)
      setRationale('')
      onOpenChange(false)
      onSuccess()
    },
    onError: () => {
      toast.error(
        "Couldn't update the feedback status. Your changes were not saved."
      )
    },
  })

  const canConfirm = rationale.trim().length >= MIN_RATIONALE_LENGTH

  function handleConfirm() {
    if (!canConfirm) return
    decideMutation.mutate({
      id: feedbackId,
      decision,
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
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>
            Provide a mandatory rationale for this decision. This will be
            recorded in the decision log and visible to the stakeholder.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label
            htmlFor="rationale"
            className="text-sm font-medium leading-none"
          >
            Decision Rationale *
          </label>
          <Textarea
            id="rationale"
            placeholder="Explain the reasoning for this decision. Reference specific policy considerations where relevant."
            rows={6}
            className="min-h-[96px]"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            maxLength={MAX_RATIONALE_LENGTH}
            required
            aria-describedby="rationale-hint"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span id="rationale-hint">
              {rationale.trim().length < MIN_RATIONALE_LENGTH
                ? `${MIN_RATIONALE_LENGTH} character minimum (${rationale.trim().length}/${MIN_RATIONALE_LENGTH})`
                : 'Minimum length met.'}
            </span>
            <span>{rationale.length}/{MAX_RATIONALE_LENGTH}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={config.confirmVariant}
            disabled={!canConfirm || decideMutation.isPending}
            onClick={handleConfirm}
            className={decideMutation.isPending ? 'pointer-events-none' : ''}
          >
            {decideMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {config.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
