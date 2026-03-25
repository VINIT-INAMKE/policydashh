'use client'

import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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
            variant={isActive ? 'secondary' : 'ghost'}
            size="icon"
            className="size-8"
            disabled={isDisabled}
            onClick={onClick}
            aria-label={label}
            aria-pressed={isActive}
          />
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
      <div className="sticky top-0 z-10 flex h-9 items-center gap-0.5 border-b bg-muted/50 px-2 backdrop-blur">
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
            // Image upload placeholder -- full functionality in Plan 03
            editor?.chain().focus().setImage({ src: '' }).run()
          }}
        />
      </div>
    </TooltipProvider>
  )
}
