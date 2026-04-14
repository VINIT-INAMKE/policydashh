---
phase: 17-workshop-lifecycle-recording-pipeline-groq
verified: 2026-04-14T13:30:00Z
status: human_needed
score: 6/6 success criteria verified at code level
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Walk 1 — Workshop status transitions in browser"
    expected: "Moderator can click Start → Complete → Archive, status badge and button update, workflow_transitions rows written, workshop-completed Inngest run appears in Dev UI with step 1 create-checklist completing and step 2 sleep-72h paused"
    why_human: "Requires running dev server + Inngest dev CLI + real DB + visual confirmation of badge/button state transitions; deferred to 17-SMOKE.md per operator preference"
  - test: "Walk 2 — 72h / 7d nudge fast-forward"
    expected: "Inngest Dev UI fast-forward on sleep-72h triggers nudge-72h step which calls sendWorkshopEvidenceNudgeEmail with delayLabel '72 hours'; Resend delivers email with subject 'Evidence checklist reminder: <title>' listing 5 empty slots; same for sleep-7d with '7 days' label"
    why_human: "Requires real RESEND_API_KEY + inbox access + Inngest Dev UI fast-forward affordance; cannot be automated in vitest"
  - test: "Walk 3 — Recording pipeline happy path end-to-end"
    expected: "Moderator uploads < 25MB mp3 → R2 presign succeeds → workshop.attachArtifact fires workshop.recording_uploaded event → workshop-recording-processed run shows 4 steps green (fetch-recording with base64, transcribe with real Groq Whisper transcript, summarize with real llama JSON, store-artifacts inserting 2 draft workshopArtifacts rows) → refresh workshop page shows two 'Workshop transcript/summary (draft)' rows with amber Draft badges + Approve button → clicking Approve flips reviewStatus to approved → workshop_evidence_checklist 'recording' slot marked filled"
    why_human: "Requires real GROQ_API_KEY + real R2 bucket + real mp3 file + visual observation of the draft/approved UI state; the automated pipeline is mocked through Groq SDK in unit tests"
  - test: "Walk 4 — 25MB upload rejection at R2 presign"
    expected: "POST /api/upload with category=recording and fileSize > 25MB returns 400 with error 'File too large. Maximum 25MB'; no workshop_artifacts row, no Inngest run"
    why_human: "Automated guard verified via code review (MAX_FILE_SIZE.recording = 25 * 1024 * 1024, existing fileSize > maxSize guard) but end-to-end browser upload with oversized file needs human test"
  - test: "Walk 5 — Groq console cost guard spot-check"
    expected: "Groq console logs show llama-3.1-8b-instant request with max_completion_tokens=1024 in request body"
    why_human: "Requires authenticated Groq console access; code enforcement verified via grep of src/lib/llm.ts line 95 (max_completion_tokens: opts.maxTokens) + TypeScript-mandatory maxTokens parameter in chatComplete signature"
---

# Phase 17: Workshop Lifecycle + Recording Pipeline Verification Report

**Phase Goal:** Workshops have a real status machine with completion events, an evidence checklist with auto-nudges, and recordings are transcribed + summarized via Groq Whisper + llama in a background pipeline.

