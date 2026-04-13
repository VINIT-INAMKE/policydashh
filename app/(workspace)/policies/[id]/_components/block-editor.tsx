'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent, ReactNodeViewRenderer, ReactRenderer } from '@tiptap/react'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import { useDebouncedCallback } from 'use-debounce'
import { GripVertical, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/src/trpc/client'
import { buildExtensions } from '@/src/lib/tiptap-extensions/build-extensions'
import { getSlashCommandItems } from '@/src/lib/tiptap-extensions/slash-command-extension'
import { Callout } from '@/src/lib/tiptap-extensions/callout-node'
import { FileAttachment } from '@/src/lib/tiptap-extensions/file-attachment-node'
import { LinkPreview } from '@/src/lib/tiptap-extensions/link-preview-node'
import { CalloutBlockView } from './callout-block-view'
import { ImageBlockView } from './image-block-view'
import { FileAttachmentView } from './file-attachment-view'
import { LinkPreviewView } from './link-preview-view'
import { CodeBlockView } from './code-block-view'
import { EditorToolbar } from './editor-toolbar'
import { FloatingLinkEditor } from './floating-link-editor'
import { SlashCommandMenu, type SlashCommandMenuRef } from './slash-command-menu'
import type { Editor } from '@tiptap/core'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import type { SlashCommandItem } from '@/src/lib/tiptap-extensions/slash-command-extension'

// Extend Callout with React NodeView
const CalloutWithView = Callout.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CalloutBlockView)
  },
})

// Extend FileAttachment with React NodeView
const FileAttachmentWithView = FileAttachment.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FileAttachmentView)
  },
})

// Extend LinkPreview with React NodeView
const LinkPreviewWithView = LinkPreview.extend({
  addNodeView() {
    return ReactNodeViewRenderer(LinkPreviewView)
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
    onError: () => {
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

  const handleBlur = useCallback(() => {
    if (isDirtyRef.current) {
      debouncedSave.flush()
    }
  }, [debouncedSave])

  // Build extensions with slash command suggestion render wired
  const extensions = buildExtensions({
    onSlashCommand: {
      items: ({ query }: { query: string }) => getSlashCommandItems(query),
      render: () => {
        let component: ReactRenderer<SlashCommandMenuRef> | null = null

        return {
          onStart: (props: SuggestionProps<SlashCommandItem>) => {
            component = new ReactRenderer(SlashCommandMenu, {
              props: {
                items: props.items,
                command: props.command,
                clientRect: props.clientRect,
              },
              editor: props.editor,
            })
          },
          onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
            component?.updateProps({
              items: props.items,
              command: props.command,
              clientRect: props.clientRect,
            })
          },
          onKeyDown: (props: SuggestionKeyDownProps) => {
            if (props.event.key === 'Escape') {
              component?.destroy()
              component = null
              return true
            }
            return (component?.ref as SlashCommandMenuRef)?.onKeyDown?.(props) ?? false
          },
          onExit: () => {
            component?.destroy()
            component = null
          },
        }
      },
    },
  }).map((ext) => {
    // Replace headless extensions with React NodeView versions
    if (ext.name === 'callout') return CalloutWithView
    if (ext.name === 'fileAttachment') return FileAttachmentWithView
    if (ext.name === 'linkPreview') return LinkPreviewWithView
    // Add React NodeView to Image extension
    if (ext.name === 'image') {
      return ext.extend({
        addNodeView() {
          return ReactNodeViewRenderer(ImageBlockView)
        },
      })
    }
    // Add React NodeView to CodeBlockLowlight extension
    if (ext.name === 'codeBlock') {
      return ext.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockView)
        },
      })
    }
    // Wire FileHandler onDrop/onPaste to upload files
    if (ext.name === 'fileHandler') {
      return ext.configure({
        allowedMimeTypes: [
          'image/png', 'image/jpeg', 'image/gif', 'image/webp',
          'application/pdf', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        onDrop: (currentEditor: Editor, files: File[], pos: number) => {
          for (const file of files) {
            if (file.type.startsWith('image/')) {
              // Insert empty image node, then upload fills it
              currentEditor.chain().focus().insertContentAt(pos, {
                type: 'image',
                attrs: { src: '' },
              }).run()
              // The ImageBlockView NodeView will handle showing upload state
              // via its idle -> uploading flow when src is empty
            } else {
              currentEditor.chain().focus().insertContentAt(pos, {
                type: 'fileAttachment',
                attrs: { url: null, filename: file.name, filesize: file.size },
              }).run()
            }
          }
        },
        onPaste: (currentEditor: Editor, files: File[]) => {
          for (const file of files) {
            if (file.type.startsWith('image/')) {
              currentEditor.chain().focus().insertContent({
                type: 'image',
                attrs: { src: '' },
              }).run()
            } else {
              currentEditor.chain().focus().insertContent({
                type: 'fileAttachment',
                attrs: { url: null, filename: file.name, filesize: file.size },
              }).run()
            }
          }
        },
      })
    }
    return ext
  })

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
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
    <div className="flex">
      {/* Main editor area */}
      <div className="relative flex-1">
        {/* Header bar: save indicator */}
        <div className="flex items-center justify-end px-6 py-1">
          {/* Save state indicator */}
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

        {/* Toolbar */}
        <EditorToolbar editor={editor} onLinkClick={() => setLinkEditorOpen(true)} />

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

        {/* Floating link editor */}
        {linkEditorOpen && (
          <div className="absolute left-1/2 top-16 z-50 -translate-x-1/2">
            <FloatingLinkEditor
              editor={editor}
              isOpen={linkEditorOpen}
              onClose={() => setLinkEditorOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
