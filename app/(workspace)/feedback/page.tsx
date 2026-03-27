import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/src/db'
import { users } from '@/src/db/schema'
import { eq } from 'drizzle-orm'

/**
 * /feedback — routes based on role:
 * - admin, policy_lead, auditor: see all feedback (redirect to first policy's feedback inbox)
 * - stakeholder, research_lead, workshop_moderator, observer: see own feedback outcomes
 */
export default async function FeedbackPage() {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect('/sign-in')

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  })
  if (!user) redirect('/setup')

  const canReadAll = user.role === 'admin' || user.role === 'policy_lead' || user.role === 'auditor'

  if (canReadAll) {
    // Find first policy to show its feedback inbox
    const firstDoc = await db.query.policyDocuments.findFirst({
      orderBy: (docs, { desc }) => [desc(docs.createdAt)],
    })
    if (firstDoc) {
      redirect(`/policies/${firstDoc.id}/feedback`)
    }
  }

  // Everyone else sees their own outcomes
  redirect('/feedback/outcomes')
}
