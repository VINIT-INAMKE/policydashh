import { z } from 'zod'
import { router, requirePermission, publicProcedure } from '@/src/trpc/init'
import { listPublicWorkshops } from '@/src/server/queries/workshops-public'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { db } from '@/src/db'
import {
  workshops,
  workshopArtifacts,
  workshopSectionLinks,
  workshopFeedbackLinks,
  workshopEvidenceChecklist,
} from '@/src/db/schema/workshops'
import { evidenceArtifacts } from '@/src/db/schema/evidence'
import { users } from '@/src/db/schema/users'
import { policySections, policyDocuments } from '@/src/db/schema/documents'
import { feedbackItems } from '@/src/db/schema/feedback'
import { workflowTransitions } from '@/src/db/schema/workflow'
import {
  sendWorkshopCompleted,
  sendWorkshopRecordingUploaded,
  sendWorkshopCreated,
} from '@/src/inngest/events'
import { updateCalEventTypeSeats } from '@/src/lib/calcom'
import { eq, gte, lt, desc, and, count } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  upcoming:    ['in_progress'],
  in_progress: ['completed'],
  completed:   ['archived'],
  archived:    [],
}

export const workshopRouter = router({
  // Create a new workshop event
  create: requirePermission('workshop:manage')
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      scheduledAt: z.string().datetime(),
      durationMinutes: z.number().int().positive().optional(),
      registrationLink: z.string().url().optional(),
      // Phase 20 WS-07 (D-07): optional per-workshop capacity. NULL in the DB
      // means "open registration" (no "X spots left" badge on the public
      // listing). Admins set this on the create form.
      maxSeats: z.number().int().min(1).max(10000).optional(),
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
          maxSeats: input.maxSeats ?? null,
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

      // Phase 20 WS-07 (D-01, D-03): async cal.com event-type provisioning.
      // Fire-and-forget - the workshop row persists even if the Inngest send
      // itself fails (e.g. Inngest down), and the downstream
      // `workshopCreatedFn` handles cal.com 5xx/4xx via its own retry policy.
      // Public listing (Plan 20-05) gates the embed on
      // `calcomEventTypeId IS NOT NULL`, so a failed provisioning just hides
      // the embed until an admin retries.
      sendWorkshopCreated({
        workshopId: workshop.id,
        moderatorId: ctx.user.id,
      }).catch(console.error)

      return workshop
    }),

  // One-shot repair for workshops whose cal.com event type was provisioned
  // before seats config was added. Patches seatsPerTimeSlot to maxSeats
  // (or 100 when uncapped) so multiple attendees can book the same slot.
  reprovisionCalSeats: requirePermission('workshop:manage')
    .input(z.object({ workshopId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [workshop] = await db
        .select({
          id: workshops.id,
          calcomEventTypeId: workshops.calcomEventTypeId,
          maxSeats: workshops.maxSeats,
        })
        .from(workshops)
        .where(eq(workshops.id, input.workshopId))
        .limit(1)

      if (!workshop) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workshop not found' })
      }
      if (!workshop.calcomEventTypeId || !/^\d+$/.test(workshop.calcomEventTypeId)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Workshop has no numeric cal.com event type id',
        })
      }

      await updateCalEventTypeSeats(
        parseInt(workshop.calcomEventTypeId, 10),
        workshop.maxSeats ?? 100,
      )
      return { ok: true, seatsPerTimeSlot: workshop.maxSeats ?? 100 }
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
          milestoneId: workshops.milestoneId,
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
          status: workshops.status,
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
      // r2Key is required for the recording pipeline (WS-14): the Inngest
      // function needs the raw R2 object key to call getDownloadUrl on,
      // because the public URL is not signed and not useful to Groq's fetch.
      r2Key: z.string().optional(),
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

      // Then link to workshop - sequential, no transaction (Neon HTTP driver).
      // Capture the inserted workshopArtifact row id so we can pass it to the
      // recording pipeline event below (it identifies the link-row, not the
      // underlying evidence artifact).
      const [workshopArtifact] = await db
        .insert(workshopArtifacts)
        .values({
          workshopId: input.workshopId,
          artifactId: artifact.id,
          artifactType: input.artifactType,
        })
        .returning({ id: workshopArtifacts.id })

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_ARTIFACT_ATTACH,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { artifactId: artifact.id, artifactType: input.artifactType, title: input.title },
      }).catch(console.error)

      // Fire the Inngest pipeline for recording uploads (WS-14). We only
      // emit when the caller supplied both artifactType='recording' and a
      // usable r2Key - uploads via the public URL form (e.g. external link
      // artifacts) never enter the Groq pipeline.
      if (input.artifactType === 'recording' && input.r2Key) {
        await sendWorkshopRecordingUploaded({
          workshopId:         input.workshopId,
          workshopArtifactId: workshopArtifact.id,
          r2Key:              input.r2Key,
          moderatorId:        ctx.user.id,
        })
      }

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
          reviewStatus: workshopArtifacts.reviewStatus,
          workshopArtifactId: workshopArtifacts.id,
          uploaderName: users.name,
        })
        .from(workshopArtifacts)
        .innerJoin(evidenceArtifacts, eq(workshopArtifacts.artifactId, evidenceArtifacts.id))
        .leftJoin(users, eq(evidenceArtifacts.uploaderId, users.id))
        .where(eq(workshopArtifacts.workshopId, input.workshopId))

      return rows
    }),

  // List evidence checklist for a workshop (WS-13)
  listChecklist: requirePermission('workshop:read')
    .input(z.object({ workshopId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id:         workshopEvidenceChecklist.id,
          slot:       workshopEvidenceChecklist.slot,
          status:     workshopEvidenceChecklist.status,
          artifactId: workshopEvidenceChecklist.artifactId,
          filledAt:   workshopEvidenceChecklist.filledAt,
          createdAt:  workshopEvidenceChecklist.createdAt,
        })
        .from(workshopEvidenceChecklist)
        .where(eq(workshopEvidenceChecklist.workshopId, input.workshopId))

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

  // Transition workshop through its status lifecycle (WS-06)
  transition: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      toStatus: z.enum(['in_progress', 'completed', 'archived']),
    }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select({
          id: workshops.id,
          status: workshops.status,
          createdBy: workshops.createdBy,
        })
        .from(workshops)
        .where(eq(workshops.id, input.workshopId))
        .limit(1)

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Workshop not found' })
      }

      const allowedNext = ALLOWED_TRANSITIONS[existing.status] ?? []
      if (!allowedNext.includes(input.toStatus)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Invalid transition: ${existing.status} → ${input.toStatus}. Allowed next states: ${allowedNext.join(', ') || '(none - terminal)'}`,
        })
      }

      await db
        .update(workshops)
        .set({ status: input.toStatus, updatedAt: new Date() })
        .where(eq(workshops.id, input.workshopId))

      await db.insert(workflowTransitions).values({
        entityType: 'workshop',
        entityId:   input.workshopId,
        fromState:  existing.status,
        toState:    input.toStatus,
        actorId:    ctx.user.id,
        metadata:   { triggeredBy: 'workshop.transition' },
      })

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_TRANSITION,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { fromStatus: existing.status, toStatus: input.toStatus },
      }).catch(console.error)

      if (input.toStatus === 'completed') {
        await sendWorkshopCompleted({
          workshopId: input.workshopId,
          moderatorId: existing.createdBy,
        })
      }

      return { success: true, fromStatus: existing.status, toStatus: input.toStatus }
    }),

  // Approve a draft artifact (flip reviewStatus from 'draft' to 'approved') - WS-14
  approveArtifact: requirePermission('workshop:manage')
    .input(z.object({
      workshopId: z.string().uuid(),
      workshopArtifactId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(workshopArtifacts)
        .set({ reviewStatus: 'approved' })
        .where(
          and(
            eq(workshopArtifacts.id, input.workshopArtifactId),
            eq(workshopArtifacts.workshopId, input.workshopId),
          ),
        )

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.WORKSHOP_ARTIFACT_APPROVE,
        entityType: 'workshop',
        entityId: input.workshopId,
        payload: { workshopArtifactId: input.workshopArtifactId },
      }).catch(console.error)

      return { success: true }
    }),

  // Phase 20 Plan 20-05 (D-05, D-06, D-07, D-08, WS-08):
  // Public listing of workshops with cal.com event types, unauthenticated.
  // Wraps the `listPublicWorkshops` helper in `src/server/queries/workshops-public.ts`
  // so tRPC clients (future admin preview, /workshops SSR page can also call
  // directly) share the same cached spots-left query. unstable_cache handles
  // the 60s revalidate + per-workshopId tagging (research Option B).
  listPublicWorkshops: publicProcedure.query(async () => {
    return listPublicWorkshops()
  }),
})
