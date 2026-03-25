# Phase 9: Public Portal & Compliance - Research

**Researched:** 2026-03-25
**Domain:** Next.js route groups (no-auth), ZIP generation, audit trail UI, @react-pdf/renderer
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Published versions exist from Phase 6 (isPublished flag, immutable snapshots)
- Audit log exists from Phase 1 (partitioned, immutable)
- Privacy preferences exist from Phase 4 (AUTH-08)
- PDF export route exists from Phase 7 (traceability CSV/PDF)
- Public routes must NOT require authentication

### Claude's Discretion
All implementation choices are at Claude's discretion.

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PUB-01 | Published policy versions viewable on public read-only page (no auth required) | Route group `(public)` with no Clerk guard; query `documentVersions` where `isPublished=true` |
| PUB-02 | Public changelog showing version history and what changed | `documentVersions.changelog` JSONB column is already populated by Phase 6 merge/manual creation |
| PUB-03 | Sanitized consultation summaries (no stakeholder identities unless opted in) | `feedbackItems.isAnonymous + users.name`; aggregate by section, null-out names unless `isAnonymous=false` |
| PUB-04 | PDF export of published policy versions | Extend @react-pdf/renderer pattern from Phase 7; new `app/api/export/policy-pdf/[versionId]/route.ts` |
| PUB-05 | Public portal must NOT expose raw feedback threads, stakeholder identities, or internal deliberations | Enforce server-side: only return `sectionsSnapshot` + sanitized summary aggregates; no feedback bodies, no submitter names unless opted in |
| AUDIT-04 | Auditor can view full audit trail with filtering | `auditRouter.list` already exists with full filter API; build dedicated `/audit` page with filter UI wired to that tRPC query |
| AUDIT-05 | Milestone evidence pack export: stakeholder list, feedback matrix, version history, workshop evidence, decision logs | New route `app/api/export/evidence-pack/route.ts`; gather data from 5 existing tables; no workshop data yet so omit that section gracefully |
| AUDIT-06 | Evidence pack exportable as structured ZIP with index | Use `fflate` (pure-ESM, works in Next.js Route Handlers); bundle JSON manifests + PDF binary + CSV; write `INDEX.md` as text |
</phase_requirements>

---

## Summary

Phase 9 adds two independent surfaces: a public read-only portal and an auditor compliance module. Both surfaces read data that already exists in the database — the phase produces no new schema migrations and no new tRPC procedures for writes.

The public portal requires a new `(public)` route group in `app/` with its own layout that contains no `auth()` call. The existing `proxy.ts` (Next.js 16 Middleware equivalent) must whitelist the new paths via `createRouteMatcher`. All queries execute server-side via direct DB access (no tRPC, which requires an authenticated session context). Privacy enforcement for public consultation summaries follows the same `isAnonymous` pattern already codified in Phase 7's traceability matrix.

The compliance module has two parts: (1) an audit trail viewer page at `/audit` (authenticated, Auditor role), which wires existing `auditRouter.list` tRPC query into a filter UI; and (2) an evidence pack ZIP route at `app/api/export/evidence-pack/`. ZIP generation needs `fflate` — a pure-ESM library that works in both Node.js and Edge runtimes and requires no npm install of native binaries. No ZIP library currently exists in the project; `fflate` is the correct choice (36 KB, tree-shakeable, no native dependencies).

