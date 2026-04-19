import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { eq } from 'drizzle-orm'
import { UsersClient } from './_components/users-client'

export default async function UsersPage() {
  const { userId } = await auth()
  // C9: unauthenticated users belong on /sign-in, not a broken /dashboard loop.
  if (!userId) {
    redirect('/sign-in')
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  })

  if (!user || user.role !== 'admin') {
    redirect('/dashboard')
  }

  return <UsersClient />
}
