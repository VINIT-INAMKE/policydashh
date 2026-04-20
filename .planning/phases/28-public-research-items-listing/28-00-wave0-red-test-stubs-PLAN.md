---
phase: 28-public-research-items-listing
plan: 00
type: execute
wave: 0
depends_on: []
files_modified:
  - tests/phase-28/research-public-query.test.ts
  - tests/phase-28/listing-page.test.tsx
  - tests/phase-28/detail-page.test.tsx
  - tests/phase-28/download-route.test.ts
  - tests/phase-28/no-leak.test.ts
  - tests/phase-28/research-cta.test.tsx
  - tests/phase-28/proxy-public-routes.test.ts
  - tests/phase-28/accessibility.test.tsx
  - .planning/phases/28-public-research-items-listing/28-VALIDATION.md
autonomous: true
requirements:
  - RESEARCH-09
  - RESEARCH-10
must_haves:
  truths:
    - "Wave 0 RED tests exist for every validation target in 28-VALIDATION.md"
    - "Each test imports its target module via variable-path dynamic import so vitest collection does not fail before downstream plans create the module"
    - "Every test file fails (RED) or has it.todo() stubs when the target module does not yet exist"
    - "28-VALIDATION.md is flipped to nyquist_compliant: true and wave_0_complete: true after all 8 files commit"
    - "proxy-public-routes.test.ts locks the `/api/research(.*)` string-match assertion that Plan 28-04 must satisfy"
    - "no-leak.test.ts asserts that detail-page HTML never contains `feedbackId`, `createdBy`, `reviewedBy`, or FB-### readableIds"
  artifacts:
    - path: "tests/phase-28/research-public-query.test.ts"
      provides: "RED contract for listPublishedResearchItems + getPublishedResearchItem (RESEARCH-09 / RESEARCH-10 query layer)"
      contains: "describe('listPublishedResearchItems"
    - path: "tests/phase-28/listing-page.test.tsx"
      provides: "RED contract for app/research/items/page.tsx (RESEARCH-09 listing)"
      contains: "describe('/research/items listing - RESEARCH-09"
    - path: "tests/phase-28/detail-page.test.tsx"
      provides: "RED contract for app/research/items/[id]/page.tsx (RESEARCH-10 detail)"
      contains: "describe('/research/items/[id] detail - RESEARCH-10"
    - path: "tests/phase-28/download-route.test.ts"
      provides: "RED contract for app/api/research/[id]/download/route.ts (302/404/429)"
      contains: "describe('GET /api/research/[id]/download"
    - path: "tests/phase-28/no-leak.test.ts"
      provides: "RED contract asserting zero feedback/createdBy/reviewedBy leaks on the public detail surface"
      contains: "describe('public research detail - leak prevention"
    - path: "tests/phase-28/research-cta.test.tsx"
      provides: "RED contract for Browse CTA addition on /research page"
      contains: "describe('/research page - Browse CTA"
    - path: "tests/phase-28/proxy-public-routes.test.ts"
      provides: "RED contract for proxy.ts /api/research(.*) matcher"
      contains: "/api/research(.*)"
    - path: "tests/phase-28/accessibility.test.tsx"
      provides: "RED contract for aria-live pagination + aria-label download CTA + keyboard-nav filter"
      contains: "describe('/research/items accessibility - SC-7"
  key_links:
    - from: "28-VALIDATION.md"
      to: "tests/phase-28/*"
      via: "nyquist gate flip"
      pattern: "nyquist_compliant: true"
    - from: "Wave 1/2/3 plans (28-01, 28-02, 28-03, 28-04)"
      to: "tests/phase-28/*"
      via: "RED → GREEN contract"
      pattern: "npx vitest run tests/phase-28"
---

<objective>
Wave 0 TDD gate. Ship 8 RED (or it.todo) test files that lock every RESEARCH-09 and RESEARCH-10 behavior before any implementation plan runs. Flip 28-VALIDATION.md gate flags.

Purpose: Prevents downstream plans (28-01 query+route, 28-02 listing, 28-03 detail, 28-04 CTA+proxy+REQUIREMENTS) from drifting off-contract. Each RED test is the frozen behavior spec that implementation waves must turn GREEN without rewriting the test. Follows canonical Wave 0 pattern from Phases 19/20/20.5/21/22/26/27 — STATE.md Phase 26 line: "TDD gate pattern: it.todo for all stub tests keeps suite green while preserving verifiable RED contract via acceptance-criteria-matching description strings."

