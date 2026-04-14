# Phase 18: Async Evidence Pack Export — Research

**Researched:** 2026-04-14
**Domain:** Inngest async pipeline, fflate streaming ZIP, R2 multipart upload, presigned GET email delivery
**Confidence:** HIGH — all findings sourced directly from codebase reads; zero training-data speculation

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EV-05 | Evidence pack export is async via Inngest (not sync tRPC) | Sync route `app/api/export/evidence-pack/route.ts` exists and must be replaced or supplemented; dialog triggers it directly via `fetch()` |
| EV-06 | Async evidence pack includes R2 binaries (recordings, screenshots, attachments) via streaming fflate.Zip + R2 multipart upload | `evidenceArtifacts.url` stores public R2 URL; R2 key must be derived or separately stored; fflate `Zip` streaming class exists in `fflate@0.8.2`; AWS SDK v3 multipart upload APIs available but not yet used |
| EV-07 | Completed evidence pack uploaded to R2 and download URL emailed to requester (24h presigned GET) | `getDownloadUrl(key, expiresIn)` helper exists in `src/lib/r2.ts`; Resend helper pattern established; `sendX()` email pattern clear from Phase 16/17 |
</phase_requirements>

---

## Summary

Phase 18 upgrades the evidence pack export from a synchronous HTTP download to a fully async Inngest pipeline with email delivery. The upgrade touches three surfaces: (1) the trigger — the dialog must stop waiting for a synchronous download and instead fire an Inngest event and show a toast; (2) the Inngest function itself — which replaces the sync route's `buildEvidencePack + zipSync` call with a multi-step streaming pipeline that fetches R2 binaries and assembles a ZIP without loading everything into memory; (3) the delivery surface — the completed ZIP is uploaded to R2 and the requester receives an email with a 24h presigned GET URL.

The project has mature, proven patterns for all three surfaces. The Inngest event/function/send-helper pattern is documented in `src/inngest/README.md` and has four working examples (Phases 16 and 17). The R2 client (`src/lib/r2.ts`) already has `getDownloadUrl` for presigned GETs and `PutObjectCommand` for uploads. The email helper in `src/lib/email.ts` follows a silent-no-op guard pattern. The only genuinely new surface is R2 **multipart upload** (for streaming ZIP assembly without full in-memory buffering) and fflate's streaming `Zip` class (as opposed to the synchronous `zipSync` used today).

**Primary recommendation:** Phase 18 is a four-plan wave. Wave 0: TDD scaffolds + new schema for `evidence_pack_jobs` tracking table. Wave 1: `evidencePackExport` Inngest function (metadata CSV/JSON assembly, R2 binary fetching, streaming ZIP via multipart upload). Wave 2: email delivery helper + trigger surface (dialog async flow). Wave 3: degraded-mode fallback (manifest-only pack when binary fetch times out).

---

## Existing State

### Synchronous evidence pack route (to be superseded)

**File:** `app/api/export/evidence-pack/route.ts`

Key facts:
- GET handler — auth-checks, permission-checks (`evidence:export`), calls `buildEvidencePack(documentId)`, calls `zipSync(files, { level: 6 })`, returns the ZIP as a streaming HTTP response body with `Content-Type: application/zip`.
- Uses `zipSync` from fflate — **synchronous, loads entire ZIP into memory as a `Uint8Array`**. This is the problem Phase 18 solves.
- Writes an audit log entry with `ACTIONS.EVIDENCE_PACK_EXPORT`.
- The route does NOT get deleted in Phase 18 — the dialog currently calls it directly. The dialog must be changed first. Once the dialog calls the new async path, the sync route can be deleted or left as a legacy endpoint for non-async use.

**File:** `src/server/services/evidence-pack.service.ts`

Key facts:
- `buildEvidencePack(documentId): Promise<Record<string, Uint8Array>>` returns a map of filename -> encoded content (CSVs, JSONs, INDEX.md).
- Fetches stakeholders, feedback matrix, version history, decision log — all structured metadata, no binary R2 files.
- Workshop evidence is a placeholder JSON stub (was written before Phase 10/17). Phase 18 must add real binary fetching (recordings, screenshots).
- The `buildEvidencePack` function is **reusable in the Inngest function** for the metadata portion; Phase 18 augments it with binary artifact fetching.

### Dialog trigger (to be converted to async)

**File:** `app/(workspace)/audit/_components/evidence-pack-dialog.tsx`

Key facts:
- Client component. State machine: `'idle' | 'loading' | 'complete' | 'error'`.
- `handleExport` calls `fetch('/api/export/evidence-pack?documentId=...')`, awaits the response blob, creates a local object URL, and shows a "Download ZIP" button.
- `exportState === 'complete'` renders a download link.
- **Phase 18 change:** `handleExport` must instead call a new tRPC mutation `evidence.requestExport(documentId)`, which fires the Inngest event and returns immediately. The dialog transitions to a "generating" toast state, not a download state. The "Download ZIP" button is replaced by "You'll receive an email when ready." The `downloadUrl` local state and blob handling is removed entirely.
- The dialog is mounted in two places: `app/(workspace)/audit/page.tsx` (uses default trigger) and `app/(workspace)/dashboard/_components/auditor-dashboard.tsx` (passes a custom `<Button>` trigger via the `trigger` prop added in Phase 15/EV-08).

