---
phase: 18-async-evidence-pack-export
plan: 00
subsystem: testing
tags: [vitest, tdd, inngest, trpc, resend, r2, fflate, wave-0, red-contracts]

# Dependency graph
requires:
  - phase: 17-workshop-lifecycle-recording-pipeline-groq
    provides: "Plan 16/17 Pattern 2 (variable-path dynamic import + vi.hoisted shared mocks) reused verbatim"
  - phase: 16-flow-5-smoke-notification-dispatch-migration
    provides: "Pattern 2 dynamic import baseline; pre-existing 2 deferred test failures (section-assignments + feedback-permissions) carried forward"
provides:
  - 4 RED Wave 0 test files locking the contracts for Plans 18-01 and 18-02 (24 assertions total)
  - Schema + sender contract for evidence.export_requested Inngest event (EV-05)
  - 6-step pipeline contract for evidencePackExportFn (build-metadata -> list-binary-artifacts -> assemble-and-upload -> generate-presigned-url -> send-email -> write-audit-log) (EV-05 + EV-06)
  - Degraded-fallback semantics for binary fetch failures (EV-06)
  - sendEvidencePackReadyEmail contract (silent no-op, full Resend payload, degraded-mode body hint) (EV-07)
  - EvidencePackDialog async-flow contract (trpc.evidence.requestExport mutation, queued state, error+retry, no-download-link invariant) (EV-07)
  - evidence.requestExport tRPC mutation contract (BAD_REQUEST validation, sendEvidenceExportRequested call shape, audit log payload) (EV-05 trigger)
  - 18-VALIDATION.md frontmatter flipped: nyquist_compliant + wave_0_complete both true (gates 18-01 + 18-02 start)
affects: [phase-18-01-evidence-pack-fn, phase-18-02-trigger-surface]

# Tech tracking
tech-stack:
  added: []  # No new dependencies; reuses fflate, vitest, @testing-library/react already in repo
  patterns:
    - "Pattern 2 (variable-path dynamic import) applied to 4th + 5th + 6th locations in repo: events module, fn module, dialog module, evidence router module"
    - "vi.hoisted shared mock fixtures across 4 test files for buildEvidencePack, r2Client, getDownloadUrl, sendEvidencePackReadyEmail, writeAuditLog, fetch, db, inngest"
    - "fflate.unzipSync inspection of in-memory PutObjectCommand bodies as the canonical assertion mechanism for ZIP-content contracts"
    - "tRPC router._def.procedures probe to ensure validation-rejection tests fail at Wave 0 with procedure-missing rather than passing on Proxy hits"

key-files:
  created:
    - "src/inngest/__tests__/evidence-pack-export.test.ts (12 RED assertions)"
    - "src/lib/__tests__/email.test.ts (4 RED assertions)"
    - "src/__tests__/evidence-pack-dialog.test.ts (3 RED assertions)"
    - "src/server/routers/__tests__/evidence-request-export.test.ts (5 RED assertions)"
  modified:
    - ".planning/phases/18-async-evidence-pack-export/18-VALIDATION.md (flipped both gate flags + flipped task rows + checked Wave 0 reqs)"

key-decisions:
  - "Used .test.ts (not .test.tsx) for evidence-pack-dialog by routing JSX through React.createElement, since the plan files_modified list specified .ts and the file uses no real JSX literal"
  - "@testing-library/jest-dom is NOT installed in this repo; dialog test uses plain @testing-library/dom queries (screen.getByText throws on miss) instead of toBeInTheDocument matchers"
  - "Mocked @/src/lib/constants via importOriginal partial-mock pattern in the tRPC mutation test because evidenceRouter transitively requires ROLES export — full mock would have broken the router import"
  - "Inlined a fake inngest.createFunction in the fn test's @/src/inngest/client mock so the dynamic import of evidence-pack-export.ts can resolve once Plan 18-01 ships, while still letting the test stub inngest.send for the sender contract"
  - "Validation tests (4 + 5) for the tRPC mutation explicitly probe router._def.procedures.requestExport to avoid the Proxy false-positive where caller.requestExport returns a function reference even when the procedure is undefined"

