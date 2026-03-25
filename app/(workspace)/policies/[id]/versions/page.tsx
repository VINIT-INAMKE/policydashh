'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, GitBranch } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { VersionList } from './_components/version-list'
import { VersionDetail } from './_components/version-detail'
import { CreateVersionDialog } from './_components/create-version-dialog'

export default function VersionHistoryPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const documentId = params.id

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const versionsQuery = trpc.version.list.useQuery({ documentId })

  // Auto-select latest version on initial load
  useEffect(() => {
    if (versionsQuery.data && versionsQuery.data.length > 0 && !selectedVersionId) {
      setSelectedVersionId(versionsQuery.data[0].id)
    }
  }, [versionsQuery.data, selectedVersionId])

  if (versionsQuery.isLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)]">
        {/* Sidebar skeleton */}
        <div className="hidden w-[280px] shrink-0 border-r bg-muted p-4 lg:block">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
        {/* Content skeleton */}
        <div className="flex-1 p-8">
          <div className="mx-auto max-w-[800px]">
            <Skeleton className="mb-4 h-6 w-20" />
            <Skeleton className="mb-2 h-4 w-1/3" />
            <Skeleton className="mb-2 h-4 w-1/3" />
            <div className="mt-6 flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const versions = versionsQuery.data ?? []

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left panel: version list (desktop) */}
      <div className="hidden w-[280px] shrink-0 border-r bg-muted lg:block">
        <VersionList
          versions={versions}
          selectedVersionId={selectedVersionId}
          onSelect={setSelectedVersionId}
          isLoading={false}
          onNewVersion={() => setCreateOpen(true)}
        />
      </div>

      {/* Right panel: content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[800px] p-6 lg:p-8">
          {/* Back link */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/policies/${documentId}`)}
            className="mb-4"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Policy
          </Button>

          {/* Page heading */}
          <h1 className="mb-6 text-[20px] font-semibold leading-[1.2]">
            Version History
          </h1>

          {/* Mobile version selector + new version button */}
          <div className="mb-4 flex items-center gap-2 lg:hidden">
            <div className="flex-1">
              <VersionList
                versions={versions}
                selectedVersionId={selectedVersionId}
                onSelect={setSelectedVersionId}
                isLoading={false}
                onNewVersion={() => setCreateOpen(true)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              New Version
            </Button>
          </div>

          {/* Version detail or empty state */}
          {selectedVersionId ? (
            <VersionDetail
              versionId={selectedVersionId}
              documentId={documentId}
              versions={versions}
            />
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <GitBranch className="h-12 w-12 text-muted-foreground/50" />
              <div>
                <p className="text-[14px] font-semibold">No versions yet</p>
                <p className="mt-1 text-[14px] text-muted-foreground">
                  Versions are created automatically when a change request is merged, or manually by an Admin or Policy Lead.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a version to view its details.
            </p>
          )}
        </div>
      </div>

      {/* Create version dialog */}
      <CreateVersionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        documentId={documentId}
      />
    </div>
  )
}
