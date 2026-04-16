import Link from 'next/link'
import { db } from '@/src/db'
import { workshops, workshopArtifacts } from '@/src/db/schema/workshops'
import { gte, lt, count, desc } from 'drizzle-orm'
import { Calendar, Paperclip, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatCard } from './stat-card'
import { format } from 'date-fns'

interface WorkshopModeratorDashboardProps {
  userId: string
}

export async function WorkshopModeratorDashboard({ userId }: WorkshopModeratorDashboardProps) {
  const now = new Date()

  const [upcomingWorkshops, pastWorkshops, [artifactCountResult], [upcomingCountResult]] = await Promise.all([
    db
      .select({
        id: workshops.id,
        title: workshops.title,
        description: workshops.description,
        scheduledAt: workshops.scheduledAt,
        durationMinutes: workshops.durationMinutes,
      })
      .from(workshops)
      .where(gte(workshops.scheduledAt, now))
      .orderBy(workshops.scheduledAt)
      .limit(5),

    db
      .select({
        id: workshops.id,
        title: workshops.title,
        scheduledAt: workshops.scheduledAt,
        durationMinutes: workshops.durationMinutes,
      })
      .from(workshops)
      .where(lt(workshops.scheduledAt, now))
      .orderBy(desc(workshops.scheduledAt))
      .limit(5),

    db.select({ count: count() }).from(workshopArtifacts),

    db.select({ count: count() }).from(workshops)
      .where(gte(workshops.scheduledAt, now)),
  ])

  const totalArtifacts = artifactCountResult?.count ?? 0
  const upcomingCount = upcomingCountResult?.count ?? 0

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Stat row */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={<Calendar className="size-5" />} value={upcomingCount} label="Upcoming Workshops" />
        <StatCard icon={<Paperclip className="size-5" />} value={totalArtifacts} label="Total Artifacts" />
      </div>

      {/* Upcoming Workshops */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              <h2 className="text-xl font-semibold">Upcoming Workshops</h2>
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" render={<Link href="/workshop-manage/new" />}>
                <Plus className="size-4" />
                Create Workshop
              </Button>
              <Button variant="outline" size="sm" render={<Link href="/workshop-manage" />}>
                View All
              </Button>
            </div>
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
                  <Badge variant="secondary">Upcoming</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past Workshops */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-xl font-semibold">Past Workshops</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pastWorkshops.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="size-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No past workshops yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pastWorkshops.map((ws) => (
                <Link key={ws.id} href={`/workshop-manage/${ws.id}`} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                  <Calendar className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{ws.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(ws.scheduledAt), 'MMM d, yyyy h:mm a')}
                      {ws.durationMinutes ? ` (${ws.durationMinutes} min)` : ''}
                    </p>
                  </div>
                  <Badge variant="outline">Completed</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
