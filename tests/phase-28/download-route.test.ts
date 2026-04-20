import { describe, it, vi, beforeEach } from 'vitest'

/**
 * Phase 28 Wave 0 — RED contract for app/api/research/[id]/download/route.ts.
 *
 * Locks: 302 redirect for valid published+file-backed, 404 for not-published
 * or no-file, 429 for rate-limit, R2 key derivation from artifact.url
 * (strip R2_PUBLIC_URL prefix), expiresIn=86400 (24h TTL), and namespaced
 * rate-limit key `research-download:ip:{ip}`.
 *
 * Variable-path dynamic import (canonical Phase 16/17/19/20.5/21/22/26/27
 * pattern) defers module resolution until Plan 28-01 ships the route handler.
 */

vi.mock('@/src/db', () => ({
  db: { select: vi.fn() },
}))

vi.mock('@/src/lib/r2', () => ({
  getDownloadUrl: vi.fn(
    async (key: string, ttl: number) =>
      `https://r2-presigned.example/${key}?ttl=${ttl}`,
  ),
}))

vi.mock('@/src/lib/rate-limit', () => ({
  consume: vi.fn(() => ({ ok: true, remaining: 9, resetAt: Date.now() + 60000 })),
  getClientIp: vi.fn(() => '1.2.3.4'),
}))

let GET: any
beforeEach(async () => {
  vi.clearAllMocks()
  process.env.R2_PUBLIC_URL = 'https://pub-xxx.r2.dev'
  const segs = ['@', 'app', 'api', 'research', '[id]', 'download', 'route']
  try {
    const mod = await import(/* @vite-ignore */ segs.join('/'))
    GET = mod.GET
  } catch {
    // Intentional: Wave 0 RED state. Plan 28-01 will make this import succeed.
    GET = null
  }
})

describe('GET /api/research/[id]/download — RESEARCH-10', () => {
  it.todo('returns 302 redirect to presigned URL for published file-backed item')
  it.todo('location header matches presigned pattern with 86400s TTL')
  it.todo('returns 404 when item.status != "published"')
  it.todo('returns 404 when item.artifactId is null (URL-only item)')
  it.todo('returns 404 when evidence_artifacts row has null url')
  it.todo('returns 429 with Retry-After header when consume() returns ok=false')
  it.todo('derives R2 key from artifact.url by stripping R2_PUBLIC_URL prefix')
  it.todo('passes expiresIn=86400 (24h) to getDownloadUrl')
  it.todo('uses namespaced rate-limit key: research-download:ip:{ip}')
})
