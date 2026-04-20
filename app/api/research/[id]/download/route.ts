/**
 * Phase 28 Plan 28-01 — public presigned download Route Handler (RESEARCH-10).
 *
 * Route: GET /api/research/[id]/download
 *
 * Flow (28-RESEARCH.md Pattern 4):
 *   1. Rate-limit per IP (10 req / 60s) via src/lib/rate-limit.ts
 *   2. Fetch research item; 404 if not published or no artifactId
 *   3. Fetch evidence_artifacts row; 404 if url missing
 *   4. Derive R2 key by stripping R2_PUBLIC_URL prefix (Pitfall 2 — no r2_key column)
 *   5. Generate 24h presigned GET URL via src/lib/r2.ts
 *   6. 302 redirect — browser follows natively, triggers file download
 *
 * Public access: Clerk middleware in proxy.ts must whitelist '/api/research(.*)'.
 * That addition ships in Plan 28-04 (proxy.ts + CTA + REQUIREMENTS registration).
 * Until then, this route responds with Clerk's sign-in redirect for
 * unauthenticated requests — expected behavior during Phase 28 mid-execution.
 *
 * Leak prevention: the SELECT projection in this file intentionally does NOT
 * include any audit-trail columns. Only id, status, and artifactId are read —
 * no other surface exposure possible.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/src/db'
import { researchItems } from '@/src/db/schema/research'
import { evidenceArtifacts } from '@/src/db/schema/evidence'
import { R2_PUBLIC_URL, getDownloadUrl } from '@/src/lib/r2'
import { consume, getClientIp } from '@/src/lib/rate-limit'

const DOWNLOAD_TTL_SECONDS = 86_400   // 24h — RESEARCH-10 SC-4

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // 1. Rate-limit per IP
  const ip = getClientIp(request)
  const rl = consume(`research-download:ip:${ip}`, { max: 10, windowMs: 60_000 })
  if (!rl.ok) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Too many download requests. Please wait a moment and try again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.max(1, retryAfter)) },
      },
    )
  }

  // 2. Fetch research item (public-safe projection — no leak columns)
  const [item] = await db
    .select({
      id:         researchItems.id,
      status:     researchItems.status,
      artifactId: researchItems.artifactId,
    })
    .from(researchItems)
    .where(eq(researchItems.id, id))
    .limit(1)

  if (!item || item.status !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!item.artifactId) {
    return NextResponse.json({ error: 'No file attached' }, { status: 404 })
  }

  // 3. Fetch artifact URL
  const [artifact] = await db
    .select({ url: evidenceArtifacts.url })
    .from(evidenceArtifacts)
    .where(eq(evidenceArtifacts.id, item.artifactId))
    .limit(1)

  if (!artifact?.url) {
    return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
  }

  // 4. Derive R2 key by stripping R2_PUBLIC_URL prefix (Pitfall 2 — no r2_key column)
  const prefix = `${R2_PUBLIC_URL}/`
  if (!artifact.url.startsWith(prefix)) {
    // Defensive: unexpected URL format (e.g. migrated/legacy artifact).
    // Fail closed rather than generate an invalid presigned URL.
    return NextResponse.json({ error: 'Artifact URL format unsupported' }, { status: 404 })
  }
  const r2Key = artifact.url.slice(prefix.length)

  // 5. Generate 24h presigned GET
  const presignedUrl = await getDownloadUrl(r2Key, DOWNLOAD_TTL_SECONDS)

  // 6. 302 redirect — browser follows natively, triggers file download
  return NextResponse.redirect(presignedUrl, 302)
}
