import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { api } from '@/src/trpc/server'
import { SubmitFeedbackForm } from './_components/submit-feedback-form'

export default async function SubmitFeedbackPage({
  params,
}: {
  params: Promise<{ id: string; sectionId: string }>
}) {
  const { id: documentId, sectionId } = await params

  const caller = await api()

  // Fetch section info and user info in parallel
  const [sections, user] = await Promise.all([
    caller.document.getSections({ documentId }),
    caller.user.getMe(),
  ])

  // feedback:submit - stakeholder, research_lead, workshop_moderator only
  const canSubmitFeedback =
    user.role === 'stakeholder' ||
    user.role === 'research_lead' ||
    user.role === 'workshop_moderator'

  if (!canSubmitFeedback) {
    redirect(`/policies/${documentId}`)
  }

  const section = sections.find((s) => s.id === sectionId)
  if (!section) {
    notFound()
  }

  // E1: section-assignment preflight. Mirrors the server-side requireSectionAccess
  // middleware used by feedback.submit so the form itself tells the user upfront
  // rather than eating a 403 on submit.
  const preflight = await caller.feedback.canSubmit({ sectionId })

  const userName = user.name ?? 'Unknown User'
  const orgType = user.orgType
    ? user.orgType.charAt(0).toUpperCase() + user.orgType.slice(1).replace('_', ' ')
    : 'Unknown'

  return (
    <div className="mx-auto max-w-[640px]">
      <Link
        href={`/policies/${documentId}`}
        className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'mb-4' })}
      >
        <ArrowLeft className="mr-1 size-4" />
        Back to section
      </Link>

      <h1 className="mb-6 text-[20px] font-semibold leading-[1.2]">
        Submit Feedback
      </h1>

      {!preflight.canSubmit && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          You&apos;re not assigned to this section. Only section assignees can submit feedback here.
        </div>
      )}

      <Suspense fallback={null}>
        <SubmitFeedbackForm
          sectionId={sectionId}
          documentId={documentId}
          sectionTitle={section.title}
          userName={userName}
          orgType={orgType}
          disabled={!preflight.canSubmit}
        />
      </Suspense>
    </div>
  )
}
