'use client'

import { Plus } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { VersionCard } from './version-card'

interface VersionListVersion {
  id: string
  versionLabel: string
  isPublished: boolean
  publishedAt: string | null
  createdAt: string
  creatorName: string | null
}

interface VersionListProps {
  versions: VersionListVersion[]
  selectedVersionId: string | null
  onSelect: (id: string) => void
  isLoading: boolean
  onNewVersion: () => void
  canManageVersions?: boolean
}

export function VersionList({
  versions,
  selectedVersionId,
  onSelect,
  isLoading,
  onNewVersion,
  canManageVersions = false,
}: VersionListProps) {
  // Desktop panel view (hidden on mobile)
  const desktopPanel = (
    <div className="hidden h-full flex-col lg:flex">
      <div className="p-4">
        <h2 className="text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
          VERSIONS
        </h2>
        <span className="text-[12px] text-muted-foreground">
          {isLoading ? '...' : `${versions.length} versions`}
        </span>
      </div>
      <ScrollArea className="flex-1 px-2">
        {isLoading ? (
          <div className="flex flex-col gap-2 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1 pb-2">
            {versions.map((v) => (
              <VersionCard
                key={v.id}
                version={v}
                isSelected={v.id === selectedVersionId}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </ScrollArea>
      {/* New Version button -- server enforces version:manage permission */}
      {canManageVersions && (
        <div className="border-t p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onNewVersion}
          >
            <Plus className="size-3.5" />
            New Version
          </Button>
        </div>
      )}
    </div>
  )

  // Mobile select view (hidden on desktop)
  const mobileSelect = (
    <div className="lg:hidden">
      <Select
        value={selectedVersionId ?? undefined}
        onValueChange={(val) => {
          if (val) onSelect(val)
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select version..." />
        </SelectTrigger>
        <SelectContent>
          {versions.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              <span className="font-mono">{v.versionLabel}</span>
              <span className="ml-2 text-muted-foreground">
                {v.isPublished ? 'Published' : 'Draft'}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <>
      {desktopPanel}
      {mobileSelect}
    </>
  )
}