**Primary recommendation:** Add `(public)` route group (no auth layout), whitelist routes in proxy.ts, query DB directly in Server Components, add `fflate` for ZIP, extend @react-pdf/renderer for policy PDF export following Phase 7 patterns.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router route groups | 16.2.1 (in use) | `(public)` group — URL-transparent, own layout, no ClerkProvider guard needed | Project already uses `(auth)` and `(workspace)` route groups |
| @react-pdf/renderer | 4.3.0 (in use) | PDF rendering for PUB-04 policy export | Already used in Phase 7 traceability PDF |
| fflate | ^0.8.x (NEW — not installed) | ZIP generation for evidence pack | Pure ESM, works in Next.js Route Handlers, no native deps, 36 KB |
| drizzle-orm | 0.45.1 (in use) | Direct DB queries in Server Components (no tRPC for public routes) | Already project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| papaparse | 5.5.2 (in use) | CSV serialization for evidence pack CSV artifacts | Already used for traceability CSV export |
| date-fns | 4.1.0 (in use) | Date formatting in audit trail viewer | Already project standard |
| lucide-react | 1.6.0 (in use) | Icons for audit trail and public portal UI | Already project standard |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fflate | jszip | jszip requires npm install; fflate is lighter and ESM-native; both work in Node.js |
| fflate | archiver | archiver requires Node.js streams; does not work in Edge runtime; heavier |
| Direct DB in Server Component | tRPC publicProcedure | tRPC init.ts exports `publicProcedure` but project decision: "no publicProcedure in application routers" (Phase 1 decision). Direct DB query is correct for public routes. |

**Installation (fflate only — everything else already installed):**
```bash
npm install fflate
```

---

## Architecture Patterns

### Recommended Project Structure

```
app/
├── (public)/               # No-auth route group for public portal
│   ├── layout.tsx          # Minimal layout — no ClerkProvider, no WorkspaceNav
│   └── portal/
│       ├── page.tsx        # Public portal index: lists all published policies
│       └── [documentId]/
│           ├── page.tsx    # Published policy page: latest published version
│           └── [versionId]/
│               └── page.tsx # Specific version view
├── (workspace)/
│   └── audit/
│       └── page.tsx        # Auditor audit trail viewer (authenticated)
├── api/
│   └── export/
│       ├── traceability/   # Phase 7 (existing)
│       ├── policy-pdf/
│       │   └── [versionId]/
│       │       └── route.ts  # PUB-04: PDF of published policy version
│       └── evidence-pack/
│           └── route.ts      # AUDIT-05/06: ZIP evidence pack
src/
└── server/
    └── services/
        └── evidence-pack.service.ts  # Evidence pack assembly logic
```

### Pattern 1: Public Route Group — No Auth Layout

**What:** Route group with its own `layout.tsx` that does NOT call `auth()`. The group name `(public)` is excluded from URLs.
**When to use:** Any routes that must be accessible without authentication.
**Example:**
```tsx
// app/(public)/layout.tsx
// Source: Next.js 16 project structure docs (node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md)
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b px-6 py-3">
        <h1 className="text-lg font-semibold">PolicyDash — Public Portal</h1>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
// No auth() call. No ClerkProvider needed here (root layout already wraps ClerkProvider).
```

### Pattern 2: proxy.ts Route Whitelist

**What:** Add public portal paths to `isPublicRoute` in proxy.ts so Clerk does not redirect unauthenticated visitors.
**When to use:** Required for every new unauthenticated route in this project.
**Example:**
```typescript
// proxy.ts (existing file — extend isPublicRoute)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/portal(.*)',             // ADD THIS — public portal routes
])
```

### Pattern 3: Direct DB Query in Public Server Component

**What:** Public Server Components query the DB directly using drizzle. tRPC requires authentication context and MUST NOT be used on public routes.
**When to use:** All public portal pages.
**Example:**
```typescript
// app/(public)/portal/[documentId]/page.tsx
import { db } from '@/src/db'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { policyDocuments } from '@/src/db/schema/documents'
import { eq, desc } from 'drizzle-orm'

export default async function PublicDocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>
}) {
  const { documentId } = await params  // Next.js 16: params is a Promise
  const [doc] = await db
    .select()
    .from(policyDocuments)
    .where(eq(policyDocuments.id, documentId))
    .limit(1)

  const versions = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.isPublished, true),
      )
    )
    .orderBy(desc(documentVersions.createdAt))

  // Render read-only view using sectionsSnapshot from latest version
}
```

### Pattern 4: Privacy Enforcement for Consultation Summary (PUB-03)

