import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { db } from '@/src/db'
import { policyDocuments, policySections } from '@/src/db/schema/documents'
import { eq, and, asc, desc, sql, count } from 'drizzle-orm'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { TRPCError } from '@trpc/server'

export const documentRouter = router({
  // List all policy documents with section counts
  list: requirePermission('document:read')
    .query(async () => {
      const docs = await db
        .select({
          id: policyDocuments.id,
          title: policyDocuments.title,
          description: policyDocuments.description,
          createdAt: policyDocuments.createdAt,
          updatedAt: policyDocuments.updatedAt,
          sectionCount: sql<number>`cast(count(${policySections.id}) as integer)`,
        })
        .from(policyDocuments)
        .leftJoin(policySections, eq(policyDocuments.id, policySections.documentId))
        .groupBy(policyDocuments.id)
        .orderBy(desc(policyDocuments.updatedAt))

      return docs
    }),

  // Get a single document by ID
  getById: requirePermission('document:read')
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [doc] = await db
        .select()
        .from(policyDocuments)
        .where(eq(policyDocuments.id, input.id))
        .limit(1)

      if (!doc) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' })
      }

      return doc
    }),

  // Get all sections for a document, ordered by orderIndex
  getSections: requirePermission('document:read')
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ input }) => {
      const sections = await db
        .select()
        .from(policySections)
        .where(eq(policySections.documentId, input.documentId))
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
