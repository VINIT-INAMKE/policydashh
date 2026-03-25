import { Suspense } from 'react'
import { OutcomesList } from './_components/outcomes-list'

export default function FeedbackOutcomesPage() {
  return (
    <div className="mx-auto max-w-[768px]">
      <h1 className="mb-6 text-[20px] font-semibold leading-[1.2]">
        Your Feedback
      </h1>

      <Suspense fallback={null}>
        <OutcomesList />
      </Suspense>
    </div>
  )
}
