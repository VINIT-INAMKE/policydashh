import { redirect, notFound } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { db } from '@/src/db'
import { feedbackItems } from '@/src/db/schema/feedback'
import { users } from '@/src/db/schema/users'
import { can } from '@/src/lib/permissions'

/**
 * Deep-link target for feedback notifications. Dispatches to the right
 * downstream view depending on the viewer's relationship to the item:
 *   - Reviewers (feedback:read_all) → policy inbox with the item pre-selected.
 *   - Submitters                    → outcomes tab with the item pre-selected.
 */
export default async function FeedbackDeepLinkPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect('/sign-in')

  const [viewer] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1)

  if (!viewer) redirect('/setup')

  const [row] = await db
    .select({
      id:          feedbackItems.id,
      documentId:  feedbackItems.documentId,
      submitterId: feedbackItems.submitterId,
    })
    .from(feedbackItems)
    .where(eq(feedbackItems.id, id))
    .limit(1)

  if (!row) notFound()

  const isOwner = row.submitterId === viewer.id
  const canReadAll = can(viewer.role, 'feedback:read_all')

  if (canReadAll) {
    redirect(`/policies/${row.documentId}/feedback?selected=${row.id}`)
  }
  if (isOwner) {
    redirect(`/feedback?tab=outcomes&selected=${row.id}`)
  }
  notFound()
}
