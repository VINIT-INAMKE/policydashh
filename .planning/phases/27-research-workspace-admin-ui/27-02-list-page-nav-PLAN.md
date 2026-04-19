---
phase: 27-research-workspace-admin-ui
plan: 02
type: execute
wave: 1
depends_on: ["27-01"]
files_modified:
  - app/research-manage/page.tsx
  - app/research-manage/_components/research-status-badge.tsx
  - app/research-manage/_components/research-filter-panel.tsx
  - app/_components/adaptive-header-client.tsx
  - app/globals.css
autonomous: true
requirements:
  - RESEARCH-06
  - RESEARCH-07
  - RESEARCH-08
requirements_addressed:
  - RESEARCH-06
  - RESEARCH-07
  - RESEARCH-08
must_haves:
  truths:
    - "/research-manage list page renders Table with 6 sortable columns (ReadableID, Title, Type, Status, Authors, Updated)"
    - "research_lead user sees only own drafts in the list (authorId filter applied client-side)"
    - "admin/policy_lead user sees all research items"
    - "Filter panel (240px left rail on desktop, Collapsible on mobile) offers Document/Type/Status/Author filters"
    - "Workspace sidebar nav shows 'Research' link for admin/policy_lead/research_lead roles only"
    - "'Create Research Item' CTA button is gated by can(role, 'research:create') and links to /research-manage/new"
    - "Empty state renders 'No research items yet' heading + 'Create Research Item' CTA"
  artifacts:
    - path: "app/research-manage/page.tsx"
      provides: "List page (client component)"
      min_lines: 150
      contains: "trpc.research.list"
    - path: "app/research-manage/_components/research-status-badge.tsx"
      provides: "ResearchStatusBadge component"
      contains: "export function ResearchStatusBadge"
    - path: "app/research-manage/_components/research-filter-panel.tsx"
      provides: "Filter panel (Document/Type/Status/Author)"
      contains: "export function ResearchFilterPanel"
    - path: "app/_components/adaptive-header-client.tsx"
      provides: "Sidebar nav with Research item"
      contains: "/research-manage"
    - path: "app/globals.css"
      provides: "Research status color tokens"
      contains: "--research-status-"
  key_links:
    - from: "app/research-manage/page.tsx"
      to: "trpc.research.list"
      via: "useQuery with authorId/documentId/itemType/status params"
      pattern: "trpc\\.research\\.list"
    - from: "app/_components/adaptive-header-client.tsx"
      to: "/research-manage"
      via: "Link with role gate"
      pattern: "/research-manage"
    - from: "app/research-manage/_components/research-status-badge.tsx"
      to: "app/globals.css --research-status-* tokens"
      via: "CSS variable class names"
      pattern: "--research-status"
---

<objective>
Ship the `/research-manage` list page as the entry point for Phase 27. Implements RESEARCH-06 success criterion 1 (role-scoped list with filter panel and sortable columns) and puts the phase on the map via sidebar nav (D-12). Also delivers the `ResearchStatusBadge` shared component used on the list, detail, and dashboard surfaces.

Purpose: Research authors need a single place to see their drafts; admins need a single place to see the pending-review queue. Without this surface the Phase 26 router is unreachable from the workspace chrome.

Output: list page, filter panel component, status badge component, sidebar nav entry, CSS tokens.
</objective>

<execution_context>
@D:/aditee/policydash/.claude/get-shit-done/workflows/execute-plan.md
@D:/aditee/policydash/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/27-research-workspace-admin-ui/27-CONTEXT.md
@.planning/phases/27-research-workspace-admin-ui/27-RESEARCH.md
@.planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md
@.planning/phases/27-research-workspace-admin-ui/27-01-router-upload-wave0-PLAN.md
@app/workshop-manage/page.tsx
@app/_components/adaptive-header-client.tsx
@app/globals.css
@src/lib/permissions.ts

<interfaces>
From src/server/routers/research.ts (AFTER Plan 01):
```typescript
// list input (post-Plan 01):
z.object({
  documentId: z.guid().optional(),
  itemType:   z.enum([...]).optional(),
  status:     z.enum(['draft','pending_review','published','retracted']).optional(),
  authorId:   z.guid().optional(),  // NEW in Plan 01
})
// Returns: researchItems[] rows with authors: string[] | null, isAuthorAnonymous: boolean, ...
```

