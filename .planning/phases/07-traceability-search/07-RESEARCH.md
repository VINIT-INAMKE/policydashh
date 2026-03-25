# Phase 7: Traceability & Search - Research

**Researched:** 2026-03-25
**Domain:** PostgreSQL JOIN queries, full-text search (ILIKE/tsvector), CSV/PDF export, tRPC data layer, Next.js App Router
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting.

Key constraints from prior phases:
- FB → CR links in cr_feedback_links table (Phase 5)
- CR → Section links in cr_section_links table (Phase 5)
- CR → Version via mergedVersionId (Phase 5)
- Feedback → Version via resolvedInVersionId (Phase 5)
- All data needed for traceability chain already exists in the database

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRACE-01 | Full traceability chain: Feedback -> Change Request -> Section -> Version | JOIN query pattern documented in §Architecture Patterns |
| TRACE-02 | Traceability matrix view: grid of FB -> CR -> Section -> Version with decision rationale | Matrix tRPC procedure design documented; UI data shape defined |
| TRACE-03 | Filter traceability by stakeholder org type, section, decision outcome, version range | Drizzle dynamic WHERE conditions; nuqs not installed, use useState + URL search params |
| TRACE-04 | Per-section "What changed and why" view showing feedback that drove changes | Reverse join from sections; leverages existing crSectionLinks + crFeedbackLinks |
| TRACE-05 | Per-stakeholder "Your feedback outcomes" view showing how each feedback item was handled | listOwn + resolvedInVersionId already on feedback row |
| TRACE-06 | Export traceability matrix as CSV and PDF | papaparse (not installed) for CSV; @react-pdf/renderer (not installed) for PDF; both need npm install |
| SRCH-01 | Filter feedback by section, stakeholder type, priority, status, impact category, feedback type | Already partially implemented in feedback.list — needs org type filter added |
| SRCH-02 | Full-text search across feedback content | ILIKE on title+body; tsvector for v2 upgrade path documented |
| SRCH-03 | Search policy document content across sections | ILIKE on policySections.title + JSONB text extraction |
| SRCH-04 | Filter CRs by status, section, linked feedback | Already partially implemented in changeRequest.list — needs feedback text search |
</phase_requirements>

---

## Summary

Phase 7 is a pure **query layer + UI layer** phase. All underlying data is already stored from Phases 4-6. The traceability chain is: `feedback` → `cr_feedback_links` → `change_requests` → `document_versions`, with `cr_section_links` linking CRs to `policy_sections`, and `feedback.resolved_in_version_id` providing a direct FB→Version shortcut.

The main technical work is: (1) writing a complex multi-table JOIN query that assembles the full chain into a flat matrix shape suitable for a grid UI, (2) adding ILIKE-based full-text search to the feedback and section routers, (3) server-side CSV generation (papaparse, not yet installed) and PDF generation (@react-pdf/renderer, not yet installed) via dedicated Next.js Route Handlers, and (4) building the three view types: matrix, per-section, and per-stakeholder.

The existing `feedback.list` procedure already handles most of SRCH-01 (filter by section, priority, status, feedbackType, impactCategory) but is missing the `orgType` filter. The existing `changeRequest.list` handles SRCH-04 filtering but lacks feedback text search. This phase completes both gaps and adds new `traceability` router procedures.

**Primary recommendation:** Add a new `traceabilityRouter` for the matrix/chain queries, extend existing routers for search gaps, add two Route Handlers for export (`/api/export/traceability/csv` and `/api/export/traceability/pdf`), and build the traceability UI under `app/(workspace)/policies/[id]/traceability/`.

---

## Project Constraints (from CLAUDE.md)

The project uses `@AGENTS.md` which states: "This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."

Verified from installed code:
- Next.js 16.2.1 (confirmed in package.json)
- App Router with `(workspace)` route group
- `'use client'` directive on all interactive pages (all existing pages are client components)
- tRPC v11 patterns: `trpc.router.procedure.useQuery()` and `.useMutation()`
- No Server Components in app pages — all existing pages are `'use client'`
- Default exports on page files
- Drizzle ORM 0.45.1 with Neon serverless driver
- Zod v4 (package.json shows `^4.3.6`) — use `z.record(z.string(), z.unknown())` not `z.record(z.unknown())`
- `requirePermission` middleware pattern for all tRPC procedures (no publicProcedure in application routers)
- Audit log written after every mutation via `writeAuditLog`
- base-ui primitives, not Radix — `@base-ui/react ^1.3.0`
- shadcn/ui v4 component pattern (components in `components/ui/`)
- `use-debounce` is installed (v10.1.0) — use this for search debounce, not a custom hook

