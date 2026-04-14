import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { db } from '@/src/db'
import { policyDocuments, policySections } from '@/src/db/schema/documents'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { sectionAssignments } from '@/src/db/schema/sectionAssignments'
import { eq, and, asc, desc, sql, count, exists, inArray } from 'drizzle-orm'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { can } from '@/src/lib/permissions'
import { TRPCError } from '@trpc/server'

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

      const docs = await db
        .select({
          id: policyDocuments.id,
          title: policyDocuments.title,
          description: policyDocuments.description,
          createdAt: policyDocuments.createdAt,
          updatedAt: policyDocuments.updatedAt,
          // NOTE: sectionCount reflects total sections, not just those
          // assigned to the caller. Intentionally unscoped per RBAC plan
          // 2026-04-12 — metadata leak is acceptable, content is gated.
          sectionCount: sql<number>`cast(count(${policySections.id}) as integer)`,
        })
        .from(policyDocuments)
        .leftJoin(policySections, eq(policyDocuments.id, policySections.documentId))
        .where(scopeWhere)
        .groupBy(policyDocuments.id)
        .orderBy(desc(policyDocuments.updatedAt))

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

  // Get all sections for a document, ordered by orderIndex. Non-privileged
  // roles only see sections they are assigned to via sectionAssignments;
  // the inArray subquery narrows the result set without changing the row
  // shape (in contrast to an innerJoin, which would return a joined row).
  getSections: requirePermission('document:read')
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const canReadAll = can(ctx.user.role, 'document:read_all')

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

  // Update a policy document
  update: requirePermission('document:update')
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = { updatedAt: new Date() }
      if (input.title !== undefined) updateData.title = input.title
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

  // Toggle public draft flag — Phase 20.5 D-02 / PUB-07.
  // Uses 'document:update' permission (admin + policy_lead).
  // Note: CONTEXT.md references 'policy:manage' but that permission does NOT
  // exist in src/lib/permissions.ts. 'document:update' is the correct key.
  setPublicDraft: requirePermission('document:update')
    .input(z.object({
      id: z.string().uuid(),
      isPublicDraft: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(policyDocuments)
        .set({ isPublicDraft: input.isPublicDraft, updatedAt: new Date() })
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

  // Delete a policy document (sections cascade automatically)
  delete: requirePermission('document:delete')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
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

  // Create a new section within a document
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

  // Rename a section
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

  // Update section content (Tiptap JSON)
  // No audit log for content edits -- high-frequency auto-saves (every 1.5s idle)
  // would flood the audit table. Phase 6 (Versioning) creates explicit version
  // snapshots as the auditable content events.
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

      return updated
    }),

  // Delete a section
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

  // Reorder sections within a document
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
