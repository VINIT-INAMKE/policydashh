'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { SortableSectionItem } from './sortable-section-item'
import { AddSectionDialog } from './add-section-dialog'

interface Section {
  id: string
  documentId: string
  title: string
  orderIndex: number
  content: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

interface SectionSidebarProps {
  sections: Section[]
  documentId: string
  selectedSectionId: string | null
  onSelectSection: (id: string) => void
  canManageSections?: boolean
}

export function SectionSidebar({
  sections,
  documentId,
  selectedSectionId,
  onSelectSection,
  canManageSections = false,
}: SectionSidebarProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)

  const utils = trpc.useUtils()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const reorderMutation = trpc.document.reorderSections.useMutation({
    onMutate: async ({ orderedSectionIds }) => {
      await utils.document.getSections.cancel({ documentId })
      const previous = utils.document.getSections.getData({ documentId })

      if (previous) {
        const reordered = orderedSectionIds
          .map((id) => previous.find((s) => s.id === id))
          .filter(Boolean) as typeof previous
        utils.document.getSections.setData({ documentId }, reordered)
      }

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        utils.document.getSections.setData({ documentId }, context.previous)
      }
      toast.error("Couldn't reorder sections. The original order has been restored.")
    },
    onSettled: () => {
      utils.document.getSections.invalidate({ documentId })
    },
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sections.findIndex((s) => s.id === active.id)
    const newIndex = sections.findIndex((s) => s.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const newOrder = arrayMove(sections, oldIndex, newIndex)
    const orderedSectionIds = newOrder.map((s) => s.id)

    reorderMutation.mutate({ documentId, orderedSectionIds })
  }

  function handleSectionCreated(sectionId: string) {
    onSelectSection(sectionId)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
          Sections
        </span>
        {canManageSections && (
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add Section
          </Button>
        )}
      </div>

      {/* Section list */}
      {sections.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
          <h3 className="text-sm font-semibold">No sections</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Add sections to organize your policy document. Sections provide stable anchors for
            feedback and change tracking.
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="px-2 pb-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sections.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {sections.map((section) => (
                  <SortableSectionItem
                    key={section.id}
                    section={section}
                    isSelected={section.id === selectedSectionId}
                    onSelect={() => onSelectSection(section.id)}
                    documentId={documentId}
                    canManage={canManageSections}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </ScrollArea>
      )}

      {/* Add Section Dialog */}
      {canManageSections && (
        <AddSectionDialog
          documentId={documentId}
          open={addDialogOpen}
          onOpenChange={setAddDialogOpen}
          onSectionCreated={handleSectionCreated}
        />
      )}
    </div>
  )
}
