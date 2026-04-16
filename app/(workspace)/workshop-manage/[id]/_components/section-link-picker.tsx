'use client'

import { useState } from 'react'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export interface SectionLinkPickerProps {
  workshopId: string
  linkedSectionIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SectionLinkPicker({ workshopId, linkedSectionIds, open, onOpenChange }: SectionLinkPickerProps) {
  const [selected, setSelected] = useState<string[]>([])
  const utils = trpc.useUtils()

  const documentsQuery = trpc.document.list.useQuery({ includeSections: true })
  const linkMutation = trpc.workshop.linkSection.useMutation({
    onSuccess: () => {
      utils.workshop.getById.invalidate({ workshopId })
      toast.success('Section linked to workshop')
    },
  })

  function handleLink() {
    for (const sectionId of selected) {
      if (!linkedSectionIds.includes(sectionId)) {
        linkMutation.mutate({ workshopId, sectionId })
      }
    }
    setSelected([])
    onOpenChange(false)
  }

  function toggleSection(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const allSections = (documentsQuery.data ?? []).flatMap((doc) =>
    (doc.sections ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      documentTitle: doc.title,
      blockCount: (s.content as { content?: unknown[] })?.content?.length ?? 0,
    }))
  )

  const availableSections = allSections.filter((s) => !linkedSectionIds.includes(s.id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link Sections to Workshop</DialogTitle>
        </DialogHeader>
        <div className="mt-4 flex max-h-[320px] flex-col gap-2 overflow-y-auto">
          {documentsQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : availableSections.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              All sections are already linked.
            </p>
          ) : (
            availableSections.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/50"
              >
                <Checkbox
                  checked={selected.includes(s.id)}
                  onCheckedChange={() => toggleSection(s.id)}
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{s.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.documentTitle} &middot; {s.blockCount} blocks
                  </span>
                </div>
              </label>
            ))
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Discard</Button>
          <Button disabled={selected.length === 0} onClick={handleLink}>
            Link {selected.length > 0 ? `(${selected.length})` : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
