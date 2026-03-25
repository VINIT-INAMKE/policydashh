import Link from 'next/link'
import { db } from '@/src/db'
import { feedbackItems, policySections, policyDocuments, changeRequests, documentVersions } from '@/src/db/schema'
import { eq, inArray, notInArray, count, desc, sql, and, gt } from 'drizzle-orm'
import { MessageSquare, GitPullRequest, FileText, BookOpen, BarChart2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatCard } from './stat-card'
import { formatDistanceToNow } from 'date-fns'

interface PolicyLeadDashboardProps {
  userId: string
  lastVisitedAt: Date | null
}

const HEALTH_COLORS = {
  Good: { bg: 'bg-[oklch(0.527_0.154_150)]/20', text: 'text-[oklch(0.527_0.154_150)]' },
  Warning: { bg: 'bg-[oklch(0.769_0.188_70)]/20', text: 'text-[oklch(0.769_0.188_70)]' },
  Critical: { bg: 'bg-[oklch(0.577_0.245_27)]/20', text: 'text-[oklch(0.577_0.245_27)]' },
} as const

type HealthLevel = keyof typeof HEALTH_COLORS

function computeHealth(openCount: number, highPriorityCount: number, hasApprovedCRUnpublished7d: boolean, hasInReviewCR: boolean): HealthLevel {
  if (openCount >= 4 || highPriorityCount > 0 || hasApprovedCRUnpublished7d) return 'Critical'
  if (openCount >= 1 || hasInReviewCR) return 'Warning'
  return 'Good'
}