---

## Database Schema — Confirmed Join Paths

Read directly from codebase source files.

### Tables in scope

```
feedback (feedback)
  id, readable_id, section_id, document_id, submitter_id
  feedback_type, priority, impact_category, title, body, suggested_change
  status, is_anonymous, decision_rationale, reviewed_by, reviewed_at
  resolved_in_version_id  ← direct FK to document_versions

cr_feedback_links
  cr_id → change_requests.id
  feedback_id → feedback.id

change_requests
  id, readable_id, document_id, owner_id, title, description, status
  merged_version_id → document_versions.id

cr_section_links
  cr_id → change_requests.id
  section_id → policy_sections.id

document_versions
  id, document_id, version_label, merge_summary, created_by
  cr_id → change_requests.id (reverse FK)
  sections_snapshot (JSONB), changelog (JSONB)
  is_published, published_at

policy_sections
  id, document_id, title, order_index, content (JSONB)

users
  id, name, org_type, role, is_anonymous
```

### The full traceability chain in SQL terms

```
feedback
  JOIN cr_feedback_links ON feedback.id = cr_feedback_links.feedback_id
  JOIN change_requests   ON cr_feedback_links.cr_id = change_requests.id
  LEFT JOIN document_versions ON change_requests.merged_version_id = document_versions.id
  LEFT JOIN cr_section_links  ON change_requests.id = cr_section_links.cr_id
  LEFT JOIN policy_sections   ON cr_section_links.section_id = policy_sections.id
  LEFT JOIN users             ON feedback.submitter_id = users.id
WHERE feedback.document_id = $documentId
```

This yields one row per (feedback, CR, section) combination. Flatten in application layer to produce matrix cells.

### Per-section reverse path

```
policy_sections
  JOIN cr_section_links  ON policy_sections.id = cr_section_links.section_id
  JOIN change_requests   ON cr_section_links.cr_id = change_requests.id
  JOIN cr_feedback_links ON change_requests.id = cr_feedback_links.cr_id
  JOIN feedback          ON cr_feedback_links.feedback_id = feedback.id
  LEFT JOIN document_versions ON change_requests.merged_version_id = document_versions.id
WHERE policy_sections.id = $sectionId
```

### Per-stakeholder path (TRACE-05)

The stakeholder path is simpler: `feedback.submitter_id = $userId` with `LEFT JOIN document_versions ON feedback.resolved_in_version_id = document_versions.id`. The `resolved_in_version_id` on feedback rows was set during `mergeCR` (Phase 5), so each feedback item directly points to the version it influenced.

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| drizzle-orm | 0.45.1 | ORM / query builder for JOIN queries | Installed |
| @trpc/server + @trpc/react-query | 11.15.0 | tRPC v11 procedure layer | Installed |
| zod | 4.3.6 | Input validation on new procedures | Installed |
| use-debounce | 10.1.0 | Debounce search input (already installed) | Installed |
| date-fns | 4.1.0 | Format dates in export and UI | Installed |

### New dependencies required for TRACE-06 (not installed)
| Library | Version | Purpose | Install Command |
|---------|---------|---------|-----------------|
| papaparse | 5.x | CSV generation server-side | `npm install papaparse` |
| @types/papaparse | 5.x | TypeScript types | `npm install -D @types/papaparse` |
| @react-pdf/renderer | 4.x | PDF generation in Route Handler | `npm install @react-pdf/renderer` |

**Version verification needed at install time:** Run `npm view papaparse version` and `npm view @react-pdf/renderer version` before installation. Training data suggests 5.x and 4.3.x respectively but these should be confirmed.

### nuqs not installed — filter state pattern

`nuqs` is in STACK.md recommendations but is NOT installed (`node_modules/nuqs` does not exist). For Phase 7, use `useState` for local filter state. URL-based filter state can be deferred. The existing filter panels (e.g., `feedback/filter-panel.tsx`) use `useState` — follow that pattern.

---

## Architecture Patterns

### Recommended Project Structure for Phase 7

