# Phase 23: Cardano Preview-Net Anchoring - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Anchor every published policy version and completed milestone to Cardano preview-net via Mesh SDK + Blockfrost. Deliver `src/lib/cardano.ts` with server-only guard, two Inngest functions (`milestoneReadyFn` 5-step pipeline + `versionAnchorFn`), DB columns for `txHash`/`anchoredAt`, and public Verified State badges linking to Cardanoscan explorer.

Out of scope:
- Mainnet anchoring (future phase with separate audit/security review)
- Hashing service changes (Phase 22 `src/lib/hashing.ts` is complete and stable)
- Milestone entity schema changes beyond adding `txHash`/`anchoredAt` columns
- New authentication or role system

</domain>

<decisions>
## Implementation Decisions

### Wallet & Environment Configuration
- **D-01:** Wallet loaded from `CARDANO_WALLET_MNEMONIC` env var (24-word seed phrase). Mesh SDK derives signing keys at runtime. User provides a funded preview-net wallet (Nami/Eternl/Lace).
- **D-02:** Blockfrost access via single `BLOCKFROST_PROJECT_ID` env var. Mesh SDK's `BlockfrostProvider` accepts this directly. Free tier (50k daily requests) is sufficient.
- **D-03:** `src/lib/cardano.ts` uses `import 'server-only'` guard. Env vars validated via `requireEnv()` inside each exported function (fail at use, not import). Matches Groq pattern in `src/lib/llm.ts`.
- **D-04:** Network hardcoded to `preview` in `src/lib/cardano.ts`. No `CARDANO_NETWORK` env var — mainnet would be its own phase with audit requirements.

### Anchor Trigger Flow
- **D-05:** `markReady` tRPC mutation (existing in `src/server/routers/milestone.ts`) is extended to emit a new `milestone.ready` Inngest event after flipping status to `ready`. `milestoneReadyFn` runs the 5-step pipeline: compute-hash → persist-hash → check-existing-tx → submit-tx → confirm-loop.
- **D-06:** Per-version anchoring fans out from the existing `version.published` event. A new `versionAnchorFn` triggers on the same event alongside `consultationSummaryGenerateFn`. No new event schema needed.
- **D-07:** Cardano tx metadata follows CIP-10 label 674 with exactly `{ project: 'policydash', type: 'milestone'|'version', hash, milestoneId|versionId, timestamp }`. No additional context fields.
- **D-08:** Global wallet concurrency lock: `concurrency: { key: 'cardano-wallet', limit: 1 }` on both Inngest functions. One Cardano tx at a time across all entity types to prevent UTxO contention.

### Verified State Badges (Public Portal)
- **D-09:** Verified badges appear in three locations on the public portal: (1) next to version label in `PublicVersionSelector`, (2) on the policy detail header for the currently-viewed version, (3) in a new milestone verification section. Claude has discretion on exact placement optimization.
- **D-10:** Badge click opens `https://preview.cardanoscan.io/transaction/{txHash}` in a new tab. Direct link, no tooltip preview.
- **D-11:** No badge shown for unanchored versions/milestones. Verified badge only appears after `anchored` status is confirmed.
- **D-12:** Admin milestone detail page (`milestone-detail-header.tsx`) also shows the Cardanoscan link and tx hash when status is `anchored`.

### Failure & Retry Strategy
- **D-13:** Inngest built-in retry policy handles transient Blockfrost failures (exponential backoff, default ~4 retries). No custom retry loop inside the function.
- **D-14:** On permanent failure (all retries exhausted), emit a `notification.create` event to the admin who triggered `markReady`. Uses existing notification dispatch pipeline. Milestone stays in `anchoring` state.
- **D-15:** Admin sees a "Retry Anchor" button on the milestone detail page when status is stuck at `anchoring`. Button re-emits the `milestone.ready` event to restart the pipeline.

### Claude's Discretion
- DB migration shape for `txHash` and `anchoredAt` columns on milestones table + per-version anchor storage (new columns on `documentVersions` or a separate `cardanoAnchors` table)
- Exact Mesh SDK import pattern and tx builder API usage
- `confirm-loop` polling interval and max attempts within Inngest step boundaries
- Shield icon choice and badge color for Verified State (should fit policy-grade theme: white/slate/saffron-teal)
- Whether per-version anchor needs its own `txHash` column on `documentVersions` or a shared anchors table
- Test strategy (unit tests for cardano.ts, Inngest function tests with mocked Blockfrost)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 23 requirements & success criteria
- `.planning/ROADMAP.md` — Phase 23 goal, 8 success criteria (SC-1 through SC-8), Mesh SDK + Blockfrost stack, CIP-10 label 674 metadata shape, 3-layer idempotency
- `.planning/REQUIREMENTS.md` §221–224 — VERIFY-06 (milestoneReady Inngest 5-step pipeline), VERIFY-07 (per-version anchor on version.published), VERIFY-08 (3-layer idempotency: DB UNIQUE + Blockfrost pre-check + Inngest concurrency), VERIFY-09 (Verified State badges with Cardanoscan links)

