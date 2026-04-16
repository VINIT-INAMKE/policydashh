'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Editor } from '@tiptap/core'

function isValidUrl(url: string): boolean {
  return /^(https?:\/\/|mailto:|\/)/i.test(url.trim())
}

interface FloatingLinkEditorProps {
  editor: Editor
  isOpen: boolean
  onClose: () => void
}

export function FloatingLinkEditor({
  editor,
  isOpen,
  onClose,
}: FloatingLinkEditorProps) {
  const [url, setUrl] = useState('')
  const [openInNewTab, setOpenInNewTab] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-populate from existing link
  const existingHref = editor.getAttributes('link').href as string | undefined

  useEffect(() => {
    if (isOpen) {
      setUrl(existingHref || '')
      setOpenInNewTab(editor.getAttributes('link').target === '_blank')
      setError(null)
    }
  }, [isOpen, existingHref, editor])

  const handleApply = useCallback(() => {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setError('Enter a valid URL (e.g., https://example.com)')
      return
    }
    if (!isValidUrl(trimmedUrl)) {
      setError('Enter a valid URL (e.g., https://example.com)')
      return
    }

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({
        href: trimmedUrl,
        target: openInNewTab ? '_blank' : null,
      })
      .run()

    onClose()
  }, [editor, url, openInNewTab, onClose])

  const handleRemove = useCallback(() => {
    editor.chain().focus().unsetLink().run()
    onClose()
  }, [editor, onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleApply()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [handleApply, onClose],
  )

  if (!isOpen) return null

  return (
    <div className="z-50 w-[280px] rounded-md border bg-popover p-2 shadow-md">
      <div className="flex flex-col gap-2">
        <Input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Paste or type URL..."
          aria-label="URL"
          autoFocus
          className="h-8 text-sm"
        />

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={openInNewTab}
            onChange={(e) => setOpenInNewTab(e.target.checked)}
            className="size-3.5 rounded border-border"
          />
          Open in new tab
        </label>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            disabled={!url.trim()}
            onClick={handleApply}
            aria-label="Apply link"
          >
            Apply link
          </Button>
          {existingHref && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={handleRemove}
              aria-label="Remove link"
            >
              Remove link
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
