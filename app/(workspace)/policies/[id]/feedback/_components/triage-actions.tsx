'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RationaleDialog } from './rationale-dialog'
import { trpc } from '@/src/trpc/client'
import { toast } from 'sonner'
import {
  Eye,
  Check,
  CircleDashed,
  X,
  Archive,
  Loader2,
} from 'lucide-react'

type FeedbackStatus =
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'partially_accepted'
  | 'rejected'
  | 'closed'

type Decision = 'accept' | 'partially_accept' | 'reject'

interface TriageActionsProps {
  feedbackId: string
  feedbackReadableId: string
  status: FeedbackStatus
  onStatusChange: () => void
}

export function TriageActions({
  feedbackId,
  feedbackReadableId,
  status,
  onStatusChange,
}: TriageActionsProps) {
  const [rationaleOpen, setRationaleOpen] = useState(false)
  const [activeDecision, setActiveDecision] = useState<Decision>('accept')

  const startReviewMutation = trpc.feedback.startReview.useMutation({
    onSuccess: () => {
      toast.success('Feedback marked as Under Review.')
      onStatusChange()
    },
    onError: () => {
      toast.error(
        "Couldn't update the feedback status. Your changes were not saved."
      )
    },
  })

  const closeMutation = trpc.feedback.close.useMutation({
    onSuccess: () => {
      toast.success('Feedback closed.')
      onStatusChange()
    },
    onError: () => {
      toast.error(
        "Couldn't update the feedback status. Your changes were not saved."
      )
    },
  })

  function handleOpenRationale(decision: Decision) {
    setActiveDecision(decision)
    setRationaleOpen(true)
  }

  if (status === 'submitted') {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={startReviewMutation.isPending}
          onClick={() => startReviewMutation.mutate({ id: feedbackId })}
          className={startReviewMutation.isPending ? 'pointer-events-none' : ''}
        >
          {startReviewMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Eye className="size-3.5" />
          )}
          Mark Under Review
        </Button>
      </div>
    )
  }

  if (status === 'under_review') {
    return (
      <>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => handleOpenRationale('accept')}
          >
            <Check className="size-3.5" />
            Accept
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenRationale('partially_accept')}
          >
            <CircleDashed className="size-3.5" />
            Partially Accept
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => handleOpenRationale('reject')}
          >
            <X className="size-3.5" />
            Reject
          </Button>
        </div>
        <RationaleDialog
          open={rationaleOpen}
          onOpenChange={setRationaleOpen}
          decision={activeDecision}
          feedbackId={feedbackId}
          feedbackReadableId={feedbackReadableId}
          onSuccess={onStatusChange}
        />
      </>
    )
  }

  if (
    status === 'accepted' ||
    status === 'partially_accepted' ||
    status === 'rejected'
  ) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={closeMutation.isPending}
          onClick={() => closeMutation.mutate({ id: feedbackId })}
          className={closeMutation.isPending ? 'pointer-events-none' : ''}
        >
          {closeMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Archive className="size-3.5" />
          )}
          Close
        </Button>
      </div>
    )
  }

  if (status === 'closed') {
    return (
      <p className="text-sm text-muted-foreground">
        This feedback is closed.
      </p>
    )
  }

  return null
}
