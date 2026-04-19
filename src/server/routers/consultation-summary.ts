import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, requirePermission } from '@/src/trpc/init'
import { db } from '@/src/db'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { feedbackItems } from '@/src/db/schema/feedback'
import { users } from '@/src/db/schema/users'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { sendConsultationSummaryRegen } from '@/src/inngest/events'
import {
  computeOverallStatus,
  type ConsultationSummaryJson,
  type ConsultationSummarySection,
} from '@/src/server/services/consultation-summary.service'

/**
 * consultationSummaryRouter - moderator human-review gate (LLM-07).
 *
 * All 5 procedures are gated on `requirePermission('version:manage')`
 * (ADMIN + POLICY_LEAD). Every mutation writes an audit log entry via
 * writeAuditLog fire-and-forget per the Phase 1 invariant.
 *
 * Pitfall 5: regenerateSection performs a synchronous JSONB reset of the
 * target section BEFORE firing the version.published event with
 * overrideOnly. This ensures the Inngest run sees a 'pending' starting
 * state and its write-back does not clobber already-approved sections
 * from a concurrent read.
 */

async function loadSummary(versionId: string): Promise<{
  current: ConsultationSummaryJson | null
  documentId: string
}> {
  const [row] = await db
    .select({
      consultationSummary: documentVersions.consultationSummary,
      documentId:          documentVersions.documentId,
    })
    .from(documentVersions)
    .where(eq(documentVersions.id, versionId))
    .limit(1)
  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' })
  }
  return {
    current:    row.consultationSummary as ConsultationSummaryJson | null,
    documentId: row.documentId,
  }
}

async function writeSummary(versionId: string, payload: ConsultationSummaryJson): Promise<void> {
  await db
    .update(documentVersions)
    .set({ consultationSummary: payload })
    .where(eq(documentVersions.id, versionId))
}

function requireSummary(current: ConsultationSummaryJson | null): ConsultationSummaryJson {
  if (!current) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Consultation summary has not been generated yet for this version',
    })
  }
  return current
}

