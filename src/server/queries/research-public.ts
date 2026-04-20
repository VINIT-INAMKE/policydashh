/**
 * Phase 28 Plan 28-01 — public /research/items query helper (RESEARCH-09 + RESEARCH-10).
 *
 * NOT a tRPC procedure: the public listing + detail are server-rendered and
 * bypass tRPC entirely because listPublic/getById in src/server/routers/research.ts
 * are protectedProcedure (STATE.md Phase 26 Plan 26-05 line: "Phase 28 will expose
 * truly public routes via direct server-component DB queries, matching the existing
 * /portal pattern"). This helper is the documented bypass.
 *
 * Caching (28-RESEARCH.md Pattern 2):
 *   - unstable_cache is deprecated but still functional in Next.js 16. The
 *     alternative, 'use cache', requires cacheComponents: true in next.config.ts
 *     which this project does NOT enable. workshops-public.ts uses the same
 *     pattern since Phase 20.
 *   - revalidate: 60s keeps listing/detail fresh without hammering the DB on
 *     every request. Cache keyed on JSON.stringify(opts) so every filter combo
 *     gets its own bucket.
 *
 * Leak prevention (28-RESEARCH.md Pitfall 6):
 *   - Column projection EXCLUDES the audit-trail and chain-anchoring columns
 *     (author identity, reviewer identity, content/transaction hashes, anchor
 *     timestamps, milestone linkage). These fields exist in the DB but never
 *     appear in the public surface.
 *   - Pitfall 5 anonymous-author filter: rows.map(r => r.isAuthorAnonymous
 *     ? { ...r, authors: null } : r). Applied at the query boundary so no
 *     caller can accidentally leak the authors array on a flagged item.
 *   - Feedback link table is NEVER joined here (Pitfall 6). Sections + versions
 *     only.
 */
import { unstable_cache } from 'next/cache'
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/src/db'
import {
  researchItems,
  researchItemSectionLinks,
  researchItemVersionLinks,
} from '@/src/db/schema/research'
import { policyDocuments, policySections } from '@/src/db/schema/documents'
import { documentVersions } from '@/src/db/schema/changeRequests'

export const PAGE_SIZE = 40

export type ResearchItemType =
  | 'report' | 'paper' | 'dataset' | 'memo'
  | 'interview_transcript' | 'media_coverage'
  | 'legal_reference' | 'case_study'

export type SortDirection = 'newest' | 'oldest'

export interface PublicResearchItem {
  id: string
  readableId: string
  documentId: string
  title: string
  itemType: ResearchItemType
  description: string | null
  externalUrl: string | null
  artifactId: string | null
  doi: string | null
  authors: string[] | null
  publishedDate: string | null
  peerReviewed: boolean
  journalOrSource: string | null
  versionLabel: string | null
  previousVersionId: string | null
  isAuthorAnonymous: boolean
  retractionReason: string | null
  // NOTE: author/reviewer identity, review timestamp, content/tx hashes,
  //       anchor timestamp, milestone linkage, internal status — all
  //       intentionally EXCLUDED from this public type.
}

export interface ListPublishedOpts {
  documentId?: string
  itemType?: ResearchItemType
  from?: string          // ISO YYYY-MM-DD
  to?: string            // ISO YYYY-MM-DD
  sort: SortDirection
  offset: number
}

const PUBLIC_COLUMNS = {
  id:                researchItems.id,
  readableId:        researchItems.readableId,
  documentId:        researchItems.documentId,
  title:             researchItems.title,
  itemType:          researchItems.itemType,
  description:       researchItems.description,
  externalUrl:       researchItems.externalUrl,
  artifactId:        researchItems.artifactId,
  doi:               researchItems.doi,
  authors:           researchItems.authors,
  publishedDate:     researchItems.publishedDate,
  peerReviewed:      researchItems.peerReviewed,
  journalOrSource:   researchItems.journalOrSource,
  versionLabel:      researchItems.versionLabel,
  previousVersionId: researchItems.previousVersionId,
  isAuthorAnonymous: researchItems.isAuthorAnonymous,
  retractionReason:  researchItems.retractionReason,
} as const

/**
 * RESEARCH-09: list published research items with filters + sort + offset pagination.
 */
