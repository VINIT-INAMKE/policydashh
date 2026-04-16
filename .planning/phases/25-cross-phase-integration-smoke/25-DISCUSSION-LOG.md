# Phase 25: Cross-Phase Integration Smoke - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 25-cross-phase-integration-smoke
**Areas discussed:** External service setup, Deferred walk consolidation, Gap resolution policy, Report format & evidence

---

## External Service Setup

### How should we handle external services during the smoke walk?

| Option | Description | Selected |
|--------|-------------|----------|
| All services live | Get real API keys for Clerk, cal.com, Inngest, Groq, Blockfrost, Resend, Turnstile, R2. Full fidelity. | ✓ (corrected) |
| Live core, mock edges | Clerk + Inngest + DB live. Resend/Groq/Blockfrost/cal.com accepted in degraded mode. | |
| Dev-mode everywhere | Inngest dev server, Clerk dev, Turnstile test keys, Resend sandbox. Fastest but doesn't prove real delivery. | (initially selected, corrected) |

**User's choice:** All services live (corrected from Dev-mode everywhere)
**Notes:** User initially selected dev-mode but corrected to real services — "we do real test with real keys"

### Which Clerk environment?

| Option | Description | Selected |
|--------|-------------|----------|
| Clerk Development instance | Existing dev instance. Invitation emails to real inbox in test mode. | ✓ |
| Clerk Staging instance | Separate staging instance. More isolated but requires separate setup. | |

**User's choice:** Clerk Development instance

### Cardano anchoring approach?

| Option | Description | Selected |
|--------|-------------|----------|
| Real preview-net tx | Blockfrost preview-net + funded preview wallet mnemonic. Requires tADA from faucet. | ✓ (implied by all-services-live correction) |
| Dry-run mode | Submit up to tx build but skip submission. | (initially selected, overridden) |

**User's choice:** Real preview-net tx (overridden by all-services-live correction)

---

## Deferred Walk Consolidation

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 25 subsumes all | One unified E2E walk. Mark deferred walks from 16/17/19/20 as covered-by-phase-25. | ✓ |
| Separate then integrate | Run each deferred walk individually first, then E2E. More thorough but more time. | |
| Phase 25 only, skip deferred | E2E only. Deferred walks stay unresolved. | |

**User's choice:** Phase 25 subsumes all

---

## Gap Resolution Policy

### When the smoke walk discovers a broken step?

| Option | Description | Selected |
|--------|-------------|----------|
| Fix blockers, document the rest | Core chain steps are blockers. Edge issues documented as known limitations. | |
| Document everything, fix nothing | Pure observation pass. Fix phase comes after if needed. | |
| Fix everything before closing | No known gaps. Every step must pass. Could spawn multiple fix rounds. | ✓ |

**User's choice:** Fix everything before closing

### What level of breakage blocks milestone completion?

| Option | Description | Selected |
|--------|-------------|----------|
| Core chain must complete | Critical path must work. External service delivery can be gated/degraded. | |
| All 9 success criteria must pass | Strict: every criterion from ROADMAP.md must be fully green. | ✓ |
| 50%+ criteria pass | Majority pass is enough. Document failures for v0.3. | |

**User's choice:** All 9 success criteria must pass

---

## Report Format & Evidence

### How detailed should the smoke report be?

| Option | Description | Selected |
|--------|-------------|----------|
| Structured checklist with evidence | Each criterion: pass/fail, observation, DB query or Inngest run ID, notes. | ✓ |
| Detailed walkthrough with screenshots | Full narrative with screenshots, terminal output, DB state. | |
| Simple pass/fail table | 9-row table. Minimal overhead. | |

**User's choice:** Structured checklist with evidence

### Cross-reference deferred HUMAN-UAT files?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, update deferred UATs | Mark 16/17/19/20 UATs as resolved-by-phase-25 with link to smoke report. | ✓ |
| No, standalone report only | Phase 25 report stands alone. Deferred UATs stay as-is. | |

**User's choice:** Yes, update deferred UATs

---

## Claude's Discretion

- Exact ordering of env setup steps in the plan
- How to structure fix iterations if gaps are found
- Whether to bundle pre-condition checks into a separate plan or inline

## Deferred Ideas

None — discussion stayed within phase scope.
