import { eq } from 'drizzle-orm'
import { NonRetriableError } from 'inngest'
import { inngest } from '../client'
import { milestoneReadyEvent, sendNotificationCreate } from '../events'
import { db } from '@/src/db'
import { milestones } from '@/src/db/schema/milestones'
import type { MilestoneStatus, RequiredSlots, ManifestEntry } from '@/src/db/schema/milestones'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { workshops } from '@/src/db/schema/workshops'
import { feedbackItems } from '@/src/db/schema/feedback'
import { evidenceArtifacts } from '@/src/db/schema/evidence'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import {
  hashPolicyVersion,
  hashWorkshop,
  hashFeedbackItem,
  hashEvidenceArtifact,
  hashMilestone,
} from '@/src/lib/hashing'
import {
  buildAndSubmitAnchorTx,
  checkExistingAnchorTx,
  isTxConfirmed,
} from '@/src/lib/cardano'

/**
 * milestoneReadyFn -- 5-step Cardano anchor pipeline for milestones.
 *
 * VERIFY-06: Admin marks milestone ready -> this function anchors to Cardano.
 * D-05:  Triggered by milestone.ready Inngest event (emitted by markReady mutation).
 * D-07:  CIP-10 label 674 metadata with project='civilization-lab', type='milestone'.
 * D-08:  Concurrency key 'cardano-wallet' limit 1 prevents UTxO contention.
 * D-13:  retries: 4 for transient Blockfrost failures.
 * D-14:  Permanent failure sends admin notification via dispatch pipeline.
 * VERIFY-08: Blockfrost metadata pre-check prevents double-anchor (layer 2).
 *
 * Pipeline steps:
 *   1. compute-hash   -- re-derive contentHash from DB (don't trust event payload)
 *   2. persist-hash   -- set status='anchoring', persist hash, audit log
 *   3. check-existing-tx -- Blockfrost metadata scan for idempotency
 *   4. submit-tx      -- build + submit CIP-10 anchor tx (or reuse existing)
 *   5. confirm-loop   -- poll tx confirmation (20 attempts, 30s interval)
 *   finalize          -- persist txHash + anchoredAt or send failure notification
 */
