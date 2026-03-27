'use client'

import { useState, useCallback } from 'react'
import { CheckCircle, Download, Loader2, FileArchive } from 'lucide-react'
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
import { Progress } from '@/components/ui/progress'

type ExportState = 'idle' | 'loading' | 'complete' | 'error'

export function EvidencePackDialog() {
  const [open, setOpen] = useState(false)
  const [policyId, setPolicyId] = useState('')
  const [exportState, setExportState] = useState<ExportState>('idle')
  const [progress, setProgress] = useState(0)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Checklist state (all checked by default)
  const [checklist, setChecklist] = useState({
    stakeholders: true,
    feedbackMatrix: true,
    versionHistory: true,
    decisionLogs: true,
    workshopEvidence: true,
  })

  // Fetch policy documents for the selector
  const { data: documents } = trpc.document.list.useQuery()

  const handleExport = useCallback(async () => {
    if (!policyId) return

    setExportState('loading')
    setProgress(10)
    setErrorMessage(null)

    try {
      // Simulate progress stages
      setProgress(30)
      const response = await fetch(`/api/export/evidence-pack?documentId=${policyId}`)
      setProgress(70)

      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`)
      }

      const blob = await response.blob()
      setProgress(100)

      const url = URL.createObjectURL(blob)
      setDownloadUrl(url)
      setExportState('complete')
    } catch (err) {
      setExportState('error')
      setErrorMessage(
        err instanceof Error ? err.message : 'Export failed. Check your connection and try again.'
      )
    }
  }, [policyId])

  const handleRetry = useCallback(() => {
    setExportState('idle')
    setProgress(0)
    setDownloadUrl(null)
    setErrorMessage(null)
  }, [])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      // Clean up on close
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl)
      }
      setPolicyId('')
      setExportState('idle')
      setProgress(0)
      setDownloadUrl(null)
      setErrorMessage(null)
      setChecklist({
        stakeholders: true,
        feedbackMatrix: true,
        versionHistory: true,
        decisionLogs: true,
        workshopEvidence: true,
      })
    }
  }, [downloadUrl])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm"><FileArchive className="size-4" />Export Evidence Pack</Button>} />
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Export Evidence Pack</DialogTitle>
          <DialogDescription>
            Export a structured ZIP containing all governance evidence for milestone review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Policy selector */}
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

          {/* Contents checklist */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Contents</label>
            <div className="space-y-2">
              {[
                { key: 'stakeholders' as const, label: 'Stakeholder list' },
                { key: 'feedbackMatrix' as const, label: 'Feedback matrix' },
                { key: 'versionHistory' as const, label: 'Version history' },
                { key: 'decisionLogs' as const, label: 'Decision logs' },
                { key: 'workshopEvidence' as const, label: 'Workshop evidence (if any)' },
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

          {/* Progress/Status area */}
          {exportState === 'loading' && (
            <div className="space-y-2">
              <Progress
                value={progress}
                aria-label="Evidence pack generation progress"
              />
              <p className="text-sm text-muted-foreground">Preparing evidence pack...</p>
            </div>
          )}

          {exportState === 'complete' && downloadUrl && (
            <div className="flex items-center gap-2 rounded-md bg-muted p-3">
              <CheckCircle className="size-5 text-green-600" />
              <span className="flex-1 text-sm font-medium">Evidence pack ready.</span>
              <a
                href={downloadUrl}
                download={`evidence-pack-${policyId}.zip`}
                className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                <Download className="size-3.5" />
                Download ZIP
              </a>
            </div>
          )}

          {exportState === 'error' && (
            <div className="space-y-2">
              <p className="text-sm text-destructive">
                {errorMessage || 'Export failed. Check your connection and try again.'}
              </p>
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
              disabled={!policyId}
              onClick={handleExport}
            >
              Export ZIP
            </Button>
          </DialogFooter>
        )}

        {exportState === 'loading' && (
          <DialogFooter>
            <Button disabled>
              <Loader2 className="size-4 animate-spin" />
              Exporting...
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
