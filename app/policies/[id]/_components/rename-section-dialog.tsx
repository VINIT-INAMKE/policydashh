'use client'

import { useState, useEffect } from 'react'
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

interface RenameSectionDialogProps {
  section: { id: string; documentId: string; title: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RenameSectionDialog({
  section,
  open,
  onOpenChange,
}: RenameSectionDialogProps) {
  const [title, setTitle] = useState(section.title)
  const utils = trpc.useUtils()

  useEffect(() => {
    if (open) {
      setTitle(section.title)
    }
  }, [open, section.title])

  const renameMutation = trpc.document.renameSection.useMutation({
    onSuccess: () => {
      utils.document.getSections.invalidate({ documentId: section.documentId })
      toast.success('Section renamed.')
      onOpenChange(false)
    },
    onError: () => {
      toast.error("Couldn't rename the section. Check your connection and try again.")
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    renameMutation.mutate({
      id: section.id,
      documentId: section.documentId,
      title: title.trim(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Rename Section</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <Label htmlFor="rename-section-title">Section Title</Label>
            <Input
              id="rename-section-title"
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
              disabled={!title.trim() || renameMutation.isPending}
            >
              {renameMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Rename Section
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
