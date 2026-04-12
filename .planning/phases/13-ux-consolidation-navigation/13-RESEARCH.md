# Phase 13: UX Consolidation & Navigation - Research

**Researched:** 2026-04-12
**Domain:** Next.js 16 App Router navigation, nested layouts, breadcrumbs, tab bar routing, React component wiring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Full-depth breadcrumbs showing every nesting level (e.g., Policies / Digital Economy Policy / Section 3 / Feedback)
- **D-02:** Breadcrumbs placed in a dedicated row below the main header bar — consistent across all workspace pages
- **D-03:** Hybrid labels — use entity names where data is already loaded, fall back to route labels where entity data isn't readily available
- **D-04:** Breadcrumbs replace all existing "Back to X" ghost buttons — no redundant navigation elements
- **D-05:** Convert all policy sub-pages to horizontal tab bar: Content (default), Feedback, Change Requests, Traceability, Versions
- **D-06:** Route-based tab navigation — each tab maps to its existing route. Tab bar is a shared layout component. No client-side tab switching.
- **D-07:** Role-gated tabs — only show tabs the user has permission to access. Stakeholders won't see Change Requests tab, etc.
- **D-08:** Section sidebar remains for the Content tab only
- **D-09:** Global /feedback becomes a real cross-policy overview page showing feedback from ALL policies, filterable by policy, status, type.
- **D-10:** /feedback/outcomes and /feedback/evidence-gaps fold into tabs within /feedback: [All Feedback] [My Outcomes] [Evidence Gaps]. Tab visibility is role-gated.
- **D-11:** Per-policy feedback tab (/policies/[id]/feedback) stays — serves focused policy-scoped work. Both global and per-policy views coexist.
- **D-12:** Inline "Give Feedback" button per section — appears at bottom of section content area. Opens feedback submission form pre-filled with the section reference. 1 click from reading to feedback.
- **D-13:** Workshop detail page: linked sections and feedback items are clickable links navigating directly to /policies/[id]/sections/[sectionId] or feedback detail
- **D-14:** Workspace nav reorganized to: Dashboard, Policies, Feedback, Workshops, Users, Audit. Users link visible to admin/policy_lead only. Audit link visible to admin/auditor.
- **D-15:** Notifications stays as bell icon in header only — no nav link added
- **D-16:** Rename uploadthing.ts to r2-upload.ts and update all 5 importing files

### Claude's Discretion

- Breadcrumb separator style and typography
- Tab bar active/inactive styling (use existing tabs.tsx component patterns)
- Mobile responsive behavior for tab bar (scroll vs dropdown)
- Exact placement of "Give Feedback" button within section content (top vs bottom)
- Loading states for breadcrumb entity names

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NAV-01 | Add breadcrumbs across all nested routes | New `app/(workspace)/_components/breadcrumb.tsx` client component using `usePathname()` + entity name props; inserted into workspace layout between header and `<main>` |
| NAV-02 | Convert policy sub-pages to tab bar navigation | New `app/(workspace)/policies/[id]/layout.tsx` server layout; renders `PolicyTabBar` client component; `usePathname()` for active tab detection |
| NAV-03 | Consolidate duplicate feedback views (global /feedback vs /policies/[id]/feedback) | Rewrite `app/(workspace)/feedback/page.tsx` from redirect-only to real tabbed page; fold outcomes + evidence-gaps as tabs; add cross-policy `feedback.listCrossPolicy` tRPC query |
| NAV-04 | Add cross-navigation workshops ↔ sections/feedback | Workshop detail page: wrap existing section/feedback items in `<Link>` to their canonical routes |
| NAV-05 | Add /users and /notifications to workspace nav | Modify `workspace-nav.tsx`: add Users for admin/policy_lead; Notifications stays header-only (D-15) |
| NAV-06 | Rename uploadthing.ts to r2-upload.ts and update all imports | File rename + update 5 import sites |
| NAV-07 | Add direct "Give Feedback" action from section content view | Add `<Button>` to `SectionContentView` bottom; navigate to existing `/policies/[id]/sections/[sectionId]/feedback/new` route |
</phase_requirements>

---

## Summary

