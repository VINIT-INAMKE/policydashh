import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { db } from '@/src/db'
import { policyDocuments, policySections } from '@/src/db/schema/documents'
import { documentVersions, changeRequests } from '@/src/db/schema/changeRequests'
import { feedbackItems } from '@/src/db/schema/feedback'
import { milestones } from '@/src/db/schema/milestones'
import { sectionAssignments } from '@/src/db/schema/sectionAssignments'
import { eq, and, asc, desc, sql, exists, inArray, count } from 'drizzle-orm'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { can } from '@/src/lib/permissions'
import { TRPCError } from '@trpc/server'

// 2026-04-28 (Option A relaxation): the previous design gated EVERY
// section mutation to FORBIDDEN once any version was published, which
// created an impossibility loop — published policies could not be edited
// at all because CRs had no working copy to stage proposed content. We
// now treat `policy_sections` as the always-editable working copy
// ("main branch") and treat published `documentVersions` rows as
// immutable release tags. Non-editor reads in `getSections` resolve
// from the latest published snapshot so post-publish in-progress edits
// never leak to stakeholders / auditors before the next publish. The
// auto-CR drafter in `src/inngest/functions/feedback-reviewed.ts` runs
// its own published-version check; no shared helper needed here.

// D23: naive in-memory throttle for section-content edit audit entries.
// Autosave fires every ~1.5s while editing, so we emit at most one
// SECTION_CONTENT_UPDATE event per section per 60s. Best-effort only — on
// a multi-instance deployment each instance keeps its own clock. That's OK
// for "coarse diffs" — the precise record remains the version snapshot.
const SECTION_CONTENT_AUDIT_WINDOW_MS = 60_000
const lastSectionContentAuditAt = new Map<string, number>()
function shouldAuditSectionContent(sectionId: string): boolean {
  const now = Date.now()
  const last = lastSectionContentAuditAt.get(sectionId)
  if (last === undefined || now - last >= SECTION_CONTENT_AUDIT_WINDOW_MS) {
    lastSectionContentAuditAt.set(sectionId, now)
    return true
  }
  return false
}

