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
import { markSectionPending, markSectionFlushed } from './section-autosave-pending'
import {
  newPendingUploadId,
  registerPendingImageUpload,
} from './pending-image-uploads'
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

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/**
 * A16: walks the Tiptap JSON tree and removes image nodes whose `src`
 * attribute is an empty string. Those are placeholder nodes produced by
 * the toolbar's "Insert image" button (and the drop/paste handlers)
 * before the upload completes — if the user navigates away or "Done
 * editing"s before uploading, we DON'T want to persist a dead image
 * placeholder that renders as `<img src="#">` in exports.
 */
function stripEmptyImageNodes(node: unknown): Record<string, unknown> {
  const clone = (n: unknown): unknown => {
    if (!n || typeof n !== 'object') return n
    const src = n as {
      type?: string
      attrs?: Record<string, unknown>
      content?: unknown[]
    }
    if (Array.isArray(src.content)) {
      const kept: unknown[] = []
      for (const child of src.content) {
        if (
          child &&
          typeof child === 'object' &&
          (child as { type?: string }).type === 'image'
        ) {
          const attrs = (child as { attrs?: Record<string, unknown> }).attrs
          const srcAttr = attrs?.src
          if (typeof srcAttr !== 'string' || srcAttr.length === 0) {
            continue
          }
        }
        kept.push(clone(child))
      }
      return { ...src, content: kept }
    }
    return src
  }
  return clone(node) as Record<string, unknown>
}

export interface BlockEditorFlushHandle {
  /**
   * Synchronously fires any pending debounced save and waits for the
   * server round-trip to complete. Safe to call multiple times; returns
   * immediately when nothing is dirty.
   */
  flush: () => Promise<void>
}

interface BlockEditorProps {
  section: {
    id: string
    documentId: string
    title: string
    content: Record<string, unknown> | null
    updatedAt: string
  }
  onSaveStateChange?: (state: SaveState) => void
  /**
   * A10: give the parent (`SectionContentView`) a handle so the
   * "Done editing" button can flush any in-flight debounce BEFORE
   * unmounting the editor. Without this the last ~1.5 s of edits were
   * silently lost if the user typed then immediately exited edit mode.
   */
  flushRef?: React.MutableRefObject<BlockEditorFlushHandle | null>
}

export default function BlockEditor({ section, onSaveStateChange, flushRef }: BlockEditorProps) {
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
      // D14: report this section as flushed so the Create-Version dialog
      // can block when anything is still pending.
      markSectionFlushed(section.id)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        updateSaveState('idle')
      }, 3000)
    },
    onError: () => {
      updateSaveState('error')
      // Keep the pending flag set so the UI keeps blocking snapshots while
      // the user retries.
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

  // A10: expose a flush handle to the parent. Flushing in-flight debounces
  // and then awaiting the currently-running mutation guarantees the parent
  // can't unmount the editor before the last save has landed.
  // We track "something still unsaved" through isDirtyRef (flipped in
  // onSuccess) rather than `mutation.isPending`, so the flush can outlive
  // any single useMutation render snapshot.
  const mutationRef = useRef(mutation)
  useEffect(() => {
    mutationRef.current = mutation
  }, [mutation])
  useEffect(() => {
    if (!flushRef) return
    flushRef.current = {
      flush: async () => {
        if (isDirtyRef.current) {
          debouncedSave.flush()
        }
        // Poll until the dirty flag clears (onSuccess flips it false) or
        // we hit a hard 5s cap — enough to let the network round-trip
        // finish but short enough that a stuck request won't freeze the
        // "Done editing" click forever.
        let ticks = 0
        while (
          (isDirtyRef.current || mutationRef.current.isPending) &&
          ticks < 200
        ) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 25))
          ticks += 1
        }
      },
    }
    return () => {
      if (flushRef.current) flushRef.current = null
    }
  }, [flushRef, debouncedSave])

  const handleUpdate = useCallback(
    ({ editor }: { editor: Editor }) => {
      isDirtyRef.current = true
      // D14: mark pending immediately so a freshly typed character is
      // visible to any watchers before the debounced write fires.
      markSectionPending(section.id)
      // A16: strip image nodes with an empty src BEFORE autosaving so a
      // half-inserted placeholder (toolbar click without upload, upload
      // error, etc.) never persists to the DB. Ghost `<img src="#">`
      // elements otherwise leak into published PDFs.
      const rawJson = editor.getJSON() as Record<string, unknown>
      const sanitized = stripEmptyImageNodes(rawJson)
      debouncedSave(sanitized)
    },
    [debouncedSave, section.id],
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
            // Cache the imperative handle through a typed local; the
            // `component.ref` type is `unknown` and the previous `as`-cast
            // skipped the null check, silently dropping the first key
            // event when the menu component had not yet mounted its
            // forwardRef.
            const handle = component?.ref as SlashCommandMenuRef | null | undefined
            return handle?.onKeyDown?.(props) ?? false
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
    // Add React NodeView to Image extension + declare a transient
    // `pendingUploadId` attribute that the drop/paste handlers use to tell
    // ImageBlockView which File to auto-upload. The attribute is not
    // rendered into HTML (parseHTML/renderHTML return undefined) so it
    // never persists to the saved Tiptap JSON — it only lives on the node
    // instance while the upload is in flight.
    if (ext.name === 'image') {
      return ext.extend({
        addAttributes() {
          const parentFn = (this as unknown as { parent?: () => Record<string, unknown> }).parent
          const parentAttrs = parentFn?.() ?? {}
          return {
            ...parentAttrs,
            pendingUploadId: {
              default: null,
              // Don't round-trip through HTML. This attribute is only used
              // to hand a freshly-dropped File from the drop/paste handler
              // to the React NodeView; it should never be serialized.
              rendered: false,
              keepOnSplit: false,
            },
          }
        },
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
              // A1: stash the File in a shared registry and tag the inserted
              // node with the id so ImageBlockView can pick it up on mount
              // and auto-start the upload. Previously the File was silently
              // dropped on the floor and the user saw an empty placeholder.
              const uploadId = newPendingUploadId()
              registerPendingImageUpload(uploadId, file)
              currentEditor.chain().focus().insertContentAt(pos, {
                type: 'image',
                attrs: { src: '', pendingUploadId: uploadId },
              }).run()
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
              // A1: same registry hand-off as onDrop above.
              const uploadId = newPendingUploadId()
              registerPendingImageUpload(uploadId, file)
              currentEditor.chain().focus().insertContent({
                type: 'image',
                attrs: { src: '', pendingUploadId: uploadId },
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

  // Cleanup timeouts + clear pending flag when the editor unmounts so a
  // left-behind marker doesn't block future "Create Version" clicks.
  //
  // A2: ALSO cancel any pending debounced save. Without this, switching
  // sections mid-debounce would fire the save for the *old* section's
  // content after the new section had already mounted, silently writing
  // cross-wire edits through `document.updateSectionContent`.
  useEffect(() => {
    const sectionId = section.id
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      debouncedSave.cancel()
      markSectionFlushed(sectionId)
    }
  }, [section.id, debouncedSave])

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
