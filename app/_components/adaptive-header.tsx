import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { AdaptiveHeaderClient } from './adaptive-header-client'

export async function AdaptiveHeader() {
  const { userId } = await auth()

  let userRole: string | null = null
  if (userId) {
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
      columns: { role: true },
    })
    userRole = user?.role ?? null
  }

  return <AdaptiveHeaderClient userId={userId} userRole={userRole} />
}
