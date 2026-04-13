import Link from 'next/link'
import { db } from '@/src/db'
import { auditEvents, users } from '@/src/db/schema'
import { count, desc, sql, gt } from 'drizzle-orm'
import { Activity, Shield, Download, FileArchive } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatCard } from './stat-card'
import { formatDistanceToNow } from 'date-fns'
import { EvidencePackDialog } from '@/app/(workspace)/audit/_components/evidence-pack-dialog'

interface AuditorDashboardProps {
  userId: string
}

export async function AuditorDashboard({ userId }: AuditorDashboardProps) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [recentAuditEvents, [auditCount7dResult], [totalAuditResult]] = await Promise.all([
    db
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        actorId: auditEvents.actorId,
        actorRole: auditEvents.actorRole,
        entityType: auditEvents.entityType,
        entityId: auditEvents.entityId,
        timestamp: auditEvents.timestamp,
      })
      .from(auditEvents)
      .orderBy(desc(auditEvents.timestamp))
      .limit(10),

    db.select({ count: count() }).from(auditEvents)
      .where(gt(auditEvents.timestamp, sevenDaysAgo)),

    db.select({ count: count() }).from(auditEvents),
  ])

  const auditCount7d = auditCount7dResult?.count ?? 0
  const totalAuditCount = totalAuditResult?.count ?? 0

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Stat row */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={<Activity className="size-5" />} value={auditCount7d} label="Audit Events (last 7 days)" />
        <StatCard icon={<Shield className="size-5" />} value={totalAuditCount} label="Total Audit Events" />
      </div>

      {/* Recent Audit Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              <h2 className="text-xl font-semibold">Recent Audit Activity</h2>
            </CardTitle>
            <Button size="sm" render={<Link href="/audit" />}>
              View Full Audit Trail
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentAuditEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Shield className="size-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No audit events recorded yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentAuditEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                  <Badge variant="secondary" className="shrink-0">
                    {event.action}
                  </Badge>
                  <span className="text-sm">{event.actorRole}</span>
                  <p className="min-w-0 flex-1 truncate text-sm">
                    {event.entityType} {event.entityId.slice(0, 8)}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Controls */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-xl font-semibold">Export Controls</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" render={<a href="/api/export/traceability/csv" download />}>
              <Download className="size-4" />
              Export Audit Log (CSV)
            </Button>
            <EvidencePackDialog
              trigger={
                <Button variant="outline" size="sm">
                  <FileArchive className="size-4" />
                  Export Evidence Pack (ZIP)
                </Button>
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