Phase 13 is a pure UX wiring phase — no new data models, no new tRPC procedures except one (cross-policy feedback list), and no new UI component installs. Every component needed is already in `components/ui/`. The work is structural: creating a shared nested layout for policy sub-pages, building a breadcrumb component, rewriting the global feedback page from a redirect stub to a real tabbed view, and adding navigation links throughout.

The two architecturally significant tasks are: (1) creating `app/(workspace)/policies/[id]/layout.tsx` which will wrap all policy sub-page routes and render the tab bar, and (2) rewriting `app/(workspace)/feedback/page.tsx` from a server redirect into a client page with tabs and a cross-policy data source. Everything else is additive wiring: links, a button, a breadcrumb row, nav item additions.

The one new backend requirement is a `feedback.listCrossPolicy` (or similar) tRPC query that returns all feedback across all documents, filterable by policyId, status, type, and priority — the "All Feedback" tab in the global feedback page. Role enforcement follows existing `feedback:read_all` vs `feedback:read_own` permission split. All five files importing `uploadthing.ts` are already identified and the rename is mechanical.

**Primary recommendation:** Build in five logical waves: (1) file rename, (2) workspace nav + breadcrumb component, (3) policy nested layout + tab bar, (4) global feedback rewrite, (5) workshop cross-links + Give Feedback button.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.2.1 (installed) | Nested layouts, `usePathname`, `useSearchParams` | Project foundation |
| `@base-ui/react` (via `components/ui/tabs.tsx`) | installed | Tab primitive used for both policy tab bar and feedback tabs | Phase 2 decision — project standard |
| `lucide-react` | installed | ChevronRight icon for breadcrumb separator, MessageSquare for Give Feedback | Project icon library |
| `next/navigation` (`usePathname`, `useRouter`, `useSearchParams`) | 16.2.1 | Breadcrumb path parsing, tab active state, feedback tab URL sync | Established in workspace-nav.tsx and traceability page |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `components/ui/skeleton.tsx` | installed | Breadcrumb entity name loading state | While async data resolves |
| `components/ui/badge.tsx` | installed | Count badge on tab labels | If tab counts are surfaced (discretionary) |
| `components/ui/button.tsx` | installed | Give Feedback CTA | Section content view |
| `trpc/client` | installed | Cross-policy feedback data | New `listCrossPolicy` query |

### No new installs required

All components already present. No `npx shadcn add` commands.

---

## Architecture Patterns

### Recommended Project Structure Changes

```
app/(workspace)/
├── layout.tsx                          MODIFY: add <Breadcrumb> row between header and <main>
├── _components/
│   ├── workspace-nav.tsx               MODIFY: add Users (admin/policy_lead), fix nav order
│   └── breadcrumb.tsx                  CREATE: new client component
├── feedback/
│   ├── page.tsx                        REWRITE: redirect stub → tabbed cross-policy page
│   ├── outcomes/page.tsx               KEEP: still renders (reached via /feedback?tab=outcomes redirect or tab)
│   └── evidence-gaps/page.tsx          KEEP: still renders (reached via tab)
└── policies/[id]/
    ├── layout.tsx                      CREATE: shared policy sub-page layout with tab bar
    ├── page.tsx                        MODIFY: remove "Back" button + sub-page nav buttons; remove from layout
    └── _components/
        └── section-content-view.tsx    MODIFY: add Give Feedback button at bottom

src/lib/
├── uploadthing.ts                      RENAME to r2-upload.ts (content unchanged)

app/(workspace)/workshops/[id]/page.tsx MODIFY: wrap sections/feedback list items in <Link>
```

### Pattern 1: Nested Layout for Policy Sub-Pages (D-06)

**What:** Create `app/(workspace)/policies/[id]/layout.tsx` as a server component that fetches the policy title and passes it to a client `PolicyTabBar` component. All policy sub-routes (page, feedback, change-requests, traceability, versions) automatically receive the tab bar above their content.

**When to use:** Any time multiple sibling routes need shared persistent navigation that survives page transitions without remounting.

**Critical insight for policy [id] layout:** The current `page.tsx` is a `'use client'` component that renders the two-column layout (sidebar + content). The new `layout.tsx` must NOT duplicate that structure. The layout renders only: (1) tab bar, (2) `{children}`. The two-column grid (sidebar + content) stays in `page.tsx`.

