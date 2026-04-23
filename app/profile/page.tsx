import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { ProfileClient } from './_components/profile-client'

/**
 * /profile — self-service profile page for any authenticated user.
 *
 * Option C (migration 0028): stakeholders who completed /participate now
 * have persisted designation / org_name / expertise / how_heard columns.
 * This page lets them view and edit those fields themselves — previously
 * that data was only mutable by an admin and (in practice) never shown.
 *
 * The server shell only auth-guards; all rendering + mutation happens in
 * the client component via trpc.user.getMe + trpc.user.updateProfile.
 */
export default async function ProfilePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold">My Profile</h1>
      <ProfileClient />
    </div>
  )
}
