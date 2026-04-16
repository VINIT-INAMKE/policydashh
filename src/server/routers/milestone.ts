import { z } from 'zod'
import { eq, and, count } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, requirePermission } from '@/src/trpc/init'
import { db } from '@/src/db'
import { milestones } from '@/src/db/schema/milestones'
import type { MilestoneStatus, RequiredSlots, ManifestEntry } from '@/src/db/schema/milestones'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { workshops } from '@/src/db/schema/workshops'
import { feedbackItems } from '@/src/db/schema/feedback'
import { evidenceArtifacts } from '@/src/db/schema/evidence'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { sendMilestoneReady } from '@/src/inngest/events'
import {
  hashPolicyVersion,
  hashWorkshop,
  hashFeedbackItem,
  hashEvidenceArtifact,
  hashMilestone,
} from '@/src/lib/hashing'

/**
 * milestoneRouter — create-then-curate milestone lifecycle (VERIFY-01, VERIFY-02, VERIFY-03).
 *
 * Six procedures:
 *   - create:       admin+policy_lead creates empty milestone with requiredSlots
 *   - list:         read milestones for a document (admin/policy_lead/auditor)
 *   - getById:      full milestone detail + linked entity counts + slot status
 *   - attachEntity: set milestoneId FK on child row (discriminated union by entityType)
 *   - detachEntity: clear milestoneId FK on child row
 *   - markReady:    the state transition — computes hashes, builds manifest, persists,
 *                   and flips status defining → ready
 *
 * All mutations write audit log entries via writeAuditLog fire-and-forget
 * (Phase 1 invariant). Immutability: attachEntity / detachEntity / markReady
 * reject if milestone.status === 'anchored'; markReady additionally rejects
 * if status !== 'defining'.
 *
 * Role authorization per CONTEXT.md Claude's Discretion:
 *   milestone:manage → [ADMIN, POLICY_LEAD]
 *   milestone:read   → [ADMIN, POLICY_LEAD, AUDITOR]
 *
 * Hash composition (markReady):
 *   1. Load milestone + assert NOT anchored + assert state === 'defining'
 *   2. Compute slot status; reject with structured PRECONDITION_FAILED if unmet
 *   3. Load all 4 linked entity rows for the milestone
 *   4. Per-child hash computation via src/lib/hashing.ts (D-02a — no direct crypto)
 *   5. Build manifest array (sorted ascending by (entityType, entityId) before persist)
 *   6. Compute milestone hash via hashMilestone()
 *   7. Persist contentHash + manifest + status transition defining → ready
 *   8. Fire audit log with before/after state
 */

// ----- Helpers -----

async function loadMilestone(milestoneId: string) {
  const [row] = await db
    .select()
    .from(milestones)
    .where(eq(milestones.id, milestoneId))
    .limit(1)
  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Milestone not found' })
  }
  return row
}

function assertNotAnchored(status: MilestoneStatus): void {
  if (status === 'anchored') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Milestone is anchored and immutable',
    })
  }
}

function assertInDefining(status: MilestoneStatus): void {
  if (status !== 'defining') {
    throw new TRPCError({
      code: 'CONFLICT',
      message: `Cannot mark ready from state ${status} (must be defining)`,
    })
  }
}

type SlotType = 'versions' | 'workshops' | 'feedback' | 'evidence'

interface SlotStatus {
  type: SlotType
  required: number
  actual: number
  met: boolean
}

async function computeSlotStatus(
  milestoneId: string,
  requiredSlots: RequiredSlots,
): Promise<SlotStatus[]> {
  const [versionsCount] = await db
    .select({ n: count() })
    .from(documentVersions)
    .where(eq(documentVersions.milestoneId, milestoneId))
  const [workshopsCount] = await db
    .select({ n: count() })
    .from(workshops)
    .where(eq(workshops.milestoneId, milestoneId))
  const [feedbackCount] = await db
    .select({ n: count() })
    .from(feedbackItems)
    .where(eq(feedbackItems.milestoneId, milestoneId))
  const [evidenceCount] = await db
    .select({ n: count() })
    .from(evidenceArtifacts)
    .where(eq(evidenceArtifacts.milestoneId, milestoneId))

  const versionsActual = Number(versionsCount?.n ?? 0)
  const workshopsActual = Number(workshopsCount?.n ?? 0)
  const feedbackActual = Number(feedbackCount?.n ?? 0)
  const evidenceActual = Number(evidenceCount?.n ?? 0)

  const versionsRequired = requiredSlots.versions ?? 0
  const workshopsRequired = requiredSlots.workshops ?? 0
  const feedbackRequired = requiredSlots.feedback ?? 0
  const evidenceRequired = requiredSlots.evidence ?? 0

  const slots: SlotStatus[] = [
    {
      type: 'versions',
      required: versionsRequired,
      actual: versionsActual,
      met: versionsActual >= versionsRequired,
    },
    {
      type: 'workshops',
      required: workshopsRequired,
      actual: workshopsActual,
      met: workshopsActual >= workshopsRequired,
    },
    {
      type: 'feedback',
      required: feedbackRequired,
      actual: feedbackActual,
      met: feedbackActual >= feedbackRequired,
    },
    {
      type: 'evidence',
      required: evidenceRequired,
      actual: evidenceActual,
      met: evidenceActual >= evidenceRequired,
    },
  ]
  return slots
}

