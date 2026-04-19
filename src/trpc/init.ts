import { initTRPC, TRPCError } from '@trpc/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { eq } from 'drizzle-orm'
import { cache } from 'react'
import { z } from 'zod'
import { can, type Permission } from '@/src/lib/permissions'
import type { Role } from '@/src/lib/constants'

export const createTRPCContext = cache(async (opts: { headers: Headers }) => {
  const { userId } = await auth()

  const user = userId
    ? await db.query.users.findFirst({ where: eq(users.clerkId, userId) })
    : null

  return {
    headers: opts.headers,
    userId,
    user,
  }
})

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>

const t = initTRPC.context<TRPCContext>().create({
  errorFormatter({ shape, error }) {
    const isZodError = error.cause instanceof z.ZodError
    return {
      ...shape,
      data: {
        ...shape.data,
        // C7: surface field-level zod validation errors to clients (zod v4 API).
        // Clients can inspect `error.data.zodError.issues` for per-field messages
        // or `error.data.zodError.tree` for a nested shape mapping field path → errors.
        zodError: isZodError
          ? {
              issues: (error.cause as z.ZodError).issues,
              tree: z.treeifyError(error.cause as z.ZodError),
            }
          : null,
      },
    }
  },
})

export { t }
export const router = t.router
export const createCallerFactory = t.createCallerFactory
export const publicProcedure = t.procedure

// Middleware 1: Auth check -- throws UNAUTHORIZED if no Clerk session
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.userId || !ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' })
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId as string,
      user: ctx.user as NonNullable<typeof ctx.user>,
    },
  })
})

const touchActivity = t.middleware(async ({ ctx, next, type }) => {
  const result = await next({
    ctx: {
      ...ctx,
      userId: ctx.userId as string,
      user: ctx.user as NonNullable<typeof ctx.user>,
    },
  })
  if (type === 'mutation' && ctx.user) {
    // C8: surface touchActivity failures rather than silently swallowing.
    // Non-fatal to the caller, but useful for ops to notice DB pressure / schema drift.
    db.update(users)
      .set({ lastActivityAt: new Date() })
      .where(eq(users.id, ctx.user.id))
      .catch((err) => {
        console.warn('[trpc] touchActivity failed', err)
      })
  }
  return result
})

export const protectedProcedure = t.procedure.use(enforceAuth).use(touchActivity)

// Middleware 2: Role check -- throws FORBIDDEN if user's role is not in allowedRoles
export const requireRole = (...allowedRoles: Role[]) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!allowedRoles.includes(ctx.user.role as Role)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient permissions' })
    }
    return next({ ctx })
  })

// Middleware 3: Permission check -- uses the permission matrix from permissions.ts
export const requirePermission = (permission: Permission) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!can(ctx.user.role as Role, permission)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: `Missing permission: ${permission}` })
    }
    return next({ ctx })
  })
