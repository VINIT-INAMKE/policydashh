import { auth } from '@clerk/nextjs/server'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { eq } from 'drizzle-orm'

/**
 * GET /api/auth/check
 * Returns { ready: true, role } if user exists in DB, { ready: false } if webhook hasn't synced yet.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ ready: false, reason: 'not_signed_in' })
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  })

  if (!user) {
    return Response.json({ ready: false, reason: 'webhook_pending' })
  }

  return Response.json({ ready: true, role: user.role })
}
