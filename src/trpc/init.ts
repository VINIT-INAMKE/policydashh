import { initTRPC, TRPCError } from '@trpc/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { eq } from 'drizzle-orm'
import { cache } from 'react'
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
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof Error ? error.cause.message : null,
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
      userId: ctx.userId,
      user: ctx.user,
    },
  })
})

const touchActivity = t.middleware(async ({ ctx, next, type }) => {
  const result = await next({ ctx })
  if (type === 'mutation' && ctx.user) {
    db.update(users)
      .set({ lastActivityAt: new Date() })
      .where(eq(users.id, ctx.user.id))
      .catch(() => {})
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
