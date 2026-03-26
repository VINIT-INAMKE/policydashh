'use client'

import { useState } from 'react'
import { MessageSquare, X } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface FeedbackLinkPickerProps {
  workshopId: string
  linkedFeedbackIds: string[]
}

export function FeedbackLinkPicker({ workshopId, linkedFeedbackIds }: FeedbackLinkPickerProps) {
  const [open, setOpen] = useState(false)
  const utils = trpc.useUtils()

  const unlinkMutation = trpc.workshop.unlinkFeedback.useMutation({
    onSuccess: () => {
      utils.workshop.getById.invalidate({ id: workshopId })
      toast.success('Feedback unlinked from workshop')
    },
  })

  function handleUnlink(feedbackId: string) {
    unlinkMutation.mutate({ workshopId, feedbackId })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
          Linked Feedback
        </span>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <MessageSquare className="mr-1 h-4 w-4" />
              Link Feedback
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Link Feedback to Workshop</DialogTitle>
            </DialogHeader>
            <p className="mt-2 text-[14px] text-muted-foreground">
              Select feedback items that originated from this workshop session. Feedback items will appear here once submitted to the platform.
            </p>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {linkedFeedbackIds.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">No feedback linked yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {linkedFeedbackIds.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 font-mono text-[12px]">
              {id.slice(0, 8)}
              <button onClick={() => handleUnlink(id)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
