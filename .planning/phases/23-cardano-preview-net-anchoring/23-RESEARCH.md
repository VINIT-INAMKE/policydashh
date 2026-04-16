# Phase 23: Cardano Preview-Net Anchoring - Research

**Researched:** 2026-04-16
**Domain:** Cardano blockchain anchoring via Mesh SDK + Blockfrost; Inngest 5-step pipeline; Drizzle ORM schema extension
**Confidence:** MEDIUM (Mesh SDK is beta-only at 1.9.0-beta.102; patterns verified against official docs + npm)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Wallet loaded from `CARDANO_WALLET_MNEMONIC` env var (24-word seed phrase). Mesh SDK derives signing keys at runtime. User provides a funded preview-net wallet (Nami/Eternl/Lace).

**D-02:** Blockfrost access via single `BLOCKFROST_PROJECT_ID` env var. Mesh SDK's `BlockfrostProvider` accepts this directly. Free tier (50k daily requests) is sufficient.

**D-03:** `src/lib/cardano.ts` uses `import 'server-only'` guard. Env vars validated via `requireEnv()` inside each exported function (fail at use, not import). Matches Groq pattern in `src/lib/llm.ts`.

**D-04:** Network hardcoded to `preview` in `src/lib/cardano.ts`. No `CARDANO_NETWORK` env var — mainnet would be its own phase with audit requirements.

**D-05:** `markReady` tRPC mutation (existing in `src/server/routers/milestone.ts`) is extended to emit a new `milestone.ready` Inngest event after flipping status to `ready`. `milestoneReadyFn` runs the 5-step pipeline: compute-hash → persist-hash → check-existing-tx → submit-tx → confirm-loop.

**D-06:** Per-version anchoring fans out from the existing `version.published` event. A new `versionAnchorFn` triggers on the same event alongside `consultationSummaryGenerateFn`. No new event schema needed.

**D-07:** Cardano tx metadata follows CIP-10 label 674 with exactly `{ project: 'policydash', type: 'milestone'|'version', hash, milestoneId|versionId, timestamp }`. No additional context fields.

**D-08:** Global wallet concurrency lock: `concurrency: { key: 'cardano-wallet', limit: 1 }` on both Inngest functions. One Cardano tx at a time across all entity types to prevent UTxO contention.

**D-09:** Verified badges appear in three locations on the public portal: (1) next to version label in `PublicVersionSelector`, (2) on the policy detail header for the currently-viewed version, (3) in a new milestone verification section. Claude has discretion on exact placement optimization.

**D-10:** Badge click opens `https://preview.cardanoscan.io/transaction/{txHash}` in a new tab. Direct link, no tooltip preview.

**D-11:** No badge shown for unanchored versions/milestones. Verified badge only appears after `anchored` status is confirmed.

**D-12:** Admin milestone detail page (`milestone-detail-header.tsx`) also shows the Cardanoscan link and tx hash when status is `anchored`.

**D-13:** Inngest built-in retry policy handles transient Blockfrost failures (exponential backoff, default ~4 retries). No custom retry loop inside the function.

**D-14:** On permanent failure (all retries exhausted), emit a `notification.create` event to the admin who triggered `markReady`. Uses existing notification dispatch pipeline. Milestone stays in `anchoring` state.

**D-15:** Admin sees a "Retry Anchor" button on the milestone detail page when status is stuck at `anchoring`. Button re-emits the `milestone.ready` event to restart the pipeline.

### Claude's Discretion

- DB migration shape for `txHash` and `anchoredAt` columns on milestones table + per-version anchor storage (new columns on `documentVersions` or a separate `cardanoAnchors` table)
- Exact Mesh SDK import pattern and tx builder API usage
- `confirm-loop` polling interval and max attempts within Inngest step boundaries
- Shield icon choice and badge color for Verified State (should fit policy-grade theme: white/slate/saffron-teal)
- Whether per-version anchor needs its own `txHash` column on `documentVersions` or a shared anchors table
- Test strategy (unit tests for cardano.ts, Inngest function tests with mocked Blockfrost)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VERIFY-06 | `milestoneReady` Inngest fn anchors milestone state to Cardano preview-net via Mesh SDK + Blockfrost in 5 steps (compute-hash → persist-hash → check-existing-tx → submit-tx → confirm-loop) | Mesh SDK MeshTxBuilder + BlockfrostProvider patterns documented; Inngest step.sleep polling loop confirmed |
| VERIFY-07 | Every `version.published` event triggers a per-version Cardano anchor tx | Fan-out pattern from existing `consultationSummaryGenerateFn`; same trigger event confirmed viable |
| VERIFY-08 | Cardano anchor fn is idempotent (DB unique constraint on hash + Blockfrost metadata-label pre-check + `concurrency: { key: 'cardano-wallet', limit: 1 }`) | Blockfrost `/metadata/txs/labels/{label}` endpoint confirmed; Inngest concurrency key pattern verified |
| VERIFY-09 | Public `/portal` displays Verified State badges with Cardanoscan preview-net explorer links on anchored versions and milestones | Badge integration points mapped; portal query extension pattern documented |
</phase_requirements>

