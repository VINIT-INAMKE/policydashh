import { CRList } from './_components/cr-list'

export default async function ChangeRequestsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <CRList documentId={id} />
}
