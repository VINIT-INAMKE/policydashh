---
phase: 17
slug: workshop-lifecycle-recording-pipeline-groq
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-14
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 17-RESEARCH.md `## Validation Architecture` section.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.1 |
| **Config file** | vitest.config.mts |
| **Quick run command** | `npm test -- --run src/inngest src/lib src/server/routers` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30s (full suite, baseline 309 passed / 2 pre-existing failed from Phase 16 deferred-items.md) |

---

## Sampling Rate

- **After every task commit:** `npm test -- --run <touched-file>`
- **After every plan wave:** `npm test`
- **Before `/gsd:verify-work`:** Full suite green at ≥ 309 passed (excluding 2 pre-existing failures documented in Phase 16 `deferred-items.md`)
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Task IDs are placeholders — planner aligns them to actual plan task names.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 00-01 | 00 | 0 | LLM-01/02/03 | dep install | `node -e "require('groq-sdk')"` exits 0 && grep GROQ_API_KEY .env.example | ⚠️ W0 | ⬜ pending |
| 00-02 | 00 | 0 | LLM-01/02/03 | RED stub | `npx vitest run src/lib/llm.test.ts` exits non-zero | ❌ → W0 | ⬜ pending |
| 00-03 | 00 | 0 | WS-12, WS-13 | RED stub | `npx vitest run src/inngest/__tests__/workshop-completed.test.ts` exits non-zero | ❌ → W0 | ⬜ pending |
| 00-04 | 00 | 0 | WS-14 | RED stub | `npx vitest run src/inngest/__tests__/workshop-recording-processed.test.ts` exits non-zero | ❌ → W0 | ⬜ pending |
| 00-05 | 00 | 0 | WS-06 | RED stub | `npx vitest run src/server/routers/workshop-transition.test.ts` exits non-zero | ❌ → W0 | ⬜ pending |
| 01-01 | 01 | 1 | WS-06, WS-13 | migration DDL + DB apply | `grep -n "workshop_status\|workshop_evidence_checklist" src/db/migrations/0010_*.sql` ≥ 2 | ✅ after Plan 01 | ⬜ pending |
| 01-02 | 01 | 1 | WS-06, WS-13 | Drizzle schema tsc | `npx tsc --noEmit` exits 0 && grep workshopStatusEnum src/db/schema/workshops.ts | ✅ | ⬜ pending |
| 01-03 | 01 | 1 | WS-06 | unit GREEN | `npx vitest run src/server/routers/workshop-transition.test.ts` exits 0 | ✅ | ⬜ pending |
| 02-01 | 02 | 2 | LLM-01, LLM-02, LLM-03 | unit GREEN + tsc | `npx vitest run src/lib/llm.test.ts` exits 0 && `npx tsc --noEmit` | ✅ | ⬜ pending |
| 03-01 | 03 | 3 | WS-12 | tsc + grep | grep sendWorkshopEvidenceNudgeEmail src/lib/email.ts && tsc clean | ✅ | ⬜ pending |
| 03-02 | 03 | 3 | WS-12, WS-13 | unit GREEN + barrel | `npx vitest run src/inngest/__tests__/workshop-completed.test.ts` exits 0 && grep workshopCompletedFn src/inngest/functions/index.ts ≥ 2 | ✅ | ⬜ pending |
| 04-01 | 04 | 4 | WS-14 | grep + tsc | grep "recording: 25 \* 1024" app/api/upload/route.ts && tsc clean | ✅ | ⬜ pending |
| 04-02 | 04 | 4 | WS-14 | grep + tsc | grep sendWorkshopRecordingUploaded src/server/routers/workshop.ts && tsc clean | ✅ | ⬜ pending |
| 04-03 | 04 | 4 | WS-14, LLM-02, LLM-03 | unit GREEN + barrel | `npx vitest run src/inngest/__tests__/workshop-recording-processed.test.ts` exits 0 && grep workshopRecordingProcessedFn src/inngest/functions/index.ts ≥ 2 | ✅ | ⬜ pending |
| 05-01 | 05 | 5 | WS-06, WS-13, WS-14 | router extend | grep listChecklist src/server/routers/workshop.ts && tsc clean | ✅ | ⬜ pending |
| 05-02 | 05 | 5 | WS-06, WS-12, WS-14 | UI mount + tsc | ls status-transition-buttons.tsx evidence-checklist.tsx && tsc clean | ✅ | ⬜ pending |
| 05-03 | 05 | 5 | WS-06, WS-12, WS-14 | SMOKE deferred + full suite | grep "status: deferred" 17-SMOKE.md && `npm test` ≥ baseline | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 (Plan 00) installs groq-sdk, scaffolds llm.ts wrapper, creates 4 RED test files. Tests start RED and flip GREEN as Plans 01–04 ship implementation.

