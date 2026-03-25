import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/src/db'
import { policyDocuments } from '@/src/db/schema/documents'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { eq, desc } from 'drizzle-orm'
import { format } from 'date-fns'
import { ArrowLeft, Download, History, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VersionStatusBadge } from '@/app/(workspace)/policies/[id]/versions/_components/version-status-badge'
import { PublicVersionSelector } from './_components/public-version-selector'
import { PublicSectionNav } from './_components/public-section-nav'
import { PublicPolicyContent } from './_components/public-policy-content'
import type { SectionSnapshot } from '@/src/server/services/version.service'

export default async function PublicPolicyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ policyId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { policyId } = await params
  const query = await searchParams
  const versionParam = typeof query.version === 'string' ? query.version : undefined

  // Query the policy document
  const policy = await db.query.policyDocuments.findFirst({
    where: eq(policyDocuments.id, policyId),
  })
  if (!policy) {
    notFound()
  }

  // Query all published versions
  const publishedVersions = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documentId, policyId))
    .orderBy(desc(documentVersions.publishedAt))

  const published = publishedVersions.filter((v) => v.isPublished)

  if (published.length === 0) {
    return (
      <div className="space-y-6">
        <Link href="/portal" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          All Published Policies
        </Link>
        <h1 className="text-[28px] font-semibold leading-[1.2]">{policy.title}</h1>
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">No published versions available for this policy.</p>
        </div>
      </div>
    )
  }

  // Select version: either from query param or latest
  const selectedVersion = versionParam
    ? published.find((v) => v.id === versionParam) ?? published[0]
    : published[0]

  const sections = (selectedVersion.sectionsSnapshot as SectionSnapshot[] | null) ?? []
  const sortedSections = [...sections].sort((a, b) => a.orderIndex - b.orderIndex)

  const versionOptions = published.map((v) => ({
    id: v.id,
    versionLabel: v.versionLabel,
    publishedAt: v.publishedAt?.toISOString() ?? new Date().toISOString(),
  }))

  const sectionNavItems = sortedSections.map((s) => ({
    sectionId: s.sectionId,
    title: s.title,
  }))

  return (
    <div className="space-y-6">
      <Link href="/portal" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        All Published Policies
      </Link>

      <div className="space-y-2">
        <h1 className="text-[28px] font-semibold leading-[1.2]">{policy.title}</h1>
        {policy.description && (
          <p className="text-sm text-muted-foreground">{policy.description}</p>
        )}
      </div>

      {/* Version selector row */}
      <div className="flex flex-wrap items-center gap-3">
        <PublicVersionSelector
          versions={versionOptions}
          currentVersionId={selectedVersion.id}
          policyId={policyId}
        />
        <VersionStatusBadge isPublished={true} />
        <time className="text-xs text-muted-foreground">
          Published {format(new Date(selectedVersion.publishedAt ?? selectedVersion.createdAt), 'MMM d, yyyy')}
        </time>
        <div className="flex items-center gap-2 ml-auto">
          <a href={`/api/export/policy-pdf/${selectedVersion.id}`} download>
            <Button variant="default" size="sm">
              <Download className="size-3.5" data-icon="inline-start" />
              Download PDF
            </Button>
          </a>
          <Link href={`/portal/${policyId}/changelog`}>
            <Button variant="ghost" size="sm">
              <History className="size-3.5" data-icon="inline-start" />
              View Changelog
            </Button>
          </Link>
          <Link href={`/portal/${policyId}/consultation-summary`}>
            <Button variant="ghost" size="sm">
              <Users className="size-3.5" data-icon="inline-start" />
              Consultation Summary
            </Button>
          </Link>
        </div>
      </div>

      {/* Two-column layout: section nav + content */}
      <div className="flex gap-8">
        {/* Desktop section nav -- sticky, 240px, hidden on mobile */}
        <div className="hidden lg:block w-[240px] shrink-0">
          <PublicSectionNav sections={sectionNavItems} />
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          {/* Mobile section select -- only visible below lg */}
          <PublicSectionNav sections={sectionNavItems} mobile />

          {/* Content area */}
          <PublicPolicyContent sections={sortedSections} />
        </div>
      </div>
    </div>
  )
}
