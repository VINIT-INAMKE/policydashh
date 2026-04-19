import 'server-only'

/**
 * Cardano preview-net anchoring wrapper -- the ONLY sanctioned entry point
 * for on-chain operations.
 *
 * D-03: Server-only module (import 'server-only' line 1).
 * D-04: Network hardcoded to 0 (preview-net / testnet). No env var toggle.
 * D-07: CIP-10 metadata label 674 for anchor payloads.
 * VERIFY-08: Three-layer idempotency:
 *   1. DB UNIQUE on txHash (migration 0015)
 *   2. Blockfrost metadata scan (checkExistingAnchorTx)
 *   3. Inngest step.idempotencyKey (Plan 02)
 *
 * Lazy init: provider and wallet are constructed on first use, not at import
 * time. This lets Inngest step.run() control the lifecycle and prevents
 * env-var checks from firing during Next.js module graph analysis.
 */

import { NonRetriableError } from 'inngest'
import { BlockfrostProvider, MeshTxBuilder } from '@meshsdk/core'
import { MeshCardanoHeadlessWallet, AddressType } from '@meshsdk/wallet'
import { BlockFrostAPI } from '@blockfrost/blockfrost-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnchorMetadata = {
  project: string
  type: 'milestone' | 'version'
  hash: string
  milestoneId?: string
  versionId?: string
  timestamp: string
}