**What:** Aggregate feedback by section without exposing stakeholder identities. Show counts per feedback type, and only include names when `isAnonymous=false`.
**When to use:** The "Consultation Summary" section of public portal.
**Example:**
```typescript
// Server-side in public portal page
const feedbackRows = await db
  .select({
    sectionId: feedbackItems.sectionId,
    feedbackType: feedbackItems.feedbackType,
    status: feedbackItems.status,
    isAnonymous: feedbackItems.isAnonymous,
    submitterName: users.name,
    orgType: users.orgType,
  })
  .from(feedbackItems)
  .leftJoin(users, eq(feedbackItems.submitterId, users.id))
  .where(
    and(
      eq(feedbackItems.documentId, documentId),
      // Only show resolved/closed feedback in public summary
      inArray(feedbackItems.status, ['accepted', 'partially_accepted', 'rejected', 'closed']),
    )
  )

// Sanitize: null out identities for anonymous items
const sanitized = feedbackRows.map((row) => ({
  ...row,
  submitterName: row.isAnonymous ? null : row.submitterName,
  orgType: row.isAnonymous ? null : row.orgType,
}))
// Aggregate by sectionId + feedbackType for summary table (no individual feedback bodies)
```

### Pattern 5: fflate ZIP Generation in Route Handler

