---
phase: 18-async-evidence-pack-export
plan: 01
subsystem: inngest-backend
tags: [inngest, fflate, r2, resend, zip, presigned-url, audit, ev-05, ev-06, ev-07, wave-2]

# Dependency graph
requires:
  - phase: 18-async-evidence-pack-export
    plan: 00
    provides: "16 RED Wave 0 contracts locking the evidenceExportRequestedEvent + evidencePackExportFn + sendEvidencePackReadyEmail shape (12 fn + 4 email). nyquist_compliant + wave_0_complete gates flipped true."
  - phase: 17-workshop-lifecycle-recording-pipeline-groq
    provides: "Inngest step.run JSON-safe return pattern (Pitfall 2: Uint8Array/Buffer cannot cross a step boundary)"
  - phase: 16-flow-5-smoke-notification-dispatch-migration
    provides: "z.guid() vs z.uuid() rule for Wave 0 fixtures; inlined triggers per README §90-94 (type widening footgun)"
provides:
  - "evidenceExportRequestedEvent + sendEvidenceExportRequested helper in src/inngest/events.ts (EV-05 dispatch)"
  - "sendEvidencePackReadyEmail helper in src/lib/email.ts with silent-no-op guard + degraded-mode body hint (EV-07)"
  - "evidencePackExportFn 6-step Inngest pipeline in src/inngest/functions/evidence-pack-export.ts (EV-05 + EV-06 + EV-07)"
  - "Barrel registration in src/inngest/functions/index.ts so the function is mounted at /api/inngest"
  - "RFC JSDoc block documenting PutObjectCommand vs multipart upload deferral (amended ROADMAP Phase 18 SC-3)"
  - "16 Wave 0 RED contracts flipped to GREEN (12 fn + 4 email)"
affects: [phase-18-02-trigger-surface]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — fflate, @aws-sdk/client-s3, drizzle-orm, inngest, resend all already present
  patterns:
    - "Single-innerJoin + sql\\`EXISTS (subquery)\\` query shape — lets each db.select() chain match the Wave 0 test mock (from().innerJoin().where()) while still correctly filtering by policyDocuments.id at runtime via a correlated subquery"
    - "Uint8Array -> number[] at step.run boundaries, rehydrated inside the next step (Phase 17 Pitfall 2 pattern applied at the build-metadata -> assemble-and-upload seam)"
    - "Manual R2 key construction (evidence-packs/{documentId}-{Date.now()}.zip) instead of the generic r2 helper — preserves readable documentId-timestamp sort order required by amended ROADMAP SC-3"
    - "Inlined presigned GET (5 min TTL) per binary fetch inside the single assemble-and-upload step — avoids serializing binary bytes across step boundaries while still honoring R2 access control"

key-files:
  created:
    - "src/inngest/functions/evidence-pack-export.ts (371 lines — full 6-step pipeline + helpers + RFC JSDoc)"
    - ".planning/phases/18-async-evidence-pack-export/18-01-SUMMARY.md"
  modified:
    - "src/inngest/events.ts (+23 lines — evidenceExportRequestedSchema + event + sender, appended at end, no existing code touched)"
    - "src/lib/email.ts (+48 lines — sendEvidencePackReadyEmail as 5th helper, appended after sendWorkshopEvidenceNudgeEmail)"
    - "src/inngest/functions/index.ts (+2 lines — import + array append for evidencePackExportFn)"
    - "src/inngest/__tests__/evidence-pack-export.test.ts (Rule 3 blocker fix: swap .resolves.toBeDefined() -> .resolves.toBeUndefined() on the accepts-valid-payload test because Inngest v4 .validate() returns Promise<void>; assertion intent preserved — validation resolves without throwing)"
    - "src/lib/__tests__/email.test.ts (Rule 3 blocker fix: swap arrow function -> function expression inside vi.fn().mockImplementation because vitest v4 rejects non-function/non-class implementations when the mock is used as a constructor)"

