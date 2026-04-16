import type {
  ConsultationSummaryJson,
  ApprovedSummarySection,
} from '@/src/server/services/consultation-summary.service'

interface FrameworkSummaryBlockProps {
  /**
   * The full JSONB payload from the latest published version. D-18: ONLY
   * approved sections render; pending/blocked/error/skipped are silently
   * omitted. If no approved sections exist, the block renders nothing
   * (parent is responsible for deciding whether to mount it at all).
   */
  summary: ConsultationSummaryJson | null
}

/**
 * FrameworkSummaryBlock - Phase 21 D-18. Renders the latest published
 * version's approved consultation summary below the /framework page's
 * WhatChangedLog. NEVER shows a placeholder (unlike the portal section
 * block) - if no approved sections, the block renders nothing.
 *
 * LLM-08: Strips internal-only fields before rendering by projecting
 * into ApprovedSummarySection inside the render loop. None of the
 * provenance metadata reaches the DOM.
 */
export function FrameworkSummaryBlock({ summary }: FrameworkSummaryBlockProps) {
  if (!summary) return null
  const approved: ApprovedSummarySection[] = summary.sections
    .filter((s) => s.status === 'approved')
    .map((s) => ({
      sectionId:    s.sectionId,
      sectionTitle: s.sectionTitle,
      summary:      s.summary,
    }))

  if (approved.length === 0) return null

  return (
    <section className="mx-auto mt-12 max-w-3xl">
      <h2
        className="text-[20px] font-semibold leading-[1.2] text-[var(--cl-primary)]"
        style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
      >
        Consultation Summary
      </h2>
      <p
        className="mt-2 text-sm text-[var(--cl-on-surface-variant)]"
        style={{ fontFamily: 'var(--font-cl-body, Inter, sans-serif)' }}
      >
        Public summary of stakeholder feedback aggregated from the most recent published version.
      </p>
      <div className="mt-6 flex flex-col gap-8">
        {approved.map((section) => (
          <div
            key={section.sectionId}
            className="rounded-lg border border-[var(--cl-outline-variant)] bg-[var(--cl-surface-container-low)] p-6"
          >
            <h3
              className="text-sm font-semibold text-[var(--cl-primary)]"
              style={{ fontFamily: 'var(--font-cl-body, Inter, sans-serif)' }}
            >
              {section.sectionTitle}
            </h3>
            <div
              className="mt-3 whitespace-pre-wrap text-[16px] font-normal leading-[1.8] text-[var(--cl-on-surface)]"
              style={{ fontFamily: 'var(--font-cl-body, Inter, sans-serif)' }}
            >
              {section.summary}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
