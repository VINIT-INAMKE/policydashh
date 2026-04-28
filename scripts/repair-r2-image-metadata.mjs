#!/usr/bin/env node
/**
 * One-off repair script: strip `Content-Disposition: attachment` from every
 * existing `image/*` object in the R2 bucket.
 *
 * Why:
 *   src/lib/r2.ts originally signed every presigned PUT with
 *   `ContentDisposition: 'attachment'`, which R2 stores as permanent object
 *   metadata. The browser then receives `Content-Disposition: attachment`
 *   on GET and refuses to render the image inline. The application code
 *   fix (commit landing alongside this script) stops setting the header
 *   for images going forward — but historical objects keep the broken
 *   metadata until rewritten.
 *
 *   This script lists every key under the `image/` prefix and issues a
 *   `CopyObject` with `MetadataDirective: 'REPLACE'` to overwrite the
 *   metadata in-place. The bytes are unchanged; only the headers are
 *   replaced.
 *
 * Usage:
 *   node scripts/repair-r2-image-metadata.mjs            # actually rewrite
 *   node scripts/repair-r2-image-metadata.mjs --dry-run  # list candidates
 *
 * Idempotent: rerunning is safe — objects without ContentDisposition stay
 * unchanged (we still replace metadata but the new metadata is the same
 * minus the dropped header).
 *
 * Required env (read from .env.local): R2_ENDPOINT, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME.
 */

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { config as dotenvConfig } from 'dotenv'
import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenvConfig({ path: path.join(__dirname, '..', '.env.local') })

const required = [
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
]
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env: ${key}`)
    process.exit(1)
  }
}

const dryRun = process.argv.includes('--dry-run')
const Bucket = process.env.R2_BUCKET_NAME

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
})

async function* listImageKeys() {
  let token
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket,
        Prefix: 'image/',
        ContinuationToken: token,
      }),
    )
    for (const obj of res.Contents ?? []) {
      if (obj.Key) yield obj.Key
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
}

async function repairOne(Key) {
  const head = await client.send(new HeadObjectCommand({ Bucket, Key }))
  const disposition = head.ContentDisposition
  if (!disposition) {
    return { Key, action: 'skip', reason: 'already-clean' }
  }
  if (dryRun) {
    return { Key, action: 'would-rewrite', current: disposition }
  }
  // CopyObject with same source+dest + MetadataDirective REPLACE rewrites
  // metadata in place. Preserve the original Content-Type so the image
  // still renders correctly. We deliberately do NOT pass ContentDisposition
  // — omitting it on a REPLACE means the new object has none.
  await client.send(
    new CopyObjectCommand({
      Bucket,
      Key,
      CopySource: `${Bucket}/${encodeURIComponent(Key)}`,
      MetadataDirective: 'REPLACE',
      ContentType: head.ContentType,
      // Preserve any non-Disposition user metadata. Cloudflare R2 maps
      // these to `x-amz-meta-*` headers — passing them through keeps any
      // custom tags (we don't currently set any, but defensive).
      Metadata: head.Metadata ?? {},
    }),
  )
  return { Key, action: 'rewrote', was: disposition }
}

async function main() {
  console.log(
    `${dryRun ? '[DRY RUN] ' : ''}Scanning bucket "${Bucket}" for image/* objects with Content-Disposition...`,
  )
  let scanned = 0
  let rewrote = 0
  let skipped = 0
  let failed = 0
  const failures = []

  for await (const Key of listImageKeys()) {
    scanned += 1
    try {
      const result = await repairOne(Key)
      if (result.action === 'skip') {
        skipped += 1
      } else if (result.action === 'rewrote') {
        rewrote += 1
        console.log(`  rewrote ${Key} (was: ${result.was})`)
      } else if (result.action === 'would-rewrite') {
        rewrote += 1
        console.log(`  would rewrite ${Key} (current: ${result.current})`)
      }
    } catch (err) {
      failed += 1
      failures.push({ Key, err: err instanceof Error ? err.message : String(err) })
      console.error(`  FAILED ${Key}: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log('')
  console.log(`Scanned:  ${scanned}`)
  console.log(`${dryRun ? 'Would rewrite' : 'Rewrote'}:  ${rewrote}`)
  console.log(`Skipped:  ${skipped}`)
  console.log(`Failed:   ${failed}`)
  if (failures.length > 0) {
    console.log('')
    console.log('Failures:')
    for (const f of failures) console.log(`  ${f.Key} -> ${f.err}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
