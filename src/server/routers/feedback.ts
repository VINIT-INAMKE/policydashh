import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { requireSectionAccess } from '@/src/server/rbac/section-access'
import { transitionFeedback } from '@/src/server/services/feedback.service'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { db } from '@/src/db'
import { feedbackItems } from '@/src/db/schema/feedback'
import { users } from '@/src/db/schema/users'
import { policySections } from '@/src/db/schema/documents'
import { workflowTransitions } from '@/src/db/schema/workflow'
import { eq, and, desc, asc, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { createNotification } from '@/src/lib/notifications'
import { sendFeedbackReviewedEmail } from '@/src/lib/email'

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

      await writeAuditLog({
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
      })

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

      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.FEEDBACK_START_REVIEW,
        entityType: 'feedback',
        entityId: input.id,
      })

      // Fire-and-forget notification to feedback submitter
      const [section] = await db
        .select({ title: policySections.title })
        .from(policySections)
        .where(eq(policySections.id, updated.sectionId))
        .limit(1)

      const sectionName = section?.title ?? 'a section'

      createNotification({
        userId: updated.submitterId,
        type: 'feedback_status_changed',
        title: 'Feedback under review',
        body: `Your feedback on \u201c${sectionName}\u201d is now being reviewed.`,
        entityType: 'feedback',
        entityId: updated.id,
        linkHref: `/feedback/${updated.id}`,
      }).catch(console.error)

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

      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: actionMap[input.decision],
        entityType: 'feedback',
        entityId: input.id,
        payload: { decision: input.decision, rationale: input.rationale },
      })

      // Fire-and-forget notification + email to feedback submitter
      const [section] = await db
        .select({ title: policySections.title })
        .from(policySections)
        .where(eq(policySections.id, updated.sectionId))
        .limit(1)

      const sectionName = section?.title ?? 'a section'
      const truncatedRationale = input.rationale.length > 80
        ? input.rationale.slice(0, 80) + '\u2026'
        : input.rationale

      const notifCopyMap: Record<string, { title: string; body: string }> = {
        accept: {
          title: 'Feedback accepted',
          body: `Your feedback on \u201c${sectionName}\u201d was accepted. ${truncatedRationale}`,
        },
        partially_accept: {
          title: 'Feedback partially accepted',
          body: `Your feedback on \u201c${sectionName}\u201d was partially accepted.`,
        },
        reject: {
          title: 'Feedback not accepted',
          body: `Your feedback on \u201c${sectionName}\u201d was not accepted. ${truncatedRationale}`,
        },
      }

      const copy = notifCopyMap[input.decision]

      createNotification({
        userId: updated.submitterId,
        type: 'feedback_status_changed',
        title: copy.title,
        body: copy.body,
        entityType: 'feedback',
        entityId: updated.id,
        linkHref: `/feedback/${updated.id}`,
      }).catch(console.error)

      // Fire-and-forget email for decision outcomes
      const [submitterUser] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, updated.submitterId))
        .limit(1)

      if (submitterUser?.email) {
        sendFeedbackReviewedEmail(submitterUser.email, {
          feedbackReadableId: updated.readableId,
          decision: input.decision,
          rationale: input.rationale,
        }).catch(console.error)
      }

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

      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.FEEDBACK_CLOSE,
        entityType: 'feedback',
        entityId: input.id,
      })

      // Fire-and-forget notification to feedback submitter
      const [section] = await db
        .select({ title: policySections.title })
        .from(policySections)
        .where(eq(policySections.id, updated.sectionId))
        .limit(1)

      const sectionName = section?.title ?? 'a section'

      createNotification({
        userId: updated.submitterId,
        type: 'feedback_status_changed',
        title: 'Feedback closed',
        body: `Your feedback on \u201c${sectionName}\u201d has been closed.`,
        entityType: 'feedback',
        entityId: updated.id,
        linkHref: `/feedback/${updated.id}`,
      }).catch(console.error)

      return updated
    }),

  // List workflow transitions (decision log) for a feedback item
  listTransitions: requirePermission('feedback:read_own')
    .input(z.object({ feedbackId: z.string().uuid() }))
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
            eq(workflowTransitions.entityType, 'feedback'),
            eq(workflowTransitions.entityId, input.feedbackId),
          ),
        )
        .orderBy(asc(workflowTransitions.timestamp))

      return rows
    }),
})
