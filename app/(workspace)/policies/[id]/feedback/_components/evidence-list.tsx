'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { trpc } from '@/src/trpc/client'
import { Paperclip, Link2, Download, ExternalLink } from 'lucide-react'
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
            if (item.type === 'file') {
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-md bg-muted p-2 px-3"
                >
                  <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">
                    {item.fileName ?? item.title}
                  </span>
                  {item.fileSize !== null && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatFileSize(item.fileSize)}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Download ${item.fileName ?? item.title}`}
                    render={<a href={item.url} download target="_blank" rel="noopener" />}
                  >
                    <Download className="size-3.5" />
                  </Button>
                </div>
              )
            }

            // Link type
            return (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-md bg-muted p-2 px-3"
              >
                <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">
                  {item.title || item.url}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Open ${item.title || item.url}`}
                  render={<a href={item.url} target="_blank" rel="noopener" />}
                >
                  <ExternalLink className="size-3.5" />
                </Button>
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
