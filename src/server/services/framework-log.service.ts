import { changeRequests, crSectionLinks, documentVersions } from '@/src/db/schema/changeRequests'
import { eq, and, inArray } from 'drizzle-orm'
import type { ChangelogEntry, SectionSnapshot } from './version.service'

/**
 * Phase 20.5 — public framework log + section status derivation.
 *
 * PUB-07: three-state precedence (validated > under_review > draft).
 * PUB-08: 20-entry cap, newest first, PUB-05 privacy (no CR/feedback identifiers).
 */

export type SectionStatus = 'draft' | 'under_review' | 'validated'

export interface PublicLogEntry {
  sectionTitle: string // MUST be resolved title, never raw sectionId
  mergeDate: string // ISO date string
  summary: string // entry.summary ONLY — PUB-05 privacy
}

/**
 * Derive public section statuses for a document.
 * Returns a Map<sectionId, SectionStatus> with precedence:
 *   validated > under_review > draft.
 *
 * - Validated set: pure TS scan of the passed-in publishedVersions array.
 * - Under review set: ONE drizzle query joining changeRequests + crSectionLinks.
 * - Unknown section ids fall back to 'draft' via a .get() override.
 */
export async function getSectionPublicStatuses(
  documentId: string,
  publishedVersions: Array<typeof documentVersions.$inferSelect>,
): Promise<Map<string, SectionStatus>> {
  // Lazy import keeps the pure `buildFrameworkLog` export usable in test
  // suites that don't mock `@/src/db` (Neon HTTP driver would otherwise
  // throw `No database connection string was provided` at module load).
  const { db } = await import('@/src/db')

  // Step 1: Build validated set from published changelog arrays (pure TS).
  const validatedSectionIds = new Set<string>()
  for (const v of publishedVersions) {
    const entries = (v.changelog as ChangelogEntry[] | null) ?? []
    for (const entry of entries) {
      for (const sid of entry.affectedSectionIds) {
        validatedSectionIds.add(sid)
      }
    }
  }

  // Step 2: Load sections under active review CRs.
  const openCRRows = await db
    .select({ sectionId: crSectionLinks.sectionId })
    .from(changeRequests)
    .innerJoin(crSectionLinks, eq(changeRequests.id, crSectionLinks.crId))
    .where(
      and(
        eq(changeRequests.documentId, documentId),
        inArray(changeRequests.status, ['in_review', 'approved']),
      ),
    )
  const underReviewSectionIds = new Set(openCRRows.map((r) => r.sectionId))

  // Step 3: Build a Map honoring precedence rules.
  // Pre-populate validated first so under_review cannot clobber it.
  const m = new Map<string, SectionStatus>()
  for (const sid of validatedSectionIds) m.set(sid, 'validated')
  for (const sid of underReviewSectionIds) {
    if (!m.has(sid)) m.set(sid, 'under_review')
  }

  // Override .get so unknown sectionIds return 'draft' (default).
  // This keeps the returned value a real Map (iterable for UI consumers)
  // while still honoring the fallback contract required by PUB-07.
  const originalGet = m.get.bind(m)
  m.get = function (key: string): SectionStatus | undefined {
    const v = originalGet(key)
    return (v ?? 'draft') as SectionStatus
  } as typeof m.get
  return m
}

/**
 * Build privacy-compliant "what changed" log from published versions.
 *
 * - Sorts versions by publishedAt descending (createdAt fallback).
 * - Emits one PublicLogEntry per (changelog entry, affectedSectionId) pairing.
 * - Skips entries whose sectionId has no matching title in the version's
 *   sectionsSnapshot (safe default per PUB-05: never leak orphan ids).
 * - Caps total entries at `limit` (default 20).
 * - PUB-05: output contains ONLY sectionTitle, mergeDate, summary — no
 *   crId / crReadableId / feedbackIds ever appear in the returned shape.
 */
export function buildFrameworkLog(
  publishedVersions: Array<typeof documentVersions.$inferSelect>,
  limit = 20,
): PublicLogEntry[] {
  const entries: PublicLogEntry[] = []

  const sorted = [...publishedVersions].sort(
    (a, b) =>
      new Date((b.publishedAt ?? b.createdAt) as Date).getTime() -
      new Date((a.publishedAt ?? a.createdAt) as Date).getTime(),
  )

  for (const version of sorted) {
    if (entries.length >= limit) break
    const changelog = (version.changelog as ChangelogEntry[] | null) ?? []
    const snapshot = (version.sectionsSnapshot as SectionSnapshot[] | null) ?? []
    const sectionTitleMap = new Map(snapshot.map((s) => [s.sectionId, s.title]))

    for (const entry of changelog) {
      if (entries.length >= limit) break
      const mergeDate = new Date(
        (version.publishedAt ?? version.createdAt) as Date,
      ).toISOString()

      for (const sid of entry.affectedSectionIds) {
        if (entries.length >= limit) break
        const title = sectionTitleMap.get(sid)
        if (!title) continue // skip orphans per PUB-05 safe default
        entries.push({
          sectionTitle: title,
          mergeDate,
          summary: entry.summary,
        })
      }
    }
  }

  return entries
}
