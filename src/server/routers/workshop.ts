import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { db } from '@/src/db'
import {
  workshops,
  workshopArtifacts,
  workshopSectionLinks,
  workshopFeedbackLinks,
} from '@/src/db/schema/workshops'
import { evidenceArtifacts } from '@/src/db/schema/evidence'
import { users } from '@/src/db/schema/users'
import { policySections, policyDocuments } from '@/src/db/schema/documents'
import { feedbackItems } from '@/src/db/schema/feedback'
import { eq, gte, lt, desc, and, count } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

export const workshopRouter = router({
  // Create a new workshop event
  create: requirePermission('workshop:manage')
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      scheduledAt: z.string().datetime(),
      durationMinutes: z.number().int().positive().optional(),
      registrationLink: z.string().url().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [workshop] = await db
        .insert(workshops)
        .values({
          title: input.title,
          description: input.description ?? null,
          scheduledAt: new Date(input.scheduledAt),
          durationMinutes: input.durationMinutes ?? null,
          registrationLink: input.registrationLink ?? null,
          createdBy: ctx.user.id,
        })
        .returning()

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_CREATE,
        entityType: 'workshop',
        entityId: workshop.id,
        payload: { title: input.title },
      }).catch(console.error)

      return workshop
    }),

  // List workshops with upcoming/past/all filter
  list: requirePermission('workshop:read')
    .input(z.object({
      filter: z.enum(['upcoming', 'past', 'all']).default('all'),
    }))
    .query(async ({ input }) => {
      const now = new Date()
      const conditions = []

      if (input.filter === 'upcoming') {
        conditions.push(gte(workshops.scheduledAt, now))
      } else if (input.filter === 'past') {
        conditions.push(lt(workshops.scheduledAt, now))
      }

      const rows = await db
        .select({
          id: workshops.id,
          title: workshops.title,
          description: workshops.description,
          scheduledAt: workshops.scheduledAt,
          durationMinutes: workshops.durationMinutes,
          registrationLink: workshops.registrationLink,
          createdBy: workshops.createdBy,
          createdAt: workshops.createdAt,
          updatedAt: workshops.updatedAt,
          creatorName: users.name,
        })
        .from(workshops)
        .leftJoin(users, eq(workshops.createdBy, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(workshops.scheduledAt))

      return rows
    }),

  // Get a single workshop by ID with linked sections, feedback, and artifact count
  getById: requirePermission('workshop:read')
    .input(z.object({ workshopId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [workshop] = await db
        .select({
          id: workshops.id,
          title: workshops.title,
          description: workshops.description,
          scheduledAt: workshops.scheduledAt,
          durationMinutes: workshops.durationMinutes,
          registrationLink: workshops.registrationLink,
          createdBy: workshops.createdBy,
          createdAt: workshops.createdAt,
          updatedAt: workshops.updatedAt,
          creatorName: users.name,
        })
        .from(workshops)
        .leftJoin(users, eq(workshops.createdBy, users.id))
        .where(eq(workshops.id, input.workshopId))
        .limit(1)

      if (!workshop) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workshop not found' })
      }

      // Fetch linked sections with document title
      const sections = await db
        .select({
          sectionId: workshopSectionLinks.sectionId,
          sectionTitle: policySections.title,
          documentId: policySections.documentId,
          documentTitle: policyDocuments.title,
        })
        .from(workshopSectionLinks)
        .innerJoin(policySections, eq(workshopSectionLinks.sectionId, policySections.id))
        .innerJoin(policyDocuments, eq(policySections.documentId, policyDocuments.id))
        .where(eq(workshopSectionLinks.workshopId, input.workshopId))

      // Fetch linked feedback with readableId, title, status, documentId
      // documentId enables cross-navigation from workshop detail to the
      // originating policy's feedback view (D-13).
      const feedback = await db
        .select({
          feedbackId: workshopFeedbackLinks.feedbackId,
          readableId: feedbackItems.readableId,
          title: feedbackItems.title,
          status: feedbackItems.status,
          documentId: feedbackItems.documentId,
        })
        .from(workshopFeedbackLinks)
        .innerJoin(feedbackItems, eq(workshopFeedbackLinks.feedbackId, feedbackItems.id))
        .where(eq(workshopFeedbackLinks.workshopId, input.workshopId))

      // Artifact count
      const [artifactCountResult] = await db
        .select({ count: count() })
        .from(workshopArtifacts)
        .where(eq(workshopArtifacts.workshopId, input.workshopId))

      return {
        ...workshop,
        sections,
        feedback,
        artifactCount: artifactCountResult?.count ?? 0,
      }
    }),

  // Update a workshop (ownership check)
  update: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      scheduledAt: z.string().datetime().optional(),
      durationMinutes: z.number().int().positive().nullable().optional(),
      registrationLink: z.string().url().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Fetch workshop for ownership check
      const [existing] = await db
        .select({ createdBy: workshops.createdBy })
        .from(workshops)
        .where(eq(workshops.id, input.workshopId))
        .limit(1)

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workshop not found' })
      }

      if (existing.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the workshop creator or admin can update this workshop' })
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() }
      if (input.title !== undefined) updateData.title = input.title
      if (input.description !== undefined) updateData.description = input.description
      if (input.scheduledAt !== undefined) updateData.scheduledAt = new Date(input.scheduledAt)
      if (input.durationMinutes !== undefined) updateData.durationMinutes = input.durationMinutes
      if (input.registrationLink !== undefined) updateData.registrationLink = input.registrationLink

      const [updated] = await db
        .update(workshops)
        .set(updateData)
        .where(eq(workshops.id, input.workshopId))
        .returning()

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_UPDATE,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { title: updated.title },
      }).catch(console.error)

      return updated
    }),

  // Delete a workshop (ownership check, cascades to artifacts and links)
  delete: requirePermission('workshop:manage')
    .input(z.object({ workshopId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Fetch workshop for ownership check
      const [existing] = await db
        .select({ createdBy: workshops.createdBy })
        .from(workshops)
        .where(eq(workshops.id, input.workshopId))
        .limit(1)

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workshop not found' })
      }

      if (existing.createdBy !== ctx.user.id && ctx.user.role !== 'admin') {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the workshop creator or admin can delete this workshop' })
      }

      await db.delete(workshops).where(eq(workshops.id, input.workshopId))

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_DELETE,
        entityType: 'workshop',
        entityId: input.workshopId,
      }).catch(console.error)

      return { success: true }
    }),

  // Attach an artifact to a workshop (creates evidence artifact + workshop link)
  attachArtifact: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      title: z.string().min(1),
      type: z.enum(['file', 'link']),
      url: z.string().url(),
      artifactType: z.enum(['promo', 'recording', 'summary', 'attendance', 'other']),
      fileName: z.string().optional(),
      fileSize: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Insert into evidenceArtifacts first
      const [artifact] = await db
        .insert(evidenceArtifacts)
        .values({
          title: input.title,
          type: input.type,
          url: input.url,
          fileName: input.fileName ?? null,
          fileSize: input.fileSize ?? null,
          uploaderId: ctx.user.id,
        })
        .returning()

      // Then link to workshop — sequential, no transaction (Neon HTTP driver)
      await db
        .insert(workshopArtifacts)
        .values({
          workshopId: input.workshopId,
          artifactId: artifact.id,
          artifactType: input.artifactType,
        })

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_ARTIFACT_ATTACH,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { artifactId: artifact.id, artifactType: input.artifactType, title: input.title },
      }).catch(console.error)

      return artifact
    }),

  // Remove an artifact link from a workshop (preserves evidence record)
  removeArtifact: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      artifactId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(workshopArtifacts)
        .where(
          and(
            eq(workshopArtifacts.workshopId, input.workshopId),
            eq(workshopArtifacts.artifactId, input.artifactId),
          ),
        )

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_ARTIFACT_REMOVE,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { artifactId: input.artifactId },
      }).catch(console.error)

      return { success: true }
    }),

  // List artifacts for a workshop with uploader name
  listArtifacts: requirePermission('workshop:read')
    .input(z.object({ workshopId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: evidenceArtifacts.id,
          title: evidenceArtifacts.title,
          type: evidenceArtifacts.type,
          url: evidenceArtifacts.url,
          fileName: evidenceArtifacts.fileName,
          fileSize: evidenceArtifacts.fileSize,
          uploaderId: evidenceArtifacts.uploaderId,
          createdAt: evidenceArtifacts.createdAt,
          artifactType: workshopArtifacts.artifactType,
          uploaderName: users.name,
        })
        .from(workshopArtifacts)
        .innerJoin(evidenceArtifacts, eq(workshopArtifacts.artifactId, evidenceArtifacts.id))
        .leftJoin(users, eq(evidenceArtifacts.uploaderId, users.id))
        .where(eq(workshopArtifacts.workshopId, input.workshopId))

      return rows
    }),

  // Link a section to a workshop
  linkSection: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      sectionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(workshopSectionLinks)
        .values({ workshopId: input.workshopId, sectionId: input.sectionId })
        .onConflictDoNothing()

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_SECTION_LINK,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { sectionId: input.sectionId },
      }).catch(console.error)

      return { success: true }
    }),

  // Unlink a section from a workshop
  unlinkSection: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      sectionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(workshopSectionLinks)
        .where(
          and(
            eq(workshopSectionLinks.workshopId, input.workshopId),
            eq(workshopSectionLinks.sectionId, input.sectionId),
          ),
        )

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_SECTION_UNLINK,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { sectionId: input.sectionId },
      }).catch(console.error)

      return { success: true }
    }),

  // Link a feedback item to a workshop
  linkFeedback: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      feedbackId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(workshopFeedbackLinks)
        .values({ workshopId: input.workshopId, feedbackId: input.feedbackId })
        .onConflictDoNothing()

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_FEEDBACK_LINK,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { feedbackId: input.feedbackId },
      }).catch(console.error)

      return { success: true }
    }),

  // Unlink a feedback item from a workshop
  unlinkFeedback: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      feedbackId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(workshopFeedbackLinks)
        .where(
          and(
            eq(workshopFeedbackLinks.workshopId, input.workshopId),
            eq(workshopFeedbackLinks.feedbackId, input.feedbackId),
          ),
        )

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_FEEDBACK_UNLINK,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { feedbackId: input.feedbackId },
      }).catch(console.error)

      return { success: true }
    }),
})