**Height accounting:** The workspace layout already has a `<header>` + `<main className="p-6">`. The breadcrumb row is inserted between header and main inside workspace `layout.tsx`. The policy layout then renders its tab bar inside the `<main>` content area.

```tsx
// app/(workspace)/policies/[id]/layout.tsx
import { api } from '@/src/trpc/server'
import { PolicyTabBar } from './_components/policy-tab-bar'

export default async function PolicyLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const caller = await api()
  // Fetch minimally — title only for tab bar + breadcrumb
  let policyTitle: string | null = null
  try {
    const sections = await caller.document.getSections({ documentId: id })
    // We need the document title — use getById
    // Actually fetch via document.getById
  } catch {
    // graceful degradation
  }

  return (
    <div className="flex flex-col">
      <PolicyTabBar documentId={id} policyTitle={policyTitle} />
      {children}
    </div>
  )
}
```

**Note on data fetching in layout:** The server layout can call `caller.document.getById` to get the title. Pass it as a prop to `PolicyTabBar` (client component) and also down to the breadcrumb via a React context or layout-level prop. Alternatively, the breadcrumb in the workspace layout fetches its own data reactively via tRPC client hooks — this is simpler and avoids prop drilling through layout.

### Pattern 2: Route-Based Tab Active State (D-06)

**What:** Tab bar uses `usePathname()` to compute which tab is active, not the Tabs `value` prop. Each tab renders as `<Link href="...">` wrapped `TabsTrigger`. The `TabsTrigger` receives `data-active` via a computed boolean prop.

**Key finding from existing `tabs.tsx`:** The `TabsTrigger` uses `data-active` attribute (base-ui pattern) for the active underline state (`group-data-[variant=line]/tabs-list:data-active:after:opacity-100`). This is NOT the standard Radix `aria-selected`. To set it manually for route-based tabs, pass `data-active={isActive}` or use the base-ui `active` prop.

**Exact mapping from UI-SPEC:**
```
Content     → pathname === `/policies/${id}`         (exact)
Feedback    → pathname.startsWith(`/policies/${id}/feedback`)
Change Req  → pathname.startsWith(`/policies/${id}/change-requests`)
Versions    → pathname.startsWith(`/policies/${id}/versions`)
Traceability → pathname.startsWith(`/policies/${id}/traceability`)
```

**Tabs.tsx base-ui integration:** The `TabsPrimitive.Root` component from base-ui normally manages active state internally via `value` prop. For route-based tabs where we don't want tab switching (navigation instead), the correct approach is to NOT use the `Tabs` wrapper at all — render just a `<nav>` with the same CSS classes, or use `TabsList` + `TabsTrigger` components without a `Tabs` wrapper and manually set `data-active`. The traceability page uses `Tabs` with `value={activeTab}` and `onValueChange` — for navigation tabs this should be avoided.

**Simplest correct approach:** Create `PolicyTabBar` as a plain `<nav>` element styled to match the `TabsList line` variant classes, with `<Link>` elements styled to match `TabsTrigger` classes. This avoids base-ui's internal tab state management (which would fight with route-based navigation) while reusing the visual design.

### Pattern 3: Breadcrumb Component

**What:** Client component using `usePathname()` to segment the URL, with entity name overrides passed as props from parent layout or fetched via tRPC client.

**Placement:** In workspace `layout.tsx` — between `</header>` and `<main>`. The `layout.tsx` is a server component, but the `Breadcrumb` is a client component (needs `usePathname`). The server layout renders `<Breadcrumb />` and the client component does its own pathname parsing.

**Segment-to-label mapping:**
```
dashboard           → "Dashboard"
policies            → "Policies"
policies/[id]       → policy title (from tRPC query, shows skeleton while loading)
policies/[id]/feedback        → "Policies" / "{policy}" / "Feedback"
policies/[id]/change-requests → "Policies" / "{policy}" / "Change Requests"
policies/[id]/versions        → "Policies" / "{policy}" / "Versions"
policies/[id]/traceability    → "Policies" / "{policy}" / "Traceability"
feedback            → "Feedback"
workshops           → "Workshops"
workshops/[id]      → workshop title (from tRPC query)
users               → "Users"
audit               → "Audit"
```

