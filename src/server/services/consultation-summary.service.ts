/**
 * Consultation Summary — shared contract types.
 *
 * LLM-05: `consultationSummary` is cached on `documentVersions` as a single
 *          JSONB column. This module owns the wire shape.
 * LLM-07: moderator review gate — per-section statuses flow
 *          pending → approved | blocked | error | skipped.
 * LLM-08: Public portal must NEVER receive `sourceFeedbackIds`,
 *          `feedbackCount`, `edited`, or `generatedAt`. Use the
 *          `ApprovedSummarySection` projection instead of
 *          `ConsultationSummarySection` when passing data to public
 *          `(public)` route components. Privacy enforcement per Phase 9
 *          PUB-05 precedent and Phase 21 Pitfall 1.
 *
 * Plan 21-00 Wave 0 ships ONLY these types; anonymization, guardrail, LLM
 * call, and Inngest function land in Plan 21-01/21-02.
 */

export type ConsultationSummarySectionStatus =
  | 'pending'
  | 'approved'
  | 'blocked'
  | 'error'
  | 'skipped'

export type ConsultationSummaryOverallStatus =
  | 'pending'
  | 'partial'
  | 'approved'

export interface ConsultationSummarySection {
  sectionId: string
  sectionTitle: string
  summary: string
  status: ConsultationSummarySectionStatus
  edited: boolean
  generatedAt: string // ISO timestamp
  feedbackCount: number
  sourceFeedbackIds: string[]
  error?: string // populated when status === 'blocked' | 'error'
}

export interface ConsultationSummaryJson {
  status: ConsultationSummaryOverallStatus
  generatedAt: string // ISO timestamp
  sections: ConsultationSummarySection[]
}

/**
 * Public-facing projection — strips sourceFeedbackIds, feedbackCount,
 * edited, generatedAt. Passed to `PublicPolicyContent` and
 * `FrameworkSummaryBlock`. NEVER pass a `ConsultationSummarySection`
 * directly into a `(public)` route component.
 */
export interface ApprovedSummarySection {
  sectionId: string
  sectionTitle: string
  summary: string
}
