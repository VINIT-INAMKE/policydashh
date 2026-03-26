'use client'

import { useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { Paperclip, Link2, ExternalLink, Trash2 } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

interface ArtifactListProps {
  workshopId: string
  canManage: boolean
}

export function ArtifactList({ workshopId, canManage }: ArtifactListProps) {
  const artifactsQuery = trpc.workshop.listArtifacts.useQuery({ workshopId })
  const utils = trpc.useUtils()
  const [removeTarget, setRemoveTarget] = useState<{
    artifactId: string
    title: string
  } | null>(null)

  const removeMutation = trpc.workshop.removeArtifact.useMutation({
    onSuccess: () => {
      toast.success('Artifact removed.')
      utils.workshop.listArtifacts.invalidate({ workshopId })
      setRemoveTarget(null)
    },
    onError: () => {
      toast.error("Couldn't remove the artifact. Try again.")
    },
  })

  if (artifactsQuery.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  const artifacts = artifactsQuery.data
  if (!artifacts || artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Paperclip className="size-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">No artifacts yet</p>
        <p className="mt-1 max-w-md text-center text-xs text-muted-foreground">
          Attach promo materials, recordings, summaries, or attendance records to this workshop.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-0.5">
        {artifacts.map((artifact) => {
          const dateStr =
            typeof artifact.createdAt === 'string'
              ? artifact.createdAt
              : artifact.createdAt.toISOString()
          const relativeTime = formatDistanceToNow(parseISO(dateStr), {
            addSuffix: true,
          })

          return (
            <div
              key={artifact.id}
              className="group flex items-start gap-3 border-b border-border/50 px-2 py-3 hover:bg-muted/50"
            >
              {artifact.type === 'file' ? (
                <Paperclip className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              ) : (
                <Link2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{artifact.title}</span>
                  <Badge variant="secondary">
                    {capitalizeFirst(artifact.artifactType)}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{artifact.uploaderName ?? 'Unknown'}</span>
                  <span>&middot;</span>
                  <time dateTime={dateStr}>{relativeTime}</time>
                </div>
                {artifact.type === 'file' && artifact.fileName && (
                  <div className="text-xs text-muted-foreground">
                    {artifact.fileName}
                    {artifact.fileSize != null && (
                      <> &middot; {formatFileSize(artifact.fileSize)}</>
                    )}
                  </div>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(artifact.url, '_blank')}
              >
                <ExternalLink className="size-3.5" />
              </Button>

              {canManage && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Remove artifact ${artifact.title}`}
                  onClick={() =>
                    setRemoveTarget({
                      artifactId: artifact.id,
                      title: artifact.title,
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {/* Remove artifact confirmation */}
      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Artifact</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &ldquo;{removeTarget?.title}&rdquo; from this workshop. The evidence artifact record is preserved. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() => {
                if (removeTarget) {
                  removeMutation.mutate({
                    workshopId,
                    artifactId: removeTarget.artifactId,
                  })
                }
              }}
            >
              Remove Artifact
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
