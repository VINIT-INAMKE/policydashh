'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Download, ExternalLink, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/src/trpc/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ResearchStatusBadge } from '../_components/research-status-badge'
import { ResearchDecisionLog } from './_components/research-decision-log'
import { ResearchLifecycleActions } from './_components/lifecycle-actions'
import { SectionLinkPicker } from './_components/section-link-picker'
import { VersionLinkPicker } from './_components/version-link-picker'
import { FeedbackLinkPicker } from './_components/feedback-link-picker'
import { LinkedSectionRow } from './_components/linked-section-row'
import { formatAuthorsForDisplay } from '@/src/lib/research-utils'
import { can } from '@/src/lib/permissions'
import type { Role } from '@/src/lib/constants'

/**
 * /research-manage/[id] — Phase 27 Plan 04 (RESEARCH-07) + Plan 27-05 (RESEARCH-08).
 *
 * Two-column detail page that mounts:
 *   1. Metadata header (title, status badge, readableId chip, type)
 *   2. Metadata grid (authors via shouldHideAuthors, published date, journal,
 *      DOI, peer reviewed)
 *   3. Description prose
 *   4. Artifact link OR external URL
 *   5. ResearchDecisionLog (workflow_transitions via tRPC, Plan 04 Task 1)
 *   6. Linked Sections list with inline relevanceNote editor (Plan 27-05)
 *   7. Linked Versions list with unlink button (Plan 27-05)
 *   8. Linked Feedback list with unlink button (Plan 27-05)
 *   9. Three picker dialog mounts (mounted at page root, controlled by
 *      sectionPickerOpen / versionPickerOpen / feedbackPickerOpen)
 *
 * Right sidebar mounts ResearchLifecycleActions (Plan 04 Task 2) which
 * derives the visible button set from currentUserRole + status + ownership.
 *
 * Author display uses formatAuthorsForDisplay (D-05 single source of truth)
 * so the page renders identically to the AnonymousPreviewCard on the form.
 *
 * Edit-permission gate (canEdit && isOwnerOrAdmin) controls picker triggers,
 * unlink buttons, and inline-relevanceNote-editor visibility. Mirrors the
 * Plan 26-05 assertOwnershipOrBypass pattern: research_lead is gated to own
 * items; admin/policy_lead bypass ownership entirely.
 *
 * Artifact download is intentionally a "Attachment on file" placeholder
 * (presigned-GET plumbing deferred to Phase 28 public listing — see also
 * the Plan 03 SUMMARY edit-mode prefill shortcut).
 */

