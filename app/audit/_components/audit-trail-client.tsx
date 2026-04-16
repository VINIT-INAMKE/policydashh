'use client'

import { useState, useCallback } from 'react'
import { trpc } from '@/src/trpc/client'
import { AuditFilterPanel, type FilterState } from './audit-filter-panel'
import { AuditEventTable } from './audit-event-table'

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
    from: filters.from ? new Date(filters.from).toISOString() : undefined,
    to: filters.to ? new Date(filters.to).toISOString() : undefined,
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