```
src/server/routers/
├── traceability.ts          # NEW: matrix, sectionChain, stakeholderOutcomes, search
app/(workspace)/policies/[id]/
├── traceability/
│   ├── page.tsx             # NEW: traceability hub with tabs
│   └── _components/
│       ├── matrix-table.tsx         # FB → CR → Section → Version grid
│       ├── matrix-filter-panel.tsx  # org type, section, decision, version range
│       ├── section-chain-view.tsx   # per-section "what changed and why"
│       ├── stakeholder-outcomes.tsx # per-stakeholder outcomes (own feedback only)
│       └── export-actions.tsx       # CSV and PDF download buttons
app/api/export/
├── traceability/
│   ├── csv/
│   │   └── route.ts         # NEW: GET handler, streams CSV
│   └── pdf/
│       └── route.ts         # NEW: GET handler, streams PDF
```

### Pattern 1: Traceability Matrix tRPC Procedure

The matrix query returns one flat row per (feedback × section) combination. The client groups by feedback.readableId to merge multiple section columns.

```typescript
// src/server/routers/traceability.ts
import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { db } from '@/src/db'
import { feedbackItems } from '@/src/db/schema/feedback'
import { changeRequests, crFeedbackLinks, crSectionLinks, documentVersions } from '@/src/db/schema/changeRequests'
import { policySections } from '@/src/db/schema/documents'
import { users } from '@/src/db/schema/users'
import { eq, and, inArray, gte, lte, ilike, or } from 'drizzle-orm'

export const traceabilityRouter = router({
  // Full matrix query: FB → CR → Section → Version
  matrix: requirePermission('trace:read')
    .input(z.object({
      documentId: z.string().uuid(),
      sectionId: z.string().uuid().optional(),
      orgType: z.enum(['government', 'industry', 'legal', 'academia', 'civil_society', 'internal']).optional(),
      decisionOutcome: z.enum(['accepted', 'partially_accepted', 'rejected']).optional(),
      versionId: z.string().uuid().optional(),
    }))
    .query(async ({ input }) => {
      // Build conditions array
      const conditions = [eq(feedbackItems.documentId, input.documentId)]
      if (input.decisionOutcome) conditions.push(eq(feedbackItems.status, input.decisionOutcome))
      if (input.orgType) {
        // join users to filter by org_type
      }

      // Execute multi-join query
      const rows = await db
        .select({
          feedbackId: feedbackItems.id,
          feedbackReadableId: feedbackItems.readableId,
          feedbackTitle: feedbackItems.title,
          feedbackStatus: feedbackItems.status,
          feedbackDecisionRationale: feedbackItems.decisionRationale,
          feedbackIsAnonymous: feedbackItems.isAnonymous,
          submitterName: users.name,
          submitterOrgType: users.orgType,
          crId: changeRequests.id,
          crReadableId: changeRequests.readableId,
          crTitle: changeRequests.title,
          crStatus: changeRequests.status,
          sectionId: policySections.id,
          sectionTitle: policySections.title,
          versionId: documentVersions.id,
          versionLabel: documentVersions.versionLabel,
        })
        .from(feedbackItems)
        .innerJoin(crFeedbackLinks, eq(feedbackItems.id, crFeedbackLinks.feedbackId))
        .innerJoin(changeRequests, eq(crFeedbackLinks.crId, changeRequests.id))
        .leftJoin(documentVersions, eq(changeRequests.mergedVersionId, documentVersions.id))
        .leftJoin(crSectionLinks, eq(changeRequests.id, crSectionLinks.crId))
        .leftJoin(policySections, eq(crSectionLinks.sectionId, policySections.id))
        .leftJoin(users, eq(feedbackItems.submitterId, users.id))
        .where(and(...conditions))

      return rows
    }),

  // Per-section: what feedback drove changes to this section
  sectionChain: requirePermission('trace:read')
    .input(z.object({ sectionId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select({
          sectionId: policySections.id,
          sectionTitle: policySections.title,
          crId: changeRequests.id,
          crReadableId: changeRequests.readableId,
          crTitle: changeRequests.title,
          crStatus: changeRequests.status,
          feedbackId: feedbackItems.id,
          feedbackReadableId: feedbackItems.readableId,
          feedbackTitle: feedbackItems.title,
          feedbackStatus: feedbackItems.status,
          feedbackDecisionRationale: feedbackItems.decisionRationale,
          versionLabel: documentVersions.versionLabel,
        })
        .from(policySections)
        .innerJoin(crSectionLinks, eq(policySections.id, crSectionLinks.sectionId))
        .innerJoin(changeRequests, eq(crSectionLinks.crId, changeRequests.id))
        .innerJoin(crFeedbackLinks, eq(changeRequests.id, crFeedbackLinks.crId))
        .innerJoin(feedbackItems, eq(crFeedbackLinks.feedbackId, feedbackItems.id))
        .leftJoin(documentVersions, eq(changeRequests.mergedVersionId, documentVersions.id))
        .where(eq(policySections.id, input.sectionId))

      return rows
    }),
})
```