export async function PolicyLeadDashboard({ userId, lastVisitedAt }: PolicyLeadDashboardProps) {
  const [
    [openFeedbackResult],
    [activeCRResult],
    [policiesResult],
    [publishedResult],
    recentFeedback,
    activeCRs,
    sections,
  ] = await Promise.all([
    db.select({ count: count() }).from(feedbackItems)
      .where(inArray(feedbackItems.status, ['submitted', 'under_review'])),

    db.select({ count: count() }).from(changeRequests)
      .where(notInArray(changeRequests.status, ['merged', 'closed'])),

    db.select({ count: count() }).from(policyDocuments),

    db.select({ count: count() }).from(documentVersions)
      .where(eq(documentVersions.isPublished, true)),

    db.select({
      id: feedbackItems.id,
      readableId: feedbackItems.readableId,
      title: feedbackItems.title,
      priority: feedbackItems.priority,
      status: feedbackItems.status,
      createdAt: feedbackItems.createdAt,
      sectionName: policySections.title,
    })
      .from(feedbackItems)
      .innerJoin(policySections, eq(feedbackItems.sectionId, policySections.id))
      .where(eq(feedbackItems.status, 'submitted'))
      .orderBy(desc(feedbackItems.createdAt))
      .limit(5),

    db.select({
      id: changeRequests.id,
      readableId: changeRequests.readableId,
      title: changeRequests.title,
      status: changeRequests.status,
      updatedAt: changeRequests.updatedAt,
    })
      .from(changeRequests)
      .where(notInArray(changeRequests.status, ['merged', 'closed']))
      .orderBy(desc(changeRequests.updatedAt))
      .limit(5),

    db.select({
      id: policySections.id,
      title: policySections.title,
      documentId: policySections.documentId,
    }).from(policySections),
  ])

  const openFeedbackCount = openFeedbackResult?.count ?? 0
  const activeCRCount = activeCRResult?.count ?? 0
  const policiesCount = policiesResult?.count ?? 0
  const publishedVersionsCount = publishedResult?.count ?? 0

  // Compute section health
  const sectionHealthData = await Promise.all(
    sections.map(async (section) => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      const [
        [openFbResult],
        [highPrioResult],
        [inReviewCRResult],
        [approvedCRResult],
      ] = await Promise.all([
        db.select({ count: count() }).from(feedbackItems)
          .where(and(
            eq(feedbackItems.sectionId, section.id),
            inArray(feedbackItems.status, ['submitted', 'under_review']),
          )),
        db.select({ count: count() }).from(feedbackItems)
          .where(and(
            eq(feedbackItems.sectionId, section.id),
            inArray(feedbackItems.status, ['submitted', 'under_review']),
            eq(feedbackItems.priority, 'high'),
          )),
        db.select({ count: count() }).from(changeRequests)
          .where(eq(changeRequests.status, 'in_review')),
        db.select({ count: count() }).from(changeRequests)
          .where(and(
            eq(changeRequests.status, 'approved'),
            gt(sql`now() - interval '7 days'`, changeRequests.approvedAt!),
          )),
      ])

      const health = computeHealth(
        openFbResult?.count ?? 0,
        highPrioResult?.count ?? 0,
        (approvedCRResult?.count ?? 0) > 0,
        (inReviewCRResult?.count ?? 0) > 0,
      )

      return { ...section, health }
    })
  )

  // Check for changes since last visit
  let changedSinceLastVisit = 0
  if (lastVisitedAt) {
    const [result] = await db
      .select({ count: count() })
      .from(feedbackItems)
      .where(gt(feedbackItems.createdAt, lastVisitedAt))
    changedSinceLastVisit = result?.count ?? 0
  }

  const priorityColors: Record<string, string> = {
    high: 'bg-destructive/10 text-destructive',
    medium: 'bg-[oklch(0.769_0.188_70)]/20 text-[oklch(0.769_0.188_70)]',
    low: 'bg-muted text-muted-foreground',
  }

  const crStatusColors: Record<string, string> = {
    drafting: 'bg-muted text-muted-foreground',
    in_review: 'bg-[oklch(0.769_0.188_70)]/20 text-[oklch(0.769_0.188_70)]',
    approved: 'bg-[oklch(0.527_0.154_150)]/20 text-[oklch(0.527_0.154_150)]',
  }

  return (
    <div className="space-y-4">
      {/* What changed banner */}
      {lastVisitedAt && changedSinceLastVisit > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-muted border-b px-4 py-2">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: 'oklch(0.527 0.154 150)' }}
          />
          <p className="text-sm">
            {changedSinceLastVisit} section(s) changed since your last visit.
          </p>
          <Button variant="ghost" size="sm" className="ml-auto">
            See what changed
          </Button>
        </div>
      )}

      {/* Stat row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<MessageSquare className="size-5" />} value={openFeedbackCount} label="Open Feedback" />
        <StatCard icon={<GitPullRequest className="size-5" />} value={activeCRCount} label="Active CRs" />
        <StatCard icon={<FileText className="size-5" />} value={policiesCount} label="Policies" />
        <StatCard icon={<BookOpen className="size-5" />} value={publishedVersionsCount} label="Published Versions" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        {/* Left column */}
        <div className="space-y-4">
          {/* Feedback Inbox */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    <h2 className="text-xl font-semibold">Feedback Inbox</h2>
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {openFeedbackCount} items needing triage
                  </span>
                </div>
                <Button size="sm" render={<Link href="/feedback" />}>
                  Triage Feedback
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentFeedback.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MessageSquare className="size-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No feedback items need triage.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentFeedback.map((fb) => (
                    <div key={fb.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                      <Badge variant="secondary" className="font-mono text-muted-foreground shrink-0">
                        {fb.readableId}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{fb.title}</p>
                        <p className="text-xs text-muted-foreground">{fb.sectionName}</p>
                      </div>
                      <Badge className={priorityColors[fb.priority] ?? ''}>
                        {fb.priority}
                      </Badge>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(fb.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {openFeedbackCount > 5 && (
              <div className="border-t px-4 py-2">
                <Button variant="ghost" size="sm" render={<Link href="/feedback" />}>
                  View all feedback
                </Button>
              </div>
            )}
          </Card>

          {/* Active CRs */}
          <Card>
            <CardHeader>
              <CardTitle>
                <h2 className="text-xl font-semibold">Active Change Requests</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeCRs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <GitPullRequest className="size-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No active change requests.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeCRs.map((cr) => (
                    <div key={cr.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                      <Badge variant="secondary" className="font-mono text-muted-foreground shrink-0">
                        {cr.readableId}
                      </Badge>
                      <p className="min-w-0 flex-1 truncate text-sm">{cr.title}</p>
                      <Badge className={crStatusColors[cr.status] ?? 'bg-muted text-muted-foreground'}>
                        {cr.status.replace('_', ' ')}
                      </Badge>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(cr.updatedAt), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {activeCRCount > 5 && (
              <div className="border-t px-4 py-2">
                <Button variant="ghost" size="sm" render={<Link href="/change-requests" />}>
                  View all CRs
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Right column: Section Health */}
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-xl font-semibold">Section Health</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sectionHealthData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BarChart2 className="size-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No sections found.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sectionHealthData.map((section) => {
                  const colors = HEALTH_COLORS[section.health]
                  return (
                    <div key={section.id} className="flex items-center justify-between rounded-md px-2 py-2">
                      <p className="truncate text-sm">{section.title}</p>
                      <span
                        className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${colors.bg} ${colors.text}`}
                      >
                        {section.health}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="mt-4 text-xs text-muted-foreground">
              Good: no open issues &middot; Warning: feedback accumulating &middot; Critical: urgent attention needed
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
