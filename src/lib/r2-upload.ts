/**
 * R2 file upload utilities.
 * Drop-in replacement for the previous Uploadthing hooks.
 */

interface UploadResult {
  url: string
  name: string
  key: string
}

interface UploadOptions {
  // Phase 27 D-04: research category added for citable research artifacts
  // (PDF/DOCX/DOC/CSV/XLSX/XLS, 32MB cap). Server allowlist in
  // app/api/upload/route.ts MUST stay in sync with this literal.
  category?: 'image' | 'document' | 'evidence' | 'research'
  onProgress?: (percent: number) => void
}

/**
 * Upload a file to R2 via presigned URL.
 *
 * 1. POST /api/upload to get presigned PUT URL
 * 2. PUT file directly to R2
 * 3. Return public URL
 */
export async function uploadFile(file: File, options: UploadOptions = {}): Promise<UploadResult> {
  const { category = 'evidence', onProgress } = options

  // Step 1: Get presigned URL from our API
  const presignRes = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      category,
      fileSize: file.size,
    }),
  })

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(err.error || 'Failed to get upload URL')
  }

  const { uploadUrl, publicUrl, key } = await presignRes.json()

  // Step 2: Upload directly to R2.
  //
  // The presigned URL is signed with ContentDisposition: 'attachment' (see
  // src/lib/r2.ts getUploadUrl), and its X-Amz-SignedHeaders includes
  // content-disposition. We MUST send the same Content-Disposition header
  // on the PUT or R2 computes a different signature and returns 403 -
  // which Chrome surfaces as a misleading CORS error because 403
  // responses carry no Access-Control-Allow-Origin header.
  const putHeaders = {
    'Content-Type': file.type,
    'Content-Disposition': 'attachment',
  }

  if (onProgress) {
    // Use XMLHttpRequest for progress tracking
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      })
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error(`Upload failed with status ${xhr.status}`))
      })
      xhr.addEventListener('error', () => reject(new Error('Upload failed')))
      xhr.open('PUT', uploadUrl)
      for (const [name, value] of Object.entries(putHeaders)) {
        xhr.setRequestHeader(name, value)
      }
      xhr.send(file)
    })
  } else {
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: putHeaders,
      body: file,
    })
    if (!putRes.ok) {
      throw new Error('Failed to upload file to storage')
    }
  }

  return { url: publicUrl, name: file.name, key }
}

/**
 * Upload multiple files to R2.
 */
export async function uploadFiles(files: File[], options: UploadOptions = {}): Promise<UploadResult[]> {
  return Promise.all(files.map((file) => uploadFile(file, options)))
}
