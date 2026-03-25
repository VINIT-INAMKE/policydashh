import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { db } from '@/src/db'
import { notifications } from '@/src/db/schema/notifications'
import { eq, and, desc, sql, lt } from 'drizzle-orm'

export const notificationRouter = router({
  /**
   * List notifications for the current user, ordered by createdAt DESC.
   * Cursor-based pagination using the createdAt of a notification.
   */
  list: requirePermission('notification:read')
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(notifications.userId, ctx.user.id)]

      // If cursor provided, fetch createdAt of cursor notification and paginate from there
      if (input.cursor) {
        const [cursorRow] = await db
          .select({ createdAt: notifications.createdAt })
          .from(notifications)
          .where(eq(notifications.id, input.cursor))
          .limit(1)

        if (cursorRow) {
          conditions.push(lt(notifications.createdAt, cursorRow.createdAt))
        }
      }

      const rows = await db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(input.limit)

      return rows
    }),

  /**
   * Count unread notifications for the current user.
   */
  unreadCount: requirePermission('notification:read')
    .query(async ({ ctx }) => {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, ctx.user.id),
            eq(notifications.isRead, false),
          ),
        )

      return result?.count ?? 0
    }),

  /**
   * Mark a single notification as read.
   */
  markRead: requirePermission('notification:manage')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.userId, ctx.user.id),
          ),
        )

      return { success: true }
    }),

  /**
   * Mark all notifications as read for the current user.
   */
  markAllRead: requirePermission('notification:manage')
    .mutation(async ({ ctx }) => {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, ctx.user.id))

      return { success: true }
    }),
})