### Phase 22 foundations (hashing + milestone entity)
- `src/lib/hashing.ts` — Full hashing service: `hashPolicyVersion`, `hashWorkshop`, `hashFeedbackItem`, `hashEvidenceArtifact`, `hashEvidenceBundle`, `hashMilestone`. RFC 8785 JCS canonicalization. Phase 23 consumes these functions, does NOT modify them.
- `src/db/schema/milestones.ts` — `milestones` table, `milestone_status` enum, `contentHash`, `manifest` JSONB, `requiredSlots`. Phase 23 adds `txHash`/`anchoredAt` columns.
- `src/server/routers/milestone.ts` — 6 procedures (create, list, getById, attachEntity, detachEntity, markReady). Phase 23 extends `markReady` to emit Inngest event and adds `retryAnchor` mutation.
- `.planning/phases/22-milestone-entity-sha256-hashing-service/22-CONTEXT.md` — D-01 through D-05 decisions constraining milestone schema, hash composition, manifest model

### Inngest infrastructure (established patterns)
- `src/inngest/events.ts` — Event registry with Zod schemas, `eventType()` factory, `sendX()` helpers with `.validate()` before `.send()`. Phase 23 adds `milestone.ready` event here.
- `src/inngest/client.ts` — Singleton Inngest client (`id: 'policydash'`)
- `src/inngest/functions/index.ts` — Function registration. Phase 23 registers `milestoneReadyFn` + `versionAnchorFn` here.
- `src/inngest/functions/consultation-summary-generate.ts` — Existing function triggered by `version.published`. Reference pattern for fan-out (Phase 23's `versionAnchorFn` triggers on same event).

### Public portal (badge integration points)
- `app/(public)/portal/[policyId]/page.tsx` — Public policy detail page, renders `PublicVersionSelector` and version content
- `app/(public)/portal/[policyId]/_components/public-version-selector.tsx` — Version dropdown where Verified badge appears next to version label
- `app/(public)/portal/[policyId]/_components/public-policy-content.tsx` — Policy content area, potential badge placement on header

### Admin milestone UI (Cardanoscan link + retry button)
- `app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/milestone-detail-header.tsx` — Milestone detail header, add Cardanoscan link when anchored + Retry Anchor button when stuck at anchoring
- `app/(workspace)/policies/[id]/milestones/_components/milestone-status-badge.tsx` — Existing status badge component, may need `anchored` visual treatment update

### Project constraints
- `.planning/PROJECT.md` §11–28 — "All automation in-code via Inngest; only external deps: cal.com, Groq, Blockfrost, Clerk"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/hashing.ts` — Full hashing service ready for Phase 23 consumption. `hashPolicyVersion()` and `hashMilestone()` produce the hex that goes into Cardano tx metadata.
- `src/inngest/events.ts` — Established event pattern with Zod schema + `eventType()` + `sendX()` helper. New `milestone.ready` event follows this template exactly.
- `src/inngest/functions/consultation-summary-generate.ts` — Fan-out pattern from `version.published` event. `versionAnchorFn` registers as a second listener on the same event.
- `MilestoneStatusBadge` component — Existing badge with status-aware styling. Can be extended for `anchored` state or used as pattern for Verified badge.
- `VersionStatusBadge` component — Already used on public portal. Verified badge follows the same pattern.
- `src/lib/constants.ts` — `ACTIONS` object for audit log action names. Add `MILESTONE_ANCHOR_START`, `MILESTONE_ANCHOR_COMPLETE`, `MILESTONE_ANCHOR_FAIL`.

### Established Patterns
- **Inngest function shape:** `createFunction({ id, triggers: [event], concurrency?, retries? }, async ({ event, step }) => { ... })` with `step.run()` boundaries for each atomic operation.
- **Env validation:** `requireEnv('KEY')` pattern used in `src/lib/llm.ts` for Groq. Same pattern for Cardano env vars.
- **Server-only modules:** `import 'server-only'` at top of `src/lib/llm.ts`. Same for `src/lib/cardano.ts`.
- **Notification dispatch:** `sendNotificationCreate()` from `events.ts` for admin notifications on failure.
- **Date handling in hashing:** All Date columns converted to ISO strings before passing to hash functions (established in Phase 22 milestone.ts Pitfall 2).

### Integration Points
- `src/server/routers/milestone.ts` `markReady` mutation — add `sendMilestoneReady()` call after status persisted
- `src/inngest/functions/index.ts` — register two new functions
- `app/(public)/portal/[policyId]/page.tsx` — query `txHash` for published versions, pass to badge components
- `app/(workspace)/policies/[id]/milestones/[milestoneId]/_components/milestone-detail-header.tsx` — add Cardanoscan link + retry button

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 23-cardano-preview-net-anchoring*
*Context gathered: 2026-04-16*