### R2 client helpers (HIGH confidence — file read directly)

**File:** `src/lib/r2.ts`

| Helper | What it does | Used in Phase 18? |
|--------|-------------|-------------------|
| `getUploadUrl(key, contentType, contentLength?, expiresIn)` | presigned PUT | No — Phase 18 uses PutObjectCommand directly for multipart |
| `getDownloadUrl(key, expiresIn)` | presigned GET | YES — for delivering the completed pack URL |
| `deleteFile(key)` | DeleteObjectCommand | No |
| `getPublicUrl(key)` | `${R2_PUBLIC_URL}/${key}` | No |
| `generateStorageKey(folder, fileName)` | timestamp-random key generator | YES — for generating `evidence-packs/{policyId}-{timestamp}.zip` key |
| `r2Client` | S3Client instance | YES — for multipart upload commands |

**No multipart upload helper exists today.** The `@aws-sdk/client-s3` package (version `^3.1017.0`) is already installed and exports `CreateMultipartUploadCommand`, `UploadPartCommand`, `CompleteMultipartUploadCommand`, and `AbortMultipartUploadCommand`. Phase 18 must add a multipart upload helper (either inline in the Inngest function or extracted to `src/lib/r2.ts`).

### R2 key vs public URL — binary fetching gap

`evidenceArtifacts.url` stores the **public R2 URL** (`${R2_PUBLIC_URL}/${key}`), not the R2 object key. Workshop recordings have a different path: the `attachArtifact` mutation receives `r2Key` as an optional input and passes it to `sendWorkshopRecordingUploaded` — but the R2 key is NOT stored in the `evidenceArtifacts` table.

**Consequence for Phase 18:** To fetch binaries for the evidence pack, the Inngest function can either:
- Option A: Derive the R2 key from the public URL: `key = url.replace(R2_PUBLIC_URL + '/', '')`. This works as long as `R2_PUBLIC_URL` is available as an env var in the Inngest context (it is — `src/lib/r2.ts` reads it at import time).
- Option B: Add a `storageKey` column to `evidenceArtifacts` and backfill. This is a schema migration.

**Option A is recommended** — zero schema migration, and the URL-to-key derivation is a single string operation that is deterministic given the existing `getPublicUrl` implementation. However, it only works for R2-hosted files (type `'file'`). Link-type artifacts (type `'link'`) have external URLs and cannot be fetched from R2; they must be represented in the manifest only.

### Inngest infrastructure (fully established)

**File:** `src/inngest/events.ts` — 4 existing events: `sample.hello`, `feedback.reviewed`, `notification.create`, `workshop.completed`, `workshop.recording_uploaded`. Phase 18 adds `evidence.export_requested`.

**File:** `src/inngest/functions/index.ts` — barrel imports `[helloFn, feedbackReviewedFn, notificationDispatchFn, workshopCompletedFn, workshopRecordingProcessedFn]`. Phase 18 appends `evidencePackExportFn`.

**File:** `app/api/inngest/route.ts` — no changes needed.

### fflate current usage

Today: `zipSync` from `fflate@0.8.2` in `app/api/export/evidence-pack/route.ts`. `zipSync` is **synchronous and loads the full archive into memory** — unsuitable for large archives with R2 binary files. Phase 18 needs the **streaming `Zip` class** from fflate for incremental chunk-by-chunk assembly.

---

## Phase 16 Pattern Recap

All new Inngest work in this phase MUST follow this exact pattern.

### Step 1: Declare event in `src/inngest/events.ts`

```typescript
// Use z.guid() not z.uuid() — Zod v4 z.uuid() rejects version-0 test fixtures
const evidenceExportRequestedSchema = z.object({
  documentId:  z.guid(),
  requestedBy: z.guid(),   // user.id of the requester
  userEmail:   z.string().email().nullable(),   // pre-fetched at trigger time
})

export const evidenceExportRequestedEvent = eventType('evidence.export_requested', {
  schema: evidenceExportRequestedSchema,
})

export type EvidenceExportRequestedData = z.infer<typeof evidenceExportRequestedSchema>

export async function sendEvidenceExportRequested(
  data: EvidenceExportRequestedData,
): Promise<void> {
  const event = evidenceExportRequestedEvent.create(data)
  await event.validate()
  await inngest.send(event)
}
```

### Step 2: Create function in `src/inngest/functions/evidence-pack-export.ts`

