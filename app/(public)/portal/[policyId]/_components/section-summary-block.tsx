import type { ApprovedSummarySection } from '@/src/server/services/consultation-summary.service'
import { SummaryPlaceholderCard } from './summary-placeholder-card'

interface SectionSummaryBlockProps {
  /**
   * Approved summary for this section. When undefined, the section either
   * has no JSONB entry (no render) or has a non-approved status (placeholder).
   */
  summary: ApprovedSummarySection | undefined
  /**
   * Whether the section has SOMETHING in the JSONB (even if not approved).
   * Used to decide between placeholder (hasEntry && !summary) and omit
   * entirely (no entry — e.g. version predates feature).
   */
  hasEntry: boolean
}

/**
 * Renders the approved consultation summary prose inline below a policy
 * section on /portal/[policyId], or a placeholder for sections whose
 * summary is pending/blocked/error/skipped, or nothing at all for
 * versions predating the feature.
 *
 * LLM-08: Accepts only `ApprovedSummarySection` — the stripped projection.
 *          Never receives the internal-only fields per Phase 21 Pitfall 1.
 */
export function SectionSummaryBlock({ summary, hasEntry }: SectionSummaryBlockProps) {
  if (!hasEntry) {
    return null
  }
  if (!summary) {
    return <SummaryPlaceholderCard />
  }

  return (
    <div className="mt-8 rounded-lg border border-[var(--cl-outline-variant)] bg-[var(--cl-surface-container-low)] p-6">
      <h3
        className="flex items-center gap-2 text-base font-semibold text-[var(--cl-primary)]"
        style={{ fontFamily: 'var(--font-cl-headline, Newsreader, serif)' }}
      >
        <span className="inline-block h-2 w-2 rounded-full bg-[#179d53]" aria-hidden="true" />
        Stakeholder Perspectives
      </h3>
      <p
        className="mt-2 text-sm text-[var(--cl-on-surface-variant)]"
        style={{ fontFamily: 'var(--font-cl-body, Inter, sans-serif)' }}
      >
        A summary of stakeholder feedback on this section, reviewed by the policy team.
      </p>
      <div
        className="mt-4 whitespace-pre-wrap text-[16px] font-normal leading-[1.8] text-[var(--cl-on-surface)]"
        style={{ fontFamily: 'var(--font-cl-body, Inter, sans-serif)' }}
      >
        {summary.summary}
      </div>
    </div>
  )
}
