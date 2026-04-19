'use client'

import { useState, useCallback } from 'react'
import { trpc } from '@/src/trpc/client'
import { AuditFilterPanel, type FilterState } from './audit-filter-panel'
import { AuditEventTable } from './audit-event-table'

/**
 * H7: interpret a "YYYY-MM-DD" input as the LOCAL-TIMEZONE midnight for the
 * start bound, and as the NEXT local midnight for the end bound. `new Date('YYYY-MM-DD')`
 * parses as UTC midnight which drifts the day window by several hours in
 * most timezones and silently misses entries near the boundaries. Using
 * the three-arg `new Date(y, m, d)` constructor produces local time, and
 * for the upper bound we roll forward one calendar day so the filter is
 * effectively `[local start, next local start)` even with `lte` on the
 * server. We still pass ISO strings over the wire - the server filter uses
 * `gte`/`lte` which is inclusive; the +1-day upper bound captures entries
 * up to (but not including) the following day's midnight.
 */
function localDayStartIso(ymd: string): string | undefined {
  const parts = ymd.split('-')
  if (parts.length !== 3) return undefined
  const [y, m, d] = parts.map((p) => Number.parseInt(p, 10))
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return undefined
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString()
}

function localDayEndExclusiveIso(ymd: string): string | undefined {
  const parts = ymd.split('-')
  if (parts.length !== 3) return undefined
  const [y, m, d] = parts.map((p) => Number.parseInt(p, 10))
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return undefined
  // Next local midnight. Date() normalises overflow (e.g. Feb 30 → Mar 2).
  return new Date(y, m - 1, d + 1, 0, 0, 0, 0).toISOString()
}

export function AuditTrailClient() {
  const [filters, setFilters] = useState<FilterState>({})
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(50)

  const { data: events, isLoading } = trpc.audit.list.useQuery({
    limit: pageSize,
    offset: page * pageSize,
    action: filters.action || undefined,
    actorRole: filters.actorRole || undefined,
    entityType: filters.entityType || undefined,
    from: filters.from ? localDayStartIso(filters.from) : undefined,
    to: filters.to ? localDayEndExclusiveIso(filters.to) : undefined,
  })

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters)
    setPage(0) // Reset to first page on filter change
  }, [])

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize)
    setPage(0) // Reset to first page on page size change
  }, [])

  return (
    <div className="space-y-4">
      <AuditFilterPanel filters={filters} onFilterChange={handleFilterChange} />
      <AuditEventTable
        events={events ?? []}
        isLoading={isLoading}
        page={page}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}