// ----- Router -----

export const milestoneRouter = router({
  // ---- create (MILESTONE_CREATE) ----
  create: requirePermission('milestone:manage')
    .input(
      z.object({
        documentId:  z.string().uuid(),
        title:       z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        requiredSlots: z
          .object({
            versions:  z.number().int().min(0).optional(),
            workshops: z.number().int().min(0).optional(),
            feedback:  z.number().int().min(0).optional(),
            evidence:  z.number().int().min(0).optional(),
          })
          .default({}),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [row] = await db
        .insert(milestones)
        .values({
          documentId:    input.documentId,
          title:         input.title,
          description:   input.description ?? null,
          status:        'defining',
          requiredSlots: input.requiredSlots,
          createdBy:     ctx.user.id,
        })
        .returning()

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.MILESTONE_CREATE,
        entityType: 'milestone',
        entityId:   row.id,
        payload:    {
          documentId:    input.documentId,
          title:         input.title,
          requiredSlots: input.requiredSlots,
        },
      }).catch(console.error)

      return row
    }),

  // ---- list (query) ----
  list: requirePermission('milestone:read')
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select()
        .from(milestones)
        .where(eq(milestones.documentId, input.documentId))
      return rows
    }),

  // ---- getById (query) ----
  getById: requirePermission('milestone:read')
    .input(z.object({ milestoneId: z.string().uuid() }))
    .query(async ({ input }) => {
      const milestone = await loadMilestone(input.milestoneId)
      const slotStatus = await computeSlotStatus(
        milestone.id,
        (milestone.requiredSlots as RequiredSlots) ?? {},
      )
      return {
        milestone,
        slotStatus,
      }
    }),

  // ---- attachEntity (MILESTONE_ATTACH_ENTITY) ----
  // Discriminated union on entityType — single procedure, branches by table.
  attachEntity: requirePermission('milestone:manage')
    .input(
      z.object({
        milestoneId: z.string().uuid(),
        entityType:  z.enum(['version', 'workshop', 'feedback', 'evidence']),
        entityId:    z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const milestone = await loadMilestone(input.milestoneId)
      assertNotAnchored(milestone.status as MilestoneStatus)

      switch (input.entityType) {
        case 'version':
          await db
            .update(documentVersions)
            .set({ milestoneId: input.milestoneId })
            .where(eq(documentVersions.id, input.entityId))
          break
        case 'workshop':
          await db
            .update(workshops)
            .set({ milestoneId: input.milestoneId })
            .where(eq(workshops.id, input.entityId))
          break
        case 'feedback':
          await db
            .update(feedbackItems)
            .set({ milestoneId: input.milestoneId })
            .where(eq(feedbackItems.id, input.entityId))
          break
        case 'evidence':
          await db
            .update(evidenceArtifacts)
            .set({ milestoneId: input.milestoneId })
            .where(eq(evidenceArtifacts.id, input.entityId))
          break
      }

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.MILESTONE_ATTACH_ENTITY,
        entityType: 'milestone',
        entityId:   input.milestoneId,
        payload:    { entityType: input.entityType, entityId: input.entityId },
      }).catch(console.error)

      return { attached: true, entityType: input.entityType, entityId: input.entityId }
    }),

  // ---- detachEntity (MILESTONE_DETACH_ENTITY) ----
  detachEntity: requirePermission('milestone:manage')
    .input(
      z.object({
        milestoneId: z.string().uuid(),
        entityType:  z.enum(['version', 'workshop', 'feedback', 'evidence']),
        entityId:    z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const milestone = await loadMilestone(input.milestoneId)
      assertNotAnchored(milestone.status as MilestoneStatus)

      switch (input.entityType) {
        case 'version':
          await db
            .update(documentVersions)
            .set({ milestoneId: null })
            .where(
              and(
                eq(documentVersions.id, input.entityId),
                eq(documentVersions.milestoneId, input.milestoneId),
              ),
            )
          break
        case 'workshop':
          await db
            .update(workshops)
            .set({ milestoneId: null })
            .where(
              and(
                eq(workshops.id, input.entityId),
                eq(workshops.milestoneId, input.milestoneId),
              ),
            )
          break
        case 'feedback':
          await db
            .update(feedbackItems)
            .set({ milestoneId: null })
            .where(
              and(
                eq(feedbackItems.id, input.entityId),
                eq(feedbackItems.milestoneId, input.milestoneId),
              ),
            )
          break
        case 'evidence':
          await db
            .update(evidenceArtifacts)
            .set({ milestoneId: null })
            .where(
              and(
                eq(evidenceArtifacts.id, input.entityId),
                eq(evidenceArtifacts.milestoneId, input.milestoneId),
              ),
            )
          break
      }

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.MILESTONE_DETACH_ENTITY,
        entityType: 'milestone',
        entityId:   input.milestoneId,
        payload:    { entityType: input.entityType, entityId: input.entityId },
      }).catch(console.error)

      return { detached: true, entityType: input.entityType, entityId: input.entityId }
    }),

  // ---- markReady (MILESTONE_MARK_READY) — THE state transition ----
  // Steps:
  //   1. Load milestone; assert NOT anchored (immutability); assert state === 'defining'
  //   2. Compute slot status; reject with structured PRECONDITION_FAILED if unmet
  //   3. Load all 4 linked entity rows for the milestone
  //   4. Per-child hash computation via src/lib/hashing.ts
  //   5. Build manifest array (sorted ascending by (entityType, entityId))
  //   6. Compute milestone hash via hashMilestone()
  //   7. Persist contentHash + manifest + transition status defining → ready
  //   8. Fire audit log with before/after state
  markReady: requirePermission('milestone:manage')
    .input(z.object({ milestoneId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const milestone = await loadMilestone(input.milestoneId)
      assertNotAnchored(milestone.status as MilestoneStatus)
      assertInDefining(milestone.status as MilestoneStatus)

      // --- 2. Slot validation ---
      const slotStatus = await computeSlotStatus(
        milestone.id,
        (milestone.requiredSlots as RequiredSlots) ?? {},
      )
      const unmet = slotStatus.filter((s) => s.required > 0 && !s.met)
      if (unmet.length > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Cannot mark ready — ${unmet.length} required slot(s) unmet`,
          cause: { unmet } as unknown as Error,
        })
      }

      // --- 3. Load linked entity rows ---
      const linkedVersions = await db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.milestoneId, milestone.id))
      const linkedWorkshops = await db
        .select()
        .from(workshops)
        .where(eq(workshops.milestoneId, milestone.id))
      const linkedFeedback = await db
        .select()
        .from(feedbackItems)
        .where(eq(feedbackItems.milestoneId, milestone.id))
      const linkedEvidence = await db
        .select()
        .from(evidenceArtifacts)
        .where(eq(evidenceArtifacts.milestoneId, milestone.id))

      // --- 4. Per-child hashes ---
      // Pitfall 2: Date columns must be converted to ISO strings before passing
      // to hash functions — the hashing service input types expect `string | null`
      // for dates, not Date objects. Mismatched types produce different canonical
      // JSON and thus different hex.
      const versionEntries: ManifestEntry[] = linkedVersions.map((v) => ({
        entityType: 'version' as const,
        entityId:   v.id,
        contentHash: hashPolicyVersion({
          id:               v.id,
          documentId:       v.documentId,
          versionLabel:     v.versionLabel,
          sectionsSnapshot: v.sectionsSnapshot,
          changelog:        v.changelog,
          publishedAt:      v.publishedAt ? new Date(v.publishedAt).toISOString() : null,
          createdBy:        v.createdBy,
        }),
      }))

      // Workshop per-child hashes need sorted linkedArtifactIds + linkedFeedbackIds.
      // For Phase 22 we include only the workshop row fields + empty link arrays;
      // Phase 23 will wire in the actual join tables. This keeps D-03a satisfied
      // (single-row derivable) and avoids coupling this plan to workshop join tables.
      const workshopEntries: ManifestEntry[] = linkedWorkshops.map((w) => ({
        entityType: 'workshop' as const,
        entityId:   w.id,
        contentHash: hashWorkshop({
          id:               w.id,
          title:            w.title,
          scheduledAt:      new Date(w.scheduledAt).toISOString(),
          durationMinutes:  w.durationMinutes,
          status:           w.status,
          createdBy:        w.createdBy,
          linkedArtifactIds: [], // Phase 22 scope — empty; Phase 23 wires joins
          linkedFeedbackIds: [],
        }),
      }))

      const feedbackEntries: ManifestEntry[] = linkedFeedback.map((f) => ({
        entityType: 'feedback' as const,
        entityId:   f.id,
        contentHash: hashFeedbackItem({
          id:                  f.id,
          readableId:          f.readableId,
          sectionId:           f.sectionId,
          documentId:          f.documentId,
          feedbackType:        f.feedbackType,
          priority:            f.priority,
          impactCategory:      f.impactCategory,
          title:               f.title,
          body:                f.body,
          suggestedChange:     f.suggestedChange,
          status:              f.status,
          decisionRationale:   f.decisionRationale,
          reviewedBy:          f.reviewedBy,
          reviewedAt:          f.reviewedAt ? new Date(f.reviewedAt).toISOString() : null,
          resolvedInVersionId: f.resolvedInVersionId,
          isAnonymous:         f.isAnonymous,
        }),
      }))

      const evidenceEntries: ManifestEntry[] = linkedEvidence.map((e) => ({
        entityType: 'evidence' as const,
        entityId:   e.id,
        contentHash: hashEvidenceArtifact({
          id:         e.id,
          title:      e.title,
          type:       e.type,
          url:        e.url,
          fileName:   e.fileName,
          fileSize:   e.fileSize,
          uploaderId: e.uploaderId,
          content:    e.content,
        }),
      }))

      // --- 5. Build manifest ---
      const manifest: ManifestEntry[] = [
        ...versionEntries,
        ...workshopEntries,
        ...feedbackEntries,
        ...evidenceEntries,
      ]

      // --- 6. Compute milestone hash (hashMilestone sorts manifest internally) ---
      const canonicalInput = {
        manifest,
        metadata: {
          milestoneId:   milestone.id,
          documentId:    milestone.documentId,
          title:         milestone.title,
          createdAt:     new Date(milestone.createdAt).toISOString(),
          requiredSlots: (milestone.requiredSlots as RequiredSlots) ?? {},
        },
      }
      const contentHash = hashMilestone(canonicalInput)

      // --- 7. Persist ---
      // Sort manifest ascending by (entityType, entityId) before persist so the
      // JSONB column matches the canonical order hashMilestone() used internally.
      const sortedManifest = [...manifest].sort((a, b) => {
        const typeCmp = a.entityType.localeCompare(b.entityType)
        if (typeCmp !== 0) return typeCmp
        return a.entityId.localeCompare(b.entityId)
      })

      await db
        .update(milestones)
        .set({
          status:                'ready',
          contentHash,
          manifest:              sortedManifest,
          canonicalJsonBytesLen: Buffer.byteLength(JSON.stringify(canonicalInput), 'utf8'),
          updatedAt:             new Date(),
        })
        .where(eq(milestones.id, milestone.id))

      // --- 8. Audit log (fire-and-forget) ---
      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.MILESTONE_MARK_READY,
        entityType: 'milestone',
        entityId:   milestone.id,
        payload:    {
          beforeStatus: 'defining',
          afterStatus:  'ready',
          contentHash,
          manifestSize: manifest.length,
        },
      }).catch(console.error)

      return {
        status: 'ready' as const,
        contentHash,
        manifest: sortedManifest,
      }
    }),

  // ---- retryAnchor (mutation) ----
  // Phase 23 D-15: re-emit milestone.ready for a milestone stuck in 'anchoring' state.
  // Safe + idempotent — the Inngest function has concurrency key + Blockfrost metadata
  // pre-check to prevent double-anchor.
  retryAnchor: requirePermission('milestone:manage')
    .input(z.object({ milestoneId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const milestone = await loadMilestone(input.milestoneId)
      if (milestone.status !== 'anchoring') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Cannot retry anchor: milestone status is '${milestone.status}', expected 'anchoring'`,
        })
      }

      await sendMilestoneReady({
        milestoneId: milestone.id,
        documentId:  milestone.documentId,
        contentHash: milestone.contentHash!,
        title:       milestone.title,
      })

      writeAuditLog({
        actorId:    ctx.user.id,
        actorRole:  ctx.user.role,
        action:     ACTIONS.MILESTONE_ANCHOR_START,
        entityType: 'milestone',
        entityId:   milestone.id,
        payload:    { trigger: 'retryAnchor' },
      }).catch(console.error)

      return { status: 'retrying' as const }
    }),
})
