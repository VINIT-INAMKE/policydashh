import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { feedbackItems } from '@/src/db/schema/feedback'
import { eq, desc, count } from 'drizzle-orm'
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

  // Admin guard -- mirrors app/(workspace)/users/page.tsx
  const { userId } = await auth()
  if (!userId) redirect('/dashboard')

  const currentUser = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  })
  if (!currentUser || currentUser.role !== 'admin') redirect('/dashboard')

  // Fetch profile + engagement data in parallel (D-07)
  const [profile, userFeedback, [feedbackCountResult]] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, id) }),

    // Recent feedback (D-07) -- last 20 items
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

    // Total feedback count for engagement score
    db.select({ cnt: count() }).from(feedbackItems).where(eq(feedbackItems.submitterId, id)),
  ])

  if (!profile) {
    redirect('/users')
  }

  // Workshop attendance: workshopRegistrations table not yet available (Plan 01 deviation)
  // Empty array for stable UI shape -- will wire when schema exists
  const attendedWorkshops: { workshopId: string; title: string; scheduledAt: Date; attendedAt: Date | null; status: string }[] = []

  // Engagement score = feedbackCount (+ attendedWorkshopCount when workshopRegistrations exists) (D-01)
  const engagementScore = (feedbackCountResult?.cnt ?? 0) + attendedWorkshops.length

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
          <CardTitle>
            <h2 className="text-xl font-semibold">Feedback Submitted</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {userFeedback.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No feedback submitted yet.
            </p>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
