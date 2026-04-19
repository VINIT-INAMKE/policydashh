import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUploadUrl, generateStorageKey, getPublicUrl } from '@/src/lib/r2'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { can } from '@/src/lib/permissions'
import type { Role } from '@/src/lib/constants'
import { consume } from '@/src/lib/rate-limit'
import { eq } from 'drizzle-orm'

const MAX_FILE_SIZE: Record<string, number> = {
  image: 16 * 1024 * 1024,    // 16MB
  document: 32 * 1024 * 1024, // 32MB
  // F20: recordings share the evidence cap. 25MB is the Groq Whisper free-
  // tier cap used by the recording pipeline; we keep evidence at 32MB for
  // non-recording files but cap workshop recordings below via the
  // `recording` category. The attach dialog picks the right category by
  // MIME type.
  evidence: 32 * 1024 * 1024, // 32MB
  recording: 25 * 1024 * 1024, // 25MB - Groq Whisper free-tier file-size cap (LLM-02)
  // Phase 27 D-04: research items include datasets (CSV/XLSX) that
  // don't fit 'document' or 'evidence' MIME sets. 32MB cap matches
  // document/evidence; exceeds the worst-case NITI report PDF by 2x.
  research: 32 * 1024 * 1024,
}

// Audio/video MIME set shared between `evidence` (F20 - pass through audio
// files attached as workshop artifacts when the caller does not opt in to the
// dedicated `recording` category) and `recording` (workshop recording pipeline
// uploads, which also trigger Groq transcription).
const AUDIO_VIDEO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'audio/x-m4a',
  'video/mp4',
  'video/webm',
] as const

const ALLOWED_TYPES: Record<string, string[]> = {
  // SECURITY: SVG removed to prevent XSS via uploaded SVG files
  image: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  // F20: include audio/video so workshop moderators can attach a recording
  // (or a synced audio track) as evidence without a dedicated category on
  // the client. The dedicated `recording` category below is used by the
  // transcription pipeline; both share the same MIME allowlist.
  evidence: [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ...AUDIO_VIDEO_MIME_TYPES,
  ],
  // Workshop recording uploads (WS-14). Audio MIME allowlist matches the
  // Groq Whisper-supported formats; video containers are included because
  // browser MediaRecorder and screen-recording tools commonly wrap audio
  // streams in `video/mp4` / `video/webm`. Groq extracts the audio track.
  recording: [...AUDIO_VIDEO_MIME_TYPES],
  // Phase 27 D-04: research module citable artifacts. PDF/DOCX/DOC
  // cover reports + papers + memos; CSV/XLSX/XLS cover datasets. No
  // audio/video — those remain in the recording category (WS-14).
  research: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
}

