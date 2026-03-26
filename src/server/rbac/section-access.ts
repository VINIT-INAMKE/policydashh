import { t } from '@/src/trpc/init'
import { db } from '@/src/db'
import { sectionAssignments } from '@/src/db/schema/sectionAssignments'
import { and, eq } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import type { Role } from '@/src/lib/constants'

/**
 * Roles that bypass section-level scoping.
 * Admin, auditor, and policy_lead can access all sections without assignment.
 */
export const BYPASS_SECTION_SCOPE: Role[] = ['admin', 'auditor', 'policy_lead']

/**
 * Middleware that enforces section-level scoping (AUTH-05).
 * Checks that the current user has a section_assignments row for the sectionId
 * found in the rawInput. Roles in BYPASS_SECTION_SCOPE skip the check.
 *
 * Usage: requirePermission('feedback:submit').use(requireSectionAccess('sectionId'))
 */
export const requireSectionAccess = (inputKey = 'sectionId') =>
  t.middleware(async ({ ctx, getRawInput, next }) => {
    const user = ctx.user as { id: string; role: string } | null
    if (!user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' })
    }

    // Bypass roles skip section scoping
    if (BYPASS_SECTION_SCOPE.includes(user.role as Role)) {
      return next({ ctx })
    }

    // Extract sectionId from rawInput
    const rawInput = await getRawInput()
    const input = rawInput as Record<string, unknown> | undefined
    const sectionId = input?.[inputKey]

    if (!sectionId || typeof sectionId !== 'string') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Missing or invalid ${inputKey} in input`,
      })
    }

    // Check section assignment
    const [assignment] = await db
      .select({ id: sectionAssignments.id })
      .from(sectionAssignments)
      .where(
        and(
          eq(sectionAssignments.userId, user.id),
          eq(sectionAssignments.sectionId, sectionId),
        ),
      )
      .limit(1)

    if (!assignment) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not assigned to this section',
      })
    }

    return next({ ctx })
  })