key-decisions:
  - "Query structure: single innerJoin + sql\\`EXISTS (...)\\` subquery (not chained double-innerJoin). Required because the Wave 0 fn test fixture mocks db.select as from().innerJoin().where() — a two-level innerJoin chain would call .innerJoin() on an object that exposes only .where. The EXISTS form keeps the chain one level deep and produces correct SQL at runtime."
  - "actorRole='auditor' in the audit log payload: the evidence.export_requested event schema carries only documentId, requestedBy, userEmail — no role field. Auditor is the conservative default because evidence:export is held only by auditor + admin in the current permission matrix. Plan 18-02 may revisit if it adds role to the event."
  - "process.env.R2_BUCKET_NAME! direct read inside PutObjectCommand: src/lib/r2.ts requires the env var at import time via requireEnv() but does not export it. Rather than refactoring r2.ts to export the constant, we read it with a non-null assertion inside the step — safe because r2Client's own import has already proven the var is set."
  - "Sequential binary fetch loop (not Promise.all): one binary in flight at a time. Keeps memory use predictable (one arrayBuffer allocated at a time) and makes degraded-mode accounting trivial (no race conditions on the missing[] accumulator). Parallelism can be added later if throughput ever matters."
  - "Buffered single PUT via PutObjectCommand instead of multipart upload: typical packs <100MB; simpler code; file-level RFC JSDoc block documents the upgrade path via fflate's streaming Zip class + UploadPartCommand for when packs routinely exceed the threshold. Matches the amended ROADMAP Phase 18 Success Criterion 3 which explicitly accepted the deferral."

requirements-completed: [EV-05, EV-06, EV-07]
# Note: EV-05 (async dispatch) and EV-06 (degraded R2 streaming) are
# backend-complete here; EV-07 (email delivery) is backend-complete here.
# The trigger surface (mutation + dialog + sync-route removal) remains for
# Plan 18-02 — until then, EV-05 is "the function exists and is registered"
# rather than "stakeholders can actually request exports from the UI".

# Metrics
duration: 30min
completed: 2026-04-14
---

# Phase 18 Plan 01: Backend async evidence-pack pipeline Summary

**6-step Inngest function (build-metadata -> list-binary-artifacts -> assemble-and-upload -> generate-presigned-url -> send-email -> write-audit-log) with fflate zipSync + R2 PutObjectCommand + 24h presigned GET delivery via Resend. Flips 16 Wave 0 RED contracts to GREEN.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-14T14:28:00Z
- **Completed:** 2026-04-14T14:45:00Z
- **Tasks:** 2 (Task 1 event + email helper; Task 2 fn + barrel)
- **Files created:** 1 (evidence-pack-export.ts)
- **Files modified:** 5 (events.ts, email.ts, index.ts + 2 Wave 0 test fix-ups)

## Accomplishments

