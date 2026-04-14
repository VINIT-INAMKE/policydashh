---
phase: 18-async-evidence-pack-export
verified: 2026-04-14T15:00:00Z
status: passed
score: 5/5 success criteria verified
re_verification: false
gaps: []
human_verification:
  - test: "End-to-end evidence pack download via live email link"
    expected: "Auditor clicks Export Evidence Pack, receives toast, later receives email with a working 24h presigned S3/R2 GET URL that downloads a valid ZIP containing CSVs, JSONs, and R2 binaries"
    why_human: "Requires real Inngest dev server + Resend sandbox + R2 dev bucket. Deferred to milestone smoke walk per standing user preference."
---

# Phase 18: Async Evidence Pack Export — Verification Report

**Phase Goal:** Evidence pack export runs async via Inngest with R2 binary inclusion; completed pack is uploaded and delivered via presigned-GET email link
**Verified:** 2026-04-14T15:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin/Auditor clicks "Export Evidence Pack" → receives toast "Your pack is being generated, you will get an email when ready" | VERIFIED | `evidence-pack-dialog.tsx` line 76: `toast.success('Your pack is being generated, you will get an email when ready')`. Dialog state derives from `requestExport.isSuccess`; queued card renders "Your pack is being generated." / "You will get an email when ready." |
| 2 | `evidencePackExport` Inngest fn gathers metadata (CSVs/JSONs) and fetches R2 binaries via streaming download | VERIFIED | `src/inngest/functions/evidence-pack-export.ts` step `build-metadata` calls `buildEvidencePack(documentId)`; step `list-binary-artifacts` queries feedback-attached + section-attached evidenceArtifacts; step `assemble-and-upload` calls `fetchBinaryWithTimeout()` per file-type artifact via a 5-min presigned GET |
| 3 | fflate `zipSync` assembles the archive; uploads to `evidence-packs/{documentId}-{timestamp}.zip` via R2 `PutObjectCommand`; multipart streaming deferred and documented | VERIFIED | Line 287: `zipSync(files, { level: 6 })`; line 293: `evidence-packs/${documentId}-${Date.now()}.zip`; line 295-303: `r2Client.send(new PutObjectCommand({...}))`; file-level JSDoc RFC block documents multipart upgrade path |
| 4 | Requester receives email with presigned-GET URL (24h expiry) and pack metadata (file count, total size, timestamp) | VERIFIED | Step `generate-presigned-url` calls `getDownloadUrl(uploadResult.r2Key, 86400)` (line 316); step `send-email` calls `sendEvidencePackReadyEmail(userEmail, { documentTitle, downloadUrl, fileCount, totalSizeBytes, expiresAt, degraded })` |
| 5 | Fallback: binary fetch failure → UNAVAILABLE.txt placeholders + degraded mode; function does NOT throw | VERIFIED | `fetchBinaryWithTimeout` returns `{ ok: false, error }` on timeout or non-2xx; `unavailablePlaceholder()` writes `binaries/{artifactId}-UNAVAILABLE.txt`; link-type artifacts also get placeholders; `degraded: missing.length > 0` returned from step; no throw in any failure branch |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/inngest/events.ts` | `evidenceExportRequestedEvent` + `sendEvidenceExportRequested` helper | VERIFIED | Lines 203-225: schema uses `z.guid()` for documentId + requestedBy, `z.string().email().nullable()` for userEmail; event name `evidence.export_requested`; send helper calls `.validate()` then `inngest.send()` |
| `src/inngest/functions/evidence-pack-export.ts` | 6-step Inngest pipeline (min 200 lines) | VERIFIED | 366 lines; exports `evidencePackExportFn`; all 6 step IDs present in contract order |
| `src/inngest/functions/index.ts` | Barrel — evidencePackExportFn appended | VERIFIED | Line 6: `import { evidencePackExportFn } from './evidence-pack-export'`; line 21: `evidencePackExportFn, // Phase 18` in the functions array |
| `src/lib/email.ts` | `sendEvidencePackReadyEmail` (5th email helper) | VERIFIED | Defined at line 106; silent no-op guard `if (!resend \|\| !to) return` at line 117 (5th occurrence across the file) |
| `src/server/routers/evidence.ts` | `evidence.requestExport` mutation appended | VERIFIED | Lines 214-249: guarded by `requirePermission('evidence:export')`, input `z.guid()`, fires `sendEvidenceExportRequested`, writes fire-and-forget audit log, returns `{ status: 'queued' as const }` |
| `app/(workspace)/audit/_components/evidence-pack-dialog.tsx` | Async-mode dialog: tRPC mutation + queued state, no blob handling | VERIFIED | `ExportState = 'idle' \| 'queued' \| 'error'`; `trpc.evidence.requestExport.useMutation()`; no `downloadUrl`, no `URL.createObjectURL`, no `fetch(` |
| `app/api/export/evidence-pack/route.ts` | DELETED — sync route removed | VERIFIED | File does not exist on disk; only reference is a comment in `evidence.ts` line 215 ("Replaces the deleted sync GET...") |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `evidence-pack-dialog.tsx` | `evidence.requestExport` mutation | `trpc.evidence.requestExport.useMutation()` | WIRED | Line 59 of dialog; `requestExport.mutate({ documentId: policyId })` on Export click |
| `evidence.ts` (requestExport) | `sendEvidenceExportRequested` | `import { sendEvidenceExportRequested } from '@/src/inngest/events'` | WIRED | Import at line 12; `await sendEvidenceExportRequested({...})` at line 227 |
| `evidence-pack-export.ts` | `buildEvidencePack` service | `import { buildEvidencePack } from '@/src/server/services/evidence-pack.service'` | WIRED | Line 15; called as `buildEvidencePack(documentId)` inside `build-metadata` step |
| `evidence-pack-export.ts` | `r2Client + getDownloadUrl + R2_PUBLIC_URL` | `import { r2Client, getDownloadUrl, R2_PUBLIC_URL } from '@/src/lib/r2'` | WIRED | Line 16; `r2Client.send(new PutObjectCommand(...))` at line 295; `getDownloadUrl(key, 300)` at line 266 and `getDownloadUrl(uploadResult.r2Key, 86400)` at line 316 |
| `evidence-pack-export.ts` | `sendEvidencePackReadyEmail` | `import { sendEvidencePackReadyEmail } from '@/src/lib/email'` | WIRED | Line 17; called in `send-email` step at line 325 |
| `functions/index.ts` | `evidence-pack-export.ts` | `import { evidencePackExportFn } from './evidence-pack-export'` | WIRED | Line 6; present in exported `functions` array |
| Deleted sync route | No live callers | N/A — dead code removed | VERIFIED | `grep -r "api/export/evidence-pack" app src` returns only a comment in evidence.ts; zero live callers |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `evidence-pack-dialog.tsx` | `exportState` (derived from `requestExport.isSuccess/isError`) | `trpc.evidence.requestExport.useMutation()` hook | Yes — mutation returns `{ status: 'queued' }` from server | FLOWING |
| `evidence-pack-dialog.tsx` | `documents` (policy selector) | `trpc.document.list.useQuery()` | Yes — real DB query via existing documentRouter | FLOWING |
| `evidence-pack-export.ts` step `build-metadata` | `metadataFiles` | `buildEvidencePack(documentId)` — existing service with real DB queries | Yes — returns 6 files (INDEX.md, CSVs, JSONs) from live DB | FLOWING |
| `evidence-pack-export.ts` step `list-binary-artifacts` | `artifacts` | Two `db.select(...).from(...).innerJoin(...).where(sql\`EXISTS...\`)` queries | Yes — queries feedbackEvidence + sectionEvidence joined to evidenceArtifacts | FLOWING |
| `evidence-pack-export.ts` step `assemble-and-upload` | ZIP bytes / `uploadResult` | `fetchBinaryWithTimeout(presigned)` for file-type artifacts + `zipSync` + `r2Client.send(PutObjectCommand)` | Yes — R2 fetch + real upload (mocked in unit tests, real in integration) | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| 6 steps present in pipeline | `grep -c "step.run(" src/inngest/functions/evidence-pack-export.ts` | 6 | PASS |
| generateStorageKey NOT used (Warning 4) | `grep -q "generateStorageKey" src/inngest/functions/evidence-pack-export.ts` | no match | PASS |
| 24h presigned URL TTL | `grep "getDownloadUrl.*86400" ...evidence-pack-export.ts` | line 316: `getDownloadUrl(uploadResult.r2Key, 86400)` | PASS |
| Manual key construction (SC-3) | `grep "evidence-packs/\${documentId}-\${Date.now()}" ...evidence-pack-export.ts` | line 293 | PASS |
| UNAVAILABLE fallback wired | `grep "UNAVAILABLE" ...evidence-pack-export.ts` | 3 occurrences (link-type, key-derivation-failed, fetch failure) | PASS |
| Silent no-op guard (5th occurrence) | `grep -c "if (!resend \|\| !to) return" src/lib/email.ts` | 5 | PASS |
| Sync route deleted | `test -f app/api/export/evidence-pack/route.ts` | DELETED | PASS |
| No live callers of deleted route | `grep -r "api/export/evidence-pack" app src` | 1 comment only (evidence.ts line 215) | PASS |
| 6 requirePermission calls in evidenceRouter | `grep -c "requirePermission(" src/server/routers/evidence.ts` | 6 (was 5; +1 for requestExport) | PASS |

