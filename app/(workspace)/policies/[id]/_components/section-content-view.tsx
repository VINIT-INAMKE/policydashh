'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Pencil, Check, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

// Dynamic import with SSR disabled -- DragHandle causes hydration issues
const BlockEditor = dynamic(() => import('./block-editor'), { ssr: false })
const ReadOnlyEditor = dynamic(() => import('./read-only-editor'), { ssr: false })

interface Section {
  id: string
  title: string
  content: Record<string, unknown> | null
  updatedAt: string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface SectionContentViewProps {
  section: Section
  canEdit: boolean
  documentId: string
}

export function SectionContentView({
  section,
  canEdit,
  documentId,
}: SectionContentViewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const handleSaveStateChange = useCallback((state: SaveState) => {
    setSaveState(state)
  }, [])

  const isEmpty =
    !section.content ||
    (typeof section.content === 'object' &&
      (!('content' in section.content) ||
        (Array.isArray((section.content as { content?: unknown[] }).content) &&
          ((section.content as { content: unknown[] }).content).length === 0)))

  return (
    <div>
      {/* Section header with edit toggle */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold leading-[1.2]">{section.title}</h2>

        <div className="flex items-center gap-2">
          {/* Auto-save indicator */}
          {isEditing && saveState === 'saving' && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Saving...
            </span>
          )}
          {isEditing && saveState === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3" />
              Saved
            </span>
          )}
          {isEditing && saveState === 'error' && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="size-3" />
              Error saving
            </span>
          )}

          {/* Edit / Save toggle */}
          {canEdit && !isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="mr-1 size-3.5" />
              Edit section
            </Button>
          )}
          {canEdit && isEditing && (
            <Button size="sm" onClick={() => setIsEditing(false)}>
              <Check className="mr-1 size-3.5" />
              Save changes
            </Button>
          )}
        </div>
      </div>

      {/* Content area -- no max-width here so CommentPanel can expand into flex layout */}
      {canEdit && isEditing ? (
        <div className="mt-4 overflow-visible">
          <BlockEditor
            section={{ ...section, documentId }}
            onSaveStateChange={handleSaveStateChange}
          />
        </div>
      ) : (
        <div className="mt-4">
          {isEmpty ? (
            <p className="text-sm text-muted-foreground">
              This section has no content yet.{' '}
              {canEdit ? 'Click "Edit section" to start writing.' : ''}
            </p>
          ) : (
            <ReadOnlyEditor content={section.content} />
          )}
        </div>
      )}
    </div>
  )
}
