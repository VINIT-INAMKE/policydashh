import { renderTiptapToHtml } from '@/src/lib/tiptap-html-renderer'
import type { SectionSnapshot } from '@/src/server/services/version.service'
import {
  SectionStatusBadge,
  type SectionStatus,
} from '@/app/(public)/framework/_components/section-status-badge'
import { SectionSummaryBlock } from './section-summary-block'
import type { ApprovedSummarySection } from '@/src/server/services/consultation-summary.service'

interface PublicPolicyContentProps {
  sections: SectionSnapshot[]
  sectionStatuses?: Map<string, SectionStatus>
  /**
   * Phase 21 D-15: optional approved consultation summaries keyed by
   * sectionId. When undefined, no summary blocks render (backward
   * compatible with Phase 9/20.5 callers). When a sectionId is in
   * `sectionsWithEntry` but not in this map, a placeholder renders
   * (section exists in JSONB but status !== 'approved').
   */
  sectionSummaries?: Map<string, ApprovedSummarySection>
  /**
   * Set of sectionIds that have ANY entry (approved or otherwise) in
   * the consultationSummary JSONB. Used to decide between "placeholder"
   * (in set but not in sectionSummaries) and "omit" (not in set).
   */
  sectionsWithEntry?: Set<string>
}

export function PublicPolicyContent({
  sections,
  sectionStatuses,
  sectionSummaries,
  sectionsWithEntry,
}: PublicPolicyContentProps) {
  if (sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <h2 className="text-lg font-semibold">No sections available</h2>
        <p className="text-sm text-muted-foreground">
          This policy version has no sections to display.
        </p>
      </div>
    )
  }

  return (
    <div>
      {sections.map((section, index) => (
        <div key={section.sectionId}>
          <section id={`section-${section.sectionId}`}>
            <h2 className="text-[20px] font-semibold leading-[1.2] mb-4 flex items-center gap-2">
              {section.title}
              {sectionStatuses && (
                <SectionStatusBadge status={sectionStatuses.get(section.sectionId) ?? 'draft'} />
              )}
            </h2>
            <div
              className="text-[16px] font-normal leading-[1.8] prose prose-neutral prose-lg dark:prose-invert max-w-none text-justify"
              dangerouslySetInnerHTML={{
                __html: renderTiptapToHtml(section.content),
              }}
            />
          </section>
          {sectionSummaries !== undefined && (
            <SectionSummaryBlock
              summary={sectionSummaries.get(section.sectionId)}
              hasEntry={sectionsWithEntry?.has(section.sectionId) ?? false}
            />
          )}
          {index < sections.length - 1 && (
            <hr className="border-border my-12" />
          )}
        </div>
      ))}
    </div>
  )
}
