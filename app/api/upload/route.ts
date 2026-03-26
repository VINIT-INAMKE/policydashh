import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getUploadUrl, generateStorageKey, getPublicUrl } from '@/src/lib/r2'

const MAX_FILE_SIZE: Record<string, number> = {
  image: 16 * 1024 * 1024,    // 16MB
  document: 32 * 1024 * 1024, // 32MB
  evidence: 32 * 1024 * 1024, // 32MB
}

const ALLOWED_TYPES: Record<string, string[]> = {
  image: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  evidence: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
}

/**
 * POST /api/upload
 * Returns a presigned PUT URL for R2 upload.
 *
 * Body: { fileName: string, contentType: string, category: 'image' | 'document' | 'evidence', fileSize: number }
 * Response: { uploadUrl: string, publicUrl: string, key: string }
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { fileName, contentType, category = 'evidence', fileSize } = body as {
    fileName: string
    contentType: string
    category: 'image' | 'document' | 'evidence'
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

  // Validate file size
  if (fileSize && fileSize > maxSize) {
    return NextResponse.json({ error: `File too large. Maximum ${maxSize / (1024 * 1024)}MB` }, { status: 400 })
  }

  // Validate content type
  if (!allowedTypes.includes(contentType)) {
    return NextResponse.json({ error: `File type ${contentType} not allowed for ${category}` }, { status: 400 })
  }

  const key = generateStorageKey(category, fileName)
  const uploadUrl = await getUploadUrl(key, contentType)
  const publicUrl = getPublicUrl(key)

  return NextResponse.json({ uploadUrl, publicUrl, key })
}
