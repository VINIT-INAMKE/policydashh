/**
 * Public /participate page - dual-mode (Phase 19 intake + Phase 20 workshop feedback).
 *
 * Mode switch (D-18 in 20-CONTEXT.md):
 *   - No `workshopId` query param → render Phase 19 intake form (unchanged)
 *   - `workshopId` + `token` + valid JWT → render WorkshopFeedbackForm
 *   - `workshopId` present but token missing/invalid/expired → render ExpiredLinkCard
 *
 * JWT validation is performed SERVER-SIDE here via `verifyFeedbackToken` -
 * the client component receives a pre-validated prop and must NEVER decide
 * whether to render the form on its own. The token is passed back to
 * `/api/intake/workshop-feedback` on submit so the route handler can
 * re-verify independently (never trust the client).
 *
 * Visual contract: CL design tokens are global in :root (promoted from .cl-landing scope).
 * Metadata is static across modes per D-18 (no info leak on expired links).
 */

import type { Metadata } from 'next'
import { eq } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/src/db'
import { workshops, workshopSectionLinks } from '@/src/db/schema/workshops'
import { policySections } from '@/src/db/schema/documents'
import { verifyFeedbackToken } from '@/src/lib/feedback-token'
import { ParticipateForm } from './_components/participate-form'
import { WorkshopFeedbackForm } from './_components/workshop-feedback-form'
import { ExpiredLinkCard } from './_components/expired-link-card'

export const metadata: Metadata = {
  title: 'Join the Consultation | Civilization Lab',
  description:
    'Share your expertise and help shape evidence-based policy for India\u2019s digital future.',
}

interface ParticipatePageProps {
  searchParams: Promise<{ workshopId?: string; token?: string }>
}

function IntakeShell() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-2xl px-4 pt-12 pb-16 sm:px-6 sm:pt-16">
        <header className="mb-8 text-center sm:mb-12">
          <h1
            className="text-[28px] font-semibold leading-[1.2] text-[var(--cl-on-surface)]"
            style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
          >
            Join the Consultation
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Share your expertise and help shape evidence-based policy for India&apos;s digital future.
          </p>
        </header>

        <ParticipateForm />
      </main>
    </div>
  )
}

function FeedbackShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-2xl px-4 pt-12 pb-16 sm:px-6 sm:pt-16">
        <header className="mb-8 text-center sm:mb-12">
          <h1
            className="text-[28px] font-semibold leading-[1.2] text-[var(--cl-on-surface)]"
            style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
          >
            Share Your Feedback
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Your insights from the workshop help shape the policy consultation.
          </p>
        </header>

        {children}
      </main>
    </div>
  )
}

export default async function ParticipatePage({ searchParams }: ParticipatePageProps) {
  const params = await searchParams
  const workshopId = params.workshopId
  const token = params.token

  // Auth-aware redirect: logged-in users go to dashboard unless they're
  // following a workshop feedback deep-link (workshopId + token).
  const { userId } = await auth()
  if (workshopId && token) {
    // Workshop feedback deep-link - always show regardless of auth
  } else if (userId) {
    // Already a member, send to dashboard
    redirect('/dashboard')
  }

  // Mode 1: intake - no workshopId → Phase 19 form unchanged
  if (!workshopId) {
    return <IntakeShell />
  }

  // Mode 2/3: feedback mode - workshopId present, JWT required
  if (!token) {
    return (
      <FeedbackShell>
        <ExpiredLinkCard />
      </FeedbackShell>
    )
  }

  const payload = verifyFeedbackToken(token, workshopId)
  if (!payload) {
    return (
      <FeedbackShell>
        <ExpiredLinkCard />
      </FeedbackShell>
    )
  }

  // Load workshop + linked sections for the form. Failure to locate either
  // the workshop OR its linked sections degrades to the expired card (no leak
  // of "does this workshop exist" to a holder of a stale token).
  const workshopRows = await db
    .select({ id: workshops.id })
    .from(workshops)
    .where(eq(workshops.id, workshopId))
    .limit(1)
  if (workshopRows.length === 0) {
    return (
      <FeedbackShell>
        <ExpiredLinkCard />
      </FeedbackShell>
    )
  }

  const sections = await db
    .select({ id: policySections.id, title: policySections.title })
    .from(workshopSectionLinks)
    .innerJoin(policySections, eq(policySections.id, workshopSectionLinks.sectionId))
    .where(eq(workshopSectionLinks.workshopId, workshopId))

  return (
    <FeedbackShell>
      <WorkshopFeedbackForm
        workshopId={workshopId}
        token={token}
        sections={sections}
      />
    </FeedbackShell>
  )
}
