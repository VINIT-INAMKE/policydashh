import { z } from 'zod'
import { router, protectedProcedure, requirePermission } from '@/src/trpc/init'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { eq, count, and, isNull } from 'drizzle-orm'
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
  // D2: filter out soft-deleted rows so an admin inviting a previously-deleted
  // email doesn't get a spurious "already exists" warning for an anonymized row.
  checkEmailExists: requirePermission('user:invite')
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const existing = await db.query.users.findFirst({
        where: and(
          eq(users.email, input.email.toLowerCase()),
          isNull(users.deletedAt),
        ),
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

      // D6: distinct action so an auditor filtering by `user.invite_revoke`
      // sees only revokes (previously collapsed into USER_INVITE).
      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.USER_INVITE_REVOKE,
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

      // D6: distinct action so an auditor filtering by `user.invite_resend`
      // sees only resends (previously collapsed into USER_INVITE).
      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.USER_INVITE_RESEND,
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
      // D2: exclude soft-deleted rows. A deleted admin still carries
      // `role='admin'` after anonymization but must not count toward the
      // "at least one admin must remain" invariant - otherwise the only
      // real admin gets demoted because a deleted admin inflates the count.
      if (target.role === 'admin' && input.role !== 'admin') {
        const [adminCountRow] = await db
          .select({ cnt: count() })
          .from(users)
          .where(and(eq(users.role, 'admin'), isNull(users.deletedAt)))
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

  // Admin only: list all users.
  // D2: exclude soft-deleted rows (Clerk-anonymized accounts still carry a
  // sentinel clerkId but have deletedAt set). Those rows render as blank
  // entries in the admin UI and confuse role-management operations.
  // D17: explicit column projection - drop clerkId, phone, deletedAt,
  // lastActivityAt, and lastVisitedAt from the wire payload. The admin UI
  // only renders name/email/role/orgType/createdAt; sending the extra fields
  // is dead weight and a latent PII-exposure surface.
  listUsers: requirePermission('user:list')
    .query(async () => {
      const allUsers = await db.query.users.findMany({
        where: isNull(users.deletedAt),
        columns: {
          id: true,
          email: true,
          name: true,
          role: true,
          orgType: true,
          createdAt: true,
        },
        orderBy: (users, { desc }) => [desc(users.createdAt)],
      })
      return allUsers
    }),

})
