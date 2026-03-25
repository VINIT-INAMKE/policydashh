import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/src/db'
import { users } from '@/src/db/schema'
import { eq } from 'drizzle-orm'
import { Badge } from '@/components/ui/badge'
import { PolicyLeadDashboard } from './_components/policy-lead-dashboard'
import { StakeholderDashboard } from './_components/stakeholder-dashboard'
import { AdminDashboard } from './_components/admin-dashboard'
import { ResearchLeadDashboard } from './_components/research-lead-dashboard'
import { AuditorDashboard } from './_components/auditor-dashboard'
import { WorkshopModeratorDashboard } from './_components/workshop-moderator-dashboard'
import { ObserverDashboard } from './_components/observer-dashboard'

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  admin: 'Admin',
  policy_lead: 'Policy Lead',
  research_lead: 'Research Lead',
  workshop_moderator: 'Workshop Moderator',
  stakeholder: 'Stakeholder',
  observer: 'Observer',
  auditor: 'Auditor',
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default async function DashboardPage() {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect('/sign-in')

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  })

  if (!user) redirect('/sign-in')

  const roleName = ROLE_DISPLAY_NAMES[user.role] ?? 'Observer'
  const greeting = getGreeting()
  const firstName = user.name?.split(' ')[0] || 'there'

  function renderDashboard() {
    switch (user!.role) {
      case 'policy_lead':
        return <PolicyLeadDashboard userId={user!.id} lastVisitedAt={user!.lastVisitedAt} />
      case 'stakeholder':
        return <StakeholderDashboard userId={user!.id} lastVisitedAt={user!.lastVisitedAt} />
      case 'admin':
        return <AdminDashboard userId={user!.id} />
      case 'research_lead':
        return <ResearchLeadDashboard userId={user!.id} />
      case 'auditor':
        return <AuditorDashboard userId={user!.id} />
      case 'workshop_moderator':
        return <WorkshopModeratorDashboard userId={user!.id} />
      default:
        return <ObserverDashboard userId={user!.id} />
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Badge variant="secondary">{roleName}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {greeting}, {firstName}.
      </p>
      {renderDashboard()}
    </div>
  )
}