**Known segment IDs the breadcrumb needs to resolve:**
- Policy ID: use `trpc.document.getById.useQuery({ id })` — query enabled only when UUID detected in pathname
- Workshop ID: use `trpc.workshop.getById.useQuery({ workshopId })` — similar
- Section ID: not needed at breadcrumb level (section is selected within the policy Content tab, not a route)

**Mobile collapse:** ancestors hidden with `hidden sm:inline` on `<li>` items except direct parent + current.

### Pattern 4: Global Feedback Page Rewrite (D-09, D-10)

**What:** `app/(workspace)/feedback/page.tsx` transforms from a server-redirect stub into a client page with three role-gated tabs and a new cross-policy data source.

**Existing tRPC procedures available:**
- `feedback.list` — requires `documentId`, returns per-policy feedback (used in FeedbackInbox)
- `feedback.listAll` — returns all feedback across docs, but requires `workshop:manage` permission — NOT suitable for the global feedback page
- `feedback.listOwn` — returns own feedback only

**New tRPC procedure needed:** `feedback.listCrossPolicy` (or extend `feedback.list` to make `documentId` optional). Behavior: if caller has `feedback:read_all`, return all feedback optionally filtered by `policyId`; if caller has only `feedback:read_own`, return own feedback. This is the "All Feedback" tab data source. One new tRPC query in `src/server/routers/feedback.ts`.

**Evidence Gaps tab:** The existing `evidence-gaps/page.tsx` is a full client page with its own role gate, filters, and table. For the tab integration, the content of this page should be extracted into a component `EvidenceGapsTab` and rendered as `TabsContent` in the global feedback page. The `evidence-gaps/page.tsx` route can become a simple wrapper or redirect.

**Outcomes tab:** Similarly, `feedback/outcomes/page.tsx` content (`OutcomesList` component) moves into a `MyOutcomesTab` wrapper. The route stays for backward compatibility.

**Tab state sync:** Uses `?tab=` URL param — established Phase 7 pattern. Values: `all`, `outcomes`, `evidence-gaps`. `useSearchParams` + `router.replace`.

### Pattern 5: Give Feedback Button (D-12)

**What:** Button added to bottom of `SectionContentView`. On click, navigates to the existing route `/policies/${documentId}/sections/${section.id}/feedback/new`.

**Important finding:** The feedback submission flow already exists as a full-page route at `app/(workspace)/policies/[id]/sections/[sectionId]/feedback/new/page.tsx`. There is NO existing sheet/dialog for feedback submission — the UI-SPEC references `FeedbackSubmitSheet` which does not exist. The "Give Feedback" button should navigate to this existing route (not open a sheet). This is simpler and consistent with the existing UX.

**Permission check:** `feedback:submit` is granted to `stakeholder`, `research_lead`, `workshop_moderator`. The `SectionContentView` already receives `canEdit` — add `canSubmitFeedback` prop (or derive from a tRPC `useMe` hook inside the component).

**Render condition:** Show only when `canSubmitFeedback && selectedSection !== null`. Already met structurally — `SectionContentView` only renders when a section is selected.

### Pattern 6: Workshop Cross-Navigation (D-13)

**What:** In `app/(workspace)/workshops/[id]/page.tsx`, linked sections and feedback items are currently rendered as plain text divs. Wrap them in `<Link>` components.

**Section link target:** `/policies/${section.documentId}/` — navigates to the policy page with that section's document. The workshop `getById` query returns `section.documentId` and `section.sectionId` — need to verify the exact shape. Looking at the page code: `section.sectionTitle` and `section.documentTitle` are available but NOT `section.documentId` or `section.sectionId` directly — the IDs are `section.sectionId` (used for unlink). The `documentId` for a section needs to come from the workshop router response. **Action required:** Verify `workshop.getById` returns `documentId` per linked section; if not, extend the query.

**Feedback link target:** `/policies/${fb.documentId}/feedback` then open the detail sheet, or simply link to the per-policy feedback page. The workshop feedback list shows `fb.readableId` and `fb.title` but may not return `fb.documentId`. **Action required:** Verify `workshop.getById` returns `documentId` per linked feedback item.

### Anti-Patterns to Avoid

