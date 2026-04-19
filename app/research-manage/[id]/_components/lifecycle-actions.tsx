'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { trpc } from '@/src/trpc/client'
import { can } from '@/src/lib/permissions'
import type { Role } from '@/src/lib/constants'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * ResearchLifecycleActions — Phase 27 D-14 (RESEARCH-07).
 *
 * Right-sidebar action card on /research-manage/[id] showing the
 * permission-derived set of lifecycle buttons:
 *   - Submit for Review (research_lead, admin, policy_lead on own draft)
 *   - Edit              (same as above on draft|pending_review)
 *   - Approve           (admin, policy_lead on pending_review)
 *   - Reject            (admin, policy_lead on pending_review — inline rationale)
 *   - Retract           (admin, policy_lead on published — Alert-Dialog)
 *
 * Server-side requirePermission + transitionResearch (Phase 26) is the
 * authorization truth. This component derives visibility for UX only.
 *
 * Every successful mutation invalidates BOTH utils.research.getById AND
 * utils.research.listTransitions so the metadata header AND decision log
 * re-fetch in the same render pass.
 */

type ResearchStatus = 'draft' | 'pending_review' | 'published' | 'retracted'

export interface ResearchLifecycleActionsProps {
  itemId: string
  status: ResearchStatus
  createdBy: string
  currentUserId: string
  currentUserRole: Role | null
}

export function ResearchLifecycleActions({
  itemId,
  status,
  createdBy,
  currentUserId,
  currentUserRole,
}: ResearchLifecycleActionsProps) {
  const utils = trpc.useUtils()

  // D-14: permission-derived client gating (server-side requirePermission
  // is the authorization truth; this is UX only).
  const canSubmit  = currentUserRole ? can(currentUserRole, 'research:submit_review') : false
  const canPublish = currentUserRole ? can(currentUserRole, 'research:publish')        : false
  const canRetract = currentUserRole ? can(currentUserRole, 'research:retract')        : false
  const canEdit    = currentUserRole ? can(currentUserRole, 'research:manage_own')     : false

  // Ownership: research_lead gated to own items; admin/policy_lead bypass
  const isOwner = createdBy === currentUserId
  const isAdminRole = currentUserRole === 'admin' || currentUserRole === 'policy_lead'

  function invalidateAll() {
    utils.research.getById.invalidate({ id: itemId })
    utils.research.listTransitions.invalidate({ id: itemId })
  }

  const submitMutation = trpc.research.submitForReview.useMutation({
    onSuccess: () => {
      toast.success('Submitted for review.')
      invalidateAll()
    },
    onError: (err) => toast.error(err.message || "Couldn't submit. Try again."),
  })

  const approveMutation = trpc.research.approve.useMutation({
    onSuccess: () => {
      toast.success('Research item approved and published.')
      invalidateAll()
    },
    onError: (err) => toast.error(err.message || "Couldn't approve. Try again."),
  })

  const [rejectExpanded, setRejectExpanded] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const rejectMutation = trpc.research.reject.useMutation({
    onSuccess: () => {
      toast.success('Research item rejected.')
      invalidateAll()
      setRejectExpanded(false)
      setRejectionReason('')
    },
    onError: (err) => toast.error(err.message || "Couldn't reject. Try again."),
  })

  const [retractDialogOpen, setRetractDialogOpen] = useState(false)
  const [retractionReason, setRetractionReason] = useState('')
  const retractMutation = trpc.research.retract.useMutation({
    onSuccess: () => {
      toast.success('Research item retracted.')
      invalidateAll()
      setRetractDialogOpen(false)
      setRetractionReason('')
    },
    onError: (err) => toast.error(err.message || "Couldn't retract. Try again."),
  })

  // -----------------------------------------------------------------------
  // Visibility matrix — per UI-SPEC §"/research-manage/[id]" sidebar block
  // -----------------------------------------------------------------------
  const showSubmit  = canSubmit  && status === 'draft' && (isOwner || isAdminRole)
  const showEdit    = canEdit    && (status === 'draft' || status === 'pending_review') && (isOwner || isAdminRole)
  const showApprove = canPublish && status === 'pending_review'
  const showReject  = canPublish && status === 'pending_review'
  const showRetract = canRetract && status === 'published'

  if (!showSubmit && !showEdit && !showApprove && !showReject && !showRetract) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
          Lifecycle
        </h3>
        <p className="text-xs text-muted-foreground">
          No actions available in this state.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
        Lifecycle
      </h3>

      {showSubmit && (
        <Button
          onClick={() => submitMutation.mutate({ id: itemId })}
          disabled={submitMutation.isPending}
          className="w-full"
        >
          Submit for Review
        </Button>
      )}

      {showEdit && (
        <Button
          variant="outline"
          render={<Link href={`/research-manage/${itemId}/edit`} />}
          className="w-full"
        >
          Edit
        </Button>
      )}

      {showApprove && (
        <Button
          onClick={() => approveMutation.mutate({ id: itemId })}
          disabled={approveMutation.isPending}
          className="w-full"
        >
          Approve
        </Button>
      )}

      {showReject && (
        <div className="flex flex-col gap-2">
          {!rejectExpanded ? (
            <Button
              variant="destructive"
              onClick={() => setRejectExpanded(true)}
              className="w-full"
            >
              Reject
            </Button>
          ) : (
            <>
              <Label htmlFor="reject-reason" className="text-xs">
                Rejection reason (required)
              </Label>
              <Textarea
                id="reject-reason"
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Why is this item being rejected?"
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  disabled={
                    rejectionReason.trim().length === 0 ||
                    rejectMutation.isPending
                  }
                  onClick={() =>
                    rejectMutation.mutate({
                      id: itemId,
                      rejectionReason: rejectionReason.trim(),
                    })
                  }
                  className="flex-1"
                >
                  Submit Rejection
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setRejectExpanded(false)
                    setRejectionReason('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {showRetract && (
        <>
          <Button
            variant="destructive"
            onClick={() => setRetractDialogOpen(true)}
            className="w-full"
          >
            Retract
          </Button>

          <AlertDialog
            open={retractDialogOpen}
            onOpenChange={(open) => {
              setRetractDialogOpen(open)
              if (!open) setRetractionReason('')
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Retract this research item?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove it from all public surfaces. Provide a reason — this is recorded in the audit log.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="flex flex-col gap-2 py-2">
                <Label htmlFor="retract-reason">Retraction reason (required)</Label>
                <Textarea
                  id="retract-reason"
                  rows={4}
                  value={retractionReason}
                  onChange={(e) => setRetractionReason(e.target.value)}
                />
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={
                    retractionReason.trim().length === 0 ||
                    retractMutation.isPending
                  }
                  onClick={() =>
                    retractMutation.mutate({
                      id: itemId,
                      retractionReason: retractionReason.trim(),
                    })
                  }
                >
                  Confirm Retract
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  )
}
