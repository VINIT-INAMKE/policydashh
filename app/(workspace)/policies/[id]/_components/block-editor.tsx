'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent, ReactNodeViewRenderer, ReactRenderer } from '@tiptap/react'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { useDebouncedCallback } from 'use-debounce'
import { useSession, useUser } from '@clerk/nextjs'
import { GripVertical, Loader2, CheckCircle2, AlertCircle, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { trpc } from '@/src/trpc/client'
import { buildExtensions } from '@/src/lib/tiptap-extensions/build-extensions'
import { getSlashCommandItems } from '@/src/lib/tiptap-extensions/slash-command-extension'
import { Callout } from '@/src/lib/tiptap-extensions/callout-node'
import { FileAttachment } from '@/src/lib/tiptap-extensions/file-attachment-node'
import { LinkPreview } from '@/src/lib/tiptap-extensions/link-preview-node'
import { uploadFiles } from '@/src/lib/uploadthing'
import { getPresenceColor } from '@/src/lib/collaboration/presence-colors'
import { CalloutBlockView } from './callout-block-view'
import { ImageBlockView } from './image-block-view'
import { FileAttachmentView } from './file-attachment-view'
import { LinkPreviewView } from './link-preview-view'
import { CodeBlockView } from './code-block-view'
import { EditorToolbar } from './editor-toolbar'
import { FloatingLinkEditor } from './floating-link-editor'
import { SlashCommandMenu, type SlashCommandMenuRef } from './slash-command-menu'
import { PresenceBar } from './presence-bar'
import { ConnectionStatus } from './connection-status'
import { CommentBubble, type PendingComment } from './comment-bubble'
import { CommentPanel } from './comment-panel'
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

type CollabConnectionStatus = 'connected' | 'connecting' | 'disconnected'

// Check if collaboration mode should be active
const HOCUSPOCUS_URL = process.env.NEXT_PUBLIC_HOCUSPOCUS_URL

export default function BlockEditor({ section, onSaveStateChange }: BlockEditorProps) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const isDirtyRef = useRef(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [linkEditorOpen, setLinkEditorOpen] = useState(false)

  // Comment state
  const [commentPanelOpen, setCommentPanelOpen] = useState(false)
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null)
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)

  // Collaboration state
  const providerRef = useRef<HocuspocusProvider | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<CollabConnectionStatus>('connecting')
  const [providerReady, setProviderReady] = useState(!HOCUSPOCUS_URL) // Ready immediately if no collab

  // Clerk session and user for collaboration
  const { session } = useSession()
  const { user } = useUser()

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

  // CRITICAL: Conditional auto-save -- disabled when collaboration is active and connected.
  // When collaboration is active but disconnected, auto-save re-enables as offline fallback.
  const connectionStatusRef = useRef<CollabConnectionStatus>(connectionStatus)
  connectionStatusRef.current = connectionStatus

  const handleUpdate = useCallback(
    ({ editor }: { editor: Editor }) => {
      isDirtyRef.current = true
      // Only auto-save when NOT in active collaboration, or when collab is disconnected (offline fallback)
      if (!providerRef.current || connectionStatusRef.current === 'disconnected') {
        debouncedSave(editor.getJSON() as Record<string, unknown>)
      }
    },
    [debouncedSave],
  )

  const handleBlur = useCallback(
    ({ editor }: { editor: Editor }) => {
      if (isDirtyRef.current) {
        // Only flush when NOT in active collaboration, or when disconnected
        if (!providerRef.current || connectionStatusRef.current === 'disconnected') {
          debouncedSave.flush()
        }
      }
    },
    [debouncedSave],
  )

  // Initialize HocuspocusProvider when collaboration URL is configured
  useEffect(() => {
    if (!HOCUSPOCUS_URL) {
      providerRef.current = null
      setProviderReady(true)
      return
    }

    let destroyed = false

    const initProvider = async () => {
      // Get Clerk JWT token for authentication
      const token = await session?.getToken().catch(() => null)

      if (destroyed) return

      const provider = new HocuspocusProvider({
        url: HOCUSPOCUS_URL,
        name: `section-${section.id}`,
        token: token ?? '',
        onConnect: () => {
          if (!destroyed) setConnectionStatus('connected')
        },
        onDisconnect: () => {
          if (!destroyed) setConnectionStatus('disconnected')
        },
        onClose: () => {
          if (!destroyed) setConnectionStatus('disconnected')
        },
      })

      if (destroyed) {
        provider.destroy()
        return
      }

      // Set awareness user data for presence
      if (user) {
        const color = getPresenceColor(user.id)
        provider.awareness?.setLocalStateField('user', {
          name: user.fullName ?? 'Anonymous',
          color: color.bg,
          userId: user.id,
        })
      }

      providerRef.current = provider
      setProviderReady(true)
    }

    initProvider()

    // CRITICAL: Destroy provider on cleanup to prevent memory leak (Research Pitfall 6)
    return () => {
      destroyed = true
      if (providerRef.current) {
        providerRef.current.destroy()
        providerRef.current = null
      }
      setProviderReady(false)
    }
  }, [section.id, session, user])

  // Build extensions with slash command suggestion render wired
  // When collaboration is active, pass collaboration option to buildExtensions
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
    // Pass collaboration config when provider is available
    collaboration: providerRef.current
      ? {
          doc: providerRef.current.document,
          provider: providerRef.current,
          user: {
            name: user?.fullName ?? 'Anonymous',
            color: getPresenceColor(user?.id ?? '').bg,
          },
        }
      : undefined,
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
      // CRITICAL: When collaboration is active, do NOT pass content (Yjs is source of truth)
      content: providerRef.current
        ? undefined
        : (section.content ?? {
            type: 'doc',
            content: [{ type: 'paragraph' }],
          }),
      editorProps: {
        attributes: {
          class: 'prose prose-sm max-w-none focus:outline-none',
        },
      },
      onUpdate: handleUpdate,
      onBlur: handleBlur,
    },
    [section.id, providerReady],
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

  // Comment handlers
  const handleCreateComment = useCallback(
    (pending: PendingComment) => {
      setPendingComment(pending)
      setCommentPanelOpen(true)
    },
    [],
  )

  const handleCloseCommentPanel = useCallback(() => {
    setCommentPanelOpen(false)
    setPendingComment(null)
    setActiveCommentId(null)
  }, [])

  const handleClearPending = useCallback(() => {
    setPendingComment(null)
  }, [])

  // Comment anchor click handler: clicking on inline-comment-mark opens the panel
  useEffect(() => {
    if (!editor) return

    const handleCommentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const commentMark = target.closest('.inline-comment-mark')
      if (commentMark) {
        const commentId = commentMark.getAttribute('data-comment-id')
        if (commentId) {
          setActiveCommentId(commentId)
          setCommentPanelOpen(true)
        }
      }
    }

    editor.view.dom.addEventListener('click', handleCommentClick)
    return () => {
      editor.view.dom.removeEventListener('click', handleCommentClick)
    }
  }, [editor])

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
        {/* Header bar: presence + connection status + comment toggle + save indicator */}
        <div className="flex items-center justify-between px-6 py-1">
          {/* Left side: presence avatars (only in collab mode) */}
          <div className="flex items-center gap-2">
            {providerRef.current && (
              <PresenceBar
                provider={providerRef.current}
                currentUserId={user?.id ?? ''}
              />
            )}
          </div>

          {/* Right side: connection status + comment toggle + save state */}
          <div className="flex items-center gap-2">
            {providerRef.current && (
              <ConnectionStatus status={connectionStatus} />
            )}

            {/* Comment panel toggle */}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                if (commentPanelOpen) {
                  handleCloseCommentPanel()
                } else {
                  setCommentPanelOpen(true)
                }
              }}
              aria-label="Toggle comments panel"
            >
              <MessageSquare className="size-4" />
            </Button>

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
          className="mx-auto max-w-[768px] px-6 py-8 [&_.ProseMirror]:min-h-[200px] [&_.ProseMirror]:focus:outline-none [&_.inline-comment-mark]:bg-primary/15 [&_.inline-comment-mark.active]:bg-primary/25"
        />

        {/* CommentBubble: floating trigger above text selection */}
        <CommentBubble editor={editor} onCreateComment={handleCreateComment} />

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

      {/* CommentPanel: 320px right side panel */}
      <CommentPanel
        editor={editor}
        sectionId={section.id}
        isOpen={commentPanelOpen}
        onClose={handleCloseCommentPanel}
        activeCommentId={activeCommentId}
        pendingComment={pendingComment}
        onCommentCreated={() => setPendingComment(null)}
        onClearPending={handleClearPending}
      />
    </div>
  )
}