- **Using `<Tabs>` wrapper for route-based navigation:** base-ui `Tabs.Root` manages internal `value` state that conflicts with route-based active detection. Use a plain nav with tab-styled elements, or carefully avoid the `Tabs` wrapper.
- **Fetching policy data inside the breadcrumb with SSR:** Breadcrumb is `'use client'` — must use tRPC client hooks, not server calls.
- **Removing `page.tsx` content when creating `layout.tsx`:** The existing `policies/[id]/page.tsx` owns the two-column layout (sidebar + content grid). The new `layout.tsx` wraps it, adding only the tab bar above. Do NOT move the sidebar/content grid into the layout.
- **Breaking the height calculation:** The current page.tsx uses `h-[calc(100vh-64px)]` for the policy page height. With a breadcrumb row (36px) and tab bar (~48px) added, this calc needs updating to `h-[calc(100vh-64px-36px-48px)]` or using a flex column approach instead of fixed height.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab active state from URL | Custom isActive logic per component | `usePathname().startsWith(href)` | Already used in workspace-nav.tsx — consistent |
| Breadcrumb separator | Custom divider component | ChevronRight from lucide-react | UI-SPEC locked: chevron only |
| Permission checks in UI | Inline role comparisons | Existing `canViewCR`, `canViewTrace`, `canSubmitFeedback` boolean derivation pattern | Already established Phase 4+ |
| Skeleton loading | Custom loading shimmer | `components/ui/skeleton.tsx` | Already installed |
| Tab URL state | `useState` for active tab | `useSearchParams` + `router.replace` | Phase 7 established pattern |

---

## Runtime State Inventory

> This is a rename phase (uploadthing.ts → r2-upload.ts).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `uploadthing` is a utility module, no database keys or collection names reference it | None |
| Live service config | None — no external service configured with "uploadthing" name | None |
| OS-registered state | None | None |
| Secrets/env vars | None — `uploadthing.ts` already contains R2-based implementation (not the actual UploadThing SaaS). The file is misnamed relative to its content. No env vars reference the filename. | None |
| Build artifacts | None — module name in imports only; no compiled binaries or egg-info | Update 5 import sites only |

**Import sites to update (all 5 identified):**
1. `app/(workspace)/workshops/[id]/_components/artifact-attach-dialog.tsx` — `import { uploadFile } from '@/src/lib/uploadthing'`
2. `app/(workspace)/policies/[id]/_components/block-editor.tsx` — `import { uploadFiles } from '@/src/lib/uploadthing'`
3. `app/(workspace)/policies/[id]/_components/image-block-view.tsx` — `import { uploadFile } from '@/src/lib/uploadthing'`
4. `app/(workspace)/policies/[id]/feedback/_components/evidence-attachment.tsx` — `import { uploadFile } from '@/src/lib/uploadthing'`
5. `app/(workspace)/policies/[id]/_components/file-attachment-view.tsx` — `import { uploadFile } from '@/src/lib/uploadthing'`

---

## Common Pitfalls

### Pitfall 1: Layout Wrapping Double-Renders the Sidebar

**What goes wrong:** If `policies/[id]/layout.tsx` renders a two-column grid and `page.tsx` also renders a two-column grid, the Content tab will have a nested double layout.

**Why it happens:** Confusion about what stays in `page.tsx` vs moves to `layout.tsx`.

**How to avoid:** Layout renders ONLY the tab bar (full-width, border-b) and `{children}`. The two-column grid (sidebar div + content div) stays entirely in `page.tsx`. Other sub-pages (feedback, change-requests, etc.) render full-width content without a sidebar — they are `{children}` passed directly.

**Warning signs:** Policy detail page shows double sidebars, or feedback/versions pages have unexpected padding.

### Pitfall 2: Height Calc Breaks With Breadcrumb + Tab Bar Added

**What goes wrong:** `policies/[id]/page.tsx` uses `h-[calc(100vh-64px)]` for the outer flex container. Adding a 36px breadcrumb row and ~48px tab bar above the content makes the page overflow.

**Why it happens:** Fixed pixel height calc was written for header-only offset.

**How to avoid:** Change `h-[calc(100vh-64px)]` to use CSS variables or switch to a flex-column approach in the workspace layout. The cleanest fix: workspace layout uses `flex flex-col h-screen`, header is `shrink-0`, breadcrumb row is `shrink-0`, main is `flex-1 overflow-hidden`. Policy layout: tab bar is `shrink-0`, children fill remaining. This eliminates hardcoded pixel offsets entirely.

