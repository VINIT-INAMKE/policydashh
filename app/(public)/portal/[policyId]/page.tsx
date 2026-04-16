export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/src/db'
import { policyDocuments } from '@/src/db/schema/documents'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { milestones } from '@/src/db/schema/milestones'
import { eq, and, desc } from 'drizzle-orm'
import { format } from 'date-fns'
import { ArrowLeft, Download, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VersionStatusBadge } from '@/app/(workspace)/policies/[id]/versions/_components/version-status-badge'
import { PublicVersionSelector } from './_components/public-version-selector'
import { VerifiedBadge } from './_components/verified-badge'
import { PublicSectionNav } from './_components/public-section-nav'
import { PublicPolicyContent } from './_components/public-policy-content'
import type { SectionSnapshot } from '@/src/server/services/version.service'
import type {
  ConsultationSummaryJson,
  ApprovedSummarySection,
} from '@/src/server/services/consultation-summary.service'

// SECURITY: Validate UUID format to prevent Postgres errors
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

  // SECURITY: Validate UUID format before hitting Postgres
  if (!UUID_REGEX.test(policyId)) {
    notFound()
  }

  // SECURITY: Query published versions FIRST to avoid leaking policy info for unpublished policies
  const published = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.documentId, policyId),
        eq(documentVersions.isPublished, true),
      ),
    )
    .orderBy(desc(documentVersions.publishedAt))

  // Only show policy info if at least one published version exists
  if (published.length === 0) {
    notFound()
  }

  // Query the policy document (safe now -- we know published versions exist)
  const policy = await db.query.policyDocuments.findFirst({
    where: eq(policyDocuments.id, policyId),
  })
  if (!policy) {
    notFound()
  }

  // Select version: either from query param or latest
  const selectedVersion = versionParam
    ? published.find((v) => v.id === versionParam) ?? published[0]
    : published[0]

  const sections = (selectedVersion.sectionsSnapshot as SectionSnapshot[] | null) ?? []
  const sortedSections = [...sections].sort((a, b) => a.orderIndex - b.orderIndex)

  // Phase 21 D-15: build the public-safe projection from the selected
  // version's consultationSummary JSONB. Strip every internal-only field
  // (the raw JSONB carries per-section generation metadata + provenance IDs)
  // so only `ApprovedSummarySection` crosses into the public component
  // tree (Phase 21 Pitfall 1 - privacy enforcement).
  const consultationSummary =
    (selectedVersion.consultationSummary as ConsultationSummaryJson | null) ?? null

  let sectionSummaries: Map<string, ApprovedSummarySection> | undefined
  let sectionsWithEntry: Set<string> | undefined
  if (consultationSummary) {
    sectionsWithEntry = new Set(consultationSummary.sections.map((s) => s.sectionId))
    sectionSummaries = new Map()
    for (const s of consultationSummary.sections) {
      if (s.status === 'approved') {
        sectionSummaries.set(s.sectionId, {
          sectionId:    s.sectionId,
          sectionTitle: s.sectionTitle,
          summary:      s.summary,
        })
      }
    }
  }

  const versionOptions = published.map((v) => ({
    id: v.id,
    versionLabel: v.versionLabel,
    publishedAt: v.publishedAt?.toISOString() ?? new Date().toISOString(),
    txHash: v.txHash,
  }))

  // Phase 23 VERIFY-09: query anchored milestones for this policy
  const anchoredMilestones = await db
    .select({
      id: milestones.id,
      title: milestones.title,
      txHash: milestones.txHash,
      anchoredAt: milestones.anchoredAt,
    })
    .from(milestones)
    .where(
      and(
        eq(milestones.documentId, policyId),
        eq(milestones.status, 'anchored'),
      ),
    )

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
        <VerifiedBadge txHash={selectedVersion.txHash} />
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
        </div>
      </div>

      {/* Phase 23 VERIFY-09: Milestone verification section */}
      {anchoredMilestones.length > 0 ? (
        <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Verification</h3>
          <div className="space-y-1.5">
            {anchoredMilestones.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-sm">
                <span className="text-foreground">{m.title}</span>
                <VerifiedBadge txHash={m.txHash} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

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
          <PublicPolicyContent
            sections={sortedSections}
            sectionSummaries={sectionSummaries}
            sectionsWithEntry={sectionsWithEntry}
          />
        </div>
      </div>
    </div>
  )
}