---

## Summary

Phase 23 anchors SHA256 hashes of published policy versions and completed milestones to Cardano preview-net. The technical stack is Mesh SDK (`@meshsdk/core` + `@meshsdk/wallet`) for transaction construction/signing, Blockfrost as the provider/submitter, and two Inngest functions (`milestoneReadyFn` + `versionAnchorFn`) orchestrating the pipeline via durable steps.

The core implementation challenge is the 5-step Inngest pipeline: compute-hash (reuses Phase 22 `hashMilestone`/`hashPolicyVersion`), persist-hash (status → `anchoring`, store hash), check-existing-tx (Blockfrost metadata label scan to prevent double-anchor), submit-tx (Mesh SDK build/sign/submit), confirm-loop (step.sleep polling until block inclusion). The confirm-loop is the novel pattern — Inngest sleeps between polls so no compute is consumed, but the memoization model means the loop counter must increment within each `step.run` iteration.

DB work is a single migration: add `txHash text` and `anchored_at timestamptz` columns to `milestones`, and either add the same to `document_versions` or create a `cardano_anchors` shared table. Research recommends adding columns directly to each table for query simplicity (no join required for badge queries).

**Primary recommendation:** Use `@meshsdk/core@1.9.0-beta.102` + `@meshsdk/wallet@2.0.0-beta.8` (current `latest` dist-tag). These are beta-only but are the published `latest`. The API surface for `BlockfrostProvider`, `MeshTxBuilder`, and `MeshCardanoHeadlessWallet.fromMnemonic()` is stable within the beta series and actively used by the Cardano dev community.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@meshsdk/core` | 1.9.0-beta.102 (latest) | Cardano tx builder, BlockfrostProvider, MeshTxBuilder | Official Mesh SDK; TypeScript-first, no WASM in the CST variant |
| `@meshsdk/wallet` | 2.0.0-beta.8 (latest) | Server-side headless wallet, MeshCardanoHeadlessWallet | New split-package API; `MeshWallet` from core is legacy |
| `@blockfrost/blockfrost-js` | 6.1.1 | Optional: direct Blockfrost REST calls for metadata label scan | Needed if Mesh's BlockfrostProvider doesn't expose metadata query methods |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `server-only` | 0.0.1 (already installed) | Next.js server boundary guard | Add `import 'server-only'` at top of `src/lib/cardano.ts` |
| `inngest` | 4.2.1 (already installed) | Durable step functions, concurrency keys, step.sleep | Already in project — no upgrade needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@meshsdk/core` (CST) | `@meshsdk/core-csl` (WASM) | CSL is faster but requires WASM polyfills; CST is pure JS, better for serverless |
| Columns on existing tables | Separate `cardano_anchors` table | Joins required for badge queries; direct columns are simpler at current scale |
| `@blockfrost/blockfrost-js` for metadata scan | Mesh BlockfrostProvider internal fetch | Mesh may not expose `metadataTxsLabel`; direct SDK gives typed access to pagination |

**Installation:**
```bash
npm install @meshsdk/core @meshsdk/wallet
# If Mesh's BlockfrostProvider doesn't expose metadataTxsLabel:
npm install @blockfrost/blockfrost-js
```

**Version verification (run before writing):**
```bash
npm view @meshsdk/core version        # 1.9.0-beta.102 confirmed 2026-04-16
npm view @meshsdk/wallet version      # 2.0.0-beta.8 confirmed 2026-04-16
npm view @blockfrost/blockfrost-js version  # 6.1.1 confirmed 2026-04-16
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── cardano.ts          # server-only Cardano wrapper: wallet init, buildAnchorTx, checkExistingTx
├── inngest/
│   ├── events.ts           # add milestoneReadyEvent + sendMilestoneReady
│   └── functions/
│       ├── milestone-ready.ts      # 5-step milestoneReadyFn
│       ├── version-anchor.ts       # 2-step versionAnchorFn (fan-out on version.published)
│       └── index.ts                # register both new functions
├── db/
│   └── schema/
│       └── milestones.ts           # add txHash + anchoredAt columns
├── server/
│   └── routers/
│       └── milestone.ts            # extend markReady + add retryAnchor mutation
└── db/migrations/
    └── 0015_cardano_anchoring.sql  # txHash + anchoredAt on milestones + document_versions
```

### Pattern 1: `src/lib/cardano.ts` Module Shape

Mirrors `src/lib/llm.ts` exactly: lazy init, `requireEnv`, `import 'server-only'`.

**What:** Exports three functions: `getWallet()` (lazy-init headless wallet), `buildAndSubmitAnchorTx(hash, metadata)`, `checkExistingAnchorTx(contentHash)`.

**When to use:** Called only from inside Inngest `step.run()` bodies.

