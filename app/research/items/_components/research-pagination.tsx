/**
 * Phase 28 Plan 28-02 — public listing offset pagination (RESEARCH-09).
 *
 * Server component. Renders <nav aria-label="Research items pagination">
 * with Previous/Next anchor buttons + page indicator + aria-live region
 * announcing "Showing items {start}-{end} of {total}" (CONTEXT.md SC-7).
 *
 * Previous disabled when offset=0; Next disabled when offset+40 >= total.
 * Buttons are anchor Links preserving all other searchParams.
 *
 * The caller (app/research/items/page.tsx) constructs the searchParams
 * URLSearchParams object so this component remains pure (no awareness of
 * which params live in the page URL).
 */
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export interface ResearchPaginationProps {
  offset: number
  total: number
  searchParams: URLSearchParams // caller builds this from awaited searchParams
}

const PAGE_SIZE = 40

function buildHref(params: URLSearchParams, newOffset: number): string {
  const next = new URLSearchParams(params)
  if (newOffset === 0) next.delete('offset')
  else next.set('offset', String(newOffset))
  const qs = next.toString()
  return qs ? `/research/items?${qs}` : '/research/items'
}

export function ResearchPagination({ offset, total, searchParams }: ResearchPaginationProps) {
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const start = total === 0 ? 0 : offset + 1
  const end = Math.min(offset + PAGE_SIZE, total)
  const hasPrev = offset > 0
  const hasNext = offset + PAGE_SIZE < total

  return (
    <nav
      aria-label="Research items pagination"
      className="mt-8 flex items-center justify-between"
    >
      <div aria-live="polite" className="text-sm text-muted-foreground">
        {total === 0
          ? 'Showing 0 items'
          : `Showing items ${start}-${end} of ${total}`}
      </div>

      <div className="flex items-center gap-3">
        {hasPrev ? (
          <Link href={buildHref(searchParams, Math.max(0, offset - PAGE_SIZE))}>
            <Button variant="outline" size="sm">Previous</Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled aria-disabled="true">Previous</Button>
        )}

        <span className="text-sm text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>

        {hasNext ? (
          <Link href={buildHref(searchParams, offset + PAGE_SIZE)}>
            <Button variant="outline" size="sm">Next</Button>
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled aria-disabled="true">Next</Button>
        )}
      </div>
    </nav>
  )
}
