'use client'

import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface SectionDiffViewProps {
  versionAId: string
  versionBId: string
  versionALabel: string
  versionBLabel: string
  sectionId?: string
}

interface DiffChange {
  value: string
  added?: boolean
  removed?: boolean
}

interface SectionDiffItem {
  sectionId: string
  titleA: string | null
  titleB: string | null
  status: 'added' | 'removed' | 'modified' | 'unchanged'
  diff: DiffChange[] | null
}

export function SectionDiffView({
  versionAId,
  versionBId,
  versionALabel,
  versionBLabel,
  sectionId,
}: SectionDiffViewProps) {
  const diffQuery = trpc.version.diff.useQuery(
    { versionAId, versionBId },
    {
      enabled: !!versionAId && !!versionBId && versionAId !== versionBId,
    },
  )

  if (diffQuery.isLoading) {
    return (
      <div className="flex flex-col gap-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    )
  }

  if (diffQuery.error) {
    // A15: re-selecting sections re-issues the same query with the same
    // arguments and fails the same way. Give users an actual retry
    // affordance for transient errors.
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border border-dashed p-4">
        <p className="text-[14px] text-muted-foreground">
          Couldn&apos;t load the diff. {diffQuery.error.message || 'Try again in a moment.'}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => diffQuery.refetch()}
          disabled={diffQuery.isFetching}
        >
          {diffQuery.isFetching ? 'Retrying…' : 'Retry'}
        </Button>
      </div>
    )
  }

  const data = diffQuery.data
  if (!data) return null

  // Filter to selected section if provided
  const allDiffs = data.diff as SectionDiffItem[]
  const sectionDiff = sectionId
    ? allDiffs.find((d) => d.sectionId === sectionId)
    : allDiffs[0]

  if (!sectionDiff) {
    return (
      <p className="text-[14px] text-muted-foreground">
        Snapshot not available for this version.
      </p>
    )
  }

  // Unchanged
  if (sectionDiff.status === 'unchanged') {
    return (
      <div className="flex items-center justify-center rounded-md border p-8">
        <p className="text-[14px] text-muted-foreground">
          No changes in this section between {versionALabel} and {versionBLabel}.
        </p>
      </div>
    )
  }

  // Added (not in base version)
  if (sectionDiff.status === 'added') {
    return (
      <div className="overflow-hidden rounded-md border">
        <div className="border-b bg-muted p-2">
          <span className="font-mono text-[12px]">{versionBLabel}</span>
          <span className="ml-2 text-[12px] text-muted-foreground">Target</span>
        </div>
        <p className="p-4 text-[14px] text-muted-foreground">
          This section had no content in version {versionALabel}.
        </p>
        <div className="bg-[var(--diff-added-bg)] p-4 font-mono text-sm leading-relaxed text-[var(--diff-added-text)]">
          {sectionDiff.titleB ?? 'New section'}
        </div>
      </div>
    )
  }

  // Removed (not in target version)
  if (sectionDiff.status === 'removed') {
    return (
      <div className="overflow-hidden rounded-md border">
        <div className="border-b bg-muted p-2">
          <span className="font-mono text-[12px]">{versionALabel}</span>
          <span className="ml-2 text-[12px] text-muted-foreground">Base</span>
        </div>
        <p className="p-4 text-[14px] text-muted-foreground">
          This section had no content in version {versionBLabel}.
        </p>
        <div className="bg-[var(--diff-removed-bg)] p-4 font-mono text-sm leading-relaxed text-[var(--diff-removed-text)] line-through">
          {sectionDiff.titleA ?? 'Removed section'}
        </div>
      </div>
    )
  }

  // Modified -- render inline diff
  const changes = sectionDiff.diff ?? []

  return (
    <div className="max-h-[60vh] overflow-hidden overflow-y-auto rounded-md border">
      {/* Two-column header (desktop) */}
      <div className="hidden border-b bg-muted p-2 lg:flex">
        <div className="flex-1">
          <span className="text-[12px] text-muted-foreground">Base</span>
          <span className="ml-2 font-mono text-[12px]">{versionALabel}</span>
        </div>
        <div className="flex-1">
          <span className="text-[12px] text-muted-foreground">Target</span>
          <span className="ml-2 font-mono text-[12px]">{versionBLabel}</span>
        </div>
      </div>
      {/* Single header (mobile) */}
      <div className="border-b bg-muted p-2 lg:hidden">
        <span className="font-mono text-[12px]">{versionALabel}</span>
        <span className="mx-2 text-[12px] text-muted-foreground">&rarr;</span>
        <span className="font-mono text-[12px]">{versionBLabel}</span>
      </div>

      {/* Inline diff content */}
      <div className="p-4 font-mono text-sm leading-relaxed">
        {changes.map((change: DiffChange, idx: number) => {
          if (change.added) {
            return (
              <span
                key={idx}
                className="bg-[var(--diff-added-bg)] text-[var(--diff-added-text)]"
                aria-label={`Added: ${change.value}`}
              >
                {change.value}
              </span>
            )
          }
          if (change.removed) {
            return (
              <span
                key={idx}
                className="bg-[var(--diff-removed-bg)] text-[var(--diff-removed-text)] line-through"
                aria-label={`Removed: ${change.value}`}
              >
                {change.value}
              </span>
            )
          }
          return (
            <span key={idx} className="text-foreground">
              {change.value}
            </span>
          )
        })}
      </div>
    </div>
  )
}