**Warning signs:** Policy content area scrolls wrong, or the page extends beyond viewport.

### Pitfall 3: base-ui `Tabs` State Fighting Route Navigation

**What goes wrong:** Using `<Tabs value={activeTab}>` with `<Link>` inside `TabsTrigger` — the base-ui tab root intercepts click events and updates internal state without actually navigating.

**Why it happens:** base-ui `Tabs.Root` manages focus and selection internally. When `value` is controlled externally but onClick inside `TabsTrigger` triggers a Link navigation, there can be a flash of wrong active state or focus trapping.

**How to avoid:** For the policy tab bar (pure navigation, D-06), do NOT use the `Tabs` wrapper. Render a `<nav>` with `<TabsList data-variant="line">` (styled div, not the primitive) and `<Link>` elements styled with `TabsTrigger` CSS classes manually. OR use Tabs wrapper with `onValueChange={() => {}}` (no-op) and let the Link handle navigation, relying only on `data-active` computed from pathname.

**Warning signs:** Clicking a tab doesn't change the URL, or tab shows wrong active state.

### Pitfall 4: `useSearchParams` Requires Suspense Boundary

**What goes wrong:** Using `useSearchParams()` in a component without wrapping in `<Suspense>` causes a Next.js build error or runtime warning.

**Why it happens:** Next.js 16 requires `useSearchParams()` to be within a `<Suspense>` boundary on server-rendered routes.

**How to avoid:** Wrap the global feedback page (or its tab-using child) in `<Suspense fallback={null}>` — same pattern used on the traceability page.

**Warning signs:** Build error mentioning `useSearchParams` and Suspense.

### Pitfall 5: Workshop getById Missing documentId on Linked Items

**What goes wrong:** The workshop cross-navigation feature requires `section.documentId` to construct `/policies/${documentId}` links, but the current `workshop.getById` tRPC response may not include `documentId` per linked section/feedback.

**Why it happens:** The router was built for display purposes (show names), not navigation.

**How to avoid:** Inspect `workshop.getById` response shape before implementing. If `documentId` is missing, extend the query's select to include `documentId` from the sections/feedback join.

**Warning signs:** TypeScript error accessing `section.documentId` on workshop linked sections type.

### Pitfall 6: `feedback.list` Requires documentId — Cannot Use for Cross-Policy

**What goes wrong:** Calling `trpc.feedback.list` without a `documentId` causes a zod validation error.

**Why it happens:** The procedure has `documentId: z.string().uuid()` as required input.

**How to avoid:** Add a new `feedback.listCrossPolicy` procedure (or make `documentId` optional on `feedback.list`) before building the global feedback page UI. Do NOT try to call `feedback.listAll` — it requires `workshop:manage` permission, unsuitable for this use case.

---

## Code Examples

### Route-Based Tab Bar (Policy Sub-Pages)

```tsx
// app/(workspace)/policies/[id]/_components/policy-tab-bar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Tab {
  label: string
  href: string
  match: 'exact' | 'startsWith'
  visible: boolean
}

interface PolicyTabBarProps {
  documentId: string
  canViewCR: boolean
  canViewTrace: boolean
}

export function PolicyTabBar({ documentId, canViewCR, canViewTrace }: PolicyTabBarProps) {
  const pathname = usePathname()

  const tabs: Tab[] = [
    { label: 'Content', href: `/policies/${documentId}`, match: 'exact', visible: true },
    { label: 'Feedback', href: `/policies/${documentId}/feedback`, match: 'startsWith', visible: true },
    { label: 'Change Requests', href: `/policies/${documentId}/change-requests`, match: 'startsWith', visible: canViewCR },
    { label: 'Versions', href: `/policies/${documentId}/versions`, match: 'startsWith', visible: true },
    { label: 'Traceability', href: `/policies/${documentId}/traceability`, match: 'startsWith', visible: canViewTrace },
  ]

  return (
    <nav className="border-b border-border px-6 pt-4 pb-0" aria-label="Policy sections">
      <div className="flex gap-1">
        {tabs.filter((t) => t.visible).map((tab) => {
          const isActive = tab.match === 'exact'
            ? pathname === tab.href
            : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'relative inline-flex h-9 items-center px-3 text-sm font-medium whitespace-nowrap transition-colors',
                'after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity',
                isActive
                  ? 'text-foreground after:opacity-100'
                  : 'text-foreground/60 hover:text-foreground'
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

### Breadcrumb Component Structure

```tsx
// app/(workspace)/_components/breadcrumb.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { trpc } from '@/src/trpc/client'
import { cn } from '@/lib/utils'

