'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { StatusBadge, type FeedbackStatus } from '@/app/policies/[id]/feedback/_components/status-badge'
import { CRStatusBadge, type CRStatus } from '@/app/policies/[id]/change-requests/_components/cr-status-badge'

// ---------------------------------------------------------------------------
// Types - mirror tRPC router outputs
// ---------------------------------------------------------------------------

export interface SearchFeedbackResult {
  id: string
  readableId: string
  title: string
  body: string | null
  status: string
  sectionTitle: string | null
  feedbackType: string
  createdAt: string
}

export interface SearchSectionResult {
  id: string
  title: string
  orderIndex: number
  documentId: string
}

export interface SearchCRResult {
  id: string
  readableId: string
  title: string
  description: string | null
  status: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// Excerpt extraction helper
// ---------------------------------------------------------------------------

/**
 * Extract a window of `maxLen` characters centred on the first occurrence of
 * `query` (case-insensitive). Adds ellipsis at truncation boundaries.
 */
export function getExcerpt(
  text: string,
  query: string,
  maxLen = 200,
): string {
  if (text.length <= maxLen) return text

  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text.slice(0, maxLen) + '\u2026'

  const half = Math.floor(maxLen / 2)
  let start = idx - half
  let end = idx + half

  if (start < 0) {
    end += -start
    start = 0
  }
  if (end > text.length) {
    start -= end - text.length
    end = text.length
    if (start < 0) start = 0
  }

  const prefix = start > 0 ? '\u2026' : ''
  const suffix = end < text.length ? '\u2026' : ''
  return prefix + text.slice(start, end) + suffix
}

// ---------------------------------------------------------------------------
// Highlighted text component
// ---------------------------------------------------------------------------

export function HighlightedText({
  text,
  query,
}: {
  text: string
  query: string
}) {
  if (!query || query.length < 2) {
    return <span>{text}</span>
  }

  const excerpt = getExcerpt(text, query, 200)
  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
    'gi',
  )
  const parts = excerpt.split(regex)

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-primary/10 rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Feedback result card
// ---------------------------------------------------------------------------

export function FeedbackResultCard({
  result,
  query,
  documentId,
}: {
  result: SearchFeedbackResult
  query: string
  documentId: string
}) {
  return (
    <Link href={`/policies/${documentId}/feedback?detail=${result.id}`} className="block">
      <Card size="sm" className="transition-colors hover:bg-muted/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-[12px] font-normal text-muted-foreground">
              {result.readableId}
            </Badge>
            <span className="truncate text-[14px] font-semibold">{result.title}</span>
            <div className="ml-auto shrink-0">
              <StatusBadge status={result.status as FeedbackStatus} />
            </div>
          </div>
          {result.sectionTitle && (
            <span className="text-[12px] text-muted-foreground">{result.sectionTitle}</span>
          )}
        </CardHeader>
        {result.body && (
          <CardContent>
            <p className="text-[14px] text-muted-foreground">
              <HighlightedText text={result.body} query={query} />
            </p>
          </CardContent>
        )}
      </Card>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Section result card
// ---------------------------------------------------------------------------

export function SectionResultCard({
  result,
  query,
  documentId,
}: {
  result: SearchSectionResult
  query: string
  documentId: string
}) {
  return (
    <Link href={`/policies/${documentId}#section-${result.id}`} className="block">
      <Card size="sm" className="transition-colors hover:bg-muted/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold">
              <HighlightedText text={result.title} query={query} />
            </span>
          </div>
        </CardHeader>
      </Card>
    </Link>
  )
}

// ---------------------------------------------------------------------------
// CR result card
// ---------------------------------------------------------------------------

export function CRResultCard({
  result,
  query,
  documentId,
}: {
  result: SearchCRResult
  query: string
  documentId: string
}) {
  return (
    <Link href={`/policies/${documentId}/change-requests/${result.id}`} className="block">
      <Card size="sm" className="transition-colors hover:bg-muted/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-[12px] font-normal text-muted-foreground">
              {result.readableId}
            </Badge>
            <span className="truncate text-[14px] font-semibold">{result.title}</span>
            <div className="ml-auto shrink-0">
              <CRStatusBadge status={result.status as CRStatus} />
            </div>
          </div>
        </CardHeader>
        {result.description && (
          <CardContent>
            <p className="text-[14px] text-muted-foreground">
              <HighlightedText text={result.description} query={query} />
            </p>
          </CardContent>
        )}
      </Card>
    </Link>
  )
}
