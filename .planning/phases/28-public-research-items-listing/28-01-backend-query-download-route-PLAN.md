---
phase: 28-public-research-items-listing
plan: 01
type: execute
wave: 1
depends_on:
  - 28-00
files_modified:
  - src/server/queries/research-public.ts
  - app/api/research/[id]/download/route.ts
autonomous: true
requirements:
  - RESEARCH-09
  - RESEARCH-10
must_haves:
  truths:
    - "src/server/queries/research-public.ts exports listPublishedResearchItems({ documentId, itemType, from, to, sort, offset }): { items, total } — RESEARCH-09"
    - "src/server/queries/research-public.ts exports getPublishedResearchItem(id): PublicResearchItem | null — RESEARCH-10"
    - "Both helpers enforce status='published' at the query level (Pitfall 1)"
    - "Both helpers project OUT createdBy, reviewedBy, contentHash, txHash, anchoredAt, milestoneId — public leak prevention (Pitfall 6)"
    - "listPublishedResearchItems applies Pitfall-5 anonymous filter: rows.map(r => r.isAuthorAnonymous ? { ...r, authors: null } : r)"
    - "Query result uses unstable_cache with 60s revalidate (matches workshops-public.ts Phase 20 convention)"
    - "app/api/research/[id]/download/route.ts exports GET that returns 302 redirect to presigned URL for valid published file-backed item"
    - "Download route returns 429 with Retry-After header on rate-limit exhaustion"
    - "Download route returns 404 when item.status != 'published' OR item.artifactId is null OR evidence_artifacts.url is null"
    - "R2 key derived from artifact.url by stripping process.env.R2_PUBLIC_URL + '/' (Pitfall 2)"
    - "getDownloadUrl called with expiresIn=86400 (24h TTL) — RESEARCH-10 SC-4"
  artifacts:
    - path: "src/server/queries/research-public.ts"
      provides: "listPublishedResearchItems + getPublishedResearchItem + listLinkedSectionsForResearchItem + listLinkedVersionsForResearchItem"
      contains: "export async function listPublishedResearchItems"
    - path: "app/api/research/[id]/download/route.ts"
      provides: "Public presigned download Route Handler with rate-limit + leak guard"
      contains: "export async function GET"
  key_links:
    - from: "app/research/items/page.tsx (Plan 28-02)"
      to: "listPublishedResearchItems"
      via: "direct import"
      pattern: "from '@/src/server/queries/research-public'"
    - from: "app/research/items/[id]/page.tsx (Plan 28-03)"
      to: "getPublishedResearchItem + listLinkedSectionsForResearchItem + listLinkedVersionsForResearchItem"
      via: "direct import"
      pattern: "from '@/src/server/queries/research-public'"
    - from: "download-button.tsx (Plan 28-03)"
      to: "/api/research/{id}/download"
      via: "window.location.href navigation"
      pattern: "window.location.href"
---

