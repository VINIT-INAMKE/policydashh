# Phase 28: Public `/research/items` Listing & Detail — Research

**Researched:** 2026-04-20
**Domain:** Next.js App Router public surfaces, tRPC (public bypass), R2 presigned GET, rate-limiting
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Q6: Document filter facet visible even with one policy (future-proofs for multi-policy)
- Q9: Listing cards do NOT show linked sections — detail page only
- Q7: Anonymous authors render as "Source: Confidential"
- Q10: DOI rendered as `https://doi.org/{doi}` hyperlink (plain DOI text)
- `proxy.ts` requires no new matchers — existing `/research(.*)` wildcard covers new routes
- Download route: `app/api/research/[id]/download/route.ts` (Route Handler, not tRPC)
- Download response: HTTP 302 redirect to presigned R2 GET URL (browser follows natively — no CORS concern)
- Rate limit: per-IP via `src/lib/rate-limit.ts` on the download route

### Claude's Discretion
- Cache strategy for listing page (60s `unstable_cache` per `/workshops` Phase 20 pattern confirmed)
- Exact `?offset=` pagination implementation detail
- Whether public listing query is a dedicated helper (like `workshops-public.ts`) or inline server component

### Deferred Ideas (OUT OF SCOPE)
- RSS/Atom feed (v0.3 if demand)
- Full-text search across research content (v0.3)
- Citation-export (BibTeX/APA)
- In-page file preview (download only)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RESEARCH-09 | Public listing at `/research/items` with document/type/date filters and ≥40 cards/page pagination | Direct DB query bypassing tRPC (portal pattern); `status = 'published'` enforced; `from/to/sort/document/type` searchParams applied server-side |
| RESEARCH-10 | Public detail page at `/research/items/[id]` with full metadata, presigned R2 download (24h TTL), linked sections + versions, no feedback IDs or stakeholder names visible | New `app/api/research/[id]/download/route.ts` + direct DB joins (no tRPC, no auth); Column projection pattern from `getById` — strip `createdBy`, `reviewedBy`, feedback link data |
</phase_requirements>

---

## Summary

Phase 28 builds the public-facing read surface for the research module. Two new pages (`/research/items` listing and `/research/items/[id]` detail) plus one route handler (`/api/research/[id]/download`) complete the public research discovery surface begun in Phase 26. A minor CTA addition to the existing `/research` static page rounds out scope.

The canonical reference pattern for this phase is the `/workshops` page (Phase 20). That page established: server component with `export const dynamic = 'force-dynamic'`; a sibling `src/server/queries/workshops-public.ts` helper using `unstable_cache` at the query level; direct Drizzle DB queries (no tRPC hop); the `PublicWorkshopCard` component pattern; and `type: Metadata` static exports for SEO. Phase 28 MUST mirror this structure exactly.

The critical new capability is the presigned R2 download route. The evidence artifact `url` column stores the public R2 URL at upload time (not the R2 key), so the download route must JOIN `researchItems → evidenceArtifacts` to get the artifact URL and then generate a presigned GET URL via `getDownloadUrl()` from `src/lib/r2.ts`. The route enforces `isPublished`, per-IP rate-limiting via `consume()` from `src/lib/rate-limit.ts`, and responds with HTTP 302 so the browser follows the redirect natively.

**Primary recommendation:** Build the listing and detail as direct Drizzle server components (no tRPC). Create a `src/server/queries/research-public.ts` helper mirroring the `workshops-public.ts` pattern. The download is the only interactive element and requires a new Route Handler.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | project-pinned | DB queries in server components | Used by all 27 prior phases |
| next | project-pinned | `unstable_cache`, `dynamic` export, `Metadata`, Route Handlers | AGENTS.md mandates reading docs; `cacheComponents: false` so `unstable_cache` is correct |
| @clerk/nextjs | project-pinned | `auth()` call in download route to detect optional logged-in state | Already in root layout |
| sonner | project-pinned | Toast on download error | Already in root layout as `<Toaster />` |
| lucide-react | project-pinned | Icons: Download, ExternalLink, ArrowLeft, Filter, FileText, FileSearch | components.json: `"iconLibrary": "lucide"` |
| date-fns | project-pinned | `format(date, 'MMM d, yyyy')` for published dates | Used in `public-policy-card.tsx` |

### Supporting (existing shadcn components, no new installs)

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `components/ui/card.tsx` | Research listing cards | Card + CardFooter pattern from `PublicPolicyCard` |
| `components/ui/badge.tsx` | Type label badge and type badges | Already used in `ResearchStatusBadge` |
| `components/ui/button.tsx` | Download/View Source CTAs, pagination, Browse CTA | All interactive elements |
| `components/ui/skeleton.tsx` | Loading states if any client islands | Exists, used in portal page |
| `components/ui/collapsible.tsx` | Mobile filter panel collapse | Already installed (Phase 21) |
| `components/ui/checkbox.tsx` | Type filter checkboxes | Used in `ResearchFilterPanel` admin |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct DB query + `unstable_cache` | tRPC `listPublic` (via server-action caller) | tRPC `listPublic` is `protectedProcedure` — requires auth; direct DB is cleaner for unauthenticated public routes. Pattern: `/portal/page.tsx` and `workshops-public.ts` both use direct Drizzle. |
| Route Handler 302 redirect | tRPC `getPresignedDownload` server action | tRPC requires auth. Route handler allows unauthenticated access + native browser redirect handles file download without fetch/CORS. |
| `unstable_cache` | `'use cache'` directive | `next.config.ts` does NOT set `cacheComponents: true` → `'use cache'` is unavailable. `unstable_cache` is confirmed in `workshops-public.ts` comment: "deprecated but still functional in Next.js 16." |

