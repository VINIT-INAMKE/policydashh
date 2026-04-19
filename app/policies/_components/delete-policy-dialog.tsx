'use client'

import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
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
import { useState } from 'react'

interface DeletePolicyDialogProps {
  policy: {
    id: string
    title: string
    sectionCount: number
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface Blockers {
  versions: number
  changeRequests: number
  feedback: number
  milestones: number
}

// B5: the server now refuses to delete when related records exist. We parse
// the count summary out of the TRPCError message (format is stable) so the
// dialog can surface a helpful list instead of a generic failure toast.
function parseBlockers(message: string): Blockers | null {
  try {
    // Server includes a JSON-serialized cause via Error(message). That isn't
    // forwarded in the client-side TRPCClientError shape by default, so we
    // fall back to the prose summary embedded in the message.
    const versions = /versions:\s*(\d+)/.exec(message)?.[1]
    const changeRequests = /change requests:\s*(\d+)/.exec(message)?.[1]
    const feedback = /feedback:\s*(\d+)/.exec(message)?.[1]
    const milestones = /milestones:\s*(\d+)/.exec(message)?.[1]
    if (!versions && !changeRequests && !feedback && !milestones) return null
    return {
      versions: Number(versions ?? 0),
      changeRequests: Number(changeRequests ?? 0),
      feedback: Number(feedback ?? 0),
      milestones: Number(milestones ?? 0),
    }
  } catch {
    return null
  }
}

export function DeletePolicyDialog({ policy, open, onOpenChange }: DeletePolicyDialogProps) {
  const utils = trpc.useUtils()
  const [blockers, setBlockers] = useState<Blockers | null>(null)

  const deleteMutation = trpc.document.delete.useMutation({
    onSuccess: () => {
      utils.document.list.invalidate()
      setBlockers(null)
      onOpenChange(false)
      toast.success('Policy deleted.')
    },
    onError: (err) => {
      if (err.data?.code === 'PRECONDITION_FAILED') {
        const parsed = parseBlockers(err.message)
        if (parsed) {
          setBlockers(parsed)
          return
        }
      }
      toast.error("Couldn't delete the policy. Check your connection and try again.")
    },
  })

  function handleOpenChange(next: boolean) {
    if (!next) setBlockers(null)
    onOpenChange(next)
  }

  const hasBlockers = !!blockers && (
    blockers.versions + blockers.changeRequests + blockers.feedback + blockers.milestones > 0
  )

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-[440px]">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {hasBlockers ? 'Cannot delete this policy' : 'Delete Policy'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {hasBlockers ? (
              <>
                &ldquo;{policy.title}&rdquo; has related records. Remove or archive them first.
              </>
            ) : (
              <>
                This will permanently delete &ldquo;{policy.title}&rdquo; and all{' '}
                {policy.sectionCount} sections within it. This action cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasBlockers && blockers ? (
          <ul className="mt-2 space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            {blockers.versions > 0 && (
              <li>
                <span className="font-medium">Versions:</span> {blockers.versions}
              </li>
            )}
            {blockers.changeRequests > 0 && (
              <li>
                <span className="font-medium">Change requests:</span> {blockers.changeRequests}
              </li>
            )}
            {blockers.feedback > 0 && (
              <li>
                <span className="font-medium">Feedback items:</span> {blockers.feedback}
              </li>
            )}
            {blockers.milestones > 0 && (
              <li>
                <span className="font-medium">Milestones:</span> {blockers.milestones}
              </li>
            )}
          </ul>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>{hasBlockers ? 'Close' : 'Keep Policy'}</AlertDialogCancel>
          {!hasBlockers && (
            <AlertDialogAction
              render={
                <Button
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={(e) => {
                    e.preventDefault()
                    deleteMutation.mutate({ id: policy.id })
                  }}
                />
              }
            >
              {deleteMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Delete Policy
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