<objective>
Wave 1 backend. Build the two seams the public UI plans depend on: a direct-Drizzle query helper for listing + detail reads (bypasses tRPC's protectedProcedure), and a Route Handler for presigned R2 GET downloads with rate-limiting + leak guards.

Purpose: Phase 26 chose `protectedProcedure` for `listPublic`/`getById` (STATE.md Phase 26 line: "Phase 28 will expose truly public routes via direct server-component DB queries, matching the existing /portal pattern"). This plan materializes that bypass. The download route is net-new capability (no equivalent exists in prior phases). RESEARCH.md §Pitfall 1 (tRPC auth gate) and §Pitfall 2 (no r2_key column — derive key from url) are the two load-bearing constraints.

Output: One server query module + one Route Handler, both green against Wave 0 tests.
</objective>

<execution_context>
@D:/aditee/policydash/.claude/get-shit-done/workflows/execute-plan.md
@D:/aditee/policydash/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/28-public-research-items-listing/28-CONTEXT.md
@.planning/phases/28-public-research-items-listing/28-RESEARCH.md
@.planning/phases/28-public-research-items-listing/28-VALIDATION.md
@AGENTS.md
@src/server/queries/workshops-public.ts
@src/server/routers/research.ts
@src/db/schema/research.ts
@src/db/schema/evidence.ts
@src/db/schema/documents.ts
@src/db/schema/changeRequests.ts
@src/lib/r2.ts
@src/lib/rate-limit.ts
@tests/phase-28/research-public-query.test.ts
@tests/phase-28/download-route.test.ts
@tests/phase-28/no-leak.test.ts

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. -->

From src/server/queries/workshops-public.ts (canonical pattern — mirror exactly):
```typescript
import { unstable_cache } from 'next/cache'
import { db } from '@/src/db'
// ... pattern: unstable_cache(async () => { ... }, [cacheKey, JSON.stringify(opts)], { revalidate: 60 })
```

From src/lib/r2.ts:
```typescript
export const R2_PUBLIC_URL: string = requireEnv('R2_PUBLIC_URL')
export async function getDownloadUrl(key: string, expiresIn = 3600): Promise<string>
// Signed GET URL — used verbatim for 24h (expiresIn=86400)
```

From src/lib/rate-limit.ts:
```typescript
export interface RateLimitResult { ok: boolean; remaining: number; resetAt: number }
export function consume(key: string, opts: { max: number; windowMs: number }): RateLimitResult
export function getClientIp(req: Request): string
// Used on upload route with 20/60s per-user — download uses 10/60s per-IP (RESEARCH.md §Rate Limit Parameters)
```

From src/db/schema/research.ts — public-safe projection column list (STRIP createdBy, reviewedBy, contentHash, txHash, anchoredAt, milestoneId):
```typescript
// INCLUDE: id, readableId, documentId, title, itemType, status,
//          description, externalUrl, artifactId, doi, authors, publishedDate,
//          peerReviewed, journalOrSource, versionLabel, previousVersionId,
//          isAuthorAnonymous, retractionReason, createdAt, updatedAt
// EXCLUDE: createdBy, reviewedBy, contentHash, txHash, anchoredAt, milestoneId, reviewedAt
```

From src/db/schema/evidence.ts:
```typescript
evidenceArtifacts columns: id, title, type, url (text NOT NULL), fileName, fileSize, uploaderId, createdAt, content, milestoneId
// NO r2_key — derive key by stripping R2_PUBLIC_URL prefix from url
```

From src/db/schema/documents.ts + src/db/schema/changeRequests.ts:
```typescript
policyDocuments: { id, title, ... }
policySections:  { id, title, documentId, ... }
documentVersions: { id, documentId, versionLabel, isPublished, publishedAt, ... }
```

Wave 0 tests this plan must turn GREEN (from tests/phase-28/research-public-query.test.ts, download-route.test.ts, no-leak.test.ts):
- listPublishedResearchItems contract (9 assertions)
- getPublishedResearchItem contract (3 assertions)
- GET /api/research/[id]/download contract (9 assertions)
- no-leak listing query result contract (1 assertion — key-set check)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create src/server/queries/research-public.ts with 4 exported helpers</name>
  <files>src/server/queries/research-public.ts</files>
  <behavior>
    - `listPublishedResearchItems({ documentId, itemType, from, to, sort, offset })` returns `{ items: PublicResearchItem[]; total: number }`.
    - Enforces `eq(researchItems.status, 'published')` unconditionally.
    - Applies filters conditionally: documentId (eq), itemType (eq), from (gte publishedDate), to (lte publishedDate).
    - sort='newest' → `desc(publishedDate), desc(createdAt)`. sort='oldest' → `asc(publishedDate), asc(createdAt)`.
    - Limits to PAGE_SIZE=40. Applies offset.
    - Projects out createdBy, reviewedBy, contentHash, txHash, anchoredAt, milestoneId, reviewedAt.
    - Applies Pitfall-5 anonymous filter post-query: `rows.map(r => r.isAuthorAnonymous ? { ...r, authors: null } : r)`.
    - Uses `unstable_cache` with key `['research-items-public', JSON.stringify(opts)]` and `{ revalidate: 60 }`.
    - `total` query mirrors the conditions and returns COUNT (not LIMIT/OFFSET) — computed in the same cached function.
    - `getPublishedResearchItem(id)` returns `PublicResearchItem | null`; enforces status='published'; same column projection.
    - `listLinkedSectionsForResearchItem(researchItemId)` returns array with { sectionId, sectionTitle, documentId, documentTitle, relevanceNote }. Inner-joins policySections + policyDocuments. NEVER joins researchItemFeedbackLinks (Pitfall 6).
    - `listLinkedVersionsForResearchItem(researchItemId)` returns array with { versionId, versionLabel, documentId, documentTitle, publishedAt }. Filters `documentVersions.isPublished=true` (OQ2 resolution: drop dead deep-links).
  </behavior>
  <read_first>
    - D:/aditee/policydash/src/server/queries/workshops-public.ts (canonical unstable_cache + direct-Drizzle pattern; copy the style verbatim)
    - D:/aditee/policydash/src/server/routers/research.ts lines 199-307 (existing listPublic + getById — reference for column selection + anonymous filter)
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-RESEARCH.md Pattern 2 "research-public.ts Helper" and §Link Tables Access Pattern
    - D:/aditee/policydash/src/db/schema/research.ts (full column list to project out)
    - D:/aditee/policydash/src/db/schema/documents.ts (policyDocuments + policySections)
    - D:/aditee/policydash/src/db/schema/changeRequests.ts (documentVersions, versionLabel, isPublished)
    - D:/aditee/policydash/tests/phase-28/research-public-query.test.ts (Wave 0 contract — convert it.todo to real asserts in Task 3 below)
  </read_first>
  <action>
Create `src/server/queries/research-public.ts` mirroring `src/server/queries/workshops-public.ts` exactly. Authoritative implementation:

```typescript
/**
 * Phase 28 Plan 28-01 — public /research/items query helper (RESEARCH-09 + RESEARCH-10).
 *
 * NOT a tRPC procedure: the public listing + detail are server-rendered and
 * bypass tRPC entirely because listPublic/getById in src/server/routers/research.ts
 * are protectedProcedure (STATE.md Phase 26 Plan 26-05 line: "Phase 28 will expose
 * truly public routes via direct server-component DB queries, matching the existing
 * /portal pattern"). This helper is the documented bypass.
 *
 * Caching (28-RESEARCH.md Pattern 2):
 *   - unstable_cache is deprecated but still functional in Next.js 16. The
 *     alternative, 'use cache', requires cacheComponents: true in next.config.ts
 *     which this project does NOT enable. workshops-public.ts uses the same
 *     pattern since Phase 20.
 *   - revalidate: 60s keeps listing/detail fresh without hammering the DB on
 *     every request. Cache keyed on JSON.stringify(opts) so every filter combo
 *     gets its own bucket.
 *
 * Leak prevention (28-RESEARCH.md Pitfall 6):
 *   - Column projection EXCLUDES createdBy, reviewedBy, contentHash, txHash,
 *     anchoredAt, milestoneId, reviewedAt. These fields exist in the DB but
 *     never appear in the public surface.
 *   - Pitfall 5 anonymous-author filter: rows.map(r => r.isAuthorAnonymous
 *     ? { ...r, authors: null } : r). Applied at the query boundary so no
 *     caller can accidentally leak the authors array on a flagged item.
 *   - Feedback link table is NEVER joined here (Pitfall 6). Sections + versions
 *     only.
 */
import { unstable_cache } from 'next/cache'
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/src/db'
import {
  researchItems,
  researchItemSectionLinks,
  researchItemVersionLinks,
} from '@/src/db/schema/research'
import { policyDocuments, policySections } from '@/src/db/schema/documents'
import { documentVersions } from '@/src/db/schema/changeRequests'

export const PAGE_SIZE = 40

export type ResearchItemType =
  | 'report' | 'paper' | 'dataset' | 'memo'
  | 'interview_transcript' | 'media_coverage'
  | 'legal_reference' | 'case_study'

export type SortDirection = 'newest' | 'oldest'

export interface PublicResearchItem {
  id: string
  readableId: string
  documentId: string
  title: string
  itemType: ResearchItemType
  description: string | null
  externalUrl: string | null
  artifactId: string | null
  doi: string | null
  authors: string[] | null
  publishedDate: string | null
  peerReviewed: boolean
  journalOrSource: string | null
  versionLabel: string | null
  previousVersionId: string | null
  isAuthorAnonymous: boolean
  retractionReason: string | null
  // NOTE: createdBy, reviewedBy, reviewedAt, contentHash, txHash, anchoredAt,
  //       milestoneId, status — all intentionally EXCLUDED from this type.
}

export interface ListPublishedOpts {
  documentId?: string
  itemType?: ResearchItemType
  from?: string          // ISO YYYY-MM-DD
  to?: string            // ISO YYYY-MM-DD
  sort: SortDirection
  offset: number
}

const PUBLIC_COLUMNS = {
  id:                researchItems.id,
  readableId:        researchItems.readableId,
  documentId:        researchItems.documentId,
  title:             researchItems.title,
  itemType:          researchItems.itemType,
  description:       researchItems.description,
  externalUrl:       researchItems.externalUrl,
  artifactId:        researchItems.artifactId,
  doi:               researchItems.doi,
  authors:           researchItems.authors,
  publishedDate:     researchItems.publishedDate,
  peerReviewed:      researchItems.peerReviewed,
  journalOrSource:   researchItems.journalOrSource,
  versionLabel:      researchItems.versionLabel,
  previousVersionId: researchItems.previousVersionId,
  isAuthorAnonymous: researchItems.isAuthorAnonymous,
  retractionReason:  researchItems.retractionReason,
} as const

/**
 * RESEARCH-09: list published research items with filters + sort + offset pagination.
 */
export async function listPublishedResearchItems(
  opts: ListPublishedOpts,
): Promise<{ items: PublicResearchItem[]; total: number }> {
  const cacheKey = ['research-items-public', 'list', JSON.stringify(opts)]
  const fn = unstable_cache(
    async () => {
      const conditions = [eq(researchItems.status, 'published')]
      if (opts.documentId) conditions.push(eq(researchItems.documentId, opts.documentId))
      if (opts.itemType)   conditions.push(eq(researchItems.itemType, opts.itemType))
      if (opts.from)       conditions.push(gte(researchItems.publishedDate, opts.from))
      if (opts.to)         conditions.push(lte(researchItems.publishedDate, opts.to))

      // Total count — same conditions, no limit/offset
      const [countRow] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(researchItems)
        .where(and(...conditions))
      const total = Number(countRow?.n ?? 0)

      // Sort direction (Pattern 2)
      const orderClauses = opts.sort === 'oldest'
        ? [asc(researchItems.publishedDate), asc(researchItems.createdAt)]
        : [desc(researchItems.publishedDate), desc(researchItems.createdAt)]

      const rows = await db
        .select(PUBLIC_COLUMNS)
        .from(researchItems)
        .where(and(...conditions))
        .orderBy(...orderClauses)
        .limit(PAGE_SIZE)
        .offset(Math.max(0, opts.offset))

      // Pitfall 5: anonymous filter at query boundary
      const items: PublicResearchItem[] = rows.map((r) =>
        r.isAuthorAnonymous ? { ...r, authors: null } : r,
      )

      return { items, total }
    },
    cacheKey,
    { revalidate: 60 },
  )
  return fn()
}

/**
 * RESEARCH-10: fetch a single published research item by id. Returns null
 * when status != 'published' (NEVER leak draft/pending_review/retracted to public).
 */
export async function getPublishedResearchItem(id: string): Promise<PublicResearchItem | null> {
  const cacheKey = ['research-items-public', 'detail', id]
  const fn = unstable_cache(
    async () => {
      const [row] = await db
        .select(PUBLIC_COLUMNS)
        .from(researchItems)
        .where(and(eq(researchItems.id, id), eq(researchItems.status, 'published')))
        .limit(1)
      if (!row) return null
      return row.isAuthorAnonymous ? { ...row, authors: null } : row
    },
    cacheKey,
    { revalidate: 60 },
  )
  return fn()
}

/**
 * RESEARCH-10: linked sections for the detail page. Inner-joins policySections
 * + policyDocuments so the caller has documentId + documentTitle for the
 * /framework/{docId}#section-{sectionId} deep-link. Never joins the feedback
 * link table (Pitfall 6).
 */
export async function listLinkedSectionsForResearchItem(researchItemId: string) {
  return db
    .select({
      sectionId:     researchItemSectionLinks.sectionId,
      sectionTitle:  policySections.title,
      documentId:    policySections.documentId,
      documentTitle: policyDocuments.title,
      relevanceNote: researchItemSectionLinks.relevanceNote,
    })
    .from(researchItemSectionLinks)
    .innerJoin(policySections, eq(researchItemSectionLinks.sectionId, policySections.id))
    .innerJoin(policyDocuments, eq(policySections.documentId, policyDocuments.id))
    .where(eq(researchItemSectionLinks.researchItemId, researchItemId))
}

/**
 * RESEARCH-10: linked versions for the detail page. Filters isPublished=true
 * to avoid dead /portal/{docId}?v=<label> deep-links (OQ2 resolution).
 */
export async function listLinkedVersionsForResearchItem(researchItemId: string) {
  return db
    .select({
      versionId:     researchItemVersionLinks.versionId,
      versionLabel:  documentVersions.versionLabel,
      documentId:    documentVersions.documentId,
      documentTitle: policyDocuments.title,
      publishedAt:   documentVersions.publishedAt,
    })
    .from(researchItemVersionLinks)
    .innerJoin(documentVersions, eq(researchItemVersionLinks.versionId, documentVersions.id))
    .innerJoin(policyDocuments, eq(documentVersions.documentId, policyDocuments.id))
    .where(and(
      eq(researchItemVersionLinks.researchItemId, researchItemId),
      eq(documentVersions.isPublished, true),
    ))
}
```

After writing: run `npx tsc --noEmit` to catch any type errors (most likely: import paths, column-type unions, `sql<number>` count cast). Fix any TS2xxx in this file only — do NOT touch other files.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep "src/server/queries/research-public.ts" | wc -l</automated>
  </verify>
  <acceptance_criteria>
    - File `src/server/queries/research-public.ts` exists
    - `grep "export async function listPublishedResearchItems" src/server/queries/research-public.ts` returns a match
    - `grep "export async function getPublishedResearchItem" src/server/queries/research-public.ts` returns a match
    - `grep "export async function listLinkedSectionsForResearchItem" src/server/queries/research-public.ts` returns a match
    - `grep "export async function listLinkedVersionsForResearchItem" src/server/queries/research-public.ts` returns a match
    - `grep "eq(researchItems.status, 'published')" src/server/queries/research-public.ts` returns ≥ 2 matches (listing + detail)
    - `grep "unstable_cache" src/server/queries/research-public.ts` returns ≥ 2 matches
    - `grep "revalidate: 60" src/server/queries/research-public.ts` returns ≥ 2 matches
    - `grep "isAuthorAnonymous ? { ...r" src/server/queries/research-public.ts` OR `grep "isAuthorAnonymous ? { ...row" src/server/queries/research-public.ts` returns ≥ 1 match (Pitfall 5)
    - `grep "createdBy\\|reviewedBy\\|contentHash\\|txHash" src/server/queries/research-public.ts` returns 0 matches (leak prevention — these columns must NOT appear in the file)
    - `grep "documentVersions.isPublished" src/server/queries/research-public.ts` returns a match (OQ2: filter dead version links)
    - `grep "researchItemFeedbackLinks" src/server/queries/research-public.ts` returns 0 matches (Pitfall 6 — feedback link table never joined on public surface)
    - `npx tsc --noEmit 2>&1 | grep "src/server/queries/research-public.ts"` returns 0 lines (TypeScript clean)
  </acceptance_criteria>
  <done>
    Query module compiles, exports 4 helpers, status='published' guard is unconditional, Pitfall 5 anonymous filter applied, leak prevention verified by grep-absence of excluded columns.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create app/api/research/[id]/download/route.ts presigned download Route Handler</name>
  <files>app/api/research/[id]/download/route.ts</files>
  <behavior>
    - Exports `GET(request, { params })` where `params: Promise<{ id: string }>` (Next.js 16 pattern — per AGENTS.md).
    - Awaits params to get `id`.
    - Calls `consume(`research-download:ip:${ip}`, { max: 10, windowMs: 60_000 })` — per-IP rate limit matching RESEARCH.md §Rate Limit Parameters.
    - On rate-limit exhausted: returns 429 with JSON `{ error: "Too many download requests..." }` and `Retry-After: {seconds}` header.
    - Queries `researchItems` for `id, status, artifactId` (DO NOT select createdBy/reviewedBy/etc).
    - Returns 404 when no row, status != 'published', OR artifactId is null.
    - Queries `evidenceArtifacts.url` by artifactId.
    - Returns 404 when no artifact row OR url is null/empty.
    - Derives R2 key: `artifact.url.replace(process.env.R2_PUBLIC_URL + '/', '')` — Pitfall 2.
    - Calls `getDownloadUrl(key, 86400)` — 24h TTL.
    - Returns `NextResponse.redirect(presignedUrl, 302)`.
  </behavior>
  <read_first>
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-RESEARCH.md Pattern 4 "Download Route Handler" — has the full reference implementation
    - D:/aditee/policydash/src/lib/r2.ts lines 25, 70-76 (R2_PUBLIC_URL export + getDownloadUrl signature)
    - D:/aditee/policydash/src/lib/rate-limit.ts (consume + getClientIp APIs)
    - D:/aditee/policydash/src/db/schema/research.ts lines 29-70 (researchItems columns)
    - D:/aditee/policydash/src/db/schema/evidence.ts lines 8-19 (evidenceArtifacts columns)
    - D:/aditee/policydash/app/api/upload/route.ts (if exists — for pattern parity; look at how upload handler uses consume + getClientIp)
    - D:/aditee/policydash/tests/phase-28/download-route.test.ts (Wave 0 contract)
    - D:/aditee/policydash/node_modules/next/dist/docs/01-app/01-getting-started/ (AGENTS.md mandates reading Next.js docs — focus on Route Handlers guide for the `params: Promise<{...}>` pattern)
  </read_first>
  <action>
Create directory `app/api/research/[id]/download/` if absent, then write `route.ts`. Authoritative implementation:

```typescript
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
 * include createdBy, reviewedBy, or any audit-trail columns. Only id, status,
 * and artifactId are read — no other surface exposure possible.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
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
```

Create any missing parent directories first (the `[id]` segment bracket must be a real literal directory name — on Windows + bash this works since `[`/`]` are allowed in filenames). Verify with `ls` that the directory structure is `app/api/research/[id]/download/route.ts`.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | grep "app/api/research/\[id\]/download/route.ts" | wc -l</automated>
  </verify>
  <acceptance_criteria>
    - Directory `app/api/research/[id]/download/` exists
    - File `app/api/research/[id]/download/route.ts` exists
    - `grep "export async function GET" app/api/research/[id]/download/route.ts` returns a match
    - `grep "params: Promise<{ id: string }>" app/api/research/[id]/download/route.ts` returns a match (Next.js 16 async params pattern)
    - `grep "consume(\`research-download:ip:" app/api/research/[id]/download/route.ts` returns a match
    - `grep "max: 10, windowMs: 60" app/api/research/[id]/download/route.ts` returns a match
    - `grep "status !== 'published'" app/api/research/[id]/download/route.ts` returns a match
    - `grep "86" app/api/research/[id]/download/route.ts` returns a match with "86_400" OR "86400" (24h TTL)
    - `grep "R2_PUBLIC_URL" app/api/research/[id]/download/route.ts` returns ≥ 2 matches (import + prefix derivation)
    - `grep "NextResponse.redirect(presignedUrl, 302)" app/api/research/[id]/download/route.ts` returns a match
    - `grep "Retry-After" app/api/research/[id]/download/route.ts` returns a match
    - `grep "createdBy\\|reviewedBy\\|contentHash\\|txHash" app/api/research/[id]/download/route.ts` returns 0 matches (no leak columns)
    - `npx tsc --noEmit 2>&1 | grep "app/api/research/\[id\]/download/route.ts"` returns 0 lines
  </acceptance_criteria>
  <done>
    Route Handler compiles. Downloads a file with status check + rate limit + 24h TTL + 302 response. No leak columns selected.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Convert Wave 0 query + route tests from it.todo to GREEN assertions</name>
  <files>tests/phase-28/research-public-query.test.ts, tests/phase-28/download-route.test.ts, tests/phase-28/no-leak.test.ts</files>
  <behavior>
    - Replace every `it.todo(...)` in research-public-query.test.ts, download-route.test.ts, and no-leak.test.ts with real `it(...)` assertions that verify the exact behaviors from Tasks 1–2.
    - no-leak.test.ts listing-query assertion (keys check): assert Object.keys of a returned item does NOT include createdBy/reviewedBy/contentHash/txHash/anchoredAt/milestoneId/reviewedAt.
    - no-leak.test.ts detail/listing page assertions: keep as it.todo (those pages don't exist yet — Plans 28-02/28-03 convert).
    - All new it() tests pass (exit 0).
  </behavior>
  <read_first>
    - D:/aditee/policydash/tests/phase-28/research-public-query.test.ts (current it.todo stubs)
    - D:/aditee/policydash/tests/phase-28/download-route.test.ts
    - D:/aditee/policydash/tests/phase-28/no-leak.test.ts
    - D:/aditee/policydash/src/server/queries/research-public.ts (just created in Task 1)
    - D:/aditee/policydash/app/api/research/[id]/download/route.ts (just created in Task 2)
    - D:/aditee/policydash/src/__tests__/research-router.test.ts (canonical pattern for chainable db.select mock — adapt here)
  </read_first>
  <action>
Rewrite three test files to replace it.todo with real assertions. Authoritative content below — match shape, adapt mock chain data as needed.

**tests/phase-28/research-public-query.test.ts** — GREEN after Task 1 landed:

Structure: Build a chainable mock for `db.select().from().where().orderBy().limit().offset()` that resolves with a fixture rows array. Also mock count query (first .select returns count row, second returns data rows — alternate via vi.fn().mockResolvedValueOnce).

Pattern (executor implements tests that satisfy these asserts):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listPublishedResearchItems, getPublishedResearchItem, PAGE_SIZE } from '@/src/server/queries/research-public'

vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: any[]) => unknown) => fn,  // passthrough — no caching in tests
}))