**Installation:** No new packages required for Phase 28.

---

## Architecture Patterns

### Recommended Project Structure

```
app/research/items/
  page.tsx                          # server component, listing with filter+pagination
  [id]/
    page.tsx                        # server component, detail page
    _components/
      download-button.tsx           # 'use client' — handles 302 redirect + error toast
  _components/
    research-card.tsx               # server component (no interactivity)
    research-filter-panel.tsx       # server component for URL-param-driven filters
    research-pagination.tsx         # server component rendering Prev/Next with aria-live

app/api/research/[id]/download/
  route.ts                          # Route Handler: rate-limit → isPublished → presign → 302

src/server/queries/
  research-public.ts                # plain async helper; unstable_cache at query level
```

### Pattern 1: Public Listing Server Component (mirrors `/workshops` exactly)

```typescript
// app/research/items/page.tsx
// Source: app/workshops/page.tsx Phase 20 canonical pattern

import type { Metadata } from 'next'
import { listPublicResearchItems } from '@/src/server/queries/research-public'

export const metadata: Metadata = {
  title: 'Published Research | Civilization Lab',
  description: 'Browse citable research informing India\'s blockchain policy consultation.',
}

export const dynamic = 'force-dynamic'   // re-evaluate ?offset, ?from, ?to every request

export default async function ResearchItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const q = await searchParams
  const documentId = typeof q.document === 'string' ? q.document : undefined
  const itemType   = typeof q.type === 'string' ? q.type : undefined
  const from       = typeof q.from === 'string' ? q.from : undefined
  const to         = typeof q.to === 'string' ? q.to : undefined
  const sort       = q.sort === 'oldest' ? 'oldest' : 'newest'   // default newest
  const offset     = typeof q.offset === 'string' ? parseInt(q.offset, 10) || 0 : 0

  const { items, total } = await listPublicResearchItems({ documentId, itemType, from, to, sort, offset })
  // ... render
}
```

**Key rule from Next.js docs (verified in `portal/[policyId]/page.tsx`):** `params` and `searchParams` are both `Promise<...>` in this version of Next.js — they MUST be awaited.

### Pattern 2: `research-public.ts` Helper with `unstable_cache`

```typescript
// src/server/queries/research-public.ts
// Source: src/server/queries/workshops-public.ts (Phase 20 canonical)

import { unstable_cache } from 'next/cache'
import { db } from '@/src/db'
import { researchItems, researchItemSectionLinks, researchItemVersionLinks } from '@/src/db/schema/research'
import { evidenceArtifacts } from '@/src/db/schema/evidence'
import { policyDocuments } from '@/src/db/schema/documents'
import { eq, and, desc, asc, gte, lte } from 'drizzle-orm'

const PAGE_SIZE = 40

export interface PublicResearchItem {
  id: string
  title: string
  itemType: string
  authors: string[] | null       // null when isAuthorAnonymous=true
  isAuthorAnonymous: boolean
  publishedDate: string | null   // ISO YYYY-MM-DD
  doi: string | null
  description: string | null
  externalUrl: string | null
  artifactId: string | null
  peerReviewed: boolean
  journalOrSource: string | null
}

export async function listPublicResearchItems(opts: {
  documentId?: string
  itemType?: string
  from?: string
  to?: string
  sort: 'newest' | 'oldest'
  offset: number
}): Promise<{ items: PublicResearchItem[]; total: number }> {
  // Cache keyed on all filter params; 60s revalidate matches /workshops pattern
  const cacheKey = ['research-items-public', JSON.stringify(opts)]
  const fn = unstable_cache(
    async () => {
      const conditions = [eq(researchItems.status, 'published')]
      if (opts.documentId) conditions.push(eq(researchItems.documentId, opts.documentId))
      if (opts.itemType)   conditions.push(eq(researchItems.itemType, opts.itemType as any))
      if (opts.from)       conditions.push(gte(researchItems.publishedDate, opts.from))
      if (opts.to)         conditions.push(lte(researchItems.publishedDate, opts.to))

      // Total count for pagination
      const totalRows = await db.select({ id: researchItems.id })
        .from(researchItems).where(and(...conditions))
      const total = totalRows.length

      const orderFn = opts.sort === 'oldest'
        ? asc(researchItems.publishedDate)
        : desc(researchItems.publishedDate)

      const rows = await db.select({...})
        .from(researchItems)
        .where(and(...conditions))
        .orderBy(orderFn, desc(researchItems.createdAt))
        .limit(PAGE_SIZE)
        .offset(opts.offset)

      // Pitfall 5 anonymous filter (mirrors research.ts listPublic)
      const items = rows.map((r) =>
        r.isAuthorAnonymous ? { ...r, authors: null } : r
      )
      return { items, total }
    },
    cacheKey,
    { revalidate: 60 },
  )
  return fn()
}
```

### Pattern 3: Detail Page — Direct Drizzle with Join (no tRPC, no auth)

