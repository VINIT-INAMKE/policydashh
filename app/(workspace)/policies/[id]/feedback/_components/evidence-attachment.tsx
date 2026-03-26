'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { trpc } from '@/src/trpc/client'
import { uploadFile } from '@/src/lib/uploadthing'
import { toast } from 'sonner'
import { Paperclip, Link2, X, Loader2 } from 'lucide-react'

interface EvidenceAttachmentProps {
  feedbackId?: string
  sectionId?: string
  onAttached: () => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface UploadedFile {
  id: string
  name: string
  size: number
  url: string
}

export function EvidenceAttachment({
  feedbackId,
  sectionId,
  onAttached,
}: EvidenceAttachmentProps) {
  // File upload state
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Link state
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [addedLinks, setAddedLinks] = useState<{ id: string; label: string; url: string }[]>([])

  const attachMutation = trpc.evidence.attach.useMutation({
    onSuccess: () => {
      toast.success('Evidence added.')
      onAttached()
    },
    onError: () => {
      toast.error("Couldn't upload the file. Maximum file size is 25 MB.")
    },
  })

  const removeMutation = trpc.evidence.remove.useMutation({
    onSuccess: () => {
      onAttached()
    },
  })

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setIsUploading(true)
      setUploadProgress(0)

      try {
        const file = files[0]
        const result = await uploadFile(file, {
          category: 'evidence',
          onProgress: (p) => setUploadProgress(p),
        })
        setIsUploading(false)
        setUploadProgress(0)
        attachMutation.mutate({
          title: result.name,
          type: 'file',
          url: result.url,
          fileName: result.name,
          fileSize: file.size,
          ...(feedbackId ? { feedbackId } : {}),
          ...(sectionId ? { sectionId } : {}),
        })
        setUploadedFiles((prev) => [
          ...prev,
          { id: crypto.randomUUID(), name: result.name, size: file.size, url: result.url },
        ])
      } catch {
        setIsUploading(false)
        setUploadProgress(0)
        toast.error("Couldn't upload the file. Maximum file size is 25 MB.")
      }
    },
    [attachMutation, feedbackId, sectionId],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      handleFileSelect(e.dataTransfer.files)
    },
    [handleFileSelect],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  function isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  function handleAddLink() {
    if (!isValidUrl(linkUrl)) {
      toast.error('Enter a valid URL starting with https://')
      return
    }

    attachMutation.mutate({
      title: linkLabel.trim() || linkUrl,
      type: 'link',
      url: linkUrl,
      ...(feedbackId ? { feedbackId } : {}),
      ...(sectionId ? { sectionId } : {}),
    })

    setAddedLinks((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: linkLabel.trim() || linkUrl, url: linkUrl },
    ])
    setLinkUrl('')
    setLinkLabel('')
  }

  function handleRemoveFile(fileId: string, artifactId?: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId))
    if (artifactId) {
      removeMutation.mutate({ artifactId })
    }
  }

  function handleRemoveLink(linkId: string, artifactId?: string) {
    setAddedLinks((prev) => prev.filter((l) => l.id !== linkId))
    if (artifactId) {
      removeMutation.mutate({ artifactId })
    }
  }

  return (
    <Tabs defaultValue="upload" className="w-full">
      <TabsList>
        <TabsTrigger value="upload">Upload File</TabsTrigger>
        <TabsTrigger value="link">Add Link</TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="space-y-3 pt-3">
        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          className={`flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-muted-foreground/50'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
        >
          <Paperclip className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drag and drop a file here, or click to browse. Max 25 MB.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />

        {/* Upload progress */}
        {isUploading && (
          <Progress value={uploadProgress} className="h-1" />
        )}

        {/* Uploaded files */}
        {uploadedFiles.map((file) => (
          <div
            key={file.id}
            className="flex items-center gap-2 rounded-md bg-muted p-2 px-3"
          >
            <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="max-w-[200px] truncate text-sm font-semibold">
              {file.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="ml-auto"
              onClick={() => handleRemoveFile(file.id)}
            >
              <X className="size-3" />
            </Button>
          </div>
        ))}
      </TabsContent>

      <TabsContent value="link" className="space-y-3 pt-3">
        {/* URL input */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="evidence-url">Evidence URL</Label>
          <Input
            id="evidence-url"
            type="url"
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        </div>

        {/* Label input */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="evidence-label">Link Label (optional)</Label>
          <Input
            id="evidence-label"
            placeholder="e.g., Supporting research paper"
            maxLength={100}
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
          />
        </div>

        {/* Add Link button */}
        <Button
          variant="outline"
          size="sm"
          disabled={!linkUrl || !isValidUrl(linkUrl) || attachMutation.isPending}
          onClick={handleAddLink}
        >
          {attachMutation.isPending && (
            <Loader2 className="size-3.5 animate-spin" />
          )}
          Add Link
        </Button>

        {/* Added links */}
        {addedLinks.map((link) => (
          <div
            key={link.id}
            className="flex items-center gap-2 rounded-md bg-muted p-2 px-3"
          >
            <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-sm">
              {link.label}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="ml-auto"
              onClick={() => handleRemoveLink(link.id)}
            >
              <X className="size-3" />
            </Button>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  )
}