export const documentRouter = router({
  // List all policy documents with section counts (optionally with nested sections)
  list: requirePermission('document:read')
    .input(z.object({ includeSections: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const canReadAll = can(ctx.user.role, 'document:read_all')

      // Non-privileged roles only see documents that have at least one
      // published version. Privileged roles (admin/policy_lead/auditor)
      // see drafts too.
      const publishedExists = exists(
        db
          .select({ one: sql`1` })
          .from(documentVersions)
          .where(
            and(
              eq(documentVersions.documentId, policyDocuments.id),
              eq(documentVersions.isPublished, true),
            ),
          ),
      )

      const scopeWhere = canReadAll ? undefined : publishedExists

      // D21: sort by createdAt to avoid list reordering every time
      // `setPublicDraft` bumps `updatedAt` — the create order is stable
      // and matches how the UI expects "oldest policies at the bottom".
      const docs = await db
        .select({
          id: policyDocuments.id,
          title: policyDocuments.title,
          description: policyDocuments.description,
          createdAt: policyDocuments.createdAt,
          updatedAt: policyDocuments.updatedAt,
          // NOTE: sectionCount reflects total sections, not just those
          // assigned to the caller. Intentionally unscoped per RBAC plan
          // 2026-04-12 - metadata leak is acceptable, content is gated.
          sectionCount: sql<number>`cast(count(${policySections.id}) as integer)`,
        })
        .from(policyDocuments)
        .leftJoin(policySections, eq(policyDocuments.id, policySections.documentId))
        .where(scopeWhere)
        .groupBy(policyDocuments.id)
        .orderBy(desc(policyDocuments.createdAt))

      // When sections are requested inline, also scope them: non-privileged
      // callers only get sections they're assigned to.
      const allSections = input?.includeSections
        ? await db
            .select({
              id: policySections.id,
              documentId: policySections.documentId,
              title: policySections.title,
              orderIndex: policySections.orderIndex,
              content: policySections.content,
            })
            .from(policySections)
            .where(
              canReadAll
                ? undefined
                : inArray(
                    policySections.id,
                    db
                      .select({ id: sectionAssignments.sectionId })
                      .from(sectionAssignments)
                      .where(eq(sectionAssignments.userId, ctx.user.id)),
                  ),
            )
            .orderBy(asc(policySections.orderIndex))
        : []

      const sectionsByDoc = new Map<string, typeof allSections>()
      for (const s of allSections) {
        if (!sectionsByDoc.has(s.documentId)) sectionsByDoc.set(s.documentId, [])
        sectionsByDoc.get(s.documentId)!.push(s)
      }

      return docs.map((d) => ({ ...d, sections: sectionsByDoc.get(d.id) ?? [] }))
    }),

  // Get a single document by ID. Non-privileged roles only see published
  // documents; an unpublished document is indistinguishable from a
  // non-existent one (we throw NOT_FOUND, not FORBIDDEN, to avoid leaking
  // existence).
  getById: requirePermission('document:read')
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const canReadAll = can(ctx.user.role, 'document:read_all')

      const idMatch = eq(policyDocuments.id, input.id)
      const whereClause = canReadAll
        ? idMatch
        : and(
            idMatch,
            exists(
              db
                .select({ one: sql`1` })
                .from(documentVersions)
                .where(
                  and(
                    eq(documentVersions.documentId, policyDocuments.id),
                    eq(documentVersions.isPublished, true),
                  ),
                ),
            ),
          )

      const [doc] = await db
        .select()
        .from(policyDocuments)
        .where(whereClause)
        .limit(1)

      if (!doc) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      }

      return doc
    }),

  // Get all sections for a document.
  //
  // Read-source by role (Option A, 2026-04-28):
  //   - `section:manage` (admin / policy_lead): live `policy_sections` —
  //     the working copy with any in-flight unpublished edits. This is
  //     what they edit and what the diff/draft indicator compares against
  //     the latest published snapshot.
  //   - everyone else (auditor / stakeholder / research_lead / etc.):
  //     latest published `documentVersions.sectionsSnapshot`. This means
  //     non-editor reads NEVER see in-progress post-publish edits — they
  //     stay on the most recently published snapshot until a new version
  //     is cut.
  //
  // Section-assignment scoping (sectionAssignments) still applies to
  // non-`document:read_all` roles in either branch.
  getSections: requirePermission('document:read')
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const canEdit = can(ctx.user.role, 'section:manage')
      const canReadAll = can(ctx.user.role, 'document:read_all')

      // Edit role -> live working copy.
      if (canEdit) {
        const baseWhere = eq(policySections.documentId, input.documentId)
        const whereClause = canReadAll
          ? baseWhere
          : and(
              baseWhere,
              inArray(
                policySections.id,
                db
                  .select({ id: sectionAssignments.sectionId })
                  .from(sectionAssignments)
                  .where(eq(sectionAssignments.userId, ctx.user.id)),
              ),
            )

        const sections = await db
          .select()
          .from(policySections)
          .where(whereClause)
          .orderBy(asc(policySections.orderIndex))

        return sections
      }

      // Non-edit role -> read from the latest published snapshot. No
      // published version means no readable content for this audience —
      // mirrors the `getById` behavior, which already returns NOT_FOUND
      // for non-`document:read_all` callers when nothing is published.
      const [latestPublished] = await db
        .select({
          id: documentVersions.id,
          sectionsSnapshot: documentVersions.sectionsSnapshot,
        })
        .from(documentVersions)
        .where(and(
          eq(documentVersions.documentId, input.documentId),
          eq(documentVersions.isPublished, true),
        ))
        .orderBy(desc(documentVersions.publishedAt))
        .limit(1)

      if (!latestPublished) return []

      // Snapshot shape: { sectionId, title, orderIndex, content }[]
      // (see src/server/services/version.service.ts:snapshotSections)
      const snapshotSections = (latestPublished.sectionsSnapshot ?? []) as Array<{
        sectionId: string
        title: string
        orderIndex: number
        content: Record<string, unknown>
      }>

      // Optional section-assignment scoping for callers without
      // `document:read_all`. We resolve the allowed sectionIds once and
      // filter the snapshot in memory; the row count per document is
      // small (low double digits in practice) so the in-memory filter is
      // cheaper than a SQL roundtrip per read.
      let allowedSectionIds: Set<string> | null = null
      if (!canReadAll) {
        const assignments = await db
          .select({ id: sectionAssignments.sectionId })
          .from(sectionAssignments)
          .where(eq(sectionAssignments.userId, ctx.user.id))
        allowedSectionIds = new Set(assignments.map((a) => a.id))
      }

      // Project snapshot shape onto the same row schema the live branch
      // returns so the client doesn't have to special-case. The fields
      // not present in the snapshot (createdAt, updatedAt) get sensible
      // surrogates — readers don't act on those for snapshotted content.
      const snapshotAsRows = snapshotSections
        .filter(
          (s) =>
            allowedSectionIds === null || allowedSectionIds.has(s.sectionId),
        )
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((s) => ({
          id: s.sectionId,
          documentId: input.documentId,
          title: s.title,
          orderIndex: s.orderIndex,
          content: s.content,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        }))

      return snapshotAsRows
    }),

  // Returns whether this document has unpublished edits relative to its
  // latest published version, plus a pointer to that version. Used by the
  // policy detail header to show a "X unpublished edits since v0.4" hint
  // for editors. Pre-publish documents return `hasUnpublishedChanges: true`
  // (everything in the working copy is still pending) with `latestPublished`
  // null.
  //
  // Cheap to compute: one indexed read of the latest publish + one max
  // updatedAt scan over `policy_sections`. Skips the diff math; the UI
  // just needs the boolean + label.
  getDraftStatus: requirePermission('document:read')
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [latestPublished] = await db
        .select({
          id: documentVersions.id,
          versionLabel: documentVersions.versionLabel,
          publishedAt: documentVersions.publishedAt,
        })
        .from(documentVersions)
        .where(and(
          eq(documentVersions.documentId, input.documentId),
          eq(documentVersions.isPublished, true),
        ))
        .orderBy(desc(documentVersions.publishedAt))
        .limit(1)

      if (!latestPublished) {
        // Nothing published yet — every section in the working copy is
        // an unpublished change by definition.
        return {
          hasUnpublishedChanges: true,
          latestPublished: null,
        } as const
      }

      // Did any live section get touched after the most recent publish?
      // We compare the max(policy_sections.updated_at) for this doc to
      // the publishedAt timestamp; structural changes (create/delete/
      // reorder) all bump section updatedAt so this catches them too.
      const [maxRow] = await db
        .select({
          maxUpdated: sql<Date>`max(${policySections.updatedAt})`,
        })
        .from(policySections)
        .where(eq(policySections.documentId, input.documentId))

      const lastEdit = maxRow?.maxUpdated
      const hasUnpublishedChanges =
        lastEdit !== null &&
        lastEdit !== undefined &&
        new Date(lastEdit).getTime() > new Date(latestPublished.publishedAt!).getTime()

      return {
        hasUnpublishedChanges,
        latestPublished: {
          id: latestPublished.id,
          versionLabel: latestPublished.versionLabel,
          publishedAt: latestPublished.publishedAt,
        },
      } as const
    }),

  // Create a new policy document
  create: requirePermission('document:create')
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [doc] = await db
        .insert(policyDocuments)
        .values({
          title: input.title,
          description: input.description ?? null,
        })
        .returning()

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.DOCUMENT_CREATE,
        entityType: 'document',
        entityId: doc.id,
        payload: { title: input.title },
      }).catch(console.error)

      return doc
    }),

  // Update a policy document. D13: allow clearing the description by
  // passing explicit `null` (z.nullable).
  update: requirePermission('document:update')
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = { updatedAt: new Date() }
      if (input.title !== undefined) updateData.title = input.title
      // Explicit null clears the description; undefined leaves it unchanged.
      if (input.description !== undefined) updateData.description = input.description

      const [updated] = await db
        .update(policyDocuments)
        .set(updateData)
        .where(eq(policyDocuments.id, input.id))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      }

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.DOCUMENT_UPDATE,
        entityType: 'document',
        entityId: input.id,
        payload: { title: input.title, description: input.description },
      }).catch(console.error)

      return updated
    }),

  // Toggle public draft flag - Phase 20.5 D-02 / PUB-07.
  // Uses 'document:update' permission (admin + policy_lead).
  // Note: CONTEXT.md references 'policy:manage' but that permission does NOT
  // exist in src/lib/permissions.ts. 'document:update' is the correct key.
  //
  // D21: previously this bumped updatedAt, which reordered the `/policies`
  // list every time a lead toggled the public flag. Leave updatedAt alone
  // — the flag change gets recorded in the audit log already.
  setPublicDraft: requirePermission('document:update')
    .input(z.object({
      id: z.string().uuid(),
      isPublicDraft: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(policyDocuments)
        .set({ isPublicDraft: input.isPublicDraft })
        .where(eq(policyDocuments.id, input.id))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      }

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.DOCUMENT_SET_PUBLIC_DRAFT,
        entityType: 'document',
        entityId: updated.id,
        payload: { isPublicDraft: input.isPublicDraft },
      }).catch(console.error)

      return updated
    }),

  // Delete a policy document.
  //
  // B5: the FKs on `documentVersions`, `changeRequests`, `feedbackItems`, and
  // `milestones` do NOT cascade from `policyDocuments` — a direct DELETE
  // would therefore fail with a foreign-key error deep in drizzle's stack.
  // We pre-count the blockers and return a machine-readable PRECONDITION_FAILED
  // so the delete dialog can render them. Sections DO cascade from
  // policyDocuments so we don't check them.
  delete: requirePermission('document:delete')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [versionsRow] = await db
        .select({ n: count() })
        .from(documentVersions)
        .where(eq(documentVersions.documentId, input.id))
      const [crsRow] = await db
        .select({ n: count() })
        .from(changeRequests)
        .where(eq(changeRequests.documentId, input.id))
      const [feedbackRow] = await db
        .select({ n: count() })
        .from(feedbackItems)
        .where(eq(feedbackItems.documentId, input.id))
      const [milestonesRow] = await db
        .select({ n: count() })
        .from(milestones)
        .where(eq(milestones.documentId, input.id))

      const blockers = {
        versions: Number(versionsRow?.n ?? 0),
        changeRequests: Number(crsRow?.n ?? 0),
        feedback: Number(feedbackRow?.n ?? 0),
        milestones: Number(milestonesRow?.n ?? 0),
      }

      const total =
        blockers.versions +
        blockers.changeRequests +
        blockers.feedback +
        blockers.milestones

      if (total > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            'This policy has related records that must be removed first. ' +
            `Blockers — versions: ${blockers.versions}, change requests: ${blockers.changeRequests}, ` +
            `feedback: ${blockers.feedback}, milestones: ${blockers.milestones}.`,
          // We serialize blockers in the message for forward-compat clients
          // that can't read `cause`, and also attach via cause for typed
          // clients (errorFormatter passes zodError via cause).
          cause: new Error(JSON.stringify({ blockers })),
        })
      }

      const [deleted] = await db
        .delete(policyDocuments)
        .where(eq(policyDocuments.id, input.id))
        .returning()

      if (!deleted) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      }

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.DOCUMENT_DELETE,
        entityType: 'document',
        entityId: input.id,
      }).catch(console.error)

      return { success: true }
    }),

  // Create a new section within a document.
  //
  // Option A (2026-04-28): post-publish lock removed. `policy_sections` is
  // the always-editable working copy; published `documentVersions` rows are
  // immutable snapshots. Non-editor reads in `getSections` resolve from the
  // latest published snapshot, so a new section added here is invisible to
  // stakeholders until the next publish.
  createSection: requirePermission('section:manage')
    .input(z.object({
      documentId: z.string().uuid(),
      title: z.string().min(1).max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get the max orderIndex for this document
      const [maxResult] = await db
        .select({ maxOrder: sql<number>`coalesce(max(${policySections.orderIndex}), -1)` })
        .from(policySections)
        .where(eq(policySections.documentId, input.documentId))

      const nextOrder = (maxResult?.maxOrder ?? -1) + 1

      const [section] = await db
        .insert(policySections)
        .values({
          documentId: input.documentId,
          title: input.title,
          orderIndex: nextOrder,
          content: { type: 'doc', content: [] },
        })
        .returning()

      // Update parent document's updatedAt
      await db
        .update(policyDocuments)
        .set({ updatedAt: new Date() })
        .where(eq(policyDocuments.id, input.documentId))

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.SECTION_CREATE,
        entityType: 'section',
        entityId: section.id,
        payload: { documentId: input.documentId, title: input.title },
      }).catch(console.error)

      return section
    }),

  // Rename a section. Always allowed for `section:manage`; the latest
  // published snapshot continues to surface the previous title to readers
  // until a new version is published.
  renameSection: requirePermission('section:manage')
    .input(z.object({
      id: z.string().uuid(),
      documentId: z.string().uuid(),
      title: z.string().min(1).max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(policySections)
        .set({ title: input.title, updatedAt: new Date() })
        .where(and(
          eq(policySections.id, input.id),
          eq(policySections.documentId, input.documentId),
        ))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Section not found' })
      }

      // Update parent document's updatedAt
      await db
        .update(policyDocuments)
        .set({ updatedAt: new Date() })
        .where(eq(policyDocuments.id, input.documentId))

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.SECTION_RENAME,
        entityType: 'section',
        entityId: input.id,
        payload: { documentId: input.documentId, title: input.title },
      }).catch(console.error)

      return updated
    }),

  // Update section content (Tiptap JSON).
  //
  // Option A (2026-04-28): post-publish lock removed. Content edits land in
  // the live `policy_sections.content` (the working copy). Non-editor reads
  // resolve from the latest published snapshot until a new version is
  // published, so a typo fix here is invisible to stakeholders until the
  // next publish.
  //
  // D23: record a coarse audit trail (one entry per section per 60s window)
  // so we have visibility into who edited what, without flooding the audit
  // table on every autosave. Precise per-save content lives in the version
  // snapshots.
  updateSectionContent: requirePermission('section:manage')
    .input(z.object({
      id: z.string().uuid(),
      documentId: z.string().uuid(),
      content: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(policySections)
        .set({ content: input.content, updatedAt: new Date() })
        .where(and(
          eq(policySections.id, input.id),
          eq(policySections.documentId, input.documentId),
        ))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Section not found' })
      }

      if (shouldAuditSectionContent(input.id)) {
        writeAuditLog({
          actorId: ctx.user.id,
          actorRole: ctx.user.role,
          action: ACTIONS.SECTION_CONTENT_UPDATE,
          entityType: 'section',
          entityId: input.id,
          payload: { documentId: input.documentId, windowSeconds: SECTION_CONTENT_AUDIT_WINDOW_MS / 1000 },
        }).catch(console.error)
      }

      return updated
    }),

  // Delete a section. Removes the live row only — published snapshots that
  // still reference this sectionId remain intact (they store content
  // inline) so historical versions continue to render correctly.
  deleteSection: requirePermission('section:manage')
    .input(z.object({
      id: z.string().uuid(),
      documentId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db
        .delete(policySections)
        .where(and(
          eq(policySections.id, input.id),
          eq(policySections.documentId, input.documentId),
        ))
        .returning()

      if (!deleted) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Section not found' })
      }

      // Update parent document's updatedAt
      await db
        .update(policyDocuments)
        .set({ updatedAt: new Date() })
        .where(eq(policyDocuments.id, input.documentId))

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.SECTION_DELETE,
        entityType: 'section',
        entityId: input.id,
        payload: { documentId: input.documentId },
      }).catch(console.error)

      return { success: true }
    }),

  // Reorder sections within a document. The reorder rewrites the live
  // ordering only; published snapshots retain their own frozen ordering
  // (snapshotSections captures orderIndex per section), so historical
  // versions render in their original order regardless of subsequent
  // reorders to the live working copy.
  reorderSections: requirePermission('section:manage')
    .input(z.object({
      documentId: z.string().uuid(),
      orderedSectionIds: z.array(z.string().uuid()),
    }))
    .mutation(async ({ ctx, input }) => {
      // KNOWN LIMITATION: Sequential updates without a transaction.
      // The Neon HTTP driver does not support db.transaction(), so concurrent
      // reorder requests could interleave and produce inconsistent orderIndex values.
      // This is a known trade-off; switching to a WebSocket-based Neon driver or
      // a single UPDATE with CASE expression would fix this but requires driver changes.
      const now = new Date()
      for (let i = 0; i < input.orderedSectionIds.length; i++) {
        await db
          .update(policySections)
          .set({ orderIndex: i, updatedAt: now })
          .where(and(
            eq(policySections.id, input.orderedSectionIds[i]),
            eq(policySections.documentId, input.documentId),
          ))
      }

      // Update parent document's updatedAt
      await db
        .update(policyDocuments)
        .set({ updatedAt: now })
        .where(eq(policyDocuments.id, input.documentId))

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.SECTION_REORDER,
        entityType: 'document',
        entityId: input.documentId,
        payload: { orderedSectionIds: input.orderedSectionIds },
      }).catch(console.error)

      return { success: true }
    }),

  // Import a document with pre-parsed sections (from markdown or other source)
  importDocument: requirePermission('document:create')
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
      sections: z.array(z.object({
        title: z.string().min(1).max(200),
        content: z.record(z.string(), z.unknown()),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Insert document first
      const [doc] = await db
        .insert(policyDocuments)
        .values({
          title: input.title,
          description: input.description ?? null,
        })
        .returning()

      // Insert sections with order from array position
      const sections = []
      for (let i = 0; i < input.sections.length; i++) {
        const [section] = await db
          .insert(policySections)
          .values({
            documentId: doc.id,
            title: input.sections[i].title,
            orderIndex: i,
            content: input.sections[i].content,
          })
          .returning()
        sections.push(section)
      }

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.DOCUMENT_IMPORT,
        entityType: 'document',
        entityId: doc.id,
        payload: { title: input.title, sectionCount: input.sections.length },
      }).catch(console.error)

      return { document: doc, sections }
    }),
})
