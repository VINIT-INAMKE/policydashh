import { z } from 'zod'
import { router, requirePermission, protectedProcedure } from '@/src/trpc/init'
import { db } from '@/src/db'
import { feedbackItems } from '@/src/db/schema/feedback'
import { changeRequests, crFeedbackLinks, crSectionLinks, documentVersions } from '@/src/db/schema/changeRequests'
import { policySections, policyDocuments } from '@/src/db/schema/documents'
import { users } from '@/src/db/schema/users'
import { eq, and, or, desc, ilike, inArray, isNull, gte, lte } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

const ORG_TYPES = ['government', 'industry', 'legal', 'academia', 'civil_society', 'internal'] as const
const FEEDBACK_STATUSES = ['submitted', 'under_review', 'accepted', 'partially_accepted', 'rejected', 'closed'] as const
const CR_STATUSES = ['drafting', 'in_review', 'approved', 'merged', 'closed'] as const

/** Escape ILIKE special characters in user input */
function escapeIlike(input: string): string {
  return input.replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export const traceabilityRouter = router({
  // TRACE-01, TRACE-02, TRACE-03: Traceability matrix
  //
  // D5: multi-value filters. `orgTypes` and `decisionOutcomes` are accepted as
  //     arrays and pushed through `inArray`. D6: the version-range predicate
  //     applies to the *left-joined* documentVersions.createdAt column, so rows
  //     whose CR was never merged (versionId IS NULL) would be silently dropped
  //     under a plain gte/lte. We wrap the comparison with `OR IS NULL` so
  //     un-merged feedback survives the filter.
  // D7: a friendly `from > to` precheck.
  matrix: requirePermission('trace:read')
    .input(z.object({
      documentId: z.string().uuid(),
      sectionId: z.string().uuid().optional(),
      orgTypes: z.array(z.enum(ORG_TYPES)).optional(),
      decisionOutcomes: z.array(z.enum(FEEDBACK_STATUSES)).optional(),
      versionFromLabel: z.string().max(20).optional(),
      versionToLabel: z.string().max(20).optional(),
      limit: z.number().int().min(1).max(500).default(200),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const conditions: ReturnType<typeof eq>[] = [
        eq(feedbackItems.documentId, input.documentId),
      ]

      if (input.sectionId) {
        conditions.push(eq(feedbackItems.sectionId, input.sectionId))
      }
      if (input.decisionOutcomes && input.decisionOutcomes.length > 0) {
        conditions.push(inArray(feedbackItems.status, input.decisionOutcomes))
      }
      if (input.orgTypes && input.orgTypes.length > 0) {
        conditions.push(inArray(users.orgType, input.orgTypes))
      }

      // Version range filter: resolve label strings to version IDs via subquery.
      // D6: documentVersions is LEFT JOINed below, so unbounded gte/lte would
      // silently drop feedback whose CR has no merged version. Wrap in
      // `OR IS NULL` so un-merged rows remain visible.
      let fromCreatedAt: Date | null = null
      let toCreatedAt: Date | null = null

      if (input.versionFromLabel) {
        const [fromVersion] = await db
          .select({ createdAt: documentVersions.createdAt })
          .from(documentVersions)
          .where(and(
            eq(documentVersions.documentId, input.documentId),
            eq(documentVersions.versionLabel, input.versionFromLabel),
          ))
          .limit(1)
        if (fromVersion) {
          fromCreatedAt = fromVersion.createdAt
        }
      }
      if (input.versionToLabel) {
        const [toVersion] = await db
          .select({ createdAt: documentVersions.createdAt })
          .from(documentVersions)
          .where(and(
            eq(documentVersions.documentId, input.documentId),
            eq(documentVersions.versionLabel, input.versionToLabel),
          ))
          .limit(1)
        if (toVersion) {
          toCreatedAt = toVersion.createdAt
        }
      }

      // D7: reject inverted range with a friendly error.
      if (fromCreatedAt && toCreatedAt && fromCreatedAt > toCreatedAt) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '"From" version must be before "To" version. Swap the selections and try again.',
        })
      }

      if (fromCreatedAt) {
        conditions.push(
          or(
            gte(documentVersions.createdAt, fromCreatedAt),
            isNull(documentVersions.createdAt),
          )!,
        )
      }
      if (toCreatedAt) {
        conditions.push(
          or(
            lte(documentVersions.createdAt, toCreatedAt),
            isNull(documentVersions.createdAt),
          )!,
        )
      }

      const rows = await db
        .select({
          feedbackId: feedbackItems.id,
          feedbackReadableId: feedbackItems.readableId,
          feedbackTitle: feedbackItems.title,
          feedbackStatus: feedbackItems.status,
          feedbackDecisionRationale: feedbackItems.decisionRationale,
          feedbackIsAnonymous: feedbackItems.isAnonymous,
          feedbackCreatedAt: feedbackItems.createdAt,
          submitterName: users.name,
          submitterOrgType: users.orgType,
          crId: changeRequests.id,
          crReadableId: changeRequests.readableId,
          crTitle: changeRequests.title,
          crStatus: changeRequests.status,
          sectionId: policySections.id,
          sectionTitle: policySections.title,
          versionId: documentVersions.id,
          versionLabel: documentVersions.versionLabel,
        })
        .from(feedbackItems)
        .leftJoin(users, eq(feedbackItems.submitterId, users.id))
        .leftJoin(crFeedbackLinks, eq(feedbackItems.id, crFeedbackLinks.feedbackId))
        .leftJoin(changeRequests, eq(crFeedbackLinks.crId, changeRequests.id))
        .leftJoin(documentVersions, eq(changeRequests.mergedVersionId, documentVersions.id))
        .leftJoin(crSectionLinks, eq(changeRequests.id, crSectionLinks.crId))
        .leftJoin(policySections, eq(crSectionLinks.sectionId, policySections.id))
        .where(and(...conditions))
        .orderBy(desc(feedbackItems.createdAt))
        .limit(input.limit)
        .offset(input.offset)

      // Anonymity enforcement: null out submitter info for anonymous items
      // unless caller is admin or policy_lead
      const canSeeIdentity = ctx.user.role === 'admin' || ctx.user.role === 'policy_lead'

      return rows.map((row) => {
        if (row.feedbackIsAnonymous && !canSeeIdentity) {
          return {
            ...row,
            submitterName: null,
            submitterOrgType: null,
          }
        }
        return row
      })
    }),

  // TRACE-04: Section chain - feedback linked to a section through CRs with version info
  //
  // D19: `versionCreatedAt` is the renamed-for-clarity field (was `mergedAt`
  // previously, which was misleading because it came from
  // documentVersions.createdAt, not changeRequests.mergedAt).
  sectionChain: requirePermission('trace:read')
    .input(z.object({
      sectionId: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      const rows = await db
        .select({
          sectionId: policySections.id,
          sectionTitle: policySections.title,
          crId: changeRequests.id,
          crReadableId: changeRequests.readableId,
          crTitle: changeRequests.title,
          crStatus: changeRequests.status,
          feedbackId: feedbackItems.id,
          feedbackReadableId: feedbackItems.readableId,
          feedbackTitle: feedbackItems.title,
          feedbackStatus: feedbackItems.status,
          feedbackDecisionRationale: feedbackItems.decisionRationale,
          versionId: documentVersions.id,
          versionLabel: documentVersions.versionLabel,
          versionCreatedAt: documentVersions.createdAt,
        })
        .from(policySections)
        .innerJoin(crSectionLinks, eq(policySections.id, crSectionLinks.sectionId))
        .innerJoin(changeRequests, eq(crSectionLinks.crId, changeRequests.id))
        .leftJoin(crFeedbackLinks, eq(changeRequests.id, crFeedbackLinks.crId))
        .leftJoin(feedbackItems, eq(crFeedbackLinks.feedbackId, feedbackItems.id))
        .leftJoin(documentVersions, eq(changeRequests.mergedVersionId, documentVersions.id))
        .where(eq(policySections.id, input.sectionId))
        .orderBy(desc(documentVersions.createdAt))

      return rows
    }),

  // TRACE-05: Stakeholder outcomes - caller's feedback with resolved version info
  stakeholderOutcomes: protectedProcedure
    .input(z.object({
      documentId: z.string().uuid().optional(),
      userId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Determine target user: admin/policy_lead can view another user's outcomes
      const isPrivileged = ctx.user.role === 'admin' || ctx.user.role === 'policy_lead'
      const targetUserId = (isPrivileged && input.userId) ? input.userId : ctx.user.id

      const conditions: ReturnType<typeof eq>[] = [
        eq(feedbackItems.submitterId, targetUserId),
      ]

      if (input.documentId) {
        conditions.push(eq(feedbackItems.documentId, input.documentId))
      }

      const rows = await db
        .select({
          feedbackId: feedbackItems.id,
          readableId: feedbackItems.readableId,
          title: feedbackItems.title,
          status: feedbackItems.status,
          decisionRationale: feedbackItems.decisionRationale,
          resolvedInVersionId: feedbackItems.resolvedInVersionId,
          versionLabel: documentVersions.versionLabel,
          sectionId: feedbackItems.sectionId,
          sectionTitle: policySections.title,
          createdAt: feedbackItems.createdAt,
        })
        .from(feedbackItems)
        .leftJoin(documentVersions, eq(feedbackItems.resolvedInVersionId, documentVersions.id))
        .leftJoin(policySections, eq(feedbackItems.sectionId, policySections.id))
        .where(and(...conditions))
        .orderBy(desc(feedbackItems.createdAt))

      return rows
    }),

  // SRCH-02: Search feedback by title + body
  searchFeedback: requirePermission('feedback:read_all')
    .input(z.object({
      documentId: z.string().uuid(),
      query: z.string().min(2).max(200),
    }))
    .query(async ({ input }) => {
      const term = `%${escapeIlike(input.query)}%`

      const rows = await db
        .select({
          id: feedbackItems.id,
          readableId: feedbackItems.readableId,
          title: feedbackItems.title,
          body: feedbackItems.body,
          status: feedbackItems.status,
          sectionTitle: policySections.title,
          feedbackType: feedbackItems.feedbackType,
          createdAt: feedbackItems.createdAt,
        })
        .from(feedbackItems)
        .leftJoin(users, eq(feedbackItems.submitterId, users.id))
        .leftJoin(policySections, eq(feedbackItems.sectionId, policySections.id))
        .where(and(
          eq(feedbackItems.documentId, input.documentId),
          or(
            ilike(feedbackItems.title, term),
            ilike(feedbackItems.body, term),
          ),
        ))
        .orderBy(desc(feedbackItems.createdAt))
        .limit(50)

      return rows
    }),

  // SRCH-03: Search sections by title only (v1)
  searchSections: requirePermission('document:read')
    .input(z.object({
      documentId: z.string().uuid(),
      query: z.string().min(2).max(200),
    }))
    .query(async ({ input }) => {
      const term = `%${escapeIlike(input.query)}%`

      const rows = await db
        .select({
          id: policySections.id,
          title: policySections.title,
          orderIndex: policySections.orderIndex,
          documentId: policySections.documentId,
        })
        .from(policySections)
        .leftJoin(policyDocuments, eq(policySections.documentId, policyDocuments.id))
        .where(and(
          eq(policySections.documentId, input.documentId),
          ilike(policySections.title, term),
        ))
        .orderBy(policySections.orderIndex)
        .limit(50)

      return rows
    }),

  // SRCH-04: Search CRs by title + description with optional filters
  searchCRs: requirePermission('cr:read')
    .input(z.object({
      documentId: z.string().uuid(),
      query: z.string().min(2).max(200),
      status: z.enum(CR_STATUSES).optional(),
      sectionId: z.string().uuid().optional(),
      feedbackId: z.string().uuid().optional(),
    }))
    .query(async ({ input }) => {
      const term = `%${escapeIlike(input.query)}%`

      const conditions: (ReturnType<typeof eq> | ReturnType<typeof or>)[] = [
        eq(changeRequests.documentId, input.documentId),
        or(
          ilike(changeRequests.title, term),
          ilike(changeRequests.description, term),
        )!,
      ]

      if (input.status) {
        conditions.push(eq(changeRequests.status, input.status))
      }

      // Filter by section: find CR IDs linked to the given section
      if (input.sectionId) {
        const sectionCRs = await db
          .select({ crId: crSectionLinks.crId })
          .from(crSectionLinks)
          .where(eq(crSectionLinks.sectionId, input.sectionId))
        const crIds = sectionCRs.map((r) => r.crId)
        if (crIds.length === 0) {
          return []
        }
        conditions.push(inArray(changeRequests.id, crIds))
      }

      // Filter by feedback: find CR IDs linked to the given feedback
      if (input.feedbackId) {
        const feedbackCRs = await db
          .select({ crId: crFeedbackLinks.crId })
          .from(crFeedbackLinks)
          .where(eq(crFeedbackLinks.feedbackId, input.feedbackId))
        const crIds = feedbackCRs.map((r) => r.crId)
        if (crIds.length === 0) {
          return []
        }
        conditions.push(inArray(changeRequests.id, crIds))
      }

      const rows = await db
        .select({
          id: changeRequests.id,
          readableId: changeRequests.readableId,
          title: changeRequests.title,
          description: changeRequests.description,
          status: changeRequests.status,
          createdAt: changeRequests.createdAt,
        })
        .from(changeRequests)
        .where(and(...conditions))
        .orderBy(desc(changeRequests.createdAt))
        .limit(50)

      return rows
    }),
})