/**
 * POST /api/upload
 * Returns a presigned PUT URL for R2 upload.
 *
 * Body: { fileName: string, contentType: string, category: 'image' | 'document' | 'evidence' | 'recording', fileSize: number }
 * Response: { uploadUrl: string, publicUrl: string, key: string }
 *
 * B12: per-user rate limit via src/lib/rate-limit.ts - 20 presigns / minute.
 * Matches the original TODO's recommended 10 req/min but doubled to cover
 * legit multi-file picks; still short-circuits obvious abuse.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // B12: per-user presign rate limit. Keyed on Clerk userId so a single
  // session cannot fan out presign requests across thousands of keys per
  // minute.
  const limit = consume(`upload-presign:user:${userId}`, {
    max: 20,
    windowMs: 60_000,
  })
  if (!limit.ok) {
    // P4: surface Retry-After so well-behaved clients (and Inngest replay
    // logic) back off for the precise window remaining.
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))
    return NextResponse.json(
      { error: 'Too many upload requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  // SECURITY: RBAC check - verify user has evidence:upload permission
  const user = await db.query.users.findFirst({ where: eq(users.clerkId, userId) })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 })
  }
  if (!can(user.role as Role, 'evidence:upload')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // B10: body-size cap. The presign envelope is a tiny JSON object
  // (fileName/contentType/fileSize/category). Reject anything larger than
  // 4 KB before calling .json() so a malicious caller cannot waste parse
  // cycles on a multi-MB payload.
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > 4096) {
    return NextResponse.json(
      { error: 'Request body too large' },
      { status: 413 },
    )
  }

  const body = await request.json()
  const { fileName, contentType, category = 'evidence', fileSize } = body as {
    fileName: string
    contentType: string
    category: 'image' | 'document' | 'evidence' | 'recording' | 'research'
    fileSize: number
  }

  if (!fileName || !contentType) {
    return NextResponse.json({ error: 'fileName and contentType required' }, { status: 400 })
  }

  // Validate category
  const maxSize = MAX_FILE_SIZE[category]
  const allowedTypes = ALLOWED_TYPES[category]
  if (!maxSize || !allowedTypes) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  // SECURITY: Require fileSize as a positive number to prevent bypass when 0/undefined
  if (typeof fileSize !== 'number' || fileSize <= 0) {
    return NextResponse.json({ error: 'fileSize must be a positive number' }, { status: 400 })
  }

  if (fileSize > maxSize) {
    return NextResponse.json({ error: `File too large. Maximum ${maxSize / (1024 * 1024)}MB` }, { status: 400 })
  }

  // Validate content type
  if (!allowedTypes.includes(contentType)) {
    return NextResponse.json({ error: `File type ${contentType} not allowed for ${category}` }, { status: 400 })
  }

  // P9: cross-check the fileName extension against the declared contentType.
  // The presigned PUT passes `ContentType` to R2 as a metadata hint only;
  // R2 does not re-validate the actual uploaded bytes against it. A client
  // claiming `image/png` with `evil.html` bytes would land a file that a
  // proxy stripping ContentDisposition could serve inline. We block the
  // obvious script/HTML extensions plus any extension that disagrees with
  // the declared MIME's typical family.
  const ext = (fileName.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase()
  const BANNED_EXTENSIONS = new Set([
    'js', 'mjs', 'cjs',
    'html', 'htm', 'xhtml',
    'svg',           // SECURITY: inline XSS vector
    'php', 'phtml', 'phar',
    'sh', 'bash', 'zsh',
    'exe', 'dll', 'bat', 'cmd',
    'asp', 'aspx', 'jsp',
  ])
  if (ext && BANNED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: `File extension .${ext} is not permitted` },
      { status: 400 },
    )
  }

  // Lightweight MIME/extension family check. We only compare the top-level
  // type (image/*, application/*, audio/*, video/*) because the upload
  // allowlist is MIME-keyed and the fileName is purely for display; the
  // key is to catch e.g. `.html` with `image/png` declared.
  const mimeFamily = contentType.split('/')[0]
  const EXT_TO_FAMILY: Record<string, string> = {
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image',
    pdf: 'application', doc: 'application', docx: 'application',
    // Phase 27 D-04: text/csv ↔ .csv extension; xls/xlsx are application/vnd.ms-excel
    // and application/vnd.openxmlformats-officedocument.spreadsheetml.sheet respectively.
    csv: 'text',
    xls: 'application',
    xlsx: 'application',
    mp3: 'audio', wav: 'audio', ogg: 'audio', flac: 'audio', m4a: 'audio',
    mp4: 'video', webm: 'video',
  }
  if (ext && EXT_TO_FAMILY[ext] && EXT_TO_FAMILY[ext] !== mimeFamily) {
    return NextResponse.json(
      {
        error: `File extension .${ext} does not match declared content type ${contentType}`,
      },
      { status: 400 },
    )
  }

  const key = generateStorageKey(category, fileName)
  // SECURITY: Pass fileSize as ContentLength and force attachment Content-Disposition
  const uploadUrl = await getUploadUrl(key, contentType, fileSize)
  const publicUrl = getPublicUrl(key)

  return NextResponse.json({ uploadUrl, publicUrl, key })
}