Output: 8 test files under tests/phase-28/ + updated 28-VALIDATION.md with nyquist_compliant=true, wave_0_complete=true.
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
@.planning/phases/28-public-research-items-listing/28-UI-SPEC.md
@.planning/phases/28-public-research-items-listing/28-VALIDATION.md
@AGENTS.md
@tests/phase-20.5/research-page-render.test.tsx
@tests/phase-20.5/proxy-public-routes.test.ts
@tests/phase-20/workshops-listing.test.tsx
@vitest.config.mts
@src/server/routers/research.ts
@src/lib/research-utils.ts
@src/db/schema/research.ts
@src/db/schema/evidence.ts

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. -->

From Phase 20.5 Wave 0 (canonical variable-path dynamic import pattern):
```typescript
let ResearchPage: any
beforeAll(async () => {
  const segs = ['@', 'app', '(public)', 'research', 'page']
  const mod = await import(/* @vite-ignore */ segs.join('/'))
  ResearchPage = mod.default
})
```
Note: Phase 28 uses `app/research/...` NOT `app/(public)/research/...` — there is no (public) route group in this repo (confirmed by find app -type d).
So Phase 28 import path is: `const segs = ['@', 'app', 'research', 'items', 'page']`.

From src/lib/research-utils.ts (public listing will import this helper):
```typescript
export function shouldHideAuthors(item: { isAuthorAnonymous: boolean }): boolean
export function formatAuthorsForDisplay(item: { isAuthorAnonymous: boolean; authors: string[] | null }): string
// Returns "Source: Confidential" when anonymous, otherwise "Authors: {names}"
```

From src/db/schema/research.ts (row shape for fixtures):
```typescript
researchItems columns:
  id, readableId, documentId, title, itemType, status,
  createdBy, description, externalUrl, artifactId, doi, authors,
  publishedDate, peerReviewed, journalOrSource, versionLabel,
  previousVersionId, isAuthorAnonymous, reviewedBy, reviewedAt,
  retractionReason, milestoneId, contentHash, txHash, anchoredAt,
  createdAt, updatedAt
```

From src/db/schema/evidence.ts:
```typescript
// evidenceArtifacts columns: id, title, type, url (text NOT NULL), fileName, fileSize, uploaderId, createdAt, content, milestoneId
// NO r2_key column — URL stored directly. Phase 28 download route derives key by stripping R2_PUBLIC_URL prefix.
```

