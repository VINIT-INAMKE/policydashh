'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GripVertical, MoreHorizontal } from 'lucide-react'
import { RenameSectionDialog } from './rename-section-dialog'
import { DeleteSectionDialog } from './delete-section-dialog'

interface Section {
  id: string
  documentId: string
  title: string
  orderIndex: number
  content: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

interface SortableSectionItemProps {
  section: Section
  isSelected: boolean
  onSelect: () => void
  documentId: string
}

export function SortableSectionItem({
  section,
  isSelected,
  onSelect,
  documentId,
}: SortableSectionItemProps) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`group flex items-center gap-1 rounded-md px-2 py-2 text-sm transition-colors ${
          isDragging
            ? 'z-50 opacity-80 shadow-md motion-safe:scale-[1.02]'
            : ''
        } ${
          isSelected
            ? 'border-l-2 border-primary bg-background font-semibold'
            : 'border-l-2 border-transparent hover:bg-background/50'
        }`}
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect()
          }
        }}
      >
        {/* Drag handle */}
        <button
          className="shrink-0 cursor-grab opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
          aria-label={`Reorder ${section.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* Section title */}
        <span className="min-w-0 flex-1 truncate">{section.title}</span>

        {/* More actions */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-accent hover:text-accent-foreground focus:opacity-100 group-hover:opacity-100"
            aria-label={`More options for ${section.title}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                setRenameOpen(true)
              }}
            >
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteOpen(true)
              }}
            >
              Delete Section
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Rename dialog */}
      <RenameSectionDialog
        section={{ id: section.id, documentId, title: section.title }}
        open={renameOpen}
        onOpenChange={setRenameOpen}
      />

      {/* Delete dialog */}
      <DeleteSectionDialog
        section={{ id: section.id, documentId, title: section.title }}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}