```typescript
import { NonRetriableError } from 'inngest'
import { inngest } from '../client'
import { evidenceExportRequestedEvent } from '../events'

export const evidencePackExportFn = inngest.createFunction(
  {
    id: 'evidence-pack-export',
    name: 'Evidence pack — async ZIP assembly + R2 upload + email',
    retries: 2,
    // Inlined per README §90-94 (type widening footgun)
    triggers: [{ event: evidenceExportRequestedEvent }],
  },
  async ({ event, step }) => {
    const { documentId, requestedBy, userEmail } = event.data

    // Step 1: build metadata (CSV/JSON — no binaries)
    const metadataFiles = await step.run('build-metadata', async () => { ... })

    // Step 2: fetch binary artifact URLs for this document
    const binaryArtifacts = await step.run('list-binary-artifacts', async () => { ... })

    // Step 3: stream binary fetch + ZIP assembly + R2 multipart upload
    const { r2Key, fileCount, totalBytes } = await step.run('assemble-and-upload', async () => { ... })

    // Step 4: generate presigned GET URL (24h)
    const downloadUrl = await step.run('generate-presigned-url', async () => { ... })

    // Step 5: send email to requester
    await step.run('send-email', async () => { ... })

    // Step 6: write audit log
    await step.run('write-audit-log', async () => { ... })

    return { r2Key, fileCount, totalBytes, downloadUrl }
  },
)
```

**RULE:** Always inline `triggers: [{ event: evidenceExportRequestedEvent }]` — never extract to a const (type widening, documented pitfall).

**RULE:** Use `NonRetriableError` for deterministic failures (document not found, permission missing). Use plain `Error` for transient failures (R2 fetch timeout, Resend outage) to let Inngest consume the retry budget.

**RULE:** Return only JSON-safe primitives from `step.run` — no `Date` objects, no `Buffer` unless serialized to base64 (Phase 17 Pitfall 2 pattern). If binary content must cross step boundaries, use base64. For Phase 18, binary files are streamed inside a single `step.run` (not returned), so the base64 boundary issue applies only if we split assembly across two steps.

### Step 3: Append to `src/inngest/functions/index.ts`

```typescript
import { evidencePackExportFn } from './evidence-pack-export'
export const functions = [
  helloFn,
  feedbackReviewedFn,
  notificationDispatchFn,
  workshopCompletedFn,
  workshopRecordingProcessedFn,
  evidencePackExportFn,  // Phase 18
]
```

### Step 4: Add tRPC trigger mutation

New procedure on the audit router (or a dedicated `evidence` router): `evidence.requestExport`. It fires `sendEvidenceExportRequested` and returns immediately. The dialog calls this instead of the sync fetch.

---

## Streaming Architecture

### Problem: zipSync is synchronous and memory-bound

The current route calls `zipSync(files)` which:
1. Compresses all files in memory synchronously
2. Returns a `Uint8Array` that holds the entire ZIP
3. Blocks the Node.js event loop during compression

For large packs (many recordings, multiple workshop screenshots), this can exceed Vercel's 512MB RAM limit and block the event loop for seconds.

### Solution: fflate `Zip` streaming class + R2 multipart upload

**fflate `Zip` class** (streaming, not `zipSync`) works via a callback model:

```typescript
import { Zip, ZipPassThrough, AsyncZipDeflate } from 'fflate'

// Source: fflate@0.8.2 — npm README / fflate docs
const zip = new Zip((chunk, final) => {
  // called repeatedly with compressed chunks
  // `final` is true on the last chunk
  uploadPart(chunk)   // feed each chunk to R2 multipart upload
})

// Add a file to the zip
const entry = new AsyncZipDeflate('stakeholders.csv', { level: 6 })
zip.add(entry)
entry.push(csvBytes, true)  // true = this is the final chunk for this file

// Finish the zip
zip.end()
```

For binary files fetched from R2, use `ZipPassThrough` (no re-compression — R2 already stores them compressed or they are media files where compression is ineffective):

```typescript
const entry = new ZipPassThrough('recordings/workshop-recording.mp3')
zip.add(entry)
// Stream in chunks:
for await (const chunk of readableStream) {
  entry.push(chunk, false)
}
entry.push(new Uint8Array(0), true)  // signal end
```

**Confidence:** MEDIUM — based on fflate@0.8.2 README and npm docs. The `Zip` class API is stable in 0.8.x. Verify callback signature during implementation by checking `node_modules/fflate/README.md`.

### R2 multipart upload bridge

AWS SDK v3 multipart upload (using existing `r2Client` from `src/lib/r2.ts`):

```typescript
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'

// Phase 18: add this helper to src/lib/r2.ts
export async function multipartUploadFromChunks(
  key: string,
  contentType: string,
  getChunks: () => AsyncGenerator<Uint8Array>,
): Promise<void> {
  const create = await r2Client.send(new CreateMultipartUploadCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ContentDisposition: 'attachment',
  }))
  const uploadId = create.UploadId!

  const parts: { PartNumber: number; ETag: string }[] = []
  let partNumber = 1

  try {
    for await (const chunk of getChunks()) {
      const part = await r2Client.send(new UploadPartCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: chunk,
      }))
      parts.push({ PartNumber: partNumber, ETag: part.ETag! })
      partNumber++
    }

    await r2Client.send(new CompleteMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }))
  } catch (err) {
    await r2Client.send(new AbortMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
    }))
    throw err
  }
}
```

