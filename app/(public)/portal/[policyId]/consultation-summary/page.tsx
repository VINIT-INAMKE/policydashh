export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/src/db'
import { policyDocuments, policySections } from '@/src/db/schema/documents'
import { feedbackItems } from '@/src/db/schema/feedback'
import { users } from '@/src/db/schema/users'
import { eq, and, inArray } from 'drizzle-orm'
import { ArrowLeft, Info, Users as UsersIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ConsultationSummaryAccordion } from './_components/consultation-summary-accordion'

type FeedbackType = 'issue' | 'suggestion' | 'endorsement' | 'evidence' | 'question'
type FeedbackStatus = 'accepted' | 'partially_accepted' | 'rejected' | 'closed'
type OrgType = 'government' | 'industry' | 'legal' | 'academia' | 'civil_society' | 'internal'

interface SectionSummary {
  sectionId: string
  sectionTitle: string
  submissionCount: number
  typeBreakdown: Record<FeedbackType, number>
  outcomeBreakdown: Record<FeedbackStatus, number>
  orgBreakdown: Record<OrgType, number>
}

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

  // Query resolved feedback for this document (server-side SQL filter)
  // Only resolved feedback appears in public summary
  const resolvedStatuses = ['accepted', 'partially_accepted', 'rejected', 'closed'] as const
  const resolvedFeedback = await db
    .select({
      sectionId: feedbackItems.sectionId,
      feedbackType: feedbackItems.feedbackType,
      status: feedbackItems.status,
      isAnonymous: feedbackItems.isAnonymous,
      submitterOrgType: users.orgType,
      sectionTitle: policySections.title,
    })
    .from(feedbackItems)
    .leftJoin(users, eq(feedbackItems.submitterId, users.id))
    .leftJoin(policySections, eq(feedbackItems.sectionId, policySections.id))
    .where(
      and(
        eq(feedbackItems.documentId, policyId),
        inArray(feedbackItems.status, [...resolvedStatuses]),
      ),
    )

  if (resolvedFeedback.length === 0) {
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
          <h2 className="text-lg font-semibold">No consultation data available</h2>
          <p className="text-sm text-muted-foreground">
            No consultation data available for this policy.
          </p>
        </div>
      </div>
    )
  }

  // Compute summary stats
  const totalSubmissions = resolvedFeedback.length
  const distinctSections = new Set(resolvedFeedback.map((r) => r.sectionId)).size
  const totalDecisions = resolvedFeedback.filter((r) =>
    ['accepted', 'partially_accepted', 'rejected'].includes(r.status)
  ).length

  // Group by section
  const sectionMap = new Map<string, SectionSummary>()

  for (const row of resolvedFeedback) {
    if (!sectionMap.has(row.sectionId)) {
      sectionMap.set(row.sectionId, {
        sectionId: row.sectionId,
        sectionTitle: row.sectionTitle ?? 'Unknown Section',
        submissionCount: 0,
        typeBreakdown: { issue: 0, suggestion: 0, endorsement: 0, evidence: 0, question: 0 },
        outcomeBreakdown: { accepted: 0, partially_accepted: 0, rejected: 0, closed: 0 },
        orgBreakdown: { government: 0, industry: 0, legal: 0, academia: 0, civil_society: 0, internal: 0 },
      })
    }
    const section = sectionMap.get(row.sectionId)!
    section.submissionCount++

    // Type breakdown
    if (row.feedbackType in section.typeBreakdown) {
      section.typeBreakdown[row.feedbackType as FeedbackType]++
    }

    // Outcome breakdown
    if (row.status in section.outcomeBreakdown) {
      section.outcomeBreakdown[row.status as FeedbackStatus]++
    }

    // PRIVACY ENFORCEMENT (PUB-03, PUB-05):
    // Unconditionally null out identity on public routes for anonymous submissions
    // For non-anonymous: include orgType aggregate count only
    const orgType: OrgType | null = row.isAnonymous ? null : (row.submitterOrgType as OrgType | null)
    if (orgType && orgType in section.orgBreakdown) {
      section.orgBreakdown[orgType]++
    }

    // SECURITY: Named contributors removed from public portal to prevent identity leakage
  }

  const sectionSummaries = Array.from(sectionMap.values())

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

      {/* Privacy notice */}
      <div className="flex items-start gap-3 bg-[oklch(0.97_0.03_85)] border border-[oklch(0.88_0.06_85)] rounded-md px-4 py-3 text-sm">
        <Info className="size-4 mt-0.5 shrink-0 text-[oklch(0.65_0.12_85)]" />
        <p>
          This summary has been prepared in accordance with privacy guidelines.
          Individual submissions are not publicly disclosed.
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-[28px] font-semibold leading-[1.2]">{totalSubmissions}</p>
            <p className="text-sm text-muted-foreground">Total Submissions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-[28px] font-semibold leading-[1.2]">{distinctSections}</p>
            <p className="text-sm text-muted-foreground">Sections Reviewed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-[28px] font-semibold leading-[1.2]">{totalDecisions}</p>
            <p className="text-sm text-muted-foreground">Decisions Made</p>
          </CardContent>
        </Card>
      </div>

      {/* Section accordion */}
      <ConsultationSummaryAccordion sections={sectionSummaries} />
    </div>
  )
}
