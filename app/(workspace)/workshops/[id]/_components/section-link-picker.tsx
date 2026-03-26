'use client'

import { useState } from 'react'
import { Link2, X } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface SectionLinkPickerProps {
  workshopId: string
  linkedSectionIds: string[]
}

export function SectionLinkPicker({ workshopId, linkedSectionIds }: SectionLinkPickerProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const utils = trpc.useUtils()

  const documentsQuery = trpc.document.list.useQuery()
  const linkMutation = trpc.workshop.linkSection.useMutation({
    onSuccess: () => {
      utils.workshop.getById.invalidate({ id: workshopId })
      toast.success('Section linked to workshop')
    },
  })
  const unlinkMutation = trpc.workshop.unlinkSection.useMutation({
    onSuccess: () => {
      utils.workshop.getById.invalidate({ id: workshopId })
      toast.success('Section unlinked from workshop')
    },
  })

  function handleLink() {
    for (const sectionId of selected) {
      if (!linkedSectionIds.includes(sectionId)) {
        linkMutation.mutate({ workshopId, sectionId })
      }
    }
    setSelected([])
    setOpen(false)
  }

  function handleUnlink(sectionId: string) {
    unlinkMutation.mutate({ workshopId, sectionId })
  }

  function toggleSection(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  const allSections = (documentsQuery.data ?? []).flatMap((doc: { id: string; title: string; sections?: { id: string; title: string }[] }) =>
    (doc.sections ?? []).map((s) => ({ ...s, documentTitle: doc.title }))
  )

  const availableSections = allSections.filter(
    (s: { id: string }) => !linkedSectionIds.includes(s.id)
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
          Linked Sections
        </span>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Link2 className="mr-1 h-4 w-4" />
              Link Section
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Link Sections to Workshop</DialogTitle>
            </DialogHeader>
            <div className="mt-4 flex max-h-[320px] flex-col gap-2 overflow-y-auto">
              {availableSections.length === 0 ? (
                <p className="py-4 text-center text-[14px] text-muted-foreground">
                  All sections are already linked.
                </p>
              ) : (
                availableSections.map((s: { id: string; title: string; documentTitle: string }) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selected.includes(s.id)}
                      onCheckedChange={() => toggleSection(s.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[14px]">{s.title}</span>
                      <span className="text-[12px] text-muted-foreground">{s.documentTitle}</span>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Discard</Button>
              <Button disabled={selected.length === 0} onClick={handleLink}>
                Link {selected.length > 0 ? `(${selected.length})` : ''}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {linkedSectionIds.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">No sections linked yet.</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {linkedSectionIds.map((id) => {
            const section = allSections.find((s: { id: string }) => s.id === id)
            return (
              <Badge key={id} variant="secondary" className="gap-1">
                {section?.title ?? id.slice(0, 8)}
                <button onClick={() => handleUnlink(id)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
