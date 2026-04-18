import { redirect } from 'next/navigation'

/**
 * Deep-link target for version-published notifications. Redirects to the
 * versions list with the requested version pre-selected.
 */
export default async function VersionRedirectPage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>
}) {
  const { id, versionId } = await params
  redirect(`/policies/${id}/versions?v=${versionId}`)
}
