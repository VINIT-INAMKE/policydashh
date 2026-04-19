'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  ArrowRightCircle,
  CheckCircle,
  GitMerge,
  RotateCcw,
  XCircle,
  Loader2,
} from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { toast } from 'sonner'
import type { CRStatus } from './cr-status-badge'
import { MergeDialog } from './merge-dialog'
import { CloseDialog } from './close-dialog'
import { RequestChangesDialog } from './request-changes-dialog'

interface CRLifecycleActionsProps {
  crId: string
  readableId: string
  title: string
  status: CRStatus
  documentId: string
  onStatusChange: () => void
}

export function CRLifecycleActions({
  crId,
  readableId,
  title,
  status,
  documentId,
  onStatusChange,
}: CRLifecycleActionsProps) {
  const [mergeOpen, setMergeOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [requestChangesOpen, setRequestChangesOpen] = useState(false)

  const submitForReviewMutation = trpc.changeRequest.submitForReview.useMutation({
    onSuccess: () => {
      toast.success('Change request submitted for review.')
      onStatusChange()
    },
    onError: (err) => {
      // A11: surface the server-provided reason. Static "changes were not
      // saved" copy previously masked FORBIDDEN (self-approval), BAD_REQUEST
      // (invalid XState transition), and network errors behind the same
      // generic message.
      toast.error(err.message || "Couldn't update the change request status.")
    },
  })

  const approveMutation = trpc.changeRequest.approve.useMutation({
    onSuccess: () => {
      toast.success('Change request approved.')
      onStatusChange()
    },
    onError: (err) => {
      // A11: same reasoning as submitForReviewMutation above — the server
      // messages (e.g. "Cannot approve your own change request CR-007")
      // are more useful than the generic fallback copy.
      toast.error(err.message || "Couldn't update the change request status.")
    },
  })

  if (status === 'drafting') {
    return (
      <>
        <div className="mt-6 flex items-center gap-2 border-t pt-6">
          <Button
            variant="default"
            disabled={submitForReviewMutation.isPending}
            onClick={() => submitForReviewMutation.mutate({ id: crId })}
            className={submitForReviewMutation.isPending ? 'pointer-events-none' : ''}
          >
            {submitForReviewMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRightCircle className="size-4" />
            )}
            Submit for Review
          </Button>
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => setCloseOpen(true)}
          >
            <XCircle className="size-4" />
            Cancel Draft
          </Button>
        </div>
        <CloseDialog
          open={closeOpen}
          onOpenChange={setCloseOpen}
          crId={crId}
          onClosed={onStatusChange}
        />
      </>
    )
  }

  if (status === 'in_review') {
    return (
      <>
        <div className="mt-6 flex items-center gap-2 border-t pt-6">
          <Button
            variant="default"
            disabled={approveMutation.isPending}
            onClick={() => approveMutation.mutate({ id: crId })}
            className={approveMutation.isPending ? 'pointer-events-none' : ''}
          >
            {approveMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle className="size-4" />
            )}
            Approve
          </Button>
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => setCloseOpen(true)}
          >
            <XCircle className="size-4" />
            Close without Merge
          </Button>
        </div>
        <CloseDialog
          open={closeOpen}
          onOpenChange={setCloseOpen}
          crId={crId}
          onClosed={onStatusChange}
        />
      </>
    )
  }

  if (status === 'approved') {
    return (
      <>
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-6">
          <Button
            variant="default"
            onClick={() => setMergeOpen(true)}
          >
            <GitMerge className="size-4" />
            Merge
          </Button>
          <Button
            variant="outline"
            onClick={() => setRequestChangesOpen(true)}
          >
            <RotateCcw className="size-4" />
            Request Changes
          </Button>
          <Button
            variant="outline"
            className="text-destructive"
            onClick={() => setCloseOpen(true)}
          >
            <XCircle className="size-4" />
            Close without Merge
          </Button>
        </div>
        <MergeDialog
          open={mergeOpen}
          onOpenChange={setMergeOpen}
          crId={crId}
          readableId={readableId}
          title={title}
          documentId={documentId}
          onMerged={onStatusChange}
        />
        <CloseDialog
          open={closeOpen}
          onOpenChange={setCloseOpen}
          crId={crId}
          onClosed={onStatusChange}
        />
        <RequestChangesDialog
          open={requestChangesOpen}
          onOpenChange={setRequestChangesOpen}
          crId={crId}
          onRequested={onStatusChange}
        />
      </>
    )
  }

  if (status === 'merged') {
    return (
      <div className="mt-6 border-t pt-6">
        <p className="text-[14px] font-normal text-muted-foreground">
          This change request has been merged.
        </p>
      </div>
    )
  }

  if (status === 'closed') {
    return (
      <div className="mt-6 border-t pt-6">
        <p className="text-[14px] font-normal text-muted-foreground">
          This change request is closed.
        </p>
      </div>
    )
  }

  return null
}
