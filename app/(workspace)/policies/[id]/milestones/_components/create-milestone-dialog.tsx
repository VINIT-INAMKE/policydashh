'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { trpc } from '@/src/trpc/client'

interface CreateMilestoneDialogProps {
  documentId: string
  trigger: React.ReactNode
}

export function CreateMilestoneDialog({ documentId, trigger }: CreateMilestoneDialogProps) {
  const router = useRouter()
  const utils = trpc.useUtils()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [versions, setVersions] = useState(0)
  const [workshops, setWorkshops] = useState(0)
  const [feedback, setFeedback] = useState(0)
  const [evidence, setEvidence] = useState(0)

  const createMutation = trpc.milestone.create.useMutation({
    onSuccess: async (created) => {
      toast.success('Milestone created')
      await utils.milestone.list.invalidate({ documentId })
      setOpen(false)
      router.push(`/policies/${documentId}/milestones/${created.id}`)
    },
    onError: () => {
      toast.error('Failed to create milestone. Try again.')
    },
  })

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!title.trim()) return
    createMutation.mutate({
      documentId,
      title: title.trim(),
      description: description.trim() || undefined,
      requiredSlots: { versions, workshops, feedback, evidence },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Create milestone</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Define required slot counts then add entities on the detail page.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="milestone-title" className="text-sm font-semibold">Name</Label>
              <Input
                id="milestone-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. v1.0 Consultation Milestone"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="milestone-description" className="text-sm font-semibold">Description</Label>
              <Textarea
                id="milestone-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional — what does this milestone represent?"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <SlotInput id="slot-versions" label="Versions" helper="Minimum linked versions" value={versions} onChange={setVersions} />
              <SlotInput id="slot-workshops" label="Workshops" helper="Minimum linked workshops" value={workshops} onChange={setWorkshops} />
              <SlotInput id="slot-feedback" label="Feedback items" helper="Minimum linked feedback items" value={feedback} onChange={setFeedback} />
              <SlotInput id="slot-evidence" label="Evidence artifacts" helper="Minimum linked artifacts" value={evidence} onChange={setEvidence} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={createMutation.isPending}>
              Discard
            </Button>
            <Button type="submit" variant="default" disabled={createMutation.isPending || !title.trim()}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  Creating…
                </>
              ) : (
                'Create milestone'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SlotInput({
  id,
  label,
  helper,
  value,
  onChange,
}: {
  id: string
  label: string
  helper: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      />
      <p className="text-xs text-muted-foreground">{helper}</p>
    </div>
  )
}
