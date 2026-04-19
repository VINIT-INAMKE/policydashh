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

      // C11: produce a clean diff by merging the prior row with the input so
      // `after` reflects the full post-state, not just the delta. This keeps
      // audit payloads symmetrical (same keys on both sides).
      const before = { orgType: ctx.user.orgType, name: ctx.user.name }
      const after = { ...before, ...input }
      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.USER_UPDATE,
        entityType: 'user',
        entityId: ctx.user.id,
        payload: { before, after },
      }).catch(console.error)

      return updated
    }),

  // Admin only: check whether an email already has a user row in our DB
  // (C3 pre-flight so the invite dialog can warn instead of hitting Clerk
  // and getting a vague already-exists error).
  checkEmailExists: requirePermission('user:invite')
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const existing = await db.query.users.findFirst({
        where: eq(users.email, input.email.toLowerCase()),
        columns: { id: true, email: true, role: true, name: true },
      })
      return { exists: !!existing, user: existing ?? null }
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

  // C4: Admin only — list pending/revoked Clerk invitations for the Users UI.
  // Pagination is simple (offset/limit) to match Clerk's API surface.
  listPendingInvitations: requirePermission('user:invite')
    .input(z.object({
      status: z.enum(['pending', 'accepted', 'revoked', 'expired']).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const filters = input ?? { limit: 50, offset: 0 }
      const { createClerkClient } = await import('@clerk/backend')
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

      try {
        const res = await clerk.invitations.getInvitationList({
          status: filters.status ?? 'pending',
          limit: filters.limit ?? 50,
          offset: filters.offset ?? 0,
        })
        return {
          totalCount: res.totalCount,
          data: res.data.map((inv) => ({
            id: inv.id,
            emailAddress: inv.emailAddress,
            status: inv.status,
            role: (inv.publicMetadata && typeof inv.publicMetadata === 'object' && 'role' in inv.publicMetadata)
              ? String((inv.publicMetadata as { role?: unknown }).role ?? '')
              : null,
            createdAt: inv.createdAt,
            updatedAt: inv.updatedAt,
            url: inv.url ?? null,
            revoked: inv.revoked ?? false,
          })),
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to list invitations: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
      }
    }),

  // C4: Admin only — revoke a pending Clerk invitation.
  revokeInvitation: requirePermission('user:invite')
    .input(z.object({ invitationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { createClerkClient } = await import('@clerk/backend')
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

      try {
        await clerk.invitations.revokeInvitation(input.invitationId)
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to revoke invitation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
      }

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.USER_INVITE,
        entityType: 'user_invitation',
        entityId: input.invitationId,
        payload: { revoked: true },
      }).catch(console.error)

      return { invitationId: input.invitationId, revoked: true }
    }),

  // C4: Admin only — resend an invitation by revoking the existing one and
  // creating a fresh invite for the same email/role. Clerk has no explicit
  // "resend" endpoint, so this is the documented workaround.
  resendInvitation: requirePermission('user:invite')
    .input(z.object({
      invitationId: z.string().min(1),
      email: z.string().email(),
      role: z.enum(['admin', 'policy_lead', 'research_lead', 'workshop_moderator', 'stakeholder', 'observer', 'auditor']),
    }))
    .mutation(async ({ ctx, input }) => {
      const { createClerkClient } = await import('@clerk/backend')
      const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! })

      // Revoke first; if it's already accepted/expired, surface that to the caller.
      try {
        await clerk.invitations.revokeInvitation(input.invitationId)
      } catch (error) {
        // Non-fatal: some states (e.g. accepted) cannot be revoked. Continue
        // and let createInvitation decide whether to proceed.
        console.warn('[user.resendInvitation] revoke skipped', error)
      }

      let invitation
      try {
        invitation = await clerk.invitations.createInvitation({
          emailAddress: input.email,
          publicMetadata: { role: input.role },
        })
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to resend invite: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
      }

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.USER_INVITE,
        entityType: 'user_invitation',
        entityId: invitation.id,
        payload: { email: input.email, role: input.role, resent: true, previousInvitationId: input.invitationId },
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

      // B6: prevent an admin from demoting themselves — they could lock the
      // org out of user management. The admin must ask another admin to do it.
      if (input.userId === ctx.user.id && input.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You cannot change your own admin role. Ask another admin to update it.',
        })
      }

      // B6: last-admin guard — if this change would drop the admin count to 0,
      // refuse. Applies whether the target is self (belt-and-braces) or another
      // admin being demoted.
      if (target.role === 'admin' && input.role !== 'admin') {
        const [adminCountRow] = await db
          .select({ cnt: count() })
          .from(users)
          .where(eq(users.role, 'admin'))
        const adminCount = adminCountRow?.cnt ?? 0
        if (adminCount <= 1) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Cannot remove the last admin. Promote another user to admin first.',
          })
        }
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
          cnt: count().as('fb_cnt'),
        })
        .from(feedbackItems)
        .groupBy(feedbackItems.submitterId)
        .as('feedback_counts')

      const attendanceCounts = db
        .select({
          userId: workshopRegistrations.userId,
          cnt: count().as('att_cnt'),
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
