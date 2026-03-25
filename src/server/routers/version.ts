import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { db } from '@/src/db'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { users } from '@/src/db/schema/users'
import { sectionAssignments } from '@/src/db/schema/sectionAssignments'
import { policySections, policyDocuments } from '@/src/db/schema/documents'
import {
  computeSectionDiff,
  publishVersion,
  createManualVersion,
} from '@/src/server/services/version.service'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { eq, desc, inArray } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { createNotification } from '@/src/lib/notifications'
import { sendVersionPublishedEmail } from '@/src/lib/email'

export const versionRouter = router({
  // List versions for a document (omit large fields)
  list: requirePermission('version:read')
    .input(z.object({
      documentId: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      const rows = await db
        .select({
          id: documentVersions.id,
          documentId: documentVersions.documentId,
          versionLabel: documentVersions.versionLabel,
          mergeSummary: documentVersions.mergeSummary,
          createdBy: documentVersions.createdBy,
          crId: documentVersions.crId,
          createdAt: documentVersions.createdAt,
          publishedAt: documentVersions.publishedAt,
          isPublished: documentVersions.isPublished,
          creatorName: users.name,
        })
        .from(documentVersions)
        .leftJoin(users, eq(documentVersions.createdBy, users.id))
        .where(eq(documentVersions.documentId, input.documentId))
        .orderBy(desc(documentVersions.createdAt))

      return rows
    }),

  // Get full version by ID (includes sectionsSnapshot and changelog)
  getById: requirePermission('version:read')
    .input(z.object({
      id: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      const [row] = await db
        .select({
          id: documentVersions.id,
          documentId: documentVersions.documentId,
          versionLabel: documentVersions.versionLabel,
          mergeSummary: documentVersions.mergeSummary,
          createdBy: documentVersions.createdBy,
          crId: documentVersions.crId,
          createdAt: documentVersions.createdAt,
          sectionsSnapshot: documentVersions.sectionsSnapshot,
          changelog: documentVersions.changelog,
          publishedAt: documentVersions.publishedAt,
          isPublished: documentVersions.isPublished,
          creatorName: users.name,
        })
        .from(documentVersions)
        .leftJoin(users, eq(documentVersions.createdBy, users.id))
        .where(eq(documentVersions.id, input.id))
        .limit(1)

      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' })
      }

      return row
    }),

  // Create a manual version (not from a CR merge)
  createManual: requirePermission('version:manage')
    .input(z.object({
      documentId: z.string().uuid(),
      notes: z.string().min(10).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const version = await createManualVersion(
        input.documentId,
        input.notes,
        ctx.user.id,
      )

      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.VERSION_CREATE,
        entityType: 'document_version',
        entityId: version.id,
        payload: {
          documentId: input.documentId,
          versionLabel: version.versionLabel,
          notes: input.notes,
        },
      })

      return version
    }),

  // Publish a version (immutable after publish)
  publish: requirePermission('version:publish')
    .input(z.object({
      id: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const version = await publishVersion(input.id, ctx.user.id)

      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.VERSION_PUBLISH,
        entityType: 'document_version',
        entityId: input.id,
        payload: {
          versionLabel: version.versionLabel,
          documentId: version.documentId,
        },
      })

      // Fire-and-forget: notify all assigned stakeholders + send emails
      // Look up policy name
      const [doc] = await db
        .select({ title: policyDocuments.title })
        .from(policyDocuments)
        .where(eq(policyDocuments.id, version.documentId))
        .limit(1)

      const policyName = doc?.title ?? 'A policy'

      // Find all unique users assigned to sections in this document
      const assignedUsers = await db
        .select({ userId: sectionAssignments.userId })
        .from(sectionAssignments)
        .innerJoin(policySections, eq(sectionAssignments.sectionId, policySections.id))
        .where(eq(policySections.documentId, version.documentId))
        .groupBy(sectionAssignments.userId)

      // Fire-and-forget notification per assigned user
      for (const { userId } of assignedUsers) {
        createNotification({
          userId,
          type: 'version_published',
          title: 'New version published',
          body: `${policyName} has a new version: ${version.versionLabel}.`,
          entityType: 'version',
          entityId: version.id,
          linkHref: `/policies/${version.documentId}/versions/${version.id}`,
        }).catch(console.error)
      }

      // Look up emails for assigned users and send fire-and-forget
      if (assignedUsers.length > 0) {
        const userIds = assignedUsers.map((u) => u.userId)
        const usersWithEmail = await db
          .select({ id: users.id, email: users.email })
          .from(users)
          .where(inArray(users.id, userIds))

        for (const user of usersWithEmail) {
          if (user.email) {
            sendVersionPublishedEmail(user.email, {
              policyName,
              versionLabel: version.versionLabel,
            }).catch(console.error)
          }
        }
      }

      return version
    }),

  // Diff between two versions
  diff: requirePermission('version:read')
    .input(z.object({
      versionAId: z.string().uuid(),
      versionBId: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      const [versionA] = await db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.id, input.versionAId))
        .limit(1)

      const [versionB] = await db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.id, input.versionBId))
        .limit(1)

      if (!versionA || !versionB) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'One or both versions not found' })
      }

      if (!versionA.sectionsSnapshot) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Snapshot not available for this version',
        })
      }

      if (!versionB.sectionsSnapshot) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Snapshot not available for this version',
        })
      }

      const diff = computeSectionDiff(versionA.sectionsSnapshot, versionB.sectionsSnapshot)

      return {
        versionA: { id: versionA.id, versionLabel: versionA.versionLabel },
        versionB: { id: versionB.id, versionLabel: versionB.versionLabel },
        diff,
      }
    }),
})
