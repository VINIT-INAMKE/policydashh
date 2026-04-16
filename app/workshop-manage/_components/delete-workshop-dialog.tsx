'use client'

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

export function DeleteWorkshopDialog({
  workshopId,
  workshopTitle,
  open,
  onOpenChange,
}: DeleteWorkshopDialogProps) {
  const utils = trpc.useUtils()

  const deleteMutation = trpc.workshop.delete.useMutation({
    onSuccess: () => {
      toast.success('Workshop deleted.')
      utils.workshop.list.invalidate()
      onOpenChange(false)
    },
    onError: () => {
      toast.error('Could not delete the workshop. Try again.')
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Workshop</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete &ldquo;{workshopTitle}&rdquo; and all its artifacts. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Workshop</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate({ workshopId })}
          >
            {deleteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Delete Workshop
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
