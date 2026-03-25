'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import { useDebouncedCallback } from 'use-debounce'
import { GripVertical, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/src/trpc/client'
import { buildExtensions } from '@/src/lib/tiptap-extensions/build-extensions'
import { Callout } from '@/src/lib/tiptap-extensions/callout-node'
import { CalloutBlockView } from './callout-block-view'
import type { Editor } from '@tiptap/core'

// Extend Callout with React NodeView
const CalloutWithView = Callout.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CalloutBlockView)
  },
})

interface BlockEditorProps {
  section: {
    id: string
    documentId: string
    title: string
    content: Record<string, unknown> | null
    updatedAt: string
  }
  onSaveStateChange?: (state: SaveState) => void
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function BlockEditor({ section, onSaveStateChange }: BlockEditorProps) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const isDirtyRef = useRef(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [linkEditorOpen, setLinkEditorOpen] = useState(false)

  const updateSaveState = useCallback(
    (state: SaveState) => {
      setSaveState(state)
      onSaveStateChange?.(state)
    },
    [onSaveStateChange],
  )

  const mutation = trpc.document.updateSectionContent.useMutation({
    onMutate: () => {
      updateSaveState('saving')
    },
    onSuccess: () => {
      isDirtyRef.current = false
      updateSaveState('saved')
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        updateSaveState('idle')
      }, 3000)
    },
    onError: (error) => {
      updateSaveState('error')
      toast.error("Couldn't save your changes. Check your connection and try again.")
    },
  })

  const debouncedSave = useDebouncedCallback(
    (content: Record<string, unknown>) => {
      mutation.mutate({
        id: section.id,
        documentId: section.documentId,
        content,
      })
    },
    1500,
  )

  const handleUpdate = useCallback(
    ({ editor }: { editor: Editor }) => {
      isDirtyRef.current = true
      debouncedSave(editor.getJSON() as Record<string, unknown>)
    },
    [debouncedSave],
  )

  const handleBlur = useCallback(
    ({ editor }: { editor: Editor }) => {
      if (isDirtyRef.current) {
        debouncedSave.flush()
      }
    },
    [debouncedSave],
  )

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: buildExtensions().map((ext) => {
        // Replace the base Callout with the React NodeView version
        if (ext.name === 'callout') return CalloutWithView
        return ext
      }),
      content: section.content ?? {
        type: 'doc',
        content: [{ type: 'paragraph' }],
      },
      editorProps: {
        attributes: {
          class: 'prose prose-sm max-w-none focus:outline-none',
        },
      },
      onUpdate: handleUpdate,
      onBlur: handleBlur,
    },
    [section.id],
  )

  // Navigation guard: warn on unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const flushSave = useCallback(() => {
    if (isDirtyRef.current && editor) {
      mutation.mutate({
        id: section.id,
        documentId: section.documentId,
        content: editor.getJSON() as Record<string, unknown>,
      })
    }
  }, [editor, mutation, section.id, section.documentId])

  if (!editor) {
    return (
      <div className="mx-auto max-w-[768px] px-6 py-8">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-2/5 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Save state indicator */}
      <div className="flex items-center gap-1.5 px-6 py-1">
        {saveState === 'saving' && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Saving...
          </span>
        )}
        {saveState === 'saved' && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3" />
            Saved
          </span>
        )}
        {saveState === 'error' && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3" />
            Error saving
          </span>
        )}
      </div>

      {/* DragHandle */}
      <DragHandle editor={editor}>
        <div
          className="flex cursor-grab items-center justify-center rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder block"
        >
          <GripVertical className="size-4" />
        </div>
      </DragHandle>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="mx-auto max-w-[768px] px-6 py-8 [&_.ProseMirror]:min-h-[200px] [&_.ProseMirror]:focus:outline-none"
      />
    </div>
  )
}
