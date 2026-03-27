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

  let user = userId
    ? await db.query.users.findFirst({ where: eq(users.clerkId, userId) })
    : null

  // Auto-create user row if Clerk session exists but webhook hasn't synced yet
  if (userId && !user) {
    const [created] = await db.insert(users).values({
      clerkId: userId,
      role: 'stakeholder',
      orgType: null,
    }).onConflictDoNothing().returning()
    user = created ?? await db.query.users.findFirst({ where: eq(users.clerkId, userId) })
  }

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

export const protectedProcedure = t.procedure.use(enforceAuth)

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
