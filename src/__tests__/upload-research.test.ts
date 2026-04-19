/**
 * @vitest-environment node
 *
 * GREEN-target tests for app/api/upload/route.ts research category (Plan 27-01 Task 2).
 *
 * Asserts the POST handler accepts category: 'research' with the
 * PDF/DOCX/DOC/CSV/XLSX/XLS allowlist and 32MB cap (D-04). Mocks Clerk
 * auth, db user lookup, rate limiter, and R2 helpers so the route runs
 * in the node test environment without real infrastructure.
 *
 * Pattern source: src/__tests__/research-router.test.ts mock layout +
 * Phase 16+ direct-handler call pattern.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// Stub Clerk server auth — admin user with evidence:upload permission.
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(async () => ({ userId: 'clerk_user_test' })),
}))

// Stub R2 SDK helpers so we never hit network or env requireEnv().
vi.mock('@/src/lib/r2', () => ({
  getUploadUrl: vi.fn(async () => 'https://example.com/presigned-put-url'),
  generateStorageKey: vi.fn((category: string, fileName: string) => `${category}/2026/test-${fileName}`),
  getPublicUrl: vi.fn((key: string) => `https://r2.example.com/${key}`),
}))

// Stub rate limiter — never block.
vi.mock('@/src/lib/rate-limit', () => ({
  consume: vi.fn(() => ({ ok: true, remaining: 19, resetAt: Date.now() + 60_000 })),
}))

// Stub db.query.users.findFirst — return a research_lead with evidence:upload (admin role bypass to keep test simple).
vi.mock('@/src/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(async () => ({
          id:   'user-test-id',
          role: 'admin',
        })),
      },
    },
  },
}))

let POST: any

beforeAll(async () => {
  // Variable-path dynamic import — Phase 16+ pattern.
  const segs = ['@', '/', 'app', '/', 'api', '/', 'upload', '/', 'route']
  // The above join makes a token-like string Vite cannot statically resolve.
  // Use a simpler form that still defeats the static analyzer:
  const path = ['@', 'app', 'api', 'upload', 'route'].join('/')
  const mod = await import(/* @vite-ignore */ path)
  POST = mod.POST
})

beforeEach(() => {
  vi.clearAllMocks()
})

function makeRequest(body: unknown): Request {
  const json = JSON.stringify(body)
  return new Request('http://localhost/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type':   'application/json',
      'Content-Length': String(Buffer.byteLength(json)),
    },
    body: json,
  })
}

describe('POST /api/upload — research category (Phase 27 D-04)', () => {
  it('accepts research category with application/pdf MIME', async () => {
    const req = makeRequest({
      fileName:    'report.pdf',
      contentType: 'application/pdf',
      category:    'research',
      fileSize:    1024,
    })
    const res = await POST(req as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.uploadUrl).toBeTruthy()
    expect(body.publicUrl).toBeTruthy()
    expect(body.key).toBeTruthy()
  })

  it('accepts research category with text/csv MIME (dataset)', async () => {
    const req = makeRequest({
      fileName:    'dataset.csv',
      contentType: 'text/csv',
      category:    'research',
      fileSize:    2048,
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
  })

  it('accepts research category with DOCX MIME', async () => {
    const req = makeRequest({
      fileName:    'paper.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      category:    'research',
      fileSize:    1024,
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
  })

  it('accepts research category with XLSX MIME (spreadsheet)', async () => {
    const req = makeRequest({
      fileName:    'data.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      category:    'research',
      fileSize:    1024,
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
  })

  it('rejects research category with application/zip MIME (not in allowlist)', async () => {
    const req = makeRequest({
      fileName:    'archive.zip',
      contentType: 'application/zip',
      category:    'research',
      fileSize:    1024,
    })
    const res = await POST(req as any)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/not allowed for research/)
  })

  it('rejects research file >32MB (over MAX_FILE_SIZE.research)', async () => {
    const req = makeRequest({
      fileName:    'huge.pdf',
      contentType: 'application/pdf',
      category:    'research',
      fileSize:    33 * 1024 * 1024, // 33 MB
    })
    const res = await POST(req as any)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/too large/i)
  })

  it('proves research category is registered (NOT returning "Invalid category")', async () => {
    // Negative-path check — if MAX_FILE_SIZE.research or ALLOWED_TYPES.research
    // were missing, the route would return "Invalid category" with 400 BEFORE
    // checking MIME or size. A successful 200 here confirms wiring exists.
    const req = makeRequest({
      fileName:    'note.pdf',
      contentType: 'application/pdf',
      category:    'research',
      fileSize:    100,
    })
    const res = await POST(req as any)
    const body = await res.json().catch(() => ({}))
    if (res.status !== 200) {
      expect(body.error).not.toMatch(/Invalid category/)
    }
    expect(res.status).toBe(200)
  })
})