---

### Full Test Suite Results

**Command:** `npx vitest run`
**Result:** 352 passed, 2 failed, 1 todo (355 total across 34 test files)

| Test file | Tests | Result |
|-----------|-------|--------|
| `src/inngest/__tests__/evidence-pack-export.test.ts` | 12 | GREEN (Wave 0 contracts satisfied) |
| `src/lib/__tests__/email.test.ts` | 4 | GREEN (Wave 0 contracts satisfied) |
| `src/__tests__/evidence-pack-dialog.test.ts` | 3 | GREEN (Wave 0 contracts satisfied) |
| `src/server/routers/__tests__/evidence-request-export.test.ts` | 5 | GREEN (Wave 0 contracts satisfied) |
| `src/__tests__/section-assignments.test.ts` | — | RED (pre-existing Phase 16 deferred — out of scope) |
| `src/__tests__/feedback-permissions.test.ts` | — | RED (pre-existing Phase 16 deferred — out of scope) |

All 24 Phase 18 Wave 0 contracts are GREEN. The 2 failing tests are documented in Phase 16 `deferred-items.md` and `STATE.md` line 201 and were failing identically before this phase began.

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EV-05 | 18-01, 18-02 | Evidence pack export is async via Inngest (not sync tRPC) | SATISFIED | `requestExport` mutation fires `sendEvidenceExportRequested` and returns `{ status: 'queued' }` immediately; sync GET route deleted; `evidencePackExportFn` registered in Inngest barrel |
| EV-06 | 18-01 | Async evidence pack includes R2 binaries via fflate + R2 upload | SATISFIED | `fetchBinaryWithTimeout` fetches each file artifact; `zipSync` assembles; `PutObjectCommand` uploads; link-type and failed-fetch artifacts get `UNAVAILABLE.txt` placeholders; `degraded` flag propagated. Note: REQUIREMENTS.md text says "multipart upload" but ROADMAP SC-3 was amended to accept `PutObjectCommand` + documented deferral — implementation matches the amended criterion |
| EV-07 | 18-01 | Completed pack uploaded to R2; 24h presigned GET emailed to requester | SATISFIED | `getDownloadUrl(r2Key, 86400)` in `generate-presigned-url` step; `sendEvidencePackReadyEmail` called with `downloadUrl`, `fileCount`, `totalSizeBytes`, `expiresAt`, `degraded` |

