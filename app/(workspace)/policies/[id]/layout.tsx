import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { PolicyTabBar } from './_components/policy-tab-bar'

export default async function PolicyLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const user = await db.query.users.findFirst({ where: eq(users.clerkId, userId) })
  const role = user?.role

  const canViewCR = role === 'admin' || role === 'policy_lead' || role === 'auditor'
  const canViewTrace =
    role === 'admin' ||
    role === 'policy_lead' ||
    role === 'auditor' ||
    role === 'stakeholder'
  const canViewMilestones =
    role === 'admin' || role === 'policy_lead' || role === 'auditor'

  return (
    <div className="flex h-full flex-col">
      <PolicyTabBar
        documentId={id}
        canViewCR={canViewCR}
        canViewTrace={canViewTrace}
        canViewMilestones={canViewMilestones}
      />
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