From src/lib/permissions.ts:
```typescript
export function can(role: Role, permission: Permission): boolean
// Relevant permissions: research:create, research:read_drafts
```

From src/lib/research-utils.ts (shipped in Plan 01):
```typescript
export function formatAuthorsForDisplay(item: {
  isAuthorAnonymous: boolean
  authors: string[] | null
}): string  // "Source: Confidential" | "Authors: X, Y" | "Unknown author"
```

From UI-SPEC §"Component Inventory":
- ResearchStatusBadge: thin wrapper around <Badge> accepting status: 'draft' | 'pending_review' | 'published' | 'retracted'
- ResearchFilterPanel: uses Select + Checkbox + Label
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create ResearchStatusBadge component + CSS tokens</name>
  <read_first>
    - app/globals.css (find the "Feedback status semantic colors" block to append after)
    - .planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md §"Color" (4 status color rows)
    - .planning/phases/27-research-workspace-admin-ui/27-RESEARCH.md §"Code Examples — ResearchStatusBadge color tokens"
    - components/ui/badge.tsx (the Badge primitive this wraps)
  </read_first>
  <action>
    **Edit 1 — app/globals.css: add 4 CSS variables for research status colors.**

    Locate the existing "Feedback status semantic colors" block in `app/globals.css` (search for `--feedback-status` or similar). Immediately AFTER it, append:

    ```css
    /* Phase 27 research status semantic colors — mirrors feedback/CR pattern.
       Draft: muted gray. Pending: amber (like priority-medium).
       Published: green (like status-accepted). Retracted: red-tint (like status-rejected). */
    --research-status-draft-bg: var(--muted);
    --research-status-draft-fg: var(--muted-foreground);
    --research-status-pending-bg: oklch(0.92 0.07 85);
    --research-status-pending-fg: oklch(0.5 0.1 85);
    --research-status-published-bg: oklch(0.9 0.08 145);
    --research-status-published-fg: oklch(0.4 0.12 145);
    --research-status-retracted-bg: oklch(0.95 0.04 27);
    --research-status-retracted-fg: oklch(0.45 0.12 27);
    ```

    Place under both `:root` AND `.dark` blocks if both exist (keep tokens identical — the oklch values work in both modes per existing pattern).

    **Edit 2 — app/research-manage/_components/research-status-badge.tsx: NEW FILE.**

    ```typescript
    import { Badge } from '@/components/ui/badge'

    export type ResearchItemStatus = 'draft' | 'pending_review' | 'published' | 'retracted'

    const STATUS_CLASSES: Record<ResearchItemStatus, string> = {
      draft:          'bg-muted text-muted-foreground',
      pending_review: 'bg-[oklch(0.92_0.07_85)] text-[oklch(0.5_0.1_85)]',
      published:      'bg-[oklch(0.9_0.08_145)] text-[oklch(0.4_0.12_145)]',
      retracted:      'bg-[oklch(0.95_0.04_27)] text-[oklch(0.45_0.12_27)]',
    }

    const STATUS_LABELS: Record<ResearchItemStatus, string> = {
      draft:          'Draft',
      pending_review: 'Pending Review',
      published:      'Published',
      retracted:      'Retracted',
    }

    export interface ResearchStatusBadgeProps {
      status: ResearchItemStatus
    }

    export function ResearchStatusBadge({ status }: ResearchStatusBadgeProps) {
      return (
        <Badge className={STATUS_CLASSES[status]}>
          {STATUS_LABELS[status]}
        </Badge>
      )
    }
    ```
  </action>
  <verify>
    <automated>npx tsc --noEmit && grep -n "research-status" app/globals.css</automated>
  </verify>
  <acceptance_criteria>
    - `ls app/research-manage/_components/research-status-badge.tsx` returns success
    - `grep -n "export function ResearchStatusBadge" app/research-manage/_components/research-status-badge.tsx` exactly one match
    - `grep -n "STATUS_LABELS\\[status\\]" app/research-manage/_components/research-status-badge.tsx` exactly one match
    - `grep -c "--research-status-" app/globals.css` outputs >= 8 (4 bg + 4 fg tokens, possibly doubled for light/dark)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>ResearchStatusBadge component exists with 4-status mapping; globals.css has 4 status color pairs.</done>
