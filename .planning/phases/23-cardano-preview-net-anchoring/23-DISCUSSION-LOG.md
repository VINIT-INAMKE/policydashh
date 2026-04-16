# Phase 23: Cardano Preview-Net Anchoring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 23-cardano-preview-net-anchoring
**Areas discussed:** Wallet & env config, Anchor trigger flow, Verified State badges, Failure & retry strategy

---

## Wallet & Environment Configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Mnemonic via env var | CARDANO_WALLET_MNEMONIC env var holds 24-word seed phrase. Mesh SDK derives keys at runtime. | ✓ |
| Private key hex via env var | CARDANO_SIGNING_KEY_HEX env var holds the raw Ed25519 signing key. | |
| Hardware/external signer | Sign via external API or hardware wallet bridge. | |

**User's choice:** Mnemonic via env var (recommended)
**Notes:** Simpler setup — just paste mnemonic from a preview-net wallet.

| Option | Description | Selected |
|--------|-------------|----------|
| Single env var (BLOCKFROST_PROJECT_ID) | Mesh SDK's BlockfrostProvider accepts this directly. Free tier sufficient. | ✓ |
| Blockfrost URL + key | Separate BLOCKFROST_URL and BLOCKFROST_API_KEY env vars. | |

**User's choice:** Single env var (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Fail at use | requireEnv() inside each exported function. App boots fine without config. Matches Groq pattern. | ✓ |
| Fail at import | Top-level requireEnv(). Blocks app startup without Cardano config. | |

**User's choice:** Fail at use (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcode preview-net | Phase 23 is explicitly preview-net only. Mainnet anchoring would be its own phase. | ✓ |
| Env-configurable network | CARDANO_NETWORK=preview\|mainnet env var. Future-proofs but adds risk. | |

**User's choice:** Hardcode preview-net (recommended)

---

## Anchor Trigger Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Emit milestone.ready from markReady mutation | Extend existing markReady tRPC mutation to emit Inngest event. Matches version.publish pattern. | ✓ |
| Separate admin button | New 'Anchor to Cardano' button. Extra step for admin. | |
| Auto-trigger on ready state (DB trigger) | DB trigger fires Inngest. Breaks Inngest-only automation principle. | |

**User's choice:** Emit milestone.ready from markReady mutation (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Fan out from existing version.published event | New versionAnchorFn triggers on same event alongside LLM summary. No schema changes. | ✓ |
| New version.anchoring event | Separate event for separate concerns. More explicit but adds wire changes. | |

**User's choice:** Fan out from existing event (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Stick with roadmap spec | Exactly { project, type, hash, milestoneId\|versionId, timestamp }. Minimal. | ✓ |
| Add document context | Include documentId + versionLabel in metadata. | |

**User's choice:** Stick with roadmap spec (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Global wallet lock | concurrency: { key: 'cardano-wallet', limit: 1 }. One tx at a time. | ✓ |
| Per-entity-type lock | Separate keys for milestones vs versions. Risks UTxO collision. | |

**User's choice:** Global wallet lock (recommended)

---

## Verified State Badges

| Option | Description | Selected |
|--------|-------------|----------|
| Next to version label in selector | PublicVersionSelector shows 'v1.0 ✓ Verified' with shield icon. | ✓ |
| On the policy detail header | Badge on main policy page header. | ✓ |
| Milestone section on portal | New section showing milestone verification status. | ✓ |
| You decide placement | Claude optimizes exact placement during planning. | ✓ |

**User's choice:** All four (all locations + Claude discretion on optimization)

| Option | Description | Selected |
|--------|-------------|----------|
| Direct link to tx | Badge click opens Cardanoscan in new tab. Simple, verifiable. | ✓ |
| Link with tooltip preview | Hover shows tx hash + timestamp, click opens Cardanoscan. | |

**User's choice:** Direct link to tx (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| No badge for unanchored | Only show Verified badge after anchored status confirmed. | ✓ |
| Pending badge | Show 'Anchoring...' badge with spinner while pipeline runs. | |

**User's choice:** No badge for unanchored (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — show on admin page too | Add Cardanoscan link + tx hash on milestone-detail-header when anchored. | ✓ |
| Public portal only | Only public portal shows verification badges. | |

**User's choice:** Show on admin page too (recommended)

---

## Failure & Retry Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Inngest built-in retries | Default retry policy (exponential backoff, ~4 retries). | ✓ |
| Custom retry with step.sleep | Manual retry loop inside function. Duplicates Inngest infra. | |

**User's choice:** Inngest built-in retries (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| In-app notification | Emit notification.create to admin on permanent failure. Uses existing pipeline. | ✓ |
| Email notification | Resend email to admin. Adds new template. | |
| Status only — no push notification | Admin checks detail page manually. Simplest but easy to miss. | |

**User's choice:** In-app notification (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — Retry Anchor button | Button on milestone detail page when stuck at 'anchoring'. Re-emits event. | ✓ |
| No — must re-mark-ready | Admin transitions back to 'defining' then marks ready again. | |

**User's choice:** Yes — Retry Anchor button (recommended)

---

## Claude's Discretion

- DB migration shape (txHash/anchoredAt columns vs separate anchors table)
- Mesh SDK import pattern and tx builder API
- confirm-loop polling interval and max attempts
- Shield icon and badge color within policy-grade theme
- Test strategy for cardano.ts and Inngest functions

## Deferred Ideas

None — discussion stayed within phase scope.