**What:** Build a ZIP in memory using fflate, stream as response. All data is gathered server-side before zipping.
**When to use:** Evidence pack export (AUDIT-05/06).
**Example:**
```typescript
// app/api/export/evidence-pack/route.ts
import { zipSync } from 'fflate'

const files: Record<string, Uint8Array> = {
  'INDEX.md': new TextEncoder().encode(indexMarkdown),
  'stakeholders.csv': new TextEncoder().encode(stakeholdersCsv),
  'feedback-matrix.csv': new TextEncoder().encode(feedbackCsv),
  'version-history.json': new TextEncoder().encode(JSON.stringify(versions, null, 2)),
  'decision-log.json': new TextEncoder().encode(JSON.stringify(decisions, null, 2)),
}

const zipped = zipSync(files, { level: 6 })

return new Response(zipped, {
  headers: {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="evidence-pack-${documentId}.zip"`,
  },
})
```

### Pattern 6: Audit Trail Viewer UI (AUDIT-04)

**What:** Authenticated page at `/audit` (Auditor role), wires directly into existing `auditRouter.list` tRPC query. Filter UI controls entityType, action, actorId, from/to date range. Pagination via limit/offset.
**When to use:** Auditor dashboard "View Full Audit Trail" button (currently disabled in Phase 8 with a stub).
**Example:**
```tsx
// app/(workspace)/audit/page.tsx
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
// Client component child handles tRPC query + filter state
```

### Anti-Patterns to Avoid

- **Using `auth()` on public routes:** Any call to `auth()` from `@clerk/nextjs/server` on a public page will throw if the route is not in `isPublicRoute`. Do not import or call it in public page server components.
- **Using tRPC for public data:** All tRPC procedures use `requirePermission` or `protectedProcedure` which enforce authentication. Public pages MUST use direct Drizzle queries.
- **Exposing feedback.body on public portal:** PUB-05 explicitly forbids raw feedback threads. The public consultation summary MUST be aggregate counts and decisions only — never the feedback body text.
- **Exposing decisionRationale on public portal:** Internal deliberation text (rationale) is not for public consumption. Only show outcome (accepted/rejected) and affected sections.
- **Using archiver or Node.js streams for ZIP:** Next.js Route Handlers run in the Node.js runtime but using streams with `archiver` requires careful handling. `fflate`'s synchronous `zipSync` is simpler, works correctly with the Response constructor, and is sufficient for evidence packs (data is small enough for in-memory assembly).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZIP file assembly | Custom binary packer | `fflate.zipSync` | ZIP format has CRC32, EOCD headers, compression — 100+ edge cases |
| PDF generation | HTML-to-PDF, puppeteer | `@react-pdf/renderer` (already installed) | Already established pattern in Phase 7; consistent styling |
| Privacy filtering | Custom identity scrubber | Inline `isAnonymous` check (same pattern as traceability router) | Pattern already proven in Phase 4, 7 |
| Auth bypass for public routes | Custom session check | `proxy.ts` `createRouteMatcher` (already in use) | Clerk handles this correctly; do not duplicate |

**Key insight:** The hardest work was done in earlier phases — snapshots, audit log, privacy flags, PDF rendering. Phase 9 assembles these building blocks. Avoid any implementation that touches schema or creates new write paths.

---

## Common Pitfalls

### Pitfall 1: params is a Promise in Next.js 16

**What goes wrong:** Accessing `params.documentId` directly in a Server Component throws a synchronous access error.
**Why it happens:** Next.js 16 changed page props — `params` and `searchParams` are now Promises per the breaking-changes guide.
**How to avoid:** Always `const { documentId } = await params` or `const { documentId } = use(params)` in Client Components.
**Warning signs:** Runtime error "params should be awaited" in server logs.

### Pitfall 2: Forgot to whitelist public routes in proxy.ts

**What goes wrong:** Unauthenticated visitors are redirected to `/sign-in` even on public portal pages.
**Why it happens:** `proxy.ts` calls `auth.protect()` for any route not in `isPublicRoute`. The public portal routes `/portal(.*)` are not in the list until explicitly added.
**How to avoid:** Step 1 in the public portal plan must be updating `isPublicRoute` in proxy.ts.
**Warning signs:** 307 redirect to `/sign-in` when visiting `/portal/...` without a session.

### Pitfall 3: tRPC called on public routes

**What goes wrong:** Using `trpc.version.getById.useQuery(...)` from a client component on a public page throws UNAUTHORIZED because tRPC context has no Clerk session.
**Why it happens:** `createTRPCContext` calls `auth()` and tRPC's `protectedProcedure` middleware throws if user is null.
**How to avoid:** Public portal pages use direct Drizzle DB queries in Server Components only. No tRPC client hooks on public pages.
**Warning signs:** UNAUTHORIZED (401) error in browser console on public portal.

### Pitfall 4: sectionsSnapshot content is Tiptap JSON, not plain text

**What goes wrong:** Rendering `sectionsSnapshot[i].content` directly as text shows raw JSON strings.
**Why it happens:** `content` is `Record<string, unknown>` — a Tiptap JSON document node, not a string.
**How to avoid:** For the public portal, build a simple recursive Tiptap JSON-to-text/HTML renderer, or use the read-only Tiptap editor instance (already used in section-content-view.tsx). Reuse `section-content-view.tsx` pattern if possible (but note it may be a client component — check before using in Server Components).
**Warning signs:** `[object Object]` rendering in public portal content areas.

### Pitfall 5: fflate must be installed (not in package.json)

**What goes wrong:** Import `from 'fflate'` throws module not found at build time.
**Why it happens:** `fflate` is not listed in package.json dependencies.
**How to avoid:** Wave 0 task must run `npm install fflate`.
**Warning signs:** Build error "Cannot find module 'fflate'".

### Pitfall 6: Evidence pack missing workshop data (Phase 10 not built yet)

**What goes wrong:** Evidence pack ZIP includes empty/missing "workshop evidence" section, which is misleading for auditors.
**Why it happens:** Workshop module is Phase 10 (pending). No workshop tables exist yet.
**How to avoid:** Evidence pack MUST include an explicit `workshop-evidence.json` with `{ "note": "Workshop module not yet implemented" }` or similar placeholder — do not silently omit. Document in INDEX.md.
**Warning signs:** Auditor opens ZIP expecting workshop evidence and finds nothing.

### Pitfall 7: audit:read permission and evidence-pack export permission

**What goes wrong:** Auditor dashboard "Export Evidence Pack" calls `/api/export/evidence-pack` but the route handler doesn't verify permissions.
**Why it happens:** API Route Handlers bypass tRPC middleware — auth must be checked manually in the handler body.
**How to avoid:** Follow Phase 7 PDF export pattern exactly: call `auth()`, find user in DB, check `can(user.role, 'audit:read')` (or add a new `evidence:export` permission), return 403 on failure.
**Warning signs:** Unauthenticated or non-Auditor user able to download evidence pack.

---

## Code Examples

### Querying published versions (public portal)

```typescript
// Source: version.service.ts + changeRequests schema (Phase 6 codebase)
import { db } from '@/src/db'
import { documentVersions } from '@/src/db/schema/changeRequests'
import { policyDocuments } from '@/src/db/schema/documents'
import { eq, desc, and } from 'drizzle-orm'