function findSection(
  summary: ConsultationSummaryJson,
  sectionId: string,
): ConsultationSummarySection {
  const section = summary.sections.find((s) => s.sectionId === sectionId)
  if (!section) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Section ${sectionId} not in consultation summary`,
    })
  }
  return section
}

export const consultationSummaryRouter = router({
  // ---- getByVersionId (LLM-07 read) --------------------------------
  getByVersionId: requirePermission('version:manage')
    .input(z.object({ versionId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [row] = await db
        .select({
          consultationSummary: documentVersions.consultationSummary,
        })
        .from(documentVersions)
        .where(eq(documentVersions.id, input.versionId))
        .limit(1)
      return (row?.consultationSummary as ConsultationSummaryJson | null) ?? null
    }),

  // ---- status (E10 - polling endpoint) -----------------------------
  // Light-weight status projection. Clients polling during regenerate can
  // hit this on a short interval without refetching the full JSONB payload.
  // `publishedAt` lets the UI show "stale" when the version was published
  // after the summary's generatedAt timestamp.
  status: requirePermission('version:manage')
    .input(z.object({ versionId: z.string().uuid() }))
    .query(async ({ input }) => {
      const [row] = await db
        .select({
          consultationSummary: documentVersions.consultationSummary,
          publishedAt:         documentVersions.publishedAt,
        })
        .from(documentVersions)
        .where(eq(documentVersions.id, input.versionId))
        .limit(1)

      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Version not found' })
      }

      const summary = row.consultationSummary as ConsultationSummaryJson | null
      if (!summary) {
        return {
          status:      'pending' as const,
          generatedAt: null as string | null,
          publishedAt: row.publishedAt,
          isStale:     false,
          sections:    [] as { sectionId: string; status: string; error?: string }[],
        }
      }

      // Stale if the latest publish happened after the summary was
      // generated - happens after a regenerate was fired for a newer CR.
      const publishedAt = row.publishedAt
      const generatedAt = summary.generatedAt
      const isStale = !!(
        publishedAt &&
        generatedAt &&
        new Date(publishedAt).getTime() > new Date(generatedAt).getTime()
      )

      return {
        status:      summary.status,
        generatedAt: summary.generatedAt,
        publishedAt: row.publishedAt,
        isStale,
        sections:    summary.sections.map((s) => ({
          sectionId: s.sectionId,
          status:    s.status,
          error:     s.error,
        })),
      }
    }),

  // ---- getSectionFeedback (LLM-07 - right panel data) -------------
  // Returns anonymized feedback for a single section so the moderator
  // can verify the LLM summary against source rows. NEVER returns
  // names/emails/phones - uses orgType for role attribution only.
  getSectionFeedback: requirePermission('version:manage')
    .input(
      z.object({
        versionId: z.string().uuid(),
        sectionId: z.string().uuid(),
      }),
    )
    .query(async ({ input }) => {
      const { current } = await loadSummary(input.versionId)
      const summary = requireSummary(current)
      const section = findSection(summary, input.sectionId)

      if (section.sourceFeedbackIds.length === 0) return []

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
        .where(eq(feedbackItems.sectionId, input.sectionId))
      // Filter in-memory to sourceFeedbackIds set (drizzle-orm `inArray`
      // is supported but this stays simple and avoids array-binding
      // headaches).
      const idSet = new Set(section.sourceFeedbackIds)
      return rows.filter((r) => idSet.has(r.feedbackId))
    }),

  // ---- approveSection (LLM-07 - human gate) ----------------------
  approveSection: requirePermission('version:manage')
    .input(
      z.object({
        versionId: z.string().uuid(),
        sectionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { current } = await loadSummary(input.versionId)
      const summary = requireSummary(current)
      const sections = summary.sections.map((s) =>
        s.sectionId === input.sectionId
          ? { ...s, status: 'approved' as const }
          : s,
      )
      const updated: ConsultationSummaryJson = {
        ...summary,
        status:   computeOverallStatus(sections),
        sections,
      }
      await writeSummary(input.versionId, updated)

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.CONSULTATION_SUMMARY_APPROVE,
        entityType: 'document_version',
        entityId:   input.versionId,
        payload:    { sectionId: input.sectionId },
      }).catch(console.error)

      return { status: updated.status, sectionStatus: 'approved' as const }
    }),

  // ---- editSection (LLM-07 - moderator edits prose) ------------
  editSection: requirePermission('version:manage')
    .input(
      z.object({
        versionId: z.string().uuid(),
        sectionId: z.string().uuid(),
        prose:     z.string().min(1).max(5000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { current } = await loadSummary(input.versionId)
      const summary = requireSummary(current)
      const sections = summary.sections.map((s) =>
        s.sectionId === input.sectionId
          ? { ...s, summary: input.prose, edited: true }
          : s,
      )
      const updated: ConsultationSummaryJson = {
        ...summary,
        sections,
      }
      await writeSummary(input.versionId, updated)

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.CONSULTATION_SUMMARY_EDIT,
        entityType: 'document_version',
        entityId:   input.versionId,
        payload:    { sectionId: input.sectionId, proseLength: input.prose.length },
      }).catch(console.error)

      return { sectionId: input.sectionId, edited: true }
    }),

  // ---- regenerateSection (LLM-07/08 - re-run Inngest) --------
  // Pitfall 5: synchronously reset this section to pending BEFORE
  // firing the event so the Inngest run sees the pending starting
  // state and its write-back preserves approved siblings.
  regenerateSection: requirePermission('version:manage')
    .input(
      z.object({
        versionId: z.string().uuid(),
        sectionId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { current, documentId } = await loadSummary(input.versionId)
      const summary = requireSummary(current)
      const targetSection = findSection(summary, input.sectionId)

      // D19: dedupe rapid double-clicks on "Regenerate Section". Two events
      // fired ~50ms apart would both trigger a full LLM run; the second
      // overwrites the first's output in persist-summary and produces
      // inconsistent state (especially when one run hits the guardrail and
      // the other doesn't). If the section is ALREADY pending when we enter
      // this mutation, an Inngest run is already in flight for it - skip
      // the reset + send and return idempotently.
      if (targetSection.status === 'pending') {
        writeAuditLog({
          actorId:    ctx.user.id,
          actorRole:  ctx.user.role,
          action:     ACTIONS.CONSULTATION_SUMMARY_REGENERATE,
          entityType: 'document_version',
          entityId:   input.versionId,
          payload:    { sectionId: input.sectionId, deduped: true },
        }).catch(console.error)
        return { sectionId: input.sectionId, queued: false, alreadyPending: true }
      }

      const sections = summary.sections.map((s) =>
        s.sectionId === input.sectionId
          ? {
              ...s,
              status:  'pending' as const,
              summary: '',
              edited:  false,
              error:   undefined,
            }
          : s,
      )
      const reset: ConsultationSummaryJson = {
        ...summary,
        status:   computeOverallStatus(sections),
        sections,
      }
      await writeSummary(input.versionId, reset)

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.CONSULTATION_SUMMARY_REGENERATE,
        entityType: 'document_version',
        entityId:   input.versionId,
        payload:    { sectionId: input.sectionId },
      }).catch(console.error)

      // I3: use the dedicated regen event so versionAnchorFn does not re-fire
      // and emit NonRetriableError('Already anchored') on every section regen.
      await sendConsultationSummaryRegen({
        versionId:    input.versionId,
        documentId,
        overrideOnly: [input.sectionId],
      })

      return { sectionId: input.sectionId, queued: true }
    }),
})
