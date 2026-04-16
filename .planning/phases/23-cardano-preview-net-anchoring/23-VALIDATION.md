---
phase: 23
slug: cardano-preview-net-anchoring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | VERIFY-06 | unit + integration | `npx vitest run src/inngest/__tests__/milestone-ready.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VERIFY-07 | unit + integration | `npx vitest run src/inngest/__tests__/version-anchor.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VERIFY-08 | unit | `npx vitest run src/lib/__tests__/cardano.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | VERIFY-09 | render | `npx vitest run src/__tests__/verified-badge.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/cardano.test.ts` — stubs for cardano.ts module (requireEnv, wallet init, tx builder)
- [ ] `src/inngest/__tests__/milestone-ready.test.ts` — stubs for milestoneReadyFn (5-step pipeline)
- [ ] `src/inngest/__tests__/version-anchor.test.ts` — stubs for versionAnchorFn
- [ ] `src/__tests__/verified-badge.test.tsx` — render tests for VerifiedBadge component

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Cardano tx submission on preview-net | VERIFY-06 | Requires funded wallet + live Blockfrost | 1. Set CARDANO_WALLET_MNEMONIC + BLOCKFROST_PROJECT_ID. 2. Create milestone, attach entities, mark ready. 3. Check Inngest dev UI for milestoneReadyFn run. 4. Verify txHash on Cardanoscan preview. |
| Cardanoscan link opens correctly | VERIFY-09 | Browser navigation + external site | 1. Find anchored version on /portal. 2. Click Verified badge. 3. Verify Cardanoscan opens with correct tx. |
| Per-version anchor on publish | VERIFY-07 | Requires running dev server + Inngest | 1. Publish a version. 2. Check Inngest dev UI for versionAnchorFn. 3. Verify txHash stored on documentVersions row. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
