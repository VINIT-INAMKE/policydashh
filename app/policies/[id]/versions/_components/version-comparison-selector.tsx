'use client'

import { useState, useMemo } from 'react'
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

export function VersionComparisonSelector({
  versions,
  documentId,
  currentVersionId,
}: VersionComparisonSelectorProps) {
  const sectionsQuery = trpc.document.getSections.useQuery({ documentId })
  const sections = useMemo(
    () =>
      sectionsQuery.data?.map((s: { id: string; title: string }) => ({
        id: s.id,
        title: s.title,
      })) ?? [],
    [sectionsQuery.data],
  )

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

  // Auto-select first section when sections load
  useMemo(() => {
    if (sections.length > 0 && !selectedSectionId) {
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