// All published versions for a document
const publishedVersions = await db
  .select({
    id: documentVersions.id,
    versionLabel: documentVersions.versionLabel,
    publishedAt: documentVersions.publishedAt,
    mergeSummary: documentVersions.mergeSummary,
    changelog: documentVersions.changelog,
    sectionsSnapshot: documentVersions.sectionsSnapshot,
  })
  .from(documentVersions)
  .where(
    and(
      eq(documentVersions.documentId, documentId),
      eq(documentVersions.isPublished, true),
    )
  )
  .orderBy(desc(documentVersions.publishedAt))
```

### Sanitized consultation summary query

```typescript
// Source: traceability.ts anonymity pattern (Phase 7 codebase)
import { feedbackItems } from '@/src/db/schema/feedback'
import { users } from '@/src/db/schema/users'
import { policySections } from '@/src/db/schema/documents'
import { eq, and, inArray } from 'drizzle-orm'

const summary = await db
  .select({
    sectionId: feedbackItems.sectionId,
    sectionTitle: policySections.title,
    feedbackType: feedbackItems.feedbackType,
    status: feedbackItems.status,
    isAnonymous: feedbackItems.isAnonymous,
    orgType: users.orgType,
  })
  .from(feedbackItems)
  .leftJoin(users, eq(feedbackItems.submitterId, users.id))
  .leftJoin(policySections, eq(feedbackItems.sectionId, policySections.id))
  .where(
    and(
      eq(feedbackItems.documentId, documentId),
      inArray(feedbackItems.status, ['accepted', 'partially_accepted', 'rejected', 'closed']),
    )
  )

