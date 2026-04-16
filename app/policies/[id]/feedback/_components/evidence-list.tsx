'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { trpc } from '@/src/trpc/client'
import { Paperclip, Link2, Download, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { EvidenceAttachment } from './evidence-attachment'

interface EvidenceListProps {
  feedbackId: string
  canAdd: boolean
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function EvidenceList({ feedbackId, canAdd }: EvidenceListProps) {
  const [showAttachment, setShowAttachment] = useState(false)

  const evidenceQuery = trpc.evidence.listByFeedback.useQuery({ feedbackId })
  const utils = trpc.useUtils()

  const evidence = evidenceQuery.data ?? []

  function handleAttached() {
    utils.evidence.listByFeedback.invalidate({ feedbackId })
    setShowAttachment(false)
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
        Evidence
      </h3>

      {evidence.length === 0 && !showAttachment ? (
        <p className="text-sm text-muted-foreground">No evidence attached.</p>
      ) : (
        <div className="space-y-2">
          {evidence.map((item) => {
            const uploaderName = item.uploaderName ?? 'Unknown'
            const relativeTime = item.createdAt
              ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })
              : null

            const icon =
              item.type === 'file' ? (
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <Link2 className="size-4 shrink-0 text-muted-foreground" />
              )

            return (
              <div
                key={item.id}
                className="flex gap-2 rounded-md bg-muted p-2 px-3"
              >
                <div className="mt-0.5">{icon}</div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  {/* Title row with type badge */}
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      {item.type === 'file'
                        ? (item.fileName ?? item.title)
                        : (item.title || item.url)}
                    </span>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {item.type === 'file' ? 'File' : 'Link'}
                    </Badge>
                  </div>
                  {/* Uploader + timestamp metadata row */}
                  <div className="text-xs text-muted-foreground">
                    <span>Uploaded by {uploaderName}</span>
                    {relativeTime && (
                      <>
                        <span className="mx-1">&middot;</span>
                        <time dateTime={item.createdAt as string}>{relativeTime}</time>
                      </>
                    )}
                  </div>
                  {/* File metadata row (file type only) */}
                  {item.type === 'file' && (item.fileName || item.fileSize !== null) && (
                    <div className="text-xs text-muted-foreground">
                      {item.fileName && <span>{item.fileName}</span>}
                      {item.fileName && item.fileSize !== null && (
                        <span className="mx-1">&middot;</span>
                      )}
                      {item.fileSize !== null && <span>{formatFileSize(item.fileSize)}</span>}
                    </div>
                  )}
                </div>
                {/* Action button */}
                {item.type === 'file' ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Download ${item.fileName ?? item.title}`}
                    render={<a href={item.url} download target="_blank" rel="noopener" />}
                  >
                    <Download className="size-3.5" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Open ${item.title || item.url}`}
                    render={<a href={item.url} target="_blank" rel="noopener" />}
                  >
                    <ExternalLink className="size-3.5" />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {canAdd && !showAttachment && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAttachment(true)}
        >
          <Paperclip className="size-3.5" />
          Add Evidence
        </Button>
      )}

      {showAttachment && (
        <EvidenceAttachment
          feedbackId={feedbackId}
          onAttached={handleAttached}
        />
      )}
    </div>
  )
}
