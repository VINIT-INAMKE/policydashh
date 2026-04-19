import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { db } from '@/src/db'
import { auditEvents } from '@/src/db/schema/audit'
import { desc, eq, and, gte, lte } from 'drizzle-orm'

export const auditRouter = router({
  // Admin and Auditor only: read audit log entries
  list: requirePermission('audit:read')
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      entityType: z.string().optional(),
      actorId: z.string().optional(),
      actorRole: z.string().optional(),
      action: z.string().optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).optional())
    .query(async ({ input }) => {
      const filters = input ?? {} as NonNullable<typeof input>
      const conditions = []

      if (filters.entityType) conditions.push(eq(auditEvents.entityType, filters.entityType))
      if (filters.actorId) conditions.push(eq(auditEvents.actorId, filters.actorId))
      if (filters.actorRole) conditions.push(eq(auditEvents.actorRole, filters.actorRole))
      if (filters.action) conditions.push(eq(auditEvents.action, filters.action))
      if (filters.from) conditions.push(gte(auditEvents.timestamp, new Date(filters.from)))
      if (filters.to) conditions.push(lte(auditEvents.timestamp, new Date(filters.to)))

      const events = await db
        .select()
        .from(auditEvents)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(auditEvents.timestamp))
        .limit(filters.limit ?? 50)
        .offset(filters.offset ?? 0)

      return events
    }),

  // C12: any authenticated user can view their own audit entries. Scoped by
  // actorId = ctx.user.id so users cannot see other actors' history.
  listMine: requirePermission('audit:read_own')
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      entityType: z.string().optional(),
      action: z.string().optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const filters = input ?? {} as NonNullable<typeof input>
      const conditions = [eq(auditEvents.actorId, ctx.user.id)]

      if (filters.entityType) conditions.push(eq(auditEvents.entityType, filters.entityType))
      if (filters.action) conditions.push(eq(auditEvents.action, filters.action))
      if (filters.from) conditions.push(gte(auditEvents.timestamp, new Date(filters.from)))
      if (filters.to) conditions.push(lte(auditEvents.timestamp, new Date(filters.to)))

      const events = await db
        .select()
        .from(auditEvents)
        .where(and(...conditions))
        .orderBy(desc(auditEvents.timestamp))
        .limit(filters.limit ?? 50)
        .offset(filters.offset ?? 0)

      return events
    }),
})
