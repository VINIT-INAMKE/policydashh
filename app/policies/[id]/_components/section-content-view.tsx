'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Pencil,
  Check,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
} from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { SectionAssignments } from './section-assignments'

// Dynamic import with SSR disabled -- DragHandle causes hydration issues
const BlockEditor = dynamic(() => import('./block-editor'), { ssr: false })
const ReadOnlyEditor = dynamic(() => import('./read-only-editor'), { ssr: false })

interface Section {
  id: string
  title: string
  content: Record<string, unknown> | null
  updatedAt: string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface SectionContentViewProps {
  section: Section
  canEdit: boolean
  documentId: string
}

export function SectionContentView({
  section,
  canEdit,
  documentId,
}: SectionContentViewProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const router = useRouter()
  const meQuery = trpc.user.getMe.useQuery()
  const role = meQuery.data?.role
  // feedback:submit permission (src/lib/permissions.ts) is granted to:
  // stakeholder, research_lead, workshop_moderator.
  // Admin and policy_lead do NOT have this permission.
  const canSubmitFeedback =
    role === 'stakeholder' ||
    role === 'research_lead' ||
    role === 'workshop_moderator'

  const handleSaveStateChange = useCallback((state: SaveState) => {
    setSaveState(state)
  }, [])

  const isEmpty =
    !section.content ||
    (typeof section.content === 'object' &&
      (!('content' in section.content) ||
        (Array.isArray((section.content as { content?: unknown[] }).content) &&
          ((section.content as { content: unknown[] }).content).length === 0)))

  return (
    <div>
      {/* Section header with edit toggle */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold leading-[1.2]">{section.title}</h2>

        <div className="flex items-center gap-2">
          {/* Auto-save indicator */}
          {isEditing && saveState === 'saving' && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Saving...
            </span>
          )}
          {isEditing && saveState === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3" />
              Saved
            </span>
          )}
          {isEditing && saveState === 'error' && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="size-3" />
              Error saving
            </span>
          )}

          {/* Edit / Save toggle */}
          {canEdit && !isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="mr-1 size-3.5" />
              Edit section
            </Button>
          )}
          {canEdit && isEditing && (
            <Button size="sm" onClick={() => setIsEditing(false)}>
              <Check className="mr-1 size-3.5" />
              Save changes
            </Button>
          )}
        </div>
      </div>

      {/* Section assignments -- visible to Policy Lead / Admin */}
      {canEdit && (
        <div className="mt-4 rounded-md border p-3">
          <SectionAssignments sectionId={section.id} />
        </div>
      )}

      {/* Content area -- no max-width here so CommentPanel can expand into flex layout */}
      {canEdit && isEditing ? (
        <div className="mt-4 overflow-visible">
          <BlockEditor
            section={{ ...section, documentId }}
            onSaveStateChange={handleSaveStateChange}
          />
        </div>
      ) : (
        <div className="mt-4">
          {isEmpty ? (
            <p className="text-sm text-muted-foreground">
              This section has no content yet.{' '}
              {canEdit ? 'Click "Edit section" to start writing.' : ''}
            </p>
          ) : (
            <ReadOnlyEditor content={section.content} />
          )}
        </div>
      )}

      {/* D-12: Give Feedback CTA -- visible only to roles with feedback:submit */}
      {canSubmitFeedback && !isEditing && (
        <div className="mt-6 flex w-full justify-end sm:w-auto">
          <Button
            variant="default"
            size="default"
            className="w-full sm:w-auto"
            onClick={() =>
              router.push(
                `/policies/${documentId}/sections/${section.id}/feedback/new`,
              )
            }
          >
            <MessageSquare className="mr-2 h-4 w-4" aria-hidden="true" />
            Give Feedback
          </Button>
        </div>
      )}
    </div>
  )
}
