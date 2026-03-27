import { z } from 'zod'
import { router, protectedProcedure, requirePermission } from '@/src/trpc/init'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { eq } from 'drizzle-orm'
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

      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.USER_UPDATE,
        entityType: 'user',
        entityId: ctx.user.id,
        payload: { before: { orgType: ctx.user.orgType, name: ctx.user.name }, after: input },
      })

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

      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.USER_INVITE,
        entityType: 'user',
        entityId: invitation.id,
        payload: { email: input.email, role: input.role },
      })

      return { invitationId: invitation.id, email: input.email, role: input.role }
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
})