- **evidenceExportRequestedEvent** + **sendEvidenceExportRequested** appended to src/inngest/events.ts, matching the workshopCompletedEvent shape exactly (z.guid for ids, z.string().email().nullable() for userEmail, .validate() before inngest.send).
- **sendEvidencePackReadyEmail** added to src/lib/email.ts as the 5th email helper. Silent no-op when RESEND_API_KEY unset or `to` is null/undefined. Subject includes "Evidence pack ready" (plus "(partial)" when degraded). Body contains downloadUrl, fileCount, size in MB, expiresAt, and a degraded-mode note that surfaces "unavailable" for the Wave 0 regex.
- **evidencePackExportFn** created in src/inngest/functions/evidence-pack-export.ts with all six step IDs in the contract order and all behavioral guarantees:
  - build-metadata calls buildEvidencePack(documentId) and serializes to number[] at the step boundary
  - list-binary-artifacts pulls feedback-attached and section-attached evidenceArtifacts via single-innerJoin + sql\`EXISTS (...)\` subqueries, deduped by artifact id
  - assemble-and-upload fetches each file artifact via a 5-minute internal presigned GET with 30s AbortController timeout; link-type artifacts and fetch failures write binaries/{id}-UNAVAILABLE.txt placeholders and bump missing[]; ZIP assembled with fflate zipSync (level 6) and uploaded via PutObjectCommand at the manually constructed evidence-packs/{documentId}-{timestamp}.zip key with ContentType application/zip and an attachment ContentDisposition
  - generate-presigned-url returns getDownloadUrl(r2Key, 86400) — 24h TTL per EV-07
  - send-email fetches the document title and calls sendEvidencePackReadyEmail with the full metadata including degraded flag
  - write-audit-log writes ACTIONS.EVIDENCE_PACK_EXPORT against entityType='document' with payload.async=true plus r2Key, fileCount, totalBytes, degraded
- **Barrel registration:** evidencePackExportFn appended to src/inngest/functions/index.ts so the Inngest route handler at /api/inngest now serves it.
- **File-level RFC JSDoc block** documents the PutObjectCommand vs multipart upload decision + upgrade path, matching the amended ROADMAP Phase 18 Success Criterion 3.
- **16 Wave 0 RED contracts flipped to GREEN:** 12 fn tests + 4 email tests, all passing in a single `npx vitest run` invocation.

## Task Commits

1. **Task 1: evidenceExportRequestedEvent + sendEvidencePackReadyEmail** — `9058f45` (feat)
2. **Task 2: evidencePackExportFn 6-step pipeline + barrel** — `a3a4061` (feat)

## Files Created/Modified

### Created

- `src/inngest/functions/evidence-pack-export.ts` — 371 lines. Imports only `r2Client`, `getDownloadUrl`, `R2_PUBLIC_URL` from `@/src/lib/r2` (no key-helper import). Exports `evidencePackExportFn`. File-level JSDoc contains the RFC block on PutObjectCommand vs multipart plus pointers to Pitfall 2 and Pitfall 7.
- `.planning/phases/18-async-evidence-pack-export/18-01-SUMMARY.md` (this file)

### Modified

- `src/inngest/events.ts` — appended `evidenceExportRequestedSchema` + `evidenceExportRequestedEvent` + `EvidenceExportRequestedData` + `sendEvidenceExportRequested` after the `workshop.recording_uploaded` block. No existing exports touched.
- `src/lib/email.ts` — appended `sendEvidencePackReadyEmail` after `sendWorkshopEvidenceNudgeEmail`. Silent-no-op guard count: 5 (unchanged pattern).
- `src/inngest/functions/index.ts` — one new import + one new array entry tagged `// Phase 18`.
- `src/inngest/__tests__/evidence-pack-export.test.ts` — Rule 3 blocker fix: the "accepts valid payload" test asserted `.resolves.toBeDefined()` but Inngest v4 `.validate()` is `Promise<void>`. Swapped to `.resolves.toBeUndefined()`; assertion intent ("validation resolves without throwing") preserved.
- `src/lib/__tests__/email.test.ts` — Rule 3 blocker fix: the Wave 0 `vi.mock('resend', ...)` factory passed an arrow function to `vi.fn().mockImplementation`, which vitest v4 rejects as non-constructor ("did not use 'function' or 'class'"). Swapped to a `function` expression; all 4 email assertions unchanged.

## Decisions Made

- **Single-innerJoin + EXISTS subquery for the artifact-list step.** The Wave 0 fn test mocks `db.select` with a one-level chain (`from().innerJoin().where()`), so a naive double-innerJoin over feedbackEvidence -> evidenceArtifacts -> feedbackItems would hit a `.innerJoin is not a function` error at runtime inside the mock. Rewrote both queries (feedback-attached and section-attached) to join just two tables and push the third-table filter into a `sql\`EXISTS (SELECT 1 FROM ... WHERE ... = ... AND documentId = ...)\`` correlated subquery. Valid Postgres, matches the mock shape, and dedupes correctly on the id in a `Set<string>`.
- **actorRole='auditor'** in the audit log. The event schema doesn't carry role. Auditor is the conservative default in the current permission matrix.
- **`process.env.R2_BUCKET_NAME!`** direct read inside the step. Simpler than refactoring r2.ts to export the constant.
- **Sequential binary fetch loop.** Predictable memory; trivial degraded-mode accounting.
- **PutObjectCommand not multipart.** Bounded pack sizes; RFC JSDoc documents the upgrade path per the amended ROADMAP SC-3.
- **Used strToU8 (not strFromU8) for placeholder text.** strToU8 encodes a JS string to Uint8Array, which is what fflate's input map expects. strFromU8 is the reverse (decode) and would not compile.

## Deviations from Plan

**Rule 3 blocker fixes (test infrastructure):**

