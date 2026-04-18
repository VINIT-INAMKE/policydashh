import { redirect, notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/src/db'
import { changeRequests } from '@/src/db/schema/changeRequests'

/**
 * Deep-link target for change-request notifications. Looks up the CR's
 * documentId and redirects to the in-scope route under /policies/:id.
 */
export default async function ChangeRequestDeepLinkPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [row] = await db
    .select({ documentId: changeRequests.documentId })
    .from(changeRequests)
    .where(eq(changeRequests.id, id))
    .limit(1)

  if (!row) notFound()
  redirect(`/policies/${row.documentId}/change-requests/${id}`)
}