```typescript
// app/research/items/[id]/page.tsx
// Source: portal/[policyId]/page.tsx — direct Drizzle, await params, notFound()

import { cache } from 'react'

// React cache() ensures generateMetadata + page share ONE DB fetch (per Next.js docs)
const getPublicResearchItem = cache(async (id: string) => {
  const [row] = await db.select({ /* column projection — NO createdBy, NO reviewedBy, NO feedbackLinks */ })
    .from(researchItems)
    .where(and(eq(researchItems.id, id), eq(researchItems.status, 'published')))
    .limit(1)
  return row ?? null
})

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const item = await getPublicResearchItem(id)
  if (!item) return {}
  return {
    title: `${item.title} | Research | Civilization Lab`,
    description: item.description?.slice(0, 155) ?? 'Research item informing the blockchain policy consultation.',
  }
}

export default async function ResearchItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!UUID_REGEX.test(id)) notFound()   // portal pattern: validate before DB
  const item = await getPublicResearchItem(id)
  if (!item) notFound()
  // ...
}
```

### Pattern 4: Download Route Handler (new — no existing model to reuse)

```typescript
// app/api/research/[id]/download/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/src/db'
import { researchItems } from '@/src/db/schema/research'
import { evidenceArtifacts } from '@/src/db/schema/evidence'
import { getDownloadUrl } from '@/src/lib/r2'
import { consume, getClientIp } from '@/src/lib/rate-limit'
import { eq, and } from 'drizzle-orm'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // 1. Rate-limit per IP (matches upload route pattern — src/lib/rate-limit.ts)
  const ip = getClientIp(_req)
  const rl = consume(`research-download:ip:${ip}`, { max: 10, windowMs: 60_000 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many download requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    )
  }

  // 2. Fetch item — must be published AND file-backed
  const [item] = await db
    .select({ id: researchItems.id, status: researchItems.status, artifactId: researchItems.artifactId })
    .from(researchItems)
    .where(eq(researchItems.id, id))
    .limit(1)

  if (!item || item.status !== 'published') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!item.artifactId) {
    return NextResponse.json({ error: 'No file attached' }, { status: 404 })
  }

  // 3. Get the artifact URL (stored at upload time in evidenceArtifacts.url)
  const [artifact] = await db
    .select({ url: evidenceArtifacts.url })
    .from(evidenceArtifacts)
    .where(eq(evidenceArtifacts.id, item.artifactId))
    .limit(1)

  if (!artifact?.url) {
    return NextResponse.json({ error: 'Artifact not found' }, { status: 404 })
  }

  // 4. Generate 24h presigned GET URL
  //    artifact.url is the PUBLIC R2 URL (e.g. https://pub-xxx.r2.dev/folder/file.pdf)
  //    The R2 key is NOT stored in evidence_artifacts (schema decision, Phase 26).
  //    WORKAROUND: derive key from public URL by stripping R2_PUBLIC_URL prefix.
  const r2Key = artifact.url.replace(process.env.R2_PUBLIC_URL + '/', '')
  const presignedUrl = await getDownloadUrl(r2Key, 86400)  // 24h = 86400s

  // 5. 302 redirect — browser follows natively, triggers file download
  return NextResponse.redirect(presignedUrl, 302)
}
```

**CRITICAL PITFALL:** `evidenceArtifacts` has no `r2_key` column (confirmed from `schema/evidence.ts` and Phase 27 STATE.md decision: "evidence_artifacts uses uploaderId (not uploadedBy) and has no r2_key column"). The R2 key must be derived from the stored `url` by stripping the `R2_PUBLIC_URL` prefix. This is the ONLY path to reconstruct the key. Verify `R2_PUBLIC_URL` env var is set (it IS, `src/lib/r2.ts` uses `requireEnv('R2_PUBLIC_URL')`).

### Pattern 5: DownloadButton Client Component

```typescript
// app/research/items/_components/download-button.tsx
'use client'
import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function DownloadButton({ itemId, title, itemType }: { itemId: string; title: string; itemType: string }) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    setLoading(true)
    try {
      // HEAD request to detect non-2xx/3xx before redirect
      // OR simply set window.location.href — 302 will trigger natively
      window.location.href = `/api/research/${itemId}/download`
      // loading state resets on navigation; keep spinner for UX on slow connections
    } catch {
      toast.error('Download unavailable. Please try again or contact the policy team.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleDownload}
      disabled={loading}
      aria-label={`Download ${title} (${itemType})`}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      <span className="ml-1">Download</span>
    </Button>
  )
}
```

**Note:** The UI-SPEC says `window.location.href = /api/research/{id}/download` (not `fetch`) so the browser handles the redirect natively — no CORS concern. The `try/catch` will NOT catch 429/404 from `window.location.href` assignment. The error toast approach needs a `fetch` HEAD probe first, OR rely on a page-level error boundary. The simpler production approach: use `<a href={...} download>` wrapper for file-backed items and let the browser handle 4xx natively. The UI-SPEC mandates the `window.location.href` pattern — implement per-spec.

### Pattern 6: Server-Component Filter Panel (NOT client-controlled)

The public listing uses **server-side searchParams** for filters (no client state). Unlike the admin `ResearchFilterPanel` which is `'use client'` with controlled state + `onChange`, the public listing renders filter controls as plain HTML form elements or links that submit to the same URL. Filter changes navigate to `?type=...&document=...&sort=...`.

For the multi-select type checkboxes, the simplest approach is a client island (`'use client'`) that wraps only the checkbox group and calls `router.push()` with the updated URL params — same pattern as Phase 21 `/framework` filter controls.

### Anti-Patterns to Avoid

