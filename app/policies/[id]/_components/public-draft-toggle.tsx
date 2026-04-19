'use client'

import { useState } from 'react'
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

  const setPublicDraftMutation = trpc.document.setPublicDraft.useMutation({
    onSuccess: () => {
      toast.success('Public draft flag updated')
      utils.document.getById.invalidate({ id: documentId })
    },
    onError: (error) => toast.error(error.message),
  })

  function handleChange(checked: boolean) {
    if (checked && !isPublicDraft) {
      setConfirmOpen(true)
      return
    }
    setPublicDraftMutation.mutate({ id: documentId, isPublicDraft: checked })
  }

  function confirmEnable() {
    setConfirmOpen(false)
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
          checked={isPublicDraft}
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
