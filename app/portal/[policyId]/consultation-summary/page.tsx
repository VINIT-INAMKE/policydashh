export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/src/db'
import { policyDocuments } from '@/src/db/schema/documents'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { eq, and, desc } from 'drizzle-orm'
import { ArrowLeft, AlertCircle, Info, Users as UsersIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type {
  ConsultationSummaryJson,
  ApprovedSummarySection,
} from '@/src/server/services/consultation-summary.service'

/**
 * E9: render the approved LLM consultation summary from
 * `documentVersions.consultationSummary` (JSONB) for the latest published
 * version, instead of recomputing aggregates from `feedbackItems`.
 *
 * E19: surface a stale-version indicator if a newer version has been
 * published after the most-recently-approved summary was generated. The
 * moderator has to re-approve or we show the older content with a warning.
 *
 * Privacy: this is a public route. We ONLY pass the `ApprovedSummarySection`
 * projection (no sourceFeedbackIds / feedbackCount / edited / generatedAt)
 * into the rendered HTML, per consultation-summary.service LLM-08.
 */
export default async function ConsultationSummaryPage({
  params,
}: {
  params: Promise<{ policyId: string }>
}) {
  const { policyId } = await params

  // Query policy title
  const policy = await db.query.policyDocuments.findFirst({
    where: eq(policyDocuments.id, policyId),
  })
  if (!policy) {
    notFound()
  }

  // Load every published version (latest first). We need more than the
  // latest so we can detect a stale-summary scenario: the freshest approved
  // summary may live on an older version than the newest-published one.
  const published = await db
    .select({
      id:                  documentVersions.id,
      versionLabel:        documentVersions.versionLabel,
      publishedAt:         documentVersions.publishedAt,
      consultationSummary: documentVersions.consultationSummary,
    })
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.documentId, policyId),
        eq(documentVersions.isPublished, true),
      ),
    )
    .orderBy(desc(documentVersions.publishedAt))

  if (published.length === 0) {
    // Policy exists but nothing published yet. Public portal should treat as
    // not-found so we don't leak a half-baked policy.
    notFound()
  }

  const latestPublished = published[0]

  // Find the freshest version that carries an approved summary.
  let summaryVersion: typeof published[number] | null = null
  for (const v of published) {
    const s = v.consultationSummary as ConsultationSummaryJson | null
    if (s && s.status === 'approved') {
      summaryVersion = v
      break
    }
  }

  // E19 stale detection: summary belongs to an older version than the latest
  // published one. We still render the summary (it's the best approved
  // content we have) but show a banner pointing out the mismatch.
  const isStale =
    summaryVersion !== null && summaryVersion.id !== latestPublished.id

  const approvedSections: ApprovedSummarySection[] = summaryVersion
    ? (summaryVersion.consultationSummary as ConsultationSummaryJson).sections
        .filter((s) => s.status === 'approved')
        .map((s) => ({
          sectionId:    s.sectionId,
          sectionTitle: s.sectionTitle,
          summary:      s.summary,
        }))
    : []

  if (approvedSections.length === 0) {
    return (
      <div className="space-y-8">
        <div className="space-y-4">
          <Link
            href={`/portal/${policyId}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Policy
          </Link>
          <h1 className="text-[28px] font-semibold leading-[1.2]">
            {policy.title} &mdash; Consultation Summary
          </h1>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <UsersIcon className="size-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">
            Consultation summary not yet available
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            The policy team is still reviewing stakeholder feedback. The
            summary will appear here once it has been approved for
            publication.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link
          href={`/portal/${policyId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Policy
        </Link>
        <h1 className="text-[28px] font-semibold leading-[1.2]">
          {policy.title} &mdash; Consultation Summary
        </h1>
      </div>

      {/* E19 stale banner - shown when the summary belongs to an older
          published version. */}
      {isStale && (
        <div
          className="flex items-start gap-3 rounded-md border border-[oklch(0.88_0.06_55)] bg-[oklch(0.97_0.03_55)] px-4 py-3 text-sm"
          role="status"
        >
          <AlertCircle className="size-4 mt-0.5 shrink-0 text-[oklch(0.65_0.15_55)]" />
          <p>
            This summary reflects feedback on an earlier version of the
            policy. A newer version has been published; the consultation
            summary for it is still under review.
          </p>
        </div>
      )}

      {/* Privacy notice */}
      <div className="flex items-start gap-3 bg-[oklch(0.97_0.03_85)] border border-[oklch(0.88_0.06_85)] rounded-md px-4 py-3 text-sm">
        <Info className="size-4 mt-0.5 shrink-0 text-[oklch(0.65_0.12_85)]" />
        <p>
          This summary has been prepared in accordance with privacy guidelines.
          Individual submissions are not publicly disclosed.
        </p>
      </div>

      {/* Section summaries - render each approved section's prose */}
      <div className="space-y-4">
        {approvedSections.map((s) => (
          <Card key={s.sectionId}>
            <CardContent className="flex flex-col gap-3 pt-4">
              <h2 className="text-[20px] font-semibold leading-[1.2]">
                {s.sectionTitle}
              </h2>
              <div className="whitespace-pre-wrap text-[16px] font-normal leading-[1.8] text-[var(--cl-on-surface)]">
                {s.summary}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
