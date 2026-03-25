'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Network } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { StatusBadge, type FeedbackStatus } from '../../feedback/_components/status-badge'

export interface MatrixRow {
  feedbackId: string
  feedbackReadableId: string
  feedbackTitle: string
  feedbackStatus: string
  feedbackDecisionRationale: string | null
  feedbackIsAnonymous: boolean
  feedbackCreatedAt: string
  submitterName: string | null
  submitterOrgType: string | null
  crId: string | null
  crReadableId: string | null
  crTitle: string | null
  crStatus: string | null
  sectionId: string | null
  sectionTitle: string | null
  versionId: string | null
  versionLabel: string | null
}

interface MatrixTableProps {
  rows: MatrixRow[]
  isLoading: boolean
  documentId: string
}

export function MatrixTable({ rows, isLoading, documentId }: MatrixTableProps) {
  // Client-side deduplication: group by feedbackId, take first occurrence
  const dedupedRows = useMemo(() => {
    const seen = new Map<string, MatrixRow>()
    for (const row of rows) {
      if (!seen.has(row.feedbackId)) {
        seen.set(row.feedbackId, row)
      } else {
        // If same feedback appears with different sections, append section name
        const existing = seen.get(row.feedbackId)!
        if (row.sectionTitle && existing.sectionTitle && !existing.sectionTitle.includes(row.sectionTitle)) {
          seen.set(row.feedbackId, {
            ...existing,
            sectionTitle: `${existing.sectionTitle}, ${row.sectionTitle}`,
          })
        }
      }
    }
    return Array.from(seen.values())
  }, [rows])

  if (isLoading) {
    return (
      <div className="min-w-[800px]">
        <Table>
          <TableCaption>Traceability Matrix</TableCaption>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead className="min-w-[200px] text-[12px] font-normal uppercase tracking-wide">Feedback</TableHead>
              <TableHead className="min-w-[200px] text-[12px] font-normal uppercase tracking-wide">Change Request</TableHead>
              <TableHead className="min-w-[160px] text-[12px] font-normal uppercase tracking-wide">Section</TableHead>
              <TableHead className="min-w-[100px] text-[12px] font-normal uppercase tracking-wide">Version</TableHead>
              <TableHead className="min-w-[140px] text-[12px] font-normal uppercase tracking-wide">Decision</TableHead>
              <TableHead className="max-w-[240px] text-[12px] font-normal uppercase tracking-wide">Rationale</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-full" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (dedupedRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Network className="size-12 text-muted-foreground" />
        <h2 className="mt-4 text-[20px] font-semibold leading-[1.2]">
          No traceability data yet
        </h2>
        <p className="mt-2 max-w-md text-[14px] text-muted-foreground">
          Once feedback is reviewed and linked to change requests, the traceability chain will appear here.
        </p>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="min-w-[800px]">
        <Table>
          <TableCaption>Traceability Matrix</TableCaption>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead className="sticky left-0 z-10 min-w-[200px] bg-muted text-[12px] font-normal uppercase tracking-wide">
                Feedback
              </TableHead>
              <TableHead className="min-w-[200px] text-[12px] font-normal uppercase tracking-wide">
                Change Request
              </TableHead>
              <TableHead className="min-w-[160px] text-[12px] font-normal uppercase tracking-wide">
                Section
              </TableHead>
              <TableHead className="min-w-[100px] text-[12px] font-normal uppercase tracking-wide">
                Version
              </TableHead>
              <TableHead className="min-w-[140px] text-[12px] font-normal uppercase tracking-wide">
                Decision
              </TableHead>
              <TableHead className="max-w-[240px] text-[12px] font-normal uppercase tracking-wide">
                Rationale
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dedupedRows.map((row) => (
              <TableRow
                key={row.feedbackId}
                className="hover:bg-muted/50"
                aria-label={`Feedback ${row.feedbackReadableId}, Change Request ${row.crReadableId ?? 'none'}, Section ${row.sectionTitle ?? 'none'}, Version ${row.versionLabel ?? 'none'}, Decision ${row.feedbackStatus}`}
              >
                {/* Feedback cell - sticky */}
                <TableCell className="sticky left-0 z-10 bg-background">
                  <Link
                    href={`/policies/${documentId}/feedback`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Badge
                      variant="secondary"
                      className="shrink-0 border-transparent font-mono text-[12px]"
                    >
                      {row.feedbackReadableId}
                    </Badge>
                    <span className="truncate text-[14px]">{row.feedbackTitle}</span>
                  </Link>
                </TableCell>

                {/* CR cell */}
                <TableCell>
                  {row.crId ? (
                    <Link
                      href={`/policies/${documentId}/change-requests/${row.crId}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <Badge
                        variant="secondary"
                        className="shrink-0 border-transparent font-mono text-[12px]"
                      >
                        {row.crReadableId}
                      </Badge>
                      <span className="truncate text-[14px]">{row.crTitle}</span>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </TableCell>

                {/* Section cell */}
                <TableCell>
                  {row.sectionTitle ? (
                    <Badge variant="secondary" className="border-transparent">
                      {row.sectionTitle}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </TableCell>

                {/* Version cell */}
                <TableCell>
                  {row.versionLabel ? (
                    <Link
                      href={`/policies/${documentId}/versions`}
                      className="hover:underline"
                    >
                      <Badge
                        variant="secondary"
                        className="border-transparent font-mono text-[12px]"
                      >
                        {row.versionLabel}
                      </Badge>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </TableCell>

                {/* Decision cell */}
                <TableCell>
                  <StatusBadge status={row.feedbackStatus as FeedbackStatus} />
                </TableCell>

                {/* Rationale cell */}
                <TableCell className="max-w-[240px]">
                  {row.feedbackDecisionRationale ? (
                    <Tooltip>
                      <TooltipTrigger className="cursor-default text-left">
                        <span className="line-clamp-2 text-[14px] font-normal">
                          {row.feedbackDecisionRationale}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-sm">
                        {row.feedbackDecisionRationale}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-muted-foreground">&mdash;</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  )
}
