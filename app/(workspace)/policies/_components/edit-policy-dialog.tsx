'use client'

import { useState, useEffect } from 'react'
import { trpc } from '@/src/trpc/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface EditPolicyDialogProps {
  policy: { id: string; title: string; description: string | null }
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditPolicyDialog({ policy, open, onOpenChange }: EditPolicyDialogProps) {
  const [title, setTitle] = useState(policy.title)
  const [description, setDescription] = useState(policy.description ?? '')
  const utils = trpc.useUtils()

  useEffect(() => {
    if (open) {
      setTitle(policy.title)
      setDescription(policy.description ?? '')
    }
  }, [open, policy.title, policy.description])

  const updateMutation = trpc.document.update.useMutation({
    onSuccess: () => {
      utils.document.getById.invalidate({ id: policy.id })
      utils.document.list.invalidate()
      toast.success('Policy updated.')
      onOpenChange(false)
    },
    onError: () => {
      toast.error("Couldn't update the policy. Check your connection and try again.")
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    updateMutation.mutate({
      id: policy.id,
      title: title.trim(),
      description: description.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Edit Policy</DialogTitle>
          <DialogDescription>Update the policy document details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-policy-title">Title</Label>
              <Input
                id="edit-policy-title"
                placeholder="e.g., Data Protection Policy"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                autoFocus
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="edit-policy-description">Description</Label>
              <Textarea
                id="edit-policy-description"
                placeholder="Brief summary of this policy's scope and purpose"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={3}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Discard
            </Button>
            <Button type="submit" disabled={!title.trim() || updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
