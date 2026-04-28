'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Pencil,
  Check,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
} from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { SectionAssignments } from './section-assignments'
import type { BlockEditorFlushHandle } from './block-editor'

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
  /**
   * When true, automatically open the editor on mount / on section
   * change. Set by the parent when ?fromFeedback= is present so the
   * lead lands directly in edit mode for the section the feedback
   * is about.
   */
  autoEnterEditMode?: boolean
}

export function SectionContentView({
  section,
  canEdit,
  documentId,
  autoEnterEditMode,
}: SectionContentViewProps) {
  const [isEditing, setIsEditing] = useState(canEdit && !!autoEnterEditMode)
  // Auto-edit fires only on the FIRST section we mount with the prop —
  // subsequent sidebar clicks are treated as exploration, not addressing
  // feedback. Once the user clicks "Done editing" or selects a different
  // section, we don't keep forcing the editor open.
  const autoEnteredRef = useRef(canEdit && !!autoEnterEditMode)
  useEffect(() => {
    if (canEdit && autoEnterEditMode && !autoEnteredRef.current) {
      autoEnteredRef.current = true
      setIsEditing(true)
    }
  }, [canEdit, autoEnterEditMode])
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [isFlushing, setIsFlushing] = useState(false)
  // A10: ref the parent uses to tell BlockEditor to flush its pending
  // debounced save before we unmount it.
  const flushRef = useRef<BlockEditorFlushHandle | null>(null)

  const router = useRouter()
  const meQuery = trpc.user.getMe.useQuery()
  const role = meQuery.data?.role
  // feedback:submit permission (src/lib/permissions.ts) is granted to:
  // stakeholder, research_lead, workshop_moderator.
  // Admin and policy_lead do NOT have this permission.
  const canSubmitFeedback =
    role === 'stakeholder' ||
    role === 'research_lead' ||
    role === 'workshop_moderator'

  const handleSaveStateChange = useCallback((state: SaveState) => {
    setSaveState(state)
  }, [])

  // A10 + A12: before unmounting the editor, flush any pending debounced
  // save and wait for the mutation to settle. The old "Save changes"
  // button was a pure unmount — any edit made in the 1.5s window before
  // clicking it was silently lost because the debounce timer was cleared
  // at unmount without firing.
  const handleDoneEditing = useCallback(async () => {
    try {
      setIsFlushing(true)
      if (flushRef.current) {
        await flushRef.current.flush()
      }
    } finally {
      setIsFlushing(false)
      setIsEditing(false)
    }
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
            // A12: the editor autosaves on the debounce — there's no
            // manual save to hit. Rename "Save changes" to "Done editing"
            // and wire the click to flush the pending debounce first so
            // no last-keystroke edits are lost.
            <Button size="sm" onClick={handleDoneEditing} disabled={isFlushing}>
              {isFlushing ? (
                <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="mr-1 size-3.5" aria-hidden="true" />
              )}
              {isFlushing ? 'Saving…' : 'Done editing'}
            </Button>
          )}
        </div>
      </div>

      {/* Section assignments -- visible to Policy Lead / Admin */}
      {canEdit && (
        <div className="mt-4 rounded-md border p-3">
          <SectionAssignments sectionId={section.id} />
        </div>
      )}

      {/* Content area -- no max-width here so CommentPanel can expand into flex layout.
          `key={section.id}` on both editors forces a full unmount/remount
          when the user switches sections. Without it, ReadOnlyEditor
          (whose `useEditor` has no deps) reuses the same editor instance
          and keeps showing the previous section's content; BlockEditor
          would also race with its own [section.id] dep on the underlying
          tiptap useEditor. */}
      {canEdit && isEditing ? (
        <div className="mt-4 overflow-visible">
          <BlockEditor
            key={section.id}
            section={{ ...section, documentId }}
            onSaveStateChange={handleSaveStateChange}
            flushRef={flushRef}
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
            <ReadOnlyEditor key={section.id} content={section.content} />
          )}
        </div>
      )}

      {/* D-12: Give Feedback CTA -- visible only to roles with feedback:submit */}
      {canSubmitFeedback && !isEditing && (
        <div className="mt-6 flex w-full justify-end sm:w-auto">
          <Button
            variant="default"
            size="default"
            className="w-full sm:w-auto"
            onClick={() =>
              router.push(
                `/policies/${documentId}/sections/${section.id}/feedback/new`,
              )
            }
          >
            <MessageSquare className="mr-2 h-4 w-4" aria-hidden="true" />
            Give Feedback
          </Button>
        </div>
      )}
    </div>
  )
}
