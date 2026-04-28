'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Pencil, Sparkles, MessageSquare, X } from 'lucide-react'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { SectionSidebar } from './_components/section-sidebar'
import { SectionContentView } from './_components/section-content-view'
import { PublicDraftToggle } from './_components/public-draft-toggle'
import { EditPolicyDialog } from '../_components/edit-policy-dialog'

export default function PolicyDetailPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const id = params.id
  const initialSection = searchParams.get('section')
  // ?fromFeedback=<feedbackId> is set when the user clicks "Edit section"
  // on a feedback detail page. We surface a context banner above the
  // editor and auto-open the editor for that section.
  const fromFeedbackId = searchParams.get('fromFeedback')

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(initialSection)
  const [editOpen, setEditOpen] = useState(false)
  // The banner can be dismissed locally (e.g. user wants to keep the
  // section in view but is done addressing the feedback). We don't
  // persist this — refreshing the page with the param brings it back.
  const [feedbackBannerDismissed, setFeedbackBannerDismissed] = useState(false)

  const documentQuery = trpc.document.getById.useQuery({ id })
  const sectionsQuery = trpc.document.getSections.useQuery({ documentId: id })
  const { data: me } = trpc.user.getMe.useQuery()

  const role = me?.role
  const canEdit = role === 'admin' || role === 'policy_lead'

  // Draft state for editors only — readers don't need to see this.
  const draftStatusQuery = trpc.document.getDraftStatus.useQuery(
    { documentId: id },
    { enabled: canEdit },
  )

  // Load feedback context when fromFeedback is set so the banner shows
  // the title + body verbatim rather than a generic "you came from
  // feedback" string. Disabled when the param isn't present.
  const fromFeedbackQuery = trpc.feedback.getById.useQuery(
    fromFeedbackId
      ? { id: fromFeedbackId, documentId: id }
      : { id: '00000000-0000-0000-0000-000000000000', documentId: id },
    { enabled: !!fromFeedbackId && canEdit },
  )

  const selectedSection = sectionsQuery.data?.find((s) => s.id === selectedSectionId) ?? null

  if (documentQuery.isLoading || sectionsQuery.isLoading) {
    return (
      <div className="flex h-full">
        {/* Sidebar skeleton */}
        <div className="w-[280px] shrink-0 border-r bg-muted p-4">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
        {/* Content skeleton */}
        <div className="flex-1 p-8">
          <div className="mx-auto max-w-[768px]">
            <Skeleton className="mb-4 h-7 w-1/2" />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (documentQuery.error || !documentQuery.data) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Document not found.</p>
      </div>
    )
  }

  const document = documentQuery.data

  return (
    <div className="flex h-full">
      {/* Section sidebar */}
      <div className="hidden w-[280px] shrink-0 border-r bg-muted lg:block">
        <SectionSidebar
          sections={sectionsQuery.data ?? []}
          documentId={id}
          selectedSectionId={selectedSectionId}
          onSelectSection={setSelectedSectionId}
          canManageSections={canEdit}
        />
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[768px] p-6 lg:p-8">
          {/* Top bar */}
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[28px] font-semibold leading-[1.2]">{document.title}</h1>
                {document.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{document.description}</p>
                )}
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-1 h-4 w-4" />
                  Edit
                </Button>
              )}
            </div>
            {canEdit && (
              <div className="mt-4">
                <PublicDraftToggle
                  documentId={id}
                  isPublicDraft={document.isPublicDraft ?? false}
                />
              </div>
            )}

            {/* Draft state indicator — editors only. Tells the lead that
                the live working copy has unpublished changes, and links
                them to the version history where they can cut + publish
                a new snapshot. */}
            {canEdit && draftStatusQuery.data && (
              <DraftStatusPill
                hasUnpublishedChanges={draftStatusQuery.data.hasUnpublishedChanges}
                latestPublished={draftStatusQuery.data.latestPublished}
                documentId={id}
              />
            )}
          </div>

          {/* Feedback context banner — set when navigating from
              /feedback/[id]'s "Edit section" button. Shows verbatim
              feedback so the lead has the original ask in view while
              editing. Dismissable; reload re-shows it. */}
          {canEdit &&
            fromFeedbackId &&
            !feedbackBannerDismissed &&
            fromFeedbackQuery.data && (
              <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <MessageSquare
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          Editing in response to feedback
                        </p>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {fromFeedbackQuery.data.readableId}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">
                        {fromFeedbackQuery.data.title}
                      </p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {fromFeedbackQuery.data.body}
                      </p>
                      <Link
                        href={`/policies/${id}/feedback/${fromFeedbackId}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        View full feedback →
                      </Link>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFeedbackBannerDismissed(true)}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Dismiss feedback context"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

          {/* Mobile section selector (visible below lg breakpoint) */}
          {(sectionsQuery.data ?? []).length > 0 && (
            <div className="mb-4 lg:hidden">
              <Select
                value={selectedSectionId ?? ''}
                onValueChange={(val) => setSelectedSectionId(val || null)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a section..." />
                </SelectTrigger>
                <SelectContent>
                  {(sectionsQuery.data ?? []).map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Section content or empty prompt */}
          {selectedSection ? (
            <SectionContentView
              section={selectedSection}
              canEdit={canEdit}
              documentId={id}
              autoEnterEditMode={!!fromFeedbackId}
            />
          ) : (
            <div className="flex items-center justify-center py-24">
              <p className="text-sm text-muted-foreground">
                Select a section from the sidebar to view its content.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit dialog */}
      {canEdit && (
        <EditPolicyDialog
          policy={{
            id: document.id,
            title: document.title,
            description: document.description,
          }}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </div>
  )
}

interface DraftStatusPillProps {
  hasUnpublishedChanges: boolean
  latestPublished: {
    id: string
    versionLabel: string
    publishedAt: Date | string | null
  } | null
  documentId: string
}

function DraftStatusPill({
  hasUnpublishedChanges,
  latestPublished,
  documentId,
}: DraftStatusPillProps) {
  // No published version yet → everything in policy_sections is the
  // initial draft; keep the messaging soft so it doesn't feel like an
  // error state.
  if (!latestPublished) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Initial draft. Cut a version to make this readable to stakeholders.</span>
        <Link
          href={`/policies/${documentId}/versions`}
          className="font-medium text-primary hover:underline"
        >
          Versions →
        </Link>
      </div>
    )
  }

  // Published baseline exists. Either we're caught up (no draft work
  // since the last publish) or there are unpublished edits in the
  // working copy that readers haven't seen yet.
  if (!hasUnpublishedChanges) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        <span>
          Live: {latestPublished.versionLabel}. No unpublished changes.
        </span>
      </div>
    )
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
      <span className="text-muted-foreground">
        Draft changes since {latestPublished.versionLabel}.
      </span>
      <Link
        href={`/policies/${documentId}/versions`}
        className="font-medium text-primary hover:underline"
      >
        Publish a new version →
      </Link>
    </div>
  )
}
