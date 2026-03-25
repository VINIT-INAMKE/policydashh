'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface CreateCRDialogProps {
  documentId: string
}

export function CreateCRDialog({ documentId }: CreateCRDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedFeedbackIds, setSelectedFeedbackIds] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const utils = trpc.useUtils()

  // Get accepted/partially accepted feedback for this document
  const feedbackQuery = trpc.feedback.list.useQuery({
    documentId,
    status: undefined, // We'll filter client-side for accepted + partially_accepted
  })

  const eligibleFeedback = (feedbackQuery.data ?? []).filter(
    (fb: { status: string }) => fb.status === 'accepted' || fb.status === 'partially_accepted'
  )

  const createMutation = trpc.changeRequest.create.useMutation({
    onSuccess: () => {
      toast.success('Change request created')
      utils.changeRequest.list.invalidate()
      resetAndClose()
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create change request')
    },
  })

  function resetAndClose() {
    setOpen(false)
    setStep(1)
    setSelectedFeedbackIds([])
    setTitle('')
    setDescription('')
  }

  function toggleFeedback(id: string) {
    setSelectedFeedbackIds((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    )
  }

  function handleCreate() {
    if (!title.trim() || selectedFeedbackIds.length === 0) return
    createMutation.mutate({
      documentId,
      title: title.trim(),
      description: description.trim() || undefined,
      feedbackIds: selectedFeedbackIds,
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Create Change Request
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Select Feedback Items</DialogTitle>
            </DialogHeader>
            <p className="text-[14px] text-muted-foreground">
              Choose accepted feedback to address in this change request.
            </p>
            <div className="mt-4 flex max-h-[320px] flex-col gap-2 overflow-y-auto">
              {eligibleFeedback.length === 0 ? (
                <p className="py-8 text-center text-[14px] text-muted-foreground">
                  No accepted feedback available. Accept feedback items first.
                </p>
              ) : (
                eligibleFeedback.map((fb: { id: string; readableId: string; title: string; status: string }) => (
                  <label
                    key={fb.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedFeedbackIds.includes(fb.id)}
                      onCheckedChange={() => toggleFeedback(fb.id)}
                    />
                    <Badge variant="secondary" className="shrink-0 font-mono text-[12px]">
                      {fb.readableId}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-[14px]">{fb.title}</span>
                  </label>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={resetAndClose}>Discard</Button>
              <Button
                disabled={selectedFeedbackIds.length === 0}
                onClick={() => setStep(2)}
              >
                Next: Add Details
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Change Request Details</DialogTitle>
            </DialogHeader>
            <p className="text-[14px] text-muted-foreground">
              {selectedFeedbackIds.length} feedback item{selectedFeedbackIds.length !== 1 ? 's' : ''} selected.
            </p>
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cr-title">Title</Label>
                <Input
                  id="cr-title"
                  placeholder="e.g., Clarify tax reporting thresholds"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cr-description">Description (optional)</Label>
                <Textarea
                  id="cr-description"
                  placeholder="Describe what this change request addresses..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[96px]"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button
                disabled={!title.trim() || createMutation.isPending}
                onClick={handleCreate}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Change Request'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
