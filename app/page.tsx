/* eslint-disable @next/next/no-img-element */
import Link from 'next/link'
import { CryptoSeal } from './_components/crypto-seal'

export default function Home() {
  return (
    <div
      className="bg-[var(--cl-surface)] text-[var(--cl-on-surface)] font-body selection:bg-[var(--cl-tertiary-fixed)] selection:text-[var(--cl-on-tertiary-fixed)] min-w-0 overflow-x-hidden"
    >
      {/* Hero Section */}
      <header className="relative overflow-hidden pt-12 sm:pt-16 lg:pt-20 pb-20 sm:pb-24 lg:pb-32">
        {/* Topographic backdrop */}
        <svg
          className="cl-topo absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1400 900"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          <g fill="none" stroke="var(--cl-primary)" strokeWidth="0.6">
            <path
              d="M-100,120 Q200,40 480,140 T1100,160 L1500,210"
              opacity="0.07"
            />
            <path
              d="M-100,200 Q260,120 540,220 T1140,240 L1500,290"
              opacity="0.06"
            />
            <path
              d="M-100,290 Q220,210 520,310 T1120,330 L1500,380"
              opacity="0.05"
            />
            <path
              d="M-100,380 Q280,300 580,400 T1160,420 L1500,470"
              opacity="0.05"
            />
            <path
              d="M-100,470 Q240,390 540,490 T1140,510 L1500,560"
              opacity="0.05"
            />
            <path
              d="M-100,560 Q260,480 560,580 T1160,600 L1500,650"
              opacity="0.05"
            />
            <path
              d="M-100,650 Q220,570 520,670 T1120,690 L1500,740"
              opacity="0.05"
            />
            <path
              d="M-100,740 Q280,660 580,760 T1160,780 L1500,830"
              opacity="0.04"
            />
          </g>
        </svg>
        <div className="max-w-screen-2xl mx-auto px-5 sm:px-8 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center relative">
          <div className="lg:col-span-7 space-y-6 sm:space-y-8 min-w-0">
            <div className="inline-flex items-center space-x-3 px-3 py-1 bg-[var(--cl-secondary-container)] text-[var(--cl-on-secondary-fixed-variant)] rounded-sm">
              <span className="w-2 h-2 rounded-full bg-[var(--cl-tertiary-fixed-dim)] animate-pulse"></span>
              <span className="text-[0.7rem] font-bold uppercase tracking-[0.2em]">
                Institutional Update 2024
              </span>
            </div>
            <h1 className="text-[2.25rem] sm:text-5xl md:text-6xl lg:text-7xl font-headline text-[var(--cl-primary)] leading-[1.05] sm:leading-[1.1] tracking-tight break-words">
              Designing and Coordinating <span className="italic">Blockchain Policy</span> for India
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-[var(--cl-on-surface-variant)] max-w-2xl leading-relaxed">
              A verifiable, stakeholder-driven policy system engineered to
              bridge the gap between academic rigor and cryptographic
              transparency for the digital economy.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-4">
              <Link
                href="/portal"
                className="bg-[var(--cl-primary)] text-[var(--cl-on-primary)] px-6 py-3 sm:px-8 sm:py-4 rounded-sm font-medium flex items-center justify-center space-x-2 transition-all hover:bg-[var(--cl-primary-container)] text-sm sm:text-base"
              >
                <span>Explore Policy Framework</span>
                <span className="material-symbols-outlined text-sm">
                  arrow_forward
                </span>
              </Link>
              <Link
                href="/sign-up"
                className="border border-[var(--cl-outline-variant-20)] px-6 py-3 sm:px-8 sm:py-4 rounded-sm font-medium hover:bg-[var(--cl-surface-container-low)] transition-colors text-center text-sm sm:text-base"
              >
                Participate
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5 relative min-w-0">
            <div className="aspect-square bg-[var(--cl-surface-container-lowest)] relative overflow-hidden rounded-sm shadow-2xl">
              <CryptoSeal />
            </div>
            {/* Decorative text */}
            <div className="absolute -bottom-4 -right-4 sm:-bottom-6 sm:-right-6 lg:-bottom-8 lg:-right-8 opacity-10 pointer-events-none">
              <span className="cl-civil-parallax block text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-headline font-bold text-[var(--cl-primary)]">
                CIVIL
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Policy Operating System (Asymmetric Layout) */}
      <section className="py-16 sm:py-20 lg:py-24 bg-[var(--cl-surface-container)]">
        <div className="max-w-screen-2xl mx-auto px-5 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16">
            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-32">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--cl-on-primary-container)] mb-4 block">
                  The Infrastructure
                </span>
                <h2 className="text-3xl sm:text-4xl font-headline text-[var(--cl-primary)] mb-6">
                  A Policy Operating System
                </h2>
                <p className="text-[var(--cl-on-surface-variant)] leading-relaxed">
                  We treat policy not as a static document, but as a dynamic
                  codebase that requires version control, peer review, and
                  stakeholder validation.
                </p>
              </div>
            </div>
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {/* OS Module 1 */}
              <div className="cl-rise bg-[var(--cl-surface-container-lowest)] p-6 sm:p-8 lg:p-10 rounded-sm space-y-6">
                <div className="w-12 h-12 bg-[var(--cl-surface-container)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[var(--cl-primary)]">
                    menu_book
                  </span>
                </div>
                <h3 className="text-xl font-headline font-semibold text-[var(--cl-primary)]">
                  Academic Research
                </h3>
                <p className="text-sm text-[var(--cl-on-surface-variant)] leading-relaxed">
                  Deep-dive analysis into cryptographic primitives and their
                  interaction with Indian constitutional law.
                </p>
                <ul className="space-y-3 pt-4 border-t border-[var(--cl-outline-variant-10)]">
                  <li className="flex items-center text-xs font-medium text-[var(--cl-primary)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--cl-tertiary)] mr-3"></span>
                    Peer-reviewed Journals
                  </li>
                  <li className="flex items-center text-xs font-medium text-[var(--cl-primary)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--cl-tertiary)] mr-3"></span>
                    Economic Impact Models
                  </li>
                </ul>
              </div>
              {/* OS Module 2 */}
              <div className="cl-rise bg-[var(--cl-surface-container-lowest)] p-6 sm:p-8 lg:p-10 rounded-sm space-y-6">
                <div className="w-12 h-12 bg-[var(--cl-surface-container)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[var(--cl-primary)]">
                    groups
                  </span>
                </div>
                <h3 className="text-xl font-headline font-semibold text-[var(--cl-primary)]">
                  Stakeholder Alignment
                </h3>
                <p className="text-sm text-[var(--cl-on-surface-variant)] leading-relaxed">
                  A consensus engine for industry leaders, regulators, and
                  technologists to reach unified policy standards.
                </p>
                <ul className="space-y-3 pt-4 border-t border-[var(--cl-outline-variant-10)]">
                  <li className="flex items-center text-xs font-medium text-[var(--cl-primary)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--cl-tertiary)] mr-3"></span>
                    Multi-sig Governance
                  </li>
                  <li className="flex items-center text-xs font-medium text-[var(--cl-primary)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--cl-tertiary)] mr-3"></span>
                    Open Working Groups
                  </li>
                </ul>
              </div>
              {/* OS Module 3 */}
              <div className="cl-rise bg-[var(--cl-surface-container-lowest)] p-6 sm:p-8 lg:p-10 rounded-sm space-y-6">
                <div className="w-12 h-12 bg-[var(--cl-surface-container)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[var(--cl-primary)]">
                    school
                  </span>
                </div>
                <h3 className="text-xl font-headline font-semibold text-[var(--cl-primary)]">
                  Strategic Workshops
                </h3>
                <p className="text-sm text-[var(--cl-on-surface-variant)] leading-relaxed">
                  Co-creation sessions designed to stress-test policy
                  frameworks against real-world technical constraints.
                </p>
                <ul className="space-y-3 pt-4 border-t border-[var(--cl-outline-variant-10)]">
                  <li className="flex items-center text-xs font-medium text-[var(--cl-primary)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--cl-tertiary)] mr-3"></span>
                    Technical Sandboxes
                  </li>
                  <li className="flex items-center text-xs font-medium text-[var(--cl-primary)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--cl-tertiary)] mr-3"></span>
                    Legislative Drafting
                  </li>
                </ul>
              </div>
              {/* OS Module 4 */}
              <div className="cl-rise bg-[var(--cl-surface-container-lowest)] p-6 sm:p-8 lg:p-10 rounded-sm space-y-6">
                <div className="w-12 h-12 bg-[var(--cl-surface-container)] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[var(--cl-primary)]">
                    terminal
                  </span>
                </div>
                <h3 className="text-xl font-headline font-semibold text-[var(--cl-primary)]">
                  Deployable Code
                </h3>
                <p className="text-sm text-[var(--cl-on-surface-variant)] leading-relaxed">
                  Translating policy intent into smart contract specifications
                  and standardized reporting interfaces.
                </p>
                <ul className="space-y-3 pt-4 border-t border-[var(--cl-outline-variant-10)]">
                  <li className="flex items-center text-xs font-medium text-[var(--cl-primary)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--cl-tertiary)] mr-3"></span>
                    Audit Protocols
                  </li>
                  <li className="flex items-center text-xs font-medium text-[var(--cl-primary)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--cl-tertiary)] mr-3"></span>
                    Compliance SDKs
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works (Visual Flow) */}
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="max-w-screen-2xl mx-auto px-5 sm:px-8 lg:px-12">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--cl-on-primary-container)]">
              Methodology
            </span>
            <h2 className="text-3xl sm:text-4xl font-headline text-[var(--cl-primary)] mt-2">
              The Traceability Chain
            </h2>
          </div>
          <div className="relative">
            {/* Connecting Line */}
            <div className="cl-meth-line absolute top-12 left-0 w-full h-px border-t border-dashed border-[var(--cl-outline-variant-40)] hidden lg:block"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-10 sm:gap-12 relative">
              {/* Step 1 */}
              <div className="cl-rise text-center space-y-4">
                <div className="w-16 h-16 bg-[var(--cl-surface-container-lowest)] border border-[var(--cl-outline-variant-20)] rounded-[0.75rem] flex items-center justify-center mx-auto relative z-10">
                  <span className="font-headline text-xl text-[var(--cl-primary)]">
                    01
                  </span>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-[var(--cl-primary)] text-sm uppercase tracking-widest">
                    Research
                  </h4>
                  <p className="text-xs text-[var(--cl-on-surface-variant)] px-4">
                    Identification of legal &amp; technical friction points.
                  </p>
                </div>
              </div>
              {/* Step 2 */}
              <div className="cl-rise text-center space-y-4">
                <div className="w-16 h-16 bg-[var(--cl-surface-container-lowest)] border border-[var(--cl-outline-variant-20)] rounded-[0.75rem] flex items-center justify-center mx-auto relative z-10">
                  <span className="font-headline text-xl text-[var(--cl-primary)]">
                    02
                  </span>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-[var(--cl-primary)] text-sm uppercase tracking-widest">
                    Build
                  </h4>
                  <p className="text-xs text-[var(--cl-on-surface-variant)] px-4">
                    Drafting framework using modular policy primitives.
                  </p>
                </div>
              </div>
              {/* Step 3 */}
              <div className="cl-rise text-center space-y-4">
                <div
                  className="w-16 h-16 bg-[var(--cl-tertiary)] flex items-center justify-center mx-auto rounded-[0.75rem] relative z-10"
                  style={{
                    boxShadow: '0 8px 24px -4px rgba(0,14,3,0.2)',
                  }}
                >
                  <span className="font-headline text-xl text-[var(--cl-on-tertiary)]">
                    03
                  </span>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-[var(--cl-tertiary)] text-sm uppercase tracking-widest">
                    Validate
                  </h4>
                  <p className="text-xs text-[var(--cl-on-surface-variant)] px-4">
                    Cryptographic proof of stakeholder consensus.
                  </p>
                </div>
              </div>
              {/* Step 4 */}
              <div className="cl-rise text-center space-y-4">
                <div className="w-16 h-16 bg-[var(--cl-surface-container-lowest)] border border-[var(--cl-outline-variant-20)] rounded-[0.75rem] flex items-center justify-center mx-auto relative z-10">
                  <span className="font-headline text-xl text-[var(--cl-primary)]">
                    04
                  </span>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-[var(--cl-primary)] text-sm uppercase tracking-widest">
                    Align
                  </h4>
                  <p className="text-xs text-[var(--cl-on-surface-variant)] px-4">
                    Regulatory review and cross-border harmonization.
                  </p>
                </div>
              </div>
              {/* Step 5 */}
              <div className="cl-rise text-center space-y-4">
                <div className="w-16 h-16 bg-[var(--cl-surface-container-lowest)] border border-[var(--cl-outline-variant-20)] rounded-[0.75rem] flex items-center justify-center mx-auto relative z-10">
                  <span className="font-headline text-xl text-[var(--cl-primary)]">
                    05
                  </span>
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-[var(--cl-primary)] text-sm uppercase tracking-widest">
                    Deploy
                  </h4>
                  <p className="text-xs text-[var(--cl-on-surface-variant)] px-4">
                    Integration into the national digital infrastructure.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who it's For (Bento Grid) */}
      <section className="py-16 sm:py-20 lg:py-24 bg-[var(--cl-primary)] text-[var(--cl-on-primary)]">
        <div className="max-w-screen-2xl mx-auto px-5 sm:px-8 lg:px-12">
          <div className="flex flex-col md:flex-row justify-between md:items-end items-start mb-12 sm:mb-16 gap-6 sm:gap-8">
            <div className="max-w-xl">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--cl-on-primary-container)]">
                Ecosystem
              </span>
              <h2 className="text-3xl sm:text-4xl font-headline mt-2 text-white">
                Who it&apos;s For
              </h2>
              <p
                className="mt-4 text-lg leading-relaxed"
                style={{ color: 'var(--cl-on-primary-container-80)' }}
              >
                Providing the tools and transparency needed for every pillar of
                the digital economy.
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                type="button"
                aria-label="Previous"
                className="w-12 h-12 rounded-[0.75rem] border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button
                type="button"
                aria-label="Next"
                className="w-12 h-12 rounded-[0.75rem] border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {/* Card 1 */}
            <div className="cl-rise group relative bg-[var(--cl-primary-container-40)] p-6 sm:p-8 border border-white/5 hover:border-[var(--cl-tertiary-fixed-30)] transition-all duration-500 overflow-hidden">
              <span
                className="material-symbols-outlined text-[var(--cl-tertiary-fixed)] text-4xl mb-6 block"
                data-weight="fill"
              >
                account_balance
              </span>
              <h4 className="text-xl font-headline font-bold mb-4">
                Policy Makers
              </h4>
              <p className="text-sm text-[var(--cl-on-primary-container)] leading-relaxed mb-6">
                Access verifiable data streams and impact assessments to create
                resilient regulation.
              </p>
              <a
                className="text-xs font-bold uppercase tracking-widest flex items-center group-hover:text-[var(--cl-tertiary-fixed)] transition-colors"
                href="#"
              >
                Access Dashboard
                <span className="material-symbols-outlined text-xs ml-2">
                  trending_flat
                </span>
              </a>
            </div>
            {/* Card 2 */}
            <div className="cl-rise group relative bg-[var(--cl-primary-container-40)] p-6 sm:p-8 border border-white/5 hover:border-[var(--cl-tertiary-fixed-30)] transition-all duration-500 overflow-hidden">
              <span
                className="material-symbols-outlined text-[var(--cl-tertiary-fixed)] text-4xl mb-6 block"
                data-weight="fill"
              >
                precision_manufacturing
              </span>
              <h4 className="text-xl font-headline font-bold mb-4">Industry</h4>
              <p className="text-sm text-[var(--cl-on-primary-container)] leading-relaxed mb-6">
                Reduce compliance uncertainty and participate in the
                development of technical standards.
              </p>
              <a
                className="text-xs font-bold uppercase tracking-widest flex items-center group-hover:text-[var(--cl-tertiary-fixed)] transition-colors"
                href="#"
              >
                View Roadmap
                <span className="material-symbols-outlined text-xs ml-2">
                  trending_flat
                </span>
              </a>
            </div>
            {/* Card 3 */}
            <div className="cl-rise group relative bg-[var(--cl-primary-container-40)] p-6 sm:p-8 border border-white/5 hover:border-[var(--cl-tertiary-fixed-30)] transition-all duration-500 overflow-hidden">
              <span
                className="material-symbols-outlined text-[var(--cl-tertiary-fixed)] text-4xl mb-6 block"
                data-weight="fill"
              >
                gavel
              </span>
              <h4 className="text-xl font-headline font-bold mb-4">
                Legal Experts
              </h4>
              <p className="text-sm text-[var(--cl-on-primary-container)] leading-relaxed mb-6">
                Interpret blockchain interactions through the lens of
                institutional frameworks.
              </p>
              <a
                className="text-xs font-bold uppercase tracking-widest flex items-center group-hover:text-[var(--cl-tertiary-fixed)] transition-colors"
                href="#"
              >
                Legal Library
                <span className="material-symbols-outlined text-xs ml-2">
                  trending_flat
                </span>
              </a>
            </div>
            {/* Card 4 */}
            <div className="cl-rise group relative bg-[var(--cl-primary-container-40)] p-6 sm:p-8 border border-white/5 hover:border-[var(--cl-tertiary-fixed-30)] transition-all duration-500 overflow-hidden">
              <span
                className="material-symbols-outlined text-[var(--cl-tertiary-fixed)] text-4xl mb-6 block"
                data-weight="fill"
              >
                query_stats
              </span>
              <h4 className="text-xl font-headline font-bold mb-4">
                Researchers
              </h4>
              <p className="text-sm text-[var(--cl-on-primary-container)] leading-relaxed mb-6">
                Contribute to the growing body of knowledge at the intersection
                of crypto and policy.
              </p>
              <a
                className="text-xs font-bold uppercase tracking-widest flex items-center group-hover:text-[var(--cl-tertiary-fixed)] transition-colors"
                href="#"
              >
                Submit Research
                <span className="material-symbols-outlined text-xs ml-2">
                  trending_flat
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Current Status: Timeline */}
      <section className="py-16 sm:py-20 lg:py-24">
        <div className="max-w-screen-2xl mx-auto px-5 sm:px-8 lg:px-12">
          <div className="flex flex-col lg:flex-row gap-10 sm:gap-12 lg:gap-16 items-start">
            <div className="lg:w-1/3">
              <h2 className="text-3xl sm:text-4xl font-headline text-[var(--cl-primary)] mb-6">
                Current Progress
              </h2>
              <p className="text-[var(--cl-on-surface-variant)] mb-8">
                Tracking our journey from concept to a nation-wide policy
                standard.
              </p>
              <div className="p-6 bg-[var(--cl-tertiary-05)] rounded-sm border-l-4 border-[var(--cl-tertiary)]">
                <div className="text-xs font-bold uppercase tracking-widest text-[var(--cl-tertiary)] mb-2">
                  Next Milestone
                </div>
                <div className="text-[var(--cl-primary)] font-bold">
                  Public Verification Workshop
                </div>
                <div className="text-sm text-[var(--cl-on-surface-variant)] mt-1">
                  December 14th, New Delhi
                </div>
              </div>
            </div>
            <div className="lg:w-2/3 w-full min-w-0">
              <div className="space-y-10 sm:space-y-12">
                {/* Phase 1 */}
                <div className="cl-rise flex gap-5 sm:gap-8 relative group">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-[0.75rem] bg-[var(--cl-primary)] text-[var(--cl-on-primary)] flex items-center justify-center shrink-0 z-10">
                      <span className="material-symbols-outlined text-sm">
                        check
                      </span>
                    </div>
                    <div className="cl-timeline-line w-px h-full bg-[var(--cl-outline-variant-30)] absolute top-10"></div>
                  </div>
                  <div className="pb-4 min-w-0 flex-1">
                    <span
                      className="text-xs font-bold uppercase tracking-widest block mb-1"
                      style={{ color: 'rgba(0,10,30,0.4)' }}
                    >
                      Phase 01 - Completed
                    </span>
                    <h4 className="text-xl font-headline font-bold text-[var(--cl-primary)]">
                      Landscape Mapping
                    </h4>
                    <p className="text-sm text-[var(--cl-on-surface-variant)] mt-2 max-w-lg">
                      Comprehensive audit of existing IT laws and their
                      applicability to decentralized networks.
                    </p>
                  </div>
                </div>
                {/* Phase 2 */}
                <div className="cl-rise flex gap-5 sm:gap-8 relative">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-[0.75rem] bg-[var(--cl-primary)] text-[var(--cl-on-primary)] flex items-center justify-center shrink-0 z-10">
                      <span className="material-symbols-outlined text-sm">
                        check
                      </span>
                    </div>
                    <div className="cl-timeline-line w-px h-full bg-[var(--cl-outline-variant-30)] absolute top-10"></div>
                  </div>
                  <div className="pb-4 min-w-0 flex-1">
                    <span
                      className="text-xs font-bold uppercase tracking-widest block mb-1"
                      style={{ color: 'rgba(0,10,30,0.4)' }}
                    >
                      Phase 02 - Completed
                    </span>
                    <h4 className="text-xl font-headline font-bold text-[var(--cl-primary)]">
                      Framework Drafting
                    </h4>
                    <p className="text-sm text-[var(--cl-on-surface-variant)] mt-2 max-w-lg">
                      The &quot;Policy-as-Code&quot; initial prototype release
                      and multi-stakeholder feedback loop.
                    </p>
                  </div>
                </div>
                {/* Phase 3 */}
                <div className="cl-rise flex gap-5 sm:gap-8 relative">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-[0.75rem] border-2 border-[var(--cl-primary)] bg-white text-[var(--cl-primary)] flex items-center justify-center shrink-0 z-10">
                      <div className="w-2 h-2 rounded-full bg-[var(--cl-primary)] animate-pulse"></div>
                    </div>
                    <div className="cl-timeline-line w-px h-full bg-[var(--cl-outline-variant-30)] absolute top-10"></div>
                  </div>
                  <div className="pb-4 min-w-0 flex-1">
                    <span className="text-xs font-bold uppercase tracking-widest text-[var(--cl-tertiary)] block mb-1">
                      Phase 03 - In Progress
                    </span>
                    <h4 className="text-xl font-headline font-bold text-[var(--cl-primary)]">
                      Stakeholder Validation
                    </h4>
                    <p className="text-sm text-[var(--cl-on-surface-variant)] mt-2 max-w-lg">
                      Active alignment workshops and consensus gathering across
                      15+ industry clusters.
                    </p>
                  </div>
                </div>
                {/* Phase 4 */}
                <div className="cl-rise flex gap-5 sm:gap-8 relative">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-[0.75rem] border border-[var(--cl-outline-variant)] bg-[var(--cl-surface)] text-[var(--cl-outline)] flex items-center justify-center shrink-0 z-10">
                      <span className="material-symbols-outlined text-sm">
                        lock
                      </span>
                    </div>
                  </div>
                  <div className="pb-4 min-w-0 flex-1">
                    <span
                      className="text-xs font-bold uppercase tracking-widest block mb-1"
                      style={{ color: 'rgba(0,10,30,0.2)' }}
                    >
                      Phase 04 - Upcoming
                    </span>
                    <h4 className="text-xl font-headline font-bold text-[var(--cl-primary)] opacity-40">
                      National Deployment
                    </h4>
                    <p className="text-sm text-[var(--cl-on-surface-variant)] mt-2 max-w-lg opacity-40">
                      Full implementation of the verified policy framework at a
                      regulatory level.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-[var(--cl-primary-container)]">
          <img
            alt="cta background"
            className="w-full h-full object-cover opacity-20 mix-blend-overlay"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA2kpV5LBsQRYJOiue5pmvYpAlVonS_WvfBSzk_n4rkHQRMTGd6_FFB5aQx3Y_Kao58RSYFhG0GggEwmaTif-cuPOPVsuRkNDVSTWcfYirayx6hNWYrPzhrP-AlIFbA_gJlPVSdv8qaSL8WHz5fEPZHAscVGITn0p4APxE7crIHGB6UC5Y_6vevWPTCJHho2p5oTVBAVou7JJ6dQTO3ps_SvechRadP07-6HgwhJObdXgumQEGfn852w85Pc5NImhC3sT7AE86R2fE"
          />
        </div>
        <div className="max-w-screen-2xl mx-auto px-5 sm:px-8 lg:px-12 relative z-10 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-headline text-white mb-6 sm:mb-8 break-words">
            Ready to define the future of{' '}
            <span className="italic">Policy?</span>
          </h2>
          <p className="text-[var(--cl-on-primary-container)] text-base sm:text-lg lg:text-xl max-w-2xl mx-auto mb-10 sm:mb-12 leading-relaxed">
            Join the network of experts and institutions building the
            verifiable infrastructure for India&apos;s digital century.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-6">
            <Link
              href="/sign-in"
              className="bg-[var(--cl-tertiary-fixed)] text-[var(--cl-on-tertiary-fixed)] px-8 py-4 sm:px-10 sm:py-5 rounded-sm font-bold uppercase tracking-widest text-xs sm:text-sm transition-transform hover:scale-105 active:scale-95 text-center"
            >
              Enter the System
            </Link>
            <a
              href="mailto:hello@civilizationlab.in"
              className="text-white border border-white/20 px-8 py-4 sm:px-10 sm:py-5 rounded-sm font-bold uppercase tracking-widest text-xs sm:text-sm hover:bg-white/5 transition-colors text-center"
            >
              Institutional Inquiries
            </a>
          </div>
        </div>
      </section>

      {/* Footer handled by root layout */}
    </div>
  )
}
