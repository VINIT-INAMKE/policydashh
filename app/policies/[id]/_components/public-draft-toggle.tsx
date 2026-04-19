'use client'

import { useEffect, useState } from 'react'
import { trpc } from '@/src/trpc/client'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
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

interface PublicDraftToggleProps {
  documentId: string
  isPublicDraft: boolean
}

// D22: enabling public draft flips this policy into the unauth-visible
// `/framework` listing (and also makes the public PDF export available).
// Confirm before enabling so a mis-click doesn't publish a half-finished
// draft; disabling stays one-click.
export function PublicDraftToggle({ documentId, isPublicDraft }: PublicDraftToggleProps) {
  const utils = trpc.useUtils()
  const [confirmOpen, setConfirmOpen] = useState(false)
  // A6: mirror the parent prop in local state so the switch updates
  // immediately on click rather than waiting for the mutation round-trip
  // + cache invalidation to finish (used to flicker for ~200ms). On
  // error we roll back to the last known server value.
  const [localValue, setLocalValue] = useState(isPublicDraft)

  // Keep local state in sync when the parent query refetches — e.g. after
  // the mutation succeeds or a sibling component invalidates the cache.
  useEffect(() => {
    setLocalValue(isPublicDraft)
  }, [isPublicDraft])

  const setPublicDraftMutation = trpc.document.setPublicDraft.useMutation({
    onSuccess: (_data, variables) => {
      toast.success('Public draft flag updated')
      // Anchor optimistic state to the confirmed server value before the
      // invalidate round-trip lands.
      setLocalValue(variables.isPublicDraft)
      utils.document.getById.invalidate({ id: documentId })
    },
    onError: (error) => {
      // A6: roll back the optimistic flip if the server rejected it.
      setLocalValue(isPublicDraft)
      toast.error(error.message)
    },
  })

  function handleChange(checked: boolean) {
    if (checked && !isPublicDraft) {
      setConfirmOpen(true)
      return
    }
    // Optimistic flip — roll back in onError if the server rejects.
    setLocalValue(checked)
    setPublicDraftMutation.mutate({ id: documentId, isPublicDraft: checked })
  }

  function confirmEnable() {
    setConfirmOpen(false)
    setLocalValue(true)
    setPublicDraftMutation.mutate({ id: documentId, isPublicDraft: true })
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">Public Draft Consultation</p>
          <p className="text-xs text-muted-foreground">
            Make this document visible on the public /framework page.
          </p>
        </div>
        <Switch
          checked={localValue}
          onCheckedChange={handleChange}
          disabled={setPublicDraftMutation.isPending}
        />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="sm:max-w-[440px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Publish this draft publicly?</AlertDialogTitle>
            <AlertDialogDescription>
              Enabling the public draft flag lists this policy on the
              unauthenticated <code>/framework</code> page and makes any
              published version downloadable as PDF. You can disable this
              later at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEnable}>Enable public draft</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