**Key insight on permissions:** Add `trace:read` permission to the PERMISSIONS map in `src/lib/permissions.ts`. Allowed roles: admin, policy_lead, auditor (read all), plus stakeholder (own feedback outcomes only via a separate `stakeholderOutcomes` procedure guarded by `feedback:read_own`).

### Pattern 2: Per-Stakeholder Outcomes (TRACE-05)

The stakeholder outcomes query is simpler because `feedback.resolved_in_version_id` is a direct FK:

```typescript
// In traceabilityRouter:
stakeholderOutcomes: requirePermission('feedback:read_own')
  .query(async ({ ctx }) => {
    const rows = await db
      .select({
        feedbackId: feedbackItems.id,
        readableId: feedbackItems.readableId,
        title: feedbackItems.title,
        status: feedbackItems.status,
        decisionRationale: feedbackItems.decisionRationale,
        resolvedInVersionId: feedbackItems.resolvedInVersionId,
        versionLabel: documentVersions.versionLabel,
        sectionId: feedbackItems.sectionId,
        sectionTitle: policySections.title,
      })
      .from(feedbackItems)
      .leftJoin(documentVersions, eq(feedbackItems.resolvedInVersionId, documentVersions.id))
      .leftJoin(policySections, eq(feedbackItems.sectionId, policySections.id))
      .where(eq(feedbackItems.submitterId, ctx.user.id))

    return rows
  }),
```

This query does NOT require the full chain join — it uses the denormalized `resolved_in_version_id` field that was populated during Phase 5's `mergeCR`.

### Pattern 3: Full-Text Search (SRCH-02, SRCH-03)

Use `ilike` from drizzle-orm for v1. The `ilike` operator maps to PostgreSQL `ILIKE` (case-insensitive LIKE). For multi-column search, use `or(ilike(...), ilike(...))`.

```typescript
// src/server/routers/traceability.ts (or extend feedback.ts)
import { ilike, or } from 'drizzle-orm'

// Feedback full-text search
searchFeedback: requirePermission('feedback:read_all')
  .input(z.object({
    documentId: z.string().uuid(),
    query: z.string().min(1).max(200),
  }))
  .query(async ({ input }) => {
    const term = `%${input.query}%`
    return db
      .select({ /* same shape as feedback.list */ })
      .from(feedbackItems)
      .leftJoin(users, eq(feedbackItems.submitterId, users.id))
      .where(
        and(
          eq(feedbackItems.documentId, input.documentId),
          or(
            ilike(feedbackItems.title, term),
            ilike(feedbackItems.body, term),
          ),
        ),
      )
  }),

// Policy section content search — SRCH-03
// Note: policySections.content is JSONB. For v1, search only section.title.
// Full JSONB text extraction requires sql`` template literal or tsvector migration.
searchSections: requirePermission('document:read')
  .input(z.object({
    documentId: z.string().uuid(),
    query: z.string().min(1).max(200),
  }))
  .query(async ({ input }) => {
    const term = `%${input.query}%`
    return db
      .select({
        id: policySections.id,
        title: policySections.title,
        orderIndex: policySections.orderIndex,
      })
      .from(policySections)
      .where(
        and(
          eq(policySections.documentId, input.documentId),
          ilike(policySections.title, term),
        ),
      )
  }),
```

**SRCH-03 important limitation:** `policySections.content` is JSONB (Tiptap block JSON). Searching text inside JSONB with ILIKE requires either: (a) extracting text with `sql\`${policySections.content}::text\`` cast and then ILIKE, or (b) building a tsvector index. For v1, search section titles only. Document this limitation in the plan.

### Pattern 4: CSV Export via Route Handler

Use a Next.js Route Handler (not tRPC) for file downloads. The handler fetches data server-side via direct DB call (bypassing tRPC), generates CSV with papaparse, and streams it with `Content-Disposition: attachment`.