// Chainable db mock. Per-call resolution controlled by vi.fn stacks below.
const selectChain = {
  from:    vi.fn().mockReturnThis(),
  where:   vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit:   vi.fn().mockReturnThis(),
  offset:  vi.fn().mockResolvedValue([]),
  innerJoin: vi.fn().mockReturnThis(),
}
const mockSelect = vi.fn(() => selectChain)

vi.mock('@/src/db', () => ({
  db: { select: (...args: any[]) => mockSelect(...args) },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockSelect.mockImplementation(() => selectChain)
})

describe('listPublishedResearchItems — RESEARCH-09 filter contract', () => {
  it('returns { items, total } object shape', async () => {
    // count returns [{ n: 0 }], data returns []
    selectChain.offset = vi.fn().mockResolvedValue([])
    // count query returns from .where() directly (no limit/offset chain)
    // Implementation detail: first select is for count, second for data.
    // Mock behavior: .where() on count chain resolves to [{ n: 0 }].
    const countChain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ n: 0 }]) }
    mockSelect.mockImplementationOnce(() => countChain as any).mockImplementation(() => selectChain)

    const result = await listPublishedResearchItems({ sort: 'newest', offset: 0 })
    expect(result).toHaveProperty('items')
    expect(result).toHaveProperty('total')
    expect(Array.isArray(result.items)).toBe(true)
    expect(typeof result.total).toBe('number')
  })

  it('applies status="published" filter always (Pitfall 1)', async () => {
    const countChain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ n: 0 }]) }
    mockSelect.mockImplementationOnce(() => countChain as any).mockImplementation(() => selectChain)
    selectChain.offset = vi.fn().mockResolvedValue([])
    await listPublishedResearchItems({ sort: 'newest', offset: 0 })
    // The .where() call receives an and(...) expression. Assert where was called on both chains.
    expect(countChain.where).toHaveBeenCalled()
  })

  it('nulls out authors when isAuthorAnonymous=true (Pitfall 5)', async () => {
    const countChain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ n: 1 }]) }
    const fixture = {
      id: 'r1', readableId: 'RI-001', documentId: 'd1', title: 'Anon Study',
      itemType: 'report', description: null, externalUrl: null, artifactId: null,
      doi: null, authors: ['Jane Doe', 'Alex Smith'], publishedDate: '2026-01-15',
      peerReviewed: false, journalOrSource: null, versionLabel: null,
      previousVersionId: null, isAuthorAnonymous: true, retractionReason: null,
    }
    mockSelect.mockImplementationOnce(() => countChain as any)
    selectChain.offset = vi.fn().mockResolvedValue([fixture])
    const result = await listPublishedResearchItems({ sort: 'newest', offset: 0 })
    expect(result.items[0].authors).toBeNull()
  })

  it('preserves authors when isAuthorAnonymous=false', async () => {
    // symmetric test with isAuthorAnonymous: false → authors array preserved
    const countChain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ n: 1 }]) }
    const fixture = {
      id: 'r2', readableId: 'RI-002', documentId: 'd1', title: 'Named',
      itemType: 'paper', description: null, externalUrl: null, artifactId: null,
      doi: null, authors: ['Jane Doe'], publishedDate: '2026-02-01',
      peerReviewed: true, journalOrSource: null, versionLabel: null,
      previousVersionId: null, isAuthorAnonymous: false, retractionReason: null,
    }
    mockSelect.mockImplementationOnce(() => countChain as any)
    selectChain.offset = vi.fn().mockResolvedValue([fixture])
    const result = await listPublishedResearchItems({ sort: 'newest', offset: 0 })
    expect(result.items[0].authors).toEqual(['Jane Doe'])
  })

  it('limits to PAGE_SIZE (40) per page', async () => {
    expect(PAGE_SIZE).toBe(40)
    const countChain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ n: 100 }]) }
    mockSelect.mockImplementationOnce(() => countChain as any)
    selectChain.offset = vi.fn().mockResolvedValue([])
    await listPublishedResearchItems({ sort: 'newest', offset: 0 })
    expect(selectChain.limit).toHaveBeenCalledWith(40)
  })

  it('applies offset correctly', async () => {
    const countChain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ n: 100 }]) }
    mockSelect.mockImplementationOnce(() => countChain as any)
    selectChain.offset = vi.fn().mockResolvedValue([])
    await listPublishedResearchItems({ sort: 'newest', offset: 40 })
    expect(selectChain.offset).toHaveBeenCalledWith(40)
  })

  it('clamps negative offset to 0', async () => {
    const countChain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ n: 0 }]) }
    mockSelect.mockImplementationOnce(() => countChain as any)
    selectChain.offset = vi.fn().mockResolvedValue([])
    await listPublishedResearchItems({ sort: 'newest', offset: -5 })
    expect(selectChain.offset).toHaveBeenCalledWith(0)
  })
})

