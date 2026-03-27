import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { db } from '@/src/db'
import { commentThreads, commentReplies } from '@/src/db/schema/collaboration'
import { eq, asc, inArray } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'

export const commentRouter = router({
  // List all comment threads for a section (with nested replies)
  list: requirePermission('comment:read')
    .input(z.object({
      sectionId: z.string().uuid(),
    }))
    .query(async ({ input }) => {
      const threads = await db
        .select()
        .from(commentThreads)
        .where(eq(commentThreads.sectionId, input.sectionId))
        .orderBy(asc(commentThreads.createdAt))

      const threadIds = threads.map((t) => t.id)
      if (threadIds.length === 0) return []

      // Fetch all replies for the threads in a single query
      const replies = await db
        .select()
        .from(commentReplies)
        .where(inArray(commentReplies.threadId, threadIds))
        .orderBy(asc(commentReplies.createdAt))

      // Group replies by thread
      const repliesByThread = new Map<string, typeof replies>()
      for (const reply of replies) {
        const existing = repliesByThread.get(reply.threadId) ?? []
        existing.push(reply)
        repliesByThread.set(reply.threadId, existing)
      }

      return threads.map((thread) => ({
        ...thread,
        replies: repliesByThread.get(thread.id) ?? [],
      }))
    }),

  // Create a new comment thread
  create: requirePermission('comment:create')
    .input(z.object({
      sectionId: z.string().uuid(),
      commentId: z.string().uuid(),
      body: z.string().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      const [thread] = await db
        .insert(commentThreads)
        .values({
          sectionId: input.sectionId,
          commentId: input.commentId,
          authorId: ctx.user.id,
          body: input.body,
        })
        .returning()

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.COMMENT_CREATE,
        entityType: 'comment_thread',
        entityId: thread.id,
        payload: {
          sectionId: input.sectionId,
          commentId: input.commentId,
        },
      }).catch(console.error)

      return thread
    }),

  // Create a reply to a comment thread
  createReply: requirePermission('comment:create')
    .input(z.object({
      threadId: z.string().uuid(),
      body: z.string().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify thread exists
      const [thread] = await db
        .select({ id: commentThreads.id })
        .from(commentThreads)
        .where(eq(commentThreads.id, input.threadId))
        .limit(1)

      if (!thread) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Comment thread not found' })
      }

      const [reply] = await db
        .insert(commentReplies)
        .values({
          threadId: input.threadId,
          authorId: ctx.user.id,
          body: input.body,
        })
        .returning()

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.COMMENT_REPLY,
        entityType: 'comment_reply',
        entityId: reply.id,
        payload: { threadId: input.threadId },
      }).catch(console.error)

      return reply
    }),

  // Resolve a comment thread
  resolve: requirePermission('comment:create')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [thread] = await db
        .update(commentThreads)
        .set({ resolved: true, updatedAt: new Date() })
        .where(eq(commentThreads.id, input.id))
        .returning()

      if (!thread) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Comment thread not found' })
      }

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.COMMENT_RESOLVE,
        entityType: 'comment_thread',
        entityId: input.id,
      }).catch(console.error)

      return thread
    }),

  // Reopen a resolved comment thread
  reopen: requirePermission('comment:create')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [thread] = await db
        .update(commentThreads)
        .set({ resolved: false, updatedAt: new Date() })
        .where(eq(commentThreads.id, input.id))
        .returning()

      if (!thread) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Comment thread not found' })
      }

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.COMMENT_REOPEN,
        entityType: 'comment_thread',
        entityId: input.id,
      }).catch(console.error)

      return thread
    }),

  // Delete a comment thread (author or admin only)
  delete: requirePermission('comment:create')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Fetch thread to check ownership
      const [thread] = await db
        .select()
        .from(commentThreads)
        .where(eq(commentThreads.id, input.id))
        .limit(1)

      if (!thread) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Comment thread not found' })
      }

      // Only the author or admin can delete
      const isAuthor = thread.authorId === ctx.user.id
      const isAdmin = ctx.user.role === 'admin'

      if (!isAuthor && !isAdmin) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the author or admin can delete this comment' })
      }

      await db
        .delete(commentThreads)
        .where(eq(commentThreads.id, input.id))

      writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.COMMENT_DELETE,
        entityType: 'comment_thread',
        entityId: input.id,
        payload: { sectionId: thread.sectionId },
      }).catch(console.error)

      return { deleted: true }
    }),
})
