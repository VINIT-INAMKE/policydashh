'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Search, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface AuditEvent {
  id: string
  timestamp: string | Date
  actorId: string
  actorRole: string
  action: string
  entityType: string
  entityId: string
  payload: Record<string, unknown>
  ipAddress: string | null
}

interface AuditEventTableProps {
  events: AuditEvent[]
  isLoading: boolean
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

function truncateJson(payload: Record<string, unknown>, maxLen = 40): string {
  const str = JSON.stringify(payload)
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '...'
}

export function AuditEventTable({
  events,
  isLoading,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: AuditEventTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    )
  }

  // Empty state
  if (events.length === 0) {
    const isFirstLoad = page === 0
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        {isFirstLoad ? (
          <>
            <Shield className="size-12 text-muted-foreground" />
            <h3 className="mt-4 text-sm font-medium">No audit events recorded</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              System actions will appear here once users start interacting with the platform.
            </p>
          </>
        ) : (
          <>
            <Search className="size-12 text-muted-foreground" />
            <h3 className="mt-4 text-sm font-medium">No results</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              No audit events match the current filters. Try clearing one or more filters.
            </p>
          </>
        )}
      </div>
    )
  }

  const start = page * pageSize + 1
  const end = page * pageSize + events.length

  return (
    <div className="space-y-4">
      <TooltipProvider>
        <Table>
          <TableCaption>Audit Trail</TableCaption>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead scope="col">Timestamp</TableHead>
              <TableHead scope="col">Actor</TableHead>
              <TableHead scope="col">Role</TableHead>
              <TableHead scope="col">Action</TableHead>
              <TableHead scope="col">Entity Type</TableHead>
              <TableHead scope="col">Entity ID</TableHead>
              <TableHead scope="col">Metadata</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => {
              const isExpanded = expandedRows.has(event.id)
              return (
                <TableRow key={event.id} className="min-h-[44px]">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {format(new Date(event.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger className="cursor-default font-mono text-xs">
                        {event.actorId.slice(0, 8)}
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-mono text-xs">{event.actorId}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{event.actorRole}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{event.action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{event.entityType}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {event.entityId.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleRow(event.id)}
                      aria-expanded={isExpanded}
                      aria-label={`Show metadata for event ${event.id.slice(0, 8)}`}
                      className="max-w-[200px] cursor-pointer truncate text-left font-mono text-xs text-muted-foreground hover:text-foreground"
                    >
                      {truncateJson(event.payload)}
                    </button>
                    {isExpanded && (
                      <div className="mt-2 rounded bg-muted p-2 font-mono text-xs whitespace-pre-wrap">
                        {JSON.stringify(event.payload, null, 2)}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TooltipProvider>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {start}&#8211;{end} events
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">Per page</label>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => onPageSizeChange(Number(val))}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={events.length < pageSize}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
