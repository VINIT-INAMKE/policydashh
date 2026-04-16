'use client'

import { trpc } from '@/src/trpc/client'
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
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface DeleteSectionDialogProps {
  section: { id: string; documentId: string; title: string }
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted?: () => void
}

export function DeleteSectionDialog({
  section,
  open,
  onOpenChange,
  onDeleted,
}: DeleteSectionDialogProps) {
  const utils = trpc.useUtils()

  const deleteMutation = trpc.document.deleteSection.useMutation({
    onSuccess: () => {
      utils.document.getSections.invalidate({ documentId: section.documentId })
      toast.success('Section deleted.')
      onOpenChange(false)
      onDeleted?.()
    },
    onError: () => {
      toast.error("Couldn't delete the section. Check your connection and try again.")
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[420px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Section</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the section &quot;{section.title}&quot; and all its
            content. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Section</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault()
              deleteMutation.mutate({
                id: section.id,
                documentId: section.documentId,
              })
            }}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Delete Section
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
