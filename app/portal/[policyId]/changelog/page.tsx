export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/src/db'
import { policyDocuments } from '@/src/db/schema/documents'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { eq, and, desc } from 'drizzle-orm'
import { format } from 'date-fns'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import type { SectionSnapshot, ChangelogEntry } from '@/src/server/services/version.service'

export default async function PublicChangelogPage({
  params,
}: {
  params: Promise<{ policyId: string }>
}) {
  const { policyId } = await params

  // Query policy for title
  const policy = await db.query.policyDocuments.findFirst({
    where: eq(policyDocuments.id, policyId),
  })
  if (!policy) {
    notFound()
  }

  // SECURITY: Query only published versions (server-side filter, not client-side)
  const publishedVersions = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.documentId, policyId),
        eq(documentVersions.isPublished, true),
      ),
    )
    .orderBy(desc(documentVersions.publishedAt))

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
          {policy.title} &mdash; Changelog
        </h1>
      </div>

      {publishedVersions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <BookOpen className="size-12 text-muted-foreground" />
          <h2 className="text-lg font-semibold">No changelog available</h2>
          <p className="text-sm text-muted-foreground">
            No changelog available for this policy version.
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {publishedVersions.map((version, index) => {
            const changelog = (version.changelog as ChangelogEntry[] | null) ?? []
            const sectionsSnapshot = (version.sectionsSnapshot as SectionSnapshot[] | null) ?? []

            // Build sectionId -> title map for resolving affected sections
            const sectionTitleMap = new Map(
              sectionsSnapshot.map((s) => [s.sectionId, s.title])
            )

            return (
              <div key={version.id}>
                <div className="space-y-3 py-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-[20px] font-semibold leading-[1.2]">
                      Version {version.versionLabel}
                    </h2>
                    <span className="inline-flex items-center rounded-full bg-[var(--status-cr-merged-bg)] px-2 py-0.5 text-xs font-medium text-[var(--status-cr-merged-text)]">
                      Published
                    </span>
                  </div>
                  <time className="block text-xs text-muted-foreground">
                    Published {format(new Date(version.publishedAt ?? version.createdAt), 'MMM d, yyyy')}
                  </time>

                  {/* Merge summary */}
                  {version.mergeSummary && (
                    <p className="text-sm">{version.mergeSummary}</p>
                  )}

                  {/* Changelog entries -- PRIVACY: Only show summary and affected section titles */}
                  {changelog.length > 0 && (
                    <div className="space-y-3 mt-4">
                      {changelog.map((entry, entryIdx) => {
                        // Resolve section titles from affectedSectionIds
                        const affectedTitles = entry.affectedSectionIds
                          .map((sid) => sectionTitleMap.get(sid))
                          .filter(Boolean) as string[]

                        return (
                          <div key={entryIdx} className="space-y-1">
                            {/* PRIVACY (PUB-05): Only render entry.summary -- NO crReadableId, crTitle, feedbackIds */}
                            <p className="text-sm">{entry.summary}</p>
                            {affectedTitles.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Sections updated: {affectedTitles.join(', ')}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                {index < publishedVersions.length - 1 && <Separator />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