export async function listPublishedResearchItems(
  opts: ListPublishedOpts,
): Promise<{ items: PublicResearchItem[]; total: number }> {
  const cacheKey = ['research-items-public', 'list', JSON.stringify(opts)]
  const fn = unstable_cache(
    async () => {
      const conditions = [eq(researchItems.status, 'published')]
      if (opts.documentId) conditions.push(eq(researchItems.documentId, opts.documentId))
      if (opts.itemType)   conditions.push(eq(researchItems.itemType, opts.itemType))
      if (opts.from)       conditions.push(gte(researchItems.publishedDate, opts.from))
      if (opts.to)         conditions.push(lte(researchItems.publishedDate, opts.to))

      // Total count — same conditions, no limit/offset
      const [countRow] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(researchItems)
        .where(and(...conditions))
      const total = Number(countRow?.n ?? 0)

      // Sort direction (Pattern 2)
      const orderClauses = opts.sort === 'oldest'
        ? [asc(researchItems.publishedDate), asc(researchItems.createdAt)]
        : [desc(researchItems.publishedDate), desc(researchItems.createdAt)]

      const rows = await db
        .select(PUBLIC_COLUMNS)
        .from(researchItems)
        .where(and(...conditions))
        .orderBy(...orderClauses)
        .limit(PAGE_SIZE)
        .offset(Math.max(0, opts.offset))

      // Pitfall 5: anonymous filter at query boundary
      const items: PublicResearchItem[] = rows.map((r) =>
        r.isAuthorAnonymous ? { ...r, authors: null } : r,
      )

      return { items, total }
    },
    cacheKey,
    { revalidate: 60 },
  )
  return fn()
}

/**
 * RESEARCH-10: fetch a single published research item by id. Returns null
 * when status != 'published' (NEVER leak draft/pending_review/retracted to public).
 */
export async function getPublishedResearchItem(id: string): Promise<PublicResearchItem | null> {
  const cacheKey = ['research-items-public', 'detail', id]
  const fn = unstable_cache(
    async () => {
      const [row] = await db
        .select(PUBLIC_COLUMNS)
        .from(researchItems)
        .where(and(eq(researchItems.id, id), eq(researchItems.status, 'published')))
        .limit(1)
      if (!row) return null
      return row.isAuthorAnonymous ? { ...row, authors: null } : row
    },
    cacheKey,
    { revalidate: 60 },
  )
  return fn()
}

/**
 * RESEARCH-10: linked sections for the detail page. Inner-joins policySections
 * + policyDocuments so the caller has documentId + documentTitle for the
 * /framework/{docId}#section-{sectionId} deep-link. Never joins the feedback
 * link table (Pitfall 6).
 */
export async function listLinkedSectionsForResearchItem(researchItemId: string) {
  return db
    .select({
      sectionId:     researchItemSectionLinks.sectionId,
      sectionTitle:  policySections.title,
      documentId:    policySections.documentId,
      documentTitle: policyDocuments.title,
      relevanceNote: researchItemSectionLinks.relevanceNote,
    })
    .from(researchItemSectionLinks)
    .innerJoin(policySections, eq(researchItemSectionLinks.sectionId, policySections.id))
    .innerJoin(policyDocuments, eq(policySections.documentId, policyDocuments.id))
    .where(eq(researchItemSectionLinks.researchItemId, researchItemId))
}

/**
 * RESEARCH-10: linked versions for the detail page. Filters isPublished=true
 * to avoid dead /portal/{docId}?v=<label> deep-links (OQ2 resolution).
 */
export async function listLinkedVersionsForResearchItem(researchItemId: string) {
  return db
    .select({
      versionId:     researchItemVersionLinks.versionId,
      versionLabel:  documentVersions.versionLabel,
      documentId:    documentVersions.documentId,
      documentTitle: policyDocuments.title,
      publishedAt:   documentVersions.publishedAt,
    })
    .from(researchItemVersionLinks)
    .innerJoin(documentVersions, eq(researchItemVersionLinks.versionId, documentVersions.id))
    .innerJoin(policyDocuments, eq(documentVersions.documentId, policyDocuments.id))
    .where(and(
      eq(researchItemVersionLinks.researchItemId, researchItemId),
      eq(documentVersions.isPublished, true),
    ))
}
