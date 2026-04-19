import { eq } from 'drizzle-orm'
import { NonRetriableError } from 'inngest'
import { inngest } from '../client'
import { versionPublishedEvent, sendNotificationCreate } from '../events'
import { db } from '@/src/db'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { users } from '@/src/db/schema/users'
import { hashPolicyVersion } from '@/src/lib/hashing'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import {
  buildAndSubmitAnchorTx,
  checkExistingAnchorTx,
  isTxConfirmed,
} from '@/src/lib/cardano'

/**
 * versionAnchorFn -- Per-version Cardano anchor triggered by version.published.
 *
 * VERIFY-07: Every published version gets anchored on Cardano preview-net.
 * D-06:  Fans out from version.published alongside consultationSummaryGenerateFn.
 * D-07:  CIP-10 label 674 metadata with project='civilization-lab', type='version'.
 * D-08:  Concurrency key 'cardano-wallet' limit 1 prevents UTxO contention.
 * D-13:  retries: 4 for transient Blockfrost failures.
 * VERIFY-08: Blockfrost pre-check + DB UNIQUE on txHash for idempotency.
 *
 * Pipeline steps:
 *   1. compute-hash      -- load version, compute SHA256 via hashPolicyVersion
 *   2. anchor            -- Blockfrost pre-check + submit tx (or reuse existing)
 *   3. confirm-and-persist -- poll confirmation + write txHash to DB
 *   4. finalize          -- write audit event and (on timeout) send admin
 *      notification. documentVersions has no anchor-status column today, so
 *      we do NOT flip a status value here. Operators key off the audit trail
 *      (MILESTONE_ANCHOR_FAIL action reused for version) and the notification.
 *      If a dedicated `documentVersions.anchorStatus` column is added later,
 *      flip it to 'failed' alongside the audit write.
 */
export const versionAnchorFn = inngest.createFunction(
  {
    id: 'version-anchor',
    name: 'Version published -- Cardano anchor',
    retries: 4,
    concurrency: { key: 'cardano-wallet', limit: 1 },
    triggers: [{ event: versionPublishedEvent }],
  },
  async ({ event, step }) => {
    const { versionId } = event.data

    // ---- Step 1: compute-hash ----
    const hashData = await step.run('compute-hash', async () => {
      const [version] = await db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.id, versionId))
        .limit(1)

      if (!version) {
        throw new NonRetriableError('Version not found')
      }
      if (!version.isPublished) {
        throw new NonRetriableError('Version is not published')
      }
      if (version.txHash) {
        throw new NonRetriableError('Already anchored')
      }

      const contentHash = hashPolicyVersion({
        id: version.id,
        documentId: version.documentId,
        versionLabel: version.versionLabel,
        sectionsSnapshot: version.sectionsSnapshot,
        changelog: version.changelog,
        publishedAt: version.publishedAt
          ? new Date(version.publishedAt).toISOString()
          : null,
        createdBy: version.createdBy,
      })

      return {
        contentHash,
        versionId: version.id,
        documentId: version.documentId,
        createdBy: version.createdBy,
      }
    })

    // ---- Step 2: anchor ----
    // Blockfrost pre-check + submit. checkExistingAnchorTx returns string | null.
    const txHash = await step.run('anchor', async () => {
      const existingTx = await checkExistingAnchorTx(hashData.contentHash)
      if (existingTx) {
        return existingTx
      }
      return await buildAndSubmitAnchorTx(hashData.contentHash, {
        project: 'civilization-lab',
        type: 'version',
        hash: hashData.contentHash,
        versionId: hashData.versionId,
        timestamp: new Date().toISOString(),
      })
    })

    // ---- Step 3: confirm-and-persist ----
    // Same poll loop as milestone (MAX_ATTEMPTS=20, 30s sleep, unique step IDs).
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

    // ---- Step 4: finalize ----
    await step.run('finalize', async () => {
      if (confirmed) {
        await db
          .update(documentVersions)
          .set({
            txHash,
            anchoredAt: new Date(),
          })
          .where(eq(documentVersions.id, hashData.versionId))
        return
      }

      // I2: permanent failure -- tx not confirmed after MAX_ATTEMPTS * 30s = 10m.
      //
      // Write audit event so the admin audit UI and evidence pack export can
      // surface the failure.
      //
      // D20: use the dedicated VERSION_ANCHOR_FAIL action. Previously this
      // reused MILESTONE_ANCHOR_FAIL, which collapsed version + milestone
      // anchor timeouts under a single action name and broke action-scoped
      // alert rules.
      //
      // D9: resolve the actual role of the user who published the version
      // (admin OR policy_lead) from the users table at audit-write time,
      // rather than hardcoding 'admin'. Mirrors the B15 pattern.
      //
      // documentVersions today has no anchor-status column -- txHash stays
      // NULL so a subsequent run can retry cleanly. If a follow-up migration
      // adds `documentVersions.anchorStatus` (enum: pending|anchored|failed),
      // set it to 'failed' inside this step.
      const [actorRow] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, hashData.createdBy))
        .limit(1)
      const actorRole = actorRow?.role ?? 'unknown'

      await writeAuditLog({
        actorId: hashData.createdBy,
        actorRole,
        action: ACTIONS.VERSION_ANCHOR_FAIL,
        entityType: 'document_version',
        entityId: hashData.versionId,
        payload: {
          txHash,
          contentHash: hashData.contentHash,
          attempts,
          reason: 'confirmation-timeout',
        },
      })

      // Admin notification -- target the version creator who also holds the
      // 'version:manage' permission. Matches milestoneReadyFn's dispatch
      // pattern, which uses the triggering admin as the notification recipient.
      await sendNotificationCreate({
        userId: hashData.createdBy,
        // P24: dedicated notification type so the in-app panel renders the
        // correct anchor-failure icon instead of a change-request badge.
        type: 'anchoring_failed',
        title: 'Anchoring failed for version',
        body: 'Version anchoring timed out after 10 minutes. Retry from the version detail page.',
        entityType: 'document_version',
        entityId: hashData.versionId,
        createdBy: hashData.createdBy,
        action: ACTIONS.VERSION_ANCHOR_FAIL,
      })
    })

    return { versionId: hashData.versionId, txHash, confirmed }
  },
)
