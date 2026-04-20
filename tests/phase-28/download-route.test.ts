import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Phase 28 — GREEN contract for app/api/research/[id]/download/route.ts.
 *
 * Locks: 302 redirect for valid published+file-backed, 404 for not-published
 * or no-file, 429 for rate-limit, R2 key derivation from artifact.url
 * (strip R2_PUBLIC_URL prefix), expiresIn=86400 (24h TTL), and namespaced
 * rate-limit key `research-download:ip:{ip}`.
 *
 * Plan 28-01 shipped src/server/queries/research-public.ts and
 * app/api/research/[id]/download/route.ts. Plan 28-04 (this) flips these
 * Wave 0 stubs to real assertions exercising the production handler.
 */

// R2_PUBLIC_URL must be set BEFORE importing the route handler (route.ts
// pulls R2_PUBLIC_URL via requireEnv at module-import time inside src/lib/r2.ts).
process.env.R2_PUBLIC_URL = 'https://pub-xxx.r2.dev'
process.env.R2_ENDPOINT = 'https://example.r2.cloudflarestorage.com'
process.env.R2_ACCESS_KEY_ID = 'test-access'
process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
process.env.R2_BUCKET_NAME = 'test-bucket'

const mockGetDownloadUrl = vi.fn(
  async (key: string, ttl: number) =>
    `https://r2-presigned.example/${key}?ttl=${ttl}`,
)
const mockConsume = vi.fn(() => ({ ok: true, remaining: 9, resetAt: Date.now() + 60_000 }))
const mockGetClientIp = vi.fn(() => '1.2.3.4')

vi.mock('@/src/lib/r2', () => ({
  R2_PUBLIC_URL: 'https://pub-xxx.r2.dev',
  getDownloadUrl: (key: string, ttl: number) => mockGetDownloadUrl(key, ttl),
}))

vi.mock('@/src/lib/rate-limit', () => ({
  consume: (...a: unknown[]) => mockConsume(...(a as Parameters<typeof mockConsume>)),
  getClientIp: (...a: unknown[]) => mockGetClientIp(...(a as Parameters<typeof mockGetClientIp>)),
}))

// Drizzle chain: select(...).from(...).where(...).limit(...) → Promise<rows[]>
// The route makes 2 sequential select() calls — research items (id, status,
// artifactId) then evidence_artifacts (url). We swap the resolved rows per
// call so each test scenario can control what the route sees.
let researchRows: unknown[] = []
let artifactRows: unknown[] = []
let selectCallIdx = 0
const buildChain = (rows: unknown[]) => ({
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue(rows),
})

vi.mock('@/src/db', () => ({
  db: {
    select: vi.fn(() => {
      const chain =
        selectCallIdx === 0
          ? buildChain(researchRows)
          : buildChain(artifactRows)
      selectCallIdx++
      return chain
    }),
  },
}))

import { GET } from '@/app/api/research/[id]/download/route'

const validId = '11111111-2222-3333-4444-555555555555'

function buildRequest(): Request {
  return new Request(
    `https://example.com/api/research/${validId}/download`,
    {
      method: 'GET',
      headers: { 'x-forwarded-for': '1.2.3.4' },
    },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  selectCallIdx = 0
  researchRows = []
  artifactRows = []
  mockConsume.mockImplementation(() => ({
    ok: true,
    remaining: 9,
    resetAt: Date.now() + 60_000,
  }))
  mockGetClientIp.mockReturnValue('1.2.3.4')
  mockGetDownloadUrl.mockImplementation(
    async (key: string, ttl: number) =>
      `https://r2-presigned.example/${key}?ttl=${ttl}`,
  )
})

describe('GET /api/research/[id]/download — RESEARCH-10', () => {
  it('returns 302 redirect to presigned URL for published file-backed item', async () => {
    researchRows = [{ id: validId, status: 'published', artifactId: 'art-1' }]
    artifactRows = [{ url: 'https://pub-xxx.r2.dev/research/file.pdf' }]
    const res = await GET(buildRequest() as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: validId }),
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('r2-presigned.example')
  })

  it('location header matches presigned pattern with 86400s TTL', async () => {
    researchRows = [{ id: validId, status: 'published', artifactId: 'art-1' }]
    artifactRows = [{ url: 'https://pub-xxx.r2.dev/research/file.pdf' }]
    const res = await GET(buildRequest() as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: validId }),
    })
    expect(res.headers.get('location')).toContain('ttl=86400')
  })

  it('returns 404 when item.status != "published"', async () => {
    researchRows = [{ id: validId, status: 'draft', artifactId: 'art-1' }]
    const res = await GET(buildRequest() as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: validId }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 when item.artifactId is null (URL-only item)', async () => {
    researchRows = [{ id: validId, status: 'published', artifactId: null }]
    const res = await GET(buildRequest() as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: validId }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 when evidence_artifacts row has null url', async () => {
    researchRows = [{ id: validId, status: 'published', artifactId: 'art-1' }]
    artifactRows = [{ url: null }]
    const res = await GET(buildRequest() as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: validId }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 429 with Retry-After header when consume() returns ok=false', async () => {
    mockConsume.mockReturnValue({
      ok: false,
      remaining: 0,
      resetAt: Date.now() + 30_000,
    })
    const res = await GET(buildRequest() as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: validId }),
    })
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBeTruthy()
  })

  it('derives R2 key from artifact.url by stripping R2_PUBLIC_URL prefix', async () => {
    researchRows = [{ id: validId, status: 'published', artifactId: 'art-1' }]
    artifactRows = [{ url: 'https://pub-xxx.r2.dev/research/1234-abcd-file.pdf' }]
    await GET(buildRequest() as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: validId }),
    })
    expect(mockGetDownloadUrl).toHaveBeenCalledWith(
      'research/1234-abcd-file.pdf',
      expect.any(Number),
    )
  })

  it('passes expiresIn=86400 (24h) to getDownloadUrl', async () => {
    researchRows = [{ id: validId, status: 'published', artifactId: 'art-1' }]
    artifactRows = [{ url: 'https://pub-xxx.r2.dev/research/file.pdf' }]
    await GET(buildRequest() as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: validId }),
    })
    expect(mockGetDownloadUrl).toHaveBeenCalledWith(expect.any(String), 86400)
  })

  it('uses namespaced rate-limit key: research-download:ip:{ip}', async () => {
    researchRows = [{ id: validId, status: 'published', artifactId: 'art-1' }]
    artifactRows = [{ url: 'https://pub-xxx.r2.dev/research/file.pdf' }]
    await GET(buildRequest() as Parameters<typeof GET>[0], {
      params: Promise.resolve({ id: validId }),
    })
    expect(mockConsume).toHaveBeenCalledWith(
      'research-download:ip:1.2.3.4',
      expect.objectContaining({ max: 10 }),
    )
  })
})