patterns-established:
  - "Pattern 2 in repo: 6 locations now use variable-path dynamic import (3 from Phase 17 + 3 added here) — confirmed canonical mechanism for any TDD RED contract whose target module does not yet exist on disk"
  - "tRPC mutation RED contracts probe the internal _def.procedures registry to defeat the createCaller Proxy false-positive — first appearance of this pattern in the repo, future tRPC TDD waves should mirror"

requirements-completed: []  # Wave 0 contracts only — EV-05/EV-06/EV-07 are completed by Plans 18-01 and 18-02

# Metrics
duration: 40min
completed: 2026-04-14
---

# Phase 18 Plan 00: Wave 0 TDD Scaffolds Summary

**4 RED test files (24 assertions) lock the EV-05/EV-06/EV-07 contracts for Plans 18-01 and 18-02; 18-VALIDATION.md flipped to nyquist_compliant + wave_0_complete to release the depends_on gate**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-04-14T08:11:33Z
- **Completed:** 2026-04-14T08:51:32Z
- **Tasks:** 4 (Task 1, Task 2, Task 2b, Task 3)
- **Files created:** 4 test files
- **Files modified:** 1 (18-VALIDATION.md)

## Accomplishments

- 12 RED contracts locked for evidencePackExportFn covering schema, sender, 6-step pipeline, file-vs-link artifact handling, degraded fallback, R2 PutObjectCommand shape, presigned URL TTL, email payload, and audit log
- 4 RED contracts locked for sendEvidencePackReadyEmail covering silent no-ops + full Resend call shape + degraded-mode body hint
- 3 RED contracts locked for EvidencePackDialog async flow covering mutation invocation, queued state rendering, and error+retry path (with explicit no-download-link invariant)
- 5 RED contracts locked for evidence.requestExport tRPC mutation covering authorized return shape, sendEvidenceExportRequested call shape, audit log payload, and BAD_REQUEST input validation
- 18-VALIDATION.md frontmatter flipped (nyquist_compliant + wave_0_complete both true) — releases the Blocker 2 depends_on gate for Plans 18-01 and 18-02
- Per-task verification map pre-seeded with all 8 rows (4 from 18-00, 2 from 18-01, 2 from 18-02)

## Task Commits

Each task was committed atomically:

1. **Task 1: Write RED test for evidencePackExport Inngest fn (EV-05 + EV-06)** — `22a2c2d` (test)
2. **Task 2: Write RED test for sendEvidencePackReadyEmail + dialog queued state (EV-07)** — `e0fb0f4` (test)
3. **Task 2b: Write RED test for evidence.requestExport tRPC mutation (EV-05 trigger)** — `9f37884` (test)
4. **Task 3: Flip 18-VALIDATION.md to nyquist_compliant + wave_0_complete** — `6333c3d` (docs)

_TDD note: per the plan, Wave 0 RED tests are committed as a single `test(...)` per file rather than RED→GREEN pairs because the GREEN flip is the contract Plans 18-01 and 18-02 must satisfy._

## Files Created/Modified

### Created

