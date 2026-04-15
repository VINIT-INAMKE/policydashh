---
phase: 21
slug: public-shell-consultation-summary-llm-theme
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm run test -- --run --reporter=basic` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run --reporter=basic`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Filled by gsd-planner during Step 8 — task IDs unknown until plans exist.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/__tests__/anonymize-feedback.test.ts` — unit stubs for LLM-04 anonymization
- [ ] `src/lib/__tests__/guardrail-regex.test.ts` — unit stubs for LLM-06 stakeholder name detection
- [ ] `src/inngest/__tests__/consultation-summary-generate.test.ts` — integration stub for LLM-04/05/06/07
- [ ] `src/server/routers/__tests__/consultation-summary.test.ts` — tRPC moderator route stubs for LLM-08
- [ ] `app/(public)/portal/[policyId]/_components/__tests__/section-summary-block.test.tsx` — render stubs for PUB-09 inline summary block
- [ ] `app/(public)/_components/__tests__/public-header.test.tsx` — render stubs for PUB-10 shell header

*Wave 0 must produce failing-but-importable test files for every requirement before any implementation task runs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Newsreader/Inter font visual rendering | PUB-10 | Visual regression — pixel-perfect font load order, fallback flash | Run dev server, hard-reload `/portal/[policyId]`, confirm Newsreader headlines load without FOUT and Inter body matches design contract |
| Public summary visible only after moderator approval | LLM-08 | E2E flow involving Inngest job + tRPC moderation + cross-route visibility | Generate summary via publish, verify portal shows "under review" placeholder, approve in workspace, refresh portal, confirm prose appears |
| Mobile hamburger animation 768px breakpoint | PUB-09 | CSS transition timing — visual only | Resize viewport below 768px, click hamburger, verify max-height transition completes in 200ms |
| Cross-version summary browsing on `/portal/[policyId]` | PUB-09 + LLM-08 | Combinatorial: PublicVersionSelector × consultationSummary state matrix | Switch versions via selector, verify each version's summary renders or shows placeholder per its JSONB state |

*Per user memory feedback_defer_smoke_walks.md: manual smoke walks are deferred to end-of-milestone, not per-phase. These are documented for the milestone audit checklist, not blocking gates.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
