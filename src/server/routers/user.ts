import { z } from 'zod'
import { router, protectedProcedure, requirePermission } from '@/src/trpc/init'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { eq, count, desc, sql } from 'drizzle-orm'
import { feedbackItems } from '@/src/db/schema/feedback'
import { workshopRegistrations, workshops } from '@/src/db/schema/workshops'
import { and, isNotNull } from 'drizzle-orm'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS, ORG_TYPE_VALUES } from '@/src/lib/constants'
import { TRPCError } from '@trpc/server'

export const userRouter = router({
  // Any authenticated user can read their own profile
  getMe: protectedProcedure.query(async ({ ctx }) => {
    return {
      id: ctx.user.id,
      clerkId: ctx.user.clerkId,
      phone: ctx.user.phone,
      email: ctx.user.email,
      name: ctx.user.name,
      role: ctx.user.role,
      orgType: ctx.user.orgType,
      createdAt: ctx.user.createdAt,
    }
  }),

  // Any authenticated user can update their own org type
  updateProfile: protectedProcedure
    .input(z.object({
      orgType: z.enum(ORG_TYPE_VALUES as [string, ...string[]]).nullable().optional(),
      name: z.string().min(1).max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = { updatedAt: new Date() }
      if (input.orgType !== undefined) updateData.orgType = input.orgType
      if (input.name !== undefined) updateData.name = input.name

      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, ctx.user.id))
        .returning()

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.USER_UPDATE,
        entityType: 'user',
        entityId: ctx.user.id,
        payload: { before: { orgType: ctx.user.orgType, name: ctx.user.name }, after: input },
      }).catch(console.error)

      return updated
    }),

  // Admin only: invite a user by email with a pre-assigned role
  // Uses Clerk Invitations API to send an email invite.
  // The user.created webhook syncs to our database with the assigned role.
  invite: requirePermission('user:invite')
    .input(z.object({
      email: z.string().email(),
      role: z.enum(['admin', 'policy_lead', 'research_lead', 'workshop_moderator', 'stakeholder', 'observer', 'auditor']),
    }))
    .mutation(async ({ ctx, input }) => {
      const { createClerkClient } = await import('@clerk/backend')
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

      let invitation
      try {
        invitation = await clerk.invitations.createInvitation({
          emailAddress: input.email,
          publicMetadata: { role: input.role },
        })
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to send invite: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
      }

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.USER_INVITE,
        entityType: 'user',
        entityId: invitation.id,
        payload: { email: input.email, role: input.role },
      }).catch(console.error)

      return { invitationId: invitation.id, email: input.email, role: input.role }
    }),

  // Admin only: update another user's role
  updateRole: requirePermission('user:manage_roles')
    .input(z.object({
      userId: z.string().uuid(),
      role: z.enum(['admin', 'policy_lead', 'research_lead', 'workshop_moderator', 'stakeholder', 'observer', 'auditor']),
    }))
    .mutation(async ({ ctx, input }) => {
      const target = await db.query.users.findFirst({
        where: eq(users.id, input.userId),
      })
      if (!target) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' })
      }

      const [updated] = await db
        .update(users)
        .set({ role: input.role, updatedAt: new Date() })
        .where(eq(users.id, input.userId))
        .returning()

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.USER_UPDATE,
        entityType: 'user',
        entityId: input.userId,
        payload: { before: { role: target.role }, after: { role: input.role } },
      }).catch(console.error)

      return updated
    }),

  // Any authenticated user can update their own last visited timestamp
  // No audit log -- operational, not a business event
  updateLastVisited: protectedProcedure
    .mutation(async ({ ctx }) => {
      await db
        .update(users)
        .set({ lastVisitedAt: new Date() })
        .where(eq(users.id, ctx.user.id))

      return { success: true }
    }),

  // Admin only: list all users
  listUsers: requirePermission('user:list')
    .query(async () => {
      const allUsers = await db.query.users.findMany({
        orderBy: (users, { desc }) => [desc(users.createdAt)],
      })
      return allUsers
    }),

  // engagementScore = feedbackCount + attendedWorkshopCount (D-01, D-02)
  listUsersWithEngagement: requirePermission('user:list')
    .query(async () => {
      const feedbackCounts = db
        .select({
          submitterId: feedbackItems.submitterId,
          cnt: count().as('cnt'),
        })
        .from(feedbackItems)
        .groupBy(feedbackItems.submitterId)
        .as('feedback_counts')

      const attendanceCounts = db
        .select({
          userId: workshopRegistrations.userId,
          cnt: count().as('cnt'),
        })
        .from(workshopRegistrations)
        .where(and(
          isNotNull(workshopRegistrations.userId),
          isNotNull(workshopRegistrations.attendedAt),
        ))
        .groupBy(workshopRegistrations.userId)
        .as('attendance_counts')

      return db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          orgType: users.orgType,
          createdAt: users.createdAt,
          lastActivityAt: users.lastActivityAt,
          engagementScore: sql<number>`
            COALESCE(${feedbackCounts.cnt}, 0) + COALESCE(${attendanceCounts.cnt}, 0)
          `.mapWith(Number),
        })
        .from(users)
        .leftJoin(feedbackCounts, eq(users.id, feedbackCounts.submitterId))
        .leftJoin(attendanceCounts, eq(users.id, attendanceCounts.userId))
        .orderBy(users.createdAt)
    }),

  getUserProfile: requirePermission('user:list')
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [profile, userFeedback, attendedWorkshops, feedbackCountResult, attendanceCountResult] = await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, input.userId) }),

        db
          .select({
            id: feedbackItems.id,
            readableId: feedbackItems.readableId,
            title: feedbackItems.title,
            status: feedbackItems.status,
            createdAt: feedbackItems.createdAt,
          })
          .from(feedbackItems)
          .where(eq(feedbackItems.submitterId, input.userId))
          .orderBy(desc(feedbackItems.createdAt))
          .limit(20),

        db
          .select({
            workshopId: workshopRegistrations.workshopId,
            title: workshops.title,
            scheduledAt: workshops.scheduledAt,
            attendedAt: workshopRegistrations.attendedAt,
            status: workshopRegistrations.status,
          })
          .from(workshopRegistrations)
          .innerJoin(workshops, eq(workshopRegistrations.workshopId, workshops.id))
          .where(and(
            eq(workshopRegistrations.userId, input.userId),
            isNotNull(workshopRegistrations.attendedAt),
          ))
          .orderBy(desc(workshops.scheduledAt)),

        db.select({ cnt: count() }).from(feedbackItems)
          .where(eq(feedbackItems.submitterId, input.userId)),

        db.select({ cnt: count() }).from(workshopRegistrations)
          .where(and(
            eq(workshopRegistrations.userId, input.userId),
            isNotNull(workshopRegistrations.attendedAt),
          )),
      ])

      if (!profile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found.' })
      }

      const engagementScore = (feedbackCountResult[0]?.cnt ?? 0) + (attendanceCountResult[0]?.cnt ?? 0)

      return { profile, attendedWorkshops, userFeedback, engagementScore }
    }),
})
