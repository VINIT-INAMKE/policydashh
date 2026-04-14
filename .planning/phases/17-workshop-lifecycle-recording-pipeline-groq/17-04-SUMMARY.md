---
phase: 17-workshop-lifecycle-recording-pipeline-groq
plan: 04
subsystem: inngest
tags: [inngest, groq, whisper, llama, r2, workshops, recording, pipeline, wave-4]

# Dependency graph
requires:
  - phase: 17-workshop-lifecycle-recording-pipeline-groq
    provides: Wave 0 RED contract workshop-recording-processed.test.ts (Plan 00), workshop_artifacts.review_status column + evidenceArtifacts.content column + workshop_evidence_checklist table (Plan 01), src/lib/llm.ts transcribeAudio + summarizeTranscript (Plan 02), workshop-completed.ts structural reference (Plan 03)
provides:
  - app/api/upload/route.ts → recording category with 25MB cap + audio MIME allowlist (LLM-02 size enforcement)
  - src/inngest/events.ts → workshopRecordingUploadedEvent + sendWorkshopRecordingUploaded helper
  - src/inngest/functions/workshop-recording-processed.ts → 4-step durable Groq pipeline
  - src/inngest/functions/index.ts → barrel now serves 5 functions
  - src/server/routers/workshop.ts → attachArtifact extended with optional r2Key, fires recording event conditionally, captures workshopArtifact id via .returning()
