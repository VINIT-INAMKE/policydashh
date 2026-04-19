import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { transitionCR, mergeCR } from '@/src/server/services/changeRequest.service'
import { getNextVersionLabel } from '@/src/server/services/version.service'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS, type Role } from '@/src/lib/constants'
import { PERMISSIONS, type Permission } from '@/src/lib/permissions'
import { db } from '@/src/db'
import { changeRequests, crFeedbackLinks, crSectionLinks, documentVersions } from '@/src/db/schema/changeRequests'
import { feedbackItems } from '@/src/db/schema/feedback'
import { policySections } from '@/src/db/schema/documents'
import { users } from '@/src/db/schema/users'
import { workflowTransitions } from '@/src/db/schema/workflow'
import { eq, and, desc, asc, sql, inArray, ilike, ne } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { sendNotificationCreate } from '@/src/inngest/events'

// CR reviewers = everyone who can approve/merge (cr:manage). G7 uses this
// to fan out the "sent for review" notification to actual reviewers rather
// than echoing it back to the submitter. The PERMISSIONS table is the
// single source of truth; if the matrix expands (e.g. a dedicated
// cr:review permission ships), swap the constant below without touching
// the query shape.
const REVIEWER_PERMISSION: Permission = 'cr:manage'
const REVIEWER_ROLES = PERMISSIONS[REVIEWER_PERMISSION] as readonly Role[]

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
      const seqRows = await db.execute(sql`SELECT nextval('cr_id_seq') AS seq`)
      const seqResult = seqRows.rows[0] as Record<string, unknown>
      const num = Number(seqResult.seq)
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

      writeAuditLog({
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
      }).catch(console.error)

      return { id: cr.id, readableId }
    }),

  // List change requests for a document
  list: requirePermission('cr:read')
    .input(z.object({
      documentId: z.string().uuid(),
      status: z.enum(CR_STATUSES).optional(),
      sectionId: z.string().uuid().optional(),
      feedbackQuery: z.string().max(200).optional(),
    }))
    .query(async ({ input }) => {
      const conditions = [eq(changeRequests.documentId, input.documentId)]

      if (input.status) {
        conditions.push(eq(changeRequests.status, input.status))
      }

      // If feedbackQuery, find CRs linked to matching feedback
      if (input.feedbackQuery) {
        const term = `%${input.feedbackQuery.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`
        const matchingFeedback = await db
          .select({ crId: crFeedbackLinks.crId })
          .from(crFeedbackLinks)
          .innerJoin(feedbackItems, eq(crFeedbackLinks.feedbackId, feedbackItems.id))
          .where(ilike(feedbackItems.title, term))
        const crIds = [...new Set(matchingFeedback.map((r) => r.crId))]
        if (crIds.length === 0) {
          return []
        }
        conditions.push(inArray(changeRequests.id, crIds))
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
          mergedVersionLabel: documentVersions.versionLabel,
        })
        .from(changeRequests)
        .leftJoin(users, eq(changeRequests.ownerId, users.id))
        .leftJoin(documentVersions, eq(changeRequests.mergedVersionId, documentVersions.id))
        .where(eq(changeRequests.id, input.id))
        .limit(1)

      if (!cr) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Change request not found' })
      }

      // Fetch approver and merger names separately (avoids aliased joins)
      const extraUserIds = [cr.approverId, cr.mergedBy].filter(
        (id): id is string => id !== null,
      )
      const userNameMap = new Map<string, string | null>()
      if (extraUserIds.length > 0) {
        const userRows = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, extraUserIds))
        for (const row of userRows) {
          userNameMap.set(row.id, row.name)
        }
      }

      // Get linked feedback items (G5: include sectionTitle via join)
      const linkedFeedback = await db
        .select({
          feedbackId: crFeedbackLinks.feedbackId,
          readableId: feedbackItems.readableId,
          title: feedbackItems.title,
          status: feedbackItems.status,
          sectionId: feedbackItems.sectionId,
          sectionTitle: policySections.title,
        })
        .from(crFeedbackLinks)
        .innerJoin(feedbackItems, eq(crFeedbackLinks.feedbackId, feedbackItems.id))
        .leftJoin(policySections, eq(feedbackItems.sectionId, policySections.id))
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
        approverName: cr.approverId ? userNameMap.get(cr.approverId) ?? null : null,
        mergerName: cr.mergedBy ? userNameMap.get(cr.mergedBy) ?? null : null,
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

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.CR_SUBMIT_REVIEW,
        entityType: 'change_request',
        entityId: input.id,
      }).catch(console.error)

      // G7: fan the "sent for review" notification out to reviewers (users
      // with cr:manage) - the submitter already knows they just clicked the
      // button. Exclude the actor so they don't ping themselves.
      const reviewers = await db
        .select({ id: users.id })
        .from(users)
        .where(and(
          inArray(users.role, REVIEWER_ROLES as unknown as Role[]),
          ne(users.id, ctx.user.id),
        ))

      // NOTIF-04: route notification through notificationDispatchFn (Inngest).
      // Fan-out with Promise.allSettled so one bad userId doesn't block the
      // rest of the queue.
      await Promise.allSettled(
        reviewers.map((reviewer) =>
          sendNotificationCreate({
            userId:     reviewer.id,
            type:       'cr_status_changed',
            title:      'CR sent for review',
            body:       `Change request ${updated.readableId} is ready for review.`,
            entityType: 'cr',
            entityId:   updated.id,
            linkHref:   `/change-requests/${updated.id}`,
            createdBy:  ctx.user.id,
            action:     'submitForReview',
          }),
        ),
      )

      return updated
    }),

  // Approve CR
  approve: requirePermission('cr:manage')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // SECURITY: Prevent self-approval - approver cannot be the CR owner
      const [cr] = await db
        .select({ ownerId: changeRequests.ownerId, readableId: changeRequests.readableId })
        .from(changeRequests)
        .where(eq(changeRequests.id, input.id))
        .limit(1)

      if (!cr) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Change request not found' })
      }

      if (cr.ownerId === ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Cannot approve your own change request ${cr.readableId}`,
        })
      }

      const updated = await transitionCR(
        input.id,
        { type: 'APPROVE', approverId: ctx.user.id },
        ctx.user.id,
      )

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.CR_APPROVE,
        entityType: 'change_request',
        entityId: input.id,
      }).catch(console.error)

      // NOTIF-04: route notification through notificationDispatchFn (Inngest).
      await sendNotificationCreate({
        userId:     updated.ownerId,
        type:       'cr_status_changed',
        title:      'CR approved',
        body:       `Change request ${updated.readableId} has been approved.`,
        entityType: 'cr',
        entityId:   updated.id,
        linkHref:   `/change-requests/${updated.id}`,
        createdBy:  ctx.user.id,
        action:     'approve',
      })

      return updated
    }),

  // Request changes on CR (send back from approved to in_review)
  requestChanges: requirePermission('cr:manage')
    .input(z.object({
      id: z.string().uuid(),
      rationale: z.string().min(20).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const updated = await transitionCR(
        input.id,
        { type: 'REQUEST_CHANGES', rationale: input.rationale },
        ctx.user.id,
      )

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.CR_REQUEST_CHANGES,
        entityType: 'change_request',
        entityId: input.id,
        payload: { rationale: input.rationale },
      }).catch(console.error)

      return updated
    }),

  // Merge CR into a new document version
  merge: requirePermission('cr:manage')
    .input(z.object({
      id: z.string().uuid(),
      mergeSummary: z.string().min(20).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      // B7 / G6: Prevent self-merge - merger cannot be the CR owner.
      // Mirrors the approve owner check above so one reviewer cannot both
      // approve and merge their own change request.
      const [ownerRow] = await db
        .select({ ownerId: changeRequests.ownerId, readableId: changeRequests.readableId })
        .from(changeRequests)
        .where(eq(changeRequests.id, input.id))
        .limit(1)

      if (!ownerRow) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Change request not found' })
      }

      if (ownerRow.ownerId === ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Cannot merge your own change request ${ownerRow.readableId}`,
        })
      }

      const result = await mergeCR(input.id, input.mergeSummary, ctx.user.id)

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.CR_MERGE,
        entityType: 'change_request',
        entityId: input.id,
        payload: {
          versionLabel: result.version.versionLabel,
          mergeSummary: input.mergeSummary,
        },
      }).catch(console.error)

      // NOTIF-04: route notification through notificationDispatchFn (Inngest).
      await sendNotificationCreate({
        userId:     result.cr.ownerId,
        type:       'cr_status_changed',
        title:      'CR merged',
        body:       `Change request ${result.cr.readableId} was merged into version ${result.version.versionLabel}.`,
        entityType: 'cr',
        entityId:   result.cr.id,
        linkHref:   `/change-requests/${result.cr.id}`,
        createdBy:  ctx.user.id,
        action:     'merge',
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

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.CR_CLOSE,
        entityType: 'change_request',
        entityId: input.id,
        payload: { rationale: input.rationale },
      }).catch(console.error)

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

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.CR_UPDATE,
        entityType: 'change_request',
        entityId: input.crId,
        payload: { addedSectionId: input.sectionId },
      }).catch(console.error)

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

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.CR_UPDATE,
        entityType: 'change_request',
        entityId: input.crId,
        payload: { removedSectionId: input.sectionId },
      }).catch(console.error)

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