**Verified:** 2026-04-14T13:30:00Z
**Status:** human_needed (all code-level verification passed; 5 browser walks deferred to 17-SMOKE.md per operator preference)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Mapped from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Moderator can transition upcoming → in_progress → completed → archived with each transition audited | VERIFIED (code) | `workshop.ts:500-560` — `transition` mutation with `ALLOWED_TRANSITIONS` const, inserts `workflowTransitions` row with fromState/toState/actorId/metadata, plus `writeAuditLog` with `ACTIONS.WORKSHOP_TRANSITION`. 6/6 `workshop-transition.test.ts` GREEN. UI gate: `status-transition-buttons.tsx` NEXT_ACTION map with canManage check. |
| 2 | Workshop completion triggers workshopCompleted Inngest fn that creates evidence checklist rows for required slots | VERIFIED (code) | `workshop.ts:552-557` — `if (toStatus === 'completed') await sendWorkshopCompleted(...)`. `workshop-completed.ts:59-94` — step 1 `create-checklist` loops `REQUIRED_SLOTS` (5 slots) with `db.insert(workshopEvidenceChecklist).values(...).onConflictDoNothing()`. 4/4 `workshop-completed.test.ts` GREEN. Registered in barrel `src/inngest/functions/index.ts:18`. |
| 3 | Moderator receives nudge email at 72h and 7d after completion if evidence slots still empty | VERIFIED (code) | `workshop-completed.ts:98-131` — step.sleepUntil('sleep-72h', event.ts + 72h) + step.run('nudge-72h') queries `workshopEvidenceChecklist` where status='empty', calls `sendWorkshopEvidenceNudgeEmail` with delayLabel '72 hours'. Lines 134-167 mirror for '7 days'. Absolute-time anchoring on `event.ts` prevents retry drift. `email.ts:72` — `sendWorkshopEvidenceNudgeEmail` helper with silent-no-op when !resend or !to. |
| 4 | Moderator uploads recording → workshopRecordingProcessed Inngest fn transcribes via Whisper-large-v3-turbo and summarizes via llama-3.1-8b-instant | VERIFIED (code) | `workshop.ts:310-317` — attachArtifact fires `sendWorkshopRecordingUploaded` when artifactType === 'recording' && r2Key. `workshop-recording-processed.ts:40-152` — 4 steps: fetch-recording (R2 presigned GET → base64), transcribe (Buffer.from → transcribeAudio), summarize (summarizeTranscript), store-artifacts. `llm.ts:113-125` — transcribeAudio calls `audio.transcriptions.create({model: 'whisper-large-v3-turbo', response_format: 'text'})`. `llm.ts:144-163` — summarizeTranscript calls chatComplete with model 'llama-3.1-8b-instant', maxTokens: 1024. 5/5 `workshop-recording-processed.test.ts` GREEN. |
| 5 | Transcript and summary appear as workshop artifacts in draft state; moderator reviews and approves | VERIFIED (code) | `workshop-recording-processed.ts:80-119` — store-artifacts step inserts 2 evidenceArtifacts (title 'Workshop transcript (draft)' / 'Workshop summary (draft)' with content populated), then 2 workshopArtifacts rows with `reviewStatus: 'draft'`. `workshop.ts:563-589` — `approveArtifact` mutation flips reviewStatus to 'approved'. UI surface: `artifact-list.tsx:118-122` renders amber Draft badge when `reviewStatus === 'draft'`; lines 139-153 render Approve button gated by `canManage && reviewStatus === 'draft'` wired to `approveArtifact.useMutation`. |
| 6 | Uploads > 25MB rejected at R2 presign step; src/lib/llm.ts enforces max_tokens on every Groq chat call | VERIFIED (code) | `app/api/upload/route.ts:14` — `recording: 25 * 1024 * 1024` in MAX_FILE_SIZE. Lines 26-38 — 11-entry audio/video MIME allowlist. Lines 91-93 — existing `fileSize > maxSize` guard returns 400. `llm.ts:85-99` — `chatComplete` has `maxTokens: number` (no `?`, TypeScript-mandatory), maps to `max_completion_tokens` at SDK boundary. `llm.ts:144` — `summarizeTranscript` supplies `maxTokens: 1024` to chatComplete. 4/4 `llm.test.ts` GREEN. |