</task>

<task type="auto">
  <name>Task 2: Create /research-manage list page + filter panel</name>
  <read_first>
    - app/workshop-manage/page.tsx (reference: role-gated CTA, keepPreviousData, useQuery pattern)
    - app/feedback/page.tsx (if exists — reference for filter panel + table layout)
    - components/ui/table.tsx (Table primitive exports)
    - components/ui/select.tsx, components/ui/checkbox.tsx, components/ui/label.tsx
    - src/lib/permissions.ts (`can()` helper)
    - src/lib/research-utils.ts (formatAuthorsForDisplay — from Plan 01)
    - .planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md §"/research-manage — List page" (full section)
    - .planning/phases/27-research-workspace-admin-ui/27-UI-SPEC.md §"Copywriting Contract"
    - .planning/phases/27-research-workspace-admin-ui/27-CONTEXT.md D-08, D-09
  </read_first>
  <action>
    **Edit 1 — app/research-manage/_components/research-filter-panel.tsx: NEW FILE.**

    Create a client component with the following contract:
    - Props: `{ filters, onChange, documents, authors }` where:
      - `filters: { documentId?: string, itemType?: string[], status?: string[], authorId?: string }` (state owned by parent)
      - `onChange: (next: typeof filters) => void`
      - `documents: { id: string, title: string }[]` (from `trpc.document.list`)
      - `authors: { id: string, name: string | null }[]` (filtered to research_lead/admin/policy_lead from `trpc.user.list` — if permission denied, parent passes `[]` and the Author Select is disabled).
    - Layout: fixed 240px width on desktop via `w-60 shrink-0` wrapper; caller decides how to collapse on mobile (emit same component inside a `Collapsible` wrapper).
    - Fields in order:
      1. "Document" label + Select (single choice). Options: "All documents" (value empty string = no filter) + one per document.
      2. "Type" label + 8 Checkboxes (multi-select). Values: report, paper, dataset, memo, interview_transcript, media_coverage, legal_reference, case_study. Label formatting: `.replace('_', ' ')` + Title Case.
      3. "Status" label + 4 Checkboxes: draft, pending_review, published, retracted.
      4. "Author" label + Select (single choice). Options: "All authors" + one per allowed author.
    - Change handlers must call `onChange` with the full updated filters object (spread previous, override single field).
    - No internal state — fully controlled by parent.

    Use shadcn primitives exclusively (Select, Checkbox, Label from `@/components/ui/...`).

    **Edit 2 — app/research-manage/page.tsx: NEW FILE — the list page.**

    Client component (`'use client'`). Structure:

    1. Imports: React useState, useSearchParams from 'next/navigation', Link, `trpc` from `@/src/trpc/client`, `keepPreviousData` from `@tanstack/react-query`, `can` from `@/src/lib/permissions`, `formatAuthorsForDisplay` from `@/src/lib/research-utils`, `ResearchStatusBadge` from `./_components/research-status-badge`, `ResearchFilterPanel` from `./_components/research-filter-panel`, Button, Table primitives, Skeleton, Badge.
    2. Role resolution: `const meQuery = trpc.user.getMe.useQuery()`.
    3. URL-param bootstrap (D-09): read `searchParams` for `status`, `author`, `document`, `type`. If `author=me`, resolve to `meQuery.data?.id` after the query settles. Hydrate initial filter state from these.
    4. Filter state: `const [filters, setFilters] = useState({ documentId: undefined, itemType: [], status: [], authorId: undefined })`. Rehydrate once `meQuery` resolves if URL had `author=me`.
    5. Sort state: `const [sort, setSort] = useState({ column: 'updatedAt', direction: 'desc' })`.
    6. Query: `const listQuery = trpc.research.list.useQuery({ documentId: filters.documentId, itemType: filters.itemType[0], status: filters.status[0], authorId: filters.authorId }, { placeholderData: keepPreviousData })`. Pass only the first value of multi-select filters to the server (Phase 4 pattern); client-filter after fetch for the rest.
    7. Documents query: `trpc.document.list.useQuery({})` for the Document select options.
    8. Authors query: Use `trpc.user.list.useQuery(undefined, { enabled: meQuery.data?.role === 'admin' })` if a user list exists — else pass `[]`. (Acceptable short-cut: pass `meQuery.data ? [{ id: meQuery.data.id, name: meQuery.data.name ?? 'Me' }] : []` so research_lead can self-filter via URL param; author select won't be a populated dropdown for non-admins but URL-driven `?author=me` still works. Document this shortcut as a comment.)
    9. Client-side multi-filter + client-side sort applied to `listQuery.data ?? []` → `visibleItems`.
    10. CTA visibility: `const canCreate = can(meQuery.data?.role, 'research:create')`.
    11. Render:
        - Header row: `<h1>Research Items</h1>` (20px semibold) + conditional Button "Create Research Item" (Link to `/research-manage/new`, primary variant).
        - Two-column layout: filter panel (hidden on mobile, shown on md+) + flex-1 Table.
        - Table: `<Table>` with 6 sortable columns (clickable th → toggles sort). Each row: `<Link href={/research-manage/${item.id}}>` wrapping the first cell.
        - Cells per row:
          - ReadableID: `<Badge variant="secondary" className="font-mono text-xs">{item.readableId}</Badge>`
          - Title: `<span className="truncate">{item.title}</span>`
          - Type: `<span className="text-xs text-muted-foreground">{item.itemType.replace('_', ' ')}</span>`
          - Status: `<ResearchStatusBadge status={item.status} />`
          - Authors: `{formatAuthorsForDisplay(item).replace(/^Authors: /, '').replace('Source: Confidential', 'Confidential')}` — strip the "Authors: " prefix for table density (single-source-of-truth helper still consulted). Or display literally.
          - Updated: relative time via existing `formatRelativeTime` pattern or `date-fns` `formatDistanceToNow` (admin-dashboard uses date-fns — reuse).
        - Loading: 4 `<Skeleton className="h-10" />` rows.
        - Empty state (no data at all): centered icon + `<h2>No research items yet</h2>` + `<p>Create a research item to attach citable evidence to a policy document.</p>` + conditional CTA.
        - Empty state (filters returned no results): `<h2>No items match these filters</h2>` + `<p>Try adjusting the type or status filters.</p>`.

    Use EXACT copy strings from UI-SPEC §"Copywriting Contract".

    Follow the workshop-manage/page.tsx layout rhythm: `<div className="mb-6 flex items-center justify-between">` for the header row, then the two-column body.

    Mobile: on <768px, render `ResearchFilterPanel` above the table inside a `Collapsible` (shadcn) with trigger "Filters" + filter-count badge when active. Acceptable shortcut per UI-SPEC: if Collapsible is overhead, ship the filter panel always-visible stacked above the table on mobile — Claude's discretion per UI-SPEC.

    Do NOT `'use client'` directive is required — this is a client component.
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx next build app/research-manage 2>&1 | grep -E "error|Error" | head -5 || true</automated>
  </verify>
  <acceptance_criteria>
    - `ls app/research-manage/page.tsx` returns success
    - `ls app/research-manage/_components/research-filter-panel.tsx` returns success
    - `grep -n "trpc.research.list" app/research-manage/page.tsx` outputs at least one match
    - `grep -n "formatAuthorsForDisplay" app/research-manage/page.tsx` outputs at least one match
    - `grep -n "ResearchStatusBadge" app/research-manage/page.tsx` outputs at least one match
    - `grep -n "can(meQuery.data?.role" app/research-manage/page.tsx` outputs at least one match (role-gated CTA)
    - `grep -n "No research items yet" app/research-manage/page.tsx` exact match (UI-SPEC copy)
    - `grep -n "Create Research Item" app/research-manage/page.tsx` exact match
    - `grep -n "ResearchFilterPanel" app/research-manage/page.tsx` exact match
    - `grep -n "authorId" app/research-manage/page.tsx` exactly at least one match
    - `npx tsc --noEmit` exits 0
    - `head -1 app/research-manage/page.tsx` outputs `'use client'` (client component marker)
  </acceptance_criteria>
  <done>List page renders, filter panel is controlled, role-gated CTA works, sortable columns, empty states match UI-SPEC copy.</done>
</task>

<task type="auto">
  <name>Task 3: Add "Research" sidebar nav entry to adaptive-header-client.tsx</name>
  <read_first>
    - app/_components/adaptive-header-client.tsx (lines 60-76 — pattern for conditional nav items)
    - .planning/phases/27-research-workspace-admin-ui/27-CONTEXT.md D-12
    - .planning/phases/27-research-workspace-admin-ui/27-RESEARCH.md §"Pattern 3: Sidebar navigation"
  </read_first>
  <action>
    **Edit 1 — app/_components/adaptive-header-client.tsx: add Research nav item.**

    Locate the navItems builder inside `useMemo` (around line 46). Current code adds `Workshop Manage` for admin/workshop_moderator and `Users` for admin. Insert the Research item AFTER the `Workshop Manage` block and BEFORE the `Users` admin block:

    Change FROM:
    ```typescript
        // admin, workshop_moderator get Workshop Manage
        if (userRole === 'admin' || userRole === 'workshop_moderator') {
          items.push({ href: '/workshop-manage', label: 'Workshop Manage' })
        }

        // C1: /users is admin-only on the server (permissions.ts `user:list` and
        // the server guards in app/users/page.tsx). Keep the nav link in sync to
    ```

    TO:
    ```typescript
        // admin, workshop_moderator get Workshop Manage
        if (userRole === 'admin' || userRole === 'workshop_moderator') {
          items.push({ href: '/workshop-manage', label: 'Workshop Manage' })
        }

        // Phase 27 D-12: Research workspace — admin, policy_lead, research_lead.
        // No per-policy tab (research is cross-policy); no stakeholder/observer
        // access in workspace chrome (they get Phase 28 public surface).
        if (
          userRole === 'admin' ||
          userRole === 'policy_lead' ||
          userRole === 'research_lead'
        ) {
          items.push({ href: '/research-manage', label: 'Research' })
        }

        // C1: /users is admin-only on the server (permissions.ts `user:list` and
        // the server guards in app/users/page.tsx). Keep the nav link in sync to
    ```

    Do NOT modify the `PUBLIC_NAV` constant — `/research` there points to the PUBLIC /research page (Phase 20.5), which is a different surface. The new nav entry is `/research-manage` (workspace chrome only).

    The `useMemo` dependency array already includes `userRole` — no change needed.
  </action>
  <verify>
    <automated>grep -n "/research-manage" app/_components/adaptive-header-client.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "'/research-manage'" app/_components/adaptive-header-client.tsx` outputs exactly one match
    - `grep -n "label: 'Research'" app/_components/adaptive-header-client.tsx` outputs exactly one match
    - `grep -n "userRole === 'research_lead'" app/_components/adaptive-header-client.tsx` outputs at least one match
    - `grep -n "userRole === 'policy_lead'" app/_components/adaptive-header-client.tsx` outputs at least one match within the nav items block
    - `grep -n "/research'" app/_components/adaptive-header-client.tsx` outputs at least one match (the pre-existing public /research entry in PUBLIC_NAV must survive)
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Sidebar nav shows Research link for admin/policy_lead/research_lead in authenticated workspace chrome.</done>
</task>

</tasks>

<verification>
- Visit `/research-manage` as admin → sees full list, Create button visible
- Visit `/research-manage` as research_lead → sees only own items (authorId filter), Create button visible
- Visit `/research-manage` as stakeholder → no sidebar link (not gated redirect; discovery via URL leaks but Phase 28 gates the public path)
- Filter panel toggles work, status badge renders all 4 colors correctly
- `npx tsc --noEmit` passes
- `npx vitest run` full suite still green
</verification>

<success_criteria>
- `/research-manage` page loads and renders Table with 6 columns
- Role-scoped list: admin sees all, research_lead sees own (via authorId)
- Filter panel works for Document/Type/Status/Author (client-side multi-filter)
- ResearchStatusBadge renders with 4 distinct status colors
- Sidebar nav shows Research link for 3 privileged roles only
- Empty state + loading state render per UI-SPEC copy
</success_criteria>

<output>
Create `.planning/phases/27-research-workspace-admin-ui/27-02-SUMMARY.md` recording:
- Files created/modified
- Exact copy strings used (verify against UI-SPEC)
- Shortcuts taken (author dropdown scope, mobile collapse strategy)
- Hand-off for Plan 03/04: list page rows `<Link>` to `/research-manage/[id]` which Plan 04 must create
</output>
