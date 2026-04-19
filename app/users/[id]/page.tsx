import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { feedbackItems } from '@/src/db/schema/feedback'
import { workshopRegistrations, workshops } from '@/src/db/schema/workshops'
import { eq, desc, count, and, isNotNull } from 'drizzle-orm'
import { format } from 'date-fns'
import { ChevronLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

const ROLE_DISPLAY: Record<string, string> = {
  admin: 'Admin',
  policy_lead: 'Policy Lead',
  research_lead: 'Research Lead',
  workshop_moderator: 'Workshop Moderator',
  stakeholder: 'Stakeholder',
  observer: 'Observer',
  auditor: 'Auditor',
}

const ORG_TYPE_DISPLAY: Record<string, string> = {
  government: 'Government',
  industry: 'Industry',
  legal: 'Legal',
  academia: 'Academia',
  civil_society: 'Civil Society',
  internal: 'Internal',
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Admin guard -- mirrors app/users/page.tsx
  const { userId } = await auth()
  // C9: unauthenticated users belong on /sign-in, not /dashboard.
  if (!userId) redirect('/sign-in')

  const currentUser = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  })
  if (!currentUser || currentUser.role !== 'admin') redirect('/dashboard')

  const [profile, userFeedback, attendedWorkshops, [feedbackCountResult], [attendanceCountResult]] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, id) }),

    db
      .select({
        id: feedbackItems.id,
        readableId: feedbackItems.readableId,
        title: feedbackItems.title,
        status: feedbackItems.status,
        createdAt: feedbackItems.createdAt,
      })
      .from(feedbackItems)
      .where(eq(feedbackItems.submitterId, id))
      .orderBy(desc(feedbackItems.createdAt))
      .limit(20),

    db
      .select({
        workshopId: workshopRegistrations.workshopId,
        title: workshops.title,
        scheduledAt: workshops.scheduledAt,
        attendedAt: workshopRegistrations.attendedAt,
        status: workshopRegistrations.status,
      })
      .from(workshopRegistrations)
      .innerJoin(workshops, eq(workshopRegistrations.workshopId, workshops.id))
      .where(and(
        eq(workshopRegistrations.userId, id),
        isNotNull(workshopRegistrations.attendedAt),
      ))
      .orderBy(desc(workshops.scheduledAt)),

    db.select({ cnt: count() }).from(feedbackItems).where(eq(feedbackItems.submitterId, id)),

    db.select({ cnt: count() }).from(workshopRegistrations)
      .where(and(eq(workshopRegistrations.userId, id), isNotNull(workshopRegistrations.attendedAt))),
  ])

  if (!profile) {
    redirect('/users')
  }

  const engagementScore = (feedbackCountResult?.cnt ?? 0) + (attendanceCountResult?.cnt ?? 0)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back link */}
      <Link
        href="/users"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        User Management
      </Link>

      {/* User Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{profile.name || 'Unnamed User'}</h1>
          <Badge variant="secondary">{ROLE_DISPLAY[profile.role] ?? profile.role}</Badge>
          {profile.orgType && (
            <Badge variant="outline">
              {ORG_TYPE_DISPLAY[profile.orgType] ?? profile.orgType}
            </Badge>
          )}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Last Active:</span>{' '}
            {format(new Date(profile.lastActivityAt), 'MMM d, yyyy')}
          </div>
          <div>
            <span className="font-medium text-foreground">Member Since:</span>{' '}
            {format(new Date(profile.createdAt), 'MMM d, yyyy')}
          </div>
        </div>
        <div className="mt-3">
          <span className="text-[28px] font-semibold leading-tight">{engagementScore}</span>
          <span className="ml-2 text-xs text-muted-foreground">engagements</span>
        </div>
      </div>

      {/* Workshop Attendance */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-xl font-semibold">Workshop Attendance</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendedWorkshops.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No workshops attended yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Workshop Title</TableHead>
                  <TableHead>Date Attended</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendedWorkshops.map((ws) => (
                  <TableRow key={ws.workshopId}>
                    <TableCell className="font-medium">{ws.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ws.attendedAt ? format(new Date(ws.attendedAt), 'MMM d, yyyy') : '--'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ws.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Feedback Submitted */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>
              <h2 className="text-xl font-semibold">Feedback Submitted</h2>
            </CardTitle>
            {/* C10: link through to the full feedback list, scoped to this submitter. */}
            {(feedbackCountResult?.cnt ?? 0) > 0 && (
              <Link
                href={`/feedback?submitter=${id}`}
                className="text-sm text-[var(--cl-primary)] hover:underline"
              >
                View all ({feedbackCountResult?.cnt ?? 0})
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {userFeedback.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No feedback submitted yet.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userFeedback.map((fb) => (
                    <TableRow key={fb.id}>
                      <TableCell className="font-mono text-xs">{fb.readableId}</TableCell>
                      <TableCell className="font-medium">{fb.title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{fb.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(fb.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {/* C10: clarify that this is a capped window, not the full history. */}
              {(feedbackCountResult?.cnt ?? 0) > userFeedback.length && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Showing latest {userFeedback.length} of {feedbackCountResult?.cnt ?? userFeedback.length}.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