- `src/inngest/__tests__/evidence-pack-export.test.ts` — 12 RED assertions; uses Pattern 2 variable-path dynamic import for `@/src/inngest/events` and `@/src/inngest/functions/evidence-pack-export`; vi.hoisted mocks for buildEvidencePack, r2Client, getDownloadUrl, sendEvidencePackReadyEmail, writeAuditLog, fetch, db, inngest; fflate.unzipSync inspection of in-memory PutObjectCommand body for file-vs-link artifact assertions and degraded-fallback verification
- `src/lib/__tests__/email.test.ts` — 4 RED assertions; resend package mocked at module level; vi.stubEnv + vi.resetModules between cases so the env-driven `resend` singleton is re-evaluated per test
- `src/__tests__/evidence-pack-dialog.test.ts` — 3 RED assertions; .ts (not .tsx) using React.createElement; mocks trpc.evidence.requestExport.useMutation and trpc.document.list.useQuery; uses plain @testing-library/dom queries (no jest-dom); Pattern 2 dynamic import for the dialog component
- `src/server/routers/__tests__/evidence-request-export.test.ts` — 5 RED assertions; mocks @/src/inngest/events.sendEvidenceExportRequested + @/src/lib/audit.writeAuditLog + @/src/db; importOriginal partial-mock for @/src/lib/constants; probes evidenceRouter._def.procedures.requestExport to defeat Proxy false-positives in validation tests

### Modified

- `.planning/phases/18-async-evidence-pack-export/18-VALIDATION.md` — frontmatter `nyquist_compliant: false → true`, `wave_0_complete: false → true`, status `draft → executing`; per-task verify map flipped to created/RED for 18-00 rows and pre-seeded pending for 18-01/18-02 rows; Wave 0 Requirements all checked; Validation Sign-Off all checked; Approval still pending pending Plans 18-01 + 18-02 GREEN flip

## Decisions Made

- **Dialog test extension is .ts, not .tsx:** Plan files_modified explicitly listed `.ts`. The test uses no JSX literals (React.createElement throughout) so `.ts` is valid and matches the plan contract exactly.
- **No jest-dom matchers:** `@testing-library/jest-dom` is not installed in this repo (only `@testing-library/react` + `@testing-library/dom`). Dialog test uses plain DOM queries — `screen.getByText(/regex/)` throws on miss, which is functionally equivalent to `expect(...).toBeInTheDocument()`. Documented inline in the test file header.
- **Partial-mock for @/src/lib/constants:** A full mock of `{ ACTIONS: {...} }` broke evidenceRouter import because it transitively requires `ROLES`. Used `vi.mock(..., async (orig) => ({ ...await orig() }))` to preserve all real exports while keeping the audit/inngest mocks intact.
- **Probe _def.procedures in mutation tests 4 + 5:** tRPC v11 `createCaller` returns a Proxy that yields a function reference for any path, so `caller.requestExport` is truthy even when the procedure does not exist. Without the `_def` probe, the validation tests would pass on a "No procedure found" rejection rather than RED-failing at Wave 0. The probe makes the failure mode unambiguous.
- **Inlined fake inngest.createFunction:** Mocked `@/src/inngest/client` so that when Plan 18-01 ships `evidence-pack-export.ts` (which calls `inngest.createFunction(...)` at module top-level), the test stub returns a synthetic function object with an `.id()` callable matching Inngest v4's surface — no real Inngest runtime needed.

## Deviations from Plan

None - plan executed exactly as written. The four tests were created with the exact assertion counts the plan specified (12 + 4 + 3 + 5 = 24), Pattern 2 dynamic imports applied where the plan said to, and all acceptance criteria (file existence, it() count, @vite-ignore presence, vi.hoisted presence, RED exit codes) verified after each task commit.

Two minor implementation details documented as Decisions Made (above) rather than deviations because they preserved the plan's intent exactly:
- Dialog test extension `.ts` matches the plan's files_modified list verbatim
- jest-dom matchers swapped for plain DOM queries because the dependency is absent (not removable)

## Issues Encountered

1. **First Task 2b run had constants mock missing ROLES export.** Vitest threw `[vitest] No "ROLES" export is defined on the "@/src/lib/constants" mock`. Fixed by switching from a full mock to `importOriginal` partial-mock pattern. Resolved within the task; no commit churn.
2. **First Task 2b run had 2 validation tests passing for the wrong reason.** `caller.requestExport` returned a Proxy hit, so `rejects.toThrow()` matched on `No procedure found` instead of failing RED. Strengthened tests 4 and 5 to probe `_def.procedures.requestExport` and assert `caught.code === 'BAD_REQUEST'`. After fix, all 5 tests RED for the right reason. Resolved within the task; no commit churn.
3. **Full suite shows 26 failed (24 expected + 2 pre-existing).** The 2 pre-existing failures (`section-assignments.test.ts`, `feedback-permissions.test.ts × 2`) are documented in Phase 16 deferred-items.md and STATE.md decisions log line 201 as out-of-scope. Verified by `git stash && npx vitest run [those files] && git stash pop` — they fail identically on HEAD without our changes. No collateral damage from this plan.

