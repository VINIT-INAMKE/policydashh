---
phase: 21
slug: public-shell-consultation-summary-llm-theme
status: draft
nyquist_compliant: true
wave_0_complete: true
wave_0_completed_at: 2026-04-15
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
| 21-00-T1 | 21-00 | 0 | LLM-05 | migration probe | `node scripts/apply-migration-0013.mjs` | ✅ | ✅ green |
| 21-00-T2 | 21-00 | 0 | LLM-05, LLM-07, LLM-08 | typecheck | `npx tsc --noEmit` | ✅ | ✅ green |
| 21-00-T3 | 21-00 | 0 | LLM-06, LLM-07, LLM-08 | unit (RED) | `npm test -- --run tests/phase-21/consultation-summary-service.test.ts src/inngest/__tests__/consultation-summary-generate.test.ts src/server/routers/__tests__/consultation-summary.test.ts` | ✅ | ✅ green (RED-locked) |
| 21-00-T4 | 21-00 | 0 | PUB-09, LLM-08 | unit (RED) | `npm test -- --run "app/(public)/_components/__tests__/public-header.test.tsx" "app/(public)/portal/[policyId]/_components/__tests__/section-summary-block.test.tsx"` | ✅ | ✅ green (RED-locked) |
| 21-00-T5 | 21-00 | 0 | — | frontmatter probe | `grep -q "nyquist_compliant: true" .planning/phases/21-public-shell-consultation-summary-llm-theme/21-VALIDATION.md` | ✅ | ✅ green |
| 21-01-T1 | 21-01 | 1 | LLM-06, LLM-08 | unit | `npm test -- --run tests/phase-21/consultation-summary-service.test.ts` | ✅ | ⬜ pending |
| 21-01-T2 | 21-01 | 1 | LLM-04 | grep + tsc | `grep -q "llama-3.3-70b-versatile" src/lib/llm.ts && npx tsc --noEmit` | ✅ | ⬜ pending |
| 21-01-T3 | 21-01 | 1 | LLM-05, LLM-07, LLM-08 | unit | `npm test -- --run src/inngest/__tests__/consultation-summary-generate.test.ts` | ✅ | ⬜ pending |
| 21-01-T4 | 21-01 | 1 | LLM-05 | grep + tsc | `grep -c "sendVersionPublished" src/server/routers/version.ts` returns >=2 && `npx tsc --noEmit` | ✅ | ⬜ pending |
| 21-02-T1 | 21-02 | 1 | PUB-09, PUB-10 | grep + unit | `grep -q "cl-landing" "app/(public)/layout.tsx" && grep -q "font-cl-headline" "app/(public)/layout.tsx" && npm test -- --run "app/(public)/_components/__tests__/public-header.test.tsx"` | ✅ | ⬜ pending |
| 21-02-T2 | 21-02 | 1 | PUB-09, PUB-10 | grep (negative) | `! grep -qE "className=.cl-landing min-h-screen" "app/(public)/participate/page.tsx" && ! grep -qE "className=.cl-landing min-h-screen" "app/(public)/workshops/page.tsx"` | ✅ | ⬜ pending |
| 21-03-T1 | 21-03 | 2 | LLM-07 | unit | `npm test -- --run src/server/routers/__tests__/consultation-summary.test.ts` | ✅ | ⬜ pending |
| 21-03-T2 | 21-03 | 2 | LLM-07, LLM-08 | typecheck + grep | `npx tsc --noEmit && grep -c "SummaryReviewCard" "app/(workspace)/policies/[id]/versions/_components/version-detail.tsx" && grep -q "getSectionFeedback.useQuery" "app/(workspace)/policies/[id]/versions/_components/summary-review-card.tsx"` | ✅ | ⬜ pending |
| 21-04-T1 | 21-04 | 2 | PUB-09, LLM-08 | unit | `npm test -- --run "app/(public)/portal/[policyId]/_components/__tests__/section-summary-block.test.tsx"` | ✅ | ⬜ pending |
| 21-04-T2 | 21-04 | 2 | LLM-05, LLM-08 | typecheck + grep | `npx tsc --noEmit && grep -q "sectionSummaries={sectionSummaries}" "app/(public)/portal/[policyId]/page.tsx"` | ✅ | ⬜ pending |
| 21-04-T3 | 21-04 | 2 | PUB-09, LLM-08 | grep + tsc | `grep -q "FrameworkSummaryBlock" "app/(public)/framework/page.tsx" && npx tsc --noEmit` | ✅ | ⬜ pending |

*Per-task map populated by gsd-planner 2026-04-15. Plan 21-00 Task 5 executor will flip these to ✅ as each completes.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/db/migrations/0013_consultation_summary.sql` — schema migration adds `consultationSummary jsonb` to `documentVersions`
- [x] `scripts/apply-migration-0013.mjs` — Neon HTTP migration runner (mirrors `scripts/apply-migration-0012.mjs`)
- [x] `src/server/services/consultation-summary.service.ts` — typed contract module (`ConsultationSummaryJson`, `ApprovedSummarySection`, status enums) — implementation hollow, types only
- [x] `tests/phase-21/consultation-summary-service.test.ts` — RED unit stubs covering `anonymizeFeedbackForSection` (LLM-04), `buildGuardrailPatternSource` (LLM-06), `generateConsultationSummary` (LLM-04/05/06)
- [x] `src/inngest/__tests__/consultation-summary-generate.test.ts` — RED integration stub for `consultationSummaryGenerateFn` (LLM-05/06/07)
- [x] `src/server/routers/__tests__/consultation-summary.test.ts` — RED tRPC moderator route stubs for `approveSection` / `regenerateSection` / `saveSection` / `getByVersionId` / `getSectionFeedback` (LLM-07/08)
- [x] `app/(public)/_components/__tests__/public-header.test.tsx` — RED render stub for `PublicHeader` (PUB-09/10 nav links + active state)
- [x] `app/(public)/portal/[policyId]/_components/__tests__/section-summary-block.test.tsx` — RED render stub for `SectionSummaryBlock` (PUB-09 + LLM-08 placeholder vs approved branches)

*Wave 0 must produce failing-but-importable test files for every requirement before any implementation task runs. Test paths above match Plan 21-00 Tasks 3–4.*

**Wave 0 closed:** 2026-04-15 — all stub files discovered and failing as expected (RED contracts locked).

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (Wave 0 closed 2026-04-15 by Plan 21-00 executor)
