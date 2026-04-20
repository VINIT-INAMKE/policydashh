export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ResearchTocAside } from './_components/research-toc-aside'

export default function ResearchPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      {/* Hero */}
      <header className="mb-12">
        <h1 className="text-[28px] font-semibold leading-[1.2] mb-4">
          Understanding the Landscape
        </h1>
        <p className="text-sm text-muted-foreground">
          This section presents the foundational research behind the Blockchain Policy Framework for India.
        </p>
      </header>

      <div className="flex gap-8">
        {/* Desktop TOC aside */}
        <aside className="hidden lg:block w-[240px] shrink-0">
          <ResearchTocAside />
        </aside>

        {/* Main content column */}
        <main className="flex-1 min-w-0">
          <section id="overview">
            <h2 className="text-[20px] font-semibold leading-[1.2] mb-4">Overview</h2>
            <p className="text-[16px] font-normal leading-[1.8] mb-4">
              India stands at a pivotal moment in shaping its policy stance on blockchain technology.
              This research synthesises the regulatory environment, global benchmarks, technological
              capabilities, and the economic implications of adoption across the public and private sectors.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[16px] leading-[1.8]">
              <li>Current regulatory environment and legal ambiguity</li>
              <li>Global benchmarks from jurisdictions with live frameworks</li>
              <li>Technology capabilities and infrastructure readiness</li>
              <li>Economic implications across public and private sectors</li>
              <li>Risks and constraints that must be addressed in any framework</li>
            </ul>
          </section>
          <hr className="border-border my-12" />

          <section id="key-themes">
            <h2 className="text-[20px] font-semibold leading-[1.2] mb-4">Key Themes</h2>
            <p className="text-[16px] font-normal leading-[1.8] mb-4">
              Five themes emerged across stakeholder consultations and desk research as the highest-priority
              areas for the policy framework.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[16px] leading-[1.8]">
              <li>Legal classification of digital assets and token-based instruments</li>
              <li>Taxation treatment for transactions, holdings, and institutional participation</li>
              <li>Data governance, privacy, and cross-border flows</li>
              <li>Financial and non-financial use cases across sectors</li>
              <li>Institutional adoption barriers and capacity gaps</li>
            </ul>
          </section>
          <hr className="border-border my-12" />

          <section id="outputs">
            <h2 className="text-[20px] font-semibold leading-[1.2] mb-4">Research Outputs</h2>
            <p className="text-[16px] font-normal leading-[1.8] mb-4">
              The full research report will synthesise the landscape summary, key policy gaps, and
              recommendations that inform the draft framework under consultation.
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[16px] leading-[1.8] mb-6">
              <li><strong>Landscape Summary</strong> - the state of blockchain policy across comparable jurisdictions</li>
              <li><strong>Key Policy Gaps</strong> - unresolved questions the framework must address</li>
            </ul>
            <div className="rounded-md border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <strong className="font-medium text-foreground">Coming soon.</strong>{' '}
              The full research report is being finalised and will be published here once it
              clears review.
            </div>
          </section>
          <hr className="border-border my-12" />

          <section id="join-consultation">
            <h2 className="text-[20px] font-semibold leading-[1.2] mb-4">Shape This Policy</h2>
            <p className="text-[16px] font-normal leading-[1.8] mb-6">
              Join the consultation process and help shape India&apos;s blockchain policy framework.
            </p>
            <Link href="/participate">
              <Button variant="default">Join Consultation</Button>
            </Link>
          </section>
          <hr className="border-border my-12" />
          <section id="browse-research">
            <h2 className="text-[20px] font-semibold leading-[1.2] mb-4">Published Research</h2>
            <p className="text-[16px] font-normal leading-[1.8] mb-6">
              Browse the citable research items that inform the policy framework under consultation.
            </p>
            <Link href="/research/items">
              <Button variant="outline">Browse published research</Button>
            </Link>
          </section>
        </main>
      </div>
    </div>
  )
}
