'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { FileText, GitCommit, GitPullRequest } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge, type FeedbackStatus } from '../../feedback/_components/status-badge'
import { CRStatusBadge, type CRStatus } from '../../change-requests/_components/cr-status-badge'

interface SectionChainViewProps {
  documentId: string
  sections: { id: string; title: string }[]
}

interface SectionChainRow {
  sectionId: string
  sectionTitle: string
  crId: string
  crReadableId: string
  crTitle: string
  crStatus: string
  feedbackId: string | null
  feedbackReadableId: string | null
  feedbackTitle: string | null
  feedbackStatus: string | null
  feedbackDecisionRationale: string | null
  versionId: string | null
  versionLabel: string | null
  versionCreatedAt: string | null
}

interface VersionGroup {
  versionId: string | null
  versionLabel: string | null
  versionCreatedAt: string | null
  crs: {
    crId: string
    crReadableId: string
    crTitle: string
    crStatus: string
    feedbackItems: {
      feedbackId: string
      feedbackReadableId: string
      feedbackTitle: string
      feedbackStatus: string
      feedbackDecisionRationale: string | null
    }[]
  }[]
}

function groupByVersion(rows: SectionChainRow[]): VersionGroup[] {
  const versionMap = new Map<string, VersionGroup>()

  for (const row of rows) {
    const vKey = row.versionId ?? '__none__'

    if (!versionMap.has(vKey)) {
      versionMap.set(vKey, {
        versionId: row.versionId,
        versionLabel: row.versionLabel,
        versionCreatedAt: row.versionCreatedAt,
        crs: [],
      })
    }

    const group = versionMap.get(vKey)!
    let cr = group.crs.find((c) => c.crId === row.crId)
    if (!cr) {
      cr = {
        crId: row.crId,
        crReadableId: row.crReadableId,
        crTitle: row.crTitle,
        crStatus: row.crStatus,
        feedbackItems: [],
      }
      group.crs.push(cr)
    }

    if (
      row.feedbackId &&
      row.feedbackReadableId &&
      row.feedbackTitle &&
      row.feedbackStatus &&
      !cr.feedbackItems.some((f) => f.feedbackId === row.feedbackId)
    ) {
      cr.feedbackItems.push({
        feedbackId: row.feedbackId,
        feedbackReadableId: row.feedbackReadableId,
        feedbackTitle: row.feedbackTitle,
        feedbackStatus: row.feedbackStatus,
        feedbackDecisionRationale: row.feedbackDecisionRationale,
      })
    }
  }

  return Array.from(versionMap.values())
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function SectionChainView({ documentId, sections }: SectionChainViewProps) {
  const [selectedSectionId, setSelectedSectionId] = useState<string | undefined>(undefined)

  const chainQuery = trpc.traceability.sectionChain.useQuery(
    { sectionId: selectedSectionId! },
    { enabled: !!selectedSectionId }
  )

  const versionGroups = useMemo(() => {
    if (!chainQuery.data) return []
    return groupByVersion(chainQuery.data as SectionChainRow[])
  }, [chainQuery.data])

  const selectedSection = sections.find((s) => s.id === selectedSectionId)

  return (
    <div className="mx-auto max-w-[800px] p-6">
      {/* Section selector */}
      <div className="mb-6">
        <Select
          value={selectedSectionId ?? ''}
          onValueChange={(val) => setSelectedSectionId(val || undefined)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a section" />
          </SelectTrigger>
          <SelectContent>
            {sections.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* No section selected */}
      {!selectedSectionId && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="size-12 text-muted-foreground" />
          <p className="mt-4 text-[14px] text-muted-foreground">
            Select a section above to see what changed and why.
          </p>
        </div>
      )}

      {/* Loading */}
      {selectedSectionId && chainQuery.isLoading && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4 ring-1 ring-foreground/10">
              <Skeleton className="mb-3 h-4 w-1/3" />
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Heading */}
      {selectedSection && !chainQuery.isLoading && (
        <h2 className="mb-4 text-[20px] font-semibold leading-[1.2]">
          Changes to: {selectedSection.title}
        </h2>
      )}

      {/* Empty state - no changes */}
      {selectedSectionId && !chainQuery.isLoading && versionGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <GitCommit className="size-12 text-muted-foreground" />
          <p className="mt-4 text-[14px] text-muted-foreground">
            No changes recorded for this section yet.
          </p>
        </div>
      )}

      {/* Version transition cards */}
      {versionGroups.length > 0 && (
        <div className="flex flex-col gap-4">
          {versionGroups.map((group, gi) => (
            <Card key={group.versionId ?? `group-${gi}`}>
              <CardHeader>
                <h3 className="text-[12px] font-normal text-muted-foreground">
                  {group.versionLabel
                    ? `\u2192 ${group.versionLabel}`
                    : 'Unversioned'}
                  {group.versionCreatedAt && ` \u00B7 ${formatDate(group.versionCreatedAt)}`}
                </h3>
              </CardHeader>
              <CardContent>
                {group.crs.map((cr) => (
                  <div key={cr.crId} className="mb-4 last:mb-0">
                    {/* CR link row */}
                    <Link
                      href={`/policies/${documentId}/change-requests/${cr.crId}`}
                      className="mb-2 flex items-center gap-2 hover:underline"
                    >
                      <GitPullRequest className="size-4 text-muted-foreground" />
                      <Badge
                        variant="secondary"
                        className="border-transparent font-mono text-[12px]"
                      >
                        {cr.crReadableId}
                      </Badge>
                      <span className="text-[14px]">{cr.crTitle}</span>
                      <CRStatusBadge status={cr.crStatus as CRStatus} />
                    </Link>

                    {/* Linked feedback list */}
                    {cr.feedbackItems.length > 0 && (
                      <div className="ml-6 flex flex-col gap-1">
                        {cr.feedbackItems.map((fb) => (
                          <div key={fb.feedbackId} className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="shrink-0 border-transparent font-mono text-[12px]"
                            >
                              {fb.feedbackReadableId}
                            </Badge>
                            <span className="min-w-0 truncate text-[14px]">
                              {fb.feedbackTitle}
                            </span>
                            <StatusBadge status={fb.feedbackStatus as FeedbackStatus} />
                          </div>
                        ))}

                        {/* Decision rationale from first feedback with rationale */}
                        {cr.feedbackItems.some((fb) => fb.feedbackDecisionRationale) && (
                          <p className="mt-2 text-[14px] font-normal leading-[1.5]">
                            <span className="font-medium">Rationale:</span>{' '}
                            {cr.feedbackItems.find((fb) => fb.feedbackDecisionRationale)
                              ?.feedbackDecisionRationale}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
