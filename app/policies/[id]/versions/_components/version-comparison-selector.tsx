'use client'

import { useState, useMemo, useEffect } from 'react'
import { ArrowLeftRight, GitCompare } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { SectionDiffView } from './section-diff-view'

interface VersionListItem {
  id: string
  versionLabel: string
  isPublished: boolean
  publishedAt: string | null
  createdAt: string
  creatorName: string | null
}

interface VersionComparisonSelectorProps {
  versions: VersionListItem[]
  documentId: string
  currentVersionId: string
}

interface DiffSectionRow {
  sectionId: string
  titleA: string | null
  titleB: string | null
  status: 'added' | 'removed' | 'modified' | 'unchanged'
}

export function VersionComparisonSelector({
  versions,
  documentId: _documentId,
  currentVersionId,
}: VersionComparisonSelectorProps) {
  // Default selections
  const currentIndex = versions.findIndex((v) => v.id === currentVersionId)
  const defaultBaseId =
    currentIndex >= 0 && currentIndex < versions.length - 1
      ? versions[currentIndex + 1].id
      : null
  const defaultTargetId = currentVersionId

  const [baseVersionId, setBaseVersionId] = useState<string | null>(defaultBaseId)
  const [targetVersionId, setTargetVersionId] = useState<string | null>(defaultTargetId)
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState(false)

  // A9: derive the section dropdown from the UNION of section ids in both
  // snapshots — not the live policy sections. If a section was deleted
  // after the compared versions were created it should still appear here
  // (and will render as "removed"); if a section was created after both
  // versions, it shouldn't appear at all.
  const diffQuery = trpc.version.diff.useQuery(
    { versionAId: baseVersionId ?? '', versionBId: targetVersionId ?? '' },
    {
      enabled:
        !!baseVersionId &&
        !!targetVersionId &&
        baseVersionId !== targetVersionId,
    },
  )

  const sections = useMemo(() => {
    const rows = (diffQuery.data?.diff ?? []) as DiffSectionRow[]
    return rows.map((d) => ({
      id: d.sectionId,
      // Prefer the target snapshot's title (most recent), fall back to base.
      title: d.titleB ?? d.titleA ?? 'Unnamed section',
    }))
  }, [diffQuery.data])

  // Auto-pick the first section once the diff arrives. Re-run whenever the
  // compared versions change (and thus the section list changes).
  useEffect(() => {
    if (sections.length === 0) {
      if (selectedSectionId !== null) setSelectedSectionId(null)
      return
    }
    if (!selectedSectionId || !sections.some((s) => s.id === selectedSectionId)) {
      setSelectedSectionId(sections[0].id)
    }
  }, [sections, selectedSectionId])

  const isSameVersion = baseVersionId === targetVersionId

  const baseVersion = versions.find((v) => v.id === baseVersionId)
  const targetVersion = versions.find((v) => v.id === targetVersionId)

  function handleSwap() {
    setBaseVersionId(targetVersionId)
    setTargetVersionId(baseVersionId)
    setShowDiff(false)
  }

  function handleCompare() {
    if (!baseVersionId || !targetVersionId || isSameVersion) return
    setShowDiff(true)
  }

  if (versions.length < 2) {
    return (
      <p className="text-[14px] text-muted-foreground">
        At least two versions are needed to compare.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Selector row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {/* Base version */}
        <div className="flex-1 space-y-1">
          <label className="text-[12px] font-normal text-muted-foreground">
            Compare from
          </label>
          <Select
            value={baseVersionId ?? undefined}
            onValueChange={(val) => {
              setBaseVersionId(val)
              setShowDiff(false)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select version..." />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  <span className="font-mono">{v.versionLabel}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Swap button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSwap}
          aria-label="Swap versions"
          className="self-end"
        >
          <ArrowLeftRight className="size-4" />
        </Button>

        {/* Target version */}
        <div className="flex-1 space-y-1">
          <label className="text-[12px] font-normal text-muted-foreground">
            to
          </label>
          <Select
            value={targetVersionId ?? undefined}
            onValueChange={(val) => {
              setTargetVersionId(val)
              setShowDiff(false)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select version..." />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  <span className="font-mono">{v.versionLabel}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Section select */}
        <div className="flex-1 space-y-1">
          <label className="text-[12px] font-normal text-muted-foreground">
            Section
          </label>
          <Select
            value={selectedSectionId ?? undefined}
            onValueChange={(val) => {
              setSelectedSectionId(val)
              setShowDiff(false)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select section..." />
            </SelectTrigger>
            <SelectContent>
              {sections.map((s: { id: string; title: string }) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Compare button */}
        <Button
          variant="default"
          onClick={handleCompare}
          disabled={!baseVersionId || !targetVersionId || isSameVersion}
          className="self-end"
        >
          <GitCompare className="size-4" />
          Compare Versions
        </Button>
      </div>

      {/* Validation message */}
      {isSameVersion && baseVersionId && (
        <p className="text-[14px] text-muted-foreground">
          Select two different versions to compare.
        </p>
      )}

      {/* Diff view */}
      {showDiff && baseVersionId && targetVersionId && !isSameVersion && (
        <SectionDiffView
          versionAId={baseVersionId}
          versionBId={targetVersionId}
          versionALabel={baseVersion?.versionLabel ?? ''}
          versionBLabel={targetVersion?.versionLabel ?? ''}
          sectionId={selectedSectionId ?? undefined}
        />
      )}
    </div>
  )
}