**Note on EV-06 wording discrepancy:** `REQUIREMENTS.md` says "streaming fflate.Zip + R2 multipart upload". The ROADMAP Phase 18 SC-3 was amended during planning to accept `zipSync` + `PutObjectCommand` with multipart as a documented deferred upgrade. The implementation matches the amended ROADMAP criterion (RFC JSDoc block present in `evidence-pack-export.ts` lines 44-76). The REQUIREMENTS.md entry is marked `[x]` complete and should be treated as satisfied per the planning amendment.

---

### Anti-Patterns Found

No blockers or warnings found.

| File | Pattern | Severity | Verdict |
|------|---------|----------|---------|
| `evidence-pack-export.ts` line 343 | `actorRole: 'auditor'` hardcoded | Info | Not a stub — event schema intentionally omits role (documented in SUMMARY key-decisions). Only auditor + admin hold `evidence:export`; conservative default is correct. |
| `evidence-pack-export.ts` line 297 | `process.env.R2_BUCKET_NAME!` non-null assertion | Info | Not a stub — `r2Client` import validates the env var at module load time via `requireEnv()`. Safe by transitive guarantee. |

---

### Human Verification Required

#### 1. End-to-End Pack Generation and Email Delivery

**Test:** Start the Inngest dev server (`npx inngest-cli@latest dev`), trigger an export from the Audit page as an Auditor user with a populated policy document that has evidence artifacts. Watch the Inngest dashboard for the `evidence-pack-export` function run.
**Expected:**
- All 6 steps complete (build-metadata, list-binary-artifacts, assemble-and-upload, generate-presigned-url, send-email, write-audit-log)
- R2 bucket contains a new `evidence-packs/{documentId}-{timestamp}.zip` object
- Requester email (Resend sandbox) receives subject "Evidence pack ready: {policy title}" with a working presigned URL
- Downloaded ZIP contains INDEX.md, stakeholders.csv, feedback-matrix.csv, version-history.json, decision-log.json, workshop-evidence.json, plus `binaries/` entries for any file-type evidence artifacts
- If any binary fetch fails, the ZIP contains `binaries/{artifactId}-UNAVAILABLE.txt` and the email subject reads "Evidence pack ready (partial): ..."

**Why human:** Requires real Inngest dev server + Resend sandbox + populated R2 dev bucket with actual artifact objects. **Deferred to v0.2 milestone smoke walk per standing user preference.**

---

### Gaps Summary

No gaps. All 5 success criteria verified, all 24 Wave 0 test contracts GREEN, sync route deleted with no live callers, all key links wired, data flows substantive. The only outstanding item is the milestone-deferred integration smoke walk (real Inngest + Resend + R2), which is out of scope for per-phase verification per user preference.

---

_Verified: 2026-04-14T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
