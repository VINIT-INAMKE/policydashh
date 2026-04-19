'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
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
import { trpc } from '@/src/trpc/client'
import { toast } from 'sonner'
import { subscribePendingCount } from '../../_components/section-autosave-pending'

const MIN_NOTES_LENGTH = 10
const MAX_NOTES_LENGTH = 2000

interface CreateVersionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentId: string
}

function computeNextLabel(versions: Array<{ versionLabel: string }>): string {
  if (!versions || versions.length === 0) return 'v0.1'
  // versions are sorted desc by createdAt -- first is latest
  const latest = versions[0].versionLabel
  const match = latest.match(/^v0\.(\d+)$/)
  if (!match) return 'v0.1'
  return `v0.${parseInt(match[1], 10) + 1}`
}

export function CreateVersionDialog({
  open,
  onOpenChange,
  documentId,
}: CreateVersionDialogProps) {
  const [notes, setNotes] = useState('')
  const [pendingSaves, setPendingSaves] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const utils = trpc.useUtils()

  // D14: track section autosave pending state. If any section is still
  // flushing, block the "Create Version" action so we don't snapshot stale
  // content.
  useEffect(() => {
    return subscribePendingCount(setPendingSaves)
  }, [])

  const versionsQuery = trpc.version.list.useQuery(
    { documentId },
    { enabled: open },
  )

  const nextLabel = computeNextLabel(versionsQuery.data ?? [])

  const createMutation = trpc.version.createManual.useMutation({
    onSuccess: (data) => {
      toast.success(`Version ${data.versionLabel} created.`)
      utils.version.list.invalidate()
      setNotes('')
      onOpenChange(false)
    },
    onError: () => {
      toast.error("Couldn't create the version. Check your connection and try again.")
    },
  })

  // Autofocus textarea on open
  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [open])

  // D14: disable Create while autosaves are in flight.
  const canCreate = notes.trim().length >= MIN_NOTES_LENGTH && pendingSaves === 0

  function handleCreate() {
    if (!canCreate) return
    createMutation.mutate({
      documentId,
      notes: notes.trim(),
    })
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setNotes('')
    }
    onOpenChange(nextOpen)
  }

  const showMinWarning = notes.length > 0 && notes.length < MIN_NOTES_LENGTH

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-[20px] font-semibold leading-[1.2]">
            Create Version
          </DialogTitle>
          <DialogDescription>
            Create a new version snapshot of the current document state.
          </DialogDescription>
        </DialogHeader>

        {/* Version preview */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-normal text-muted-foreground">
            New version label:
          </span>
          <span className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">
            {nextLabel}
          </span>
        </div>

        {/* Notes textarea */}
        <div className="space-y-2">
          <label
            htmlFor="version-notes"
            className="text-sm font-medium leading-none"
          >
            Version Notes *
          </label>
          <Textarea
            ref={textareaRef}
            id="version-notes"
            placeholder="Describe the state of this version. This will appear in the changelog."
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={MAX_NOTES_LENGTH}
            required
            disabled={createMutation.isPending}
          />
          <div className="flex items-center justify-between">
            {showMinWarning && (
              <p className="text-[12px] text-destructive">
                Please provide at least 10 characters of version notes.
              </p>
            )}
            <p
              className={`ml-auto text-[12px] font-normal ${
                showMinWarning ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              {notes.length}/{MAX_NOTES_LENGTH}
            </p>
          </div>
        </div>

        {/* D14: warn user while autosave is still running. */}
        {pendingSaves > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-[13px]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p>
              Saving {pendingSaves} section{pendingSaves === 1 ? '' : 's'}&hellip; Wait for the save
              to finish before creating a snapshot so the new version reflects your latest edits.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            disabled={!canCreate || createMutation.isPending}
            onClick={handleCreate}
            className={createMutation.isPending ? 'pointer-events-none' : ''}
          >
            {createMutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Create Version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