- **Do NOT use tRPC `listPublic`** for the public listing: it uses `protectedProcedure`, requires an authenticated session. The public pages bypass tRPC entirely (confirmed: `portal/page.tsx` and `workshops/page.tsx` both use direct Drizzle, no tRPC).
- **Do NOT use tRPC `getById`** for the detail page: it's gated by `research:read_drafts` permission. The public page must do a direct `status = 'published'` filtered query.
- **Do NOT expose `createdBy`, `reviewedBy`, or `feedbackLinks`** in any public surface — these fields exist in DB and tRPC but must be column-projected OUT of public queries.
- **Do NOT use `'use cache'` directive** — `next.config.ts` has no `cacheComponents: true`. Use `unstable_cache` only.
- **Do NOT forget to await `params` and `searchParams`** — in this Next.js version both are `Promise<...>` (verified in `portal/[policyId]/page.tsx` and Next.js docs).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Anonymous author display | Custom if/else inline | `formatAuthorsForDisplay()` from `src/lib/research-utils.ts` | D-05 single source of truth; Phase 27 state says "Phase 28 public listing will also import this" |
| Research type badge | Custom span | `ResearchStatusBadge` from `app/research-manage/_components/research-status-badge.tsx` (always `published` status on public surface) | Reuse map confirmed in UI-SPEC |
| Rate limiting | Custom counter | `consume()` + `getClientIp()` from `src/lib/rate-limit.ts` | Already handles LRU eviction, per-key windows, Retry-After calculation |
| R2 presigned GET | Custom AWS SDK call | `getDownloadUrl(key, expiresIn)` from `src/lib/r2.ts` | Handles `requestChecksumCalculation: 'WHEN_REQUIRED'` pitfall (Phase 27 docs) |
| Public URL → R2 key derivation | Custom regex | Strip `process.env.R2_PUBLIC_URL + '/'` from `artifact.url` | Only one source of the public URL format in `getPublicUrl(key)` in `src/lib/r2.ts` |

---

## tRPC / Server-Action Surface

**Decision:** Phase 28 does NOT call tRPC for reads. All public listing and detail reads bypass tRPC and go directly to Drizzle (portal + workshops pattern). The reason: `listPublic` is `protectedProcedure` (requires auth); `getById` requires `research:read_drafts`.

### What `listPublic` (tRPC) actually does — for reference only

```typescript
// src/server/routers/research.ts — listPublic (WILL NOT be called from Phase 28)
listPublic: protectedProcedure
  .input(z.object({
    documentId: z.guid().optional(),
    itemType: z.enum(RESEARCH_ITEM_TYPES).optional(),
  }))
  // Pitfall 5: nulls authors when isAuthorAnonymous=true
  // Pitfall: NO date filter, NO sort param, NO pagination in Phase 26 implementation
```

**Critical Gap:** The existing `listPublic` has no `from`, `to`, `sort`, or `offset` parameters. Phase 28 must NOT try to call it — the direct DB query in `research-public.ts` implements the full filter set required by RESEARCH-09.

### What `getById` (tRPC) returns — for reference only

`getById` returns `{ ...item, linkedSections, linkedVersions, linkedFeedback }`. The `linkedFeedback` array contains `feedbackId` and `readableId` — these MUST NOT appear on the public detail page. The public DB query must select only from `researchItemSectionLinks` and `researchItemVersionLinks`, with the same join pattern but explicitly NOT joining `researchItemFeedbackLinks`.

---

## Presigned Download Strategy

### Decision: Route Handler + HTTP 302

**Route:** `app/api/research/[id]/download/route.ts`

This is already whitelist-public via `proxy.ts`: the existing `/research(.*)` matcher covers `/research/*` which maps to... wait — the download route is `/api/research/[id]/download`, NOT under `/research`. Let's verify:

**proxy.ts analysis:**
```
'/research(.*)'    → covers /research, /research/items, /research/items/[id]  ✓
```

`/api/research/[id]/download` is under `/api/...` not `/research/...`. The proxy.ts does NOT currently have an `/api/research(.*)` entry.

**CRITICAL FINDING:** The download API route at `/api/research/[id]/download/route.ts` is NOT covered by the existing `/research(.*)` public route matcher. The Clerk middleware will protect it as an authenticated route. This route must be explicitly added to the `isPublicRoute` matcher in `proxy.ts`.

**Required proxy.ts addition:**
```typescript
// Phase 28 — public research download endpoint (RESEARCH-10 presigned GET)
'/api/research(.*)',
```

### R2 Key Reconstruction

The `evidenceArtifacts.url` column stores the public URL (e.g. `https://pub-xxx.r2.dev/research/1234-abcd-file.pdf`). The R2 key is derived as:

```typescript
const r2Key = artifact.url.replace(process.env.R2_PUBLIC_URL! + '/', '')
// e.g. "research/1234-abcd-file.pdf"
```

`getDownloadUrl(r2Key, 86400)` then generates a presigned GET with 24h TTL.

**Edge case:** If `artifact.url` doesn't start with `R2_PUBLIC_URL` (e.g. for external URL-only items where `artifactId` is null), the route never reaches this code — it returns 404 at the `!item.artifactId` guard above.

### Rate Limit Parameters

Following the upload route pattern (20 presigns/min per user), a reasonable public download limit is:
- `max: 10, windowMs: 60_000` — 10 downloads per IP per minute
- Key: `research-download:ip:${ip}` — namespaced, no collision with upload keys

---

## Link Tables Access Pattern (Leak-Prevention)

The public detail page must display linked sections and linked versions WITHOUT exposing:
- Feedback IDs (from `researchItemFeedbackLinks`)
- Stakeholder names (from `users` table via `createdBy` / `reviewedBy`)
- Internal metadata (`status !== 'published'` items are 404)

### Safe Join Pattern for Detail Page