export function Breadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  // Parse UUID to detect entity IDs
  // Build crumb array with href + label
  // For policy ID segment: use trpc.document.getById
  // ...
  return (
    <nav aria-label="Breadcrumb" className="border-b border-border bg-muted/50 px-6 py-2" style={{ height: '36px' }}>
      <ol className="flex items-center gap-1 text-sm">
        {/* crumbs */}
        <li>
          <Link href="/policies" className="text-muted-foreground hover:text-foreground transition-colors">
            Policies
          </Link>
        </li>
        <li><ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" /></li>
        <li><span className="font-medium text-foreground" aria-current="page">Policy Title</span></li>
      </ol>
    </nav>
  )
}
```

### Global Feedback Page Tab URL Sync (Phase 7 Pattern)

```tsx
// Established pattern from traceability page
const searchParams = useSearchParams()
const activeTab = searchParams.get('tab') ?? 'all'

const handleTabChange = (value: string | number | null) => {
  const tab = String(value ?? 'all')
  const newParams = new URLSearchParams(searchParams.toString())
  if (tab === 'all') {
    newParams.delete('tab')
  } else {
    newParams.set('tab', tab)
  }
  const qs = newParams.toString()
  router.replace(`/feedback${qs ? `?${qs}` : ''}`)
}
```

### Give Feedback Button in SectionContentView

```tsx
// Add to bottom of SectionContentView — after content area, before closing </div>
{canSubmitFeedback && (
  <div className="mt-6 flex justify-end sm:w-auto w-full">
    <Button
      variant="default"
      size="default"
      onClick={() => router.push(`/policies/${documentId}/sections/${section.id}/feedback/new`)}
    >
      <MessageSquare className="mr-2 h-4 w-4" aria-hidden="true" />
      Give Feedback
    </Button>
  </div>
)}
```

---

## Environment Availability

Step 2.6: SKIPPED — phase is purely code/config changes with no new external service dependencies. All tooling (Node, Next.js, TypeScript) confirmed running on this machine.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run src/__tests__/permissions.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-01 | Breadcrumb renders correct segments for /policies/[id]/feedback | unit (component) | `npx vitest run src/__tests__/breadcrumb.test.tsx` | ❌ Wave 0 |
| NAV-02 | PolicyTabBar shows/hides tabs based on role permissions | unit (component) | `npx vitest run src/__tests__/policy-tab-bar.test.tsx` | ❌ Wave 0 |
| NAV-03 | Cross-policy feedback tRPC query respects read_all vs read_own permission | unit (router) | `npx vitest run src/__tests__/feedback-cross-policy.test.ts` | ❌ Wave 0 |
| NAV-05 | WorkspaceNav renders Users link only for admin/policy_lead | unit (component) | `npx vitest run src/__tests__/workspace-nav.test.tsx` | ❌ Wave 0 |
| NAV-06 | All 5 import sites updated to r2-upload | manual-only | TypeScript build: `npx tsc --noEmit` | N/A |
| NAV-07 | Give Feedback button absent for admin role | unit (component) | `npx vitest run src/__tests__/section-content-view.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run` (passWithNoTests=true, safe to run incrementally)
- **Per wave merge:** `npx vitest run && npx tsc --noEmit`
- **Phase gate:** Full suite green + `npx tsc --noEmit` passes before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/breadcrumb.test.tsx` — covers NAV-01 (pathname segment parsing, entity name loading state)
- [ ] `src/__tests__/policy-tab-bar.test.tsx` — covers NAV-02 (role-gated tab visibility)
- [ ] `src/__tests__/feedback-cross-policy.test.ts` — covers NAV-03 (new tRPC procedure permission enforcement)
- [ ] `src/__tests__/workspace-nav.test.tsx` — covers NAV-05 (Users link visibility by role)
- [ ] `src/__tests__/section-content-view.test.tsx` — covers NAV-07 (Give Feedback button visibility by role)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `/feedback` redirects to first policy's inbox | `/feedback` is a real cross-policy tabbed view | Phase 13 | Admins/leads no longer lose context jumping between policies |
| Policy sub-pages linked as outline buttons | Policy sub-pages as tab bar in shared layout | Phase 13 | Orientation anchor at all times; fewer clicks |
| `Back to Policies` ghost button | Breadcrumb row | Phase 13 | Removes redundant navigation; always shows full context |
| `uploadthing.ts` misnamed (was UploadThing SaaS, now R2) | `r2-upload.ts` | Phase 13 (rename) | Code clarity; file name matches implementation |