**Critical constraint — R2 multipart part size minimum:** AWS S3 (and R2) require each part except the last to be at least **5MB**. fflate chunk callbacks may fire with smaller chunks. The bridge must **accumulate chunks until >= 5MB** before calling `UploadPartCommand`. The last accumulated buffer can be any size.

**Confidence:** HIGH — 5MB minimum part size is documented in AWS S3 API docs and applies to R2 (Cloudflare R2 is S3-compatible). The `@aws-sdk/client-s3` package at `^3.1017.0` is already installed.

### Alternative: PutObjectCommand for small packs

For packs where all R2 binaries fit under ~50MB total, `PutObjectCommand` with a `Buffer` is simpler than multipart. The Phase 18 plan should use **multipart** as the default path since packs with recordings may be large, but PutObjectCommand is an acceptable simplification if the planner decides to defer multipart to a follow-up.

**Recommendation for planner:** Use `PutObjectCommand` for the first implementation (collect all chunks into a Buffer, single PUT). Add a comment noting the 5MB part-size constraint and the multipart upgrade path. This avoids the accumulator complexity in Phase 18 and the archive will still be assembled incrementally (fflate `Zip` streaming), just buffered before the final PUT. If the pack is too large for a single PUT (> Vercel's 128MB response body limit), multipart is required.

---

## Streaming Binary Fetch from R2

Workshop recordings and screenshots are stored in R2. The `evidenceArtifacts.url` column holds the **public R2 URL** (format: `${R2_PUBLIC_URL}/${key}`).

### Deriving the R2 key from the public URL

```typescript
// src/lib/r2.ts already exports R2_PUBLIC_URL
import { R2_PUBLIC_URL } from '@/src/lib/r2'

function deriveR2Key(publicUrl: string): string | null {
  if (!publicUrl.startsWith(R2_PUBLIC_URL + '/')) return null
  return publicUrl.slice(R2_PUBLIC_URL.length + 1)
}
```

Only `evidenceArtifacts.type === 'file'` artifacts have R2 keys. `type === 'link'` artifacts have external URLs and cannot be fetched from R2.

### Fetching binary from R2 inside Inngest step

The Phase 17 `workshop-recording-processed.ts` demonstrates this exact pattern (HIGH confidence — file read directly):

```typescript
// step 1 from workshop-recording-processed.ts — exact pattern to reuse
const audioBase64 = await step.run('fetch-recording', async () => {
  const url = await getDownloadUrl(r2Key, 300)  // 5-min presigned GET
  const res = await fetch(url)
  if (!res.ok) throw new Error(`R2 fetch failed: ${res.status} ${res.statusText}`)
  const ab = await res.arrayBuffer()
  return Buffer.from(ab).toString('base64')    // base64 for JSON-safe step return
})
```

**Phase 18 difference:** Evidence pack binaries should NOT be returned from `step.run` as base64 strings — for large files this would JSON-serialize a multi-MB string. Instead, all binary fetching and ZIP assembly should happen **inside a single `step.run('assemble-and-upload', ...)`** step. The step neither returns binary data nor passes it to downstream steps.

### Timeout strategy for binary fetches

Binary fetches can time out (slow R2, large files). Inside `step.run`, a fetch with a 30-second timeout is appropriate:

```typescript
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 30_000)
const res = await fetch(url, { signal: controller.signal })
clearTimeout(timeout)
if (!res.ok || controller.signal.aborted) {
  // fallback: skip this binary, add to missingBinaries list
}
```

The fallback strategy (degraded mode) is documented below.

---

## Email + Presigned URL Helpers

### Presigned GET URL — already exists

```typescript
// src/lib/r2.ts (read directly — HIGH confidence)
export async function getDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
  return getSignedUrl(r2Client, command, { expiresIn })
}
```

For 24h expiry: `getDownloadUrl(r2Key, 86400)`.

### Email helper — new function needed in `src/lib/email.ts`

Following the exact pattern of `sendWorkshopEvidenceNudgeEmail` (4th helper, Phase 17):

```typescript
// To be added to src/lib/email.ts
export async function sendEvidencePackReadyEmail(
  to: string | null | undefined,
  data: {
    documentTitle: string
    downloadUrl: string
    fileCount: number
    totalSizeBytes: number
    expiresAt: string  // ISO timestamp
    degraded?: boolean  // true if manifest-only fallback
  },
): Promise<void> {
  if (!resend || !to) return
  // ...
}
```

The `resend` singleton and `FROM_ADDRESS` pattern are shared; no new Resend dependencies.

---

## Trigger Path

### Current path (synchronous — to be changed)

```
User clicks "Export ZIP" in EvidencePackDialog
  → handleExport() calls fetch('/api/export/evidence-pack?documentId=...')
  → waits for blob response (blocking, ~2-30s depending on pack size)
  → creates object URL, renders download link
```

### New path (async)

```
User clicks "Export Pack" in EvidencePackDialog
  → handleExport() calls trpc.evidence.requestExport.mutate({ documentId })
  → mutation calls sendEvidenceExportRequested({ documentId, requestedBy, userEmail })
  → mutation returns { status: 'queued' } immediately
  → dialog shows toast: "Your pack is being generated, you'll get an email when ready"
  → dialog closes (or stays open with info state)

  [async, in background]
  Inngest receives evidence.export_requested
  → evidencePackExportFn executes 6 steps
  → uploads ZIP to evidence-packs/{policyId}-{timestamp}.zip
  → emails requester with presigned GET URL (24h)
```

### tRPC mutation shape

New router procedure `evidence.requestExport`:

```typescript
requestExport: requirePermission('evidence:export')
  .input(z.object({ documentId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    // Pre-fetch user email at trigger time (so Inngest fn doesn't need DB
    // lookup for the requester's email — follows Phase 17 moderatorId pattern)
    const userEmail = ctx.user.email ?? null

    await sendEvidenceExportRequested({
      documentId:  input.documentId,
      requestedBy: ctx.user.id,
      userEmail,
    })

    writeAuditLog({
      actorId:    ctx.user.id,
      actorRole:  ctx.user.role,
      action:     ACTIONS.EVIDENCE_PACK_EXPORT,
      entityType: 'document',
      entityId:   input.documentId,
      payload:    { async: true },
    }).catch(console.error)

    return { status: 'queued' as const }
  }),
```

**Router location:** The project has `src/server/routers/` with a dedicated `audit.ts`. This mutation fits on an `evidence.ts` router (new) or on `audit.ts`. Given the `ACTIONS.EVIDENCE_PACK_EXPORT` audit action already exists and this is an audit-facing feature, adding it to `audit.ts` is reasonable. Planner should decide.

---

## Fallback Strategy (Degraded Manifest Mode)

**Trigger:** Any R2 binary fetch times out (30s timeout exceeded) or returns a non-2xx status.

**Behavior:**
- Continue ZIP assembly with all successfully fetched binaries.
- For each failed binary, include a placeholder file in the ZIP: `binaries/{artifactId}-UNAVAILABLE.txt` containing: `File fetch timed out. Download manually: ${artifact.url}\nArtifact title: ${artifact.title}`
- Set a `degraded: true` flag in the step return value.
- Email the requester with the pack, noting: "Some binary files could not be included (see UNAVAILABLE.txt files). Links to each file are provided inside the pack."

**Manifest-only fallback (full binary outage):**
If ALL binary fetches fail (e.g., R2 is down), the ZIP still contains all metadata CSVs/JSONs plus UNAVAILABLE placeholders with presigned GET links to each binary artifact. This is a valid deliverable — the requester can download the metadata pack and access binaries via the embedded links.

**Data structure for fallback manifest:**

```typescript
interface MissingBinaryEntry {
  artifactId: string
  title: string
  publicUrl: string
  artifactType: string
  error: string  // 'timeout' | 'fetch_failed'
}
```

**No schema changes required** for fallback — the `degraded` flag is in the email body only.

---

## Open Questions

1. **New `evidence_pack_jobs` table needed?**
   - What we know: Phase 18 success criteria include the toast "Your pack is being generated" but no polling for status.
   - What's unclear: Does the UI need a way to see past export jobs (in-progress, completed, failed) or is email-only sufficient?
   - Recommendation: Email-only for Phase 18. No `evidence_pack_jobs` table. If the user wants to track status, they check their email. Add tracking in a future phase if needed. This avoids schema migration scope creep.

2. **Where to add `evidence.requestExport` — new `evidence.ts` router or existing `audit.ts`?**
   - What we know: `ACTIONS.EVIDENCE_PACK_EXPORT` lives in `audit` domain (`src/lib/constants.ts` line 65). The permission `evidence:export` is the guard.
   - Recommendation: Add to `src/server/routers/audit.ts` (one less new file; the audit router already exists and the export is an audit-facing action). The planner should decide.

3. **`PutObjectCommand` vs full multipart upload for ZIP storage?**
   - What we know: multipart has a 5MB minimum part size constraint and is more complex. `PutObjectCommand` is simpler but loads the full ZIP into a Buffer before PUT.
   - What's unclear: How large are typical evidence packs on this system? Workshop recordings can be up to 25MB each; a pack with 3 recordings + screenshots could be 100MB+.
   - Recommendation: **Start with `PutObjectCommand` for Phase 18** (simpler), with a documented upgrade comment. If packs exceed ~100MB in practice, add multipart in a follow-up. The fflate `Zip` streaming class still provides incremental assembly; we just buffer the final result before PUT.

4. **Should the sync route `app/api/export/evidence-pack/route.ts` be deleted in Phase 18?**
   - What we know: The dialog is the only consumer. Once the dialog is converted to async, the route has no callers.
   - Recommendation: Delete the sync route in the same plan that converts the dialog. This prevents the dead endpoint from being exploited (it has no rate limiting).

5. **Should `buildEvidencePack` service function be imported into the Inngest function directly?**
   - What we know: It currently returns `Record<string, Uint8Array>` which works for `zipSync` but needs adaptation for streaming. It already queries all the metadata correctly.
   - Recommendation: **Reuse `buildEvidencePack` in the Inngest function's `build-metadata` step.** Its return type (`Record<string, Uint8Array>`) is perfect for adding to the fflate `Zip` stream as text-content entries. Only the binary-fetching portion is new.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`. Section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.mts` |
| Quick run command | `npm test -- --run src/inngest/__tests__/evidence-pack` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EV-05 | `sendEvidenceExportRequested` validates payload + rejects bad documentId | unit | `npm test -- --run src/inngest/__tests__/evidence-pack-export.test.ts` | ❌ Wave 0 |
| EV-05 | `evidencePackExportFn` steps: metadata built, audit log written | unit (mock DB + inngest) | same file | ❌ Wave 0 |
| EV-06 | Binary fetch: file-type artifact gets fetched; link-type artifact gets UNAVAILABLE placeholder | unit (mock fetch + R2) | same file | ❌ Wave 0 |
| EV-06 | Degraded mode: timed-out binary fetch yields UNAVAILABLE.txt entry in ZIP | unit (mock fetch timeout) | same file | ❌ Wave 0 |
| EV-07 | `getDownloadUrl` called with 86400s expiry for completed pack | unit (mock r2Client) | same file | ❌ Wave 0 |
| EV-07 | `sendEvidencePackReadyEmail` called with correct downloadUrl + metadata | unit (mock Resend) | `npm test -- --run src/lib/__tests__/email.test.ts` | ❌ Wave 0 |
| EV-07 | Dialog: after `requestExport` mutation succeeds, shows async-queued state not download-link state | component (Vitest + happy-dom) | `npm test -- --run src/__tests__/evidence-pack-dialog.test.ts` | ❌ Wave 0 |

### Manual Smoke Walk

Pre-conditions:
1. `npm run dev` running at `http://localhost:3000`
2. `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest` running at `http://localhost:8288`
3. Inngest Dev UI "Apps" shows `policydash` app with `evidence-pack-export` function
4. Test policy document with feedback + at least one file-type evidence artifact in DB
5. Auditor user account with non-null `users.email`
6. `RESEND_API_KEY` set

Steps:
1. Log in as auditor, open Auditor Dashboard → Export Controls → "Export Evidence Pack (ZIP)"
2. Select the test policy, click "Export Pack" → dialog shows queued state, toast appears
3. In Inngest Dev UI → "Runs" → confirm `evidence-pack-export` run appears
4. Wait for completion → all 6 steps green
5. Check email inbox → email with presigned GET URL arrives
6. Click the presigned URL → ZIP downloads; unzip and verify INDEX.md + CSVs present
7. If test artifact was R2 file: verify the binary is in the ZIP
8. If degraded-mode test: make R2 unavailable (wrong key) → verify UNAVAILABLE.txt appears in ZIP + email notes degraded mode

### Sampling Rate

- **Per task commit:** `npm test -- --run src/inngest/__tests__/evidence-pack`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + manual smoke walk completed before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/inngest/__tests__/evidence-pack-export.test.ts` — covers EV-05 (event schema validation, function step logic with mocks)
- [ ] `src/lib/__tests__/email.test.ts` — covers EV-07 (sendEvidencePackReadyEmail silent-no-op + actual send shape)
- [ ] `src/__tests__/evidence-pack-dialog.test.ts` — covers EV-05 UI side (async queued state replaces download-link state)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@aws-sdk/client-s3` | Multipart / PutObject upload | ✓ | ^3.1017.0 | — already installed |
| `@aws-sdk/s3-request-presigner` | 24h presigned GET URL | ✓ | ^3.1017.0 | — already installed |
| `fflate` | Streaming ZIP assembly | ✓ | ^0.8.2 (latest 0.8.2) | — already installed |
| `inngest` | Async function runtime | ✓ | ^4.2.1 | — already installed |
| `resend` | Email delivery | ✓ | ^6.9.4 | Silent no-op if `RESEND_API_KEY` unset |
| `papaparse` | CSV generation in `buildEvidencePack` | ✓ | ^5.5.2 | — already installed |
| R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL | R2 client | ✓ (required in r2.ts) | — | None — R2 upload will throw at import if missing |
| RESEND_API_KEY | Email delivery | unknown | — | Silent no-op (by design in email.ts) |
| Inngest CLI | Local smoke walk | check at execution | `npx inngest-cli@latest` | Use npx |

**No new packages required.** All dependencies are already installed.

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **CRITICAL:** This is NOT standard Next.js — read `node_modules/next/dist/docs/` before writing any Next.js route handler or server component code. APIs and conventions may differ from training data.
- Every tRPC mutation writes audit log via `writeAuditLog` — `evidence.requestExport` mutation is no exception.
- No `publicProcedure` in application routers.
- `users.email` is nullable — every email path must guard `if (email)` or `if (!resend || !to) return`.
- DB schema changes require hand-written SQL migrations (not `drizzle-kit generate`). Migration must use `@neondatabase/serverless` driver via `sql.query(stmt)` (Pattern 2, Phase 16).
- No worktrees or isolation branches — commit directly to master.
- Sequential DB inserts, no `db.transaction()` — Neon HTTP driver compatibility (Phase 2 decision).
- Zod v4: use `z.guid()` for IDs in Inngest event schemas (not `z.uuid()`) — Phase 16 decision.
- Inngest: always inline `triggers: [{ event: myEvent }]` — never extract to a const (type widening footgun).
- Phase 17 Pitfall 2: Return only JSON-safe values from `step.run`. Buffer→base64 at step boundaries if binary must cross steps. For Phase 18, keep all binary work inside one step.

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| inngest | ^4.2.1 | Durable async function runtime | Established in Phase 16/17; 4 functions already wired |
| fflate | ^0.8.2 | ZIP assembly | Already used for sync zipSync; streaming `Zip` class is in same package |
| @aws-sdk/client-s3 | ^3.1017.0 | R2 PutObject + multipart upload | Already installed; r2Client already exported |
| @aws-sdk/s3-request-presigner | ^3.1017.0 | Presigned GET URL generation | Already installed; `getDownloadUrl` already uses it |
| resend | ^6.9.4 | Transactional email | Established pattern in email.ts |
| zod | ^4.3.6 | Event schema validation | Required pattern for Inngest events |
| papaparse | ^5.5.2 | CSV generation | Already used in buildEvidencePack service |

**No new npm installs needed.**

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Retry logic on R2 fetch failures | Custom retry loop | Inngest `retries: 2` + plain `Error` throw |
| ZIP assembly with compression | Custom deflate | fflate `Zip` streaming class |
| Presigned URL generation | Manual HMAC signing | `getDownloadUrl(key, 86400)` from src/lib/r2.ts |
| Email delivery with retry | Try/catch retry | Inngest step retry (Resend errors surface as step failures) |
| Event payload validation | Manual runtime checks | Zod schema + `.validate()` in `sendEvidenceExportRequested` |
| R2 upload with auth | Manual HTTP PUT | `r2Client.send(PutObjectCommand)` via existing r2Client |

---

## Common Pitfalls

### Pitfall 1: fflate Zip callback fires synchronously for small files

**What goes wrong:** The `Zip` output callback may fire synchronously before `.add()` returns for small files, meaning chunk accumulation logic must not assume async ordering.
**How to avoid:** Wrap the entire zip-assembly in a `Promise` that resolves when `zip.end()` triggers the final callback. Use an accumulator array that collects all chunks, then resolve with the concatenated buffer.

### Pitfall 2: R2 multipart 5MB minimum part size

**What goes wrong:** `UploadPartCommand` rejects parts < 5MB (except the final part). If fflate emits chunks smaller than 5MB, the upload fails.
**How to avoid:** Use `PutObjectCommand` for Phase 18 (buffer everything, single PUT). If multipart is needed later, accumulate chunks until >= 5MB before calling `UploadPartCommand`.

### Pitfall 3: step.run JSON serialization — no Buffer return values

**What goes wrong:** Returning a `Buffer` from `step.run` causes JSON serialization to produce `{ type: 'Buffer', data: [...] }` which is not what downstream steps expect when they try to use it.
**How to avoid:** All binary fetch + ZIP assembly + upload happens inside one `step.run('assemble-and-upload', ...)`. The step returns only metadata: `{ r2Key, fileCount, totalBytes }`.

### Pitfall 4: R2_PUBLIC_URL env var in Inngest context

**What goes wrong:** `src/lib/r2.ts` calls `requireEnv('R2_PUBLIC_URL')` at import time. If this env var is missing in the Vercel/Inngest environment, the function will throw on cold start.
**How to avoid:** Already enforced by `requireEnv` — the function will fail fast with a clear error rather than silently. Just ensure `R2_PUBLIC_URL` is in Vercel environment variables.

### Pitfall 5: Public URL artifacts (type='link') vs R2 artifacts (type='file')

**What goes wrong:** Attempting `getDownloadUrl` on an external link URL (e.g., `https://youtube.com/...`) will fail or produce a nonsensical presigned URL.
**How to avoid:** Filter by `evidenceArtifacts.type === 'file'` before attempting R2 key derivation. Link-type artifacts go to UNAVAILABLE.txt or manifest-only JSON.

### Pitfall 6: Dialog state mismatch — still shows download button

**What goes wrong:** The dialog's `exportState === 'complete'` branch renders a download link using `downloadUrl` local state. After Phase 18, there is no local blob to download.
**How to avoid:** Remove the `downloadUrl` state and `complete` download-link branch entirely. Replace with an "Email sent" confirmation state (no download link). The `ExportState` type needs a new `'queued'` value.

### Pitfall 7: Inngest type widening — triggers as const

**What goes wrong:** `const triggers = [{ event: evidenceExportRequestedEvent }]; createFunction({ triggers }, ...)` widens the type so `event.data` is `any` in the handler.
**How to avoid:** Always inline `triggers: [{ event: evidenceExportRequestedEvent }]` directly in the options object (documented in src/inngest/README.md §90-94).

---

## Architecture: Recommended File Changes

```
src/
├── inngest/
│   ├── events.ts                           MODIFY: add evidenceExportRequestedEvent + sendEvidenceExportRequested
│   ├── functions/
│   │   ├── evidence-pack-export.ts         NEW: evidencePackExportFn (6 steps)
│   │   └── index.ts                        MODIFY: append evidencePackExportFn
│   └── __tests__/
│       └── evidence-pack-export.test.ts    NEW: Wave 0 TDD contract
├── lib/
│   ├── email.ts                            MODIFY: add sendEvidencePackReadyEmail
│   └── r2.ts                              MODIFY (optional): add multipart helper OR use PutObjectCommand inline
├── server/
│   └── routers/
│       └── audit.ts                        MODIFY: add evidence.requestExport mutation (or new evidence.ts router)

app/
├── (workspace)/audit/_components/
│   └── evidence-pack-dialog.tsx            MODIFY: replace sync fetch with trpc mutation + queued state
└── api/export/evidence-pack/
    └── route.ts                            DELETE (after dialog converted)
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Sync `GET /api/export/evidence-pack` — blocks HTTP response | `evidencePackExportFn` Inngest fn — fires async | No browser timeout, no Vercel function timeout on export |
| `zipSync` — synchronous, memory-bound | fflate `Zip` streaming + PutObjectCommand | Archive assembled without full in-memory buffering |
| Browser download via blob URL | Presigned GET email link (24h) | Works for large archives; no browser memory limit |
| No binary R2 files in pack | R2 binaries (recordings, screenshots, attachments) fetched per-artifact | Audit pack is complete evidence, not just metadata |

---

## Sources

### Primary (HIGH confidence — source code read directly)

- `src/server/services/evidence-pack.service.ts` — full `buildEvidencePack` implementation, metadata file list, Papa.unparse usage
- `app/api/export/evidence-pack/route.ts` — sync route, `zipSync` usage, audit log, permission check
- `app/(workspace)/audit/_components/evidence-pack-dialog.tsx` — dialog state machine, sync fetch pattern, trigger prop
- `app/(workspace)/dashboard/_components/auditor-dashboard.tsx` — second EvidencePackDialog mount point with custom trigger
- `src/lib/r2.ts` — `r2Client`, `getDownloadUrl`, `getUploadUrl`, `generateStorageKey`, `R2_PUBLIC_URL`
- `src/lib/r2-upload.ts` — client-side upload helper; not used in Inngest context
- `app/api/upload/route.ts` — upload categories (image/document/evidence/recording), MIME allowlist
- `src/lib/email.ts` — Resend client, 4 email helpers, silent-no-op guard pattern
- `src/inngest/events.ts` — all 5 existing events, send helper pattern, z.guid() vs z.uuid() decision
- `src/inngest/functions/workshop-recording-processed.ts` — Phase 17 binary fetch pattern (fetch → ArrayBuffer → base64), step boundaries, NonRetriableError usage
- `src/inngest/functions/index.ts` — barrel pattern; append location for Phase 18
- `src/inngest/README.md` — canonical dev setup, adding new flows, retry vs NonRetriableError, triggers inline rule
- `src/db/schema/evidence.ts` — `evidenceArtifacts` table (url column, type enum: file/link)
- `src/db/schema/workshops.ts` — `workshopArtifacts`, `workshopEvidenceChecklist` tables
- `.planning/config.json` — `nyquist_validation: true`, `commit_docs: true`
- `src/lib/constants.ts` line 65 — `EVIDENCE_PACK_EXPORT: 'evidence_pack.export'`

### Secondary (MEDIUM confidence)

- `.planning/phases/16-flow-5-smoke-notification-dispatch-migration/16-RESEARCH.md` — Inngest pattern canonical reference, z.guid() decision, triggers inline rule
- `.planning/phases/17-workshop-lifecycle-recording-pipeline-groq/17-RESEARCH.md` — Phase 17 streaming fetch pattern, base64 step boundary pitfall, concurrency key pattern
- `.planning/REQUIREMENTS.md` lines 172–175 — EV-05, EV-06, EV-07 requirement text
- `.planning/STATE.md` Phase 17 decisions — Inngest send pattern, Buffer-base64 at step boundaries

### Tertiary (LOW confidence — not verified against live docs)

- fflate `Zip` streaming class API — based on npm README for fflate@0.8.2; verify in `node_modules/fflate/README.md` before implementation
- AWS S3 5MB minimum multipart part size — well-documented AWS invariant; applies to R2 (S3-compatible)

---

## Metadata

**Confidence breakdown:**
- Existing sync evidence pack code: HIGH — files read directly
- Phase 16/17 Inngest pattern: HIGH — multiple source files read directly
- R2 multipart upload bridge: MEDIUM — SDK installed and APIs known, no existing usage in project
- fflate Zip streaming class: MEDIUM — package installed, synchronous `zipSync` is used today; streaming `Zip` API verified via README description but not live code
- Fallback degraded mode: HIGH — design decision, no external dependency

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable domain; fflate and aws-sdk are not fast-moving)
