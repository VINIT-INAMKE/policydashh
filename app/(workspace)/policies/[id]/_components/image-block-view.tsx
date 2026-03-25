'use client'

import { useState, useCallback, useRef } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { ImageIcon, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useUploadThing } from '@/src/lib/uploadthing'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

type UploadState = 'idle' | 'uploading' | 'uploaded' | 'error'

export function ImageBlockView({ node, updateAttributes }: NodeViewProps) {
  const src = node.attrs.src as string | null
  const alt = node.attrs.alt as string | null
  const caption = node.attrs.title as string | null

  const [uploadState, setUploadState] = useState<UploadState>(
    src ? 'uploaded' : 'idle',
  )
  const [progress, setProgress] = useState(0)
  const [isDragOver, setIsDragOver] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { startUpload } = useUploadThing('imageUploader', {
    onUploadProgress: (p) => setProgress(p),
    onClientUploadComplete: (res) => {
      if (res?.[0]) {
        updateAttributes({
          src: res[0].ufsUrl ?? res[0].url,
          alt: alt || res[0].name,
        })
        setUploadState('uploaded')
      }
    },
    onUploadError: (error) => {
      setUploadState('error')
      setErrorMsg(
        "Couldn't upload the image. Maximum file size is 10 MB. Try a JPEG or PNG.",
      )
      toast.error(
        "Couldn't upload the image. Maximum file size is 10 MB. Try a JPEG or PNG.",
      )
    },
  })

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const file = files[0]
      if (!file) return

      if (file.size > MAX_FILE_SIZE) {
        setUploadState('error')
        setErrorMsg(
          "Couldn't upload the image. Maximum file size is 10 MB. Try a JPEG or PNG.",
        )
        toast.error(
          "Couldn't upload the image. Maximum file size is 10 MB. Try a JPEG or PNG.",
        )
        return
      }

      if (!file.type.startsWith('image/')) {
        setUploadState('error')
        setErrorMsg(
          "Couldn't upload the image. Maximum file size is 10 MB. Try a JPEG or PNG.",
        )
        toast.error('Please select an image file.')
        return
      }

      setUploadState('uploading')
      setProgress(0)
      setErrorMsg(null)
      startUpload([file])
    },
    [startUpload],
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
    <NodeViewWrapper data-type="image-block">
      {uploadState === 'idle' && (
        <div
          className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed transition-colors ${
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
          aria-label="Upload image"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleClick()
          }}
        >
          <ImageIcon className="mb-2 size-8 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Drop image here or click to upload
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {uploadState === 'uploading' && (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-md border border-border bg-muted">
          <div className="w-full max-w-[300px] px-4">
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted-foreground/20">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="mt-2 block text-center text-xs text-muted-foreground">
              {progress}%
            </span>
          </div>
        </div>
      )}

      {uploadState === 'uploaded' && src && (
        <div className="flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt || ''}
            className="max-w-full rounded-md border border-border"
          />
          {!alt && (
            <span className="mt-1 flex items-center gap-1 text-xs text-amber-600">
              <AlertTriangle className="size-3" />
              Missing alt text
            </span>
          )}
          <span
            contentEditable
            suppressContentEditableWarning
            className="mt-1 text-center text-xs italic text-muted-foreground outline-none empty:before:content-[attr(data-placeholder)]"
            data-placeholder="Add a caption..."
            onBlur={(e) =>
              updateAttributes({ title: e.currentTarget.textContent || '' })
            }
          >
            {caption || ''}
          </span>
        </div>
      )}

      {uploadState === 'error' && (
        <div
          className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-destructive bg-background"
          onClick={handleClick}
          role="button"
          tabIndex={0}
          aria-label="Retry image upload"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleClick()
          }}
        >
          <ImageIcon className="mb-2 size-8 text-destructive" />
          <span className="text-sm text-destructive">
            {errorMsg ||
              "Couldn't upload the image. Maximum file size is 10 MB. Try a JPEG or PNG."}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}
    </NodeViewWrapper>
  )
}