describe('getPublishedResearchItem — RESEARCH-10', () => {
  it('returns null when no row found', async () => {
    const chain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }
    mockSelect.mockImplementation(() => chain as any)
    const row = await getPublishedResearchItem('00000000-0000-0000-0000-000000000000')
    expect(row).toBeNull()
  })

  it('returns public-safe projection (no createdBy/reviewedBy/contentHash/txHash keys)', async () => {
    const fixture = {
      id: 'r1', readableId: 'RI-001', documentId: 'd1', title: 'T',
      itemType: 'report', description: null, externalUrl: null, artifactId: null,
      doi: null, authors: null, publishedDate: '2026-01-01',
      peerReviewed: false, journalOrSource: null, versionLabel: null,
      previousVersionId: null, isAuthorAnonymous: false, retractionReason: null,
    }
    const chain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([fixture]) }
    mockSelect.mockImplementation(() => chain as any)
    const row = await getPublishedResearchItem('r1')
    expect(row).not.toBeNull()
    const keys = Object.keys(row!)
    expect(keys).not.toContain('createdBy')
    expect(keys).not.toContain('reviewedBy')
    expect(keys).not.toContain('contentHash')
    expect(keys).not.toContain('txHash')
    expect(keys).not.toContain('anchoredAt')
    expect(keys).not.toContain('milestoneId')
  })

  it('nulls out authors on anonymous published item', async () => {
    const fixture = {
      id: 'r1', readableId: 'RI-001', documentId: 'd1', title: 'T',
      itemType: 'report', description: null, externalUrl: null, artifactId: null,
      doi: null, authors: ['Jane'], publishedDate: '2026-01-01',
      peerReviewed: false, journalOrSource: null, versionLabel: null,
      previousVersionId: null, isAuthorAnonymous: true, retractionReason: null,
    }
    const chain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([fixture]) }
    mockSelect.mockImplementation(() => chain as any)
    const row = await getPublishedResearchItem('r1')
    expect(row?.authors).toBeNull()
  })
})
```

**tests/phase-28/download-route.test.ts** — GREEN after Task 2 landed. Convert 9 stubs to real asserts using the same chainable db mock + mocked getDownloadUrl + consume:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetDownloadUrl = vi.fn(async (key: string, ttl: number) => `https://r2-presigned.example/${key}?ttl=${ttl}`)
const mockConsume = vi.fn(() => ({ ok: true, remaining: 9, resetAt: Date.now() + 60000 }))
const mockGetClientIp = vi.fn(() => '1.2.3.4')