```typescript
// Source: meshjs.dev/apis/wallets/meshwallet + meshjs.dev/providers/blockfrost
import 'server-only'
import { BlockfrostProvider, MeshTxBuilder } from '@meshsdk/core'
import { MeshCardanoHeadlessWallet, AddressType } from '@meshsdk/wallet'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

let _provider: BlockfrostProvider | null = null
let _wallet: MeshCardanoHeadlessWallet | null = null

function getProvider(): BlockfrostProvider {
  if (!_provider) {
    _provider = new BlockfrostProvider(requireEnv('BLOCKFROST_PROJECT_ID'))
  }
  return _provider
}

// NOTE: getWallet is async because MeshCardanoHeadlessWallet.fromMnemonic is async
export async function getWallet(): Promise<MeshCardanoHeadlessWallet> {
  if (!_wallet) {
    const mnemonic = requireEnv('CARDANO_WALLET_MNEMONIC').split(' ')
    const provider = getProvider()
    _wallet = await MeshCardanoHeadlessWallet.fromMnemonic({
      networkId: 0,           // 0 = testnet (preview is testnet)
      walletAddressType: AddressType.Base,
      fetcher: provider,
      submitter: provider,
      mnemonic,
    })
  }
  return _wallet
}
```

**IMPORTANT PITFALL:** Wallet init is async. Unlike the Groq client (sync constructor), `MeshCardanoHeadlessWallet.fromMnemonic()` returns a Promise. The lazy `_wallet` pattern must use `await` at init time. Do NOT call `getWallet()` at module load time — it must be called inside `step.run()` to keep Inngest step boundaries clean.

### Pattern 2: Inngest 5-Step `milestoneReadyFn`

```typescript
// Source: consultation-summary-generate.ts (established project pattern)
export const milestoneReadyFn = inngest.createFunction(
  {
    id: 'milestone-ready',
    name: 'Milestone ready — Cardano anchor',
    retries: 4,  // D-13: Inngest built-in retry handles Blockfrost failures
    concurrency: { key: 'cardano-wallet', limit: 1 },  // D-08: one tx at a time
    triggers: [{ event: milestoneReadyEvent }],
  },
  async ({ event, step }) => {
    const { milestoneId, triggeredBy } = event.data

    // Step 1: compute-hash (re-derive from DB, do not trust event payload)
    const hashData = await step.run('compute-hash', async () => { ... })

    // Step 2: persist-hash (status: 'anchoring', store contentHash)
    await step.run('persist-hash', async () => { ... })

    // Step 3: check-existing-tx (Blockfrost label scan for idempotency)
    const existing = await step.run('check-existing-tx', async () => {
      return await checkExistingAnchorTx(hashData.contentHash)
      // Returns { txHash: string } if found, null otherwise
    })

    // Step 4: submit-tx (build+sign+submit via Mesh SDK — skip if existing)
    const txHash = await step.run('submit-tx', async () => {
      if (existing) return existing.txHash
      return await buildAndSubmitAnchorTx(hashData.contentHash, {
        project: 'policydash',
        type: 'milestone',
        hash: hashData.contentHash,
        milestoneId,
        timestamp: new Date().toISOString(),
      })
    })

    // Step 5: confirm-loop (poll until confirmed)
    let confirmed = false
    let attempts = 0
    const MAX_ATTEMPTS = 20  // 20 * 30s = 10 minutes max
    while (!confirmed && attempts < MAX_ATTEMPTS) {
      confirmed = await step.run(`confirm-poll-${attempts}`, async () => {
        return await isTxConfirmed(txHash)
      })
      if (!confirmed) {
        await step.sleep(`confirm-sleep-${attempts}`, '30s')
      }
      attempts++
    }

    // Final: persist txHash + anchoredAt, flip status to 'anchored'
    await step.run('finalize', async () => { ... })

    return { milestoneId, txHash, confirmed }
  },
)
```

**Critical loop pattern note:** The `attempts` variable increments outside `step.run()`. Inngest re-executes the handler from the top on each step resumption; memoized steps return cached values but non-memoized code re-runs. The loop counter must not be inside a step — it acts as a replay counter, incrementing each re-execution to generate unique step IDs (`confirm-poll-0`, `confirm-poll-1`, etc.).

### Pattern 3: Blockfrost Metadata Label Scan for Idempotency

The `check-existing-tx` step must call Blockfrost's `GET /metadata/txs/labels/{label}` and scan for a tx whose `json_metadata` contains the target `hash`. This is the pre-check for VERIFY-08.