```typescript
// app/api/export/traceability/csv/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/src/db'
import Papa from 'papaparse'
// ... imports

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const documentId = searchParams.get('documentId')
  if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 })

  // Fetch traceability matrix data directly from DB
  const rows = await /* same JOIN query as traceability.matrix */ ...

  // Shape for CSV: one row per (feedback, CR, section, version)
  const csvData = rows.map((row) => ({
    'Feedback ID': row.feedbackReadableId,
    'Feedback Title': row.feedbackTitle,
    'Feedback Status': row.feedbackStatus,
    'Decision Rationale': row.feedbackDecisionRationale ?? '',
    'Org Type': row.submitterOrgType ?? '',
    'CR ID': row.crReadableId ?? '',
    'CR Title': row.crTitle ?? '',
    'CR Status': row.crStatus ?? '',
    'Affected Section': row.sectionTitle ?? '',
    'Version': row.versionLabel ?? 'Not merged',
  }))

  const csv = Papa.unparse(csvData)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="traceability-${documentId}.csv"`,
    },
  })
}
```

**Auth in Route Handlers:** Use `auth()` from `@clerk/nextjs/server` then look up the user in DB with the clerkId — same pattern as `createTRPCContext` in `src/trpc/init.ts`.

### Pattern 5: PDF Export via Route Handler

`@react-pdf/renderer` v4 has known SSR/App Router quirks. Use a Route Handler (not a Server Component). The PDF is generated server-side and streamed as a binary response.

```typescript
// app/api/export/traceability/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { TraceabilityPDF } from './_components/traceability-pdf' // React component