**Score:** 6/6 success criteria verified at the code level. Browser-level walks deferred to 17-SMOKE.md per `feedback_defer_smoke_walks.md` operator preference.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---------|----------|--------|---------|
| `src/db/migrations/0010_workshop_lifecycle.sql` | workshop_status enum, evidence checklist table, review_status column, content column | VERIFIED | 49 lines, 4 CREATE TYPE, 2 ALTER TABLE (workshops, workshop_artifacts, evidence_artifacts), 1 CREATE TABLE with UNIQUE(workshop_id, slot). Applied to live Neon dev per 17-01 SUMMARY. |
| `src/db/schema/workshops.ts` | Drizzle mirrors migration | VERIFIED | `workshopStatusEnum` (line 11), `artifactReviewStatusEnum` (line 21), workshops.status column (line 30), workshopArtifacts.reviewStatus (line 41), `workshopEvidenceChecklist` table (line 58). |
| `src/lib/llm.ts` | chatComplete, transcribeAudio, summarizeTranscript | VERIFIED | 179 lines. `chatComplete` (line 85) with mandatory `maxTokens: number` and `max_completion_tokens` mapping. `transcribeAudio` (line 113) with `whisper-large-v3-turbo` + `response_format: 'text'`. `summarizeTranscript` (line 139) with `llama-3.1-8b-instant` + 1024 maxTokens + try/catch parse fallback. `requireEnv('GROQ_API_KEY')` at line 22. Single groq-sdk import site in codebase. |
| `src/inngest/events.ts` | workshopCompletedEvent + workshopRecordingUploadedEvent + helpers | VERIFIED | `workshopCompletedEvent` declared line 165, `sendWorkshopCompleted` helper line 171. `workshopRecordingUploadedEvent` line 188, `sendWorkshopRecordingUploaded` line 195. Both use z.guid() and .validate() before .send(). |
| `src/inngest/functions/workshop-completed.ts` | 5 durable steps | VERIFIED | 172 lines. Steps: create-checklist (line 59), sleep-72h (line 98), nudge-72h (line 104), sleep-7d (line 134), nudge-7d (line 140). Uses `onConflictDoNothing` for idempotency; uses `event.ts` for absolute-time anchoring. Soft-degradation on missing workshop row (falls back to null moderator email → downstream nudges short-circuit). |
| `src/inngest/functions/workshop-recording-processed.ts` | 4-step Groq pipeline | VERIFIED | 153 lines. Steps: fetch-recording (line 54, R2 presigned GET → base64), transcribe (line 65, Buffer.from base64 → transcribeAudio), summarize (line 75, summarizeTranscript), store-artifacts (line 80). `concurrency: { key: 'groq-transcription', limit: 2 }` at line 45. Inserts 2 evidenceArtifacts + 2 workshopArtifacts with reviewStatus='draft'. Updates checklist recording slot to 'filled'. |
| `src/inngest/functions/index.ts` | Barrel with 5 functions | VERIFIED | Imports `workshopCompletedFn` (line 4) and `workshopRecordingProcessedFn` (line 5); both in `functions` array (lines 18-19). |
| `src/server/routers/workshop.ts` | transition, approveArtifact, listChecklist, attachArtifact-with-r2Key | VERIFIED | `ALLOWED_TRANSITIONS` (line 25), `getById` selects status (line 115), `attachArtifact` captures workshopArtifact.id via returning (line 288-295) and fires event (line 310-317), `listArtifacts` selects reviewStatus + workshopArtifactId (lines 365-366), `listChecklist` query (line 378), `transition` mutation (line 500), `approveArtifact` mutation (line 563). |
| `app/api/upload/route.ts` | recording category 25MB + audio MIME allowlist | VERIFIED | `recording: 25 * 1024 * 1024` (line 14), 11-entry audio+video allowlist (lines 26-38), category union includes 'recording' (line 71), existing fileSize>maxSize guard enforces (line 91). |
| `src/lib/email.ts` | sendWorkshopEvidenceNudgeEmail helper | VERIFIED | Line 72. Silent no-op when !resend or !to. Subject 'Evidence checklist reminder: ...'. |
| `app/(workspace)/workshops/[id]/_components/status-transition-buttons.tsx` | Status badge + next-action button gated by canManage | VERIFIED | 67 lines. NEXT_ACTION map, trpc.workshop.transition.useMutation with dual invalidate on success. Terminal 'archived' state hides button. |
| `app/(workspace)/workshops/[id]/_components/evidence-checklist.tsx` | 5-slot checklist with filled/pending badges | VERIFIED | 58 lines. SLOT_LABELS map, trpc.workshop.listChecklist.useQuery, loading/error/empty states, ✓ filled / ○ pending badges. |
| `app/(workspace)/workshops/[id]/_components/artifact-list.tsx` | Draft badge + Approve button | VERIFIED | Lines 56-64 `approveMutation` with invalidate+toast. Lines 118-122 Draft badge when reviewStatus==='draft'. Lines 139-153 Approve button gated by canManage && draft. Line 155 ExternalLink guarded by truthy url (for url='' LLM artifacts). |
| `app/(workspace)/workshops/[id]/page.tsx` | Mounts new components | VERIFIED | Lines 25-26 imports, line 96 StatusTransitionButtons usage, line 268 EvidenceChecklist usage. |
| `.planning/phases/17-workshop-lifecycle-recording-pipeline-groq/17-SMOKE.md` | Deferred walk procedure | VERIFIED | status=deferred, 5 walks preserved verbatim, plans_covered=[17-00..17-05], requirements_exercised=[WS-06, WS-12, WS-13, WS-14, LLM-01, LLM-02, LLM-03]. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| workshop.ts `transition` mutation | inngest/events.ts `sendWorkshopCompleted` | Conditional await when toStatus === 'completed' | WIRED | workshop.ts:552 `if (input.toStatus === 'completed') await sendWorkshopCompleted(...)`. Awaited (not fire-and-forget) — if Inngest send fails, transition fails. |
| workshop.ts `transition` mutation | workflow_transitions table | db.insert(workflowTransitions).values(...) | WIRED | workshop.ts:534-541 — insert with entityType='workshop', fromState, toState, actorId, metadata. |
| workshop.ts `attachArtifact` | inngest/events.ts `sendWorkshopRecordingUploaded` | Conditional await when artifactType==='recording' && r2Key | WIRED | workshop.ts:310-317 — conditional fire with workshopArtifactId from .returning(). |
| workshop-completed.ts | workshopEvidenceChecklist table | db.insert(...).onConflictDoNothing() | WIRED | workshop-completed.ts:62-67 — loops REQUIRED_SLOTS (5) with idempotent insert. |
| workshop-completed.ts | email.ts `sendWorkshopEvidenceNudgeEmail` | Direct import + call in nudge-72h/7d steps | WIRED | Line 10 import, lines 124-129 + 160-165 conditional calls after empty-slot check. |
| workshop-recording-processed.ts | llm.ts `transcribeAudio` / `summarizeTranscript` | Import and call in transcribe/summarize steps | WIRED | Line 12 import, line 67 transcribeAudio(buf, 'recording.mp3'), line 76 summarizeTranscript(transcript). |
| workshop-recording-processed.ts | r2.ts `getDownloadUrl` | Presigned GET in fetch-recording step | WIRED | Line 11 import, line 55 `getDownloadUrl(r2Key, 300)` → fetch → arrayBuffer → Buffer → base64. |
| workshop-recording-processed.ts | workshopArtifacts + evidenceArtifacts tables | db.insert with reviewStatus='draft' | WIRED | Lines 80-119 — 2 evidenceArtifacts + 2 workshopArtifacts with reviewStatus: 'draft'. |
| workshop-recording-processed.ts | workshopEvidenceChecklist table | db.update for 'recording' slot → 'filled' | WIRED | Lines 126-138 — flat update with slot='recording' and workshopId match. No-op if row doesn't exist yet (acceptable per plan). |
| inngest/functions/index.ts | workshop-completed.ts + workshop-recording-processed.ts | Barrel export in functions array | WIRED | Lines 4-5 imports, lines 18-19 array entries. Mounted at /api/inngest. |
| status-transition-buttons.tsx | workshop.transition (tRPC) | trpc.workshop.transition.useMutation | WIRED | Line 29 mutation, lines 54-59 mutate call with workshopId + toStatus. |
| evidence-checklist.tsx | workshop.listChecklist (tRPC) | trpc.workshop.listChecklist.useQuery | WIRED | Line 14 query by workshopId. |
| artifact-list.tsx | workshop.approveArtifact (tRPC) | trpc.workshop.approveArtifact.useMutation | WIRED | Line 56 mutation, lines 144-148 mutate call with workshopId + workshopArtifactId. |
| page.tsx | Both new UI components | Import + JSX mount | WIRED | Lines 25-26 import, lines 96 + 268 mount with correct props (workshopId, currentStatus, canManage). |
| groq-sdk single import point | src/lib/llm.ts | Single file imports from 'groq-sdk' | VERIFIED | `grep -r "from 'groq-sdk'" src/ app/` returns exactly one hit at src/lib/llm.ts:16. Wrapper contract enforced. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---------|---------------|--------|-------------------|--------|
| evidence-checklist.tsx | `rows` | `trpc.workshop.listChecklist.useQuery` → `db.select().from(workshopEvidenceChecklist).where(workshopId=...)` | Yes — DB query against Phase 17 table populated by workshopCompletedFn step 1 | FLOWING |
| status-transition-buttons.tsx | `currentStatus` prop | page.tsx via `trpc.workshop.getById` → `db.select({status: workshops.status, ...})` | Yes — `getById` now selects workshops.status (line 115) which is backed by real column from migration 0010 | FLOWING |
| artifact-list.tsx | `artifacts` | `trpc.workshop.listArtifacts` → `db.select({..., reviewStatus: workshopArtifacts.reviewStatus, workshopArtifactId: workshopArtifacts.id, ...})` | Yes — real DB columns from migration 0010; workshopRecordingProcessedFn writes draft rows into the same table | FLOWING |
| workshop-completed.ts `create-checklist` step | inserted rows | REQUIRED_SLOTS const tuple (5 real slot names) | Yes — real INSERT statements into workshop_evidence_checklist | FLOWING |
| workshop-recording-processed.ts `transcribe` step | `transcript` | `transcribeAudio(Buffer.from(audioBase64, 'base64'), 'recording.mp3')` → Groq Whisper API (mocked in tests, real Groq in prod with GROQ_API_KEY) | Yes in prod / mocked in tests | FLOWING (prod requires GROQ_API_KEY) |
| workshop-recording-processed.ts `summarize` step | `summary` | `summarizeTranscript(transcript)` → chatComplete → Groq llama-3.1-8b-instant | Yes in prod / mocked in tests | FLOWING (prod requires GROQ_API_KEY) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 17 Wave 0 contract tests pass | `npx vitest run src/lib/llm.test.ts src/inngest/__tests__/workshop-completed.test.ts src/inngest/__tests__/workshop-recording-processed.test.ts src/server/routers/workshop-transition.test.ts` | 4 test files, 19/19 tests passed (llm 4, workshop-completed 4, workshop-recording-processed 5, workshop-transition 6) | PASS |
| TypeScript compile clean | `npx tsc --noEmit` | exit 0, no errors | PASS |
| groq-sdk single import point enforced | `grep -r "from 'groq-sdk'" src/ app/` | Only `src/lib/llm.ts:16` — wrapper contract holds | PASS |
| Inngest barrel registers 5 functions | `grep -c workshopCompletedFn\|workshopRecordingProcessedFn src/inngest/functions/index.ts` | 2 imports + 2 array entries = 4 matches | PASS |
| Migration 0010 DDL present on disk | Read src/db/migrations/0010_workshop_lifecycle.sql | 49 lines, 4 CREATE TYPE, 2 ALTER TABLE columns, 1 CREATE TABLE with UNIQUE(workshop_id, slot) | PASS |
| UI components exist | ls app/(workspace)/workshops/[id]/_components/ | status-transition-buttons.tsx + evidence-checklist.tsx + modified artifact-list.tsx all present | PASS |
| 17-SMOKE.md has status: deferred | grep status: deferred in 17-SMOKE.md | 1 match with 5 walks preserved | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|-------------|-------------|--------|----------|
| WS-06 | 17-01, 17-05 | workshops.status enum with audited state transitions | SATISFIED | Migration 0010 enum + workflowTransitions audit + workshop.transition mutation with ALLOWED_TRANSITIONS server-side validation + StatusTransitionButtons UI. 6/6 workshop-transition.test.ts GREEN. Checked in REQUIREMENTS.md line 160 as [x]. |
| WS-12 | 17-03 | workshopCompleted Inngest fn fires 72h + 7d moderator nudges on missing evidence slots | SATISFIED | workshop-completed.ts steps sleep-72h/nudge-72h/sleep-7d/nudge-7d with empty-slot recheck at each wakeup + sendWorkshopEvidenceNudgeEmail helper. Absolute-time anchoring on event.ts. 4/4 workshop-completed.test.ts GREEN. REQUIREMENTS.md line 166. |
| WS-13 | 17-01, 17-03, 17-05 | Workshop has evidence checklist with required artifact slots (5: registration_export, screenshot, recording, attendance, summary) | SATISFIED | Migration 0010 workshop_evidence_checklist table + checklist_slot enum with exactly 5 values + workshopCompletedFn create-checklist step loops REQUIRED_SLOTS + EvidenceChecklist UI component with SLOT_LABELS + workshop.listChecklist tRPC query. REQUIREMENTS.md line 167. |
| WS-14 | 17-01, 17-04, 17-05 | Moderator recording upload triggers Groq Whisper + llama pipeline (moderator-reviewed before publish) | SATISFIED | R2 upload route recording category + 25MB cap + audio MIME allowlist + workshop.attachArtifact fires event + workshopRecordingProcessedFn 4-step pipeline + draft artifacts with reviewStatus='draft' + workshop.approveArtifact mutation + artifact-list.tsx Draft badge + Approve button. 5/5 workshop-recording-processed.test.ts GREEN. REQUIREMENTS.md line 168. |
| LLM-01 | 17-02, 17-04 | Groq SDK wrapper with fail-fast env validation | SATISFIED | src/lib/llm.ts is the single groq-sdk import point (verified via grep), requireEnv('GROQ_API_KEY') at line 22 + lazy init with env-driven cache reset. chatComplete and transcribeAudio both fail-fast throw on missing key. Test 1 of llm.test.ts GREEN. REQUIREMENTS.md line 198. |
| LLM-02 | 17-02, 17-04 | Workshop recording transcribed via whisper-large-v3-turbo in Inngest step.run; uploads > 25MB rejected at R2 presign | SATISFIED | llm.ts transcribeAudio uses model: 'whisper-large-v3-turbo', response_format: 'text'. workshop-recording-processed.ts transcribe step calls it inside step.run. app/api/upload/route.ts MAX_FILE_SIZE.recording = 25 * 1024 * 1024 with existing > maxSize guard. Tests 3 of llm.test.ts + 3 of workshop-recording-processed.test.ts GREEN. REQUIREMENTS.md line 199. |
| LLM-03 | 17-02, 17-04 | Workshop transcript summarized via llama-3.1-8b-instant with structured output (discussionPoints, decisions, actionItems) | SATISFIED | llm.ts summarizeTranscript calls chatComplete with model 'llama-3.1-8b-instant' + maxTokens: 1024 + JSON system prompt; returns {discussionPoints, decisions, actionItems} with parse fallback. chatComplete has TypeScript-mandatory maxTokens: number parameter enforcing max_tokens on every call at compile time. Tests 2 + 4 of llm.test.ts GREEN. REQUIREMENTS.md line 200. |