```typescript
// Using @blockfrost/blockfrost-js for typed access
import { BlockFrostAPI } from '@blockfrost/blockfrost-js'

// Base URL for preview: https://cardano-preview.blockfrost.io/api/v0
// BLOCKFROST_PROJECT_ID must start with 'preview' prefix
const api = new BlockFrostAPI({ projectId: process.env.BLOCKFROST_PROJECT_ID! })

async function checkExistingAnchorTx(contentHash: string): Promise<string | null> {
  let page = 1
  while (true) {
    const results = await api.metadataTxsLabel('674', { page, count: 100, order: 'desc' })
    if (results.length === 0) break
    for (const item of results) {
      const meta = item.json_metadata as Record<string, unknown> | null
      if (meta && typeof meta === 'object' && meta.hash === contentHash) {
        return item.tx_hash
      }
    }
    if (results.length < 100) break
    page++
  }
  return null
}
```

**Pagination note:** Blockfrost returns max 100 per page. For the scope of policydash (low tx volume), one page is sufficient in practice. Include pagination loop as shown to be correct.

**IMPORTANT:** The `BLOCKFROST_PROJECT_ID` for preview-net must start with `preview` (e.g., `previewXXXXXXXX`). The BlockFrostAPI constructor routes to `https://cardano-preview.blockfrost.io/api/v0` automatically based on the project ID prefix. Alternatively, pass `customBackend: 'https://cardano-preview.blockfrost.io/api/v0'` explicitly.

### Pattern 4: CIP-10 Label 674 Metadata Constraints

CIP-20 defines label 674 as having a `msg` key with an array of strings. For policydash, the metadata does NOT use the `msg` key — it uses custom keys (`project`, `type`, `hash`, `milestoneId`/`versionId`, `timestamp`). This is valid: label 674 is a registry entry under CIP-10, not a schema enforcer. Custom JSON keys are permitted.

**Cardano metadata string limit:** Each string value must be <= 64 bytes UTF-8. The SHA256 hex is exactly 64 bytes. The timestamp ISO string is ~24 bytes. UUID is 36 bytes. All fit within limits.

```typescript
// Metadata payload shape — all values fit 64-byte string limit
const metadata = {
  project: 'policydash',           // 10 bytes ✓
  type: 'milestone' | 'version',   // 9/7 bytes ✓
  hash: contentHash,               // exactly 64 bytes ✓ (SHA256 hex)
  milestoneId: milestoneId,        // 36 bytes (UUID) ✓
  timestamp: new Date().toISOString(), // ~24 bytes ✓
}

// MeshTxBuilder usage:
txBuilder.metadataValue('674', metadata)
```

### Pattern 5: DB Schema Extension

Recommendation: add columns directly to `milestones` and `document_versions` tables (not a shared `cardano_anchors` table). Badge queries on the public portal can select `txHash` from the version row without a join.

```sql
-- migration 0015_cardano_anchoring.sql (idempotent pattern from 0014)
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS tx_hash text;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS anchored_at timestamptz;
ALTER TABLE milestones ADD CONSTRAINT chk_tx_hash_format
  CHECK (tx_hash IS NULL OR tx_hash ~ '^[0-9a-f]{64}$');

ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS tx_hash text;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS anchored_at timestamptz;

-- UNIQUE constraints for idempotency (VERIFY-08 layer 1)
-- Use DO block because ADD CONSTRAINT does not support IF NOT EXISTS
DO $$ BEGIN
  ALTER TABLE milestones ADD CONSTRAINT milestones_tx_hash_unique UNIQUE (tx_hash);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE document_versions ADD CONSTRAINT document_versions_tx_hash_unique UNIQUE (tx_hash);
EXCEPTION WHEN duplicate_object THEN null; END $$;
```

**Drizzle schema additions:**
```typescript
// milestones.ts additions
txHash:     text('tx_hash'),
anchoredAt: timestamp('anchored_at', { withTimezone: true }),
// + unique() constraint in table definition (t) => [...existing, unique().on(t.txHash)]
```

### Anti-Patterns to Avoid

- **Building wallet at import time:** `getWallet()` is async; calling it at module load causes Inngest serialization failures. Always call inside `step.run()`.
- **Trusting event.data.contentHash directly:** Re-derive the hash from DB in `compute-hash` step. The event payload could be stale on a retry.
- **Using `step.sleep` without incrementing the step ID:** If the poll loop reuses a fixed step ID like `confirm-sleep`, Inngest memoizes the first sleep and replays it with zero delay on subsequent iterations. Each sleep must have a unique ID: `confirm-sleep-${attempts}`.
- **Calling Blockfrost outside `step.run()`:** All network calls must be inside step boundaries for memoization and retries to work correctly.
- **Not resetting `_wallet` when env var changes:** Unlike the Groq client pattern, add the same cache-reset guard: if `BLOCKFROST_PROJECT_ID` is unset, clear cached provider/wallet.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cardano tx building | Custom CBOR serialization | Mesh SDK `MeshTxBuilder` | Fee calculation, UTXO selection, change outputs are complex protocol logic |
| Wallet signing | Direct Ed25519 key derivation | `MeshCardanoHeadlessWallet.fromMnemonic()` | BIP39 + BIP32 derivation path has many edge cases |
| Tx submission | Raw HTTP to Blockfrost | `provider.submitTx()` or `wallet.submitTx()` | Handles binary encoding, headers, error mapping |
| Tx confirmation | Custom polling with setTimeout | Inngest `step.sleep` loop | Inngest pauses execution without consuming compute; retries on failure |
| Metadata label scan | Parse Blockfrost webhook | `api.metadataTxsLabel('674', ...)` pagination loop | Typed SDK handles auth headers, pagination, error responses |

