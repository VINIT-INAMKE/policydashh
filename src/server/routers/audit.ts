import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { router, requirePermission } from '@/src/trpc/init'
import { db } from '@/src/db'
import { auditEvents } from '@/src/db/schema/audit'
import { desc, eq, and, gte, lte, count } from 'drizzle-orm'
import { ACTIONS } from '@/src/lib/constants'

// D10: actionEnum accepts any value from the ACTIONS map plus the legacy
// literal 'PARTICIPATE_INTAKE' (before D8 migrated it to a constant, some
// audit rows may have been written with the raw string).
const ACTION_VALUES = [
  'PARTICIPATE_INTAKE',
  ...Object.values(ACTIONS),
] as unknown as [string, ...string[]]

export const auditRouter = router({
  // Admin and Auditor only: read audit log entries
  list: requirePermission('audit:read')
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      entityType: z.string().optional(),
      // D10: actorId must be a UUID (the audit schema stores actorId as text
      // but it's always a users.id). A non-UUID filter returns empty;
      // surfacing the validation error is friendlier than silent no-results.
      actorId: z.string().uuid().optional(),
      actorRole: z.string().optional(),
      // D10: action must be one of the known ACTIONS values. Accepts any
      // arbitrary string previously, which silently returned zero rows.
      action: z.enum(ACTION_VALUES).optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).optional())
    .query(async ({ input }) => {
      const filters = input ?? {} as NonNullable<typeof input>

      // D15: reject inverted date ranges instead of silently returning empty.
      // The traceability CSV/PDF routes already do this; match their error
      // shape so an auditor hitting the same footgun across surfaces sees the
      // same message.
      if (filters.from && filters.to) {
        const fromMs = new Date(filters.from).getTime()
        const toMs = new Date(filters.to).getTime()
        if (fromMs > toMs) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '"From" date must be before "To" date.',
          })
        }
      }

      const conditions = []

      if (filters.entityType) conditions.push(eq(auditEvents.entityType, filters.entityType))
      if (filters.actorId) conditions.push(eq(auditEvents.actorId, filters.actorId))
      if (filters.actorRole) conditions.push(eq(auditEvents.actorRole, filters.actorRole))
      if (filters.action) conditions.push(eq(auditEvents.action, filters.action))
      if (filters.from) conditions.push(gte(auditEvents.timestamp, new Date(filters.from)))
      if (filters.to) conditions.push(lte(auditEvents.timestamp, new Date(filters.to)))

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      // D7: fire the page query and the total-count query in parallel so the
      // UI can compute `hasNextPage = totalCount > offset + events.length`
      // and stop disabling Next on an exact-pageSize boundary.
      const [events, totalRow] = await Promise.all([
        db
          .select()
          .from(auditEvents)
          .where(whereClause)
          .orderBy(desc(auditEvents.timestamp))
          .limit(filters.limit ?? 50)
          .offset(filters.offset ?? 0),
        db
          .select({ n: count() })
          .from(auditEvents)
          .where(whereClause),
      ])

      return { events, totalCount: Number(totalRow[0]?.n ?? 0) }
    }),

  // C12: any authenticated user can view their own audit entries. Scoped by
  // actorId = ctx.user.id so users cannot see other actors' history.
  listMine: requirePermission('audit:read_own')
    .input(z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
      entityType: z.string().optional(),
      // D10: constrain the action filter here too for consistency with list.
      action: z.enum(ACTION_VALUES).optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const filters = input ?? {} as NonNullable<typeof input>

      // D15: same from > to guard applied to the personal audit view.
      if (filters.from && filters.to) {
        const fromMs = new Date(filters.from).getTime()
        const toMs = new Date(filters.to).getTime()
        if (fromMs > toMs) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '"From" date must be before "To" date.',
          })
        }
      }

      const conditions = [eq(auditEvents.actorId, ctx.user.id)]

      if (filters.entityType) conditions.push(eq(auditEvents.entityType, filters.entityType))
      if (filters.action) conditions.push(eq(auditEvents.action, filters.action))
      if (filters.from) conditions.push(gte(auditEvents.timestamp, new Date(filters.from)))
      if (filters.to) conditions.push(lte(auditEvents.timestamp, new Date(filters.to)))

      const whereClause = and(...conditions)

      // D7: totalCount parallel query so personal audit view also gets
      // correct "Next" button behaviour at exact-pageSize boundaries.
      const [events, totalRow] = await Promise.all([
        db
          .select()
          .from(auditEvents)
          .where(whereClause)
          .orderBy(desc(auditEvents.timestamp))
          .limit(filters.limit ?? 50)
          .offset(filters.offset ?? 0),
        db
          .select({ n: count() })
          .from(auditEvents)
          .where(whereClause),
      ])

      return { events, totalCount: Number(totalRow[0]?.n ?? 0) }
    }),
})
