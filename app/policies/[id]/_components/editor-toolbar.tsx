'use client'

import { useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  newPendingUploadId,
  registerPendingImageUpload,
} from './pending-image-uploads'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
  List,
  ListOrdered,
  Table2,
  ImageIcon,
  ChevronDown,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code2,
} from 'lucide-react'
import type { Editor } from '@tiptap/core'

interface EditorToolbarProps {
  editor: Editor | null
  onLinkClick?: () => void
}

interface ToolbarButtonProps {
  icon: React.ElementType
  label: string
  shortcut?: string
  isActive?: boolean
  isDisabled?: boolean
  onClick: () => void
}

function ToolbarButton({
  icon: Icon,
  label,
  shortcut,
  isActive,
  isDisabled,
  onClick,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={(props) => (
          <Button
            {...props}
            variant="ghost"
            size="icon"
            // Active state uses a subtle muted fill over the white toolbar
            // background. The shadcn `secondary` variant points to
            // `--cl-secondary` (#565f70) post-theme-refactor, which renders
            // as a dark slate slug — too heavy for an active-toggle hint.
            className={cn(
              'size-8',
              isActive && 'bg-muted text-foreground hover:bg-muted',
            )}
            disabled={isDisabled}
            onClick={onClick}
            aria-label={label}
            aria-pressed={isActive}
          >
            <Icon className="size-4" />
          </Button>
        )}
      />
      <TooltipContent>
        {label}
        {shortcut && (
          <span className="ml-1 text-muted-foreground">({shortcut})</span>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

// Block type names for the dropdown
interface BlockTypeItem {
  name: string
  check: string
  attrs?: Record<string, unknown>
  icon: React.ElementType
}

const blockTypes: BlockTypeItem[] = [
  { name: 'Text', check: 'paragraph', icon: Type },
  { name: 'Heading 1', check: 'heading', attrs: { level: 1 }, icon: Heading1 },
  { name: 'Heading 2', check: 'heading', attrs: { level: 2 }, icon: Heading2 },
  { name: 'Heading 3', check: 'heading', attrs: { level: 3 }, icon: Heading3 },
  { name: 'Quote', check: 'blockquote', icon: Quote },
  { name: 'Code Block', check: 'codeBlock', icon: Code2 },
]

function getCurrentBlockType(editor: Editor): string {
  for (const bt of blockTypes) {
    if (bt.attrs) {
      if (editor.isActive(bt.check, bt.attrs)) return bt.name
    } else {
      if (editor.isActive(bt.check)) return bt.name
    }
  }
  return 'Text'
}

export function EditorToolbar({ editor, onLinkClick }: EditorToolbarProps) {
  const isDisabled = !editor || !editor.isEditable
  // A16: hidden file picker so "Insert image" no longer drops a permanent
  // `src: ""` node into the editor (which would autosave as a broken
  // image and leak into published PDFs). Clicking the toolbar button now
  // opens a real file picker, then the same pending-upload registry we
  // use for drop/paste hands the File off to ImageBlockView.
  const imageInputRef = useRef<HTMLInputElement>(null)

  const setBlockType = useCallback(
    (type: BlockTypeItem) => {
      if (!editor) return
      if (type.check === 'paragraph') {
        editor.chain().focus().setParagraph().run()
      } else if (type.check === 'heading' && type.attrs) {
        editor
          .chain()
          .focus()
          .setNode('heading', { level: type.attrs.level as number })
          .run()
      } else if (type.check === 'blockquote') {
        editor.chain().focus().toggleBlockquote().run()
      } else if (type.check === 'codeBlock') {
        editor.chain().focus().toggleCodeBlock().run()
      }
    },
    [editor],
  )

  const currentBlockName = editor ? getCurrentBlockType(editor) : 'Text'

  return (
    <TooltipProvider>
      {/* Toolbar surface: white card over the editor body (which sits on
          --cl-surface, an off-white). Without an explicit `bg-card` the
          previous `bg-muted/50` collapsed against the body since the new
          --muted (#ebeef0) is only one hex digit off the body (#f7fafc)
          — the toolbar appeared to vanish post-theme-refactor. */}
      <div className="sticky top-0 z-20 flex h-10 items-center gap-0.5 border-b border-border bg-card px-2 shadow-sm backdrop-blur">
        {/* Block type dropdown */}
        <div className="relative">
          <Tooltip>
            <TooltipTrigger
              render={(props) => (
                <Button
                  {...props}
                  variant="outline"
                  size="sm"
                  className="w-[120px] justify-between text-xs"
                  disabled={isDisabled}
                  onClick={() => {
                    // Cycle through block types
                    if (!editor) return
                    const idx = blockTypes.findIndex((bt) => bt.name === currentBlockName)
                    const next = blockTypes[(idx + 1) % blockTypes.length]
                    setBlockType(next)
                  }}
                >
                  {currentBlockName}
                  <ChevronDown className="size-3" />
                </Button>
              )}
            />
            <TooltipContent>Block type</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Text format group */}
        <ToolbarButton
          icon={Bold}
          label="Bold"
          shortcut="Ctrl+B"
          isActive={editor?.isActive('bold')}
          isDisabled={isDisabled}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon={Italic}
          label="Italic"
          shortcut="Ctrl+I"
          isActive={editor?.isActive('italic')}
          isDisabled={isDisabled}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          icon={Underline}
          label="Underline"
          shortcut="Ctrl+U"
          isActive={editor?.isActive('underline')}
          isDisabled={isDisabled}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          icon={Strikethrough}
          label="Strikethrough"
          shortcut="Ctrl+Shift+S"
          isActive={editor?.isActive('strike')}
          isDisabled={isDisabled}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        />
        <ToolbarButton
          icon={Code}
          label="Inline Code"
          shortcut="Ctrl+E"
          isActive={editor?.isActive('code')}
          isDisabled={isDisabled}
          onClick={() => editor?.chain().focus().toggleCode().run()}
        />

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Links group */}
        <ToolbarButton
          icon={Link}
          label="Insert link"
          shortcut="Ctrl+K"
          isActive={editor?.isActive('link')}
          isDisabled={isDisabled}
          onClick={() => onLinkClick?.()}
        />

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Lists group */}
        <ToolbarButton
          icon={List}
          label="Bullet list"
          isActive={editor?.isActive('bulletList')}
          isDisabled={isDisabled}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon={ListOrdered}
          label="Ordered list"
          isActive={editor?.isActive('orderedList')}
          isDisabled={isDisabled}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Insert group */}
        <ToolbarButton
          icon={Table2}
          label="Insert table"
          isDisabled={isDisabled}
          onClick={() =>
            editor
              ?.chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        />
        <ToolbarButton
          icon={ImageIcon}
          label="Insert image"
          isDisabled={isDisabled}
          onClick={() => {
            imageInputRef.current?.click()
          }}
        />
        {/* Hidden picker for the toolbar "Insert image" button. */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            // Reset so picking the same file twice in a row still fires
            // onChange the second time.
            e.target.value = ''
            if (!file || !editor) return
            if (!file.type.startsWith('image/')) return
            const uploadId = newPendingUploadId()
            registerPendingImageUpload(uploadId, file)
            // A16-fix: chaining `setImage({src: ''}).updateAttributes(...)`
            // doesn't work — `setImage` moves the cursor PAST the inserted
            // image, so the trailing `updateAttributes('image', ...)` runs
            // against an empty selection and never tags the node with the
            // pending upload id. ImageBlockView then sees no
            // pendingUploadId, the auto-upload never fires, and the user
            // sees a permanent "Drop image here" placeholder.
            //
            // Use `insertContent` with attrs in a single command — the same
            // pattern the drop/paste handlers in block-editor.tsx use.
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'image',
                attrs: { src: '', pendingUploadId: uploadId },
              })
              .run()
          }}
        />
      </div>
    </TooltipProvider>
  )
}