**Key insight:** Cardano transactions involve CBOR encoding, protocol parameter fetching (min fee, UTXO), and address derivation — none of which should be done manually. Mesh SDK has been vetted for correctness by the Cardano community.

---

## Common Pitfalls

### Pitfall 1: Async Wallet Initialization in Inngest
**What goes wrong:** `getWallet()` returns a Promise. If cached `_wallet` is initialized outside a `step.run()`, Inngest may re-execute the handler before the Promise resolves, creating race conditions.
**Why it happens:** Inngest's memoization model re-runs the handler function from the top on every step resume. Module-level `await` is not safe.
**How to avoid:** Always call `await getWallet()` inside `step.run()`. The cache (`_wallet`) is process-level, so it will be populated on the first call within a given worker process, but the lazy init via `step.run` ensures it's safely serialized.
**Warning signs:** `TypeError: wallet is null` or `Cannot read properties of undefined` inside step functions.

### Pitfall 2: Inngest Loop Counter Re-Execution
**What goes wrong:** The `confirm-loop` counter variable lives outside `step.run()`. On each Inngest replay, the handler runs from the top and the counter resets to 0. Completed steps (poll-0, poll-1...) are memoized and return instantly, so the loop counter naturally increments by replaying through memoized steps.
**Why it happens:** This is how Inngest memoization works — the handler re-runs but steps return cached results.
**How to avoid:** This is correct behavior — just ensure each step ID includes the counter (`confirm-poll-${attempts}`) so new iterations get new step IDs. Do NOT put the counter inside a step.
**Warning signs:** If all polls return the same cached result, you likely reused a fixed step ID.

### Pitfall 3: BLOCKFROST_PROJECT_ID Network Mismatch
**What goes wrong:** Using a `mainnet`-prefixed project ID routes to mainnet, not preview. Tx submission succeeds but anchors to the wrong network. Cardanoscan preview links will not find the tx.
**Why it happens:** Blockfrost routes based on project ID prefix: `previewXXX` → preview, `mainnetXXX` → mainnet.
**How to avoid:** Validate project ID prefix in `requireEnv` wrapper:
```typescript
const projectId = requireEnv('BLOCKFROST_PROJECT_ID')
if (!projectId.startsWith('preview')) {
  throw new Error('BLOCKFROST_PROJECT_ID must start with "preview" for Phase 23')
}
```
**Warning signs:** Submitted txHash resolves on cardanoscan.io but not preview.cardanoscan.io.

### Pitfall 4: Metadata String > 64 bytes
**What goes wrong:** Cardano tx metadata enforces a 64-byte limit per string. A value exceeding this causes the transaction to be rejected by the node.
**Why it happens:** CIP-10 metadata is encoded as CBOR text with a max of 64 bytes.
**How to avoid:** SHA256 hex = exactly 64 chars = 64 bytes (ASCII). UUID = 36 bytes. ISO timestamp ~= 24 bytes. `'policydash'` = 10 bytes. All fit. Do NOT add longer string fields.
**Warning signs:** Blockfrost returns a 400 error with "metadata value exceeds size limit".

### Pitfall 5: Double Anchor on Redeploy Without Pre-Check
**What goes wrong:** After a redeploy, the Inngest function's `persist-hash` step is memoized, but `submit-tx` runs again if the worker cache is empty, submitting a second tx for the same hash.
**Why it happens:** Inngest memoizes within a single function run, not across function runs. A new invocation after redeploy starts fresh.
**How to avoid:** The `check-existing-tx` step (step 3) queries Blockfrost before submission. If a tx with the same `hash` in metadata label 674 is found, reuse the existing `txHash` and skip submission. This is VERIFY-08's Blockfrost pre-check layer.
**Warning signs:** `milestones.tx_hash UNIQUE` constraint violation on the final `finalize` step.

### Pitfall 6: Version Anchor Fan-Out Blocks Consultation Summary
**What goes wrong:** Both `consultationSummaryGenerateFn` and `versionAnchorFn` trigger on `version.published`. If `versionAnchorFn`'s `concurrency: { key: 'cardano-wallet', limit: 1 }` lock causes delays, it may appear to block consultation summary generation.
**Why it happens:** The two functions have separate concurrency keys (`cardano-wallet` vs `groq-summary`). They run independently.
**How to avoid:** This is not actually a conflict — different concurrency keys don't interact. Document this clearly in code comments (mirrors Phase 21 Pitfall 4 note in `consultation-summary-generate.ts`).
**Warning signs:** False reports of consultation summary timeouts correlated with Cardano anchoring.