export const milestoneReadyFn = inngest.createFunction(
  {
    id: 'milestone-ready',
    name: 'Milestone ready -- Cardano anchor',
    retries: 4,
    concurrency: { key: 'cardano-wallet', limit: 1 },
    triggers: [{ event: milestoneReadyEvent }],
  },
  async ({ event, step }) => {
    // ---- Step 1: compute-hash ----
    // Re-derive contentHash from DB data. Do NOT trust the event payload --
    // the hash must be computed server-side from the canonical source of truth.
    const hashData = await step.run('compute-hash', async () => {
      const [milestone] = await db
        .select()
        .from(milestones)
        .where(eq(milestones.id, event.data.milestoneId))
        .limit(1)

      if (!milestone) {
        throw new NonRetriableError('Milestone not found')
      }

      const status = milestone.status as MilestoneStatus
      if (status === 'anchored') {
        throw new NonRetriableError('Milestone already anchored')
      }
      if (status === 'defining') {
        throw new NonRetriableError(
          'Milestone still in defining state -- markReady has not persisted yet',
        )
      }

      // Load linked entities
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

      // Per-child hash computation -- same pattern as markReady in milestone.ts
      // Pitfall 2: Date columns must be converted to ISO strings
      const versionEntries: ManifestEntry[] = linkedVersions.map((v) => ({
        entityType: 'version' as const,
        entityId: v.id,
        contentHash: hashPolicyVersion({
          id: v.id,
          documentId: v.documentId,
          versionLabel: v.versionLabel,
          sectionsSnapshot: v.sectionsSnapshot,
          changelog: v.changelog,
          publishedAt: v.publishedAt
            ? new Date(v.publishedAt).toISOString()
            : null,
          createdBy: v.createdBy,
        }),
      }))

      const workshopEntries: ManifestEntry[] = linkedWorkshops.map((w) => ({
        entityType: 'workshop' as const,
        entityId: w.id,
        contentHash: hashWorkshop({
          id: w.id,
          title: w.title,
          scheduledAt: new Date(w.scheduledAt).toISOString(),
          durationMinutes: w.durationMinutes,
          status: w.status,
          createdBy: w.createdBy,
          linkedArtifactIds: [],
          linkedFeedbackIds: [],
        }),
      }))

      const feedbackEntries: ManifestEntry[] = linkedFeedback.map((f) => ({
        entityType: 'feedback' as const,
        entityId: f.id,
        contentHash: hashFeedbackItem({
          id: f.id,
          readableId: f.readableId,
          sectionId: f.sectionId,
          documentId: f.documentId,
          feedbackType: f.feedbackType,
          priority: f.priority,
          impactCategory: f.impactCategory,
          title: f.title,
          body: f.body,
          suggestedChange: f.suggestedChange,
          status: f.status,
          decisionRationale: f.decisionRationale,
          reviewedBy: f.reviewedBy,
          reviewedAt: f.reviewedAt
            ? new Date(f.reviewedAt).toISOString()
            : null,
          resolvedInVersionId: f.resolvedInVersionId,
          isAnonymous: f.isAnonymous,
        }),
      }))

      const evidenceEntries: ManifestEntry[] = linkedEvidence.map((e) => ({
        entityType: 'evidence' as const,
        entityId: e.id,
        contentHash: hashEvidenceArtifact({
          id: e.id,
          title: e.title,
          type: e.type,
          url: e.url,
          fileName: e.fileName,
          fileSize: e.fileSize,
          uploaderId: e.uploaderId,
          content: e.content,
        }),
      }))

      const manifest: ManifestEntry[] = [
        ...versionEntries,
        ...workshopEntries,
        ...feedbackEntries,
        ...evidenceEntries,
      ]

      const contentHash = hashMilestone({
        manifest,
        metadata: {
          milestoneId: milestone.id,
          documentId: milestone.documentId,
          title: milestone.title,
          createdAt: new Date(milestone.createdAt).toISOString(),
          requiredSlots: (milestone.requiredSlots as RequiredSlots) ?? {},
        },
      })

      return {
        contentHash,
        milestoneId: milestone.id,
        documentId: milestone.documentId,
      }
    })

    // ---- Step 2: persist-hash ----
    // Transition to 'anchoring' state and persist the re-derived hash.
    await step.run('persist-hash', async () => {
      await db
        .update(milestones)
        .set({
          status: 'anchoring',
          contentHash: hashData.contentHash,
          updatedAt: new Date(),
        })
        .where(eq(milestones.id, hashData.milestoneId))

      await writeAuditLog({
        actorId: event.data.triggeredBy,
        actorRole: 'admin',
        action: ACTIONS.MILESTONE_ANCHOR_START,
        entityType: 'milestone',
        entityId: hashData.milestoneId,
        payload: { contentHash: hashData.contentHash },
      })
    })

    // ---- Step 3: check-existing-tx ----
    // VERIFY-08 Blockfrost pre-check: scan CIP-10 label 674 metadata for
    // an existing anchor with the same hash. Returns txHash string or null.
    const existing = await step.run('check-existing-tx', async () => {
      return await checkExistingAnchorTx(hashData.contentHash)
    })

    // ---- Step 4: submit-tx ----
    // If existing is non-null, it IS the txHash string (not an object).
    // Skip submission -- idempotent. Otherwise build + submit per D-07.
    const txHash = await step.run('submit-tx', async () => {
      if (existing) {
        return existing
      }
      return await buildAndSubmitAnchorTx(hashData.contentHash, {
        project: 'civilization-lab',
        type: 'milestone',
        hash: hashData.contentHash,
        milestoneId: hashData.milestoneId,
        timestamp: new Date().toISOString(),
      })
    })

    // ---- Step 5: confirm-loop ----
    // Poll for tx confirmation. MAX_ATTEMPTS=20, 30s sleep between polls.
    // CRITICAL: Each step ID includes the attempts counter for unique Inngest
    // memoization keys. The counter lives OUTSIDE step.run (Pitfall 2).
    let confirmed = false
    let attempts = 0
    const MAX_ATTEMPTS = 20
    while (!confirmed && attempts < MAX_ATTEMPTS) {
      confirmed = await step.run(`confirm-poll-${attempts}`, async () => {
        return await isTxConfirmed(txHash)
      })
      if (!confirmed) {
        await step.sleep(`confirm-sleep-${attempts}`, '30s')
      }
      attempts++
    }

    // ---- Step: finalize ----
    const result = await step.run('finalize', async () => {
      if (confirmed) {
        await db
          .update(milestones)
          .set({
            txHash,
            anchoredAt: new Date(),
            status: 'anchored',
            updatedAt: new Date(),
          })
          .where(eq(milestones.id, hashData.milestoneId))

        await writeAuditLog({
          actorId: event.data.triggeredBy,
          actorRole: 'admin',
          action: ACTIONS.MILESTONE_ANCHOR_COMPLETE,
          entityType: 'milestone',
          entityId: hashData.milestoneId,
          payload: { txHash, contentHash: hashData.contentHash },
        })

        return { milestoneId: hashData.milestoneId, txHash, confirmed: true }
      }

      // Permanent failure -- tx not confirmed after MAX_ATTEMPTS (10 min).
      // D-14: Send admin notification via existing dispatch pipeline.
      await writeAuditLog({
        actorId: event.data.triggeredBy,
        actorRole: 'admin',
        action: ACTIONS.MILESTONE_ANCHOR_FAIL,
        entityType: 'milestone',
        entityId: hashData.milestoneId,
        payload: { txHash, contentHash: hashData.contentHash, attempts },
      })

      await sendNotificationCreate({
        userId: event.data.triggeredBy,
        type: 'cr_status_changed',
        title: 'Anchoring failed for milestone',
        body: 'Milestone anchoring timed out after 10 minutes. Use the Retry Anchor button on the milestone detail page.',
        entityType: 'milestone',
        entityId: event.data.milestoneId,
        createdBy: event.data.triggeredBy,
        action: ACTIONS.MILESTONE_ANCHOR_FAIL,
      })

      return { milestoneId: hashData.milestoneId, txHash, confirmed: false }
    })

    return result
  },
)
