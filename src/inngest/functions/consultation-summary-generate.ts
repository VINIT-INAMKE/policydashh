import { eq } from 'drizzle-orm'
import { inngest } from '../client'
import { versionPublishedEvent, consultationSummaryRegenEvent } from '../events'
import { db } from '@/src/db'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { generateConsultationSummary } from '@/src/lib/llm'
import {
  fetchAnonymizedFeedback,
  buildGuardrailPatternSource,
  computeOverallStatus,
  type ConsultationSummarySection,
  type ConsultationSummaryJson,
} from '@/src/server/services/consultation-summary.service'
import type { SectionSnapshot } from '@/src/server/services/version.service'

/**
 * consultation-summary-generate - Groq llama-3.3-70b-versatile backed
 * Inngest function that fans out one LLM call per policy section.
 *
 * LLM-04: llama-3.3-70b-versatile per-section prose via generateConsultationSummary.
 * LLM-05: caches result in documentVersions.consultationSummary JSONB.
 * LLM-06: anonymization at input (fetchAnonymizedFeedback strips submitter identity).
 * LLM-08: post-generation guardrail regex; matches store section as status='blocked'.
 *
 * Pitfalls:
 *   1. RegExp cannot cross step.run boundaries (JSON-serializes to '{}').
 *      buildGuardrailPatternSource returns a STRING; each section step
 *      reconstructs `new RegExp(source)` inside its own closure.
 *   2. Per-section errors are caught locally - other sections continue.
 *      Function never throws NonRetriableError from section loop.
 *   3. overrideOnly (D-13) skips non-matching sections, preserving
 *      already-approved prose on manual single-section regen.
 *   4. concurrency.key='groq-summary' is SEPARATE from
 *      'groq-transcription' - summary bursts don't block workshop
 *      transcriptions (Phase 21 Pitfall 4).
 *   5. The guardrail regex compiles WITHOUT /i flag: the static
 *      FirstName LastName pattern requires case sensitivity, and /i
 *      would nullify that (email already uses explicit [a-zA-Z]
 *      character class, phone is digit-only, so /i is semantically
 *      unnecessary anywhere in the source).
 */
export const consultationSummaryGenerateFn = inngest.createFunction(
  {
    id: 'consultation-summary-generate',
    name: 'Consultation summary - generate via Groq llama',
    retries: 2,
    concurrency: { key: 'groq-summary', limit: 2 },
    // I3: listen on BOTH events. `version.published` auto-generates the
    // summary on publish; `consultation-summary.regen` runs a scoped,
    // single-section regen from the moderator UI without re-firing the
    // anchor pipeline. Payload shapes are identical (versionId,
    // documentId, overrideOnly), so the handler body is unchanged.
    triggers: [
      { event: versionPublishedEvent },
      { event: consultationSummaryRegenEvent },
    ],
  },
  async ({ event, step }) => {
    const { versionId, documentId, overrideOnly } = event.data

    // Step 1: load the version's section list (from sectionsSnapshot JSONB)
    const versionData = await step.run('fetch-version', async () => {
      const [row] = await db
        .select({
          id: documentVersions.id,
          sectionsSnapshot: documentVersions.sectionsSnapshot,
          consultationSummary: documentVersions.consultationSummary,
        })
        .from(documentVersions)
        .where(eq(documentVersions.id, versionId))
        .limit(1)
      if (!row) return null
      const snapshot = (row.sectionsSnapshot as SectionSnapshot[] | null) ?? []
      return {
        existing: row.consultationSummary as ConsultationSummaryJson | null,
        sections: snapshot.map((s) => ({
          sectionId: s.sectionId,
          sectionTitle: s.title,
        })),
      }
    })

    if (!versionData || versionData.sections.length === 0) {
      return { versionId, sectionCount: 0, skipped: true }
    }

    // Step 2: build the guardrail pattern source (a STRING - Pitfall 1).
    const guardrailSource = await step.run('build-guardrail', async () => {
      return await buildGuardrailPatternSource(documentId)
    })

    // Step 3: per-section fan-out. One step.run per section so Inngest
    // memoizes individual results across retries.
    const newSectionResults: ConsultationSummarySection[] = []
    for (const section of versionData.sections) {
      // overrideOnly: preserve existing section when it's NOT in the
      // regeneration allow-list (D-13). This lets manual per-section
      // regen leave approved sections untouched in the JSONB.
      if (overrideOnly && !overrideOnly.includes(section.sectionId)) {
        const existing = versionData.existing?.sections.find(
          (s) => s.sectionId === section.sectionId,
        )
        if (existing) {
          newSectionResults.push(existing)
          continue
        }
      }

      const result = await step.run(
        `generate-section-${section.sectionId}`,
        async (): Promise<ConsultationSummarySection> => {
          try {
            const feedback = await fetchAnonymizedFeedback(
              section.sectionId,
              documentId,
            )
            const now = new Date().toISOString()

            if (feedback.length === 0) {
              return {
                sectionId:         section.sectionId,
                sectionTitle:      section.sectionTitle,
                summary:           '',
                status:            'skipped',
                edited:            false,
                generatedAt:       now,
                feedbackCount:     0,
                sourceFeedbackIds: [],
              }
            }

            const prose = await generateConsultationSummary(
              section.sectionTitle,
              feedback,
            )

            // Reconstruct the RegExp INSIDE this step - string source
            // crossed the step boundary safely (Pitfall 1). No /i flag
            // because the name-pair branch requires capital-letter
            // sensitivity (Pitfall 5).
            const guardrail = new RegExp(guardrailSource)
            if (guardrail.test(prose)) {
              return {
                sectionId:         section.sectionId,
                sectionTitle:      section.sectionTitle,
                summary:           '',
                status:            'blocked',
                edited:            false,
                generatedAt:       now,
                feedbackCount:     feedback.length,
                sourceFeedbackIds: feedback.map((f) => f.feedbackId),
                error:             'guardrail-violation',
              }
            }

            return {
              sectionId:         section.sectionId,
              sectionTitle:      section.sectionTitle,
              summary:           prose,
              status:            'pending',
              edited:            false,
              generatedAt:       now,
              feedbackCount:     feedback.length,
              sourceFeedbackIds: feedback.map((f) => f.feedbackId),
            }
          } catch (err) {
            // Per-section error does NOT fail the function - D-09.
            const message = err instanceof Error ? err.message : String(err)
            return {
              sectionId:         section.sectionId,
              sectionTitle:      section.sectionTitle,
              summary:           '',
              status:            'error',
              edited:            false,
              generatedAt:       new Date().toISOString(),
              feedbackCount:     0,
              sourceFeedbackIds: [],
              error:             message,
            }
          }
        },
      )
      newSectionResults.push(result)
    }

    // Step 4: persist the full JSONB (full document replace - no jsonb_set
    // partial patches; avoids Pitfall 5 race via full read-modify-write).
    await step.run('persist-summary', async () => {
      const payload: ConsultationSummaryJson = {
        status:      computeOverallStatus(newSectionResults),
        generatedAt: new Date().toISOString(),
        sections:    newSectionResults,
      }
      await db
        .update(documentVersions)
        .set({ consultationSummary: payload })
        .where(eq(documentVersions.id, versionId))
    })

    return {
      versionId,
      sectionCount: newSectionResults.length,
      overrideOnly: overrideOnly ?? null,
    }
  },
)
