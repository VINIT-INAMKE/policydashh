/**
 * Phase 28 Plan 28-03 — DownloadButton client island for the public detail page (RESEARCH-10).
 *
 * Client component (the only interactive element on the detail surface).
 *
 * Behavior (28-RESEARCH.md Pattern 5):
 *   - On click: setLoading(true) → window.location.href = /api/research/{id}/download.
 *     The route handler responds with HTTP 302 to a 24h presigned R2 GET URL;
 *     the browser follows the redirect natively, triggering file download.
 *     This is the file-backed CTA path — URL-only items render an external
 *     anchor in the parent page (page.tsx ternary).
 *   - On synchronous throw (extremely rare for href assignment): toast.error
 *     "Download unavailable. Please try again or contact the policy team."
 *     The spinner resets so the user can retry.
 *   - The browser typically commits the navigation before any error surfaces,
 *     so the loading spinner is mostly cosmetic UX feedback. A page-level
 *     error response (4xx/5xx JSON) shows in a new tab.
 *
 * Accessibility (UI-SPEC SC-7):
 *   - aria-label="Download {title} ({type})" so screen-reader users hear the
 *     full context, not just "Download" stripped of meaning.
 *   - min-h-11 (44px) touch target per UI-SPEC spacing scale.
 */
'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export interface DownloadButtonProps {
  itemId: string
  title: string
  itemType: string
}

export function DownloadButton({ itemId, title, itemType }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false)

  function handleDownload() {
    setLoading(true)
    try {
      // 28-RESEARCH.md Pattern 5: native browser redirect handles file download.
      // The server responds with HTTP 302 to a presigned R2 GET URL; the browser
      // follows the redirect. No fetch/CORS concern. If the route returns 4xx/5xx,
      // the browser shows the JSON error page — the catch + toast below is
      // defensive UX for the rare synchronous-throw case.
      window.location.href = `/api/research/${itemId}/download`
    } catch {
      toast.error('Download unavailable. Please try again or contact the policy team.')
      setLoading(false)
    }
  }

  return (
    <Button
      variant="default"
      size="default"
      onClick={handleDownload}
      disabled={loading}
      aria-label={`Download ${title} (${itemType})`}
      className="min-w-[120px] min-h-11"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="size-4" aria-hidden="true" />
      )}
      <span className="ml-1">Download</span>
    </Button>
  )
}
