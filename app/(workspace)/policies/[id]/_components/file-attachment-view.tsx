'use client'

import { useState, useCallback, useRef } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { Paperclip, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { uploadFile } from '@/src/lib/uploadthing'

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type UploadState = 'idle' | 'uploading' | 'uploaded'

export function FileAttachmentView({ node, updateAttributes }: NodeViewProps) {
  const url = node.attrs.url as string | null
  const filename = node.attrs.filename as string | null
  const filesize = node.attrs.filesize as number | null

  const [uploadState, setUploadState] = useState<UploadState>(
    url ? 'uploaded' : 'idle',
  )
  const [progress, setProgress] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const file = files[0]
      if (!file) return

      if (file.size > MAX_FILE_SIZE) {
        toast.error("Couldn't upload the file. Maximum file size is 25 MB.")
        return
      }

      setUploadState('uploading')
      setProgress(0)

      try {
        const result = await uploadFile(file, {
          category: 'document',
          onProgress: (p) => setProgress(p),
        })
        updateAttributes({ url: result.url, filename: result.name, filesize: file.size })
        setUploadState('uploaded')
      } catch {
        setUploadState('idle')
        toast.error("Couldn't upload the file. Maximum file size is 25 MB.")
      }
    },
    [updateAttributes],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files)
      }
    },
    [handleFiles],
  )

  return (
    <NodeViewWrapper data-type="file-attachment">
      {uploadState === 'idle' && (
        <div
          className={`flex min-h-[80px] cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed transition-colors ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : 'border-border bg-background'
          }`}
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="button"
          tabIndex={0}
          aria-label="Upload file"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleClick()
          }}
        >
          <Paperclip className="mb-1 size-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Drop file here or click to attach
          </span>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {uploadState === 'uploading' && (
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted px-4 py-2">
          <Paperclip className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted-foreground/20">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Uploading... {progress}%
            </span>
          </div>
        </div>
      )}

      {uploadState === 'uploaded' && url && (
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted px-4 py-2">
          <Paperclip className="size-4 shrink-0 text-muted-foreground" />
          <span className="max-w-[200px] truncate text-sm font-semibold">
            {filename || 'File'}
          </span>
          {filesize != null && (
            <span className="text-xs text-muted-foreground">
              {formatFileSize(filesize)}
            </span>
          )}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted-foreground/10 hover:text-foreground"
            aria-label={`Download ${filename || 'file'}`}
          >
            <ExternalLink className="size-4" />
          </a>
        </div>
      )}
    </NodeViewWrapper>
  )
}
