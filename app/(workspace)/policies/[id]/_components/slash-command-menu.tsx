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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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
import type { SlashCommandItem } from '@/src/lib/tiptap-extensions/slash-command-extension'
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'

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

export interface SlashCommandMenuRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

interface SlashCommandMenuProps {
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
  clientRect?: (() => DOMRect | null) | null
}

export const SlashCommandMenu = forwardRef<SlashCommandMenuRef, SlashCommandMenuProps>(
  function SlashCommandMenu({ items, command, clientRect }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const containerRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    // Position the menu based on clientRect
    useLayoutEffect(() => {
      if (!clientRect) return
      const rect = clientRect()
      if (!rect) return
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      })
    }, [clientRect])

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

    if (!position) return null

    // Group items by category
    const groups: Record<string, SlashCommandItem[]> = {}
    for (const item of items) {
      const cat = categorize(item.title)
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(item)
    }

    const categoryOrder = ['Text blocks', 'Advanced', 'Media']

    return createPortal(
      <div
        ref={containerRef}
        className="fixed z-50 min-w-[240px] max-w-[320px] overflow-hidden rounded-md border bg-popover shadow-md"
        style={{ top: position.top, left: position.left }}
      >
        <Command className="max-h-[320px]">
          <CommandList>
            <CommandEmpty>No matching blocks</CommandEmpty>
            {categoryOrder.map((cat) => {
              const groupItems = groups[cat]
              if (!groupItems || groupItems.length === 0) return null
              return (
                <CommandGroup key={cat} heading={cat}>
                  {groupItems.map((item) => {
                    const Icon = iconMap[item.title] || Type
                    const globalIndex = items.indexOf(item)
                    return (
                      <CommandItem
                        key={item.title}
                        onSelect={() => selectItem(globalIndex)}
                        data-selected={globalIndex === selectedIndex || undefined}
                        className="flex items-center gap-2"
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <div className="flex flex-col">
                          <span className="text-sm">{item.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </div>,
      document.body,
    )
  },
)