## Self-Check: PASSED

Verified after writing this SUMMARY:

**Files exist on disk:**
- FOUND: src/inngest/__tests__/evidence-pack-export.test.ts
- FOUND: src/lib/__tests__/email.test.ts
- FOUND: src/__tests__/evidence-pack-dialog.test.ts
- FOUND: src/server/routers/__tests__/evidence-request-export.test.ts
- FOUND: .planning/phases/18-async-evidence-pack-export/18-VALIDATION.md
- FOUND: .planning/phases/18-async-evidence-pack-export/18-00-SUMMARY.md

**Commits exist in git log:**
- FOUND: 22a2c2d (Task 1)
- FOUND: e0fb0f4 (Task 2)
- FOUND: 9f37884 (Task 2b)
- FOUND: 6333c3d (Task 3)

## Wave 0 Failure Counts (the locked Nyquist contract)

| Test File | RED Assertions | Run Command |
|---|---|---|
| `src/inngest/__tests__/evidence-pack-export.test.ts` | 12 | `npx vitest run src/inngest/__tests__/evidence-pack-export.test.ts` |
| `src/lib/__tests__/email.test.ts` | 4 | `npx vitest run src/lib/__tests__/email.test.ts` |
| `src/__tests__/evidence-pack-dialog.test.ts` | 3 | `npx vitest run src/__tests__/evidence-pack-dialog.test.ts` |
| `src/server/routers/__tests__/evidence-request-export.test.ts` | 5 | `npx vitest run src/server/routers/__tests__/evidence-request-export.test.ts` |
| **Total** | **24** | |

Full-suite baseline after this plan: **34 test files, 355 tests, 26 failed (24 new RED contracts + 2 pre-existing Phase 16 deferreds), 328 passed, 1 todo**.

## Handoff Notes

### To Plan 18-01

**16 RED contracts belong to you (12 fn + 4 email).** Flip them to GREEN by implementing:

1. `src/inngest/events.ts` additions:
   - `evidenceExportRequestedSchema` (z.object with documentId guid, requestedBy guid, userEmail string|null)
   - `evidenceExportRequestedEvent = eventType('evidence.export_requested', { schema })`
   - `sendEvidenceExportRequested(data): Promise<void>` calling `.validate()` then `inngest.send()`

2. `src/inngest/functions/evidence-pack-export.ts` (new file):
   - `evidencePackExportFn` via `inngest.createFunction({ id: 'evidence-pack-export', triggers: [...] }, handler)`
   - Handler MUST call `step.run` with these IDs in this order: `build-metadata`, `list-binary-artifacts`, `assemble-and-upload`, `generate-presigned-url`, `send-email`, `write-audit-log`
   - `build-metadata` invokes `buildEvidencePack(documentId)`
   - `list-binary-artifacts` filters `evidenceArtifacts.type === 'file'` for fetch + writes `binaries/{artifactId}-UNAVAILABLE.txt` for `type === 'link'`
   - Degraded fallback: when fetch fails for any binary, write `UNAVAILABLE.txt` placeholder + return `{ degraded: true }`
   - `assemble-and-upload` calls `r2Client.send(new PutObjectCommand({ Key: matches /^evidence-packs\/[^/]+-\d+\.zip$/, ContentType: 'application/zip', Body: ... }))`
   - `generate-presigned-url` calls `getDownloadUrl(r2Key, 86400)`
   - `send-email` calls `sendEvidencePackReadyEmail(userEmail, { documentTitle, downloadUrl, fileCount, totalSizeBytes, expiresAt, degraded })`
   - `write-audit-log` calls `writeAuditLog({ action: 'evidence_pack.export', entityType: 'document', entityId: documentId, payload: { async: true, ... } })`