vi.mock('@/src/lib/r2', () => ({
  R2_PUBLIC_URL: 'https://pub-xxx.r2.dev',
  getDownloadUrl: (...args: any[]) => mockGetDownloadUrl(...(args as [string, number])),
}))

vi.mock('@/src/lib/rate-limit', () => ({
  consume: (...args: any[]) => mockConsume(...(args as [string, any])),
  getClientIp: (...args: any[]) => mockGetClientIp(...(args as [Request])),
}))

const mockSelect = vi.fn()
vi.mock('@/src/db', () => ({
  db: { select: (...args: any[]) => mockSelect(...args) },
}))

import { GET } from '@/app/api/research/[id]/download/route'

function mockRequest(): any {
  return { headers: new Headers({ 'x-forwarded-for': '1.2.3.4' }) }
}

function mockParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function mockResearchRow(overrides: Partial<{ status: string; artifactId: string | null }> = {}) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([{
      id: 'r1', status: 'published', artifactId: 'a1', ...overrides,
    }]),
  }
  return chain
}

function mockArtifactRow(url: string | null) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(url ? [{ url }] : []),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  mockConsume.mockReturnValue({ ok: true, remaining: 9, resetAt: Date.now() + 60000 })
})

describe('GET /api/research/[id]/download — RESEARCH-10', () => {
  it('returns 302 redirect to presigned URL for published file-backed item', async () => {
    mockSelect
      .mockImplementationOnce(() => mockResearchRow())
      .mockImplementationOnce(() => mockArtifactRow('https://pub-xxx.r2.dev/research/file.pdf'))
    const res = await GET(mockRequest(), mockParams('r1'))
    expect(res.status).toBe(302)
    const location = res.headers.get('location')
    expect(location).toMatch(/r2-presigned\.example\/research\/file\.pdf\?ttl=86400/)
  })

  it('passes expiresIn=86400 (24h) to getDownloadUrl', async () => {
    mockSelect
      .mockImplementationOnce(() => mockResearchRow())
      .mockImplementationOnce(() => mockArtifactRow('https://pub-xxx.r2.dev/research/file.pdf'))
    await GET(mockRequest(), mockParams('r1'))
    expect(mockGetDownloadUrl).toHaveBeenCalledWith('research/file.pdf', 86400)
  })

  it('returns 404 when item.status != "published"', async () => {
    mockSelect.mockImplementationOnce(() => mockResearchRow({ status: 'draft' }))
    const res = await GET(mockRequest(), mockParams('r1'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when item.artifactId is null (URL-only item)', async () => {
    mockSelect.mockImplementationOnce(() => mockResearchRow({ artifactId: null }))
    const res = await GET(mockRequest(), mockParams('r1'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when evidence_artifacts row has null/empty url', async () => {
    mockSelect
      .mockImplementationOnce(() => mockResearchRow())
      .mockImplementationOnce(() => mockArtifactRow(null))
    const res = await GET(mockRequest(), mockParams('r1'))
    expect(res.status).toBe(404)
  })

  it('returns 429 with Retry-After header when consume returns ok=false', async () => {
    mockConsume.mockReturnValue({ ok: false, remaining: 0, resetAt: Date.now() + 30000 })
    const res = await GET(mockRequest(), mockParams('r1'))
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBeTruthy()
  })

  it('uses namespaced rate-limit key: research-download:ip:{ip}', async () => {
    mockSelect
      .mockImplementationOnce(() => mockResearchRow())
      .mockImplementationOnce(() => mockArtifactRow('https://pub-xxx.r2.dev/x.pdf'))
    await GET(mockRequest(), mockParams('r1'))
    expect(mockConsume).toHaveBeenCalledWith(
      expect.stringMatching(/^research-download:ip:/),
      expect.objectContaining({ max: 10, windowMs: 60000 }),
    )
  })

  it('derives R2 key by stripping R2_PUBLIC_URL prefix', async () => {
    mockSelect
      .mockImplementationOnce(() => mockResearchRow())
      .mockImplementationOnce(() => mockArtifactRow('https://pub-xxx.r2.dev/folder/subdir/paper.pdf'))
    await GET(mockRequest(), mockParams('r1'))
    expect(mockGetDownloadUrl).toHaveBeenCalledWith('folder/subdir/paper.pdf', 86400)
  })

  it('returns 404 when artifact.url does not start with R2_PUBLIC_URL (defensive)', async () => {
    mockSelect
      .mockImplementationOnce(() => mockResearchRow())
      .mockImplementationOnce(() => mockArtifactRow('https://other-cdn.example/x.pdf'))
    const res = await GET(mockRequest(), mockParams('r1'))
    expect(res.status).toBe(404)
  })
})
```

**tests/phase-28/no-leak.test.ts** — convert the listing-query key-set assertion (the one backed by Task 1). Keep detail/listing-page/listing-html assertions as it.todo (those pages don't exist yet — Plans 28-02/28-03 flip):

```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('next/cache', () => ({ unstable_cache: (fn: any) => fn }))

const selectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockResolvedValue([
    {
      id: 'r1', readableId: 'RI-001', documentId: 'd1', title: 'X',
      itemType: 'report', description: null, externalUrl: null, artifactId: null,
      doi: null, authors: null, publishedDate: '2026-01-01',
      peerReviewed: false, journalOrSource: null, versionLabel: null,
      previousVersionId: null, isAuthorAnonymous: false, retractionReason: null,
    },
  ]),
}
const countChain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ n: 1 }]) }
const mockSelect = vi.fn()
vi.mock('@/src/db', () => ({ db: { select: (...a: any[]) => mockSelect(...a) } }))

