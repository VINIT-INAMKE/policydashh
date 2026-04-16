'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/src/trpc/client'
import { parseMarkdown, type ParsedDocument } from '@/src/lib/markdown-import'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, FileText, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

interface ImportMarkdownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportMarkdownDialog({ open, onOpenChange }: ImportMarkdownDialogProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const utils = trpc.useUtils()

  const [step, setStep] = useState<1 | 2>(1)
  const [file, setFile] = useState<File | null>(null)
  const [parsedResult, setParsedResult] = useState<ParsedDocument | null>(null)
  const [editableTitle, setEditableTitle] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  function resetState() {
    setStep(1)
    setFile(null)
    setParsedResult(null)
    setEditableTitle('')
    setIsDragOver(false)
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      resetState()
    }
    onOpenChange(value)
  }

  function validateAndSetFile(selectedFile: File) {
    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error('This file is too large. The maximum file size is 5 MB.')
      return
    }
    setFile(selectedFile)
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      validateAndSetFile(selectedFile)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      validateAndSetFile(droppedFile)
    }
  }

  function handleRemoveFile() {
    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handlePreviewImport = useCallback(() => {
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      try {
        const result = parseMarkdown(text, file.name)
        setParsedResult(result)
        setEditableTitle(result.title)
        setStep(2)
      } catch {
        toast.error("Couldn't parse the markdown file. Make sure it's a valid .md file and try again.")
      }
    }
    reader.onerror = () => {
      toast.error("Couldn't parse the markdown file. Make sure it's a valid .md file and try again.")
    }
    reader.readAsText(file)
  }, [file])

  const importMutation = trpc.document.importDocument.useMutation({
    onSuccess: (data) => {
      const sectionCount = data.sections.length
      utils.document.list.invalidate()
      toast.success(`Policy imported with ${sectionCount} sections.`)
      handleOpenChange(false)
      router.push(`/policies/${data.document.id}`)
    },
    onError: () => {
      toast.error("Couldn't parse the markdown file. Make sure it's a valid .md file and try again.")
    },
  })

  function handleConfirmImport() {
    if (!parsedResult) return

    importMutation.mutate({
      title: editableTitle.trim(),
      sections: parsedResult.sections.map((s) => ({
        title: s.title,
        content: s.content,
      })),
    })
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[560px]">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Import from Markdown</DialogTitle>
              <DialogDescription>
                Upload a markdown file to create a new policy document. Headings (## H2) will be
                used to split the content into sections.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {!file ? (
                <div
                  role="button"
                  aria-label="Upload markdown file"
                  tabIndex={0}
                  className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                    isDragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Drag and drop a .md file here, or click to browse
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="shrink-0 rounded-md p-1 hover:bg-muted"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown,text/markdown"
                onChange={handleFileInputChange}
                className="hidden"
                aria-hidden="true"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Discard
              </Button>
              <Button onClick={handlePreviewImport} disabled={!file}>
                Preview Import
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Preview Import</DialogTitle>
              <DialogDescription>
                Review the detected structure before importing.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="import-policy-title">Policy Title</Label>
                <Input
                  id="import-policy-title"
                  value={editableTitle}
                  onChange={(e) => setEditableTitle(e.target.value)}
                  maxLength={200}
                  className="mt-2"
                />
              </div>

              {parsedResult && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    {parsedResult.sections.length} sections detected
                  </p>

                  {parsedResult.sections.length === 0 ? (
                    <p className="mt-2 text-sm text-destructive">
                      No sections detected. Make sure your markdown uses ## headings to define
                      sections.
                    </p>
                  ) : (
                    <div className="mt-2 max-h-[300px] space-y-2 overflow-y-auto">
                      {parsedResult.sections.map((section, index) => {
                        const contentPreview = extractContentPreview(section.content)
                        return (
                          <div
                            key={index}
                            className="rounded-md border p-2"
                          >
                            <p className="text-sm">
                              {index + 1}. {section.title}
                            </p>
                            {contentPreview && (
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {contentPreview}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={
                  !editableTitle.trim() ||
                  !parsedResult ||
                  parsedResult.sections.length === 0 ||
                  importMutation.isPending
                }
              >
                {importMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Import Policy
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Extract plain text preview from Tiptap JSON content for display in the section list.
 */
function extractContentPreview(content: Record<string, unknown>): string {
  const doc = content as { type?: string; content?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }
  if (!doc.content || !Array.isArray(doc.content)) return ''

  const texts: string[] = []
  for (const node of doc.content) {
    if (node.type === 'paragraph' && Array.isArray(node.content)) {
      for (const child of node.content) {
        if (child.type === 'text' && typeof child.text === 'string') {
          texts.push(child.text)
        }
      }
    }
  }
  return texts.join(' ').substring(0, 200)
}
