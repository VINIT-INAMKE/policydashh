/**
 * Consultation Summary — shared contract types + runtime helpers.
 *
 * LLM-04: anonymization at input — submitter identity never reaches the LLM.
 * LLM-05: `consultationSummary` is cached on `documentVersions` as a single
 *          JSONB column. This module owns the wire shape.
 * LLM-06: `anonymizeFeedbackForSection` + `buildGuardrailPatternSource` — the
 *          two-layer privacy defense. Anonymization strips identity at the
 *          mapping boundary; the guardrail regex catches any LLM hallucinated
 *          leaks post-generation.
 * LLM-07: moderator review gate — per-section statuses flow
 *          pending → approved | blocked | error | skipped.
 * LLM-08: Public portal must NEVER receive `sourceFeedbackIds`,
 *          `feedbackCount`, `edited`, or `generatedAt`. Use the
 *          `ApprovedSummarySection` projection instead of
 *          `ConsultationSummarySection` when passing data to public
 *          `(public)` route components. Privacy enforcement per Phase 9
 *          PUB-05 precedent and Phase 21 Pitfall 1.
 *
 * Plan 21-00 shipped the type exports (ConsultationSummaryJson,
 * ConsultationSummarySection, ApprovedSummarySection, enums). Plan 21-01
 * appends runtime helpers here: anonymizeFeedbackForSection,
 * fetchAnonymizedFeedback, buildGuardrailPatternSource, computeOverallStatus.
 */

import { and, eq } from 'drizzle-orm'
import { db } from '@/src/db'
import { feedbackItems } from '@/src/db/schema/feedback'
import { users } from '@/src/db/schema/users'

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

/**
 * Shape the LLM receives. `submitterId`, `name`, `email`, and `phone`
 * are NEVER included — D-07 LLM-06 anonymization at input time.
 */
export interface AnonymizedFeedback {
  feedbackId: string
  body: string
  feedbackType: string
  impactCategory: string
  orgType: 'government' | 'industry' | 'legal' | 'academia' | 'civil_society' | 'internal' | null
}

/**
 * Strip name/email/phone/submitterId from feedback rows before handing them
 * to the LLM. Accepts raw rows in either the joined shape returned by
 * fetchAnonymizedFeedback or a plain-object fixture (test path).
 *
 * LLM-06: every field not present on AnonymizedFeedback is dropped at the
 *          mapping boundary. The resulting array is safe to send to Groq.
 */
export function anonymizeFeedbackForSection(
  rows: Array<{
    feedbackId: string
    body: string
    feedbackType: string
    impactCategory: string
    orgType: AnonymizedFeedback['orgType']
    // The following may be present on fixtures — they MUST be dropped:
    submitterId?: string
    name?: string | null
    email?: string | null
    phone?: string | null
  }>,
): AnonymizedFeedback[] {
  return rows.map((r) => ({
    feedbackId:     r.feedbackId,
    body:           r.body,
    feedbackType:   r.feedbackType,
    impactCategory: r.impactCategory,
    orgType:        r.orgType,
  }))
}

/**
 * Load accepted feedback for a section, joined with users.orgType, already
 * stripped of submitter identity. Used by consultationSummaryGenerateFn.
 */
export async function fetchAnonymizedFeedback(
  sectionId: string,
  documentId: string,
): Promise<AnonymizedFeedback[]> {
  const rows = await db
    .select({
      feedbackId:     feedbackItems.id,
      body:           feedbackItems.body,
      feedbackType:   feedbackItems.feedbackType,
      impactCategory: feedbackItems.impactCategory,
      orgType:        users.orgType,
    })
    .from(feedbackItems)
    .leftJoin(users, eq(feedbackItems.submitterId, users.id))
    .where(
      and(
        eq(feedbackItems.sectionId, sectionId),
        eq(feedbackItems.documentId, documentId),
        eq(feedbackItems.status, 'accepted'),
      ),
    )
  return anonymizeFeedbackForSection(rows)
}

/**
 * Build a case-insensitive regex pattern source that matches leaked
 * stakeholder identifying information. Returns the raw pattern string
 * (NOT a RegExp object) because the caller is an Inngest step.run
 * result — RegExp objects JSON-serialize to '{}' across step boundaries
 * (Phase 21 Pitfall 3).
 *
 * Pattern sources:
 *   1. Static: FirstName LastName capital-letter pair, email, phone
 *   2. Dynamic: every name token >=4 chars from users who submitted
 *      feedback on this documentId (live lookup, not cached)
 *
 * LLM-08: Regex output is a belt-and-suspenders defense. The first line
 *          is anonymization at input (anonymizeFeedbackForSection above).
 */
export async function buildGuardrailPatternSource(
  documentId: string,
): Promise<string> {
  const submitters = await db
    .select({ name: users.name })
    .from(users)
    .innerJoin(feedbackItems, eq(feedbackItems.submitterId, users.id))
    .where(eq(feedbackItems.documentId, documentId))
    .groupBy(users.name)

  const nameTokens: string[] = []
  for (const r of submitters) {
    if (!r.name) continue
    for (const tok of r.name.split(/\s+/)) {
      if (tok.length >= 4) {
        nameTokens.push(tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      }
    }
  }

  const staticPatternSources = [
    '\\b[A-Z][a-z]+\\s+[A-Z][a-z]+\\b',              // FirstName LastName
    '\\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}\\b', // email
    '\\b\\+?[0-9]{10,14}\\b',                         // phone
  ]

  const allSources = nameTokens.length > 0
    ? [nameTokens.join('|'), ...staticPatternSources]
    : staticPatternSources

  return allSources.join('|')
}

/**
 * Compute the parent JSONB status from the per-section array.
 * D-11: 'approved' requires ALL sections be 'approved' OR 'skipped'.
 */
export function computeOverallStatus(
  sections: ConsultationSummarySection[],
): ConsultationSummaryOverallStatus {
  if (sections.length === 0) return 'pending'
  const allApprovedOrSkipped = sections.every(
    (s) => s.status === 'approved' || s.status === 'skipped',
  )
  if (allApprovedOrSkipped) return 'approved'
  const anyApproved = sections.some((s) => s.status === 'approved')
  return anyApproved ? 'partial' : 'pending'
}