From vitest.config.mts (globs confirm tests/phase-28/*.test.ts(x) will be discovered):
```typescript
include: ['src/**/*.test.ts(x)', 'tests/**/*.test.ts(x)', 'app/**/*.test.ts(x)']
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create 4 backend RED test files (query + download route + no-leak + proxy)</name>
  <files>tests/phase-28/research-public-query.test.ts, tests/phase-28/download-route.test.ts, tests/phase-28/no-leak.test.ts, tests/phase-28/proxy-public-routes.test.ts</files>
  <behavior>
    - Test 1 (research-public-query.test.ts): `listPublishedResearchItems({ documentId, itemType, from, to, sort, offset })` returns `{ items, total }`; enforces `status='published'`; applies filters; orders by publishedDate DESC for sort='newest', ASC for 'oldest'; limits to 40; applies offset.
    - Test 2 (research-public-query.test.ts): `listPublishedResearchItems` nulls out `authors` when `isAuthorAnonymous=true` (Pitfall 5 from RESEARCH.md §Pitfalls).
    - Test 3 (research-public-query.test.ts): `getPublishedResearchItem(id)` returns null when status != 'published'; returns row when published; never returns `createdBy`, `reviewedBy`, `contentHash`, `txHash` in the public projection (column-project OUT per RESEARCH.md Pattern 3).
    - Test 4 (download-route.test.ts): GET /api/research/[id]/download returns 302 redirect to presigned URL when item is published AND has artifactId AND has evidence_artifacts.url; response header `location` matches a presigned URL pattern.
    - Test 5 (download-route.test.ts): GET returns 404 when item.status != 'published'.
    - Test 6 (download-route.test.ts): GET returns 404 when item.artifactId is null (URL-only item — no download).
    - Test 7 (download-route.test.ts): GET returns 429 with `Retry-After` header when rate-limit exhausted (use `consume()` mock from src/lib/rate-limit.ts).
    - Test 8 (download-route.test.ts): R2 key is derived from `artifact.url` by stripping `process.env.R2_PUBLIC_URL + '/'`; presigned URL generated with expiresIn=86400.
    - Test 9 (no-leak.test.ts): listing query result objects do NOT contain keys: `createdBy`, `reviewedBy`, `contentHash`, `txHash`, `anchoredAt`.
    - Test 10 (no-leak.test.ts): detail-page server component output HTML does NOT contain any of: `FB-`, `createdBy`, `reviewedBy`, feedback UUIDs — even when the fixture has linked feedback items.
    - Test 11 (proxy-public-routes.test.ts): proxy.ts file contents include literal string `'/api/research(.*)'` (locks Plan 28-04 Task 3 work).
    - Test 12 (proxy-public-routes.test.ts): proxy.ts file contents include a Phase 28 comment header naming `RESEARCH-10` (append-at-end + comment header convention from STATE.md Phase 19).
  </behavior>
  <read_first>
    - D:/aditee/policydash/tests/phase-20.5/research-page-render.test.tsx (variable-path dynamic import canonical pattern)
    - D:/aditee/policydash/tests/phase-20.5/proxy-public-routes.test.ts (proxy.ts static-string-match pattern)
    - D:/aditee/policydash/tests/phase-20/workshops-listing.test.tsx (vi.mock server query + render async server component pattern)
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-RESEARCH.md §Validation Architecture, §Common Pitfalls, §Presigned Download Strategy
    - D:/aditee/policydash/src/lib/rate-limit.ts (consume/getClientIp APIs)
    - D:/aditee/policydash/src/lib/r2.ts (getDownloadUrl signature, R2_PUBLIC_URL env)
    - D:/aditee/policydash/src/db/schema/research.ts (column shape for fixtures)
  </read_first>
  <action>
Create four test files. Use the variable-path dynamic import for target modules not yet on disk (Phase 20.5 pattern exactly). Vi.mock `@/src/db`, `@/src/lib/r2`, `@/src/lib/rate-limit` where appropriate.

**File 1: tests/phase-28/research-public-query.test.ts** (RED)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Phase 28 Wave 0 — RED contract for src/server/queries/research-public.ts.
 *
 * Locks the filter/sort/offset semantics for listPublishedResearchItems and
 * the no-leak projection for getPublishedResearchItem. Plan 28-01 must turn
 * these GREEN by creating the query helper with the exact exports below.
 *
 * Mocking strategy: vi.mock('@/src/db') returns a chainable select().from().where().orderBy().limit().offset()
 * that resolves to a test-controlled rows array. The TEST asserts the
 * CONDITIONS + ORDER BY + LIMIT + OFFSET objects the helper builds, not the
 * raw SQL — matches the Phase 26 research-router.test.ts pattern.
 */

vi.mock('@/src/db', () => ({
  db: {
    select: vi.fn(),
  },
}))

let listPublishedResearchItems: any
let getPublishedResearchItem: any

beforeEach(async () => {
  vi.clearAllMocks()
  const segs = ['@', 'src', 'server', 'queries', 'research-public']
  const mod = await import(/* @vite-ignore */ segs.join('/'))
  listPublishedResearchItems = mod.listPublishedResearchItems
  getPublishedResearchItem = mod.getPublishedResearchItem
})

describe('listPublishedResearchItems — RESEARCH-09 filter contract', () => {
  it.todo('returns { items, total }; applies status="published" filter')
  it.todo('applies documentId, itemType, from, to filters when provided')
  it.todo('orders by publishedDate DESC when sort="newest" (default)')
  it.todo('orders by publishedDate ASC when sort="oldest"')
  it.todo('limits to 40 per page; applies offset correctly')
  it.todo('nulls out authors when isAuthorAnonymous=true (Pitfall 5)')
  it.todo('strips createdBy, reviewedBy, contentHash, txHash from public projection')
})

describe('getPublishedResearchItem — RESEARCH-10 leak prevention', () => {
  it.todo('returns null when status != "published"')
  it.todo('returns row with public-safe projection (no createdBy/reviewedBy/contentHash/txHash)')
  it.todo('nulls out authors when isAuthorAnonymous=true')
})
```

**File 2: tests/phase-28/download-route.test.ts** (RED)

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Phase 28 Wave 0 — RED contract for app/api/research/[id]/download/route.ts.
 *
 * Locks: 302 redirect for valid published+file-backed, 404 for not-published or no-file,
 * 429 for rate-limit, R2 key derivation from artifact.url (strip R2_PUBLIC_URL).
 */

vi.mock('@/src/db', () => ({
  db: { select: vi.fn() },
}))

vi.mock('@/src/lib/r2', () => ({
  getDownloadUrl: vi.fn(async (key: string, ttl: number) => `https://r2-presigned.example/${key}?ttl=${ttl}`),
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
  const mod = await import(/* @vite-ignore */ segs.join('/'))
  GET = mod.GET
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
```

**File 3: tests/phase-28/no-leak.test.ts** (RED)

```typescript
import { describe, it, expect } from 'vitest'

/**
 * Phase 28 Wave 0 — RED contract for public surface leak prevention (Pitfall 6).
 *
 * Asserts that the public listing + detail server components never emit HTML
 * containing feedback IDs, createdBy, reviewedBy, or internal audit fields —
 * even when the fixture has a linked feedback item with a readableId like FB-042.
 */

describe('public research detail — leak prevention RESEARCH-10', () => {
  it.todo('detail-page HTML does NOT contain "createdBy" or "reviewedBy" strings')
  it.todo('detail-page HTML does NOT contain "FB-" readableId pattern even when linkedFeedback fixture exists')
  it.todo('detail-page HTML does NOT contain "contentHash", "txHash", "anchoredAt"')
  it.todo('detail-page HTML does NOT contain feedbackLinks / researchItemFeedbackLinks DB column names')
  it.todo('listing-page card HTML does NOT contain abstract, doi, linked sections count (CONTEXT.md Q9)')
  it.todo('listing query result objects do NOT expose createdBy, reviewedBy, contentHash, txHash keys')
})
```

**File 4: tests/phase-28/proxy-public-routes.test.ts** (RED until Plan 28-04)

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Phase 28 Wave 0 — RED contract for proxy.ts /api/research(.*) matcher.
 *
 * Plan 28-04 Task 3 must append '/api/research(.*)' to createRouteMatcher
 * with a Phase 28 comment header naming RESEARCH-10.
 *
 * Static string-match test; does NOT execute proxy.ts (Phase 20.5 pattern).
 */

describe('proxy.ts — Phase 28 /api/research(.*) matcher', () => {
  const src = readFileSync(path.join(process.cwd(), 'proxy.ts'), 'utf8')

  it("includes '/api/research(.*)' in createRouteMatcher", () => {
    expect(src).toContain("'/api/research(.*)'")
  })

  it("includes Phase 28 comment header naming RESEARCH-10", () => {
    expect(src).toMatch(/\/\/ Phase 28[\s\S]*RESEARCH-10/)
  })

  it("preserves existing '/research(.*)' matcher (covers listing + detail pages)", () => {
    expect(src).toContain("'/research(.*)'")
  })
})
```

All four files use either `it.todo` (for tests whose target module will be created by downstream plans) OR live asserting tests against files that already exist (proxy-public-routes.test.ts asserts against proxy.ts which is on disk today and will fail until Plan 28-04 amends it — that is the intended RED).

Commit message suffix: "chore(28-00): Wave 0 RED stubs — query + download route + no-leak + proxy"
  </action>
  <verify>
    <automated>npx vitest run tests/phase-28/research-public-query.test.ts tests/phase-28/download-route.test.ts tests/phase-28/no-leak.test.ts tests/phase-28/proxy-public-routes.test.ts --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/phase-28/research-public-query.test.ts` exists
    - File `tests/phase-28/download-route.test.ts` exists
    - File `tests/phase-28/no-leak.test.ts` exists
    - File `tests/phase-28/proxy-public-routes.test.ts` exists
    - `grep -c "it.todo\|it(" tests/phase-28/research-public-query.test.ts` returns a number ≥ 9 (matches "returns { items, total }" + filter cases + projection cases + anonymous + getPublishedResearchItem branches)
    - `grep -c "it.todo\|it(" tests/phase-28/download-route.test.ts` returns a number ≥ 8 (302 + 404×3 + 429 + TTL + key-derivation + rate-limit-key)
    - `grep "describe('listPublishedResearchItems" tests/phase-28/research-public-query.test.ts` returns a match
    - `grep "describe('GET /api/research/\[id\]/download" tests/phase-28/download-route.test.ts` returns a match
    - `grep "describe('public research detail - leak prevention" tests/phase-28/no-leak.test.ts` returns a match (or with Unicode dash — accept em-dash/hyphen variants)
    - `grep "'/api/research(.\\*)'" tests/phase-28/proxy-public-routes.test.ts` returns a match
    - proxy-public-routes.test.ts — 2 of 3 assertions FAIL (proxy.ts does not yet contain the `/api/research(.*)` matcher or Phase 28 comment); the 3rd ("preserves existing '/research(.*)'") passes. This is the intended RED state.
    - Other three test files have all `it.todo` stubs so vitest reports them as todo (not red/failing) — suite exits 0
  </acceptance_criteria>
  <done>
    Four test files committed. Variable-path dynamic import pattern used for future modules. Proxy test is authentically RED (locking Plan 28-04 work). Other three are it.todo-stubbed per canonical Phase 26 pattern.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create 4 UI RED test files (listing + detail + research-cta + accessibility)</name>
  <files>tests/phase-28/listing-page.test.tsx, tests/phase-28/detail-page.test.tsx, tests/phase-28/research-cta.test.tsx, tests/phase-28/accessibility.test.tsx</files>
  <behavior>
    - Test 1 (listing-page.test.tsx): page H1 renders "Published Research"; page component default-exports an async server component.
    - Test 2 (listing-page.test.tsx): when `listPublishedResearchItems` mock returns items, H1 and card grid render with card count matching items.length.
    - Test 3 (listing-page.test.tsx): anonymous author renders as "Source: Confidential" string in card HTML.
    - Test 4 (listing-page.test.tsx): pagination "Previous" button disabled when offset=0; "Next" disabled when (offset + 40) >= total.
    - Test 5 (listing-page.test.tsx): pagination `aria-live="polite"` region contains "Showing items {start}–{end} of {total}".
    - Test 6 (listing-page.test.tsx): searchParams `document/type/from/to/sort/offset` are awaited and forwarded to listPublishedResearchItems (query mock receives them).
    - Test 7 (listing-page.test.tsx): empty-state heading "No published research yet" or "No research items match these filters" renders when items.length === 0.
    - Test 8 (detail-page.test.tsx): detail page H1 contains `item.title`; Back link `aria-label="Back to all research items"` and href="/research/items".
    - Test 9 (detail-page.test.tsx): DOI renders as hyperlink `<a href="https://doi.org/{doi}">` when doi is non-null.
    - Test 10 (detail-page.test.tsx): linked sections render as internal links `/framework/{documentId}#section-{sectionId}` with section title + document title.
    - Test 11 (detail-page.test.tsx): linked versions render as internal links `/portal/{documentId}?v={versionLabel}` with version label + doc title.
    - Test 12 (detail-page.test.tsx): anonymous item's author line renders "Source: Confidential".
    - Test 13 (detail-page.test.tsx): peer-reviewed flag renders "Peer Reviewed" badge when `peerReviewed=true`, absent when false.
    - Test 14 (detail-page.test.tsx): `notFound()` called when DB returns null or status != 'published' (vi.mock notFound to throw sentinel; assert throws).
    - Test 15 (research-cta.test.tsx): /research page contains "Browse published research" link (anchor to /research/items).
    - Test 16 (research-cta.test.tsx): /research page still contains existing "Understanding the Landscape" heading (prose not disturbed).
    - Test 17 (research-cta.test.tsx): /research page still contains existing "Join Consultation" CTA (not replaced).
    - Test 18 (accessibility.test.tsx): download button renders with `aria-label` matching `Download {title} ({type})` pattern.
    - Test 19 (accessibility.test.tsx): filter date inputs have `aria-label="From date"` / `aria-label="To date"`.
    - Test 20 (accessibility.test.tsx): pagination nav wrapper has `aria-label="Research items pagination"`.
    - Test 21 (accessibility.test.tsx): external-link CTA on URL-only items has `target="_blank"` AND `rel="noopener noreferrer"`.
  </behavior>
  <read_first>
    - D:/aditee/policydash/tests/phase-20.5/research-page-render.test.tsx (renderToStaticMarkup + React.createElement pattern for async server component output assertion)
    - D:/aditee/policydash/tests/phase-20/workshops-listing.test.tsx (vi.mock + render + screen.getByRole pattern)
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-UI-SPEC.md Surface A, B, C (exact copy strings, aria-labels, DOM structure)
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-RESEARCH.md Pattern 1, 3, 5 (server component structure; detail direct Drizzle; DownloadButton client component)
    - D:/aditee/policydash/app/research/page.tsx (existing /research page to assert CTA addition preserves)
  </read_first>
  <action>
Create four RED test files using `it.todo` for stubs (target modules created in Waves 2/3/4) and real asserts for research-cta.test.tsx (target file app/research/page.tsx exists today and will fail until Plan 28-04 amends it).

**File 1: tests/phase-28/listing-page.test.tsx** (it.todo for all)

```typescript
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

/**
 * Phase 28 Wave 0 — RED contract for app/research/items/page.tsx (RESEARCH-09).
 *
 * Locks the listing page contract: header copy, card count, anonymous author
 * rendering, pagination disabled states, aria-live announcement, searchParams
 * plumbing, empty states. Plan 28-02 must turn these GREEN.
 */

vi.mock('@/src/server/queries/research-public', () => ({
  listPublishedResearchItems: vi.fn(),
}))

// Variable-path dynamic import (module does not exist yet — Plan 28-02 creates it)
let ResearchItemsPage: any
beforeAll(async () => {
  const segs = ['@', 'app', 'research', 'items', 'page']
  try {
    const mod = await import(/* @vite-ignore */ segs.join('/'))
    ResearchItemsPage = mod.default
  } catch {
    // Intentional: Wave 0 RED state. Plan 28-02 will make this import succeed.
    ResearchItemsPage = null
  }
})

describe('/research/items listing — RESEARCH-09', () => {
  it.todo('renders H1 "Published Research"')
  it.todo('renders N cards when listPublishedResearchItems returns N items')
  it.todo('renders anonymous author as "Source: Confidential" on cards with isAuthorAnonymous=true')
  it.todo('Previous button disabled when offset=0')
  it.todo('Next button disabled when offset + 40 >= total')
  it.todo('aria-live="polite" region contains "Showing items X-Y of Z"')
  it.todo('forwards searchParams (document/type/from/to/sort/offset) to query helper')
  it.todo('renders "No published research yet" when items empty and no filters')
  it.todo('renders "No research items match these filters" when items empty and filters active')
})
```

**File 2: tests/phase-28/detail-page.test.tsx** (it.todo for all)

```typescript
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

/**
 * Phase 28 Wave 0 — RED contract for app/research/items/[id]/page.tsx (RESEARCH-10).
 *
 * Locks detail page contract: H1 title, Back link, DOI hyperlink, linked sections +
 * versions internal links, anonymous author, peer-reviewed badge, notFound() branch.
 */

vi.mock('@/src/server/queries/research-public', () => ({
  getPublishedResearchItem: vi.fn(),
  listLinkedSectionsForResearchItem: vi.fn(),
  listLinkedVersionsForResearchItem: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NEXT_NOT_FOUND') },
}))

let ResearchItemDetailPage: any
beforeAll(async () => {
  const segs = ['@', 'app', 'research', 'items', '[id]', 'page']
  try {
    const mod = await import(/* @vite-ignore */ segs.join('/'))
    ResearchItemDetailPage = mod.default
  } catch {
    ResearchItemDetailPage = null
  }
})

describe('/research/items/[id] detail — RESEARCH-10', () => {
  it.todo('renders H1 with item.title')
  it.todo('renders Back link with aria-label="Back to all research items" and href="/research/items"')
  it.todo('DOI renders as <a href="https://doi.org/{doi}"> when doi present')
  it.todo('hides DOI section when doi is null')
  it.todo('renders linked sections as <a href="/framework/{documentId}#section-{sectionId}">')
  it.todo('renders linked versions as <a href="/portal/{documentId}?v={versionLabel}">')
  it.todo('renders "Source: Confidential" when isAuthorAnonymous=true')
  it.todo('renders "Peer Reviewed" badge when peerReviewed=true, absent when false')
  it.todo('calls notFound() when getPublishedResearchItem returns null')
  it.todo('calls notFound() when UUID_REGEX does not match id param')
})
```

**File 3: tests/phase-28/research-cta.test.tsx** (REAL assertions — RED until Plan 28-04 amends app/research/page.tsx)

```typescript
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import ResearchPage from '@/app/research/page'

/**
 * Phase 28 Wave 0 — RED contract for /research page Browse CTA addition.
 *
 * Plan 28-04 Task 1 must append a "Browse published research" link section to
 * app/research/page.tsx without disturbing the existing prose. This test runs
 * against the live file today and will fail until that plan ships.
 */

describe('/research page — Browse CTA (CONTEXT.md Scope IN)', () => {
  it('contains "Browse published research" link text', () => {
    const html = renderToStaticMarkup(React.createElement(ResearchPage))
    expect(html).toContain('Browse published research')
  })

  it('link target is /research/items', () => {
    const html = renderToStaticMarkup(React.createElement(ResearchPage))
    expect(html).toMatch(/href="\/research\/items"/)
  })

  it('preserves existing "Understanding the Landscape" heading (prose not disturbed)', () => {
    const html = renderToStaticMarkup(React.createElement(ResearchPage))
    expect(html).toContain('Understanding the Landscape')
  })

  it('preserves existing "Join Consultation" CTA', () => {
    const html = renderToStaticMarkup(React.createElement(ResearchPage))
    expect(html).toContain('Join Consultation')
  })

  it('preserves the Research Outputs section (prose not disturbed)', () => {
    const html = renderToStaticMarkup(React.createElement(ResearchPage))
    expect(html).toContain('Research Outputs')
  })
})
```

**File 4: tests/phase-28/accessibility.test.tsx** (it.todo for all)

```typescript
import { describe, it, expect } from 'vitest'

/**
 * Phase 28 Wave 0 — RED contract for a11y (CONTEXT.md SC-7).
 *
 * Plan 28-02 + 28-03 must satisfy aria-label / target+rel / aria-live + nav
 * aria-label requirements from the UI-SPEC accessibility block.
 */

describe('/research/items accessibility — SC-7', () => {
  it.todo('download button has aria-label matching /Download .+ \\(.+\\)/ pattern')
  it.todo('filter <input type="date"> for "from" has aria-label="From date"')
  it.todo('filter <input type="date"> for "to" has aria-label="To date"')
  it.todo('pagination <nav> wrapper has aria-label="Research items pagination"')
  it.todo('external-link CTA on URL-only items has target="_blank" AND rel="noopener noreferrer"')
  it.todo('Back link on detail page has aria-label="Back to all research items"')
  it.todo('clear-filters link has aria-label="Clear all filters"')
})
```

Commit message suffix: "chore(28-00): Wave 0 RED stubs — listing + detail + research-cta + a11y"
  </action>
  <verify>
    <automated>npx vitest run tests/phase-28/listing-page.test.tsx tests/phase-28/detail-page.test.tsx tests/phase-28/research-cta.test.tsx tests/phase-28/accessibility.test.tsx --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/phase-28/listing-page.test.tsx` exists with ≥9 `it.todo` stubs
    - File `tests/phase-28/detail-page.test.tsx` exists with ≥10 `it.todo` stubs
    - File `tests/phase-28/research-cta.test.tsx` exists with ≥5 real `it(` assertions (NOT it.todo)
    - File `tests/phase-28/accessibility.test.tsx` exists with ≥7 `it.todo` stubs
    - `grep -c "describe(" tests/phase-28/listing-page.test.tsx` returns ≥ 1
    - `grep "segs.join('/')" tests/phase-28/listing-page.test.tsx` returns a match (variable-path dynamic import pattern)
    - `grep "segs.join('/')" tests/phase-28/detail-page.test.tsx` returns a match
    - `grep "import ResearchPage from '@/app/research/page'" tests/phase-28/research-cta.test.tsx` returns a match (real import, not dynamic — the file exists)
    - research-cta.test.tsx has 2 FAILING assertions (Browse CTA + /research/items href absent today); 3 passing (Understanding the Landscape, Join Consultation, Research Outputs preserved checks). Overall test file is RED — locking Plan 28-04.
    - Other three files are all it.todo so vitest passes with status: todo; overall Wave 0 suite is RED on proxy + research-cta, todo on the rest.
  </acceptance_criteria>
  <done>
    Four UI test files committed. research-cta.test.tsx real-asserts against live /research page and is authentically RED. Other three are it.todo scaffolds locking the future contracts.
  </done>
</task>

<task type="auto">
  <name>Task 3: Flip 28-VALIDATION.md gate flags</name>
  <files>.planning/phases/28-public-research-items-listing/28-VALIDATION.md</files>
  <read_first>
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-VALIDATION.md (current frontmatter and Wave 0 Requirements block)
    - D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-RESEARCH.md §Validation Architecture table (maps requirements to test files — Planner fills the per-task map)
    - D:/aditee/policydash/.planning/phases/22-milestone-entity-sha256-hashing-service/22-VALIDATION.md (for canonical flipped-frontmatter format — reference only)
  </read_first>
  <action>
Edit 28-VALIDATION.md in place. Preserve existing structure, update only the specified lines.

1. **Frontmatter block** — change:
   - `status: draft` → `status: approved`
   - `nyquist_compliant: false` → `nyquist_compliant: true`
   - `wave_0_complete: false` → `wave_0_complete: true`
   - Append `approved_at: 2026-04-20` below `created:`

2. **Per-Task Verification Map section** — replace the placeholder row with 8 real rows (one per test file from Tasks 1–2 above). Exact content:

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 28-00-T1 | 00 | 0 | RESEARCH-09 | unit | `npx vitest run tests/phase-28/research-public-query.test.ts` | ✅ (todo) | ⬜ pending |
| 28-00-T2 | 00 | 0 | RESEARCH-10 | unit | `npx vitest run tests/phase-28/download-route.test.ts` | ✅ (todo) | ⬜ pending |
| 28-00-T3 | 00 | 0 | RESEARCH-10 | unit | `npx vitest run tests/phase-28/no-leak.test.ts` | ✅ (todo) | ⬜ pending |
| 28-00-T4 | 00 | 0 | RESEARCH-10 | unit | `npx vitest run tests/phase-28/proxy-public-routes.test.ts` | ✅ (RED) | ❌ red |
| 28-00-T5 | 00 | 0 | RESEARCH-09 | component | `npx vitest run tests/phase-28/listing-page.test.tsx` | ✅ (todo) | ⬜ pending |
| 28-00-T6 | 00 | 0 | RESEARCH-10 | component | `npx vitest run tests/phase-28/detail-page.test.tsx` | ✅ (todo) | ⬜ pending |
| 28-00-T7 | 00 | 0 | SC-3 (CTA) | component | `npx vitest run tests/phase-28/research-cta.test.tsx` | ✅ (RED) | ❌ red |
| 28-00-T8 | 00 | 0 | SC-7 (a11y) | component | `npx vitest run tests/phase-28/accessibility.test.tsx` | ✅ (todo) | ⬜ pending |

3. **Wave 0 Requirements section** — replace the 7 unchecked boxes with the 8 actual file paths shipped in Tasks 1–2, all marked checked:

```
- [x] `tests/phase-28/research-public-query.test.ts` — listPublishedResearchItems + getPublishedResearchItem (RESEARCH-09/10 query layer)
- [x] `tests/phase-28/listing-page.test.tsx` — server-component renders published-only cards, filter URL-sync, pagination (RESEARCH-09)
- [x] `tests/phase-28/detail-page.test.tsx` — full metadata render, DOI link, anonymous-author, linked sections/versions (RESEARCH-10)
- [x] `tests/phase-28/download-route.test.ts` — 302 redirect, 404, 429, 24h TTL, key-derivation (RESEARCH-10)
- [x] `tests/phase-28/no-leak.test.ts` — feedback/createdBy/reviewedBy/contentHash never leak to public surface (RESEARCH-10)
- [x] `tests/phase-28/research-cta.test.tsx` — /research page Browse CTA addition (CONTEXT.md SC-3)
- [x] `tests/phase-28/proxy-public-routes.test.ts` — /api/research(.*) public matcher in proxy.ts (RESEARCH-10)
- [x] `tests/phase-28/accessibility.test.tsx` — filter keyboard-nav, aria-live pagination, aria-label download CTA (SC-7)
```

4. **Validation Sign-Off checkboxes** — flip the first 4 items to [x]:
```
- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references above
- [x] No watch-mode flags (all commands use `vitest run`, never `vitest` alone)
- [ ] Feedback latency < 30s for phase-28 suite  (measured on first green Wave 1)
- [x] `nyquist_compliant: true` set in frontmatter once planner finalizes per-task map
```

5. **Approval** — change `**Approval:** pending` → `**Approval:** approved 2026-04-20`

Commit message: "docs(28-00): flip VALIDATION gate flags — Wave 0 complete"
  </action>
  <verify>
    <automated>grep -E "nyquist_compliant: true|wave_0_complete: true|status: approved" D:/aditee/policydash/.planning/phases/28-public-research-items-listing/28-VALIDATION.md | wc -l</automated>
  </verify>
  <acceptance_criteria>
    - `grep "nyquist_compliant: true" .planning/phases/28-public-research-items-listing/28-VALIDATION.md` returns a match
    - `grep "wave_0_complete: true" .planning/phases/28-public-research-items-listing/28-VALIDATION.md` returns a match
    - `grep "status: approved" .planning/phases/28-public-research-items-listing/28-VALIDATION.md` returns a match (in frontmatter)
    - `grep -c "28-00-T" .planning/phases/28-public-research-items-listing/28-VALIDATION.md` returns ≥ 8 (all 8 task IDs in the per-task map)
    - `grep -c "\\[x\\].*tests/phase-28/" .planning/phases/28-public-research-items-listing/28-VALIDATION.md` returns ≥ 8 (all 8 test files marked shipped)
    - `grep "Approval.*approved 2026-04-20" .planning/phases/28-public-research-items-listing/28-VALIDATION.md` returns a match
  </acceptance_criteria>
  <done>
    28-VALIDATION.md has approved frontmatter, per-task map with 8 rows, 8 Wave 0 files marked shipped, sign-off boxes flipped.
  </done>
</task>

</tasks>

<verification>
Wave 0 gate verification checklist:
- 8 test files exist under `tests/phase-28/`
- `npx vitest run tests/phase-28 --reporter=dot` runs cleanly (exits 0 or 1 — both acceptable since proxy-public-routes.test.ts and research-cta.test.tsx are authentically RED, it.todo tests do not fail the suite)
- 28-VALIDATION.md frontmatter has `nyquist_compliant: true` and `wave_0_complete: true`
- 28-VALIDATION.md per-task map has 8 rows
- No production code touched — Wave 0 is test-only + docs
</verification>

<success_criteria>
- 8 RED/todo test files land in tests/phase-28/ with variable-path dynamic imports for yet-to-be-written modules
- research-cta.test.tsx and proxy-public-routes.test.ts are authentically RED against live files (lock Plan 28-04 work)
- 28-VALIDATION.md flipped to nyquist_compliant=true, wave_0_complete=true, status=approved
- Wave 1/2/3/4 plans now have a frozen contract to turn GREEN
</success_criteria>

<output>
After completion, create `.planning/phases/28-public-research-items-listing/28-00-SUMMARY.md` summarizing: 8 files shipped, test count per file, which tests are it.todo vs authentically RED, validation gate flipped, next plan wave.
</output>