// ---------------------------------------------------------------------------
// Env helpers (mirror src/lib/llm.ts pattern)
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local. See .env.example.`,
    )
  }
  return value
}

// ---------------------------------------------------------------------------
// Lazy-init singletons
// ---------------------------------------------------------------------------

let _provider: BlockfrostProvider | null = null
// P25: single BlockFrostAPI instance shared across the module instead of
// being constructed per-call in `checkExistingAnchorTx`. Each fresh
// instantiation created a new HTTP connection pool AND re-validated
// BLOCKFROST_PROJECT_ID; the singleton fixes both.
let _blockfrostApi: BlockFrostAPI | null = null
let _wallet: MeshCardanoHeadlessWallet | null = null
// P5: promise-lock for wallet init so concurrent `getWallet()` awaits in
// the same process share one in-flight initialisation. Without this,
// `step.run('confirm-poll-N')` and a sibling step could both race into
// `MeshCardanoHeadlessWallet.fromMnemonic` on a cold module.
let _walletInitPromise: Promise<MeshCardanoHeadlessWallet> | null = null

function getProvider(): BlockfrostProvider {
  if (_provider) return _provider
  const projectId = requireEnv('BLOCKFROST_PROJECT_ID')
  if (!projectId.startsWith('preview')) {
    throw new Error(
      'BLOCKFROST_PROJECT_ID must start with "preview" for preview-net anchoring',
    )
  }
  _provider = new BlockfrostProvider(projectId)
  return _provider
}

/**
 * P25: singleton `BlockFrostAPI` instance. Reuses the underlying HTTP
 * connection pool across calls. Created lazily on first use.
 */
function getBlockfrostApi(): BlockFrostAPI {
  if (_blockfrostApi) return _blockfrostApi
  const projectId = requireEnv('BLOCKFROST_PROJECT_ID')
  if (!projectId.startsWith('preview')) {
    throw new Error(
      'BLOCKFROST_PROJECT_ID must start with "preview" for preview-net anchoring',
    )
  }
  _blockfrostApi = new BlockFrostAPI({ projectId })
  return _blockfrostApi
}

/**
 * Initialize the headless wallet from a 24-word mnemonic.
 *
 * IMPORTANT: This function is async -- NEVER call at module load time.
 * Always invoke inside an Inngest step.run() callback.
 *
 * P5: promise-locked so concurrent awaits reuse one in-flight init. On
 * init failure the cached promise is cleared so a subsequent call can
 * retry cleanly.
 */
export async function getWallet(): Promise<MeshCardanoHeadlessWallet> {
  if (_wallet) return _wallet
  if (_walletInitPromise) return _walletInitPromise

  _walletInitPromise = (async () => {
    const provider = getProvider()
    const mnemonic = requireEnv('CARDANO_WALLET_MNEMONIC').split(' ')
    const wallet = await MeshCardanoHeadlessWallet.fromMnemonic({
      networkId: 0,
      walletAddressType: AddressType.Base,
      fetcher: provider,
      submitter: provider,
      mnemonic,
    })
    _wallet = wallet
    return wallet
  })().catch((err) => {
    // Clear the cached promise on failure so the next caller can retry.
    _walletInitPromise = null
    throw err
  })

  return _walletInitPromise
}

/**
 * P5 / test leakage: reset the in-memory singletons. Exported for the
 * test harness; production callers never touch this.
 */
export function _resetCardanoSingletonsForTests(): void {
  _provider = null
  _blockfrostApi = null
  _wallet = null
  _walletInitPromise = null
}

// ---------------------------------------------------------------------------
// Transaction operations
// ---------------------------------------------------------------------------

/**
 * Build and submit an anchor transaction with CIP-10 label 674 metadata.
 *
 * The tx sends a minimum ADA output (1.5 ADA) back to the wallet address
 * so it remains a self-referential record on-chain. The metadata payload
 * carries the content hash, entity type, and timestamp.
 *
 * @returns The 64-char hex transaction hash.
 */
export async function buildAndSubmitAnchorTx(
  contentHash: string,
  metadata: AnchorMetadata,
): Promise<string> {
  const provider = getProvider()
  const wallet = await getWallet()

  const walletAddress = await wallet.getChangeAddress()
  const utxos = await wallet.getUtxos()

  // P7: pre-check wallet balance. Mesh's `txBuilder.complete()` throws an
  // opaque coin-selection error deep in the SDK when no UTxOs are available;
  // Inngest then retries 4 times before giving up (10+ minutes wasted on a
  // failure that's immediately diagnosable). NonRetriableError surfaces the
  // funding requirement to the admin immediately.
  if (!utxos || utxos.length === 0) {
    throw new NonRetriableError(
      `Cardano wallet has no UTxOs — fund the wallet at ${walletAddress} before retrying anchoring.`,
    )
  }

  const txBuilder = new MeshTxBuilder({ fetcher: provider })

  const unsignedTx = await txBuilder
    .txOut(walletAddress, [{ unit: 'lovelace', quantity: '1500000' }])
    .metadataValue('674', metadata)
    .changeAddress(walletAddress)
    .selectUtxosFrom(utxos as any)
    .complete()

  const signedTx = await wallet.signTx(unsignedTx, false)
  const txHash = await wallet.submitTx(signedTx)

  return txHash
}

/**
 * Scan Blockfrost metadata for an existing anchor tx matching the given
 * content hash. This is VERIFY-08 idempotency layer 2 (Blockfrost pre-check).
 *
 * Paginates through CIP-10 label 674 metadata entries in descending order,
 * looking for a matching { hash, project: 'civilization-lab' } payload.
 *
 * P6: capped at MAX_PAGES (50 pages × 100 entries = 5000 metadata items).
 * Beyond that we surface a warning and return null so the caller proceeds
 * with a submit-and-rely-on-DB-unique idempotency check. Without the cap
 * this walks every entry on a high-throughput label, burning Blockfrost
 * quota on every anchor step.
 *
 * P25: reuses the singleton BlockFrostAPI instance from `getBlockfrostApi()`
 * instead of constructing a fresh one on every call.
 *
 * @returns The txHash if found, null otherwise.
 */
const ANCHOR_SCAN_MAX_PAGES = 50

export async function checkExistingAnchorTx(
  contentHash: string,
): Promise<string | null> {
  const api = getBlockfrostApi()

  let page = 1
  while (page <= ANCHOR_SCAN_MAX_PAGES) {
    const results = await api.metadataTxsLabel('674', {
      page,
      count: 100,
      order: 'desc',
    })

    for (const item of results) {
      const meta = item.json_metadata as Record<string, unknown> | null
      if (
        meta &&
        typeof meta === 'object' &&
        meta.hash === contentHash &&
        (meta.project === 'policydash' || meta.project === 'civilization-lab')
      ) {
        return item.tx_hash
      }
    }

    if (results.length < 100) return null
    page++
  }

  // P6: cap reached. Log once and return null so callers proceed with the
  // DB-unique idempotency check. Raise ANCHOR_SCAN_MAX_PAGES deliberately
  // if this fires in production telemetry.
  console.warn(
    `[cardano.checkExistingAnchorTx] reached MAX_PAGES=${ANCHOR_SCAN_MAX_PAGES}; assuming no prior anchor for hash=${contentHash.slice(0, 12)}…`,
  )
  return null
}

/**
 * Check whether a transaction has been confirmed on-chain.
 *
 * @returns true if the tx exists in the Blockfrost ledger, false otherwise.
 */
export async function isTxConfirmed(txHash: string): Promise<boolean> {
  const provider = getProvider()
  try {
    const info = await provider.fetchTxInfo(txHash)
    return info != null
  } catch {
    return false
  }
}
