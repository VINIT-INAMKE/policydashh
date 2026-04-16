export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { FileText } from 'lucide-react'
import { eq, and, desc, asc } from 'drizzle-orm'
import { db } from '@/src/db'
import { policyDocuments, policySections } from '@/src/db/schema/documents'
import { documentVersions } from '@/src/db/schema/changeRequests'
import {
  getSectionPublicStatuses,
  buildFrameworkLog,
} from '@/src/server/services/framework-log.service'
import type { SectionSnapshot } from '@/src/server/services/version.service'
import { PublicPolicyContent } from '@/app/(public)/portal/[policyId]/_components/public-policy-content'
import { PublicSectionNav } from '@/app/(public)/portal/[policyId]/_components/public-section-nav'
import { WhatChangedLog } from './_components/what-changed-log'
import { FrameworkSummaryBlock } from './_components/framework-summary-block'
import type { ConsultationSummaryJson } from '@/src/server/services/consultation-summary.service'

async function renderFrameworkDetail(doc: typeof policyDocuments.$inferSelect) {
  // 1. Load most recent non-published draft version
  const draftVersion = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.documentId, doc.id),
        eq(documentVersions.isPublished, false),
      ),
    )
    .orderBy(desc(documentVersions.createdAt))
    .limit(1)
    .then((r) => r[0] ?? null)

  // 2. Load all published versions (for status + log)
  const publishedVersions = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.documentId, doc.id),
        eq(documentVersions.isPublished, true),
      ),
    )

  // 3. Resolve sections from draft snapshot OR live policy_sections fallback (D-07)
  let sections: SectionSnapshot[]
  if (draftVersion?.sectionsSnapshot) {
    sections = [...((draftVersion.sectionsSnapshot as SectionSnapshot[]) ?? [])].sort(
      (a, b) => a.orderIndex - b.orderIndex,
    )
  } else {
    const rows = await db
      .select({
        id: policySections.id,
        title: policySections.title,
        orderIndex: policySections.orderIndex,
        content: policySections.content,
      })
      .from(policySections)
      .where(eq(policySections.documentId, doc.id))
      .orderBy(asc(policySections.orderIndex))
    sections = rows.map((r) => ({
      sectionId: r.id,
      title: r.title,
      orderIndex: r.orderIndex,
      content: r.content,
    }))
  }

  // 4. Derive section statuses (one extra drizzle query inside the helper)
  const sectionStatuses = await getSectionPublicStatuses(doc.id, publishedVersions)

  // 5. Build the what-changed log (pure TS)
  const logEntries = buildFrameworkLog(publishedVersions)

  // Phase 21 D-18: find the latest published version's approved
  // consultation summary (if any). NULL/no-approved-sections silently
  // omits the FrameworkSummaryBlock - no placeholder on /framework.
  const latestPublished = [...publishedVersions].sort((a, b) => {
    const aTime = a.publishedAt?.getTime() ?? 0
    const bTime = b.publishedAt?.getTime() ?? 0
    return bTime - aTime
  })[0]
  const latestSummary =
    (latestPublished?.consultationSummary as ConsultationSummaryJson | null) ?? null

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <header className="mb-8">
        <h1 className="text-[28px] font-semibold leading-[1.2] mb-2">{doc.title}</h1>
        {doc.description && (
          <p className="text-sm text-muted-foreground">{doc.description}</p>
        )}
        <p className="text-sm text-muted-foreground mt-2">
          Draft Policy Framework under public consultation
        </p>
      </header>

      <div className="flex gap-8">
        <aside className="hidden lg:block w-[240px] shrink-0">
          <PublicSectionNav sections={sections} />
        </aside>
        <main className="flex-1 min-w-0">
          <PublicPolicyContent sections={sections} sectionStatuses={sectionStatuses} />
        </main>
      </div>

      <hr className="border-border my-12" />

      <section className="mx-auto max-w-3xl">
        <h2 className="text-[20px] font-semibold leading-[1.2] mb-2">What Changed</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Recent updates to the framework
        </p>
        <WhatChangedLog entries={logEntries} />
      </section>

      <FrameworkSummaryBlock summary={latestSummary} />
    </div>
  )
}

export default async function FrameworkPage() {
  const publicDrafts = await db
    .select()
    .from(policyDocuments)
    .where(eq(policyDocuments.isPublicDraft, true))

  // Empty state
  if (publicDrafts.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <FileText className="size-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-[28px] font-semibold leading-[1.2] mb-2">
          No drafts under consultation
        </h1>
        <p className="text-sm text-muted-foreground">
          No framework documents are currently open for public review.
        </p>
      </div>
    )
  }

  // Single-doc inline render per D-03
  if (publicDrafts.length === 1) {
    return renderFrameworkDetail(publicDrafts[0])
  }

  // Multi-doc card list per D-03
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <header className="mb-8">
        <h1 className="text-[28px] font-semibold leading-[1.2] mb-2">
          Frameworks under consultation
        </h1>
        <p className="text-sm text-muted-foreground">
          Select a draft framework to view sections and recent changes.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {publicDrafts.map((doc) => (
          <Link key={doc.id} href={`/framework/${doc.id}`} className="block">
            <div className="rounded-lg border bg-card p-6 space-y-2 hover:border-foreground transition-colors">
              <h2 className="text-[20px] font-semibold leading-[1.2]">{doc.title}</h2>
              {doc.description && (
                <p className="text-sm text-muted-foreground line-clamp-3">{doc.description}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