1. **[Rule 3 - Blocker] Wave 0 email test used an arrow inside vi.fn().mockImplementation, which vitest v4 treats as a non-constructor.**
   - **Found during:** Task 1 verify step.
   - **Issue:** `vi.mock('resend', () => ({ Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })) }))` triggered `TypeError: () => (...) is not a constructor` at src/lib/email.ts:4 when the helper's module-level `new Resend(...)` ran, because vitest v4 now requires `function` or `class` inside a mockImplementation used with `new`.
   - **Fix:** Swapped the arrow for a `function () { return { emails: { send: sendMock } } }`. Assertions unchanged, 4 email tests GREEN.
   - **Files modified:** `src/lib/__tests__/email.test.ts`
   - **Commit:** `9058f45`

2. **[Rule 3 - Blocker] Wave 0 fn test 'accepts valid payload' misread the Inngest v4 validate() return type.**
   - **Found during:** Task 2 verify step.
   - **Issue:** The test asserted `await expect(ok.validate()).resolves.toBeDefined()`. Inngest v4's `UnvalidatedCreatedEvent.validate` is typed as `() => Promise<void>` and the runtime implementation resolves with `undefined`. `.toBeDefined()` on `undefined` fails.
   - **Fix:** Swapped to `.resolves.toBeUndefined()` so the assertion matches Inngest's actual contract; intent ("validation resolves without throwing, i.e. the payload is valid") is preserved. All other existing sendX helpers in the events registry follow the same Promise<void> pattern.
   - **Files modified:** `src/inngest/__tests__/evidence-pack-export.test.ts`
   - **Commit:** `a3a4061`

No other deviations. Rules 1 and 2 did not fire — the plan's `<action>` blocks contained the correct code and the only fixes were to test infrastructure that predated the current vitest/Inngest versions.

## Authentication Gates

None. Nothing in this plan required live R2 / Resend / Inngest credentials; everything is unit-tested with mocks.

## Issues Encountered

1. **Wave 0 email mock factory rejected by vitest v4.** Documented above as Rule 3 fix #1.
2. **Wave 0 fn test asserted `.toBeDefined()` against Inngest's `Promise<void>` validator.** Documented above as Rule 3 fix #2.

No other issues. `npx tsc --noEmit` is clean on the modified files. No new ESLint warnings introduced.

## Test Results

### Target files (Wave 0 contracts)

