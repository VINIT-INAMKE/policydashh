import { sql } from 'drizzle-orm'
import { zipSync, strToU8 } from 'fflate'
import { PutObjectCommand } from '@aws-sdk/client-s3'

import { inngest } from '../client'
import { evidenceExportRequestedEvent } from '../events'
import { db } from '@/src/db'
import { policyDocuments, policySections } from '@/src/db/schema/documents'
import {
  evidenceArtifacts,
  feedbackEvidence,
  sectionEvidence,
} from '@/src/db/schema/evidence'
import { feedbackItems } from '@/src/db/schema/feedback'
import { buildEvidencePack } from '@/src/server/services/evidence-pack.service'
import { r2Client, getDownloadUrl, R2_PUBLIC_URL } from '@/src/lib/r2'
import { sendEvidencePackReadyEmail } from '@/src/lib/email'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'

/**
 * evidence-pack-export — async ZIP assembly + R2 upload + email delivery.
 *
 * Triggered by `evidence.export_requested` fired from the
 * `evidence.requestExport` tRPC mutation (Plan 18-02). Runs six steps:
 *
 *   1. build-metadata:        reuse buildEvidencePack() for CSV/JSON files
 *   2. list-binary-artifacts: query evidenceArtifacts joined via feedback +
 *                             section tables where documentId matches; split
 *                             into file-type (fetchable) and link-type
 *   3. assemble-and-upload:   fetch each file artifact (30s timeout), assemble
 *                             the ZIP with fflate zipSync, upload to R2 via
 *                             PutObjectCommand. Failed fetches get
 *                             UNAVAILABLE.txt placeholders; link-type ditto.
 *                             Sets degraded: true if any binary fetch failed.
 *   4. generate-presigned-url: getDownloadUrl(r2Key, 86400) — 24h expiry
 *   5. send-email:            sendEvidencePackReadyEmail with full metadata
 *   6. write-audit-log:       ACTIONS.EVIDENCE_PACK_EXPORT with async: true
 *
 * Requirements: EV-05 (async dispatch), EV-06 (R2 binaries in ZIP with
 * degraded fallback), EV-07 (24h presigned GET + email delivery).
 *
 * ---
 *
 * RFC: PutObjectCommand vs multipart upload
 *
 * Phase 18 uses `PutObjectCommand` (buffered single PUT) deliberately. The
 * fflate `zipSync` call assembles the full archive in memory and the final
 * Uint8Array is handed to a single PutObject call. This avoids the S3 5MB
 * minimum-part-size accumulator complexity of multipart upload. Typical
 * packs are bounded (single policy, <100MB with recordings). If packs
 * routinely exceed ~100MB in production, upgrade to multipart by:
 *
 *   1. Switching to fflate's streaming `Zip` class with a chunk callback
 *   2. Accumulating >=5MB buffers before calling UploadPartCommand
 *   3. Calling CompleteMultipartUploadCommand on end (Abort on error)
 *
 * See 18-RESEARCH.md § "R2 multipart upload bridge" for the full pattern.
 *
 * Pitfall 2 (Phase 17): step.run return values must be JSON-safe. All binary
 * fetch + ZIP assembly + upload happens INSIDE one step.run call. We return
 * only { r2Key, fileCount, totalBytes, degraded, missingCount } — no Buffer
 * and no Uint8Array cross a step boundary. Metadata bytes are Array.from()'d
 * at the build-metadata boundary and rehydrated into Uint8Array inside
 * assemble-and-upload.
 *
 * Pitfall 7 (Phase 16): Inngest triggers inlined directly in createFunction
 * options to prevent type widening that collapses event.data to `any`. See
 * src/inngest/README.md § 90-94.
 *
 * R2 key format (Warning 4 / amended ROADMAP SC-3): the key is constructed
 * manually as `evidence-packs/${documentId}-${Date.now()}.zip`. Do NOT route
 * through the generic r2 helper that produces `{folder}/{timestamp}-{random}-{name}`
 * — that format breaks the readable documentId-timestamp ordering required
 * by the amended Phase 18 Success Criterion 3.
 */

const BINARY_FETCH_TIMEOUT_MS = 30_000

interface ArtifactRow {
  id: string
  title: string
  type: 'file' | 'link'
  url: string
  fileName: string | null
}

interface MissingBinary {
  artifactId: string
  title: string
  publicUrl: string
  error: 'timeout' | 'fetch_failed' | 'link_type' | 'key_derivation_failed'
}

function deriveR2Key(publicUrl: string): string | null {
  const prefix = `${R2_PUBLIC_URL}/`
  if (!publicUrl.startsWith(prefix)) return null
  return publicUrl.slice(prefix.length)
}

