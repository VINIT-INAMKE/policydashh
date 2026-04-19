'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/**
 * LinkedSectionRow — Phase 27 Plan 05 (RESEARCH-08 D-07).
 *
 * Renders a single section link row on the research detail page with an
 * inline relevanceNote editor: clicking the note text (or the "Add a
 * relevance note for this section (optional)" placeholder) swaps to a
 * Textarea + Save / Cancel buttons.
 *
 * Persistence leverages Plan 27-01's conditional onConflictDoUpdate on
 * the linkSection mutation: when relevanceNote !== undefined, the
 * mutation upserts the note onto the existing link row; when omitted,
 * stays onConflictDoNothing for idempotent bulk-link.
 *
 * Unlink button (X icon) deletes the link via trpc.research.unlinkSection
 * and invalidates utils.research.getById so the list re-renders.
 */

export interface LinkedSectionRowProps {
  researchItemId: string
  sectionId: string
  sectionTitle: string
  documentId: string
  documentTitle: string
  relevanceNote: string | null
  canEdit: boolean
}

export function LinkedSectionRow({
  researchItemId,
  sectionId,
  sectionTitle,
  documentId,
  documentTitle,
  relevanceNote,
  canEdit,
}: LinkedSectionRowProps) {
  const utils = trpc.useUtils()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(relevanceNote ?? '')

  const upsertMutation = trpc.research.linkSection.useMutation({
    onSuccess: () => {
      toast.success('Note saved.')
      utils.research.getById.invalidate({ id: researchItemId })
      setEditing(false)
    },
    onError: (err) =>
      toast.error(err.message || "Couldn't save the note. Try again."),
  })

  const unlinkMutation = trpc.research.unlinkSection.useMutation({
    onSuccess: () => {
      toast.success('Section unlinked.')
      utils.research.getById.invalidate({ id: researchItemId })
    },
    onError: (err) =>
      toast.error(err.message || "Couldn't unlink. Try again."),
  })

  return (
    <div className="space-y-1.5 rounded-md border p-3">
      <div className="flex items-start gap-2">
        <Link
          href={`/policies/${documentId}`}
          className="block min-w-0 flex-1 hover:underline"
        >
          <p className="truncate text-sm font-medium">{sectionTitle}</p>
          <p className="truncate text-xs text-muted-foreground">
            {documentTitle}
          </p>
        </Link>
        {canEdit && (
          <Tooltip>
            <TooltipTrigger
              render={(props) => (
                <Button
                  {...props}
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remove link"
                  onClick={() =>
                    unlinkMutation.mutate({ researchItemId, sectionId })
                  }
                >
                  <X className="size-3" />
                </Button>
              )}
            />
            <TooltipContent>Remove link</TooltipContent>
          </Tooltip>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Why does this research inform this section?"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={upsertMutation.isPending}
              onClick={() =>
                upsertMutation.mutate({
                  researchItemId,
                  sectionId,
                  relevanceNote: draft.trim(),
                })
              }
            >
              Save note
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(relevanceNote ?? '')
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : canEdit ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="block w-full text-left text-xs text-muted-foreground hover:text-foreground"
        >
          {relevanceNote || 'Add a relevance note for this section (optional)'}
        </button>
      ) : (
        relevanceNote && (
          <p className="text-xs text-muted-foreground">{relevanceNote}</p>
        )
      )}
    </div>
  )
}
