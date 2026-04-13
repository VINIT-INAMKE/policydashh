import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { db } from '@/src/db'
import { sectionAssignments } from '@/src/db/schema/sectionAssignments'
import { users } from '@/src/db/schema/users'
import { policySections, policyDocuments } from '@/src/db/schema/documents'
import { eq, and } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { sendNotificationCreate } from '@/src/inngest/events'

export const sectionAssignmentRouter = router({
  // Assign a user to a section
  assign: requirePermission('section:assign')
    .input(z.object({
      userId: z.string().uuid(),
      sectionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [assignment] = await db
          .insert(sectionAssignments)
          .values({
            userId: input.userId,
            sectionId: input.sectionId,
            assignedBy: ctx.user.id,
          })
          .returning()

        writeAuditLog({
          actorId: ctx.user.id,
          actorRole: ctx.user.role,
          action: ACTIONS.SECTION_ASSIGN,
          entityType: 'section_assignment',
          entityId: assignment.id,
          payload: { userId: input.userId, sectionId: input.sectionId },
        }).catch(console.error)

        // NOTIF-04: replaces the old legacy notification + email pair. The
        // notificationDispatchFn looks up the recipient's email inside its
        // step.run('fetch-user-email') so the router no longer needs to.
        const [section] = await db
          .select({
            title: policySections.title,
            documentId: policySections.documentId,
          })
          .from(policySections)
          .where(eq(policySections.id, input.sectionId))
          .limit(1)

        const sectionName = section?.title ?? 'a section'
        let policyName = 'a policy'
        const documentId = section?.documentId

        if (documentId) {
          const [doc] = await db
            .select({ title: policyDocuments.title })
            .from(policyDocuments)
            .where(eq(policyDocuments.id, documentId))
            .limit(1)
          policyName = doc?.title ?? 'a policy'
        }

        await sendNotificationCreate({
          userId:     input.userId,
          type:       'section_assigned',
          title:      'New section assigned',
          body:       `You have been assigned to \u201c${sectionName}\u201d in ${policyName}.`,
          entityType: 'section',
          entityId:   input.sectionId,
          linkHref:   documentId ? `/policies/${documentId}/sections/${input.sectionId}` : undefined,
          createdBy:  ctx.user.id,
          action:     'assign',
        })

        return assignment
      } catch (error: unknown) {
        // Handle unique constraint violation (user already assigned)
        const pgError = error as { code?: string }
        if (pgError.code === '23505') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'User is already assigned to this section',
          })
        }
        throw error
      }
    }),

  // Unassign a user from a section
  unassign: requirePermission('section:assign')
    .input(z.object({
      userId: z.string().uuid(),
      sectionId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await db
        .delete(sectionAssignments)
        .where(
          and(
            eq(sectionAssignments.userId, input.userId),
            eq(sectionAssignments.sectionId, input.sectionId),
          ),
        )
        .returning()

      if (!deleted) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Section assignment not found',
        })
      }

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.SECTION_UNASSIGN,
        entityType: 'section_assignment',
        entityId: deleted.id,
        payload: { userId: input.userId, sectionId: input.sectionId },
      }).catch(console.error)

      return { success: true }
    }),

  // List users assigned to a section
  listBySection: requirePermission('section:read_assignments')
    .input(z.object({ sectionId: z.string().uuid() }))
    .query(async ({ input }) => {
      const assignments = await db
        .select({
          id: sectionAssignments.id,
          userId: sectionAssignments.userId,
          sectionId: sectionAssignments.sectionId,
          assignedBy: sectionAssignments.assignedBy,
          createdAt: sectionAssignments.createdAt,
          userName: users.name,
          userRole: users.role,
          userOrgType: users.orgType,
        })
        .from(sectionAssignments)
        .leftJoin(users, eq(sectionAssignments.userId, users.id))
        .where(eq(sectionAssignments.sectionId, input.sectionId))

      return assignments
    }),

  // List sections assigned to a user
  listByUser: requirePermission('section:read_assignments')
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ input }) => {
      const assignments = await db
        .select({
          id: sectionAssignments.id,
          userId: sectionAssignments.userId,
          sectionId: sectionAssignments.sectionId,
          assignedBy: sectionAssignments.assignedBy,
          createdAt: sectionAssignments.createdAt,
          sectionTitle: policySections.title,
        })
        .from(sectionAssignments)
        .leftJoin(policySections, eq(sectionAssignments.sectionId, policySections.id))
        .where(eq(sectionAssignments.userId, input.userId))

      return assignments
    }),
})