**Orphaned requirements:** None — all 7 phase requirement IDs declared across plans 17-00 through 17-05 and all mapped to real implementation. REQUIREMENTS.md mapping table confirms all 7 as Phase 17 / Complete (lines 372-378).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| app/api/upload/route.ts | 48-50 | TODO comment for rate limiting | Info | Pre-existing (not introduced by Phase 17); unrelated to workshop recording path |
| src/inngest/functions/workshop-completed.ts | 71-73, 122-125 | Comment references soft-degradation (acceptable) | Info | Intentional pattern per 17-03 SUMMARY deviation notes; not a stub |
| src/inngest/functions/workshop-recording-processed.ts | 122-125 | Comment about no-op update when checklist row doesn't exist | Info | Documented decision in 17-04 SUMMARY; acceptable per plan |

No blocker anti-patterns. No stub return values, no `return null` placeholders, no empty handlers, no hardcoded data that should be dynamic. The `url: ''` sentinel on LLM-generated evidenceArtifacts rows is a documented decision (content column carries the payload) — ArtifactList guards ExternalLink button with truthy `artifact.url` check.

### Full Test Suite Delta (Phase 17)

Per 17-05 SUMMARY phase acceptance gate:
- Phase 16 baseline: ~309 passing + 2 pre-existing deferred failures
- Phase 17 close: 328 passing / 2 failing / 1 todo of 331
- Failures are exactly the pre-existing Phase 16 deferred items (feedback-permissions.test.ts `denies admin/auditor`, section-assignments.test.ts import-time crash from live db connect)
- Phase 17 net: ~19 new tests added (6 workshop-transition + 4 llm + 4 workshop-completed + 5 workshop-recording-processed) all GREEN
- Inngest suite: 8 files / 36 + 1 todo passing

