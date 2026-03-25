import { CRDetail } from '../_components/cr-detail'

export default async function CRDetailPage({
  params,
}: {
  params: Promise<{ id: string; crId: string }>
}) {
  const { id: documentId, crId } = await params

  return <CRDetail crId={crId} documentId={documentId} />
}
