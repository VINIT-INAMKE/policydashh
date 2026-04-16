'use client'

import { useState } from 'react'
import { Check, Pencil, RefreshCw } from 'lucide-react'
import { trpc } from '@/src/trpc/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import type {
  ConsultationSummaryJson,
  ConsultationSummarySection,
  ConsultationSummarySectionStatus,
} from '@/src/server/services/consultation-summary.service'

interface SummaryReviewCardProps {
  versionId: string
}

function SectionStatusBadge({ status }: { status: ConsultationSummarySectionStatus }) {
  switch (status) {
    case 'approved':
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
          Approved
        </Badge>
      )
    case 'blocked':
      return (
        <Badge className="bg-red-50 text-red-700 border-red-200">
          Blocked - guardrail violation
        </Badge>
      )
    case 'error':
      return (
        <Badge className="bg-orange-50 text-orange-700 border-orange-200">
          Generation error
        </Badge>
      )
    case 'skipped':
      return (
        <Badge className="bg-muted text-muted-foreground">
          Skipped
        </Badge>
      )
    case 'pending':
    default:
      return (
        <Badge className="bg-muted text-muted-foreground">
          Pending
        </Badge>
      )
  }
}

function SourceFeedbackPanel({
  versionId,
  sectionId,
  feedbackCount,
}: {
  versionId: string
  sectionId: string
  feedbackCount: number
}) {
  const query = trpc.consultationSummary.getSectionFeedback.useQuery(
    { versionId, sectionId },
    { enabled: feedbackCount > 0 },
  )

  if (feedbackCount === 0) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        No accepted feedback
        <p className="mt-1 text-xs">
          This section had no accepted feedback items. It will be automatically skipped.
        </p>
      </div>
    )
  }

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  const rows = query.data ?? []

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-muted-foreground">
        {rows.length} accepted feedback items contributed to this section
      </p>
      {rows.map((row) => (
        <div
          key={row.feedbackId}
          className="rounded-md border border-border bg-muted/20 p-3"
        >
          <Badge className="mb-2 text-xs" variant="outline">
            {row.orgType ?? 'unspecified'}
          </Badge>
          <p className="line-clamp-3 text-sm text-foreground">{row.body}</p>
        </div>
      ))}
    </div>
  )
}

function SectionRow({
  versionId,
  section,
}: {
  versionId: string
  section: ConsultationSummarySection
}) {
  const utils = trpc.useUtils()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(section.summary)

  const approve = trpc.consultationSummary.approveSection.useMutation({
    onSuccess: () => {
      utils.consultationSummary.getByVersionId.invalidate({ versionId })
    },
  })
  const edit = trpc.consultationSummary.editSection.useMutation({
    onSuccess: () => {
      setEditing(false)
      utils.consultationSummary.getByVersionId.invalidate({ versionId })
    },
  })
  const regen = trpc.consultationSummary.regenerateSection.useMutation({
    onSuccess: () => {
      utils.consultationSummary.getByVersionId.invalidate({ versionId })
    },
  })

  const isApproved = section.status === 'approved'
  const isBlocked = section.status === 'blocked'
  const isError = section.status === 'error'
  const isPending = section.status === 'pending' && section.summary.length === 0

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-base font-semibold">{section.sectionTitle}</h4>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => regen.mutate({ versionId, sectionId: section.sectionId })}
            disabled={regen.isPending}
          >
            <RefreshCw className="h-4 w-4" data-icon="inline-start" />
            Regenerate Section
          </Button>
          <SectionStatusBadge status={section.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_320px]">
        {/* LEFT - prose editor */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Generated Summary
            </span>
            {!isApproved && !isBlocked && !isPending && !editing && (
              <button
                type="button"
                onClick={() => {
                  setDraft(section.summary)
                  setEditing(true)
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Edit section summary"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>

          {isPending ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
              <p className="mt-2 text-xs text-muted-foreground">Generating summary...</p>
            </div>
          ) : isBlocked ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              This section was blocked because generated text matched a stakeholder name pattern. Regenerate Section after reviewing source feedback.
            </div>
          ) : isError ? (
            <div className="rounded-md border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
              Summary generation failed for this section. Click Regenerate Section to retry.
            </div>
          ) : editing ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={10}
              placeholder="Edit the generated summary before approving..."
              className="text-sm"
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{section.summary}</p>
          )}

          <div className="flex items-center gap-2">
            {editing ? (
              <Button
                size="sm"
                onClick={() =>
                  edit.mutate({
                    versionId,
                    sectionId: section.sectionId,
                    prose: draft,
                  })
                }
                disabled={edit.isPending || draft.length === 0}
              >
                Save Changes
              </Button>
            ) : isApproved ? (
              <Button size="sm" disabled>
                <Check className="h-4 w-4" data-icon="inline-start" />
                Approved
              </Button>
            ) : !isPending && !isBlocked && !isError ? (
              <Button
                size="sm"
                onClick={() => approve.mutate({ versionId, sectionId: section.sectionId })}
                disabled={approve.isPending}
              >
                Approve Section
              </Button>
            ) : null}
          </div>
        </div>

        {/* RIGHT - source feedback panel */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Source Feedback
          </span>
          <SourceFeedbackPanel
            versionId={versionId}
            sectionId={section.sectionId}
            feedbackCount={section.feedbackCount}
          />
        </div>
      </div>
    </div>
  )
}

export function SummaryReviewCard({ versionId }: SummaryReviewCardProps) {
  const query = trpc.consultationSummary.getByVersionId.useQuery({ versionId })

  if (query.isLoading) {
    return <Skeleton className="h-32 w-full" />
  }

  const summary = (query.data as ConsultationSummaryJson | null) ?? null

  if (!summary) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-6">
        <h3 className="text-base font-semibold">Consultation Summary Review</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          The consultation summary has not been generated yet. It will appear here once the version is published and the LLM pipeline completes.
        </p>
      </div>
    )
  }

  const gateLocked = summary.status !== 'approved'

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold">Consultation Summary Review</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and approve the LLM-generated summary for each section before public display.
        </p>
      </div>

      <div
        className={
          gateLocked
            ? 'rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground'
            : 'rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700'
        }
      >
        {gateLocked
          ? 'All sections must be approved before the summary is published publicly.'
          : 'All sections approved. The summary will appear publicly on the portal.'}
      </div>

      <Separator />

      <div className="flex flex-col gap-4">
        {summary.sections.map((section) => (
          <SectionRow key={section.sectionId} versionId={versionId} section={section} />
        ))}
      </div>
    </div>
  )
}
