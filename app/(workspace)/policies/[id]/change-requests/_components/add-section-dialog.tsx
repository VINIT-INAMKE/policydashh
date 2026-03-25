'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { toast } from 'sonner'

interface AddSectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  crId: string
  documentId: string
  existingSectionIds: string[]
  onAdded: () => void
}

export function AddSectionDialog({
  open,
  onOpenChange,
  crId,
  documentId,
  existingSectionIds,
  onAdded,
}: AddSectionDialogProps) {
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')

  const sectionsQuery = trpc.document.getSections.useQuery(
    { documentId },
    { enabled: open },
  )

  const addSectionMutation = trpc.changeRequest.addSection.useMutation({
    onSuccess: () => {
      toast.success('Section added.')
      setSelectedSectionId('')
      onOpenChange(false)
      onAdded()
    },
    onError: () => {
      toast.error("Couldn't add the section. Your changes were not saved.")
    },
  })

  // Filter out already-linked sections
  const availableSections = (sectionsQuery.data ?? []).filter(
    (s) => !existingSectionIds.includes(s.id),
  )

  function handleAdd() {
    if (!selectedSectionId) return
    addSectionMutation.mutate({
      crId,
      sectionId: selectedSectionId,
    })
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setSelectedSectionId('')
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Add Affected Section</DialogTitle>
          <DialogDescription>
            Select a policy section affected by this change request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label
            htmlFor="section-select"
            className="text-sm font-medium leading-none"
          >
            Section
          </label>
          <Select
            value={selectedSectionId}
            onValueChange={setSelectedSectionId}
          >
            <SelectTrigger id="section-select">
              <SelectValue placeholder="Select a section..." />
            </SelectTrigger>
            <SelectContent>
              {availableSections.length === 0 ? (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                  No available sections.
                </div>
              ) : (
                availableSections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.title}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="default"
            disabled={!selectedSectionId || addSectionMutation.isPending}
            onClick={handleAdd}
            className={addSectionMutation.isPending ? 'pointer-events-none' : ''}
          >
            {addSectionMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Add Section
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