import { listPublishedResearchItems } from '@/src/server/queries/research-public'

describe('public research detail — leak prevention RESEARCH-10', () => {
  it('listing query result objects do NOT expose createdBy/reviewedBy/contentHash/txHash/anchoredAt/milestoneId keys', async () => {
    mockSelect.mockImplementationOnce(() => countChain as any).mockImplementation(() => selectChain as any)
    const { items } = await listPublishedResearchItems({ sort: 'newest', offset: 0 })
    expect(items.length).toBe(1)
    const keys = Object.keys(items[0])
    expect(keys).not.toContain('createdBy')
    expect(keys).not.toContain('reviewedBy')
    expect(keys).not.toContain('contentHash')
    expect(keys).not.toContain('txHash')
    expect(keys).not.toContain('anchoredAt')
    expect(keys).not.toContain('milestoneId')
    expect(keys).not.toContain('reviewedAt')
  })

  // Page-level HTML leak checks: Plan 28-02/28-03 convert these when those pages exist.
  it.todo('detail-page HTML does NOT contain "createdBy" or "reviewedBy" strings')
  it.todo('detail-page HTML does NOT contain "FB-" readableId pattern even when linkedFeedback fixture exists')
  it.todo('detail-page HTML does NOT contain "contentHash", "txHash", "anchoredAt"')
  it.todo('detail-page HTML does NOT contain feedbackLinks / researchItemFeedbackLinks DB column names')
  it.todo('listing-page card HTML does NOT contain abstract, doi, linked sections count (CONTEXT.md Q9)')
})
```

Run `npx vitest run tests/phase-28/research-public-query.test.ts tests/phase-28/download-route.test.ts tests/phase-28/no-leak.test.ts` → all non-todo tests must pass.
  </action>
  <verify>
    <automated>npx vitest run tests/phase-28/research-public-query.test.ts tests/phase-28/download-route.test.ts tests/phase-28/no-leak.test.ts --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `npx vitest run tests/phase-28/research-public-query.test.ts` exits 0 with ≥ 11 passing tests (6 list + 5 get... adjust count to match the actual it() calls kept)
    - `npx vitest run tests/phase-28/download-route.test.ts` exits 0 with ≥ 9 passing tests
    - `npx vitest run tests/phase-28/no-leak.test.ts` exits 0 with 1 passing test and ≤ 5 it.todo stubs
    - `grep -c "it.todo" tests/phase-28/research-public-query.test.ts` returns 0 (all real asserts, none todo)
    - `grep -c "it.todo" tests/phase-28/download-route.test.ts` returns 0
    - `grep -c "it.todo" tests/phase-28/no-leak.test.ts` returns ≥ 1 and ≤ 5 (HTML-level leak tests deferred to Plans 28-02/28-03)
  </acceptance_criteria>
  <done>
    Wave 0 query + route tests are GREEN. Wave 0 no-leak query assertion is GREEN; HTML-level stubs remain it.todo for next waves.
  </done>
</task>

</tasks>

<verification>
Wave 1 backend verification:
- `src/server/queries/research-public.ts` compiles, exports 4 helpers, status='published' guard, anonymous filter, no leak columns.
- `app/api/research/[id]/download/route.ts` compiles, exports GET, 302/404/429 responses per contract.
- All query + route Wave 0 tests GREEN after Task 3 conversion.
- `npx vitest run tests/phase-28/research-public-query.test.ts tests/phase-28/download-route.test.ts tests/phase-28/no-leak.test.ts` exits 0.
- Proxy + research-cta + listing/detail Wave 0 tests still RED/todo — those turn GREEN in Plans 28-02/28-03/28-04.
</verification>

<success_criteria>
- listPublishedResearchItems + getPublishedResearchItem + listLinkedSectionsForResearchItem + listLinkedVersionsForResearchItem exist and compile.
- GET /api/research/[id]/download returns 302 for valid, 404 for status/artifact missing, 429 with Retry-After for rate-limit.
- All column projections strip createdBy/reviewedBy/contentHash/txHash/anchoredAt/milestoneId.
- Anonymous filter applied at query boundary (Pitfall 5).
- R2 key derivation works without r2_key column (Pitfall 2).
- Query/route tests GREEN; no-leak query assertion GREEN.
</success_criteria>

<output>
After completion, create `.planning/phases/28-public-research-items-listing/28-01-SUMMARY.md` covering: 2 files shipped, 4 exported helpers in query module, GET handler signature, Pitfall 2 key-derivation implementation, Wave 0 test count flipped to GREEN.
</output>
