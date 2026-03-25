import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { eq } from 'drizzle-orm'
import { WorkspaceNav } from './_components/workspace-nav'
import { NotificationBell } from './_components/notification-bell'

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in')
  }

  // Fetch user role for conditional nav items (e.g., Audit link for admin/auditor)
  const user = await db.query.users.findFirst({ where: eq(users.clerkId, userId) })
  const userRole = user?.role

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold">PolicyDash</h1>
          <WorkspaceNav userRole={userRole} />
        </div>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <UserButton />
        </div>
      </header>
      <main className="p-6">
        {children}
      </main>
    </div>
  )
}