| Test file | Before (Wave 0) | After (Wave 2) |
|---|---|---|
| `src/inngest/__tests__/evidence-pack-export.test.ts` | 12 RED | **12 GREEN** |
| `src/lib/__tests__/email.test.ts` | 4 RED | **4 GREEN** |
| **Subtotal (this plan's contracts)** | **16 RED** | **16 GREEN** |

### Full suite

- Before Plan 18-01: 34 test files, 355 tests, **26 failed** (24 Wave 0 REDs + 2 pre-existing Phase 16 deferreds).
- After Plan 18-01: 34 test files, 355 tests, **10 failed** (3 dialog + 5 mutation Plan 18-02 Wave 0 REDs + 2 pre-existing Phase 16 deferred items).
- **Delta:** -16 failures (matches the 16 contracts this plan owned).
- **Zero regressions.** The only remaining failures are (a) the 8 Plan 18-02 contracts, and (b) the 2 documented Phase 16 deferred items (`section-assignments.test.ts`, `feedback-permissions.test.ts`).

## Self-Check: PASSED

**Files exist on disk:**

- FOUND: `src/inngest/events.ts` (contains `evidenceExportRequestedEvent`, `sendEvidenceExportRequested`, `z.guid()`)
- FOUND: `src/lib/email.ts` (contains `sendEvidencePackReadyEmail`, `if (!resend || !to) return`)
- FOUND: `src/inngest/functions/evidence-pack-export.ts` (371 lines, 6 `step.run(` occurrences, 0 `generateStorageKey` occurrences, contains `triggers: [{ event: evidenceExportRequestedEvent }]`)
- FOUND: `src/inngest/functions/index.ts` (contains `evidencePackExportFn` import + array entry)
- FOUND: `.planning/phases/18-async-evidence-pack-export/18-01-SUMMARY.md`

**Grep assertions:**

- `grep -c "step.run(" src/inngest/functions/evidence-pack-export.ts` → **6** (matches the 6 required step IDs)
- `grep -q "generateStorageKey" src/inngest/functions/evidence-pack-export.ts` → **no match** (Warning 4 satisfied)
- `grep -q "getDownloadUrl.*86400" src/inngest/functions/evidence-pack-export.ts` → match (24h presigned GET)
- `grep -q "PutObjectCommand" src/inngest/functions/evidence-pack-export.ts` → match
- `grep -q "UNAVAILABLE" src/inngest/functions/evidence-pack-export.ts` → match

**Commits exist in git log:**

- FOUND: `9058f45 feat(18-01): add evidenceExportRequested event + sendEvidencePackReadyEmail`
- FOUND: `a3a4061 feat(18-01): add evidencePackExportFn with 6-step async pipeline`

**Tests:**

- `npx vitest run src/inngest/__tests__/evidence-pack-export.test.ts src/lib/__tests__/email.test.ts` → **16/16 passed** (2 files)
- `npx tsc --noEmit` → clean (no output, exit 0)

## Handoff to Plan 18-02

**Backend is complete and contract-green.** Plan 18-02 owns the trigger surface:

1. **tRPC mutation** `evidence.requestExport` in `src/server/routers/evidence.ts`:
   - Guarded by `requirePermission('evidence:export')` (add the permission to the matrix if it's missing — auditor + admin only)
   - Input: `z.object({ documentId: z.string().uuid() })`
   - Calls `sendEvidenceExportRequested({ documentId, requestedBy: ctx.user.id, userEmail: ctx.user.email })` exactly once
   - Calls `writeAuditLog({ action: 'evidence_pack.export', entityType: 'document', entityId: input.documentId, payload: { async: true, stage: 'requested', ... } })`
   - Returns `{ status: 'queued' }`
   - `BAD_REQUEST` on missing or non-uuid documentId
   - Flips `src/server/routers/__tests__/evidence-request-export.test.ts` (5 RED -> 5 GREEN)

2. **Dialog rewrite** `app/(workspace)/audit/_components/evidence-pack-dialog.tsx`:
   - Replace the old `fetch('/api/export/evidence-pack?...')` + `<a download>` flow with `trpc.evidence.requestExport.useMutation()`
   - New state machine: `idle -> queued -> error` (remove the `complete` state entirely)
   - Queued state renders "being generated | you'll get an email | queued | on its way" and NO `<a download>` element (invariant asserted by Wave 0)
   - Error state renders the error + a Retry button
   - Mutation payload: `mutate({ documentId: 'doc-1' })` (the Wave 0 fixture uses doc-1)
   - Flips `src/__tests__/evidence-pack-dialog.test.ts` (3 RED -> 3 GREEN)

3. **Sync route removal** `app/api/export/evidence-pack/route.ts`:
   - Delete the route file and its test (if any) — the async flow supersedes it. Confirm no other callers first (`rg "api/export/evidence-pack"`).

4. **No other backend changes needed.** The Inngest function, email helper, and event schema from this plan are the final shape Plan 18-02 wires into.

## Wave 0 Failure Count Delta

| Boundary | Failed | Passed | Notes |
|---|---|---|---|
| Before 18-00 (Wave 0) | 2 | 328 | 2 pre-existing Phase 16 deferreds |
| After 18-00 | 26 | 328 | +24 Wave 0 REDs locked |
| After 18-01 (this plan) | **10** | **344** | -16 (Plan 18-01 contracts flipped) |
| After 18-02 (future) | 2 (target) | 352 (target) | -8 Plan 18-02 contracts |

## Next Phase Readiness

- **Plan 18-02 is unblocked.** Its contracts still RED and exactly the 8 they were locked as (3 dialog + 5 mutation).
- **Backend complete.** evidencePackExportFn is mounted in the Inngest barrel; any `inngest.send('evidence.export_requested', ...)` call from anywhere in the codebase will now fire the pipeline end-to-end once the trigger surface is wired.
- **No new dependencies introduced.** fflate, @aws-sdk/client-s3, drizzle-orm, inngest, and resend were all already present.
- **RFC deferral documented.** Future multipart upload upgrade path is captured at the top of evidence-pack-export.ts in the file-level JSDoc block, matching amended ROADMAP Phase 18 SC-3.

---
*Phase: 18-async-evidence-pack-export*
*Plan: 01 (backend pipeline)*
*Completed: 2026-04-14*
