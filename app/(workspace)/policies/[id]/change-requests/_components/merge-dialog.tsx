'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2 } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { toast } from 'sonner'

const MIN_SUMMARY_LENGTH = 20
const MAX_SUMMARY_LENGTH = 2000

interface MergeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  crId: string
  readableId: string
  title: string
  documentId: string
  onMerged: () => void
}

export function MergeDialog({
  open,
  onOpenChange,
  crId,
  readableId,
  title,
  documentId,
  onMerged,
}: MergeDialogProps) {
  const [mergeSummary, setMergeSummary] = useState('')

  const versionQuery = trpc.changeRequest.getNextVersionLabel.useQuery(
    { documentId },
    { enabled: open },
  )

  const mergeMutation = trpc.changeRequest.merge.useMutation({
    onSuccess: (data) => {
      const versionLabel = data.version?.versionLabel ?? versionQuery.data?.versionLabel ?? 'new version'
      toast.success(`Change request merged. Version ${versionLabel} created.`)
      setMergeSummary('')
      onOpenChange(false)
      onMerged()
    },
    onError: () => {
      toast.error('The merge failed. No version was created and no changes were saved. Try again.')
    },
  })

  const canMerge = mergeSummary.trim().length >= MIN_SUMMARY_LENGTH

  function handleMerge() {
    if (!canMerge) return
    mergeMutation.mutate({
      id: crId,
      mergeSummary: mergeSummary.trim(),
    })
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setMergeSummary('')
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={`sm:max-w-[520px] ${mergeMutation.isPending ? 'opacity-50' : ''}`}>
        <DialogHeader>
          <DialogTitle>Merge Change Request</DialogTitle>
          <DialogDescription>
            Merging will create a new document version. All linked feedback items will be
            updated to reflect the version they influenced. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {/* CR context row */}
        <div className="rounded-md bg-muted px-3 py-2 text-[14px] font-normal">
          Merging: {readableId} &mdash; {title}
        </div>

        {/* Merge summary textarea */}
        <div className="space-y-2">
          <label
            htmlFor="merge-summary"
            className="text-sm font-medium leading-none"
          >
            Merge Summary *
          </label>
          <Textarea
            id="merge-summary"
            placeholder="Describe what changed in this merge. This will appear in the auto-generated version changelog."
            rows={6}
            className="min-h-[96px]"
            value={mergeSummary}
            onChange={(e) => setMergeSummary(e.target.value)}
            maxLength={MAX_SUMMARY_LENGTH}
            required
            disabled={mergeMutation.isPending}
            autoFocus
          />
          <p className="text-right text-xs text-muted-foreground">
            {mergeSummary.length}/{MAX_SUMMARY_LENGTH}
          </p>
        </div>

        {/* Version preview */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-normal text-muted-foreground">
            New version will be created:
          </span>
          {versionQuery.isLoading ? (
            <Skeleton className="h-5 w-12" />
          ) : (
            <Badge variant="secondary" className="font-mono text-xs">
              {versionQuery.data?.versionLabel ?? '...'}
            </Badge>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={mergeMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            disabled={!canMerge || mergeMutation.isPending}
            onClick={handleMerge}
            className={mergeMutation.isPending ? 'pointer-events-none' : ''}
          >
            {mergeMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {mergeMutation.isPending ? 'Merging...' : 'Merge and Create Version'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
