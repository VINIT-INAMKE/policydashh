'use client'

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
} from 'react'
import { createPortal } from 'react-dom'
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Code2,
  AlertCircle,
  ChevronRight,
  Table2,
  ImageIcon,
  Paperclip,
  Link2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SlashCommandItem } from '@/src/lib/tiptap-extensions/slash-command-extension'
import type { SuggestionKeyDownProps } from '@tiptap/suggestion'

// Map slash command titles to icons
const iconMap: Record<string, React.ElementType> = {
  Text: Type,
  'Heading 1': Heading1,
  'Heading 2': Heading2,
  'Heading 3': Heading3,
  'Bullet List': List,
  'Ordered List': ListOrdered,
  Quote: Quote,
  Divider: Minus,
  'Code Block': Code2,
  Callout: AlertCircle,
  Toggle: ChevronRight,
  Table: Table2,
  Image: ImageIcon,
  File: Paperclip,
  'Link Preview': Link2,
}

// Categorize items
function categorize(title: string): string {
  const advanced = ['Table']
  const media = ['Image', 'File', 'Link Preview']
  if (advanced.includes(title)) return 'Advanced'
  if (media.includes(title)) return 'Media'
  return 'Text blocks'
}

const CATEGORY_ORDER = ['Text blocks', 'Advanced', 'Media'] as const

export interface SlashCommandMenuRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

interface SlashCommandMenuProps {
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
  clientRect?: (() => DOMRect | null) | null
}

/**
 * Slash-command menu rendered into a portal next to the cursor.
 *
 * History note: this used to wrap shadcn `<Command>`/`<CommandList>` from
 * cmdk, but cmdk maintains its OWN internal selection cursor and we also
 * tracked `selectedIndex` here. The two competed: cmdk's hover cursor
 * could land on item A while our state pointed at B, so pressing Enter
 * fired the wrong block. Replaced with a plain `role="listbox"` so this
 * component is the single source of truth for selection.
 */
export const SlashCommandMenu = forwardRef<SlashCommandMenuRef, SlashCommandMenuProps>(
  function SlashCommandMenu({ items, command, clientRect }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)
    const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

    // Reset selection when items change (e.g. user types a query that
    // filters the list — we want the first match highlighted, not stale).
    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    // Position the menu beneath the cursor based on clientRect. Using
    // useLayoutEffect avoids the "jump from origin → real position" flash.
    useLayoutEffect(() => {
      if (!clientRect) return
      const rect = clientRect()
      if (!rect) return
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      })
    }, [clientRect])

    // Keep the highlighted item in view as the user arrows up/down past
    // the visible window edge. `block: 'nearest'` avoids jumpy scrolling.
    useEffect(() => {
      const node = itemRefs.current[selectedIndex]
      if (node) {
        node.scrollIntoView({ block: 'nearest' })
      }
    }, [selectedIndex])

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index]
        if (item) {
          command(item)
        }
      },
      [items, command],
    )

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        if (items.length === 0) return false
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % items.length)
          return true
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          selectItem(selectedIndex)
          return true
        }
        return false
      },
    }))

    // Group items by category preserving the original order within each
    // group so keyboard nav (driven by `items` index) lines up with what
    // the user sees.
    const groups: Record<string, Array<{ item: SlashCommandItem; globalIndex: number }>> = {}
    items.forEach((item, idx) => {
      const cat = categorize(item.title)
      if (!groups[cat]) groups[cat] = []
      groups[cat].push({ item, globalIndex: idx })
    })

    // Render an off-screen first paint so `useLayoutEffect` can measure
    // the popover and snap it to the cursor before the user sees it. The
    // previous `if (!position) return null` swallowed the first arrow-key
    // press (the imperative handle existed but the DOM hadn't mounted).
    const isPositioned = position !== null
    const portalStyle: React.CSSProperties = isPositioned
      ? { top: position.top, left: position.left }
      : { top: -9999, left: -9999, visibility: 'hidden' }

    if (items.length === 0) {
      return createPortal(
        <div
          ref={containerRef}
          role="listbox"
          aria-label="Slash command menu"
          className="fixed z-50 min-w-[240px] max-w-[320px] overflow-hidden rounded-md border border-border bg-popover p-2 text-sm text-muted-foreground shadow-md"
          style={portalStyle}
        >
          No matching blocks
        </div>,
        document.body,
      )
    }

    // Reset the ref array on every render so removed items don't leak
    // stale DOM nodes.
    itemRefs.current = []

    return createPortal(
      <div
        ref={containerRef}
        role="listbox"
        aria-label="Slash command menu"
        aria-activedescendant={`slash-cmd-item-${selectedIndex}`}
        className="fixed z-50 max-h-[320px] min-w-[240px] max-w-[320px] overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md"
        style={portalStyle}
      >
        {CATEGORY_ORDER.map((cat) => {
          const group = groups[cat]
          if (!group || group.length === 0) return null
          return (
            <div key={cat} className="py-1">
              <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {cat}
              </div>
              {group.map(({ item, globalIndex }) => {
                const Icon = iconMap[item.title] || Type
                const isSelected = globalIndex === selectedIndex
                return (
                  <button
                    key={item.title}
                    id={`slash-cmd-item-${globalIndex}`}
                    ref={(el) => {
                      itemRefs.current[globalIndex] = el
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectItem(globalIndex)}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                      isSelected
                        ? 'bg-muted text-foreground'
                        : 'text-foreground hover:bg-muted/60',
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate">{item.title}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>,
      document.body,
    )
  },
)
