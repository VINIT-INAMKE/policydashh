import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { transitionCR, mergeCR, getNextVersionLabel } from '@/src/server/services/changeRequest.service'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { db } from '@/src/db'
import { changeRequests, crFeedbackLinks, crSectionLinks, documentVersions } from '@/src/db/schema/changeRequests'
import { feedbackItems } from '@/src/db/schema/feedback'
import { policySections } from '@/src/db/schema/documents'
import { users } from '@/src/db/schema/users'
import { workflowTransitions } from '@/src/db/schema/workflow'
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

const CR_STATUSES = ['drafting', 'in_review', 'approved', 'merged', 'closed'] as const

export const changeRequestRouter = router({
  // Create a new change request from feedback items
  create: requirePermission('cr:create')
    .input(z.object({
      documentId: z.string().uuid(),
      feedbackIds: z.array(z.string().uuid()).min(1),
      title: z.string().min(1).max(200),
      description: z.string().min(10).max(3000),
    }))
    .mutation(async ({ ctx, input }) => {
      // Generate human-readable CR-NNN ID via PostgreSQL sequence
      const [seqResult] = await db.execute(sql`SELECT nextval('cr_id_seq') AS seq`)
      const num = Number((seqResult as Record<string, unknown>).seq)
      const readableId = `CR-${String(num).padStart(3, '0')}`

      // Insert the change request
      const [cr] = await db
        .insert(changeRequests)
        .values({
          readableId,
          documentId: input.documentId,
          ownerId: ctx.user.id,
          title: input.title,
          description: input.description,
        })
        .returning()

      // Insert crFeedbackLinks for each feedback item
      await db
        .insert(crFeedbackLinks)
        .values(input.feedbackIds.map((feedbackId) => ({
          crId: cr.id,
          feedbackId,
        })))

      // Auto-populate crSectionLinks from unique sectionId values of linked feedback items
      const linkedFeedback = await db
        .select({ sectionId: feedbackItems.sectionId })
        .from(feedbackItems)
        .where(inArray(feedbackItems.id, input.feedbackIds))

      const uniqueSectionIds = [...new Set(linkedFeedback.map((f) => f.sectionId))]

      if (uniqueSectionIds.length > 0) {
        await db
          .insert(crSectionLinks)
          .values(uniqueSectionIds.map((sectionId) => ({
            crId: cr.id,
            sectionId,
          })))
      }

      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.CR_CREATE,
        entityType: 'change_request',
        entityId: cr.id,
        payload: {
          readableId,
          documentId: input.documentId,
          feedbackIds: input.feedbackIds,
          title: input.title,
        },
      })

      return { id: cr.id, readableId }
    }),

  // List change requests for a document
  list: requirePermission('cr:read')
    .input(z.object({
      documentId: z.string().uuid(),
      status: z.enum(CR_STATUSES).optional(),
      sectionId: z.string().uuid().optional(),
    }))
    .query(async ({ input }) => {
      const conditions = [eq(changeRequests.documentId, input.documentId)]

      if (input.status) {
        conditions.push(eq(changeRequests.status, input.status))
      }

      // If sectionId filter, find CRs linked to that section
      let crIdsForSection: string[] | null = null
      if (input.sectionId) {
        const sectionCRs = await db
          .select({ crId: crSectionLinks.crId })
          .from(crSectionLinks)
          .where(eq(crSectionLinks.sectionId, input.sectionId))
        crIdsForSection = sectionCRs.map((r) => r.crId)

        if (crIdsForSection.length === 0) {
          return []
        }
        conditions.push(inArray(changeRequests.id, crIdsForSection))
      }

      const rows = await db
        .select({
          id: changeRequests.id,
          readableId: changeRequests.readableId,
          documentId: changeRequests.documentId,
          ownerId: changeRequests.ownerId,
          title: changeRequests.title,
          description: changeRequests.description,
          status: changeRequests.status,
          approverId: changeRequests.approverId,
          approvedAt: changeRequests.approvedAt,
          mergedBy: changeRequests.mergedBy,
          mergedAt: changeRequests.mergedAt,
          mergedVersionId: changeRequests.mergedVersionId,
          closureRationale: changeRequests.closureRationale,
          createdAt: changeRequests.createdAt,
          updatedAt: changeRequests.updatedAt,
          ownerName: users.name,
        })
        .from(changeRequests)
        .leftJoin(users, eq(changeRequests.ownerId, users.id))
        .where(and(...conditions))
        .orderBy(desc(changeRequests.createdAt))

      // For each CR, get linked feedback count and section count
      const crIds = rows.map((r) => r.id)

      if (crIds.length === 0) {
        return []
      }

      const feedbackCounts = await db
        .select({
          crId: crFeedbackLinks.crId,
          count: sql<number>`count(*)::int`,
        })
        .from(crFeedbackLinks)
        .where(inArray(crFeedbackLinks.crId, crIds))
        .groupBy(crFeedbackLinks.crId)

      const sectionCounts = await db
        .select({
          crId: crSectionLinks.crId,
          count: sql<number>`count(*)::int`,
        })
        .from(crSectionLinks)
        .where(inArray(crSectionLinks.crId, crIds))
        .groupBy(crSectionLinks.crId)

      const fbCountMap = new Map(feedbackCounts.map((r) => [r.crId, r.count]))
      const scCountMap = new Map(sectionCounts.map((r) => [r.crId, r.count]))

      return rows.map((row) => ({
        ...row,
        feedbackCount: fbCountMap.get(row.id) ?? 0,
        sectionCount: scCountMap.get(row.id) ?? 0,
      }))
    }),

  // Get a single change request by ID with linked feedback and sections
  getById: requirePermission('cr:read')
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [cr] = await db
        .select({
          id: changeRequests.id,
          readableId: changeRequests.readableId,
          documentId: changeRequests.documentId,
          ownerId: changeRequests.ownerId,
          title: changeRequests.title,
          description: changeRequests.description,
          status: changeRequests.status,
          approverId: changeRequests.approverId,
          approvedAt: changeRequests.approvedAt,
          mergedBy: changeRequests.mergedBy,
          mergedAt: changeRequests.mergedAt,
          mergedVersionId: changeRequests.mergedVersionId,
          closureRationale: changeRequests.closureRationale,
          xstateSnapshot: changeRequests.xstateSnapshot,
          createdAt: changeRequests.createdAt,
          updatedAt: changeRequests.updatedAt,
          ownerName: users.name,
        })
        .from(changeRequests)
        .leftJoin(users, eq(changeRequests.ownerId, users.id))
        .where(eq(changeRequests.id, input.id))
        .limit(1)

      if (!cr) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Change request not found' })
      }

      // Get linked feedback items
      const linkedFeedback = await db
        .select({
          feedbackId: crFeedbackLinks.feedbackId,
          readableId: feedbackItems.readableId,
          title: feedbackItems.title,
          status: feedbackItems.status,
          sectionId: feedbackItems.sectionId,
        })
        .from(crFeedbackLinks)
        .innerJoin(feedbackItems, eq(crFeedbackLinks.feedbackId, feedbackItems.id))
        .where(eq(crFeedbackLinks.crId, input.id))

      // Get linked sections
      const linkedSections = await db
        .select({
          sectionId: crSectionLinks.sectionId,
          title: policySections.title,
        })
        .from(crSectionLinks)
        .innerJoin(policySections, eq(crSectionLinks.sectionId, policySections.id))
        .where(eq(crSectionLinks.crId, input.id))

      return {
        ...cr,
        linkedFeedback,
        linkedSections,
      }
    }),

  // Submit CR for review
  submitForReview: requirePermission('cr:manage')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await transitionCR(
        input.id,
        { type: 'SUBMIT_FOR_REVIEW' },
        ctx.user.id,
      )

      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.CR_SUBMIT_REVIEW,
        entityType: 'change_request',
        entityId: input.id,
      })

      return updated
    }),

  // Approve CR
  approve: requirePermission('cr:manage')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await transitionCR(
        input.id,
        { type: 'APPROVE', approverId: ctx.user.id },
        ctx.user.id,
      )

      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.CR_APPROVE,
        entityType: 'change_request',
        entityId: input.id,
      })

      return updated
    }),

  // Request changes on CR (send back from approved to in_review)
  requestChanges: requirePermission('cr:manage')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await transitionCR(
        input.id,
        { type: 'REQUEST_CHANGES' },
        ctx.user.id,
      )

      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.CR_REQUEST_CHANGES,
        entityType: 'change_request',
        entityId: input.id,
      })

      return updated
    }),

  // Merge CR into a new document version
  merge: requirePermission('cr:manage')
    .input(z.object({
      id: z.string().uuid(),
      mergeSummary: z.string().min(20).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await mergeCR(input.id, input.mergeSummary, ctx.user.id)

      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.CR_MERGE,
        entityType: 'change_request',
        entityId: input.id,
        payload: {
          versionLabel: result.version.versionLabel,
          mergeSummary: input.mergeSummary,
        },
      })

      return result
    }),

  // Close CR with rationale
  close: requirePermission('cr:manage')
    .input(z.object({
      id: z.string().uuid(),
      rationale: z.string().min(20).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const updated = await transitionCR(
        input.id,
        { type: 'CLOSE', rationale: input.rationale },
        ctx.user.id,
      )

      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.CR_CLOSE,
        entityType: 'change_request',
        entityId: input.id,
        payload: { rationale: input.rationale },
      })

      return updated
    }),

  // Add a section link to a CR (only in drafting state)
  addSection: requirePermission('cr:manage')
    .input(z.object({
      crId: z.string().uuid(),
      sectionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify CR is in drafting state
      const [cr] = await db
        .select({ status: changeRequests.status, readableId: changeRequests.readableId })
        .from(changeRequests)
        .where(eq(changeRequests.id, input.crId))
        .limit(1)

      if (!cr) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Change request not found' })
      }

      if (cr.status !== 'drafting') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot add sections to CR ${cr.readableId} in ${cr.status} state`,
        })
      }

      await db
        .insert(crSectionLinks)
        .values({ crId: input.crId, sectionId: input.sectionId })

      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.CR_UPDATE,
        entityType: 'change_request',
        entityId: input.crId,
        payload: { addedSectionId: input.sectionId },
      })

      return { success: true }
    }),

  // Remove a section link from a CR (only in drafting state)
  removeSection: requirePermission('cr:manage')
    .input(z.object({
      crId: z.string().uuid(),
      sectionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify CR is in drafting state
      const [cr] = await db
        .select({ status: changeRequests.status, readableId: changeRequests.readableId })
        .from(changeRequests)
        .where(eq(changeRequests.id, input.crId))
        .limit(1)

      if (!cr) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Change request not found' })
      }

      if (cr.status !== 'drafting') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot remove sections from CR ${cr.readableId} in ${cr.status} state`,
        })
      }

      await db
        .delete(crSectionLinks)
        .where(
          and(
            eq(crSectionLinks.crId, input.crId),
            eq(crSectionLinks.sectionId, input.sectionId),
          ),
        )

      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.CR_UPDATE,
        entityType: 'change_request',
        entityId: input.crId,
        payload: { removedSectionId: input.sectionId },
      })

      return { success: true }
    }),

  // List workflow transitions for a CR (decision log)
  listTransitions: requirePermission('cr:read')
    .input(z.object({ crId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: workflowTransitions.id,
          fromState: workflowTransitions.fromState,
          toState: workflowTransitions.toState,
          actorId: workflowTransitions.actorId,
          timestamp: workflowTransitions.timestamp,
          metadata: workflowTransitions.metadata,
          actorName: users.name,
        })
        .from(workflowTransitions)
        .leftJoin(users, eq(workflowTransitions.actorId, users.id))
        .where(
          and(
            eq(workflowTransitions.entityType, 'change_request'),
            eq(workflowTransitions.entityId, input.crId),
          ),
        )
        .orderBy(asc(workflowTransitions.timestamp))

      return rows
    }),

  // Get next version label for a document (preview before merge)
  getNextVersionLabel: requirePermission('cr:manage')
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ input }) => {
      const versionLabel = await getNextVersionLabel(db, input.documentId)
      return { versionLabel }
    }),
})
