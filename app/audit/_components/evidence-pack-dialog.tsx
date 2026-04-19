'use client'

import { useState, useCallback, useEffect, type ReactNode, type ReactElement } from 'react'
import { CheckCircle, Loader2, FileArchive, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

type ExportState = 'idle' | 'queued' | 'error'

interface EvidencePackDialogProps {
  trigger?: ReactNode
}

export function EvidencePackDialog({ trigger }: EvidencePackDialogProps = {}) {
  const [open, setOpen] = useState(false)
  const [policyId, setPolicyId] = useState('')
  const [toastFired, setToastFired] = useState(false)

  // Checklist state (all checked by default - display-only for now; the
  // Inngest function exports the full pack. Per-section opt-in is a
  // future enhancement.)
  const [checklist, setChecklist] = useState({
    stakeholders: true,
    feedbackMatrix: true,
    versionHistory: true,
    decisionLogs: true,
    workshopEvidence: true,
  })

  const { data: documents } = trpc.document.list.useQuery()

  // Auto-select first policy when the document list loads so the Export Pack
  // button becomes enabled immediately. Keeps the one-click path fast for
  // auditors who almost always export the most-recent policy.
  useEffect(() => {
    if (!policyId && documents && documents.length > 0) {
      setPolicyId(documents[0].id)
    }
  }, [documents, policyId])

  const requestExport = trpc.evidence.requestExport.useMutation()

  // Derive UI state from the mutation hook so that a parent-provided mock
  // (in tests) or a real server response both drive the same render path.
  const exportState: ExportState = requestExport.isSuccess
    ? 'queued'
    : requestExport.isError
      ? 'error'
      : 'idle'

  const errorMessage =
    requestExport.error?.message ?? 'Export failed. Check your connection and try again.'

  // Fire the success toast exactly once per successful mutation (not on every
  // render while the hook remains in the success state).
  useEffect(() => {
    if (requestExport.isSuccess && !toastFired) {
      toast.success('Your pack is being generated, you will get an email when ready')
      setToastFired(true)
    }
    if (!requestExport.isSuccess && toastFired) {
      setToastFired(false)
    }
  }, [requestExport.isSuccess, toastFired])

  const handleExport = useCallback(() => {
    if (!policyId) return
    // H1: forward the checkbox state so the Inngest function builds only
    // the selected sections. Map the UI keys to the wire contract.
    requestExport.mutate({
      documentId: policyId,
      sections: {
        stakeholders: checklist.stakeholders,
        feedback:     checklist.feedbackMatrix,
        versions:     checklist.versionHistory,
        decisions:    checklist.decisionLogs,
        workshops:    checklist.workshopEvidence,
      },
    })
  }, [policyId, checklist, requestExport])

  const handleRetry = useCallback(() => {
    requestExport.reset()
  }, [requestExport])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setPolicyId('')
      setToastFired(false)
      requestExport.reset()
      setChecklist({
        stakeholders: true,
        feedbackMatrix: true,
        versionHistory: true,
        decisionLogs: true,
        workshopEvidence: true,
      })
    }
  }, [requestExport])

  const isSubmitting = requestExport.isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger !== undefined
            ? (trigger as ReactElement)
            : (
              <Button size="sm">
                <FileArchive className="size-4" />
                Export Evidence Pack
              </Button>
            )
        }
      />
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Export Evidence Pack</DialogTitle>
          <DialogDescription>
            Request a structured ZIP of all governance evidence for milestone review.
            You will receive an email with a 24-hour download link when the pack is ready.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Policy</label>
            <Select value={policyId} onValueChange={(v) => setPolicyId(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a policy" />
              </SelectTrigger>
              <SelectContent>
                {(documents ?? []).map((doc: { id: string; title: string }) => (
                  <SelectItem key={doc.id} value={doc.id}>
                    {doc.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Contents</label>
            <div className="space-y-2">
              {[
                { key: 'stakeholders' as const, label: 'Stakeholder list' },
                { key: 'feedbackMatrix' as const, label: 'Feedback matrix' },
                { key: 'versionHistory' as const, label: 'Version history' },
                { key: 'decisionLogs' as const, label: 'Decision logs' },
                { key: 'workshopEvidence' as const, label: 'Workshop evidence (recordings, screenshots, attachments)' },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={checklist[item.key]}
                    onCheckedChange={(checked) =>
                      setChecklist((prev) => ({ ...prev, [item.key]: !!checked }))
                    }
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </div>

          {exportState === 'queued' && (
            <div className="flex items-start gap-2 rounded-md bg-muted p-3">
              <CheckCircle className="mt-0.5 size-5 text-green-600" />
              <div className="flex-1 text-sm">
                <p className="font-medium">Your pack is being generated.</p>
                <p className="text-muted-foreground">
                  You will get an email when ready. You can safely close this dialog.
                </p>
              </div>
            </div>
          )}

          {exportState === 'error' && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3">
                <AlertCircle className="mt-0.5 size-5 text-destructive" />
                <p className="flex-1 text-sm text-destructive">{errorMessage}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                Retry
              </Button>
            </div>
          )}
        </div>

        {exportState === 'idle' && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!policyId || isSubmitting}
              onClick={handleExport}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Requesting...
                </>
              ) : (
                'Export Pack'
              )}
            </Button>
          </DialogFooter>
        )}

        {exportState === 'queued' && (
          <DialogFooter>
            <Button onClick={() => handleOpenChange(false)}>Close</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