async function fetchBinaryWithTimeout(
  url: string,
): Promise<
  | { ok: true; bytes: Uint8Array }
  | { ok: false; error: 'timeout' | 'fetch_failed' }
> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), BINARY_FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return { ok: false, error: 'fetch_failed' }
    const ab = await res.arrayBuffer()
    return { ok: true, bytes: new Uint8Array(ab) }
  } catch (err) {
    clearTimeout(timer)
    const aborted = (err as { name?: string })?.name === 'AbortError'
    return { ok: false, error: aborted ? 'timeout' : 'fetch_failed' }
  }
}

function unavailablePlaceholder(artifact: ArtifactRow, reason: string): Uint8Array {
  const text =
    `File not included in pack.\n\n` +
    `Artifact: ${artifact.title}\n` +
    `Type:     ${artifact.type}\n` +
    `URL:      ${artifact.url}\n` +
    `Reason:   ${reason}\n`
  return strToU8(text)
}

export const evidencePackExportFn = inngest.createFunction(
  {
    id: 'evidence-pack-export',
    name: 'Evidence pack — async ZIP assembly + R2 upload + email',
    retries: 2,
    // Inlined per src/inngest/README.md §90-94 (type widening footgun).
    triggers: [{ event: evidenceExportRequestedEvent }],
  },
  async ({ event, step }) => {
    const { documentId, requestedBy, userEmail } = event.data

    // Step 1: build all metadata files (CSV/JSON) — reuses existing service.
    // Record<string, Uint8Array> is not JSON-safe, so we serialize to
    // Record<string, number[]> at the step boundary and rehydrate later.
    const metadataFiles = await step.run('build-metadata', async () => {
      const record = await buildEvidencePack(documentId)
      const serializable: Record<string, number[]> = {}
      for (const [name, bytes] of Object.entries(record)) {
        serializable[name] = Array.from(bytes)
      }
      return serializable
    })

    // Step 2: list all binary artifacts linked to this document (via feedback
    // items in this document AND sections in this document).
    //
    // Each query uses exactly one .innerJoin() and filters the third table
    // with a SQL EXISTS subquery. That shape keeps the query chain one-level
    // deep which matches the Phase 18 Wave 0 test fixture shape while still
    // producing correct SQL at runtime.
    const artifacts = await step.run('list-binary-artifacts', async () => {
      // Feedback-attached artifacts for this document.
      const feedbackAttached = await db
        .select({
          id:       evidenceArtifacts.id,
          title:    evidenceArtifacts.title,
          type:     evidenceArtifacts.type,
          url:      evidenceArtifacts.url,
          fileName: evidenceArtifacts.fileName,
        })
        .from(evidenceArtifacts)
        .innerJoin(
          feedbackEvidence,
          sql`${feedbackEvidence.artifactId} = ${evidenceArtifacts.id}`,
        )
        .where(
          sql`EXISTS (
            SELECT 1 FROM ${feedbackItems}
            WHERE ${feedbackItems.id} = ${feedbackEvidence.feedbackId}
              AND ${feedbackItems.documentId} = ${documentId}
          )`,
        )

      // Section-attached artifacts for sections in this document.
      const sectionAttached = await db
        .select({
          id:       evidenceArtifacts.id,
          title:    evidenceArtifacts.title,
          type:     evidenceArtifacts.type,
          url:      evidenceArtifacts.url,
          fileName: evidenceArtifacts.fileName,
        })
        .from(evidenceArtifacts)
        .innerJoin(
          sectionEvidence,
          sql`${sectionEvidence.artifactId} = ${evidenceArtifacts.id}`,
        )
        .where(
          sql`EXISTS (
            SELECT 1 FROM ${policySections}
            WHERE ${policySections.id} = ${sectionEvidence.sectionId}
              AND ${policySections.documentId} = ${documentId}
          )`,
        )

      // Dedupe by artifact id (an artifact can be attached to both a
      // feedback item and a section in the same document).
      const seen = new Set<string>()
      const all: ArtifactRow[] = []
      for (const row of [...feedbackAttached, ...sectionAttached]) {
        if (seen.has(row.id)) continue
        seen.add(row.id)
        all.push(row as ArtifactRow)
      }
      return all
    })

    // Step 3: assemble ZIP (metadata + fetched binaries + UNAVAILABLE
    // placeholders) and upload to R2. JSON-safe return only.
    const uploadResult = await step.run('assemble-and-upload', async () => {
      // Rehydrate metadata files into Uint8Array.
      const files: Record<string, Uint8Array> = {}
      for (const [name, arr] of Object.entries(metadataFiles)) {
        files[name] = new Uint8Array(arr)
      }

      const missing: MissingBinary[] = []

      // Process each artifact sequentially. Parallelism could help throughput
      // but would complicate degraded-mode accounting and we want predictable
      // memory use (one binary in flight at a time).
      for (const art of artifacts) {
        const safeName = (art.fileName ?? art.title).replace(/[^a-zA-Z0-9._-]/g, '_')

        if (art.type === 'link') {
          files[`binaries/${art.id}-UNAVAILABLE.txt`] = unavailablePlaceholder(
            art,
            'External link — not fetchable from R2',
          )
          missing.push({
            artifactId: art.id,
            title:      art.title,
            publicUrl:  art.url,
            error:      'link_type',
          })
          continue
        }

        const key = deriveR2Key(art.url)
        if (!key) {
          files[`binaries/${art.id}-UNAVAILABLE.txt`] = unavailablePlaceholder(
            art,
            'Could not derive R2 key from public URL',
          )
          missing.push({
            artifactId: art.id,
            title:      art.title,
            publicUrl:  art.url,
            error:      'key_derivation_failed',
          })
          continue
        }

        // Short-lived presigned GET for internal fetch (5 min).
        const presigned = await getDownloadUrl(key, 300)
        const result = await fetchBinaryWithTimeout(presigned)
        if (!result.ok) {
          files[`binaries/${art.id}-UNAVAILABLE.txt`] = unavailablePlaceholder(
            art,
            result.error === 'timeout' ? 'Fetch timed out after 30s' : 'R2 fetch failed',
          )
          missing.push({
            artifactId: art.id,
            title:      art.title,
            publicUrl:  art.url,
            error:      result.error,
          })
          continue
        }

        files[`binaries/${art.id}/${safeName}`] = result.bytes
      }

      // Assemble the ZIP (fflate zipSync — buffered, single PUT).
      // RFC: see file-level JSDoc for multipart upgrade path.
      const zipped = zipSync(files, { level: 6 })

      // Manual key construction per Warning 4 / amended ROADMAP SC-3.
      // Format: evidence-packs/{documentId}-{timestamp}.zip — readable and
      // sortable. We bypass the generic r2 key helper deliberately (see
      // file-level JSDoc for rationale).
      const r2Key = `evidence-packs/${documentId}-${Date.now()}.zip`

      await r2Client.send(
        new PutObjectCommand({
          Bucket:             process.env.R2_BUCKET_NAME!,
          Key:                r2Key,
          Body:               zipped,
          ContentType:        'application/zip',
          ContentDisposition: `attachment; filename="evidence-pack-${documentId}.zip"`,
        }),
      )

      return {
        r2Key,
        fileCount:    Object.keys(files).length,
        totalBytes:   zipped.length,
        degraded:     missing.length > 0,
        missingCount: missing.length,
      }
    })

    // Step 4: generate 24h presigned GET URL for email delivery (EV-07).
    const downloadUrl = await step.run('generate-presigned-url', async () => {
      return await getDownloadUrl(uploadResult.r2Key, 86400)
    })

    // Step 5: send email to the requester (silent no-op if userEmail null).
    await step.run('send-email', async () => {
      const expiresAt = new Date(Date.now() + 86400 * 1000).toISOString()
      const doc = await db.query.policyDocuments.findFirst({
        where: sql`${policyDocuments.id} = ${documentId}`,
      })
      await sendEvidencePackReadyEmail(userEmail, {
        documentTitle:  doc?.title ?? 'Unknown Policy',
        downloadUrl,
        fileCount:      uploadResult.fileCount,
        totalSizeBytes: uploadResult.totalBytes,
        expiresAt,
        degraded:       uploadResult.degraded,
      })
    })

    // Step 6: audit log (EV-05 trace).
    await step.run('write-audit-log', async () => {
      await writeAuditLog({
        actorId:    requestedBy,
        // actorRole is not carried on the event; downstream permission checks
        // are on the `evidence:export` capability, not the role label. Use
        // 'auditor' as a conservative default (only auditor + admin hold the
        // export permission in the current matrix).
        actorRole:  'auditor',
        action:     ACTIONS.EVIDENCE_PACK_EXPORT,
        entityType: 'document',
        entityId:   documentId,
        payload: {
          async:      true,
          r2Key:      uploadResult.r2Key,
          fileCount:  uploadResult.fileCount,
          totalBytes: uploadResult.totalBytes,
          degraded:   uploadResult.degraded,
        },
      })
    })

    return {
      r2Key:      uploadResult.r2Key,
      fileCount:  uploadResult.fileCount,
      totalBytes: uploadResult.totalBytes,
      downloadUrl,
      degraded:   uploadResult.degraded,
    }
  },
)
