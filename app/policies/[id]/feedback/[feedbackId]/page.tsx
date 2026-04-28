import { FeedbackDetailView } from './_components/feedback-detail-view'

export default async function FeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string; feedbackId: string }>
}) {
  const { id, feedbackId } = await params
  return <FeedbackDetailView documentId={id} feedbackId={feedbackId} />
}