```typescript
// Only select sections + versions. Never join researchItemFeedbackLinks on public page.

const [linkedSections, linkedVersions] = await Promise.all([
  db.select({
    sectionId:     researchItemSectionLinks.sectionId,
    relevanceNote: researchItemSectionLinks.relevanceNote,
    sectionTitle:  policySections.title,           // safe: section title is public
    documentId:    policySections.documentId,
    documentTitle: policyDocuments.title,           // safe: doc title is public
    // NOT: sectionId is already here for the #section-{sectionId} anchor
  })
  .from(researchItemSectionLinks)
  .innerJoin(policySections, eq(researchItemSectionLinks.sectionId, policySections.id))
  .innerJoin(policyDocuments, eq(policySections.documentId, policyDocuments.id))
  .where(eq(researchItemSectionLinks.researchItemId, itemId)),

  db.select({
    versionId:     researchItemVersionLinks.versionId,
    versionLabel:  documentVersions.versionLabel,  // safe: version label is public
    documentId:    documentVersions.documentId,
    documentTitle: policyDocuments.title,           // safe
    publishedAt:   documentVersions.publishedAt,   // safe: public timing
    // NOT: isPublished guard ensures only published versions are linked
  })
  .from(researchItemVersionLinks)
  .innerJoin(documentVersions, eq(researchItemVersionLinks.versionId, documentVersions.id))
  .innerJoin(policyDocuments, eq(documentVersions.documentId, policyDocuments.id))
  .where(eq(researchItemVersionLinks.researchItemId, itemId)),
])
```

**Note:** `researchItemVersionLinks` does not filter by `isPublished` at the DB level — the link table may point to a draft version. The UI should render ALL linked versions (they were explicitly linked by an admin), but the public portal `?v=<label>` deep-link will 404 if the version is not published. This is acceptable — the link is aspirational. Alternatively, add `.where(and(..., eq(documentVersions.isPublished, true)))` to be safe. Recommendation: include the filter to avoid dead deep-links.

---

## URL-State Strategy

### Parameters (all server-side searchParams)

| Parameter | Encoding | Default | Notes |
|-----------|----------|---------|-------|
| `?document=` | UUID string or absent | All documents | Document filter |
| `?type=` | enum string (single value) | No filter | Multi-type: use `?type[]=` or comma-separated (pick one, must be consistent) |
| `?from=` | YYYY-MM-DD | No filter | ISO date string |
| `?to=` | YYYY-MM-DD | No filter | ISO date string |
| `?sort=` | `newest` or `oldest` | `newest` | Default newest |
| `?offset=` | integer | 0 | Pagination offset |

**CONTEXT.md decision:** Multi-type filter is a checkbox group (`?type=`). For server-side only (no client routing), the simplest approach is comma-separated: `?type=report,paper`. For URL persistence with browser navigation, use individual params `?type=report&type=paper` (standard multi-value pattern). The public filter panel is mostly a server component re-render on submit, not a reactive client component. Use the client island wrapper pattern for the checkbox group only, calling `router.replace` with updated URLSearchParams.

### Shareable URL requirement

Filters encode to URL params so users can share filtered views. No session state needed.

---

## Pagination Strategy

**Offset-based, 40 items/page** (CONTEXT.md SC-1, SC-2).

```
total = COUNT(*) WHERE status='published' AND [filters]
pages = Math.ceil(total / 40)
currentPage = Math.floor(offset / 40) + 1
hasPrev = offset > 0
hasNext = offset + 40 < total
```

Pagination controls navigate to `?offset=40`, `?offset=80` etc., preserving all other filter params.

`<nav aria-label="Research items pagination">` wrapper with `aria-live="polite"` region announcing "Showing items {start}–{end} of {total}".

---

## SEO + Metadata Approach

### Listing Page — Static Metadata Export

```typescript
// app/research/items/page.tsx
export const metadata: Metadata = {
  title: 'Published Research | Civilization Lab',
  description: 'Browse citable research informing India\'s blockchain policy consultation.',
}
```

### Detail Page — `generateMetadata` with `React.cache`

```typescript
// app/research/items/[id]/page.tsx
import { cache } from 'react'

const getResearchItemForPage = cache(async (id: string) => {
  // Single DB fetch shared by generateMetadata + Page component
  const [row] = await db.select({
    title: researchItems.title,
    description: researchItems.description,
  })
  .from(researchItems)
  .where(and(eq(researchItems.id, id), eq(researchItems.status, 'published')))
  .limit(1)
  return row ?? null
})

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const item = await getResearchItemForPage(id)
  if (!item) return {}
  return {
    title: `${item.title} | Research | Civilization Lab`,
    description: item.description?.slice(0, 155) ?? 'Research item informing the blockchain policy consultation.',
  }
}
```

Source: Next.js docs — "Memoizing data requests" section — recommends `React.cache` to avoid duplicate fetches when `generateMetadata` and `Page` both need the same data.

---

## Accessibility Approach

Patterns confirmed from existing codebase:

| Requirement | Pattern | Source |
|-------------|---------|--------|
| Filter checkboxes with labels | `<label>` wrapping `<Checkbox>` | `research-filter-panel.tsx` lines 146-164 |
| `aria-live` pagination | `<div aria-live="polite">` wrapping "Showing {start}–{end} of {total}" | UI-SPEC Surface A pagination |
| Download CTA aria-label | `aria-label="Download {title} ({itemType})"` | UI-SPEC copywriting contract |
| View Source CTA aria-label | `aria-label="Open external source for {title} (opens in new tab)"` | UI-SPEC copywriting contract |
| Pagination nav wrapper | `<nav aria-label="Research items pagination">` | UI-SPEC accessibility requirements |
| Back link | `aria-label="Back to all research items"` on detail page ArrowLeft link | UI-SPEC accessibility requirements |
| Date inputs | `aria-label="From date"` / `aria-label="To date"` | UI-SPEC accessibility requirements |
| Touch targets | min 44px height on all interactive elements | UI-SPEC spacing scale |