---

## Code Examples

### Complete Anchor Transaction Build + Submit

```typescript
// Source: meshjs.dev/guides/minting-on-nodejs + meshjs.dev/providers/blockfrost
export async function buildAndSubmitAnchorTx(
  contentHash: string,
  metadata: {
    project: string
    type: 'milestone' | 'version'
    hash: string
    milestoneId?: string
    versionId?: string
    timestamp: string
  },
): Promise<string> {
  const wallet = await getWallet()
  const provider = getProvider()

  const walletAddress = await wallet.getChangeAddressBech32()
  const utxos = await wallet.getUtxos()

  const txBuilder = new MeshTxBuilder({ fetcher: provider })
  const unsignedTx = await txBuilder
    .txOut(walletAddress, [{ unit: 'lovelace', quantity: '1500000' }]) // min ADA output
    .metadataValue('674', metadata)
    .changeAddress(walletAddress)
    .selectUtxosFrom(utxos)
    .complete()

  const signedTx = await wallet.signTx(unsignedTx, false)
  const txHash = await wallet.submitTx(signedTx)
  return txHash
}
```

### Blockfrost Metadata Label Scan

```typescript
// Source: github.com/blockfrost/blockfrost-js + Blockfrost API docs
import { BlockFrostAPI } from '@blockfrost/blockfrost-js'

export async function checkExistingAnchorTx(contentHash: string): Promise<string | null> {
  const api = new BlockFrostAPI({ projectId: requireEnv('BLOCKFROST_PROJECT_ID') })
  let page = 1
  while (true) {
    const results = await api.metadataTxsLabel('674', { page, count: 100, order: 'desc' })
    if (!results || results.length === 0) break
    for (const item of results) {
      const meta = item.json_metadata as Record<string, unknown> | null
      if (meta && meta.hash === contentHash && meta.project === 'policydash') {
        return item.tx_hash
      }
    }
    if (results.length < 100) break
    page++
  }
  return null
}
```

### Tx Confirmation Poll

```typescript
// Source: meshjs.dev/providers/blockfrost (fetchTxInfo returns confirmed tx details)
export async function isTxConfirmed(txHash: string): Promise<boolean> {
  const provider = getProvider()
  try {
    const txInfo = await provider.fetchTxInfo(txHash)
    // fetchTxInfo throws/returns null for unconfirmed; returns data when confirmed
    return txInfo !== null && txInfo !== undefined
  } catch {
    return false  // 404 = not yet confirmed
  }
}
```

### `milestone.ready` Event in `events.ts`

```typescript
// Pattern: exactly matches other events in src/inngest/events.ts
const milestoneReadySchema = z.object({
  milestoneId:  z.guid(),
  triggeredBy:  z.guid(),  // admin userId who called markReady
  documentId:   z.guid(),
})

export const milestoneReadyEvent = eventType('milestone.ready', {
  schema: milestoneReadySchema,
})

export type MilestoneReadyData = z.infer<typeof milestoneReadySchema>

export async function sendMilestoneReady(data: MilestoneReadyData): Promise<void> {
  const event = milestoneReadyEvent.create(data)
  await event.validate()
  await inngest.send(event)
}
```

### `retryAnchor` tRPC Mutation Stub

```typescript
// Added to milestoneRouter alongside existing markReady
retryAnchor: requirePermission('milestone:manage')
  .input(z.object({ milestoneId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const milestone = await loadMilestone(input.milestoneId)
    if (milestone.status !== 'anchoring') {
      throw new TRPCError({ code: 'CONFLICT', message: 'Milestone is not stuck at anchoring' })
    }
    await sendMilestoneReady({
      milestoneId: input.milestoneId,
      triggeredBy: ctx.user.id,
      documentId: milestone.documentId,
    })
    return { retryQueued: true }
  }),
```

### Public Portal Badge Integration

```typescript
// In app/(public)/portal/[policyId]/page.tsx — extend versionOptions to include txHash
const versionOptions = published.map((v) => ({
  id: v.id,
  versionLabel: v.versionLabel,
  publishedAt: v.publishedAt?.toISOString() ?? new Date().toISOString(),
  txHash: (v as typeof v & { txHash?: string | null }).txHash ?? null,
  anchoredAt: (v as typeof v & { anchoredAt?: Date | null }).anchoredAt?.toISOString() ?? null,
}))
```

### Verified Badge Component

```tsx
// New component: src/components/ui/verified-anchor-badge.tsx
// Shield icon from lucide-react (ShieldCheck), policy-grade color: teal accent
import { ShieldCheck } from 'lucide-react'

interface VerifiedAnchorBadgeProps {
  txHash: string
}

export function VerifiedAnchorBadge({ txHash }: VerifiedAnchorBadgeProps) {
  return (
    <a
      href={`https://preview.cardanoscan.io/transaction/${txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-teal-200 hover:bg-teal-100"
    >
      <ShieldCheck className="size-3" aria-hidden="true" />
      Verified on-chain
    </a>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `MeshWallet` from `@meshsdk/core` | `MeshCardanoHeadlessWallet` from `@meshsdk/wallet` | Mesh SDK 1.9.x series | Different import path; new factory `fromMnemonic()` is async |
