import Link from 'next/link'
import { db } from '@/src/db'
import {
  feedbackItems,
  feedbackEvidence,
  evidenceArtifacts,
  policySections,
} from '@/src/db/schema'
import { researchItems } from '@/src/db/schema/research'
import { eq, isNull, count, sql, desc, and } from 'drizzle-orm'
import { AlertCircle, FileSearch, CheckCircle, FileText, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatCard } from './stat-card'

interface ResearchLeadDashboardProps {
  userId: string
}

const typeColors: Record<string, string> = {
  issue: 'bg-destructive/10 text-destructive',
  suggestion: 'bg-[oklch(0.769_0.188_70)]/20 text-[oklch(0.769_0.188_70)]',
  endorsement: 'bg-[oklch(0.527_0.154_150)]/20 text-[oklch(0.527_0.154_150)]',
  evidence: 'bg-muted text-muted-foreground',
  question: 'bg-muted text-muted-foreground',
}

export async function ResearchLeadDashboard({ userId }: ResearchLeadDashboardProps) {
  const [
    feedbackWithoutEvidence,
    [totalEvidenceResult],
    [totalFeedbackResult],
    [myDraftsResult],
    [myPendingReviewResult],
  ] = await Promise.all([
    db
      .select({
        id: feedbackItems.id,
        readableId: feedbackItems.readableId,
        title: feedbackItems.title,
        feedbackType: feedbackItems.feedbackType,
        sectionName: policySections.title,
        sectionId: feedbackItems.sectionId,
      })
      .from(feedbackItems)
      .leftJoin(feedbackEvidence, eq(feedbackItems.id, feedbackEvidence.feedbackId))
      .innerJoin(policySections, eq(feedbackItems.sectionId, policySections.id))
      .where(isNull(feedbackEvidence.artifactId))
      .orderBy(desc(feedbackItems.createdAt))
      .limit(5),

    db.select({ count: count() }).from(evidenceArtifacts),

    db.select({ count: count() }).from(feedbackItems),

    // Phase 27 D-10: research_lead dashboard stat — own drafts
    db
      .select({ count: count() })
      .from(researchItems)
      .where(and(
        eq(researchItems.createdBy, userId),
        eq(researchItems.status, 'draft'),
      )),

    // Phase 27 D-10: research_lead dashboard stat — own pending review
    db
      .select({ count: count() })
      .from(researchItems)
      .where(and(
        eq(researchItems.createdBy, userId),
        eq(researchItems.status, 'pending_review'),
      )),
  ])

  // Get count of all feedback without evidence (for stats)
  const [noEvidenceCountResult] = await db
    .select({ count: sql<number>`count(distinct ${feedbackItems.id})::int` })
    .from(feedbackItems)
    .leftJoin(feedbackEvidence, eq(feedbackItems.id, feedbackEvidence.feedbackId))
    .where(isNull(feedbackEvidence.artifactId))

  const noEvidenceCount = noEvidenceCountResult?.count ?? 0
  const totalEvidence = totalEvidenceResult?.count ?? 0
  const totalFeedback = totalFeedbackResult?.count ?? 0
  const feedbackWithEvidence = totalFeedback - noEvidenceCount
  const coverageRate = totalFeedback === 0 ? 100 : Math.round((feedbackWithEvidence / totalFeedback) * 100)

  return (
    <div className="space-y-4">
      {/* Phase 27 D-10: Research stats — prepended above existing stat row per UI-SPEC */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/research-manage?author=me&status=draft">
          <StatCard
            icon={<FileText className="size-5" />}
            value={myDraftsResult?.count ?? 0}
            label="My Drafts"
          />
        </Link>
        <Link href="/research-manage?author=me&status=pending_review">
          <StatCard
            icon={<Clock className="size-5" />}
            value={myPendingReviewResult?.count ?? 0}
            label="Pending Review"
          />
        </Link>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={<AlertCircle className="size-5" />} value={noEvidenceCount} label="Feedback Without Evidence" />
        <StatCard icon={<FileSearch className="size-5" />} value={totalEvidence} label="Total Evidence Items" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        {/* Left column: Claims Without Evidence */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  <h2 className="text-xl font-semibold">Claims Without Evidence</h2>
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {noEvidenceCount} items
                </span>
              </div>
              <Button size="sm" render={<Link href="/feedback/evidence-gaps" />}>
                Review Evidence
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {feedbackWithoutEvidence.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle className="size-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  All feedback items have supporting evidence.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {feedbackWithoutEvidence.map((fb) => (
                  <div key={fb.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                    <Badge variant="secondary" className="font-mono text-muted-foreground shrink-0">
                      {fb.readableId}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{fb.title}</p>
                      <p className="text-xs text-muted-foreground">{fb.sectionName}</p>
                    </div>
                    <Badge className={typeColors[fb.feedbackType] ?? 'bg-muted text-muted-foreground'}>
                      {fb.feedbackType}
                    </Badge>
                    <Button variant="ghost" size="sm" render={<Link href="/feedback/evidence-gaps" />}>
                      Attach Evidence
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          {noEvidenceCount > 5 && (
            <div className="border-t px-4 py-2">
              <Button variant="ghost" size="sm" render={<Link href="/feedback/evidence-gaps" />}>
                View all evidence gaps
              </Button>
            </div>
          )}
        </Card>

        {/* Right column: Summary stats card */}
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-xl font-semibold">Evidence Overview</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total evidence items</span>
                <span className="text-sm font-semibold">{totalEvidence}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Feedback without evidence</span>
                <span className="text-sm font-semibold">{noEvidenceCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Coverage rate</span>
                <span className="text-sm font-semibold">
                  {coverageRate}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