---

## Common Pitfalls

### Pitfall 1: `listPublic` tRPC requires auth
**What goes wrong:** Calling `trpc.research.listPublic` from a server component or client on a public page throws "Unauthorized" because `listPublic` uses `protectedProcedure` (STATE.md Phase 26 decision: "Phase 28 will expose truly public routes via direct server-component DB queries, matching the existing /portal pattern").
**Why it happens:** Phase 26 chose `protectedProcedure` to satisfy `research:read_published` RBAC for authenticated users; Phase 28's public surface was explicitly called out as a future bypass.
**How to avoid:** Use direct Drizzle queries in `research-public.ts` with `eq(researchItems.status, 'published')` guard. Never use the tRPC router for public page reads.

### Pitfall 2: `evidenceArtifacts` has no `r2_key` column
**What goes wrong:** Attempting to do `db.select({ key: evidenceArtifacts.r2Key })` fails at compile time — the column does not exist.
**Why it happens:** Phase 27 STATE.md: "evidence_artifacts uses uploaderId (not uploadedBy) and has no r2_key column — artifactR2Key accepted in input schema for client-server contract symmetry but silently dropped server-side."
**How to avoid:** Derive R2 key from `artifact.url` by stripping `R2_PUBLIC_URL` prefix. Validated by `getPublicUrl(key)` in `src/lib/r2.ts` which constructs `${R2_PUBLIC_URL}/${key}`.
**Warning signs:** TypeScript error on `evidenceArtifacts.r2Key` — do not add a type cast; fix the derivation logic.

### Pitfall 3: Download route not in proxy.ts public whitelist
**What goes wrong:** `GET /api/research/{id}/download` returns 401/redirect to sign-in for unauthenticated visitors.
**Why it happens:** `proxy.ts` whitelist only has `/research(.*)` which covers the pages, NOT `/api/research(.*)`.
**How to avoid:** Add `'/api/research(.*)'` to `isPublicRoute` in `proxy.ts`. Follow the append-at-end + comment header pattern (Phase 19 STATE.md: "append-at-end + comment header pattern for createRouteMatcher whitelist additions").
**Warning signs:** Download button navigates to Clerk sign-in page instead of triggering file download.

### Pitfall 4: `params` and `searchParams` are Promises
**What goes wrong:** `params.id` or `searchParams.document` are `undefined` because the developer forgot to await.
**Why it happens:** This Next.js version uses async params/searchParams (confirmed in `portal/[policyId]/page.tsx` pattern and Next.js docs example).
**How to avoid:** Always `const { id } = await params` and `const q = await searchParams`.
**Warning signs:** All filter conditions ignored on first render; UUID validation fails.

### Pitfall 5: Anonymous author filter must be applied at query boundary
**What goes wrong:** `authors` array leaks to the public page for anonymous items.
**Why it happens:** The DB row always has `authors` even when `isAuthorAnonymous=true`; the filter must be applied post-query.
**How to avoid:** Same pattern as `research.ts` line 220: `rows.map(r => r.isAuthorAnonymous ? { ...r, authors: null } : r)`. Use `formatAuthorsForDisplay()` from `src/lib/research-utils.ts` (handles null authors → "Source: Confidential").
**Warning signs:** Author names visible for items flagged anonymous in admin UI.

### Pitfall 6: Feedback link table must never be joined on public page
**What goes wrong:** `feedbackId` or feedback `readableId` (FB-001) exposed in HTML source or JSON response.
**Why it happens:** `getById` (tRPC) returns `linkedFeedback` — if the detail page were to call `getById`, it would receive feedback data.
**How to avoid:** Public detail page only queries `researchItemSectionLinks` and `researchItemVersionLinks`. `researchItemFeedbackLinks` is never touched.

### Pitfall 7: `unstable_cache` cannot have dynamic tags per call
**What goes wrong:** Attempting to invalidate a specific page's cache with `revalidateTag()` from the download handler fails if tags are not registered.
**Why it happens:** `unstable_cache` options.tags is a static string[] in Next.js 16 (same constraint documented in `workshops-public.ts`).
**How to avoid:** Keep the cache simple: tag listing cache with `['research-items-public']` and use a short TTL (60s). Individual item cache on detail page can be tagged with `[research-item-{id}]`.

### Pitfall 8: `'use cache'` directive is unavailable
**What goes wrong:** Using `'use cache'` in `research-public.ts` throws a "Unknown directive" error at runtime.
**Why it happens:** `next.config.ts` does not have `cacheComponents: true`. The caching docs confirm: "enabled by setting cacheComponents: true in your next.config.ts file."
**How to avoid:** Only use `unstable_cache` (confirmed working in `workshops-public.ts`).

---

## Code Examples

### LinkedSectionEntry (server component)

