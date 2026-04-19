// Version service - Phase 6 Versioning
// Provides snapshot, changelog, diff computation, publish, and manual version creation

import { diffWords, type Change } from 'diff'
import { db } from '@/src/db'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { policySections } from '@/src/db/schema/documents'
import { crFeedbackLinks, crSectionLinks } from '@/src/db/schema/changeRequests'
import { feedbackItems } from '@/src/db/schema/feedback'
import { eq, desc, asc } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

// ── Types ──────────────────────────────────────────────────────────────────

export interface SectionSnapshot {
  sectionId: string
  title: string
  orderIndex: number
  content: Record<string, unknown>
}

export interface ChangelogEntry {
  crId: string | null
  crReadableId: string | null
  crTitle: string
  summary: string
  /**
   * D8: canonical shape is the *readable* id (e.g. "FB-014"). We deliberately
   * chose readable IDs over UUIDs because the changelog is a human-facing
   * artefact — displayed in the publish dialog, public portal summary,
   * version history — and a UUID means nothing to a reader. If anything
   * downstream needs the underlying UUID it should join on
   * `feedbackItems.readableId` rather than round-trip through this JSON.
   */
  feedbackIds: string[]
  affectedSectionIds: string[]
}

export interface SectionDiffResult {
  sectionId: string
  titleA: string | null
  titleB: string | null
  status: 'added' | 'removed' | 'modified' | 'unchanged'
  diff: Change[] | null
}

// ── Pure functions (no DB dependency) ──────────────────────────────────────

/**
 * A5: walks a Tiptap JSON tree and returns the concatenated plain text
 * from all descendant `text` nodes, joined by spaces on block
 * boundaries. Used to produce human-readable diffs instead of leaking
 * `{"type":"paragraph","content":[{"type":"text",…}]}` noise into the
 * UI.
 */
function extractPlainText(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as { type?: string; text?: string; content?: unknown[] }
  if (n.type === 'text' && typeof n.text === 'string') {
    return n.text
  }
  if (!Array.isArray(n.content)) return ''
  const parts = n.content.map(extractPlainText).filter((s) => s.length > 0)
  // Block-level nodes (paragraph, heading, list item, …) separate with a
  // newline so the diff doesn't glue distinct paragraphs together into
  // one giant run. Inline nodes (marks etc.) fall through with no extra
  // whitespace so "bold-in-middle-of-sentence" still reads naturally.
  const BLOCK_TYPES = new Set([
    'paragraph',
    'heading',
    'blockquote',
    'bulletList',
    'orderedList',
    'listItem',
    'codeBlock',
    'doc',
    'tableRow',
    'table',
    'callout',
    'details',
    'detailsSummary',
    'detailsContent',
  ])
  const separator = n.type && BLOCK_TYPES.has(n.type) ? '\n' : ''
  return parts.join(separator)
}

/**
 * Computes the diff between two section snapshots.
 * Returns an array of diff results per section with status and word-level diff.
 */
export function computeSectionDiff(
  snapshotA: SectionSnapshot[],
  snapshotB: SectionSnapshot[],
): SectionDiffResult[] {
  const mapA = new Map(snapshotA.map((s) => [s.sectionId, s]))
  const mapB = new Map(snapshotB.map((s) => [s.sectionId, s]))

  // Collect all unique section IDs
  const allIds = new Set([...mapA.keys(), ...mapB.keys()])

  const results: SectionDiffResult[] = []

  for (const sectionId of allIds) {
    const a = mapA.get(sectionId)
    const b = mapB.get(sectionId)

    if (!a && b) {
      // Added in B
      results.push({
        sectionId,
        titleA: null,
        titleB: b.title,
        status: 'added',
        diff: null,
      })
    } else if (a && !b) {
      // Removed from A
      results.push({
        sectionId,
        titleA: a.title,
        titleB: null,
        status: 'removed',
        diff: null,
      })
    } else if (a && b) {
      // A5: diff human-readable plain text, not raw Tiptap JSON. Comparing
      // JSON strings produced diffs full of `{"type":"paragraph"…` junk
      // which authors couldn't read. We still detect "unchanged" on the
      // full JSON (preserves mark-only changes as "modified"), but feed
      // diffWords a clean text extract.
      const rawA = JSON.stringify(a.content)
      const rawB = JSON.stringify(b.content)

      if (rawA === rawB) {
        results.push({
          sectionId,
          titleA: a.title,
          titleB: b.title,
          status: 'unchanged',
          diff: null,
        })
      } else {
        const textA = extractPlainText(a.content)
        const textB = extractPlainText(b.content)
        const wordDiff = diffWords(textA, textB)
        results.push({
          sectionId,
          titleA: a.title,
          titleB: b.title,
          status: 'modified',
          diff: wordDiff,
        })
      }
    }
  }

  return results
}

// ── DB-dependent functions ─────────────────────────────────────────────────

/**
 * Get the next version label for a document.
 * Queries the latest documentVersions row and increments the minor version.
 * Moved from changeRequest.service.ts in Phase 6.
 */