3. `src/lib/email.ts` additions:
   - `sendEvidencePackReadyEmail(to, { documentTitle, downloadUrl, fileCount, totalSizeBytes, expiresAt, degraded? })`
   - Silent no-op when `to` is null/undefined or `RESEND_API_KEY` is unset
   - Subject contains "Evidence pack ready" (case-insensitive)
   - Text body MUST contain `downloadUrl` and `fileCount`
   - When `degraded: true`, body MUST contain one of: `unavailable | degraded | partial | some files`

### To Plan 18-02

**8 RED contracts belong to you (3 dialog + 5 mutation).** Flip them to GREEN by:

1. Adding to `src/server/routers/evidence.ts`:
   - `requestExport: requirePermission('evidence:export').input(z.object({ documentId: z.string().uuid() })).mutation(...)`
   - Mutation MUST call `sendEvidenceExportRequested({ documentId, requestedBy: ctx.user.id, userEmail: ctx.user.email })` exactly once
   - Mutation MUST call `writeAuditLog({ action: 'evidence_pack.export', entityType: 'document', entityId: input.documentId, payload: { async: true, stage: 'requested', ... } })`
   - Mutation MUST return `{ status: 'queued' }`
   - Input validation MUST fail with `BAD_REQUEST` for missing or non-uuid documentId
   - **Note:** If `requirePermission('evidence:export')` does not exist in the permission matrix, you'll need to add it. Auditor role MUST have `evidence:export`.

2. Rewriting `app/(workspace)/audit/_components/evidence-pack-dialog.tsx`:
   - Replace `fetch('/api/export/evidence-pack?...')` with `trpc.evidence.requestExport.useMutation()`
   - Replace `ExportState = 'idle' | 'loading' | 'complete' | 'error'` with `'idle' | 'queued' | 'error'`
   - Remove the `<a download>` link entirely (Wave 0 contract asserts `document.querySelectorAll('a[download]').length === 0` after queued state)
   - On Export click, call `mutate({ documentId: policyId })` — assertion uses `documentId: 'doc-1'`
   - On `data: { status: 'queued' }` (or `isSuccess`), render confirmation containing one of: `being generated | you'll get an email | queued | on its way`
   - On `error`, render the error message text + a "Retry" button
   - Action button label: keep `/export (pack|zip)/i` regex friendly — current "Export ZIP" is fine, plan-named "Export Pack" also fine

### To Phase Verifier (after 18-01 + 18-02)

- Full suite must drop from 26 failed → 2 failed (only the Phase 16 pre-existing deferred items remain)
- 18-VALIDATION.md task rows for 18-01 and 18-02 must flip from `pending` to `GREEN`
- Final `Approval` line in 18-VALIDATION.md flips from `pending` to a date

## Next Phase Readiness

- **Plans 18-01 and 18-02 unblocked.** `nyquist_compliant: true` + `wave_0_complete: true` in 18-VALIDATION.md release the Blocker 2 depends_on gate.
- **24 RED contracts on disk.** Plans 18-01 + 18-02 have a non-negotiable executable spec — they cannot ship without all 24 going GREEN.
- **Pattern 2 catalog grown by 3 locations.** Future TDD waves on this repo should reuse the same template.
- **No new dependencies introduced.** Plans 18-01 + 18-02 will need `fflate` (already installed), AWS SDK R2 client (already wired), Resend (already wired), and `@aws-sdk/client-s3` PutObjectCommand (already in use by Plan 09 evidence-pack.service).

---
*Phase: 18-async-evidence-pack-export*
*Plan: 00 (Wave 0 TDD scaffolds)*
*Completed: 2026-04-14*