```typescript
// Source: UI-SPEC Surface B — linked section entry
import Link from 'next/link'
import { FileText } from 'lucide-react'

interface LinkedSectionEntryProps {
  documentId: string
  sectionId: string
  sectionTitle: string
  documentTitle: string
  relevanceNote: string | null
}

export function LinkedSectionEntry({ documentId, sectionId, sectionTitle, documentTitle, relevanceNote }: LinkedSectionEntryProps) {
  return (
    <Link href={`/framework/${documentId}#section-${sectionId}`}>
      <div className="flex items-start gap-3 rounded-md border bg-card px-4 py-3 hover:bg-muted/30 transition-colors">
        <FileText className="mt-0.5 size-4 text-muted-foreground shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground">{sectionTitle}</p>
          <p className="text-xs text-muted-foreground">{documentTitle}</p>
          {relevanceNote && <p className="mt-1 text-xs text-muted-foreground italic">{relevanceNote}</p>}
        </div>
      </div>
    </Link>
  )
}
```

### LinkedVersionEntry (server component)

```typescript
// Source: UI-SPEC Surface B — linked version entry
import Link from 'next/link'
import { format } from 'date-fns'

export function LinkedVersionEntry({ documentId, versionLabel, documentTitle, publishedAt }: {
  documentId: string; versionLabel: string; documentTitle: string; publishedAt: Date | null
}) {
  return (
    <Link href={`/portal/${documentId}?v=${versionLabel}`}>
      <div className="flex items-center gap-3 rounded-md border bg-card px-4 py-3 hover:bg-muted/30 transition-colors">
        <span className="inline-flex items-center rounded-full bg-[var(--status-cr-merged-bg)] px-2 py-0.5 text-xs font-medium text-[var(--status-cr-merged-text)]">
          {versionLabel}
        </span>
        <span className="text-sm text-foreground">{documentTitle}</span>
        {publishedAt && (
          <time className="ml-auto text-xs text-muted-foreground">
            {format(publishedAt, 'MMM d, yyyy')}
          </time>
        )}
      </div>
    </Link>
  )
}
```

### Browse CTA addition to `/research` page

```typescript
// MOD: app/research/page.tsx — add before closing </main> tag
// Source: UI-SPEC Surface C

<hr className="border-border my-12" />
<section id="browse-research">
  <h2 className="text-[20px] font-semibold leading-[1.2] mb-4">Published Research</h2>
  <p className="text-[16px] font-normal leading-[1.8] mb-6">
    Browse the citable research items that inform the policy framework under consultation.
  </p>
  <Link href="/research/items">
    <Button variant="outline">Browse published research</Button>
  </Link>