// Sanitize and group — never expose feedbackItems.body or feedbackItems.title
const sanitized = summary.map((row) => ({
  sectionId: row.sectionId,
  sectionTitle: row.sectionTitle,
  feedbackType: row.feedbackType,
  status: row.status,
  orgType: row.isAnonymous ? null : row.orgType,
}))
```

### Evidence pack ZIP generation

```typescript
// Source: fflate docs (https://github.com/101arrowz/fflate) — to be installed
import { zipSync } from 'fflate'
import { auth } from '@clerk/nextjs/server'
import { can } from '@/src/lib/permissions'
import type { Role } from '@/src/lib/constants'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })

  const user = await db.query.users.findFirst({ where: eq(users.clerkId, userId) })
  if (!user || !can(user.role as Role, 'audit:read')) {
    return new Response('Forbidden', { status: 403 })
  }

  const documentId = request.nextUrl.searchParams.get('documentId')
  // ... gather all evidence data ...

  const encoder = new TextEncoder()
  const pack: Record<string, Uint8Array> = {
    'INDEX.md': encoder.encode(buildIndexMarkdown()),
    'stakeholders.csv': encoder.encode(buildStakeholdersCsv(stakeholders)),
    'feedback-matrix.csv': encoder.encode(buildFeedbackCsv(feedbackRows)),
    'version-history.json': encoder.encode(JSON.stringify(versions, null, 2)),
    'decision-log.json': encoder.encode(JSON.stringify(decisions, null, 2)),
    'workshop-evidence.json': encoder.encode(JSON.stringify({
      note: 'Workshop module is pending (Phase 10). No workshop data available at this time.',
    }, null, 2)),
  }

  const zipped = zipSync(pack, { level: 6 })

  await writeAuditLog({
    actorId: user.id,
    actorRole: user.role,
    action: 'evidence_pack.export',
    entityType: 'document',
    entityId: documentId ?? '',
    payload: { format: 'zip' },
  })

  return new Response(zipped, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="evidence-pack-${documentId}.zip"`,
    },
  })
}
```

### Audit trail tRPC query (existing — use as-is)

```typescript
// Source: src/server/routers/audit.ts (Phase 1 codebase)
// auditRouter.list already supports:
//   entityType, actorId, action, from (datetime), to (datetime), limit, offset
// Use from client component:
const auditQuery = trpc.audit.list.useQuery({
  entityType: filter.entityType,
  action: filter.action,
  from: filter.from,
  to: filter.to,
  limit: 50,
  offset: page * 50,
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `middleware.ts` | `proxy.ts` | Next.js 16 | Middleware renamed to Proxy; same Clerk API, just the file name changed |
| `params` as sync object | `params` as `Promise<{...}>` | Next.js 15+ | Must `await params` in Server Components; use `use(params)` in Client Components |
| `jszip` for ZIP | `fflate` | ~2022 | fflate is smaller, faster, ESM-native, works in all Next.js runtimes |

**Deprecated/outdated:**
- `middleware.ts` filename: project already uses `proxy.ts` (Next.js 16 convention). Do not create `middleware.ts`.
- `publicProcedure` in application routers: Phase 1 decision states "no publicProcedure in application routers." Public portal data must be fetched via direct DB queries.

---

## Environment Availability

Step 2.6: SKIPPED for most dependencies — all core libraries (drizzle-orm, @react-pdf/renderer, papaparse) are already installed and confirmed in package.json.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| @react-pdf/renderer | PUB-04 PDF export | Yes | 4.3.0 | — |
| fflate | AUDIT-06 ZIP | No (not installed) | — | Wave 0: `npm install fflate` |
| drizzle-orm | Public DB queries | Yes | 0.45.1 | — |
| papaparse | CSV in evidence pack | Yes | 5.5.2 | — |

**Missing dependencies with no fallback:**
- `fflate` — must be installed before evidence pack route can be implemented. Wave 0 task.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.mts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PUB-01 | Public route accessible without auth (no redirect) | manual | — (browser test) | — |
| PUB-02 | Changelog renders from `changelog` JSONB column | unit | `npm test -- --grep "public changelog"` | Wave 0 |
| PUB-03 | Anonymous feedback names nulled out in summary | unit | `npm test -- --grep "sanitized summary"` | Wave 0 |
| PUB-04 | PDF export returns 200 with content-type application/pdf | manual | — (file download test) | — |
| PUB-05 | No feedback.body or submitter identities in public response | unit | `npm test -- --grep "public portal privacy"` | Wave 0 |
| AUDIT-04 | auditRouter.list returns filtered results | unit (existing router test pattern) | `npm test` | Wave 0 |
| AUDIT-05 | Evidence pack includes all 5 artifact types | unit | `npm test -- --grep "evidence pack"` | Wave 0 |
| AUDIT-06 | evidence-pack.service returns valid zip bytes | unit | `npm test -- --grep "evidence pack"` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/public-portal.test.ts` — covers PUB-03 (sanitized summary logic), PUB-05 (privacy enforcement)
- [ ] `src/__tests__/evidence-pack.test.ts` — covers AUDIT-05/06 (ZIP structure, all artifacts present, auth enforcement)
- [ ] Install fflate: `npm install fflate` — required before evidence-pack tests can import it

---

## Existing Code: Key Facts for Planner

These are confirmed facts about existing code the planner must know to write correct tasks:

### Version data shape (Phase 6)
- `documentVersions.isPublished: boolean` — flag set by `publishVersion()` service
- `documentVersions.sectionsSnapshot: SectionSnapshot[] | null` — full section content at publish time
- `documentVersions.changelog: ChangelogEntry[] | null` — CR IDs, feedback IDs, summary text
- `documentVersions.publishedAt: timestamp | null`

### Audit log schema (Phase 1)
- Table: `audit_events` — partitioned by range on `timestamp`
- Columns: `id, timestamp, actorId, actorRole, action, entityType, entityId, payload, ipAddress`
- Existing router: `auditRouter.list` with filters: `entityType, actorId, action, from, to, limit, offset`
- Permission: `audit:read` — granted to `admin`, `auditor` only

### Privacy enforcement pattern (Phase 4 + 7)
- `feedbackItems.isAnonymous: boolean` — per-feedback flag
- Anonymity check: `if (row.isAnonymous) { row.submitterName = null; row.orgType = null }`
- Public portal must apply this unconditionally (no privileged role can see identities on public routes)

### PDF export pattern (Phase 7)
- Route handler: `app/api/export/traceability/pdf/route.ts`
- Pattern: `auth()` check → permission check via `can()` → DB query → `renderToBuffer` from `@react-pdf/renderer` → `new Response(buffer, { headers })`
- Dynamic import used: `const { renderToBuffer } = await import('@react-pdf/renderer')`
- Audit log written after export

### proxy.ts (Next.js 16 — NOT middleware.ts)
- File: `proxy.ts` at project root (Next.js 16 renamed middleware to proxy)
- Current public routes: `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/webhooks(.*)`
- Must add `/portal(.*)` and `/api/export/policy-pdf(.*)` (public PDF export, if unauthenticated access needed)

### ACTIONS constants (Phase 1)
- `src/lib/constants.ts` exports `ACTIONS` object
- New actions needed: `EVIDENCE_PACK_EXPORT: 'evidence_pack.export'` — add to constants before use

### Auditor dashboard stub (Phase 8)
- `app/(workspace)/dashboard/_components/auditor-dashboard.tsx` has "View Full Audit Trail" button that is `disabled`
- Phase 9 must: (1) create `/audit` page, (2) enable the button by adding `href="/audit"` (or tRPC link)

---

## Open Questions

1. **Public portal URL scheme: `/portal/[documentId]` vs `/public/[documentId]`**
   - What we know: CONTEXT.md says "separate route group (no auth required)". No specific URL prescribed.
   - What's unclear: Whether to use `/portal` or `/public` as the URL prefix.
   - Recommendation: Use `/portal` — it's more meaningful to external stakeholders than `/public` which sounds like a file system concept.

2. **Public PDF export: authenticated or unauthenticated?**
   - What we know: PUB-04 says "PDF export of published policy versions." Public portal is no-auth.
   - What's unclear: Should the PDF download require login or be fully public?
   - Recommendation: Make it fully public (no auth) — consistent with the portal's public nature and PDF is just a formatted version of already-public content. Add the route to `isPublicRoute` in proxy.ts.

3. **Evidence pack scope: per-document or workspace-wide?**
   - What we know: AUDIT-05 says "stakeholder list, feedback matrix, version history, workshop evidence, decision logs." No scope specified.
   - What's unclear: Is this per document (documentId query param) or all documents in the workspace?
   - Recommendation: Per-document, taking `documentId` as a required query parameter. Matches traceability export pattern from Phase 7.

---

## Sources

### Primary (HIGH confidence)
- Project codebase (direct read) — all version schema, audit schema, privacy patterns, proxy.ts, PDF export route
- `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md` — route groups, proxy convention
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` — Route Handler patterns
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` — proxy.ts (Next.js 16 middleware rename)

### Secondary (MEDIUM confidence)
- fflate npm package (not yet installed) — ESM-native ZIP library; confirmed via package ecosystem knowledge that it works in Next.js Route Handlers without native deps. Verify version with `npm view fflate version` before install.

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries except fflate are already installed and in use
- Architecture: HIGH — patterns are direct extensions of Phase 6, 7, 8 work; confirmed from codebase
- Pitfalls: HIGH — all identified from actual codebase decisions (proxy.ts pattern, tRPC auth, params-as-promise)
- fflate choice: MEDIUM — confirmed as correct class of solution; verify version before install

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (30 days — stable Next.js 16 APIs)
