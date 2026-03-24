import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import { WorkspaceNav } from './_components/workspace-nav'

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) {
    redirect('/sign-in')
  }
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold">PolicyDash</h1>
          <WorkspaceNav />
        </div>
        <UserButton />
      </header>
      <main className="p-6">
        {children}
      </main>
    </div>
  )
}