</section>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pages/api/` Route Handlers | `app/api/*/route.ts` | App Router migration | Route handler GET receives `(request, { params })` where params is `Promise<{...}>` in this version |
| Sync `params` in page | `await params` | This Next.js version | Breaking — confirmed by portal/[policyId]/page.tsx and Next.js docs |
| `'use cache'` | `unstable_cache` (when `cacheComponents: false`) | N/A — feature-flagged | Must check `next.config.ts` before using |

**Deprecated/outdated:**
- `unstable_cache`: Marked deprecated in Next.js docs but "still functional in Next.js 16" (confirmed in workshops-public.ts comment). Use it until project enables `cacheComponents`.

---

## Open Questions

1. **Multi-value `?type=` encoding**
   - What we know: UI-SPEC shows checkbox multi-select; CONTEXT.md says `?type=` without specifying multi-value encoding
   - What's unclear: comma-separated `?type=report,paper` vs repeated `?type=report&type=paper`
   - Recommendation: Use comma-separated `?type=report,paper` — simpler to parse in the server component searchParams, avoids URLSearchParams array ambiguity

2. **Linked version isPublished filter**
   - What we know: `researchItemVersionLinks` may link to draft versions; the public portal `?v=<label>` deep-link will 404 for unpublished versions
   - What's unclear: Should the public detail page silently omit draft-version links, or show them all?
   - Recommendation: Filter `and(eq(researchItemVersionLinks.researchItemId, itemId), eq(documentVersions.isPublished, true))` to avoid dead deep-links on the public surface

3. **Listing page document filter data source**
   - What we know: CONTEXT.md Q6 says document filter facet visible even with one policy; filter uses `?document=` UUID
   - What's unclear: Where does the listing page load the document options (for the Select dropdown)?
   - Recommendation: Query `policyDocuments` directly in the server component (one extra Drizzle query); only show documents that have ≥1 published research item

---

## Environment Availability

Step 2.6: SKIPPED — Phase 28 is purely code/config changes. All dependencies (Drizzle, R2, rate-limit) are existing project infrastructure, already verified in Phases 20-27. No new external service dependencies.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react (via jsdom) |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run tests/phase-28/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RESEARCH-09 | Listing renders only `status='published'` items | unit | `npx vitest run tests/phase-28/listing-render.test.tsx` | ❌ Wave 0 |
| RESEARCH-09 | Anonymous author renders as "Source: Confidential" | unit | `npx vitest run tests/phase-28/anonymous-author.test.tsx` | ❌ Wave 0 |
| RESEARCH-09 | URL filter params (`?document=`, `?type=`, `?from=`, `?to=`, `?sort=`) pass to query | unit | `npx vitest run tests/phase-28/listing-filter-params.test.ts` | ❌ Wave 0 |
| RESEARCH-09 | Pagination offset correctly slices results | unit | included in listing-filter-params.test.ts | ❌ Wave 0 |
| RESEARCH-10 | Detail page: published item renders; 404 for non-published | unit | `npx vitest run tests/phase-28/detail-render.test.tsx` | ❌ Wave 0 |
| RESEARCH-10 | Download route: 302 for published file-backed; 404 for non-published | unit | `npx vitest run tests/phase-28/download-route.test.ts` | ❌ Wave 0 |
| RESEARCH-10 | Download route: rate-limit returns 429 after max requests | unit | included in download-route.test.ts | ❌ Wave 0 |
| RESEARCH-10 | No feedback IDs or `createdBy` in detail page output | unit | `npx vitest run tests/phase-28/no-leak.test.ts` | ❌ Wave 0 |
| SC-3 (CTA) | `/research` page contains "Browse published research" link | unit | `npx vitest run tests/phase-28/research-page-cta.test.tsx` | ❌ Wave 0 |
| SC-7 (a11y) | Download CTA has descriptive aria-label | unit | included in listing-render.test.tsx | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/phase-28/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/phase-28/listing-render.test.tsx` — renders only published items (RESEARCH-09 SC-1)
- [ ] `tests/phase-28/anonymous-author.test.tsx` — anonymous author display (RESEARCH-09 SC-2, Q7)
- [ ] `tests/phase-28/listing-filter-params.test.ts` — filter + pagination params passed to query (RESEARCH-09)
- [ ] `tests/phase-28/detail-render.test.tsx` — detail renders for published, 404 for non-published (RESEARCH-10 SC-5)
- [ ] `tests/phase-28/download-route.test.ts` — 302 + 404 + 429 rate limit (RESEARCH-10 SC-4)
- [ ] `tests/phase-28/no-leak.test.ts` — asserts feedback IDs and createdBy absent from public output (RESEARCH-10 SC-5 leak-prevention)
- [ ] `tests/phase-28/research-page-cta.test.tsx` — Browse CTA addition on /research (CONTEXT.md SC-3)

**Wave 0 test file structure note:** Use the variable-path dynamic import pattern with `/* @vite-ignore */` for all tests that target modules not yet on disk. Follow Phase 19/20 Wave 0 convention. Use `it.todo()` or real assertions depending on whether the target module exists at Wave 0 time.

---

## Project Constraints (from CLAUDE.md)

Per `AGENTS.md` (inlined via `CLAUDE.md @AGENTS.md`):

> This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Actionable directives enforced in this research:**
1. `params` and `searchParams` are `Promise<...>` — verified in `portal/[policyId]/page.tsx` and Next.js docs `fetching-data.md`
2. `'use cache'` directive requires `cacheComponents: true` in `next.config.ts` — NOT set — use `unstable_cache` only
3. Route Handlers at `app/api/*/route.ts` with `GET(request, { params })` where `params` is `Promise`
4. `generateMetadata` function for dynamic metadata (not `head.tsx` pattern)
5. Use `React.cache()` to deduplicate data fetches between `generateMetadata` and the page component

**Other enforced project constraints:**
- npm (NOT pnpm) — all plan commands use `npx`, not `pnpm dlx`
- No worktrees — commit directly to master
- Skip aggregation subagents — inline findings
- `z.guid()` not `z.uuid()` for any UUID input schemas (Phase 16 precedent, Zod 4)
- Audit logs: fire-and-forget `writeAuditLog(...).catch(console.error)` (not awaited) — but Phase 28 public pages DO NOT write audit logs (public surface, no actor)
- `dynamic = 'force-dynamic'` on pages that re-evaluate `Date.now()` or request-time filters

---

## Sources

### Primary (HIGH confidence)
- `src/server/routers/research.ts` — actual `listPublic` and `getById` schemas; confirmed no date/sort/offset params in existing `listPublic`; confirms `protectedProcedure`
- `src/server/queries/workshops-public.ts` — canonical `unstable_cache` + public query helper pattern; comments confirm "deprecated but still functional in Next.js 16"
- `src/db/schema/research.ts` — column schema; confirms no `r2_key` on research or evidence tables
- `src/db/schema/evidence.ts` — confirms `evidenceArtifacts` has only `url` (not `r2_key`)
- `src/lib/r2.ts` — `getDownloadUrl(key, expiresIn)` API; `getPublicUrl(key)` shows URL format; `requireEnv('R2_PUBLIC_URL')` confirms env var availability
- `src/lib/rate-limit.ts` — `consume()` and `getClientIp()` API; confirmed `server-only` import guard
- `src/lib/research-utils.ts` — `formatAuthorsForDisplay()` confirmed for Phase 28 use (JSDoc: "Phase 28 public listing will also import this")
- `app/portal/[policyId]/page.tsx` — confirmed `params: Promise<{policyId: string}>` + `searchParams: Promise<{...}>` await pattern
- `proxy.ts` — confirmed `/research(.*)` covers listing/detail pages; confirmed `/api/research(.*)` NOT present (new entry needed)
- `next.config.ts` — confirmed NO `cacheComponents: true` → `'use cache'` unavailable
- `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md` — `generateMetadata` with `React.cache()` pattern
- `node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md` — confirms `cacheComponents: true` required for `'use cache'`
- `node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md` — confirms params are `Promise<...>` in current Next.js

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` Phase 26/27 decisions — confirmed artifact URL storage pattern, `protectedProcedure` rationale for Phase 28 bypass
- `app/workshops/page.tsx` — `export const dynamic = 'force-dynamic'`; grid layout pattern; `auth()` optional pattern for logged-in users

### Tertiary (LOW confidence)
- None — all critical findings are HIGH confidence from primary sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed present; no new installs
- Architecture (listing/detail): HIGH — portal + workshops patterns are exact matches
- Presigned download route: HIGH — R2 library API read directly; key derivation from URL format verified
- URL-state strategy: HIGH — confirmed `await searchParams` pattern from existing pages
- Pitfalls: HIGH — all sourced from actual schema/router code, not speculation
- Leak-prevention: HIGH — column projection pattern sourced from `research.ts` anonymous filter

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30 days — Next.js and Drizzle are pinned, low churn risk)
