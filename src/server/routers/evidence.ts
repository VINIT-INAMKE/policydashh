import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { db } from '@/src/db'
import { evidenceArtifacts, feedbackEvidence, sectionEvidence } from '@/src/db/schema/evidence'
import { eq } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

export const evidenceRouter = router({
  // Attach evidence artifact (file or link) to a feedback item or section
  attach: requirePermission('evidence:upload')
    .input(z.object({
      title: z.string().min(1),
      type: z.enum(['file', 'link']),
      url: z.string().url(),
      fileName: z.string().optional(),
      fileSize: z.number().optional(),
      feedbackId: z.string().uuid().optional(),
      sectionId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!input.feedbackId && !input.sectionId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Either feedbackId or sectionId must be provided',
        })
      }

      // Insert the evidence artifact
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

      // Insert into appropriate join table(s) -- sequential inserts (no transactions)
      if (input.feedbackId) {
        await db.insert(feedbackEvidence).values({
          feedbackId: input.feedbackId,
          artifactId: artifact.id,
        })
      }

      if (input.sectionId) {
        await db.insert(sectionEvidence).values({
          sectionId: input.sectionId,
          artifactId: artifact.id,
        })
      }

      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.EVIDENCE_ATTACH,
        entityType: 'evidence',
        entityId: artifact.id,
        payload: {
          title: input.title,
          type: input.type,
          feedbackId: input.feedbackId,
          sectionId: input.sectionId,
        },
      })

      return artifact
    }),

  // List evidence attached to a feedback item
  listByFeedback: requirePermission('evidence:read')
    .input(z.object({ feedbackId: z.string().uuid() }))
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
        })
        .from(feedbackEvidence)
        .innerJoin(evidenceArtifacts, eq(feedbackEvidence.artifactId, evidenceArtifacts.id))
        .where(eq(feedbackEvidence.feedbackId, input.feedbackId))

      return rows
    }),

  // List evidence attached to a section
  listBySection: requirePermission('evidence:read')
    .input(z.object({ sectionId: z.string().uuid() }))
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
        })
        .from(sectionEvidence)
        .innerJoin(evidenceArtifacts, eq(sectionEvidence.artifactId, evidenceArtifacts.id))
        .where(eq(sectionEvidence.sectionId, input.sectionId))

      return rows
    }),

  // Remove an evidence artifact (cascades to join tables)
  remove: requirePermission('evidence:upload')
    .input(z.object({ artifactId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db
        .delete(evidenceArtifacts)
        .where(eq(evidenceArtifacts.id, input.artifactId))
        .returning()

      if (!deleted) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Evidence artifact not found' })
      }

      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.EVIDENCE_UPLOAD,
        entityType: 'evidence',
        entityId: input.artifactId,
        payload: { action: 'remove' },
      })

      return { success: true }
    }),
})
