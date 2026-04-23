import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { DirectoryClient } from './_components/directory-client'

/**
 * /stakeholders — authenticated directory of everyone with role='stakeholder'.
 *
 * Option C (migration 0028): previously the intake form collected a detailed
 * profile (designation, org, expertise) and dropped it on the floor. With
 * migration 0028 those fields now persist on the users row, and this page
 * surfaces them as a searchable directory. Scope is auth-only for now —
 * any signed-in user can see who else is participating. Admins still have
 * the deeper /users/[id] view for audit/engagement data.
 */
export default async function StakeholderDirectoryPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-xl font-semibold">Stakeholders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The community participating in this consultation. Filter by
          organization type or search by name, title, or expertise.
        </p>
      </header>
      <DirectoryClient />
    </div>
  )
}