| `AppWallet` (legacy) | `MeshCardanoHeadlessWallet` | Mesh SDK ~1.7.x | AppWallet is fully deprecated; do not use |
| `BlockfrostProvider` with `customNetworkId` param | Project ID prefix determines network | Current | Simpler: project ID `previewXXX` auto-routes to preview |

**Deprecated/outdated:**
- `AppWallet`: Legacy Mesh SDK wallet class, do not import or use
- `MeshWallet` from `@meshsdk/core`: Superseded by `MeshCardanoHeadlessWallet` from `@meshsdk/wallet` in the 1.9.x refactor
- Direct `inngest.createFunction` without `triggers` array: Old syntax; use `triggers: [{ event: eventType }]` as established in project

---

## Open Questions

1. **Does `BlockfrostProvider.fetchTxInfo()` throw a 404 or return null for unconfirmed transactions?**
   - What we know: Docs say "retrieve details of a confirmed transaction" implying it fails/throws for unconfirmed
   - What's unclear: Whether the throw is a network error, 404, or null return
   - Recommendation: Wrap in try/catch and treat any error as "not yet confirmed" (safest approach documented in code examples above)

2. **Does Mesh SDK's `BlockfrostProvider` expose `metadataTxsLabel` directly?**
   - What we know: Mesh's BlockfrostProvider wraps Blockfrost but primarily exposes wallet/tx provider interface
   - What's unclear: Whether the provider has a `fetchMetadataByLabel` method or only the generic `@blockfrost/blockfrost-js` has it
   - Recommendation: Install `@blockfrost/blockfrost-js` as a fallback for metadata queries; it's the official JS SDK and exposes `metadataTxsLabel` directly. Using both packages for different responsibilities is fine (Mesh for tx build/sign/submit; Blockfrost JS for metadata queries).

3. **Minimum ADA required for a pure metadata transaction on preview-net**
   - What we know: ~1.5 ADA (1,500,000 lovelace) is the typical minimum for a tx output to the wallet's own change address
   - What's unclear: Exact protocol minimum varies with UTXO parameters; a single-output tx to self with metadata may require slightly more
   - Recommendation: Use 2,000,000 lovelace (2 ADA) as the change output to be safe; Mesh handles fee calculation automatically

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@meshsdk/core` | Cardano tx building | ✗ (not installed) | — | No fallback — must install |
| `@meshsdk/wallet` | Server-side wallet | ✗ (not installed) | — | No fallback — must install |
| `@blockfrost/blockfrost-js` | Metadata label scan | ✗ (not installed) | — | Possible to hand-roll fetch, but not recommended |
| `BLOCKFROST_PROJECT_ID` env var | Blockfrost provider | User-provided | — | None — blocking; user must create project at blockfrost.io |
| `CARDANO_WALLET_MNEMONIC` env var | Wallet signing | User-provided | — | None — blocking; user must export 24-word phrase from funded wallet |
| Preview-net funded wallet | tx fees | User-provided | — | Get tADA from faucet.preview.world.dev.cardano.org |
| Node.js | @meshsdk/core runtime | ✓ | 20+ | — |

**Missing dependencies with no fallback:**
- `BLOCKFROST_PROJECT_ID`: User must create a Blockfrost account, create a preview-net project (ID starts with `preview`), and set the env var. Free tier (50k requests/day) is sufficient.
- `CARDANO_WALLET_MNEMONIC`: User must export the 24-word mnemonic from a Nami/Eternl/Lace wallet that has preview-net tADA. Obtain tADA from: https://faucet.preview.world.dev.cardano.org/ or https://docs.cardano.org/cardano-testnets/tools/faucet

**Missing dependencies with fallback:**
- npm packages: Install via `npm install @meshsdk/core @meshsdk/wallet @blockfrost/blockfrost-js` in Wave 0.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true` in config.json).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.mts` |
| Quick run command | `npm test -- --reporter=dot` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VERIFY-06 | `milestoneReadyFn` 5 steps execute in order, step IDs unique | unit (mocked Blockfrost + Mesh) | `npm test -- src/inngest/functions/milestone-ready.test.ts` | ❌ Wave 0 |
| VERIFY-06 | `buildAndSubmitAnchorTx` builds correct metadata and returns txHash | unit (mocked provider) | `npm test -- src/lib/cardano.test.ts` | ❌ Wave 0 |
| VERIFY-07 | `versionAnchorFn` triggers on `version.published`, runs anchor pipeline | unit (mocked Blockfrost + Mesh) | `npm test -- src/inngest/functions/version-anchor.test.ts` | ❌ Wave 0 |
| VERIFY-08 | `checkExistingAnchorTx` returns txHash when matching hash found in label 674 | unit (mocked Blockfrost metadata response) | `npm test -- src/lib/cardano.test.ts` | ❌ Wave 0 |
| VERIFY-08 | `milestoneReadyFn` skips `submit-tx` when `check-existing-tx` returns a txHash | unit | `npm test -- src/inngest/functions/milestone-ready.test.ts` | ❌ Wave 0 |
| VERIFY-09 | `VerifiedAnchorBadge` renders with correct link, hidden when txHash is null | unit (React Testing Library) | `npm test -- src/components/ui/verified-anchor-badge.test.tsx` | ❌ Wave 0 |
| VERIFY-06 | `requireEnv` throws for missing `BLOCKFROST_PROJECT_ID` in `cardano.ts` | unit | `npm test -- src/lib/cardano.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --reporter=dot`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/cardano.test.ts` — covers VERIFY-06 env validation, buildAndSubmitAnchorTx, checkExistingAnchorTx
- [ ] `src/inngest/functions/milestone-ready.test.ts` — covers VERIFY-06 5-step pipeline, idempotency skip path
- [ ] `src/inngest/functions/version-anchor.test.ts` — covers VERIFY-07 fan-out trigger
- [ ] `src/components/ui/verified-anchor-badge.test.tsx` — covers VERIFY-09 badge render + link

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md (`./AGENTS.md`): "This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices."

