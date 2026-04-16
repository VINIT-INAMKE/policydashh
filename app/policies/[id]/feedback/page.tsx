import { Suspense } from 'react'
import { FeedbackInbox } from './_components/feedback-inbox'

export default async function FeedbackInboxPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: documentId } = await params

  return (
    <Suspense fallback={null}>
      <FeedbackInbox documentId={documentId} />
    </Suspense>
  )
}
