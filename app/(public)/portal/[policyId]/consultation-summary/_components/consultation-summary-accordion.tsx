'use client'

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'

type FeedbackType = 'issue' | 'suggestion' | 'endorsement' | 'evidence' | 'question'
type FeedbackStatus = 'accepted' | 'partially_accepted' | 'rejected' | 'closed'
type OrgType = 'government' | 'industry' | 'legal' | 'academia' | 'civil_society' | 'internal'

interface SectionSummary {
  sectionId: string
  sectionTitle: string
  submissionCount: number
  typeBreakdown: Record<FeedbackType, number>
  outcomeBreakdown: Record<FeedbackStatus, number>
  orgBreakdown: Record<OrgType, number>
  namedContributors: string[]
}

interface ConsultationSummaryAccordionProps {
  sections: SectionSummary[]
}

const feedbackTypeLabels: Record<FeedbackType, string> = {
  issue: 'Issues',
  suggestion: 'Suggestions',
  endorsement: 'Endorsements',
  evidence: 'Evidence',
  question: 'Questions',
}

const statusLabels: Record<FeedbackStatus, string> = {
  accepted: 'Accepted',
  partially_accepted: 'Partially Accepted',
  rejected: 'Rejected',
  closed: 'Closed',
}

const orgTypeLabels: Record<OrgType, string> = {
  government: 'Government',
  industry: 'Industry',
  legal: 'Legal',
  academia: 'Academia',
  civil_society: 'Civil Society',
  internal: 'Internal',
}

export function ConsultationSummaryAccordion({
  sections,
}: ConsultationSummaryAccordionProps) {
  return (
    <Accordion multiple>
      {sections.map((section) => (
        <AccordionItem key={section.sectionId} value={section.sectionId}>
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <span>{section.sectionTitle}</span>
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {section.submissionCount} submission{section.submissionCount !== 1 ? 's' : ''}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              {/* Submission type breakdown */}
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  Submission Types
                </h4>
                <ul className="space-y-1 text-sm">
                  {(Object.entries(feedbackTypeLabels) as [FeedbackType, string][]).map(
                    ([key, label]) => {
                      const count = section.typeBreakdown[key]
                      if (count === 0) return null
                      return (
                        <li key={key} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium">{count}</span>
                        </li>
                      )
                    }
                  )}
                </ul>
              </div>

              {/* Decision outcome breakdown */}
              <div>
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  Decision Outcomes
                </h4>
                <ul className="space-y-1 text-sm">
                  {(Object.entries(statusLabels) as [FeedbackStatus, string][]).map(
                    ([key, label]) => {
                      const count = section.outcomeBreakdown[key]
                      if (count === 0) return null
                      return (
                        <li key={key} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium">{count}</span>
                        </li>
                      )
                    }
                  )}
                </ul>
              </div>

              {/* Organization type breakdown */}
              {Object.values(section.orgBreakdown).some((v) => v > 0) && (
                <div>
                  <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                    Organization Types
                  </h4>
                  <ul className="space-y-1 text-sm">
                    {(Object.entries(orgTypeLabels) as [OrgType, string][]).map(
                      ([key, label]) => {
                        const count = section.orgBreakdown[key]
                        if (count === 0) return null
                        return (
                          <li key={key} className="flex items-center justify-between">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-medium">{count}</span>
                          </li>
                        )
                      }
                    )}
                  </ul>
                </div>
              )}

              {/* Named contributors */}
              {section.namedContributors.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Named contributors to this section:{' '}
                    <span className="text-foreground">
                      {section.namedContributors.join(', ')}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
