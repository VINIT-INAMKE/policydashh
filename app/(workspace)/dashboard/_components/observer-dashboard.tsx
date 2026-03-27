import Link from 'next/link'
import { db } from '@/src/db'
import { policyDocuments, documentVersions, feedbackItems } from '@/src/db/schema'
import { eq, desc, sql, inArray } from 'drizzle-orm'
import { BookOpen, MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatCard } from './stat-card'
import { format } from 'date-fns'

interface ObserverDashboardProps {
  userId: string
}

export async function ObserverDashboard({ userId }: ObserverDashboardProps) {
  const [publishedPolicies, [openConsultationsResult]] = await Promise.all([
    // Policies with at least one published version, including latest version info
    db
      .select({
        id: policyDocuments.id,
        title: policyDocuments.title,
        versionLabel: documentVersions.versionLabel,
        publishedAt: documentVersions.publishedAt,
        versionId: documentVersions.id,
      })
      .from(policyDocuments)
      .innerJoin(documentVersions, eq(policyDocuments.id, documentVersions.documentId))
      .where(eq(documentVersions.isPublished, true))
      .orderBy(desc(documentVersions.publishedAt)),

    // Count policies with open feedback (submitted or under_review)
    db
      .select({
        count: sql<number>`count(distinct ${feedbackItems.documentId})::int`,
      })
      .from(feedbackItems)
      .where(inArray(feedbackItems.status, ['submitted', 'under_review'])),
  ])

  // Deduplicate to show only latest published version per policy
  const seenPolicies = new Set<string>()
  const uniquePublishedPolicies = publishedPolicies.filter((p) => {
    if (seenPolicies.has(p.id)) return false
    seenPolicies.add(p.id)
    return true
  })

  const openConsultations = openConsultationsResult?.count ?? 0

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Stat row */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={<BookOpen className="size-5" />} value={uniquePublishedPolicies.length} label="Published Policies" />
        <StatCard icon={<MessageSquare className="size-5" />} value={openConsultations} label="Open Consultations" />
      </div>

      {/* Published Policies */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-xl font-semibold">Published Policies</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {uniquePublishedPolicies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BookOpen className="size-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No published policies yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {uniquePublishedPolicies.map((policy) => (
                <div key={policy.versionId} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{policy.title}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono">
                        {policy.versionLabel}
                      </Badge>
                      {policy.publishedAt && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(policy.publishedAt), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" render={<Link href={`/portal/${policy.id}`} />}>
                    View
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