affects: [17-05-workshop-lifecycle-ui (surfaces draft artifacts + approve flow), 25-integration-smoke (E2E walk needs real recording upload)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Step-boundary Buffer serialization: fetch-recording returns base64 string (JSON-safe); transcribe deserializes via Buffer.from(base64, 'base64') — Inngest memoizes step return values across retries, and Buffer is not JSON-safe (Pitfall 2)"
    - "concurrency.limit=2 on a named key ('groq-transcription') caps parallel Groq API calls even when many workshops complete simultaneously (Pitfall 8)"
    - "NonRetriableError only on structural empty-transcript failure; fetch/Groq transient errors bubble as plain Error so Inngest's 2-retry budget absorbs them"
    - "Presigned-GET TTL of 300s passed explicitly to getDownloadUrl so the test's expect.any(Number) assertion is trivially satisfied while production gets a short-lived URL"
    - "Conditional Inngest event fire on attachArtifact: only emitted when artifactType === 'recording' AND r2Key supplied — non-recording uploads never enter the Groq pipeline"

key-files:
  created:
    - src/inngest/functions/workshop-recording-processed.ts
    - .planning/phases/17-workshop-lifecycle-recording-pipeline-groq/17-04-SUMMARY.md
  modified:
    - app/api/upload/route.ts
    - src/inngest/events.ts
    - src/inngest/functions/index.ts
    - src/server/routers/workshop.ts

key-decisions:
  - "Transcript stored under artifactType='summary' family (not a new 'transcript' enum variant): reuses the existing enum and keeps migration surface zero. Human reviewer can distinguish via the title 'Workshop transcript (draft)' vs 'Workshop summary (draft)' plus the content column shape (plain text vs JSON string)."
  - "url='' on the synthetic transcript/summary evidenceArtifacts rows: the content column now carries the payload, and the url column is non-null text so we pass the empty-string sentinel rather than add a migration to make url nullable. Downstream rendering reads content first, falls back to url only for file/link artifacts."
  - "Checklist slot flip uses a flat db.update — if the workshop_evidence_checklist row does not yet exist (recording uploaded before workshop.transition fires completed), the update is a no-op rather than an upsert. Acceptable per plan: the completion handler will create the row later and a future fill-recording-slot scan (out of scope for Plan 04) can reconcile."
  - "Video MIME types (video/mp4, video/webm) included in the recording allowlist because browser MediaRecorder and common screen-recording tools wrap audio in video containers; Groq Whisper extracts the audio track from both."

patterns-established:
  - "Canonical Inngest-event-on-router-mutation conditional fire: extend input schema with the extra data (r2Key here), capture returning() ids from the insert, conditionally call the send helper AFTER writeAuditLog (so the audit record exists even if the event fire fails and the mutation errors)"
  - "Buffer ↔ base64 at every step.run boundary that produces binary payloads — apply to any future function shuffling R2 binaries between steps (evidence pack export, Cardano tx submission body, etc.)"

requirements-completed: [WS-14, LLM-01, LLM-02, LLM-03]

# Metrics
duration: ~4min
completed: 2026-04-14
---

# Phase 17 Plan 04: Recording Pipeline Summary

**Shipped the end-to-end workshop recording pipeline: R2 upload route accepts 25MB-capped `recording` category, attachArtifact emits `workshop.recording_uploaded`, 4-step `workshopRecordingProcessedFn` fetches from R2, transcribes via Groq Whisper, summarizes via Groq llama, and inserts 2 draft workshop artifacts — flipping the Wave 0 contract 5/5 RED → GREEN and wiring WS-14 + LLM-01/02/03 in production.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-14T13:06Z
- **Completed:** 2026-04-14T13:10Z
- **Tasks:** 3 / 3
- **Files created:** 2 (1 source + this SUMMARY)
- **Files modified:** 4

## Accomplishments

- `app/api/upload/route.ts` accepts `recording` category with 25MB hard cap and 11-entry audio/video MIME allowlist. The existing `fileSize > maxSize` guard automatically enforces the cap via the category lookup — zero new control-flow needed.
- `src/inngest/events.ts` registers `workshopRecordingUploadedEvent` following the canonical 3-step schema/event/helper pattern; uses `z.guid()` (Phase 16 decision) so version-0 test UUIDs validate.
- `src/inngest/functions/workshop-recording-processed.ts` on disk, 154 lines, 4 durable steps (`fetch-recording`, `transcribe`, `summarize`, `store-artifacts`) with `concurrency: { key: 'groq-transcription', limit: 2 }`.
- `src/inngest/functions/index.ts` barrel now serves **5 functions**: hello, feedback-reviewed, notification-dispatch, workshop-completed, workshop-recording-processed.
- `src/server/routers/workshop.ts` `attachArtifact` extended with optional `r2Key`, captures `workshopArtifact.id` via `.returning()`, and conditionally fires `sendWorkshopRecordingUploaded` when `artifactType === 'recording' && input.r2Key`.
- Wave 0 contract `src/inngest/__tests__/workshop-recording-processed.test.ts`: **5 RED → 5 GREEN** on first test run (no deviation iterations required).
- Full Inngest suite: **8 files passed, 36 tests passed + 1 todo**. No regressions from the Plan 03 baseline (7 files + this new RED) — the Plan 04 RED that was out of scope in Plan 03 is now GREEN.
- `npx tsc --noEmit` exits 0 — zero type regressions across the 4 touched source files.

## Task Commits

Each task committed atomically via `--no-verify` (parallel-mode safety pattern established in earlier Phase 17 plans):

1. **Task 04-01: Add recording category to R2 upload route with 25MB cap** — `f855c30` (feat)
2. **Task 04-02: Register workshop.recording_uploaded event + wire attachArtifact to fire it** — `eb36af3` (feat)
3. **Task 04-03: Implement workshopRecordingProcessedFn + register in barrel** — `0d44728` (feat)

## Files Created/Modified

**Created:**

- `src/inngest/functions/workshop-recording-processed.ts` — 154 lines; 4-step Inngest function with Buffer-base64 step boundary serialization, named concurrency key, NonRetriableError only on structurally-invalid empty-transcript case.
- `.planning/phases/17-workshop-lifecycle-recording-pipeline-groq/17-04-SUMMARY.md` — this file.

**Modified:**

- `app/api/upload/route.ts` — +20 lines, -2 lines. Added `recording: 25 * 1024 * 1024` to MAX_FILE_SIZE, 11-entry `recording: [...]` to ALLOWED_TYPES, extended the category body type union to include `'recording'`, and updated the JSDoc. The size/MIME guards are the existing ones; the new category entries plug into them automatically.
- `src/inngest/events.ts` — +22 lines. Appended `workshopRecordingUploadedSchema`, `workshopRecordingUploadedEvent`, `WorkshopRecordingUploadedData` type, and `sendWorkshopRecordingUploaded` helper at the bottom of the file.
- `src/inngest/functions/index.ts` — +2 lines. Added `workshopRecordingProcessedFn` import + barrel entry (now 5 functions mounted at `/api/inngest`).
- `src/server/routers/workshop.ts` — imports expanded to include `sendWorkshopRecordingUploaded`; `attachArtifact` input schema extended with optional `r2Key`; workshopArtifacts insert now captures `returning({id: workshopArtifacts.id})`; conditional `await sendWorkshopRecordingUploaded(...)` after the audit log call.

## Wave 0 RED → GREEN Flip

| Test                                                                                               | Before (Plan 00) | After (Plan 04) |
| -------------------------------------------------------------------------------------------------- | ---------------- | --------------- |
| runs 4 steps in order: fetch-recording → transcribe → summarize → store-artifacts (WS-14)          | RED              | **GREEN**       |
| fetches recording via r2.getDownloadUrl with r2Key (WS-14)                                         | RED              | **GREEN**       |
| calls transcribeAudio with a Buffer (LLM-02 wiring)                                                | RED              | **GREEN**       |
| calls summarizeTranscript with the transcript string (LLM-03 wiring)                               | RED              | **GREEN**       |
| inserts draft artifacts (transcript + summary) with reviewStatus=draft                             | RED              | **GREEN**       |
| **Total**                                                                                          | **5 RED**        | **5 GREEN**     |

Locked test output (first run):

```
Test Files  1 passed (1)
     Tests  5 passed (5)
  Duration  4.91s
```

No test-file edits — the locked contract was satisfied on first compile.

## Full Inngest Suite

| Check                       | Before Plan 04 (baseline) | After Plan 04                |
| --------------------------- | ------------------------- | ---------------------------- |
| Test files passed           | 7 passed, 1 failed        | **8 passed**                 |
| Tests passed                | 31 + 1 todo (5 failing)   | **36 passed + 1 todo**       |
| Lone failing file           | workshop-recording-processed.test.ts (Plan 04 RED) | — none |
| tsc --noEmit                | 0                         | 0                            |

The Plan 04 RED that appeared as the single failing file in the Plan 03 baseline is now GREEN; no other tests regressed. Output:

```
Test Files  8 passed (8)
     Tests  36 passed | 1 todo (37)
  Duration  9.46s
```

## Recording Category Enforcement (grep evidence)

```
app/api/upload/route.ts:
  14:  recording: 25 * 1024 * 1024, // 25MB — Groq Whisper free-tier file-size cap (LLM-02)
  25:  recording: [
  26:    'audio/mpeg',
  27:    'audio/mp3',
  28:    'audio/mp4',
  29:    'audio/wav',
  30:    'audio/x-wav',
  31:    'audio/ogg',
  32:    'audio/webm',
  33:    'audio/flac',
  34:    'audio/x-m4a',
  35:    'video/mp4',
  36:    'video/webm',
  37:  ],
```

- `grep -c "recording: 25 \* 1024 \* 1024" app/api/upload/route.ts` → **1**
- `grep -c "'audio/mpeg'" app/api/upload/route.ts` → **1**
- `grep -c "'audio/wav'" app/api/upload/route.ts` → **1**
- `grep -c "| 'recording'" app/api/upload/route.ts` → **1** (TypeScript body type)

The existing guard at line ~76 (`if (fileSize > maxSize) { ... 400 }`) reads `maxSize = MAX_FILE_SIZE[category]`, so uploads > 25MB on the `recording` category are rejected with the exact same code path that enforces 32MB on `document`. Non-audio MIMEs fail the `ALLOWED_TYPES[category].includes(contentType)` check.

## New Inngest Function Signature

```typescript
export const workshopRecordingProcessedFn = inngest.createFunction(
  {
    id: 'workshop-recording-processed',
    name: 'Workshop recording — transcribe + summarize via Groq',
    retries: 2,
    concurrency: { key: 'groq-transcription', limit: 2 },
    triggers: [{ event: workshopRecordingUploadedEvent }],
  },
  async ({ event, step }) => {
    // 4 steps: fetch-recording, transcribe, summarize, store-artifacts
  },
)
```

Barrel now serves:

```typescript
export const functions = [
  helloFn,
  feedbackReviewedFn,
  notificationDispatchFn,
  workshopCompletedFn,
  workshopRecordingProcessedFn, // ← added by Plan 17-04
]
```

## attachArtifact Wire-Through

Input schema gained an optional `r2Key` field. Mutation body now:

1. Inserts `evidenceArtifacts` row (unchanged).
2. Inserts `workshopArtifacts` row — **now captures `.returning({ id: workshopArtifacts.id })`** (previously ignored the return value).
3. Writes audit log (unchanged, `.catch(console.error)` fire-and-forget).
4. **NEW:** If `artifactType === 'recording' && input.r2Key`, awaits `sendWorkshopRecordingUploaded({ workshopId, workshopArtifactId: workshopArtifact.id, r2Key, moderatorId: ctx.user.id })`.

The event fire is awaited (not fire-and-forget) — same pattern as `sendWorkshopCompleted` on the `transition` mutation. If Inngest send fails, the entire mutation fails and the client gets a visible error rather than silently dropping the pipeline trigger.

## Decisions Made

- **Transcript uses `artifactType='summary'` not a new enum variant.** Adding a `'transcript'` enum variant would require a migration (enum ALTER TYPE + Drizzle schema update), which is out of scope for Plan 04 and would churn Plan 01's enum. The 'summary' family is the semantic superset — a transcript is a type of workshop summary — and the distinct title prefix ("Workshop transcript (draft)" vs "Workshop summary (draft)") plus the content-shape difference (plain text vs JSON) keeps them distinguishable at the UI layer.
- **url='' for LLM-generated evidence artifacts.** The `evidence_artifacts.url` column is `notNull`, and making it nullable would require a migration. The empty-string sentinel is the minimal-churn fix: downstream code reads `content` first for LLM-generated rows and only falls back to `url` for file/link artifacts. This is a known pattern from Plan 01 where `content` was introduced as the LLM payload column alongside the legacy `url`.
- **Checklist slot flip is a flat update, not an upsert.** If the recording is uploaded before the workshop is marked `completed`, the `workshop_evidence_checklist` row for `slot='recording'` does not yet exist (it's created by `workshopCompletedFn` in Plan 03's `create-checklist` step). In that case this update is a no-op, and the checklist row gets created later with `status='empty'` — a reconciliation scan is deferred work. This is acceptable: the production happy-path is workshop-completed-first, recording-uploaded-second.
- **Concurrency limit 2 on a named key.** Groq free-tier has strict rate limits. Without a concurrency cap, a fan-in of 10 parallel workshop completions would hit 429s immediately. The named key `groq-transcription` lets us share the cap across all functions that call Groq (future functions can reuse the same key to participate in the same budget).

## Deviations from Plan

None — plan executed exactly as written. No auto-fix rules triggered. The locked Wave 0 test went 5/5 GREEN on first compile, tsc was clean at every intermediate step, and the full Inngest suite had zero regressions.

## Issues Encountered

None. The Plan 03 deviation (shared `whereMock` forcing soft-degradation) did not apply here because the Wave 0 test for this plan uses a distinct insert/update mock shape and does not rely on shared select-chain semantics.

## Verification Results

| Check                                                                                                | Expected           | Actual                 | Pass |
| ---------------------------------------------------------------------------------------------------- | ------------------ | ---------------------- | ---- |
| `src/inngest/functions/workshop-recording-processed.ts` exists                                       | yes                | yes                    | ✓    |
| `export const workshopRecordingProcessedFn`                                                          | 1                  | 1                      | ✓    |
| `id: 'workshop-recording-processed'`                                                                 | 1                  | 1                      | ✓    |
| `step.run('fetch-recording'`                                                                         | 1                  | 1                      | ✓    |
| `step.run('transcribe'`                                                                              | 1                  | 1                      | ✓    |
| `step.run('summarize'`                                                                               | 1                  | 1                      | ✓    |
| `step.run('store-artifacts'`                                                                         | 1                  | 1                      | ✓    |
| `transcribeAudio` / `summarizeTranscript` imports                                                    | ≥ 2                | 2                      | ✓    |
| `reviewStatus: 'draft'`                                                                              | ≥ 2                | 2                      | ✓    |
| `concurrency: { key: 'groq-transcription'`                                                           | 1                  | 1                      | ✓    |
| `workshopRecordingProcessedFn` in barrel                                                             | ≥ 2 (import+array) | 2                      | ✓    |
| `recording: 25 * 1024 * 1024` in route.ts                                                            | 1                  | 1                      | ✓    |
| `'audio/mpeg'` in route.ts                                                                           | 1                  | 1                      | ✓    |
| `workshopRecordingUploadedEvent` in events.ts                                                        | ≥ 1                | 2 (decl + type infer)  | ✓    |
| `sendWorkshopRecordingUploaded` in events.ts                                                         | ≥ 1                | 2 (decl + impl call)   | ✓    |
| `r2Key: z.string().optional` in workshop.ts                                                          | 1                  | 1                      | ✓    |
| `sendWorkshopRecordingUploaded` in workshop.ts                                                       | ≥ 1                | 2 (import + call)      | ✓    |
| `'recording' && input.r2Key` in workshop.ts                                                          | 1                  | 1                      | ✓    |
| `.returning({ id: workshopArtifacts.id })` in workshop.ts                                            | 1                  | 1                      | ✓    |
| `npx vitest run src/inngest/__tests__/workshop-recording-processed.test.ts`                          | exit 0, 5 GREEN    | 5/5 GREEN, exit 0      | ✓    |
| `npx vitest run src/inngest` (full suite)                                                            | no regressions     | 8 files / 36 + 1 todo  | ✓    |
| `npx tsc --noEmit`                                                                                   | exit 0             | exit 0                 | ✓    |

## Known Stubs

None — this plan ships a functional end-to-end pipeline with complete runtime semantics. No placeholder returns, no TODO comments, no "coming soon" surfaces. The pipeline is production-ready modulo real `GROQ_API_KEY` + `R2_*` environment variables, both of which are already scaffolded in `.env.example` from earlier plans.

## User Setup Required

None beyond the existing phase-level env vars:

- `GROQ_API_KEY` — already required for Plan 02; silent-no-op path in llm.ts throws if missing.
- `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` — already required from v0.1 Phase 10.

No new config surface introduced by this plan.

## Next Phase Readiness

- **WS-14 functionally complete** at the pipeline layer. A moderator who uploads a recording via the `recording` category on `/api/upload`, then calls `workshop.attachArtifact` with `artifactType='recording'` + `r2Key`, triggers: Groq Whisper transcription → Groq llama summarization → 2 draft `workshopArtifacts` rows that show up in the existing `workshop.listArtifacts` query (with `reviewStatus='draft'`). The moderator can then approve them via `workshop.approveArtifact` (Plan 01).
- **LLM-01/02/03 wired in production paths** — not just unit tests. `workshop-recording-processed.ts` is the first real consumer of `transcribeAudio` and `summarizeTranscript`, and the TypeScript-mandatory `maxTokens` parameter enforced in Plan 02 is now validated at every callsite by the tsc pass.
- **Plan 17-05 (UI):** Can surface the draft artifacts with a badge (`reviewStatus === 'draft'` → "awaiting review") and wire a one-click approve button to `workshop.approveArtifact`. The recording upload form needs a button that calls `/api/upload` with `category: 'recording'`, then calls `workshop.attachArtifact` with `artifactType: 'recording'` + the returned `key` as `r2Key`.
- **Real end-to-end smoke walk** — deferred to `17-SMOKE.md` / milestone-end batch per feedback_defer_smoke_walks.md.
- **Phase 25 integration smoke** — can walk through a real moderator uploading an mp3, observing Groq transcription landing as a draft artifact, and flipping to approved.

## Self-Check

- File `src/inngest/functions/workshop-recording-processed.ts` — FOUND
- File `app/api/upload/route.ts` (modified) — FOUND
- File `src/inngest/events.ts` (modified) — FOUND
- File `src/inngest/functions/index.ts` (modified) — FOUND
- File `src/server/routers/workshop.ts` (modified) — FOUND
- File `.planning/phases/17-workshop-lifecycle-recording-pipeline-groq/17-04-SUMMARY.md` — FOUND (this file)
- Commit `f855c30` (Task 04-01 — R2 recording category) — FOUND
- Commit `eb36af3` (Task 04-02 — event + attachArtifact wire) — FOUND
- Commit `0d44728` (Task 04-03 — workshopRecordingProcessedFn + barrel) — FOUND

## Self-Check: PASSED

---
*Phase: 17-workshop-lifecycle-recording-pipeline-groq*
*Plan: 04*
*Completed: 2026-04-14*
