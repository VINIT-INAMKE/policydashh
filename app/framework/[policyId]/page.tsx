export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { eq, and, desc, asc } from 'drizzle-orm'
import { db } from '@/src/db'
import { policyDocuments, policySections } from '@/src/db/schema/documents'
import { documentVersions } from '@/src/db/schema/changeRequests'
import {
  getSectionPublicStatuses,
  buildFrameworkLog,
} from '@/src/server/services/framework-log.service'
import type { SectionSnapshot } from '@/src/server/services/version.service'
import { PublicPolicyContent } from '@/app/portal/[policyId]/_components/public-policy-content'
import { PublicSectionNav } from '@/app/portal/[policyId]/_components/public-section-nav'
import { WhatChangedLog } from '../_components/what-changed-log'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function FrameworkDetailPage({
  params,
}: {
  params: Promise<{ policyId: string }>
}) {
  const { policyId } = await params

  if (!UUID_REGEX.test(policyId)) notFound()

  const [doc] = await db
    .select()
    .from(policyDocuments)
    .where(
      and(
        eq(policyDocuments.id, policyId),
        eq(policyDocuments.isPublicDraft, true),
      ),
    )
    .limit(1)

  if (!doc) notFound()

  // Same data-loading sequence as /framework single-doc render
  const draftVersion = await db
    .select()
    .from(documentVersions)
    .where(
      and(eq(documentVersions.documentId, doc.id), eq(documentVersions.isPublished, false)),
    )
    .orderBy(desc(documentVersions.createdAt))
    .limit(1)
    .then((r) => r[0] ?? null)

  const publishedVersions = await db
    .select()
    .from(documentVersions)
    .where(
      and(eq(documentVersions.documentId, doc.id), eq(documentVersions.isPublished, true)),
    )

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

  const sectionStatuses = await getSectionPublicStatuses(doc.id, publishedVersions)
  const logEntries = buildFrameworkLog(publishedVersions)

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
    </div>
  )
}
