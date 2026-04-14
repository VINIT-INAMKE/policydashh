/**
 * Phase 19 public /participate page.
 * Unauthenticated intake form — public by proxy.ts `isPublicRoute` (Plan 19-05).
 * Visual contract: .cl-landing scope matches app/page.tsx exactly.
 * Zero Clerk imports.
 */

import type { Metadata } from 'next'
import { ParticipateForm } from './_components/participate-form'

export const metadata: Metadata = {
  title: 'Join the Consultation | PolicyDash',
  description:
    'Share your expertise and help shape evidence-based policy for India\u2019s digital future.',
}

export default function ParticipatePage() {
  return (
    <div className="cl-landing min-h-screen bg-[var(--cl-surface)]">
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