function formatItemType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function ResearchItemDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const meQuery = trpc.user.getMe.useQuery()
  const itemQuery = trpc.research.getById.useQuery({ id })
  const utils = trpc.useUtils()

  const [sectionPickerOpen, setSectionPickerOpen] = useState(false)
  const [versionPickerOpen, setVersionPickerOpen] = useState(false)
  const [feedbackPickerOpen, setFeedbackPickerOpen] = useState(false)

  const unlinkVersionMutation = trpc.research.unlinkVersion.useMutation({
    onSuccess: () => {
      toast.success('Version unlinked.')
      utils.research.getById.invalidate({ id })
    },
    onError: () => toast.error("Couldn't unlink. Try again."),
  })
  const unlinkFeedbackMutation = trpc.research.unlinkFeedback.useMutation({
    onSuccess: () => {
      toast.success('Feedback unlinked.')
      utils.research.getById.invalidate({ id })
    },
    onError: () => toast.error("Couldn't unlink. Try again."),
  })

  if (itemQuery.isLoading || meQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="w-full lg:w-80 space-y-4">
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  const item = itemQuery.data
  const me = meQuery.data
  if (!item || !me) return null

  const authorDisplay = formatAuthorsForDisplay({
    isAuthorAnonymous: item.isAuthorAnonymous,
    authors: item.authors ?? null,
  })

  const role = (me.role ?? null) as Role | null
  const canEdit = role !== null && can(role, 'research:manage_own')
  const isOwnerOrAdmin =
    item.createdBy === me.id || role === 'admin' || role === 'policy_lead'
  const canManageLinks = canEdit && isOwnerOrAdmin

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Main column */}
      <div className="flex-1 space-y-6">
        <div className="flex items-start gap-3">
          <h1 className="flex-1 text-xl font-semibold leading-tight">
            {item.title}
          </h1>
          <ResearchStatusBadge status={item.status} />
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Badge variant="secondary" className="font-mono">
            {item.readableId}
          </Badge>
          <span>{formatItemType(item.itemType)}</span>
        </div>

        {/* Metadata grid */}
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Authors</dt>
            <dd className="text-sm">
              {authorDisplay.replace(/^Authors: /, '').replace('Source: Confidential', 'Confidential')}
            </dd>
          </div>
          {item.publishedDate && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Published</dt>
              <dd className="text-sm">{item.publishedDate}</dd>
            </div>
          )}
          {item.journalOrSource && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Journal / Source</dt>
              <dd className="text-sm">{item.journalOrSource}</dd>
            </div>
          )}
          {item.doi && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">DOI</dt>
              <dd className="text-sm">
                <a
                  href={`https://doi.org/${item.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  {item.doi}
                </a>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Peer Reviewed</dt>
            <dd className="text-sm">{item.peerReviewed ? 'Yes' : 'No'}</dd>
          </div>
        </dl>

        {item.description && (
          <div className="space-y-2">
            <h2 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Description
            </h2>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {item.description}
            </p>
          </div>
        )}

        {/* Artifact / external URL */}
        {item.externalUrl && (
          <div>
            <Button
              variant="outline"
              onClick={() => window.open(item.externalUrl!, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="size-3.5" />
              Open External Source
            </Button>
          </div>
        )}
        {item.artifactId && (
          <div>
            <ArtifactDownloadLink artifactId={item.artifactId} />
          </div>
        )}

        <Separator />

        {/* Decision Log */}
        <ResearchDecisionLog researchItemId={item.id} />

        <Separator />

        {/* Linked Sections */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Linked Sections
            </h2>
            {canManageLinks && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSectionPickerOpen(true)}
              >
                <Plus className="size-3.5" />
                Link Sections
              </Button>
            )}
          </div>
          {item.linkedSections.length === 0 ? (
            <p className="text-sm text-muted-foreground">{'No sections linked yet.'}</p>
          ) : (
            <div className="space-y-2">
              {item.linkedSections.map((s) => (
                <LinkedSectionRow
                  key={s.sectionId}
                  researchItemId={item.id}
                  sectionId={s.sectionId}
                  sectionTitle={s.sectionTitle}
                  documentId={s.documentId}
                  documentTitle={s.documentTitle}
                  relevanceNote={s.relevanceNote}
                  canEdit={canManageLinks}
                />
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Linked Versions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Linked Versions
            </h2>
            {canManageLinks && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVersionPickerOpen(true)}
              >
                <Plus className="size-3.5" />
                Link Versions
              </Button>
            )}
          </div>
          {item.linkedVersions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{'No versions linked yet.'}</p>
          ) : (
            <div className="space-y-1">
              {item.linkedVersions.map((v) => (
                <div
                  key={v.versionId}
                  className="flex items-center justify-between gap-2 rounded-md border p-2"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-sm">v{v.versionLabel}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {v.documentTitle}
                    </span>
                    {v.isPublished && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Published
                      </Badge>
                    )}
                  </div>
                  {canManageLinks && (
                    <Tooltip>
                      <TooltipTrigger
                        render={(props) => (
                          <Button
                            {...props}
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Remove link"
                            onClick={() =>
                              unlinkVersionMutation.mutate({
                                researchItemId: item.id,
                                versionId: v.versionId,
                              })
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
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Linked Feedback */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
              Linked Feedback
            </h2>
            {canManageLinks && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFeedbackPickerOpen(true)}
              >
                <Plus className="size-3.5" />
                Link Feedback
              </Button>
            )}
          </div>
          {item.linkedFeedback.length === 0 ? (
            <p className="text-sm text-muted-foreground">{'No feedback linked yet.'}</p>
          ) : (
            <div className="space-y-1">
              {item.linkedFeedback.map((f) => (
                <div
                  key={f.feedbackId}
                  className="flex items-center justify-between gap-2 rounded-md border p-2"
                >
                  <Link
                    href={`/policies/${f.documentId}/feedback`}
                    className="block min-w-0 flex-1 hover:underline"
                  >
                    <span className="mr-2 font-mono text-xs text-muted-foreground">
                      {f.readableId}
                    </span>
                    <span className="truncate text-sm">{f.title}</span>
                  </Link>
                  {canManageLinks && (
                    <Tooltip>
                      <TooltipTrigger
                        render={(props) => (
                          <Button
                            {...props}
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Remove link"
                            onClick={() =>
                              unlinkFeedbackMutation.mutate({
                                researchItemId: item.id,
                                feedbackId: f.feedbackId,
                              })
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
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar */}
      <aside className="w-full lg:w-80 lg:shrink-0 space-y-4">
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <ResearchLifecycleActions
            itemId={item.id}
            status={item.status}
            createdBy={item.createdBy}
            currentUserId={me.id}
            currentUserRole={role}
          />
        </div>
      </aside>

      {/* Picker dialog mounts (page-root level so portals render correctly) */}
      <SectionLinkPicker
        researchItemId={item.id}
        linkedSectionIds={item.linkedSections.map((s) => s.sectionId)}
        open={sectionPickerOpen}
        onOpenChange={setSectionPickerOpen}
      />
      <VersionLinkPicker
        researchItemId={item.id}
        linkedVersionIds={item.linkedVersions.map((v) => v.versionId)}
        open={versionPickerOpen}
        onOpenChange={setVersionPickerOpen}
      />
      <FeedbackLinkPicker
        researchItemId={item.id}
        linkedFeedbackIds={item.linkedFeedback.map((f) => f.feedbackId)}
        open={feedbackPickerOpen}
        onOpenChange={setFeedbackPickerOpen}
      />
    </div>
  )
}

/**
 * Phase 27 shortcut: existing evidence module does not expose a
 * getArtifact tRPC query. Detail page shows a muted "Attachment on
 * file" row with a short artifactId caption. Phase 28 public listing
 * will add the presigned-GET plumbing (or a follow-up plan can extend
 * trpc.evidence with a getArtifact query — at which point this
 * component swaps the placeholder for filename + size + download link).
 */
function ArtifactDownloadLink({ artifactId }: { artifactId: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
      <Download className="size-4 text-muted-foreground" />
      <span>Attachment on file</span>
      <span className="ml-auto font-mono text-xs text-muted-foreground">
        {artifactId.slice(0, 8)}
      </span>
    </div>
  )
}
