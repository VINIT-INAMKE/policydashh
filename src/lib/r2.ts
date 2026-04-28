import crypto from 'node:crypto'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Fail fast at import time if any required R2 env var is missing. Without
// this guard the S3 client happily stringifies `undefined` into a URL like
// `policydraft.undefined.r2.cloudflarestorage.com`, producing a confusing
// TLS error at upload time instead of a clear config error at boot.
function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `See .env.example for the full list of R2 variables.`,
    )
  }
  return value
}

const R2_ENDPOINT = requireEnv('R2_ENDPOINT')
const R2_ACCESS_KEY_ID = requireEnv('R2_ACCESS_KEY_ID')
const R2_SECRET_ACCESS_KEY = requireEnv('R2_SECRET_ACCESS_KEY')
const R2_BUCKET_NAME = requireEnv('R2_BUCKET_NAME')

export const R2_PUBLIC_URL = requireEnv('R2_PUBLIC_URL')

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  // R2's CORS policy is scoped to the account endpoint hostname
  // (e.g. https://<account-id>.r2.cloudflarestorage.com). The AWS SDK
  // defaults to virtual-hosted-style URLs (bucket.<account-id>...),
  // which is a different hostname and R2 does not serve CORS headers
  // for that variant. forcePathStyle keeps the hostname stable so the
  // bucket's CORS policy actually applies to browser uploads.
  forcePathStyle: true,
  // AWS SDK v3 (>= 3.729) started signing a zero CRC32 checksum into
  // presigned PUT URLs by default. R2 then validates the uploaded body
  // against that signed-in checksum, rejects the mismatch, and returns
  // 403 - which surfaces in the browser as a misleading CORS error
  // because 403 responses carry no Access-Control-Allow-Origin header.
  // Setting requestChecksumCalculation to WHEN_REQUIRED disables the
  // automatic checksum so presigned PUTs work against R2.
  requestChecksumCalculation: 'WHEN_REQUIRED',
})

/**
 * Generate a presigned PUT URL for uploading a file to R2.
 *
 * SECURITY:
 * - ContentLength enforces server-side file size validation.
 * - For non-image categories, ContentDisposition: attachment forces the
 *   browser to download rather than render inline, blocking XSS via
 *   uploaded HTML/PDF/etc. We intentionally OMIT this header for images:
 *   images must render inline in the editor and published pages, and SVG
 *   (the only inline-XSS image vector) is already blocked at upload time
 *   by the BANNED_EXTENSIONS list in app/api/upload/route.ts.
 *
 * Pass `inline: true` for image uploads.
 */
export async function getUploadUrl(
  key: string,
  contentType: string,
  contentLength?: number,
  expiresIn = 3600,
  inline = false,
) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ...(contentLength ? { ContentLength: contentLength } : {}),
    ...(inline ? {} : { ContentDisposition: 'attachment' }),
  })
  return getSignedUrl(r2Client, command, { expiresIn })
}

/**
 * Generate a presigned GET URL for downloading a file from R2.
 */
export async function getDownloadUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })
  return getSignedUrl(r2Client, command, { expiresIn })
}

/**
 * Delete a file from R2.
 */
export async function deleteFile(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })
  await r2Client.send(command)
}

/**
 * Get the public URL for a file stored in R2.
 */
export function getPublicUrl(key: string) {
  return `${R2_PUBLIC_URL}/${key}`
}

/**
 * Generate a unique storage key for a file.
 *
 * P8: the previous implementation used `Math.random().toString(36).slice(2, 8)`
 * which is ~31 bits of entropy (6 base-36 chars). Two concurrent uploads in
 * the same millisecond with the same filename could collide and overwrite each
 * other. Switched to `crypto.randomBytes(8).toString('hex')` (64 bits) so the
 * collision probability becomes cryptographically negligible and keys are no
 * longer guessable from the timestamp.
 */
export function generateStorageKey(folder: string, fileName: string) {
  const timestamp = Date.now()
  const random = crypto.randomBytes(8).toString('hex')
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${folder}/${timestamp}-${random}-${sanitized}`
}
