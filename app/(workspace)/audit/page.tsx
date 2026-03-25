import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { eq } from 'drizzle-orm'
import { AuditTrailClient } from './_components/audit-trail-client'
import { EvidencePackDialog } from './_components/evidence-pack-dialog'

export default async function AuditPage() {
  const { userId } = await auth()
  if (!userId) {
    redirect('/dashboard')
  }

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  })

  if (!user || (user.role !== 'admin' && user.role !== 'auditor')) {
    redirect('/dashboard')
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Audit Trail</h1>
          <p className="text-sm text-muted-foreground">
            Complete immutable record of all system actions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <EvidencePackDialog />
        </div>
      </div>
      <AuditTrailClient />
    </div>
  )
}
