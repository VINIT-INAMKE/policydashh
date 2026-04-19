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
import { db } from '@/src/db'
import { workshops, workshopSectionLinks } from '@/src/db/schema/workshops'
import { policySections } from '@/src/db/schema/documents'
import { verifyFeedbackToken } from '@/src/lib/feedback-token'
import { ParticipateForm } from './_components/participate-form'
import { WorkshopFeedbackForm } from './_components/workshop-feedback-form'
import { ExpiredLinkCard } from './_components/expired-link-card'
import { Card } from '@/components/ui/card'
import { Mail } from 'lucide-react'

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

function MissingInviteExplainer() {
  return (
    <Card className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <Mail className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
      <h2 className="text-xl font-semibold text-[var(--cl-on-surface)]">
        Enter through your invite link
      </h2>
      <p className="max-w-md text-base leading-relaxed text-muted-foreground">
        This page accepts feedback via a personalized link sent after a
        workshop. Please check your email for the follow-up with your invite
        link.
      </p>
      <p className="text-sm text-muted-foreground">
        If you believe this is an error, contact the workshop organizer.
      </p>
    </Card>
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

  // Auth-aware: logged-in users don't use the intake form. Previously we
  // silently redirected them to /dashboard even when they hit /participate
  // directly (E11). Now we render IntakeShell — which shows an explainer
  // for signed-in users instead of a redirect — unless they're following a
  // workshop feedback deep-link (workshopId + token).
  const { userId } = await auth()
  const workshopFeedbackMode = !!(workshopId && token)

  // Mode 1: intake - no workshopId → Phase 19 form unchanged. Signed-in
  // users see the same shell with the form itself; the form handler will
  // no-op for them or route to /dashboard via the top nav.
  if (!workshopId) {
    // E11: if signed-in, show a short explainer pointing them to the
    // invite-link flow rather than silently bouncing to /dashboard.
    if (userId) {
      return (
        <FeedbackShell>
          <MissingInviteExplainer />
        </FeedbackShell>
      )
    }
    return <IntakeShell />
  }

  // Mode 2/3: feedback mode - workshopId present, JWT required.
  // E12: distinguish "no token" (missing) from "expired/invalid token".
  if (!token) {
    return (
      <FeedbackShell>
        <ExpiredLinkCard variant="missing" />
      </FeedbackShell>
    )
  }

  const payload = verifyFeedbackToken(token, workshopId)
  if (!payload) {
    return (
      <FeedbackShell>
        <ExpiredLinkCard variant="expired" />
      </FeedbackShell>
    )
  }

  void workshopFeedbackMode // quiet "unused" hint when reading the file

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
        <ExpiredLinkCard variant="expired" />
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