export async function getNextVersionLabel(
  txOrDb: typeof db,
  documentId: string,
): Promise<string> {
  const [latest] = await txOrDb
    .select({ versionLabel: documentVersions.versionLabel })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.createdAt))
    .limit(1)

  if (!latest) {
    return 'v0.1'
  }

  // Parse "v0.N" pattern and increment
  const match = latest.versionLabel.match(/^v0\.(\d+)$/)
  if (!match) {
    return 'v0.1'
  }

  const nextMinor = parseInt(match[1], 10) + 1
  return `v0.${nextMinor}`
}

/**
 * Snapshot the current sections of a document.
 * Returns an array of SectionSnapshot for persistence in document_versions.
 */
export async function snapshotSections(
  txOrDb: typeof db,
  documentId: string,
): Promise<SectionSnapshot[]> {
  const sections = await txOrDb
    .select({
      id: policySections.id,
      title: policySections.title,
      orderIndex: policySections.orderIndex,
      content: policySections.content,
    })
    .from(policySections)
    .where(eq(policySections.documentId, documentId))
    .orderBy(asc(policySections.orderIndex))

  return sections.map((s) => ({
    sectionId: s.id,
    title: s.title,
    orderIndex: s.orderIndex,
    content: s.content,
  }))
}

/**
 * Build changelog entries for a change request merge.
 * Queries linked feedback and sections to produce a ChangelogEntry.
 */
export async function buildChangelog(
  txOrDb: typeof db,
  crId: string,
  cr: { readableId: string; title: string; description: string | null },
): Promise<ChangelogEntry[]> {
  // Get linked feedback readable IDs
  const linkedFeedback = await txOrDb
    .select({
      feedbackId: crFeedbackLinks.feedbackId,
      readableId: feedbackItems.readableId,
    })
    .from(crFeedbackLinks)
    .innerJoin(feedbackItems, eq(crFeedbackLinks.feedbackId, feedbackItems.id))
    .where(eq(crFeedbackLinks.crId, crId))

  // Get linked section IDs
  const linkedSections = await txOrDb
    .select({ sectionId: crSectionLinks.sectionId })
    .from(crSectionLinks)
    .where(eq(crSectionLinks.crId, crId))

  return [{
    crId,
    crReadableId: cr.readableId,
    crTitle: cr.title,
    summary: cr.description ?? cr.title,
    feedbackIds: linkedFeedback.map((f) => f.readableId),
    affectedSectionIds: linkedSections.map((s) => s.sectionId),
  }]
}

/**
 * Publish a version (set isPublished=true, publishedAt).
 * Idempotent: if already published, returns as-is.
 * Published versions are immutable -- no further edits allowed.
 */
export async function publishVersion(
  versionId: string,
  _actorId: string,
): Promise<typeof documentVersions.$inferSelect> {
  const [version] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, versionId))
    .limit(1)

  if (!version) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' })
  }

  // Idempotent: already published
  if (version.isPublished) {
    return version
  }

  const [updated] = await db
    .update(documentVersions)
    .set({
      isPublished: true,
      publishedAt: new Date(),
    })
    .where(eq(documentVersions.id, versionId))
    .returning()

  return updated
}

/**
 * Create a manual version (not from a CR merge).
 * Snapshots current sections and generates next version label.
 * Includes retry logic for concurrent version label collisions.
 */
export async function createManualVersion(
  documentId: string,
  notes: string,
  actorId: string,
  maxRetries = 3,
): Promise<typeof documentVersions.$inferSelect> {
  // Sequential inserts (Neon HTTP driver does not support transactions)
  const sectionsSnapshot = await snapshotSections(db, documentId)

  const changelog: ChangelogEntry[] = [{
    crId: null,
    crReadableId: null,
    crTitle: 'Manual version',
    summary: notes,
    feedbackIds: [],
    affectedSectionIds: [],
  }]

  // SECURITY: Retry loop to handle race condition when two concurrent merges
  // generate the same version label (unique constraint violation).
  //
  // A19: ONLY retry on 23505 (unique_violation). Any other Postgres error
  // (FK violation, check constraint, serialization, etc.) used to get
  // swallowed by this loop for up to `maxRetries - 1` iterations before
  // surfacing on the final attempt, masking real bugs. Re-throw anything
  // that isn't a unique-constraint collision immediately.
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const versionLabel = await getNextVersionLabel(db, documentId)

    try {
      const [version] = await db
        .insert(documentVersions)
        .values({
          documentId,
          versionLabel,
          mergeSummary: notes,
          createdBy: actorId,
          crId: null,
          sectionsSnapshot,
          changelog,
        })
        .returning()

      return version
    } catch (error: unknown) {
      const pgError = error as { code?: string }
      if (pgError.code !== '23505') {
        // Not a duplicate-key collision — surface immediately.
        throw error
      }
      if (attempt < maxRetries - 1) {
        continue
      }
      throw error
    }
  }

  // Should never reach here, but TypeScript needs a return
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to generate unique version label after retries' })
}
