import { auth } from '@clerk/nextjs/server'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { eq } from 'drizzle-orm'

/**
 * GET /api/auth/check
 * Returns { ready: true, role } if user exists in DB.
 * Returns { ready: false, reason, stalenessSeconds } while waiting on the
 * Clerk webhook. `stalenessSeconds` is the elapsed time since the Clerk
 * session was established, so the UI can escalate messaging over time (C6).
 */
export async function GET() {
  const { userId, sessionClaims } = await auth()
  if (!userId) {
    return Response.json({ ready: false, reason: 'not_signed_in', stalenessSeconds: 0 })
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  })

  // `iat` (issued-at) on the session claim marks when the current Clerk session
  // was established; use that as the reference for how long the user has been
  // waiting for the webhook to sync.
  const iat = typeof sessionClaims?.iat === 'number' ? sessionClaims.iat : null
  const nowSec = Math.floor(Date.now() / 1000)
  const stalenessSeconds = iat ? Math.max(0, nowSec - iat) : 0

  if (!user) {
    return Response.json({
      ready: false,
      reason: 'webhook_pending',
      stalenessSeconds,
    })
  }

  return Response.json({
    ready: true,
    role: user.role,
    stalenessSeconds,
  })
}
