import { eq } from 'drizzle-orm'
import { NonRetriableError } from 'inngest'
import { inngest } from '../client'
import { versionPublishedEvent } from '../events'
import { db } from '@/src/db'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { hashPolicyVersion } from '@/src/lib/hashing'
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

      return { contentHash, versionId: version.id }
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

    if (confirmed) {
      await step.run('persist-anchor', async () => {
        await db
          .update(documentVersions)
          .set({
            txHash,
            anchoredAt: new Date(),
          })
          .where(eq(documentVersions.id, hashData.versionId))
      })
    }

    return { versionId: hashData.versionId, txHash, confirmed }
  },
)
