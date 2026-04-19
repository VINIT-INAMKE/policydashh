import { z } from 'zod'
import { router, requirePermission, protectedProcedure } from '@/src/trpc/init'
import { requireSectionAccess, BYPASS_SECTION_SCOPE } from '@/src/server/rbac/section-access'
import { transitionFeedback } from '@/src/server/services/feedback.service'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS, type Role } from '@/src/lib/constants'
import { can } from '@/src/lib/permissions'
import { db } from '@/src/db'
import { feedbackItems } from '@/src/db/schema/feedback'
import { users } from '@/src/db/schema/users'
import { policySections } from '@/src/db/schema/documents'
import { sectionAssignments } from '@/src/db/schema/sectionAssignments'
import { workflowTransitions } from '@/src/db/schema/workflow'
import { eq, and, desc, asc, sql, inArray, isNull, or } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
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

  // E1: preflight check for feedback-submit form. Returns whether the current
  // caller can submit feedback on the given section. A client-side mirror of
  // the `feedback:submit` + `requireSectionAccess` gate used by `submit` above.
  // Keeps the UI honest without a failed-mutation round-trip.
  canSubmit: protectedProcedure
    .input(z.object({ sectionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Must have the base permission.
      if (!can(ctx.user.role, 'feedback:submit')) {
        return { canSubmit: false, reason: 'role' as const }
      }

      // Bypass roles (admin/auditor/policy_lead) would satisfy the RBAC
      // middleware but they don't hold `feedback:submit` in the matrix, so
      // the role check above already handles them. Keep the bypass list in
      // mind so the branch below mirrors requireSectionAccess exactly.
      if (BYPASS_SECTION_SCOPE.includes(ctx.user.role as Role)) {
        return { canSubmit: true, reason: null }
      }

      const [assignment] = await db
        .select({ id: sectionAssignments.id })
        .from(sectionAssignments)
        .where(
          and(
            eq(sectionAssignments.userId, ctx.user.id),
            eq(sectionAssignments.sectionId, input.sectionId),
          ),
        )
        .limit(1)

      if (!assignment) {
        return { canSubmit: false, reason: 'assignment' as const }
      }
      return { canSubmit: true, reason: null }
    }),

  // List all feedback for a document (admin/policy_lead/auditor)
  // E2: accept arrays for multi-select filters (statuses/types/priorities/impacts/orgTypes)
  // so filtering is always server-side regardless of how many chips are checked.
  // Singular inputs (status/feedbackType/priority/impactCategory/orgType) are
  // retained for backward compatibility with older callers (e.g. CR dialog).
  list: requirePermission('feedback:read_all')
    .input(z.object({
      documentId: z.string().uuid(),
      sectionId: z.string().uuid().optional(),
      status: z.enum(STATUSES).optional(),
      statuses: z.array(z.enum(STATUSES)).optional(),
      feedbackType: z.enum(FEEDBACK_TYPES).optional(),
      feedbackTypes: z.array(z.enum(FEEDBACK_TYPES)).optional(),
      priority: z.enum(PRIORITIES).optional(),
      priorities: z.array(z.enum(PRIORITIES)).optional(),
      impactCategory: z.enum(IMPACT_CATEGORIES).optional(),
      impactCategories: z.array(z.enum(IMPACT_CATEGORIES)).optional(),
      orgType: z.enum(['government', 'industry', 'legal', 'academia', 'civil_society', 'internal'] as const).optional(),
      orgTypes: z.array(z.enum(['government', 'industry', 'legal', 'academia', 'civil_society', 'internal'] as const)).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(feedbackItems.documentId, input.documentId)]

      if (input.sectionId) conditions.push(eq(feedbackItems.sectionId, input.sectionId))
      // Merge singular + array forms; singular wraps into a 1-element array.
      const statuses = input.statuses && input.statuses.length > 0 ? input.statuses : input.status ? [input.status] : []
      const feedbackTypes = input.feedbackTypes && input.feedbackTypes.length > 0 ? input.feedbackTypes : input.feedbackType ? [input.feedbackType] : []
      const priorities = input.priorities && input.priorities.length > 0 ? input.priorities : input.priority ? [input.priority] : []
      const impactCategories = input.impactCategories && input.impactCategories.length > 0 ? input.impactCategories : input.impactCategory ? [input.impactCategory] : []
      const orgTypes = input.orgTypes && input.orgTypes.length > 0 ? input.orgTypes : input.orgType ? [input.orgType] : []

      if (statuses.length > 0) conditions.push(inArray(feedbackItems.status, statuses))
      if (feedbackTypes.length > 0) conditions.push(inArray(feedbackItems.feedbackType, feedbackTypes))
      if (priorities.length > 0) conditions.push(inArray(feedbackItems.priority, priorities))
      if (impactCategories.length > 0) conditions.push(inArray(feedbackItems.impactCategory, impactCategories))
      // R5: `inArray` alone drops users whose `orgType IS NULL` (nullable
      // until the user finishes their profile). Without the `OR IS NULL`
      // branch, applying even one org-type chip silently hides every item
      // submitted by a user who has not yet set their org type. Keep
      // NULL-orgType items visible under any active filter.
      if (orgTypes.length > 0) {
        conditions.push(
          or(inArray(users.orgType, orgTypes), isNull(users.orgType))!,
        )
      }

      // R9: left-join policySections so the inbox card can render the
      // section title. Previously `sectionTitle` was never selected and
      // FeedbackCard rendered `undefined`, leaving reviewers unable to
      // tell which section a feedback item targeted without opening the
      // detail sheet.
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
          milestoneId: feedbackItems.milestoneId,
          submitterName: users.name,
          submitterOrgType: users.orgType,
          sectionTitle: policySections.title,
        })
        .from(feedbackItems)
        .leftJoin(users, eq(feedbackItems.submitterId, users.id))
        .leftJoin(policySections, eq(feedbackItems.sectionId, policySections.id))
        .where(and(...conditions))
        .orderBy(desc(feedbackItems.createdAt))

      // Server-side anonymity enforcement: null out submitter info for anonymous items
      // unless caller is admin or policy_lead
      const userRole = ctx.user.role
      // E5: identity visibility restricted to admin only. Previously included
      // policy_lead, but the participant-facing anonymity-toggle promised
      // "Admins and Policy Leads cannot see your identity" — honoring that
      // promise means the server must not expose identity to policy_lead.
      const canSeeIdentity = userRole === 'admin'

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
      // E5: identity visibility restricted to admin only. Previously included
      // policy_lead, but the participant-facing anonymity-toggle promised
      // "Admins and Policy Leads cannot see your identity" — honoring that
      // promise means the server must not expose identity to policy_lead.
      const canSeeIdentity = userRole === 'admin'

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

  // List own feedback (stakeholder/research_lead/workshop_moderator/observer).
  //
  // S21: explicit column projection. The previous `db.select()` returned
  //      every feedbackItems column, including `reviewedBy` (the reviewer's
  //      user id, an internal identity leak). The projection below mirrors
  //      the submitter-visible subset used by `feedback.listCrossPolicy`
  //      and drops reviewedBy / reviewedAt (auditor-only) plus columns not
  //      consumed by the "My Feedback" UI. `decisionRationale` stays so
  //      submitters can see the reviewer's reasoning.
  listOwn: requirePermission('feedback:read_own')
    .query(async ({ ctx }) => {
      const rows = await db
        .select({
          id: feedbackItems.id,
          readableId: feedbackItems.readableId,
          sectionId: feedbackItems.sectionId,
          documentId: feedbackItems.documentId,
          feedbackType: feedbackItems.feedbackType,
          priority: feedbackItems.priority,
          impactCategory: feedbackItems.impactCategory,
          title: feedbackItems.title,
          body: feedbackItems.body,
          suggestedChange: feedbackItems.suggestedChange,
          status: feedbackItems.status,
          isAnonymous: feedbackItems.isAnonymous,
          decisionRationale: feedbackItems.decisionRationale,
          createdAt: feedbackItems.createdAt,
          updatedAt: feedbackItems.updatedAt,
        })
        .from(feedbackItems)
        .where(eq(feedbackItems.submitterId, ctx.user.id))
        .orderBy(desc(feedbackItems.createdAt))

      return rows
    }),

  // Cross-policy feedback list (Phase 13 D-09 global feedback data source)
  // Role-aware: read_all callers get everything; read_own callers get only their submissions.
  // NOTE: uses protectedProcedure with internal permission branching because
  // the two permissions (feedback:read_all and feedback:read_own) are disjoint
  // in the permission matrix - no single requirePermission() call covers both.
  //
  // R18: accept arrays for `statuses` / `feedbackTypes` / `priorities` so the
  //      cross-policy tab can multi-select (matches the per-policy `feedback.list`
  //      behavior updated in E2). The singular inputs remain for backward
  //      compatibility with older callers; when both are passed the array
  //      takes precedence, mirroring the merge pattern in `feedback.list`.
  listCrossPolicy: protectedProcedure
    .input(z.object({
      policyId: z.string().uuid().optional(),
      status: z.enum(STATUSES).optional(),
      statuses: z.array(z.enum(STATUSES)).optional(),
      feedbackType: z.enum(FEEDBACK_TYPES).optional(),
      feedbackTypes: z.array(z.enum(FEEDBACK_TYPES)).optional(),
      priority: z.enum(PRIORITIES).optional(),
      priorities: z.array(z.enum(PRIORITIES)).optional(),
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

      // R18: merge singular + array inputs and switch between eq / inArray
      // based on cardinality.
      const statuses = input.statuses && input.statuses.length > 0
        ? input.statuses
        : input.status ? [input.status] : []
      const feedbackTypes = input.feedbackTypes && input.feedbackTypes.length > 0
        ? input.feedbackTypes
        : input.feedbackType ? [input.feedbackType] : []
      const priorities = input.priorities && input.priorities.length > 0
        ? input.priorities
        : input.priority ? [input.priority] : []

      if (statuses.length > 0) conditions.push(inArray(feedbackItems.status, statuses))
      if (feedbackTypes.length > 0) conditions.push(inArray(feedbackItems.feedbackType, feedbackTypes))
      if (priorities.length > 0) conditions.push(inArray(feedbackItems.priority, priorities))

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

      // Anonymity enforcement - same pattern as feedback.list
      const canSeeIdentity = ctx.user.role === 'admin' // E5
      return rows.map((row) => {
        if (row.isAnonymous && !canSeeIdentity) {
          return { ...row, submitterId: null, submitterName: null, submitterOrgType: null }
        }
        return row
      })
    }),

  // Get single feedback by ID.
  //
  // R7: accept an optional `documentId` so the caller can scope the lookup
  // to the policy page it is rendering. Without this scope, a reviewer with
  // `feedback:read_all` on Policy A could craft `?selected=<id from Policy B>`
  // and open Policy B's feedback via the detail sheet -- body, rationale,
  // suggested change and all -- with no cross-policy check. When documentId
  // is passed, a row from a different document returns NOT_FOUND at the
  // query level, short-circuiting the IDOR.
  getById: requirePermission('feedback:read_own')
    .input(z.object({
      id: z.string().uuid(),
      documentId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const whereConditions = [eq(feedbackItems.id, input.id)]
      if (input.documentId) {
        whereConditions.push(eq(feedbackItems.documentId, input.documentId))
      }

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
        .where(and(...whereConditions))
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
      // E5: identity visibility restricted to admin only. Previously included
      // policy_lead, but the participant-facing anonymity-toggle promised
      // "Admins and Policy Leads cannot see your identity" — honoring that
      // promise means the server must not expose identity to policy_lead.
      const canSeeIdentity = userRole === 'admin'

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

      // R8: include fromStatus/toStatus so the audit trail records the
      // transition context without cross-referencing workflowTransitions.
      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.FEEDBACK_START_REVIEW,
        entityType: 'feedback',
        entityId: input.id,
        payload: {
          fromStatus: updated.previousStatus,
          toStatus:   updated.newStatus,
        },
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

      // Emit Flow 5 event - the feedbackReviewedFn Inngest function handles
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

      // R8: include fromStatus/toStatus so the audit trail records the
      // transition context without cross-referencing workflowTransitions.
      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.FEEDBACK_CLOSE,
        entityType: 'feedback',
        entityId: input.id,
        payload: {
          fromStatus: updated.previousStatus,
          toStatus:   updated.newStatus,
        },
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