### Human Verification Required

The full 5-walk browser smoke procedure is deliberately deferred in `17-SMOKE.md` (status: deferred, defer_target: milestone-end batch) per `feedback_defer_smoke_walks.md`. All 5 walks are preserved verbatim and will be executed at `/gsd:complete-milestone` time.

Walks requiring human execution:
1. **Walk 1** — Workshop status transition UI + Inngest Dev UI observability (pre-req: dev server + Inngest dev CLI + live Neon)
2. **Walk 2** — 72h / 7d nudge fast-forward via Inngest Dev UI + real Resend email delivery
3. **Walk 3** — End-to-end mp3 upload → Groq Whisper → Groq llama → draft artifacts → moderator approve (pre-req: real GROQ_API_KEY + R2 + test mp3)
4. **Walk 4** — > 25MB upload rejection with friendly error
5. **Walk 5** — Groq console spot-check of `max_completion_tokens: 1024` in request body

### Gaps Summary

**No code-level gaps.** All 6 ROADMAP success criteria are implemented with real code paths — no placeholders, no TODO handlers, no disconnected wiring. Every observable truth maps to a concrete artifact that exists, is substantive, is wired, and produces real data. The Wave 0 TDD RED contract (19 locked assertions) ships fully GREEN in the 4 new test files. TypeScript compiles clean. groq-sdk single-import-point contract holds (`src/lib/llm.ts` is the only file importing from 'groq-sdk'). All phase requirement IDs (WS-06, WS-12, WS-13, WS-14, LLM-01, LLM-02, LLM-03) are traceable from REQUIREMENTS.md through plan frontmatter into implementation files.

**Why human_needed rather than passed:** 5 end-to-end behaviors — browser-visible status transitions, real Resend email delivery on nudge fast-forward, real Groq API calls on an mp3 upload, > 25MB upload rejection visible in browser, and Groq console request-body inspection — cannot be verified without running the dev server + Inngest dev CLI + real external services (Groq + Resend + R2). These are exactly the walks preserved in `17-SMOKE.md` with `status: deferred` for the milestone-end batch. The deferral is explicit and aligned with operator preference (`feedback_defer_smoke_walks.md`).

**Recommended verdict:** The phase goal is achieved at the code level. The phase can progress to milestone-close where the deferred smoke walks will finalize human verification. No re-planning required.

---

*Verified: 2026-04-14T13:30:00Z*
*Verifier: Claude (gsd-verifier, Opus 4.6)*
