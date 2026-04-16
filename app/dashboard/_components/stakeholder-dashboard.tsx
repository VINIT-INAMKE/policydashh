import Link from 'next/link'
import { db } from '@/src/db'
import {
  feedbackItems,
  policySections,
  policyDocuments,
  sectionAssignments,
  documentVersions,
} from '@/src/db/schema'
import { workshops } from '@/src/db/schema/workshops'
import { eq, and, notInArray, desc, gt, gte, count } from 'drizzle-orm'
import { FileText, MessageSquare, Calendar, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow, format } from 'date-fns'

interface StakeholderDashboardProps {
  userId: string
  lastVisitedAt: Date | null
}

const statusColors: Record<string, string> = {
  submitted: 'bg-[oklch(0.769_0.188_70)]/20 text-[oklch(0.769_0.188_70)]',
  under_review: 'bg-[oklch(0.769_0.188_70)]/20 text-[oklch(0.769_0.188_70)]',
  accepted: 'bg-[oklch(0.527_0.154_150)]/20 text-[oklch(0.527_0.154_150)]',
  partially_accepted: 'bg-[oklch(0.769_0.188_70)]/20 text-[oklch(0.769_0.188_70)]',
  rejected: 'bg-destructive/10 text-destructive',
  closed: 'bg-muted text-muted-foreground',
}

export async function StakeholderDashboard({ userId, lastVisitedAt }: StakeholderDashboardProps) {
  const [assignedSections, pendingFeedback, upcomingWorkshops] = await Promise.all([
    db
      .select({
        assignmentId: sectionAssignments.id,
        sectionId: sectionAssignments.sectionId,
        sectionTitle: policySections.title,
        documentId: policySections.documentId,
        documentTitle: policyDocuments.title,
        sectionUpdatedAt: policySections.updatedAt,
      })
      .from(sectionAssignments)
      .innerJoin(policySections, eq(sectionAssignments.sectionId, policySections.id))
      .innerJoin(policyDocuments, eq(policySections.documentId, policyDocuments.id))
      .where(eq(sectionAssignments.userId, userId)),

    db
      .select({
        id: feedbackItems.id,
        readableId: feedbackItems.readableId,
        title: feedbackItems.title,
        status: feedbackItems.status,
        updatedAt: feedbackItems.updatedAt,
        sectionName: policySections.title,
      })
      .from(feedbackItems)
      .innerJoin(policySections, eq(feedbackItems.sectionId, policySections.id))
      .where(
        and(
          eq(feedbackItems.submitterId, userId),
          notInArray(feedbackItems.status, ['closed']),
        ),
      )
      .orderBy(desc(feedbackItems.updatedAt))
      .limit(5),

    db
      .select({
        id: workshops.id,
        title: workshops.title,
        description: workshops.description,
        scheduledAt: workshops.scheduledAt,
        durationMinutes: workshops.durationMinutes,
      })
      .from(workshops)
      .where(gte(workshops.scheduledAt, new Date()))
      .orderBy(workshops.scheduledAt)
      .limit(3),
  ])

  // Check for changed sections since last visit
  let changedSections: typeof assignedSections = []
  if (lastVisitedAt && assignedSections.length > 0) {
    changedSections = assignedSections.filter(
      (s) => new Date(s.sectionUpdatedAt) > lastVisitedAt,
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* What Changed Since Your Last Visit */}
      {lastVisitedAt && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-xl font-semibold">What Changed Since Your Last Visit</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {changedSections.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle className="size-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No changes since your last visit on {format(lastVisitedAt, 'MMM d, yyyy')}.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: 'oklch(0.527 0.154 150)' }}
                  />
                  <p className="text-sm">{changedSections.length} section(s) updated</p>
                  <span className="text-xs text-muted-foreground">
                    since {format(lastVisitedAt, 'MMM d, yyyy')}
                  </span>
                </div>
                {changedSections.map((section) => (
                  <div key={section.sectionId} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{section.sectionTitle}</p>
                      <p className="text-xs text-muted-foreground">{section.documentTitle}</p>
                    </div>
                    <Button variant="ghost" size="sm" render={<Link href={`/policies/${section.documentId}`} />}>
                      View changes
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Assigned Sections */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-xl font-semibold">Your Assigned Sections</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assignedSections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="size-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                You have no assigned sections. Contact your Policy Lead.
              </p>
              <Button variant="outline" size="sm" className="mt-3" render={<Link href="/portal" />}>
                Browse Public Portal
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {assignedSections.map((section) => (
                <div key={section.assignmentId} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{section.sectionTitle}</p>
                    <p className="text-xs text-muted-foreground">{section.documentTitle}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/policies/${section.documentId}/sections/${section.sectionId}/feedback/new`} />}
                  >
                    Submit Feedback
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Feedback */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-xl font-semibold">Your Pending Feedback</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingFeedback.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="size-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No feedback items in progress.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingFeedback.map((fb) => (
                <Link key={fb.id} href="/feedback/outcomes" className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                  <Badge variant="secondary" className="font-mono text-muted-foreground shrink-0">
                    {fb.readableId}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{fb.title}</p>
                    <p className="text-xs text-muted-foreground">{fb.sectionName}</p>
                  </div>
                  <Badge className={statusColors[fb.status] ?? 'bg-muted text-muted-foreground'}>
                    {fb.status.replace('_', ' ')}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
        <div className="border-t px-4 py-2">
          <Button variant="ghost" size="sm" render={<Link href="/feedback/outcomes" />}>
            View all feedback outcomes
          </Button>
        </div>
      </Card>

      {/* Upcoming Workshops */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              <h2 className="text-xl font-semibold">Upcoming Workshops</h2>
            </CardTitle>
            <Button variant="ghost" size="sm" render={<Link href="/workshop-manage" />}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {upcomingWorkshops.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="size-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No upcoming workshops scheduled.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingWorkshops.map((ws) => (
                <Link key={ws.id} href={`/workshop-manage/${ws.id}`} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                  <Calendar className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{ws.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(ws.scheduledAt), 'MMM d, yyyy h:mm a')}
                      {ws.durationMinutes ? ` (${ws.durationMinutes} min)` : ''}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
