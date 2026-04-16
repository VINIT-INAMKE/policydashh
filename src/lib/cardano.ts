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
let _wallet: MeshCardanoHeadlessWallet | null = null

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
 * Initialize the headless wallet from a 24-word mnemonic.
 *
 * IMPORTANT: This function is async -- NEVER call at module load time.
 * Always invoke inside an Inngest step.run() callback.
 */
export async function getWallet(): Promise<MeshCardanoHeadlessWallet> {
  if (_wallet) return _wallet
  const provider = getProvider()
  const mnemonic = requireEnv('CARDANO_WALLET_MNEMONIC').split(' ')
  _wallet = await MeshCardanoHeadlessWallet.fromMnemonic({
    networkId: 0,
    walletAddressType: AddressType.Base,
    fetcher: provider,
    submitter: provider,
    mnemonic,
  })
  return _wallet
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
 * @returns The txHash if found, null otherwise.
 */
export async function checkExistingAnchorTx(
  contentHash: string,
): Promise<string | null> {
  const projectId = requireEnv('BLOCKFROST_PROJECT_ID')
  const api = new BlockFrostAPI({ projectId })

  let page = 1
  while (true) {
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

    if (results.length < 100) break
    page++
  }

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
