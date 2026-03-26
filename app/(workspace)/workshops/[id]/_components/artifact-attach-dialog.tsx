'use client'
import { useState, useRef } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { useUploadThing } from '@/src/lib/uploadthing'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

const ARTIFACT_TYPES = ['promo', 'recording', 'summary', 'attendance', 'other'] as const
type ArtifactType = (typeof ARTIFACT_TYPES)[number]
const TYPE_LABELS: Record<ArtifactType, string> = {
  promo: 'Promotional Material',
  recording: 'Recording',
  summary: 'Session Summary',
  attendance: 'Attendance Record',
  other: 'Other',
}

interface ArtifactAttachDialogProps {
  workshopId: string
}

export function ArtifactAttachDialog({ workshopId }: ArtifactAttachDialogProps) {
  const [open, setOpen] = useState(false)
  const [artifactType, setArtifactType] = useState<ArtifactType>('summary')
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const utils = trpc.useUtils()

  const attachMutation = trpc.workshop.attachArtifact.useMutation({
    onSuccess: () => {
      utils.workshop.getById.invalidate({ id: workshopId })
      toast.success('Artifact attached to workshop')
      resetAndClose()
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to attach artifact')
    },
  })

  const { startUpload } = useUploadThing('evidenceUploader', {
    onClientUploadComplete: (res) => {
      if (res?.[0]) {
        attachMutation.mutate({
          workshopId,
          artifactType,
          title: title.trim() || res[0].name,
          url: res[0].ufsUrl,
          fileName: res[0].name,
        })
      }
    },
    onUploadError: (err) => {
      setUploading(false)
      toast.error(err.message || 'Upload failed')
    },
  })

  function resetAndClose() {
    setOpen(false)
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
    await startUpload([file])
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); else setOpen(true) }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload className="mr-1 h-4 w-4" />
          Attach Artifact
        </Button>
      </DialogTrigger>
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
