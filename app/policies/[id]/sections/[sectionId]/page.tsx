import { redirect } from 'next/navigation'

/**
 * Deep-link target for section-assignment notifications. Redirects to the
 * policy detail page with the section pre-selected via the `section` query
 * param (honored by the client-side section sidebar).
 */
export default async function PolicySectionRedirectPage({
  params,
}: {
  params: Promise<{ id: string; sectionId: string }>
}) {
  const { id, sectionId } = await params
  redirect(`/policies/${id}?section=${sectionId}`)
}