- [ ] `npm install groq-sdk@1.1.2` — required before any llm.ts import compiles
- [ ] `GROQ_API_KEY=` added to `.env.example`
- [ ] `src/lib/llm.test.ts` — LLM-01 (env required), LLM-02 (transcribeAudio mock), LLM-03 (max_completion_tokens enforcement). Goes GREEN in Plan 02.
- [ ] `src/inngest/__tests__/workshop-completed.test.ts` — WS-12/WS-13 scaffold. Goes GREEN in Plan 03.
- [ ] `src/inngest/__tests__/workshop-recording-processed.test.ts` — WS-14 scaffold. Goes GREEN in Plan 04.
- [ ] `src/server/routers/workshop-transition.test.ts` — WS-06 scaffold (valid/invalid transitions, audit write, event fire). Goes GREEN in Plan 01.
- [x] DB migration 0010 — NOT a Wave 0 file; covered by Plan 01.

*Existing test infrastructure (`vitest`, `src/inngest/__tests__/*`, `src/__tests__/*`, `src/server/routers/*.test.ts`) covers everything else.*

---

## Manual-Only Verifications (DEFERRED — milestone-end batch)

Per `feedback_defer_smoke_walks.md`, all manual smoke walks in v0.2 are deferred to `/gsd:complete-milestone` time. Phase 17 will produce a `17-SMOKE.md` placeholder with `status: deferred` and the full procedure preserved verbatim.

| Behavior | Requirement | Why Manual | Test Instructions (recorded in 17-SMOKE.md) |
|----------|-------------|------------|--------------------------------------------|
| Workshop status transition end-to-end | WS-06 | Requires admin UI + dev DB + Inngest Dev UI | Sign in as admin → open a workshop → click Start (upcoming→in_progress), Complete (in_progress→completed), Archive (completed→archived). Assert: workflow_transitions rows for each step; workshop-completed Inngest run fires on Complete; workshop_evidence_checklist has 5 rows post-Complete |
| Evidence nudge fires after sleep | WS-13 | Requires waiting through `step.sleepUntil` or manual fast-forward in Inngest Dev UI | Trigger Complete → in Inngest Dev UI, fast-forward sleep step → assert nudge email visible (Resend dashboard or `gated` if RESEND_API_KEY unset) → fill all checklist slots → re-trigger and assert nudge skipped |
| Recording transcription pipeline | WS-14, LLM-01/02/03 | Requires real audio file (< 25MB) + real Groq API key + R2 upload | Upload an mp3 < 25MB via the workshop detail page recording slot → assert workshop-recording-processed Inngest run completes → assert two new draft artifacts (transcript, summary) on the workshop → moderator reviews → approves → assert reviewStatus flips to 'approved' and visibility opens to non-admins |
| 25MB upload rejection | WS-14 | Requires real upload attempt | Try to upload an mp3 > 25MB → assert 400 at presign step with friendly message |
| Groq cost guard | LLM-03 | Requires real API call | Check Groq dashboard usage after smoke walk to confirm `max_completion_tokens` enforced (no runaway costs) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (4 new test files + groq-sdk install + .env.example update)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter (planner sets after writing plans)

**Approval:** pending
