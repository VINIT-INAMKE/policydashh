import Link from 'next/link'
import { db } from '@/src/db'
import {
  users,
  policyDocuments,
  documentVersions,
  feedbackItems,
} from '@/src/db/schema'
import { eq, inArray, count, sql } from 'drizzle-orm'
import { Users, FileText, BookOpen, MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatCard } from './stat-card'
import { format } from 'date-fns'

interface AdminDashboardProps {
  userId: string
}

const ROLE_DISPLAY: Record<string, string> = {
  admin: 'Admin',
  policy_lead: 'Policy Lead',
  research_lead: 'Research Lead',
  workshop_moderator: 'Workshop Moderator',
  stakeholder: 'Stakeholder',
  observer: 'Observer',
  auditor: 'Auditor',
}

export async function AdminDashboard({ userId }: AdminDashboardProps) {
  const [
    [totalUsersResult],
    [activePoliciesResult],
    [openFeedbackResult],
    versionsReadyToPublish,
    usersByRole,
  ] = await Promise.all([
    db.select({ count: count() }).from(users),

    db.select({ count: count() }).from(policyDocuments),

    db.select({ count: count() }).from(feedbackItems)
      .where(inArray(feedbackItems.status, ['submitted', 'under_review'])),

    db
      .select({
        id: documentVersions.id,
        documentId: documentVersions.documentId,
        versionLabel: documentVersions.versionLabel,
        createdAt: documentVersions.createdAt,
        policyTitle: policyDocuments.title,
      })
      .from(documentVersions)
      .innerJoin(policyDocuments, eq(documentVersions.documentId, policyDocuments.id))
      .where(eq(documentVersions.isPublished, false)),

    db
      .select({
        role: users.role,
        count: sql<number>`count(*)::int`,
      })
      .from(users)
      .groupBy(users.role),
  ])

  const totalUsers = totalUsersResult?.count ?? 0
  const activePolicies = activePoliciesResult?.count ?? 0
  const openFeedback = openFeedbackResult?.count ?? 0
  const versionsCount = versionsReadyToPublish.length

  return (
    <div className="space-y-4">
      {/* Stat row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Users className="size-5" />} value={totalUsers} label="Total Users" />
        <StatCard icon={<FileText className="size-5" />} value={activePolicies} label="Active Policies" />
        <StatCard icon={<BookOpen className="size-5" />} value={versionsCount} label="Versions Ready to Publish" />
        <StatCard icon={<MessageSquare className="size-5" />} value={openFeedback} label="Open Feedback" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        {/* Left column */}
        <div className="space-y-4">
          {/* Ready to Publish */}
          <Card>
            <CardHeader>
              <CardTitle>
                <h2 className="text-xl font-semibold">Ready to Publish</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {versionsReadyToPublish.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <BookOpen className="size-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No versions awaiting publication.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {versionsReadyToPublish.map((version) => (
                    <div key={version.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{version.policyTitle}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono">
                            {version.versionLabel}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(version.createdAt), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        render={<Link href={`/policies/${version.documentId}/versions`} />}
                      >
                        Publish
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  <h2 className="text-xl font-semibold">User Management</h2>
                </CardTitle>
                {/* TODO: Replace /dashboard with /users once User Management page is built */}
                <Button size="sm" render={<Link href="/dashboard" />}>
                  Manage Users
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(ROLE_DISPLAY).map(([roleKey, roleLabel]) => {
                  const roleData = usersByRole.find((r) => r.role === roleKey)
                  const roleCount = roleData?.count ?? 0
                  return (
                    <div key={roleKey} className="flex items-center justify-between rounded-md px-2 py-1.5">
                      <span className="text-sm">{roleLabel}</span>
                      <Badge variant="secondary">{roleCount} users</Badge>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column is empty for now -- stat cards cover the admin stats area */}
        <div />
      </div>
    </div>
  )
}