**Key implications for Phase 23:**
- Verify Next.js 16.2.1 server component patterns before writing portal page extensions
- `app/(public)/portal/[policyId]/page.tsx` uses `export const dynamic = 'force-dynamic'` — maintain this on extended queries
- All public portal components are server components by default unless explicitly `'use client'` — `VerifiedAnchorBadge` with `<a>` tag is safe as a server component (no interactivity needed)
- `params` and `searchParams` are Promises in Next.js 16.x — already handled with `await params` in existing portal page

---

## Sources

### Primary (HIGH confidence)
- [Mesh SDK Headless Wallet](https://meshjs.dev/apis/wallets/meshwallet) — `MeshCardanoHeadlessWallet.fromMnemonic()` API, import paths, signing pattern
- [Mesh SDK Blockfrost Provider](https://meshjs.dev/providers/blockfrost) — `BlockfrostProvider` constructor, `submitTx`, `fetchTxInfo`, `onTxConfirmed`
- [Mesh SDK Node.js Minting Guide](https://meshjs.dev/guides/minting-on-nodejs) — complete server-side 5-step pattern (provider → wallet → builder → sign → submit)
- [Inngest step.sleep docs](https://www.inngest.com/docs/reference/typescript/functions/step-sleep) — duration formats, sleep behavior
- [Inngest Working with Loops](https://www.inngest.com/docs/guides/working-with-loops) — loop pattern with memoization
- [Blockfrost dev overview](https://blockfrost.dev/overview/making-first-call) — base URLs per network, project ID prefix format
- `src/lib/llm.ts` — `requireEnv` + lazy init + `import 'server-only'` pattern (project source)
- `src/inngest/functions/consultation-summary-generate.ts` — Inngest step structure, retries, concurrency, fan-out (project source)
- `src/db/migrations/0014_milestones_hashing.sql` — migration idempotency pattern (project source)
- `src/inngest/events.ts` — `eventType()` + `sendX()` helper pattern (project source)

### Secondary (MEDIUM confidence)
- [@meshsdk/core npm dist-tags](https://www.npmjs.com/package/@meshsdk/core) — confirmed `latest: 1.9.0-beta.102` on 2026-04-16
- [@meshsdk/wallet npm version](https://www.npmjs.com/package/@meshsdk/wallet) — confirmed `2.0.0-beta.8` on 2026-04-16
- [Blockfrost JS metadataTxsLabel method](https://github.com/blockfrost/blockfrost-js) — method exists, pagination supported
- [CIP-10 metadata label registry](https://cips.cardano.org/cip/CIP-10) — label 674 registration confirmed
- [CIP-20 msg metadata format](https://cips.cardano.org/cip/CIP-20) — 64-byte string limit per metadata value

### Tertiary (LOW confidence)
- Cardano preview-net block time ~20s/slot — from Cardano docs, preview should match mainnet params
- `provider.fetchTxInfo()` throws for unconfirmed tx (inferred from "confirmed transaction" docs description; exact error shape unverified)

---

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — `@meshsdk/core` + `@meshsdk/wallet` are beta-only (no stable release); API surface verified against official docs but may shift between beta iterations
- Architecture: HIGH — patterns derived from existing project code (`llm.ts`, `consultation-summary-generate.ts`, migration files) which are proven working
- Pitfalls: HIGH — loop counter pitfall verified from Inngest memoization documentation; network routing pitfall from Blockfrost docs

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (30 days) — Mesh SDK beta may release stable; re-verify npm versions before implementation
