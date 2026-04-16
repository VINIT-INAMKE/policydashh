import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { eq } from 'drizzle-orm'
import { db } from '@/src/db'
import { users } from '@/src/db/schema'
import { GlobalFeedbackTabs } from './_components/global-feedback-tabs'

/**
 * /feedback - cross-policy feedback overview page (Phase 13 D-09, D-10).
 *
 * Renders 3 role-gated tabs:
 * - All Feedback (admin, policy_lead, auditor) - cross-policy list via listCrossPolicy
 * - My Outcomes (all roles with any feedback perm) - caller's own submissions + decisions
 * - Evidence Gaps (admin, research_lead) - claims without attached evidence
 *
 * Active tab is synced to ?tab= URL param.
 */
export default async function FeedbackPage() {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect('/sign-in')

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  })
  if (!user) redirect('/setup')

  const role = user.role
  const canSeeAll = role === 'admin' || role === 'policy_lead' || role === 'auditor'
  const canSeeEvidenceGaps = role === 'admin' || role === 'research_lead'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold leading-[1.2]">Feedback</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cross-policy feedback overview, your outcomes, and evidence gaps.
        </p>
      </div>
      <Suspense fallback={null}>
        <GlobalFeedbackTabs
          canSeeAll={canSeeAll}
          canSeeEvidenceGaps={canSeeEvidenceGaps}
        />
      </Suspense>
    </div>
  )
}
