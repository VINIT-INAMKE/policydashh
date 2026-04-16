'use client'

import { useState } from 'react'
import { trpc } from '@/src/trpc/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface AddSectionDialogProps {
  documentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSectionCreated?: (sectionId: string) => void
}

export function AddSectionDialog({
  documentId,
  open,
  onOpenChange,
  onSectionCreated,
}: AddSectionDialogProps) {
  const [title, setTitle] = useState('')
  const utils = trpc.useUtils()

  const createMutation = trpc.document.createSection.useMutation({
    onSuccess: (section) => {
      utils.document.getSections.invalidate({ documentId })
      toast.success('Section added.')
      onOpenChange(false)
      setTitle('')
      onSectionCreated?.(section.id)
    },
    onError: () => {
      toast.error("Couldn't create the section. Check your connection and try again.")
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    createMutation.mutate({ documentId, title: title.trim() })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) setTitle('')
        onOpenChange(value)
      }}
    >
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Add Section</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <Label htmlFor="section-title">Section Title</Label>
            <Input
              id="section-title"
              placeholder="e.g., Scope and Applicability"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              autoFocus
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Discard
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Add Section
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