---

## Open Questions

1. **Does `workshop.getById` return `documentId` for linked sections?**
   - What we know: The page displays `section.sectionTitle` and `section.documentTitle` — but navigation requires `section.documentId` and `section.sectionId`
   - What's unclear: Whether the tRPC response shape includes these IDs
   - Recommendation: Planner task for workshop cross-nav should include "verify and if needed extend `workshop.getById` to return `documentId` per linked section and feedback item"

2. **Should the `policies/[id]/page.tsx` height calc become flex-based?**
   - What we know: Current `h-[calc(100vh-64px)]` will be wrong with breadcrumb (36px) + tab bar (~48px) added above
   - What's unclear: Whether the planner prefers updating the calc to `h-[calc(100vh-148px)]` or refactoring to a flex column layout
   - Recommendation: Flex column approach is cleaner and more maintainable; avoids magic numbers

3. **Role fetching in the policy nested layout for the tab bar**
   - What we know: `canViewCR` and `canViewTrace` are currently computed from `trpc.user.getMe` inside `page.tsx`. The new `layout.tsx` also needs them to render the tab bar.
   - What's unclear: Whether to fetch the role in the server layout (clean, no client state) or pass as a prop from page to a client tab bar
   - Recommendation: Server layout calls `api()` caller to get user role and passes `canViewCR`/`canViewTrace` as props to the `PolicyTabBar` client component — same pattern as workspace layout passing `userRole` to `WorkspaceNav`

---

## Project Constraints (from CLAUDE.md)

- **Next.js version is 16.2.1** — APIs may differ from training data. Read `node_modules/next/dist/docs/` before writing code. Verified: nested layouts work standard; `params` is a `Promise<{...}>` in Next.js 16 (async layout/page components must await params).
- **shadcn style is `base-nova`** — uses `@base-ui/react` (not Radix). `asChild` pattern replaced by `render` prop on Button. Tab primitives are `base-ui/react/tabs`.
- **No new shadcn components needed** — all required components already installed.
- **WorkspaceNav is a client component** — `usePathname` for active state; server layout passes `userRole` prop. Same pattern for `PolicyTabBar`.
- **tRPC dates are strings** — UI interfaces use `string` types for `createdAt`/`updatedAt`.
- **Drizzle + Neon HTTP driver** — sequential updates, no transactions for reorder-style operations.
- **Graphify graph exists** — after modifying code files, run graph rebuild command per CLAUDE.md.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` — nested layout behavior, params as Promise in Next.js 16
- `app/(workspace)/_components/workspace-nav.tsx` — usePathname active state pattern
- `app/(workspace)/policies/[id]/traceability/page.tsx` — Phase 7 `?tab=` URL sync pattern (useSearchParams + router.replace)
- `components/ui/tabs.tsx` — base-ui Tabs primitive, `data-active` attribute for active styling, `variant="line"` underline behavior
- `src/server/routers/feedback.ts` — existing procedure shapes, permission requirements
- `src/lib/permissions.ts` — `feedback:submit` permission grantees
- All 5 uploadthing import sites — confirmed by grep

### Secondary (MEDIUM confidence)
- `app/(workspace)/workshops/[id]/page.tsx` — workshop detail shape; documentId availability per linked section/feedback not yet confirmed (Open Question 1)
- `app/(workspace)/policies/[id]/sections/[sectionId]/feedback/new/page.tsx` — confirmed existing feedback submission route (no sheet component needed)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed installed, versions verified
- Architecture patterns: HIGH — based on reading actual codebase files
- Pitfalls: HIGH — derived from existing code inspection, not assumptions
- Open questions: MEDIUM — require runtime inspection during implementation

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (stable stack, no fast-moving dependencies)
