import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!

export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

/**
 * Generate a presigned PUT URL for uploading a file to R2.
 * SECURITY: ContentLength enforces server-side file size validation.
 * ContentDisposition: attachment prevents inline rendering (XSS via SVG etc).
 */
export async function getUploadUrl(key: string, contentType: string, contentLength?: number, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ...(contentLength ? { ContentLength: contentLength } : {}),
    ContentDisposition: 'attachment',
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
 */
export function generateStorageKey(folder: string, fileName: string) {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 8)
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${folder}/${timestamp}-${random}-${sanitized}`
}
