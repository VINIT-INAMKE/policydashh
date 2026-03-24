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

interface DeletePolicyDialogProps {
  policy: {
    id: string
    title: string
    sectionCount: number
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeletePolicyDialog({ policy, open, onOpenChange }: DeletePolicyDialogProps) {
  const utils = trpc.useUtils()

  const deleteMutation = trpc.document.delete.useMutation({
    onSuccess: () => {
      utils.document.list.invalidate()
      onOpenChange(false)
      toast.success('Policy deleted.')
    },
    onError: () => {
      toast.error("Couldn't delete the policy. Check your connection and try again.")
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-[420px]">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Policy</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete &ldquo;{policy.title}&rdquo; and all{' '}
            {policy.sectionCount} sections within it. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Policy</AlertDialogCancel>
          <AlertDialogAction
            render={
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate({ id: policy.id })}
              />
            }
          >
            {deleteMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Delete Policy
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