export async function GET(request: NextRequest) {
  // ... auth + data fetch ...

  const buffer = await renderToBuffer(<TraceabilityPDF rows={rows} />)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="traceability.pdf"`,
    },
  })
}
```

**IMPORTANT:** `@react-pdf/renderer` requires JSX. The Route Handler file must include `// @ts-expect-error` or use `.tsx` extension. The `renderToBuffer` function is the correct server-side API (not `ReactPDF.render`). React PDF components use a separate set of primitives (`View`, `Text`, `Document`, `Page`) — not HTML.

### Pattern 6: Extending existing feedback.list for SRCH-01 orgType filter

`feedback.list` already filters by sectionId, status, feedbackType, priority, impactCategory. It does a `leftJoin(users, ...)` and returns `submitterOrgType`. Adding orgType filter is straightforward:

```typescript
// In feedback.list query, add to input schema:
orgType: z.enum([...ORG_TYPES]).optional(),

// In conditions array:
if (input.orgType) conditions.push(eq(users.orgType, input.orgType))
// NOTE: users is already joined via leftJoin — this works
```

### UI Pattern: Three-Tab Traceability Page

Following the existing page pattern (all `'use client'`, `trpc.router.procedure.useQuery()`):

```
/policies/[id]/traceability/page.tsx
  - Tab 1: "Matrix" (TRACE-02, TRACE-03) — full FB→CR→Section→Version grid
  - Tab 2: "By Section" (TRACE-04) — section selector → feedback chain
  - Tab 3: "My Outcomes" (TRACE-05) — stakeholder's own feedback outcomes
  - Export buttons: CSV Download, PDF Download (TRACE-06)
```

The workspace nav in `app/(workspace)/_components/workspace-nav.tsx` should get a "Traceability" link added alongside Feedback, Change Requests, Versions.

### Anti-Patterns to Avoid

- **Fetching matrix data client-side without pagination:** The matrix could have hundreds of rows (many feedback items × sections). Do not load all rows at once without a `limit` input on the tRPC procedure. Plan a `limit: 100` default with a "load more" or pagination.
- **Building custom CSV serializer:** Use papaparse — it handles quoting, escaping commas in cell values, and BOM markers for Excel compatibility.
- **Using React Server Components for export route:** Route Handlers are the correct primitive for streaming binary responses (PDF/CSV) in Next.js App Router.
- **Calling tRPC from a Route Handler:** Route Handlers should call the service/DB layer directly, not via tRPC HTTP. Import DB and schema directly.
- **`@react-pdf/renderer` in a Server Component:** It does not support the React Server Component model. Use only in Route Handlers with `renderToBuffer`.
- **Forgetting anonymity enforcement in matrix:** The `feedback.list` procedure already handles anonymity. The `traceability.matrix` procedure MUST replicate this logic: null out `submitterName`/`submitterOrgType` for `isAnonymous === true` items unless caller is admin/policy_lead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV generation | Manual string concatenation | papaparse `unparse()` | Cell values can contain commas, quotes, newlines — hand-rolling breaks on policy text |
| PDF layout | HTML→PDF via puppeteer | @react-pdf/renderer | No browser needed, works in serverless, declarative component API |
| Search debouncing | Custom setTimeout hook | `useDebounce` from `use-debounce` (already installed) | Already in project, handles cleanup, supports leading/trailing options |
| Traceability chain assembly | Nested queries with N+1 problem | Single Drizzle JOIN query | N+1 would be O(feedbackCount × crCount) round trips |
| Filter state in URL | Custom URLSearchParams management | nuqs (or simpler: useState) | nuqs is not installed; useState is sufficient for Phase 7 scope |

---

## Common Pitfalls

### Pitfall 1: Circular Join Explosion (Matrix N×M rows)

**What goes wrong:** The JOIN of feedback × CR × section produces N×M rows where N=feedback count and M=sections per CR. A CR linked to 3 sections and 5 feedback items produces 15 rows (3×5). The client must group these correctly.

**Why it happens:** Relational JOINs denormalize the data. crSectionLinks and crFeedbackLinks both join to change_requests, producing a Cartesian product of sections × feedback per CR.

**How to avoid:** In the tRPC matrix procedure, group by `crId` client-side and collect `sectionTitle` and `feedbackTitle` into arrays. Alternatively, use two separate queries: (1) get CRs for the document, (2) for each CR get its linked feedback and sections. The two-query approach is O(1 + N) vs O(N×M) rows but requires client aggregation.

**Recommended approach:** Use the single JOIN but add GROUP BY + array aggregation in SQL. In Drizzle, use `sql<string[]>\`ARRAY_AGG(DISTINCT ${policySections.title})\`` pattern. This avoids the Cartesian product entirely.

### Pitfall 2: JSONB Content Search Hits Raw JSON Syntax

**What goes wrong:** Casting Tiptap JSONB content to text and running ILIKE on it matches JSON syntax tokens like `"type":"paragraph"` and `"content"`, producing false positives.

**Why it happens:** The JSONB is Tiptap block structure, not flat text. A search for "content" would match every single block.

**How to avoid:** For SRCH-03, only search `policySections.title` in v1. If full block content search is needed, build a `content_text` generated column (PostgreSQL) that extracts text nodes from the Tiptap JSON. This is a separate migration and should be noted as a follow-up.

### Pitfall 3: @react-pdf/renderer JSX in Route Handler

**What goes wrong:** `renderToBuffer` in a `.ts` file fails because JSX is not compiled.

**Why it happens:** Route Handlers are `.ts` files by default and TypeScript won't compile JSX without the `.tsx` extension.

**How to avoid:** Name the Route Handler file `route.tsx` not `route.ts`. The PDF layout components go in a sibling `_document/traceability-pdf.tsx` file. This is a known pattern for PDF exports in Next.js App Router.

### Pitfall 4: Missing `trace:read` Permission → FORBIDDEN on New Router

**What goes wrong:** Calling `traceability.matrix` throws FORBIDDEN because `trace:read` is not in `src/lib/permissions.ts`.

**Why it happens:** The permissions map uses default-deny. Any new permission key must be explicitly added.

**How to avoid:** Add to PERMISSIONS map BEFORE implementing the router:
```typescript
'trace:read':  [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.AUDITOR] as readonly Role[],
'trace:export': [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.AUDITOR] as readonly Role[],
```
The `stakeholderOutcomes` procedure uses the existing `feedback:read_own` permission — no new permission needed.

### Pitfall 5: Auth Check in Route Handler vs tRPC Middleware

**What goes wrong:** Route Handlers for CSV/PDF export bypass the tRPC permission middleware. An unauthenticated GET request to `/api/export/traceability/csv?documentId=...` returns 200 with data.

**Why it happens:** Route Handlers are plain Next.js handlers — tRPC middleware doesn't apply.

**How to avoid:** Always call `auth()` from `@clerk/nextjs/server` at the top of Route Handlers, check `userId`, then look up the user role in DB and verify `can(user.role, 'trace:export')`.

### Pitfall 6: feedback.resolvedInVersionId is nullable and not in Drizzle FK

**What goes wrong:** Drizzle type inference shows `resolvedInVersionId` as `string | null` (correct) but the join `eq(feedbackItems.resolvedInVersionId, documentVersions.id)` may produce unexpected results if `resolvedInVersionId` is null.

**Why it happens:** Null equality in SQL — `null = anything` is `null` (false), not an error. Use `leftJoin` not `innerJoin` for this relationship.

**How to avoid:** Always `leftJoin(documentVersions, eq(feedbackItems.resolvedInVersionId, documentVersions.id))` in stakeholder outcomes query. This is already the correct approach in the code example above.

---

## Code Examples

### Verified: Drizzle JOIN pattern from existing codebase

```typescript
// From src/server/services/version.service.ts (Phase 6)
// buildChangelog function — shows innerJoin with crFeedbackLinks
const linkedFeedback = await txOrDb
  .select({
    feedbackId: crFeedbackLinks.feedbackId,
    readableId: feedbackItems.readableId,
  })
  .from(crFeedbackLinks)
  .innerJoin(feedbackItems, eq(crFeedbackLinks.feedbackId, feedbackItems.id))
  .where(eq(crFeedbackLinks.crId, crId))
```

### Verified: ILIKE usage in Drizzle 0.45.x

`ilike` is exported from `drizzle-orm` alongside `eq`, `and`, `or`, `desc`, `asc`. Confirmed in `feedback.ts` which already imports from `'drizzle-orm'`:

```typescript
import { eq, and, desc, asc, sql, ilike, or } from 'drizzle-orm'

// Usage:
.where(or(ilike(feedbackItems.title, '%search%'), ilike(feedbackItems.body, '%search%')))
```

### Verified: tRPC router registration pattern

```typescript
// From src/server/routers/_app.ts — add new router:
import { traceabilityRouter } from './traceability'

export const appRouter = router({
  // ... existing routers ...
  traceability: traceabilityRouter,
})
```

### Verified: permissions.ts extension pattern

```typescript
// From src/lib/permissions.ts — add at bottom of PERMISSIONS object:
// Traceability (Phase 7)
'trace:read':   [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.AUDITOR] as readonly Role[],
'trace:export': [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.AUDITOR] as readonly Role[],
```

### Verified: Client component pattern from versions page

```typescript
// All pages are 'use client' + useParams + trpc.router.query pattern:
'use client'
import { useParams } from 'next/navigation'
import { trpc } from '@/src/trpc/client'

export default function TraceabilityPage() {
  const params = useParams<{ id: string }>()
  const documentId = params.id
  const matrixQuery = trpc.traceability.matrix.useQuery({ documentId })
  // ...
}
```

### Verified: Route Handler auth pattern (follows createTRPCContext pattern)

```typescript
// From src/trpc/init.ts — replicate this pattern in Route Handlers:
import { auth } from '@clerk/nextjs/server'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { eq } from 'drizzle-orm'

// In route.ts:
const { userId } = await auth()
if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

const user = await db.query.users.findFirst({ where: eq(users.clerkId, userId) })
if (!user || !can(user.role as Role, 'trace:export')) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| pg full-text search setup | ILIKE for v1 | tsvector is the right upgrade path but requires a migration adding a generated column; ILIKE covers v1 requirements |
| nuqs for URL filter state | useState (nuqs not installed) | nuqs would enable shareable filter URLs but isn't installed — follow existing useState pattern |
| PDF via puppeteer/headless Chrome | @react-pdf/renderer | Server-side React-based PDF; no browser process needed |

**Deprecated/outdated:**
- `react-csv`: Not installed, not recommended (papaparse is the maintained alternative)
- `jsPDF`: Client-side only; not suitable for server-side export in Route Handlers

---

## Open Questions

1. **Matrix pagination strategy**
   - What we know: The Cartesian join can produce many rows for large documents
   - What's unclear: Whether `limit: 100` is sufficient or if a cursor-based approach is needed
   - Recommendation: Start with limit 100 + a "show all" button; revisit if documents grow past 200 feedback items

2. **SRCH-03 full section content search depth**
   - What we know: Section content is Tiptap JSONB; ILIKE on raw JSON is noisy
   - What's unclear: Whether stakeholders expect full block-text search or just section title search
   - Recommendation: V1 searches section titles only; document the limitation in UI as "Search by section title"

3. **`@react-pdf/renderer` import in App Router**
   - What we know: STACK.md notes "may need API route workarounds"; version 4.3.x confirmed in STACK.md but not installed
   - What's unclear: Whether v4 has resolved the SSR dynamic import issue
   - Recommendation: Use a Route Handler (not RSC), lazy-import with `import()` if build errors occur, or add `server-only` to the PDF module

---

## Environment Availability

Step 2.6: Checked — this is a code/dependency phase. The only external dependencies are the two new npm packages.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| papaparse | TRACE-06 CSV export | No (not installed) | — | None — must install |
| @react-pdf/renderer | TRACE-06 PDF export | No (not installed) | — | None — must install |
| PostgreSQL / Neon | All DB queries | Yes (existing infra) | Neon hosted | — |
| Drizzle ilike operator | SRCH-02, SRCH-03 | Yes (drizzle-orm 0.45.1) | 0.45.1 | — |

**Missing dependencies requiring install before Phase 7 execution:**
- `npm install papaparse @types/papaparse`
- `npm install @react-pdf/renderer`

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | vitest.config.ts (inferred — no separate config; uses vite-tsconfig-paths) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRACE-01 | traceability chain JOIN returns correct rows | unit | `npm test -- src/__tests__/traceability.test.ts` | Wave 0 |
| TRACE-02 | matrix query shape (feedbackId, crId, sectionId, versionLabel columns present) | unit | `npm test -- src/__tests__/traceability.test.ts` | Wave 0 |
| TRACE-03 | matrix filter by orgType/sectionId/decisionOutcome applies correct WHERE conditions | unit | `npm test -- src/__tests__/traceability.test.ts` | Wave 0 |
| TRACE-04 | sectionChain query returns feedback items linked to section | unit | `npm test -- src/__tests__/traceability.test.ts` | Wave 0 |
| TRACE-05 | stakeholderOutcomes returns only caller's feedback with versionLabel resolved | unit | `npm test -- src/__tests__/traceability.test.ts` | Wave 0 |
| TRACE-06 | CSV/PDF export downloads with correct Content-Type header | manual | Browser: download file, check extension + headers | — |
| SRCH-01 | orgType filter added to feedback.list | unit | `npm test -- src/__tests__/search.test.ts` | Wave 0 |
| SRCH-02 | searchFeedback ILIKE returns matches on title and body | unit | `npm test -- src/__tests__/search.test.ts` | Wave 0 |
| SRCH-03 | searchSections ILIKE returns sections matching title | unit | `npm test -- src/__tests__/search.test.ts` | Wave 0 |
| SRCH-04 | changeRequest.list feedback text search filter | unit | `npm test -- src/__tests__/search.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/traceability.test.ts` — unit tests for traceability service functions (mock DB pattern from versioning.test.ts)
- [ ] `src/__tests__/search.test.ts` — unit tests for search query construction

*(Pattern: mock `@/src/db` with `vi.mock('@/src/db', () => ({ db: {} }))` per existing test pattern in versioning.test.ts. Test pure query-building logic, not live DB calls.)*

---

## Sources

### Primary (HIGH confidence)
- Codebase — `src/db/schema/` (all schema files read directly) — complete join path analysis
- Codebase — `src/server/routers/` (feedback.ts, changeRequest.ts, version.ts) — existing patterns
- Codebase — `src/server/services/version.service.ts` — buildChangelog/JOIN examples
- Codebase — `src/lib/permissions.ts` — permission matrix structure
- Codebase — `package.json` — confirmed installed packages and versions
- Drizzle ORM 0.45.x API — `ilike`, `or`, `and` imported from `drizzle-orm` (verified by existing imports in routers)

### Secondary (MEDIUM confidence)
- STACK.md — @react-pdf/renderer 4.3.x SSR quirks warning; papaparse recommendation
- Next.js Route Handler docs (`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`) — confirmed Route Handler pattern for streaming responses

### Tertiary (LOW confidence — flag for validation)
- @react-pdf/renderer v4 behavior in Next.js 16.2.1 App Router Route Handlers: unverified at time of research (package not yet installed)

---

## Metadata

**Confidence breakdown:**
- DB schema & join paths: HIGH — read directly from source files
- tRPC procedure patterns: HIGH — copied from existing Phase 5/6 routers
- ILIKE search: HIGH — ilike is exported from drizzle-orm 0.45.1 per existing import pattern
- CSV export (papaparse): MEDIUM — package not installed, API is well-known
- PDF export (@react-pdf/renderer): MEDIUM — package not installed, SSR quirks noted in STACK.md
- Filter state (useState): HIGH — follows existing phase patterns

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable libraries, 30-day window)
