import { z } from 'zod'
import { router, requirePermission, protectedProcedure } from '@/src/trpc/init'
import { requireSectionAccess } from '@/src/server/rbac/section-access'
import { transitionFeedback } from '@/src/server/services/feedback.service'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { can } from '@/src/lib/permissions'
import { db } from '@/src/db'
import { feedbackItems } from '@/src/db/schema/feedback'
import { users } from '@/src/db/schema/users'
import { policySections } from '@/src/db/schema/documents'
import { workflowTransitions } from '@/src/db/schema/workflow'
import { eq, and, desc, asc, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { createNotification } from '@/src/lib/notifications'
import { sendFeedbackReviewed, sendNotificationCreate } from '@/src/inngest/events'

const FEEDBACK_TYPES = ['issue', 'suggestion', 'endorsement', 'evidence', 'question'] as const
const PRIORITIES = ['low', 'medium', 'high'] as const
const IMPACT_CATEGORIES = ['legal', 'security', 'tax', 'consumer', 'innovation', 'clarity', 'governance', 'other'] as const
const STATUSES = ['submitted', 'under_review', 'accepted', 'partially_accepted', 'rejected', 'closed'] as const

export const feedbackRouter = router({
  // Submit feedback tied to a policy section
  submit: requirePermission('feedback:submit')
    .use(requireSectionAccess('sectionId'))
    .input(z.object({
      sectionId: z.string().uuid(),
      documentId: z.string().uuid(),
      feedbackType: z.enum(FEEDBACK_TYPES),
      priority: z.enum(PRIORITIES).default('medium'),
      impactCategory: z.enum(IMPACT_CATEGORIES).default('other'),
      title: z.string().min(1).max(200),
      body: z.string().min(10).max(5000),
      suggestedChange: z.string().max(2000).optional(),
      isAnonymous: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Generate human-readable ID via PostgreSQL sequence
      const seqRows = await db.execute(sql`SELECT nextval('feedback_id_seq') AS seq`)
      const seqResult = seqRows.rows[0] as Record<string, unknown>
      const num = Number(seqResult.seq)
      const readableId = `FB-${String(num).padStart(3, '0')}`

      const [feedback] = await db
        .insert(feedbackItems)
        .values({
          readableId,
          sectionId: input.sectionId,
          documentId: input.documentId,
          submitterId: ctx.user!.id,
          feedbackType: input.feedbackType,
          priority: input.priority,
          impactCategory: input.impactCategory,
          title: input.title,
          body: input.body,
          suggestedChange: input.suggestedChange ?? null,
          isAnonymous: input.isAnonymous,
        })
        .returning()

      writeAuditLog({
        actorId: ctx.user!.id,
        actorRole: ctx.user!.role,
        action: ACTIONS.FEEDBACK_SUBMIT,
        entityType: 'feedback',
        entityId: feedback.id,
        payload: {
          readableId,
          sectionId: input.sectionId,
          documentId: input.documentId,
          feedbackType: input.feedbackType,
        },
      }).catch(console.error)

      return { id: feedback.id, readableId }
    }),

  // List all feedback for a document (admin/policy_lead/auditor)
  list: requirePermission('feedback:read_all')
    .input(z.object({
      documentId: z.string().uuid(),
      sectionId: z.string().uuid().optional(),
      status: z.enum(STATUSES).optional(),
      feedbackType: z.enum(FEEDBACK_TYPES).optional(),
      priority: z.enum(PRIORITIES).optional(),
      impactCategory: z.enum(IMPACT_CATEGORIES).optional(),
      orgType: z.enum(['government', 'industry', 'legal', 'academia', 'civil_society', 'internal'] as const).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(feedbackItems.documentId, input.documentId)]

      if (input.sectionId) conditions.push(eq(feedbackItems.sectionId, input.sectionId))
      if (input.status) conditions.push(eq(feedbackItems.status, input.status))
      if (input.feedbackType) conditions.push(eq(feedbackItems.feedbackType, input.feedbackType))
      if (input.priority) conditions.push(eq(feedbackItems.priority, input.priority))
      if (input.impactCategory) conditions.push(eq(feedbackItems.impactCategory, input.impactCategory))
      if (input.orgType) conditions.push(eq(users.orgType, input.orgType))

      const rows = await db
        .select({
          id: feedbackItems.id,
          readableId: feedbackItems.readableId,
          sectionId: feedbackItems.sectionId,
          documentId: feedbackItems.documentId,
          submitterId: feedbackItems.submitterId,
          feedbackType: feedbackItems.feedbackType,
          priority: feedbackItems.priority,
          impactCategory: feedbackItems.impactCategory,
          title: feedbackItems.title,
          body: feedbackItems.body,
          suggestedChange: feedbackItems.suggestedChange,
          status: feedbackItems.status,
          isAnonymous: feedbackItems.isAnonymous,
          decisionRationale: feedbackItems.decisionRationale,
          reviewedBy: feedbackItems.reviewedBy,
          reviewedAt: feedbackItems.reviewedAt,
          createdAt: feedbackItems.createdAt,
          updatedAt: feedbackItems.updatedAt,
          submitterName: users.name,
          submitterOrgType: users.orgType,
        })
        .from(feedbackItems)
        .leftJoin(users, eq(feedbackItems.submitterId, users.id))
        .where(and(...conditions))
        .orderBy(desc(feedbackItems.createdAt))

      // Server-side anonymity enforcement: null out submitter info for anonymous items
      // unless caller is admin or policy_lead
      const userRole = ctx.user.role
      const canSeeIdentity = userRole === 'admin' || userRole === 'policy_lead'

      return rows.map((row) => {
        if (row.isAnonymous && !canSeeIdentity) {
          return {
            ...row,
            submitterId: null,
            submitterName: null,
            submitterOrgType: null,
          }
        }
        return row
      })
    }),

  // List all feedback across documents (for workshop feedback picker)
  listAll: requirePermission('workshop:manage')
    .query(async ({ ctx }) => {
      const rows = await db
        .select({
          id: feedbackItems.id,
          readableId: feedbackItems.readableId,
          title: feedbackItems.title,
          body: feedbackItems.body,
          feedbackType: feedbackItems.feedbackType,
          status: feedbackItems.status,
          isAnonymous: feedbackItems.isAnonymous,
          submitterId: feedbackItems.submitterId,
          createdAt: feedbackItems.createdAt,
          submitterName: users.name,
        })
        .from(feedbackItems)
        .leftJoin(users, eq(feedbackItems.submitterId, users.id))
        .orderBy(desc(feedbackItems.createdAt))

      // Anonymity enforcement (same pattern as feedback.list)
      const userRole = ctx.user.role
      const canSeeIdentity = userRole === 'admin' || userRole === 'policy_lead'

      return rows.map((row) => {
        if (row.isAnonymous && !canSeeIdentity) {
          return {
            ...row,
            submitterId: null,
            submitterName: null,
          }
        }
        return row
      })
    }),

  // List own feedback (stakeholder/research_lead/workshop_moderator/observer)
  listOwn: requirePermission('feedback:read_own')
    .query(async ({ ctx }) => {
      const rows = await db
        .select()
        .from(feedbackItems)
        .where(eq(feedbackItems.submitterId, ctx.user.id))
        .orderBy(desc(feedbackItems.createdAt))

      return rows
    }),

  // Cross-policy feedback list (Phase 13 D-09 global feedback data source)
  // Role-aware: read_all callers get everything; read_own callers get only their submissions.
  // NOTE: uses protectedProcedure with internal permission branching because
  // the two permissions (feedback:read_all and feedback:read_own) are disjoint
  // in the permission matrix — no single requirePermission() call covers both.
  listCrossPolicy: protectedProcedure
    .input(z.object({
      policyId: z.string().uuid().optional(),
      status: z.enum(STATUSES).optional(),
      feedbackType: z.enum(FEEDBACK_TYPES).optional(),
      priority: z.enum(PRIORITIES).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const canReadAll = can(ctx.user.role, 'feedback:read_all')
      const canReadOwn = can(ctx.user.role, 'feedback:read_own')

      if (!canReadAll && !canReadOwn) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Missing permission: feedback:read_all or feedback:read_own' })
      }

      const conditions = []
      if (!canReadAll) {
        conditions.push(eq(feedbackItems.submitterId, ctx.user.id))
      }
      if (input.policyId) conditions.push(eq(feedbackItems.documentId, input.policyId))
      if (input.status) conditions.push(eq(feedbackItems.status, input.status))
      if (input.feedbackType) conditions.push(eq(feedbackItems.feedbackType, input.feedbackType))
      if (input.priority) conditions.push(eq(feedbackItems.priority, input.priority))

      const rows = await db
        .select({
          id: feedbackItems.id,
          readableId: feedbackItems.readableId,
          sectionId: feedbackItems.sectionId,
          documentId: feedbackItems.documentId,
          submitterId: feedbackItems.submitterId,
          submitterName: users.name,
          submitterOrgType: users.orgType,
          feedbackType: feedbackItems.feedbackType,
          priority: feedbackItems.priority,
          impactCategory: feedbackItems.impactCategory,
          title: feedbackItems.title,
          body: feedbackItems.body,
          status: feedbackItems.status,
          isAnonymous: feedbackItems.isAnonymous,
          createdAt: feedbackItems.createdAt,
          updatedAt: feedbackItems.updatedAt,
        })
        .from(feedbackItems)
        .leftJoin(users, eq(feedbackItems.submitterId, users.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(feedbackItems.createdAt))

      // Anonymity enforcement — same pattern as feedback.list
      const canSeeIdentity = ctx.user.role === 'admin' || ctx.user.role === 'policy_lead'
      return rows.map((row) => {
        if (row.isAnonymous && !canSeeIdentity) {
          return { ...row, submitterId: null, submitterName: null, submitterOrgType: null }
        }
        return row
      })
    }),

  // Get single feedback by ID
  getById: requirePermission('feedback:read_own')
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await db
        .select({
          id: feedbackItems.id,
          readableId: feedbackItems.readableId,
          sectionId: feedbackItems.sectionId,
          documentId: feedbackItems.documentId,
          submitterId: feedbackItems.submitterId,
          feedbackType: feedbackItems.feedbackType,
          priority: feedbackItems.priority,
          impactCategory: feedbackItems.impactCategory,
          title: feedbackItems.title,
          body: feedbackItems.body,
          suggestedChange: feedbackItems.suggestedChange,
          status: feedbackItems.status,
          isAnonymous: feedbackItems.isAnonymous,
          decisionRationale: feedbackItems.decisionRationale,
          reviewedBy: feedbackItems.reviewedBy,
          reviewedAt: feedbackItems.reviewedAt,
          createdAt: feedbackItems.createdAt,
          updatedAt: feedbackItems.updatedAt,
          submitterName: users.name,
          submitterOrgType: users.orgType,
        })
        .from(feedbackItems)
        .leftJoin(users, eq(feedbackItems.submitterId, users.id))
        .where(eq(feedbackItems.id, input.id))
        .limit(1)

      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Feedback not found' })
      }

      // SECURITY: Verify ownership or read_all permission to prevent IDOR
      const isOwner = row.submitterId === ctx.user.id
      const canReadAll = can(ctx.user.role, 'feedback:read_all')
      if (!isOwner && !canReadAll) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this feedback item' })
      }

      // Anonymity enforcement
      const userRole = ctx.user.role
      const canSeeIdentity = userRole === 'admin' || userRole === 'policy_lead'

      if (row.isAnonymous && !canSeeIdentity) {
        return {
          ...row,
          submitterId: null,
          submitterName: null,
          submitterOrgType: null,
        }
      }

      return row
    }),

  // Start review of a feedback item
  startReview: requirePermission('feedback:review')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await transitionFeedback(
        input.id,
        { type: 'START_REVIEW', reviewerId: ctx.user.id },
        ctx.user.id,
      )

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.FEEDBACK_START_REVIEW,
        entityType: 'feedback',
        entityId: input.id,
      }).catch(console.error)

      // NOTIF-04: route notification through notificationDispatchFn (Inngest)
      // instead of the legacy fire-and-forget createNotification. Awaited so
      // emit failures propagate to the mutation; Inngest handles retries.
      const [section] = await db
        .select({ title: policySections.title })
        .from(policySections)
        .where(eq(policySections.id, updated.sectionId))
        .limit(1)

      const sectionName = section?.title ?? 'a section'

      await sendNotificationCreate({
        userId:     updated.submitterId,
        type:       'feedback_status_changed',
        title:      'Feedback under review',
        body:       `Your feedback on \u201c${sectionName}\u201d is now being reviewed.`,
        entityType: 'feedback',
        entityId:   updated.id,
        linkHref:   `/feedback/${updated.id}`,
        createdBy:  ctx.user.id,
        action:     'startReview',
      })

      return updated
    }),

  // Decide on a feedback item (accept, partially_accept, reject)
  decide: requirePermission('feedback:review')
    .input(z.object({
      id: z.string().uuid(),
      decision: z.enum(['accept', 'partially_accept', 'reject']),
      rationale: z.string().min(20).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const eventTypeMap = {
        accept: 'ACCEPT',
        partially_accept: 'PARTIALLY_ACCEPT',
        reject: 'REJECT',
      } as const

      const eventType = eventTypeMap[input.decision]
      const actionMap = {
        accept: ACTIONS.FEEDBACK_ACCEPT,
        partially_accept: ACTIONS.FEEDBACK_PARTIAL,
        reject: ACTIONS.FEEDBACK_REJECT,
      } as const

      const updated = await transitionFeedback(
        input.id,
        {
          type: eventType,
          rationale: input.rationale,
          reviewerId: ctx.user.id,
        },
        ctx.user.id,
      )

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: actionMap[input.decision],
        entityType: 'feedback',
        entityId: input.id,
        payload: { decision: input.decision, rationale: input.rationale },
      }).catch(console.error)

      // Emit Flow 5 event — the feedbackReviewedFn Inngest function handles
      // in-app notification, email, and auto-draft CR creation with retries.
      await sendFeedbackReviewed({
        feedbackId: updated.id,
        decision: input.decision,
        rationale: input.rationale,
        reviewedByUserId: ctx.user.id,
      })

      return updated
    }),

  // Close a decided feedback item
  close: requirePermission('feedback:review')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await transitionFeedback(
        input.id,
        { type: 'CLOSE' },
        ctx.user.id,
      )

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.FEEDBACK_CLOSE,
        entityType: 'feedback',
        entityId: input.id,
      }).catch(console.error)

      // NOTIF-04: route notification through notificationDispatchFn (Inngest).
      const [section] = await db
        .select({ title: policySections.title })
        .from(policySections)
        .where(eq(policySections.id, updated.sectionId))
        .limit(1)

      const sectionName = section?.title ?? 'a section'

      await sendNotificationCreate({
        userId:     updated.submitterId,
        type:       'feedback_status_changed',
        title:      'Feedback closed',
        body:       `Your feedback on \u201c${sectionName}\u201d has been closed.`,
        entityType: 'feedback',
        entityId:   updated.id,
        linkHref:   `/feedback/${updated.id}`,
        createdBy:  ctx.user.id,
        action:     'close',
      })

      return updated
    }),

  // List workflow transitions (decision log) for a feedback item
  listTransitions: requirePermission('feedback:read_own')
    .input(z.object({ feedbackId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // SECURITY: Verify ownership or read_all permission to prevent IDOR
      const [feedback] = await db
        .select({ submitterId: feedbackItems.submitterId })
        .from(feedbackItems)
        .where(eq(feedbackItems.id, input.feedbackId))
        .limit(1)

      if (!feedback) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Feedback not found' })
      }

      const isOwner = feedback.submitterId === ctx.user.id
      const canReadAll = can(ctx.user.role, 'feedback:read_all')
      if (!isOwner && !canReadAll) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have access to this feedback item' })
      }

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
            eq(workflowTransitions.entityType, 'feedback'),
            eq(workflowTransitions.entityId, input.feedbackId),
          ),
        )
        .orderBy(asc(workflowTransitions.timestamp))

      return rows
    }),
})
