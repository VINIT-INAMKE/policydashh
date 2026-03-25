'use client'

import { useState, useEffect, useCallback } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { Globe, ExternalLink } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

type PreviewState = 'input' | 'loading' | 'loaded' | 'error'

interface OGData {
  title: string | null
  description: string | null
  image: string | null
}

/**
 * Attempts to fetch OG metadata for a URL.
 * Uses a server-side proxy to avoid CORS issues.
 * Falls back gracefully if the fetch fails.
 */
async function fetchOGData(url: string): Promise<OGData | null> {
  try {
    // Attempt to use a proxy endpoint. If it doesn't exist yet,
    // we fall back to showing the URL as a plain link.
    const res = await fetch(
      `/api/og-preview?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (res.ok) {
      return (await res.json()) as OGData
    }
    return null
  } catch {
    return null
  }
}

export function LinkPreviewView({ node, updateAttributes }: NodeViewProps) {
  const url = node.attrs.url as string | null
  const title = node.attrs.title as string | null
  const description = node.attrs.description as string | null
  const image = node.attrs.image as string | null

  const [previewState, setPreviewState] = useState<PreviewState>(() => {
    if (!url) return 'input'
    if (title) return 'loaded'
    return 'loading'
  })
  const [inputValue, setInputValue] = useState(url || '')

  // Fetch OG data when URL is set but title is missing
  useEffect(() => {
    if (!url || title) return

    let cancelled = false
    setPreviewState('loading')

    fetchOGData(url).then((data) => {
      if (cancelled) return
      if (data && (data.title || data.description)) {
        updateAttributes({
          title: data.title,
          description: data.description,
          image: data.image,
        })
        setPreviewState('loaded')
      } else {
        setPreviewState('error')
      }
    })

    return () => {
      cancelled = true
    }
    // Only run when url changes (title is the flag for "already fetched")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  const handleSubmitUrl = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed) return
    const normalized =
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`
    updateAttributes({ url: normalized })
    setPreviewState('loading')
  }, [inputValue, updateAttributes])

  // Input state: user needs to enter a URL
  if (previewState === 'input') {
    return (
      <NodeViewWrapper data-type="link-preview">
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted p-3">
          <Globe className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="url"
            className="min-w-0 flex-1 border-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Paste a URL..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSubmitUrl()
              }
            }}
            // Prevent Tiptap from intercepting keyboard events in this input
            onKeyUp={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={handleSubmitUrl}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Embed
          </button>
        </div>
      </NodeViewWrapper>
    )
  }

  // Loading state: skeleton
  if (previewState === 'loading') {
    return (
      <NodeViewWrapper data-type="link-preview">
        <div className="overflow-hidden rounded-md border border-border bg-muted">
          <Skeleton className="h-[120px] w-full" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  // Error state: show URL as clickable link
  if (previewState === 'error') {
    return (
      <NodeViewWrapper data-type="link-preview">
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted p-4">
          <Globe className="size-6 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              Unable to load preview
            </p>
            <a
              href={url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-foreground underline"
            >
              {url}
            </a>
          </div>
        </div>
      </NodeViewWrapper>
    )
  }

  // Loaded state: show OG preview
  return (
    <NodeViewWrapper data-type="link-preview">
      <a
        href={url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-md border border-border bg-muted transition-colors hover:bg-muted/80"
      >
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="h-[120px] w-full object-cover"
          />
        )}
        <div className="p-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Globe className="size-3" />
            <span className="truncate">{url}</span>
            <ExternalLink className="ml-auto size-3 shrink-0" />
          </div>
          {title && (
            <h4 className="mt-1 line-clamp-2 text-sm font-semibold">
              {title}
            </h4>
          )}
          {description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </a>
    </NodeViewWrapper>
  )
}
