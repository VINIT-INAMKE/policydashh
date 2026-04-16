# Phase 25: Cross-Phase Integration Smoke - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Prove the entire v0.2 chain works end-to-end as a single product — from public `/participate` intake through Cardano anchoring. This is a manual testing phase, not a feature-building phase. The output is a structured smoke report documenting pass/fail for all 9 success criteria, plus resolution of all deferred smoke walks from phases 16/17/19/20.

</domain>

<decisions>
## Implementation Decisions

### External Service Setup
- **D-01:** All external services must be live with real API keys — no mocks, no degraded mode. Required keys: `RESEND_API_KEY`, `GROQ_API_KEY`, `BLOCKFROST_PROJECT_ID`, `CARDANO_WALLET_MNEMONIC`, `CALCOM_API_KEY`, `CALCOM_WEBHOOK_SECRET`, `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY`, `CLOUDFLARE_TURNSTILE_SECRET_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`.
- **D-02:** Use Clerk Development instance (existing config in `.env.local`). Invitation emails go to real inbox in test mode.
- **D-03:** Cardano anchoring uses real preview-net transactions via Blockfrost. Wallet must be funded with tADA from the Cardano preview-net faucet.
- **D-04:** Inngest runs via dev server (`npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`), not cloud — local observability for step-by-step verification.

### Deferred Walk Consolidation
- **D-05:** Phase 25 subsumes all deferred smoke walks from phases 16, 17, 19, and 20. One unified E2E walk covers the full chain. No separate per-phase re-walks.
- **D-06:** After Phase 25 completes, go back and mark `16-HUMAN-UAT.md`, `17-VERIFICATION.md`, `19-HUMAN-UAT.md`, and `20-HUMAN-UAT.md` as resolved-by-phase-25 with a link to the smoke report.

### Gap Resolution Policy
- **D-07:** Fix everything before closing. No known gaps allowed — every broken step discovered during the walk must be fixed before milestone can close.
- **D-08:** All 9 success criteria from ROADMAP.md must pass fully. No exceptions, no degraded-mode acceptance.

### Report Format & Evidence
- **D-09:** Output is `.planning/v0.2-INTEGRATION-SMOKE.md`. Each of the 9 success criteria gets: pass/fail status, what was observed, DB query or Inngest run ID proving the step, and any notes.
- **D-10:** Structured checklist with evidence — auditable but not exhaustive (no screenshots or full terminal dumps).

### Claude's Discretion
- Exact ordering of env setup steps in the plan
- How to structure fix iterations if gaps are found (inline fix vs separate plan)
- Whether to bundle pre-condition checks into a separate plan or inline with the walk

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Integration requirement
- `.planning/REQUIREMENTS.md` L228 — INTEGRATION-01 full chain definition

### Deferred smoke walk procedures (subsumed by Phase 25)
- `.planning/phases/16-flow-5-smoke-notification-dispatch-migration/16-SMOKE.md` — Flow 5 notification dispatch walk procedure
- `.planning/phases/16-flow-5-smoke-notification-dispatch-migration/16-HUMAN-UAT.md` — Phase 16 deferred UAT (1 pending item)
- `.planning/phases/17-workshop-lifecycle-recording-pipeline-groq/17-SMOKE.md` — Workshop lifecycle walk procedure
- `.planning/phases/17-workshop-lifecycle-recording-pipeline-groq/17-VERIFICATION.md` — Phase 17 deferred verification (5 human_needed items)
- `.planning/phases/19-public-participate-intake-clerk-invite-turnstile/19-HUMAN-UAT.md` — Phase 19 deferred UAT
- `.planning/phases/20-cal-com-workshop-register/20-HUMAN-UAT.md` — Phase 20 deferred UAT (4 pending items)

### Phase 25 success criteria source
- `.planning/ROADMAP.md` L555–569 — Phase 25 goal, dependencies, 9 success criteria

### External service configuration
- `.env.example` — Required env var template
- `.env.local` — Current dev configuration (missing several required keys)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/inngest/` — All Inngest function definitions; dev server provides step-by-step observability at http://localhost:8288
- `src/lib/cardano.ts` — Mesh SDK + Blockfrost anchoring with `import 'server-only'`, CIP-10 label 674 metadata, 3-layer idempotency
- `src/lib/cal-signature.ts` — HMAC-SHA256 webhook verification for cal.com
- `src/lib/feedback-token.ts` — HS256 JWT for workshop feedback deep-links
- `src/server/services/consultation-summary.service.ts` — LLM summary with anonymization and guardrails
- `src/server/services/hashing.service.ts` — SHA256 hashing for versions, workshops, evidence, milestones

### Established Patterns
- Deferred smoke walks use a consistent format: frontmatter with `status: deferred`, walk procedure with numbered steps, pre-condition checks
- HUMAN-UAT files track individual test items with `status: partial` or `status: diagnosed`
- Inngest dev server at port 8288 provides run history and step-level debugging

### Integration Points
- `app/api/inngest/route.ts` — Inngest function registry (all automation functions registered here)
- `app/api/webhooks/cal/route.ts` — Cal.com webhook handler
- `app/api/webhooks/clerk/route.ts` — Clerk webhook handler
- `app/api/intake/participate/route.ts` — Public participate form endpoint
- `app/api/intake/workshop-feedback/route.ts` — Workshop feedback submission endpoint
- `app/(public)/` — All public-facing routes (participate, workshops, research, framework, portal)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — the 9 success criteria from ROADMAP.md define exactly what must be tested. The walk follows the natural user journey from public visitor to verified policy milestone.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 25-cross-phase-integration-smoke*
*Context gathered: 2026-04-16*
