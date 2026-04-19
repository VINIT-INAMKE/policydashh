'use client'
import { useState, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { uploadFile } from '@/src/lib/r2-upload'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

// F30: include the dedicated 'transcript' type so moderators can attach a
// raw transcript independently from a polished summary.
const ARTIFACT_TYPES = ['promo', 'recording', 'transcript', 'summary', 'attendance', 'other'] as const
type ArtifactType = (typeof ARTIFACT_TYPES)[number]
const TYPE_LABELS: Record<ArtifactType, string> = {
  promo: 'Promotional Material',
  recording: 'Recording',
  transcript: 'Transcript',
  summary: 'Session Summary',
  attendance: 'Attendance Record',
  other: 'Other',
}

export interface ArtifactAttachDialogProps {
  workshopId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ArtifactAttachDialog({ workshopId, open, onOpenChange }: ArtifactAttachDialogProps) {
  const [artifactType, setArtifactType] = useState<ArtifactType>('summary')
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const utils = trpc.useUtils()

  const attachMutation = trpc.workshop.attachArtifact.useMutation({
    onSuccess: () => {
      utils.workshop.getById.invalidate({ workshopId })
      toast.success('Artifact attached to workshop')
      resetAndClose()
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to attach artifact')
    },
  })

  function resetAndClose() {
    onOpenChange(false)
    setTitle('')
    setArtifactType('summary')
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      toast.error('Please select a file')
      return
    }
    setUploading(true)
    try {
      const result = await uploadFile(file, { category: 'evidence' })
      // F19: pass r2Key so the recording pipeline (WS-14 Inngest function)
      // can resolve a fresh presigned GET and pass the audio to Groq
      // Whisper. Without r2Key, the transcription step silently no-ops
      // because the public URL is not usable for programmatic fetch.
      attachMutation.mutate({
        workshopId,
        artifactType,
        title: title.trim() || result.name,
        type: 'file',
        url: result.url,
        fileName: result.name,
        fileSize: file.size,
        r2Key: result.key,
      })
    } catch (err) {
      setUploading(false)
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); else onOpenChange(true) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Attach Workshop Artifact</DialogTitle>
        </DialogHeader>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Artifact Type</Label>
            <Select value={artifactType} onValueChange={(v) => setArtifactType(v as ArtifactType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ARTIFACT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Title (optional)</Label>
            <Input
              placeholder="e.g., Workshop 1 Recording"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>File</Label>
            <Input type="file" ref={fileRef} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={resetAndClose}>Discard</Button>
          <Button onClick={handleUpload} disabled={uploading || attachMutation.isPending}>
            {uploading ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              'Upload & Attach'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
