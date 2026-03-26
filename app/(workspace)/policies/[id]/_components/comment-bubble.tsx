'use client'

import { useEffect, useState, useCallback } from 'react'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import type { Editor } from '@tiptap/core'

export interface PendingComment {
  from: number
  to: number
  text: string
}

interface CommentBubbleProps {
  editor: Editor
  onCreateComment: (pending: PendingComment) => void
}

export function CommentBubble({ editor, onCreateComment }: CommentBubbleProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const updateBubble = useCallback(() => {
    const { from, to, empty } = editor.state.selection
    if (empty || from === to) {
      setVisible(false)
      return
    }

    // Get the selected text
    const text = editor.state.doc.textBetween(from, to, ' ')
    if (!text.trim()) {
      setVisible(false)
      return
    }

    // Get the bounding rect of the selection
    const domSelection = window.getSelection()
    if (!domSelection || domSelection.rangeCount === 0) {
      setVisible(false)
      return
    }

    const range = domSelection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      setVisible(false)
      return
    }

    // Find the editor DOM element to calculate relative position
    const editorElement = editor.view.dom.closest('.relative')
    if (!editorElement) {
      setVisible(false)
      return
    }

    const editorRect = editorElement.getBoundingClientRect()

    setPosition({
      top: rect.top - editorRect.top - 40, // 4px above selection + bubble height
      left: rect.left - editorRect.left + rect.width / 2,
    })
    setVisible(true)
  }, [editor])

  useEffect(() => {
    editor.on('selectionUpdate', updateBubble)
    // Also listen to blur to hide
    const handleBlur = () => {
      // Delay to allow click on bubble
      setTimeout(() => {
        const active = document.activeElement
        const bubbleEl = document.querySelector('[data-comment-bubble]')
        if (bubbleEl && bubbleEl.contains(active)) return
        setVisible(false)
      }, 200)
    }
    editor.on('blur', handleBlur)

    return () => {
      editor.off('selectionUpdate', updateBubble)
      editor.off('blur', handleBlur)
    }
  }, [editor, updateBubble])

  // Keyboard shortcut: Ctrl+Alt+M / Cmd+Option+M
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const modifier = isMac ? e.metaKey : e.ctrlKey

      if (modifier && e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        const { from, to, empty } = editor.state.selection
        if (empty || from === to) return
        const text = editor.state.doc.textBetween(from, to, ' ')
        if (!text.trim()) return
        onCreateComment({ from, to, text })
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editor, onCreateComment])

  const handleClick = useCallback(() => {
    const { from, to, empty } = editor.state.selection
    if (empty || from === to) return
    const text = editor.state.doc.textBetween(from, to, ' ')
    if (!text.trim()) return
    onCreateComment({ from, to, text })
  }, [editor, onCreateComment])

  if (!visible) return null

  return (
    <div
      data-comment-bubble=""
      className="absolute z-60 -translate-x-1/2"
      style={{ top: position.top, left: position.left }}
    >
      <div className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 shadow-md">
        <TooltipProvider delay={300}>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClick}
                  aria-label="Add comment to selected text"
                  aria-keyshortcuts="Ctrl+Alt+M"
                />
              }
            >
              <MessageSquare className="size-3.5" />
              Comment
            </TooltipTrigger>
            <TooltipContent>
              Comment (Ctrl+Alt+M)
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
