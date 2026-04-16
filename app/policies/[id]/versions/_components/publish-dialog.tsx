'use client'

import { AlertTriangle, Lock, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { trpc } from '@/src/trpc/client'
import { toast } from 'sonner'

interface ChangelogEntry {
  crId: string | null
  crReadableId: string | null
  crTitle: string
  summary: string
  feedbackIds: string[]
  affectedSectionIds: string[]
}

interface PublishDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  versionId: string
  versionLabel: string
  documentTitle: string
  changelog: ChangelogEntry[] | null
}

export function PublishDialog({
  open,
  onOpenChange,
  versionId,
  versionLabel,
  documentTitle,
  changelog,
}: PublishDialogProps) {
  const utils = trpc.useUtils()

  const publishMutation = trpc.version.publish.useMutation({
    onSuccess: () => {
      toast.success(`Version ${versionLabel} published.`)
      utils.version.list.invalidate()
      utils.version.getById.invalidate({ id: versionId })
      onOpenChange(false)
    },
    onError: () => {
      toast.error("Couldn't publish the version. Check your connection and try again.")
    },
  })

  function handlePublish() {
    publishMutation.mutate({ id: versionId })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-[20px] font-semibold leading-[1.2]">
            Publish Version
          </DialogTitle>
          <DialogDescription>
            Publishing makes this version visible on the public portal. Published
            versions are immutable &mdash; they cannot be edited after publishing.
          </DialogDescription>
        </DialogHeader>

        {/* Version context row */}
        <div className="rounded-md bg-muted p-3 text-[14px] font-normal">
          Publishing:{' '}
          <span className="font-mono">{versionLabel}</span>
          {documentTitle && ` \u2014 ${documentTitle}`}
        </div>

        {/* Changelog preview */}
        <div className="max-h-[200px] overflow-y-auto rounded-md bg-muted p-4">
          <p className="mb-2 text-[12px] font-normal uppercase tracking-wide text-muted-foreground">
            CHANGELOG
          </p>
          {!changelog || changelog.length === 0 ? (
            <p className="text-[14px] text-muted-foreground">No changelog entries.</p>
          ) : (
            <ul className="space-y-2">
              {changelog.map((entry, idx) => (
                <li key={idx} className="text-[14px] font-normal leading-[1.5]">
                  {entry.crReadableId && (
                    <span className="mr-1 inline-block rounded bg-background px-1.5 py-0.5 font-mono text-[12px]">
                      {entry.crReadableId}
                    </span>
                  )}
                  {entry.summary}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Immutability warning */}
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <p className="text-[14px] font-normal text-muted-foreground">
            This action cannot be undone. Once published, this version is
            permanently locked.
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={publishMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handlePublish}
            disabled={publishMutation.isPending}
            className={publishMutation.isPending ? 'pointer-events-none' : ''}
          >
            {publishMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Lock className="size-4" />
            )}
            Publish Version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
