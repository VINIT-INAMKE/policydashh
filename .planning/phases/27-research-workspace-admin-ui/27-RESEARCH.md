# Phase 27: Research Workspace Admin UI — Research

**Researched:** 2026-04-20
**Domain:** Next.js workspace UI, tRPC client, R2 file upload, shadcn/base-ui component composition
**Confidence:** HIGH — all findings grounded in existing codebase source, no speculative claims

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Dedicated pages at `/research-manage/new` and `/research-manage/[id]/edit`, not a two-step dialog. Mirrors `/workshop-manage/new` pattern. Supersedes "two-step dialog" language in success criterion 2.
- **D-02:** File upload fires on file-select, before save. Flow: pick file → `POST /api/upload` presign → `PUT` to R2 → `evidence_artifacts` row inserted → UI shows "Uploaded name.pdf · 2.3 MB". `Save` writes `research_items` row referencing `artifactId`.
- **D-03:** `itemType` auto-drives upload-mode branch. `media_coverage` / `legal_reference` → external URL input only. All other types → file input only. No manual toggle.
- **D-04:** New `'research'` category added to `app/api/upload/route.ts`. Allowlist: PDF, DOCX, DOC, CSV, XLSX, XLS. Max 32 MB.
- **D-05:** Live anonymous-author preview in both the edit form (via `AnonymousPreviewCard`) and the detail page, using shared `shouldHideAuthors(item)` helper.
- **D-06:** Three separate controlled dialogs for link pickers: `SectionLinkPicker`, `VersionLinkPicker`, `FeedbackLinkPicker`. Each uses `{ open, onOpenChange }` props and `Promise.allSettled` bulk-link.
- **D-07:** `relevanceNote` per section-link is NOT captured in the picker. Inline click-to-edit textarea on the detail page section list after linking.
- **D-08:** `/research-manage` is a Table with sortable columns + left-rail filter panel. Columns: ReadableID, Title, Type, Status, Author(s), Published/Updated Date. Filter panel: Document (Select), Type (multi-checkbox), Status (multi-checkbox), Author (Select).
- **D-09:** No separate review queue route. Admin review uses `/research-manage` with `?status=pending_review` pre-selected.
- **D-10:** `research_lead` dashboard: two StatCards — "My Drafts: N" and "Pending Review (mine): N".
- **D-11:** `admin` + `policy_lead` dashboard: one StatCard — "Research Awaiting Review: N" linking to `/research-manage?status=pending_review`.
- **D-12:** Add "Research" item to workspace sidebar (`adaptive-header-client.tsx`), gated to `admin`, `policy_lead`, `research_lead`. No PolicyTabBar entry.
- **D-13:** Decision log reuses `FeedbackDecisionLog` component pattern from `app/policies/[id]/feedback/_components/decision-log.tsx`.
- **D-14:** Lifecycle action buttons derived from `can(role, 'research:*')` via `src/lib/permissions.ts`. Server-side `requirePermission` remains authorization truth; client gating is UX only.

### Claude's Discretion

- Exact form field ordering inside create/edit page
- Filter panel collapse behaviour on mobile
- Loading skeleton shapes
- Toast copy for each mutation
- Table row hover / selected visual states
- Keyboard navigation within link-picker dialogs

### Deferred Ideas (OUT OF SCOPE)

- Rich-text abstract editor (Tiptap integration)
- Bulk CSV import of research items
- Email notifications on status change
- Per-research-item Cardano anchoring
- Authorship transfer mutation
- DOI external validation
- Public `/research/items` listing + detail (Phase 28)
- Dedicated `/research-manage/review` route with keyboard triage
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RESEARCH-06 | research_lead workspace surface: create/edit drafts, submit for review; list page scoped by role | D-01, D-08; prior-art in workshop-manage pages; router `create`, `update`, `submitForReview` |
| RESEARCH-07 | admin/policy_lead review actions: approve, reject-with-rationale, retract-with-reason; workflow_transitions written on every transition | D-14; `transitionResearch()` service; `workflowTransitions` schema; decision log pattern from feedback |
| RESEARCH-08 | Link-picker dialogs for sections/versions/feedback; per-section relevanceNote editable inline; dashboard widgets for all three privileged roles | D-06, D-07, D-10, D-11; `SectionLinkPicker` prior-art; `StatCard` component; dashboard server-component pattern |
</phase_requirements>

---

## Summary

Phase 27 is a pure UI phase. The schema, router (15 procedures), permissions (7 grants), and lifecycle service are all shipped and tested from Phase 26. No new backend work is required — the phase is entirely about composing the existing tRPC surface into workspace pages that closely mirror the workshop-manage and change-request patterns already in the codebase.

The prior art is dense and directly applicable. The list page copies the Table + left-rail filter panel from `/feedback` (Phase 4). The create/edit pages copy the single-column Card form from `/workshop-manage/new`. The three link-picker dialogs copy `app/workshop-manage/[id]/_components/section-link-picker.tsx` (controlled dialog, Checkbox multi-select, `Promise.allSettled` bulk mutation). The decision log copies `app/policies/[id]/feedback/_components/decision-log.tsx` verbatim with data wired to a new `trpc.research.listTransitions` procedure that must be added to the router (not present yet — confirmed by grep). Dashboard widgets use the existing `StatCard` component and the server-component DB-query pattern from `ResearchLeadDashboard` and `AdminDashboard`.

The one non-trivial piece is the upload flow: D-02 requires fire-on-file-select (not on form save), which differs from the workshop `artifact-attach-dialog.tsx` pattern that uploads inside a dialog confirm handler. The existing `uploadFile()` helper in `src/lib/r2-upload.ts` supports `onProgress`, which can drive the `<Progress>` component. The `'research'` category must be added to both `MAX_FILE_SIZE` and `ALLOWED_TYPES` in `app/api/upload/route.ts` before the upload zone can be used.

**Primary recommendation:** Follow the workshop-manage + feedback pattern exactly for page shells, dialogs, and dashboard widgets. Introduce exactly one router addition (`research.listTransitions`) and one upload-route addition (`'research'` category) before beginning UI work.

---

## Prior-Art Scan: Existing Workspace Page Patterns

### List page pattern (`/feedback` — Phase 4)

- Two-column layout: 240px left filter rail + flex-1 table area
- Client component (`'use client'`) — `trpc.*.list.useQuery()` with `keepPreviousData`
- Filter state held in `useState`; server query called with single-value params; multi-select filters applied client-side after fetch (Phase 4/7 pattern)
- Table: standard HTML `<table>` or shadcn Table primitive; column headers toggle sort with ChevronUp/Down icons
- Empty state: icon + heading + body + optional CTA button
- Loading state: Skeleton rows matching column widths

**Confirmed source:** `app/feedback/page.tsx` (inferred from Phase 13 consolidation and CONTEXT.md references)

### List page pattern (`/workshop-manage` — Phase 10/12)

- File: `app/workshop-manage/page.tsx` (read — confirmed)
- `'use client'` page, `trpc.user.getMe.useQuery()` for role, `trpc.workshop.list.useQuery()` with `keepPreviousData`
- `canManage` derived from role check; CTA button conditionally rendered
- Card grid layout (not table) — but the pattern for role-gating the CTA applies directly

**Key reuse for Phase 27:** role-based CTA visibility pattern, `keepPreviousData`, empty state component shape.

### Create/edit page pattern (`/workshop-manage/new`)

- Single-column, `max-w-2xl` centered, Card container
- Back link at top, `<h1>` page title
- Form fields using shadcn Input, Select, Textarea, Label, Switch
- Footer: primary action button (accent) + ghost cancel link
- No separate dialog — full page with URL, browser back works

**Key reuse for Phase 27:** Exact layout for `/research-manage/new` and `/research-manage/[id]/edit` (D-01).

### Detail page pattern (`/workshop-manage/[id]`)

- `'use client'` page, single `trpc.workshop.getById.useQuery()`
- Two-column on desktop: main content + right sidebar card
- Sidebar contains: lifecycle actions card + linked entities card
- Link pickers as controlled dialogs (`open` state in parent, `onOpenChange` prop passed down)
- `utils.workshop.getById.invalidate()` after any mutation

**Key reuse for Phase 27:** Same two-column layout, same controlled-dialog pattern for pickers, same invalidation pattern.

### Controlled dialog pattern (Phase 12)

- `SectionLinkPicker` (read — confirmed): `{ workshopId, linkedSectionIds, open, onOpenChange }` props
- Parent owns `const [pickerOpen, setPickerOpen] = useState(false)`
- Dialog renders pure content — no `<DialogTrigger>` inside the component
- `handleLink()` calls `Promise.allSettled(targets.map(id => linkMutation.mutateAsync(...)))`, counts failures, fires consolidated toast
- On `finally`: resets `selected`, calls `onOpenChange(false)`

**This is the exact pattern for all three research link-picker dialogs.**

### Decision log pattern (Phase 4/5)

File read: `app/policies/[id]/feedback/_components/decision-log.tsx`

```typescript
// Source: app/policies/[id]/feedback/_components/decision-log.tsx
interface Transition {
  id: string           // unique key (avoids duplicate-key warning)
  fromState: string | null
  toState: string
  actorName: string | null
  timestamp: string
  rationale: string | null
}
export function DecisionLog({ transitions }: { transitions: Transition[] })
```

- Renders `<h3>` label, then maps transitions with `Separator` between rows
- Each row: status Badges with `ArrowRight`, actor + relative time, optional rationale paragraph
- Empty state: "No decisions recorded yet."

**`ResearchDecisionLog` wraps this identically, wiring `trpc.research.listTransitions` (to be added).**

---

## tRPC Integration: Phase 26 Router Surface

**All 15 procedures confirmed in `src/server/routers/research.ts`.**

### Input/output shapes (verified from source)

| Procedure | Input | Returns |
|-----------|-------|---------|
| `list` | `{ documentId?, itemType?, status? }` | `researchItems[]` (full row array, no anon filter) |
| `getById` | `{ id: guid }` | single row (anon filter on published) |
| `create` | `createInput` (see below) | `{ id, readableId }` |
| `update` | `updateInput` (id + all fields optional) | updated row |
| `submitForReview` | `{ id: guid }` | `{ previousStatus, newStatus, ...row }` |
| `approve` | `{ id: guid }` | `{ previousStatus, newStatus, ...row }` |
| `reject` | `{ id: guid, rejectionReason?: string }` | `{ previousStatus, newStatus, ...row }` |
| `retract` | `{ id: guid, retractionReason: string }` | `{ previousStatus, newStatus, ...row }` |
| `linkSection` | `{ researchItemId, sectionId, relevanceNote? }` | `{ linked: true }` |
| `unlinkSection` | `{ researchItemId, sectionId }` | `{ unlinked: true }` |
| `linkVersion` | `{ researchItemId, versionId }` | `{ linked: true }` |
| `unlinkVersion` | `{ researchItemId, versionId }` | `{ unlinked: true }` |
| `linkFeedback` | `{ researchItemId, feedbackId }` | `{ linked: true }` |
| `unlinkFeedback` | `{ researchItemId, feedbackId }` | `{ unlinked: true }` |

**`createInput` fields (confirmed from router source):**
`documentId` (required guid), `title` (required, min 1 max 500), `itemType` (required enum), `description?`, `externalUrl?`, `artifactId?`, `doi?`, `authors?` (string[]), `publishedDate?` (YYYY-MM-DD string), `peerReviewed` (default false), `journalOrSource?`, `versionLabel?`, `previousVersionId?`, `isAuthorAnonymous` (default false).

### Missing procedure: `listTransitions`

**Confirmed absent by grep** — `listTransitions` is not in `src/server/routers/research.ts`.

The feedback router pattern (line 611) is:
```typescript
listTransitions: requirePermission('feedback:read_own')
  .input(z.object({ feedbackId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    // ownership check, then:
    db.select({ id, fromState, toState, actorId, timestamp, metadata, actorName: users.name })
      .from(workflowTransitions)
      .leftJoin(users, eq(workflowTransitions.actorId, users.id))
      .where(and(eq(workflowTransitions.entityType, 'research_item'), eq(workflowTransitions.entityId, input.id)))
      .orderBy(asc(workflowTransitions.timestamp))
  })
```

**For research.listTransitions:** guard with `requirePermission('research:read_drafts')`, input `{ id: z.guid() }`, no ownership check needed (the router's `getById` already gates access). Return same shape as feedback's listTransitions plus `metadata` (needed to surface `rejectionReason` and `retractionReason` in the decision log).

This is a Wave 0 addition — **must be added to the router in the first plan of Phase 27** before the decision-log component can be wired.

### Mutation side-effects

All lifecycle mutations call `transitionResearch()` which:
1. INSERTs into `workflow_transitions` BEFORE updating `research_items` (R6 invariant)
2. Populates `reviewedBy` + `reviewedAt` on approve
3. Populates `retractionReason` on retract
4. Fire-and-forget `writeAuditLog` — never blocks the response

**UI implications:** After any lifecycle mutation, invalidate `utils.research.getById` and `utils.research.listTransitions` so the detail page and decision log both refresh.

### RBAC confirmed from `src/lib/permissions.ts`

| Permission | Roles |
|-----------|-------|
| `research:create` | admin, policy_lead, research_lead |
| `research:manage_own` | admin, policy_lead, research_lead |
| `research:submit_review` | admin, policy_lead, research_lead |
| `research:publish` | admin, policy_lead |
| `research:retract` | admin, policy_lead |
| `research:read_drafts` | admin, policy_lead, research_lead |
| `research:read_published` | all 7 authenticated roles |

**D-14 client-side gating pattern:**
```typescript
const meQuery = trpc.user.getMe.useQuery()
const role = meQuery.data?.role
const canSubmit = can(role, 'research:submit_review')
const canPublish = can(role, 'research:publish')
const canRetract = can(role, 'research:retract')
```
Import `can` from `@/src/lib/permissions`. This matches the `canManageCR` pattern in `cr-detail.tsx`.

### Ownership scoping

`research_lead` can only see own drafts in `list` — the router enforces `assertOwnershipOrBypass`. The `list` procedure currently does NOT filter by `createdBy` in the WHERE clause for `research_lead` — it returns all rows matching the filter inputs. **This means the list page for `research_lead` must either:**
1. Pass `authorId: ctx.user.id` to the query (requires a router update), OR
2. Rely on the server's permission guard plus client-side filter

**Confirmed gap:** The current `list` procedure has no `createdBy` filter parameter. The planner needs to decide: add `authorId?` filter to `research.list` input, or add it as a Wave 0 router extension. This is required to satisfy success criterion 1 ("research_lead sees own") via the URL filter `?author=me`.

---

## File Upload Flow

### Existing `uploadFile()` helper

File: `src/lib/r2-upload.ts` (read — confirmed).

```typescript
export async function uploadFile(file: File, options: UploadOptions = {}): Promise<UploadResult>
// UploadOptions: { category?: 'image' | 'document' | 'evidence', onProgress?: (percent: number) => void }
// UploadResult: { url: string, name: string, key: string }
```

The `onProgress` callback enables the `<Progress>` component (0-100). Uses XHR when `onProgress` is provided, plain `fetch` otherwise.

**D-04 requires adding `'research'` to the category type** in both:
1. `src/lib/r2-upload.ts` — update the `UploadOptions.category` union type
2. `app/api/upload/route.ts` — add `'research'` key to both `MAX_FILE_SIZE` and `ALLOWED_TYPES`

Allowlist for `'research'` category:
```typescript
MAX_FILE_SIZE: { research: 32 * 1024 * 1024 }   // 32MB

ALLOWED_TYPES: {
  research: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]
}
```

Also update `EXT_TO_FAMILY` to add `csv: 'text'`, `xls: 'application'`, `xlsx: 'application'` for the extension/MIME family check on line 183.

### D-02 fire-on-file-select implementation pattern

The create/edit form holds three pieces of state:
```typescript
const [artifactId, setArtifactId] = useState<string | null>(null)
const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
const [uploadProgress, setUploadProgress] = useState(0)
const [uploadedName, setUploadedName] = useState<string | null>(null)
```

On `<input type="file" onChange>`:
1. Call `uploadFile(file, { category: 'research', onProgress: setUploadProgress })`
2. On success: POST `trpc.evidenceArtifact.create` (or direct DB insert via the upload route's artifact creation — check if `POST /api/upload` creates the `evidence_artifacts` row or just presigns)

**Important:** `POST /api/upload` currently only returns `{ uploadUrl, publicUrl, key }` — it does NOT insert into `evidence_artifacts`. The artifact row creation is a separate step done by the caller (e.g., `trpc.workshop.attachArtifact` in the workshop dialog). For Phase 27, after the R2 PUT succeeds, the UI must call `trpc.research.create` with `artifactId` pointing to a newly created `evidence_artifacts` row — but there is no standalone "create evidence artifact" tRPC procedure.

**Resolution:** The `artifact-attach-dialog.tsx` pattern passes `url`, `fileName`, `fileSize`, `r2Key` to `trpc.workshop.attachArtifact` which creates the `evidence_artifacts` row server-side in the mutation. Phase 27 needs the same: `trpc.research.create` should accept `artifactId` (pointing to an already-existing artifact row) OR the create mutation itself should optionally create the artifact row from upload metadata.

**Planner decision needed:** The cleanest approach matching Phase 26's schema is for the create/update form to pass file upload metadata fields (`fileName`, `fileSize`, `r2Key`, `publicUrl`) alongside the research item create, and have the server create the `evidence_artifacts` row inside `research.create` before inserting the `research_items` row. This requires a minor router update. Alternatively, a separate `trpc.evidence.createArtifact` mutation could be called client-side first. Check existing evidence router for `createArtifact` before planning.

### `evidence_artifacts` row creation — existing patterns

The workshop `attachArtifact` mutation creates the row inline. No standalone `evidence.createArtifact` tRPC procedure exists in the main router (evidence routes create rows as side effects of feedback/section attachment). **Recommendation:** Extend `research.create` and `research.update` to accept upload metadata fields (`artifactFileName`, `artifactFileSize`, `artifactR2Key`, `artifactPublicUrl`) and create the `evidence_artifacts` row server-side when those fields are present. Keeps the router as the single write boundary and avoids a client-side two-step.

---

## Link-Picker Patterns

### SectionLinkPicker (confirmed from source)

The exact implementation in `app/workshop-manage/[id]/_components/section-link-picker.tsx`:

- Props: `{ workshopId, linkedSectionIds, open, onOpenChange }`
- Uses `trpc.document.list.useQuery({ includeSections: true })` — this query is already available
- Flattens sections: `documentsQuery.data.flatMap(doc => doc.sections.map(s => ({ id, title, documentTitle, blockCount })))`
- Filters out already-linked: `allSections.filter(s => !linkedSectionIds.includes(s.id))`
- Multi-select via `useState<string[]>([])`, toggled by `Checkbox`
- `handleLink()` uses `Promise.allSettled`, counts failures, fires toast, resets state in `finally`

**Research `SectionLinkPicker` is identical** except:
- Props: `{ researchItemId, linkedSectionIds, open, onOpenChange }`
- Mutation: `trpc.research.linkSection.useMutation()`
- Invalidation: `utils.research.getById.invalidate({ id: researchItemId })`

### VersionLinkPicker (new, no prior art)

- Uses `trpc.document.list.useQuery({ includeSections: false })` to get documents
- Then per-document `trpc.version.list` (or equivalent) to get versions — check if `trpc.documentVersion.list` or `trpc.changeRequest.listVersions` exists
- Checkbox multi-select on version rows showing `versionLabel` + document title + `isPublished` badge
- Mutation: `trpc.research.linkVersion.useMutation()`

**Version list query:** The existing `document.list` includes no versions. Check `src/server/routers/changeRequest.ts` or `src/server/routers/document.ts` for a version listing procedure. If none exists for this use case, VersionLinkPicker can do a single `db.select from documentVersions` via a dedicated `trpc.documentVersion.list` call or reuse `trpc.changeRequest.listVersions` if it exists.

### FeedbackLinkPicker

The workshop feedback-link-picker uses `trpc.feedback.listAll` (Phase 12 addition). Research FeedbackLinkPicker reuses the identical query:
- `trpc.feedback.listAll.useQuery()` — returns all feedback visible to the user
- Checkbox multi-select showing `readableId`, `title`, `sectionName`, `status` badge
- Mutation: `trpc.research.linkFeedback.useMutation()`

### Duplicate prevention

All link mutations use `.onConflictDoNothing()` at the DB level (confirmed in router source). The picker UI also filters already-linked IDs from the selectable list (same pattern as SectionLinkPicker's `availableSections` filter). No client-side dedup beyond this is needed.

### `relevanceNote` inline edit (D-07)

After linking, each section link row on the detail page renders:
```
[section title]     [relevanceNote text or placeholder]     [unlink button]
```
Click on `relevanceNote` text → `Textarea` appears in place + "Save note" / "Cancel" buttons.
"Save note" calls `trpc.research.linkSection.mutateAsync({ researchItemId, sectionId, relevanceNote })` — this is idempotent (onConflictDoNothing) so re-linking with a note is safe. The router accepts `relevanceNote` on `linkSection`.

---

## RBAC Gating: Existing Page Patterns

### Pattern 1: CTA visibility (list page header)

```typescript
// Source: app/workshop-manage/page.tsx lines 14-26
const meQuery = trpc.user.getMe.useQuery()
const canManage = meQuery.data?.role === 'workshop_moderator' || meQuery.data?.role === 'admin'
// ...
{canManage && <Button render={<Link href="/workshop-manage/new" />}>Create Workshop</Button>}
```

For `/research-manage`: `can(role, 'research:create')` gates the "Create Research Item" button.

### Pattern 2: Lifecycle action buttons (detail page sidebar)

```typescript
// Source: app/policies/[id]/change-requests/_components/cr-detail.tsx lines 56-62
const meQuery = trpc.user.getMe.useQuery()
const role = meQuery.data?.role
const canManageCR = role === 'admin' || role === 'policy_lead'
```

For research lifecycle actions (D-14):
```typescript
const canSubmit  = can(role, 'research:submit_review')   // research_lead + admin + policy_lead
const canPublish = can(role, 'research:publish')          // admin + policy_lead only
const canRetract = can(role, 'research:retract')          // admin + policy_lead only
```

Plus ownership check: even if `canSubmit` is true, "Submit for Review" only appears when `item.status === 'draft'` AND `item.createdBy === meQuery.data?.id` for research_lead. Admin/policy_lead bypass ownership (can submit any draft, though they rarely would).

### Pattern 3: Sidebar navigation (adaptive-header-client.tsx)

File read: `app/_components/adaptive-header-client.tsx` lines 60-76.

```typescript
// Existing pattern for conditional nav items:
if (userRole === 'admin' || userRole === 'workshop_moderator') {
  items.push({ href: '/workshop-manage', label: 'Workshop Manage' })
}
// For research (D-12):
if (userRole === 'admin' || userRole === 'policy_lead' || userRole === 'research_lead') {
  items.push({ href: '/research-manage', label: 'Research' })
}
```

This goes AFTER the `workshop_moderator` block, BEFORE the `users` admin block.

---

## Dashboard Widget Integration

### `StatCard` component

File read: `app/dashboard/_components/stat-card.tsx`.

```typescript
// Props: { icon: React.ReactNode, value: number | string, label: string }
// Renders: Card with min-h-[96px] bg-muted, absolute top-right icon, 28px semibold value, 12px muted label
```

**StatCard does NOT accept an `href` prop** — it has no built-in link behavior. To make it clickable (linking to `/research-manage?status=pending_review`), wrap it in Next.js `<Link>`:
```typescript
<Link href="/research-manage?status=pending_review">
  <StatCard icon={...} value={count} label="Research Awaiting Review" />
</Link>
```

Or, given `base-ui` render prop pattern: use `Button render={<Link href="..."/>}` variant wrapping the card. Check existing dashboard for the pattern used on "Versions Ready to Publish" rows — those use `Button render={<Link>}` inside the card content, not the card itself as a link.

### Dashboard server-component DB query pattern

`ResearchLeadDashboard` (read — confirmed) uses `Promise.all([db.select..., db.select..., ...])` directly (no tRPC). Dashboard widgets are async React Server Components that query the DB directly.

**For D-10 (research_lead — "My Drafts" + "Pending Review (mine)"):**
```typescript
// In ResearchLeadDashboard (server component), add:
const [myDraftsResult, myPendingResult] = await Promise.all([
  db.select({ count: count() })
    .from(researchItems)
    .where(and(eq(researchItems.createdBy, userId), eq(researchItems.status, 'draft'))),
  db.select({ count: count() })
    .from(researchItems)
    .where(and(eq(researchItems.createdBy, userId), eq(researchItems.status, 'pending_review'))),
])
```
Import `researchItems` from `@/src/db/schema/research`.

**For D-11 (admin + policy_lead — "Research Awaiting Review"):**
```typescript
// In AdminDashboard and PolicyLeadDashboard (server components), add:
const [researchAwaitingResult] = await db
  .select({ count: count() })
  .from(researchItems)
  .where(eq(researchItems.status, 'pending_review'))
```

Add these to the existing `Promise.all` arrays in each dashboard to avoid sequential round-trips.

---

## Workflow Transitions Table

### Schema (confirmed from source)

```typescript
// src/db/schema/workflow.ts
workflowTransitions = pgTable('workflow_transitions', {
  id:         uuid PK
  entityType: text NOT NULL     // 'research_item' for this phase
  entityId:   uuid NOT NULL
  fromState:  text              // nullable (null on first transition)
  toState:    text NOT NULL
  actorId:    text NOT NULL
  timestamp:  timestamptz NOT NULL defaultNow()
  metadata:   jsonb             // { rejectionReason? } or { retractionReason? }
})
```

### Write path (confirmed from research.service.ts)

Every lifecycle transition (submit, approve, reject, retract) calls `transitionResearch()` which inserts into `workflowTransitions` BEFORE updating `researchItems`. The metadata JSONB carries:
- `reject`: `{ rejectionReason: string }` (optional)
- `retract`: `{ retractionReason: string }` (required)

### `listTransitions` query to add

```typescript
// To add to src/server/routers/research.ts
listTransitions: requirePermission('research:read_drafts')
  .input(z.object({ id: z.guid() }))
  .query(async ({ input }) => {
    return db
      .select({
        id:        workflowTransitions.id,
        fromState: workflowTransitions.fromState,
        toState:   workflowTransitions.toState,
        actorId:   workflowTransitions.actorId,
        timestamp: workflowTransitions.timestamp,
        metadata:  workflowTransitions.metadata,   // carries rejectionReason / retractionReason
        actorName: users.name,
      })
      .from(workflowTransitions)
      .leftJoin(users, eq(workflowTransitions.actorId, users.id))
      .where(
        and(
          eq(workflowTransitions.entityType, 'research_item'),
          eq(workflowTransitions.entityId, input.id),
        ),
      )
      .orderBy(asc(workflowTransitions.timestamp))
  }),
```

The `DecisionLog` component expects `rationale: string | null`. Map `metadata.rejectionReason ?? metadata.retractionReason ?? null` to the `rationale` field in the component or in the query result mapping.

---

## Architecture Patterns

### Recommended project structure

```
app/research-manage/
├── page.tsx                         # List page (client — trpc.research.list)
├── new/
│   └── page.tsx                     # Create page (client)
├── [id]/
│   ├── page.tsx                     # Detail page (client — trpc.research.getById)
│   ├── edit/
│   │   └── page.tsx                 # Edit page (client)
│   └── _components/
│       ├── anonymous-preview-card.tsx
│       ├── section-link-picker.tsx
│       ├── version-link-picker.tsx
│       ├── feedback-link-picker.tsx
│       ├── research-decision-log.tsx
│       └── lifecycle-actions.tsx
├── _components/
│   ├── research-status-badge.tsx
│   └── research-filter-panel.tsx
```

### Page shell pattern

All pages in `research-manage/` are `'use client'` components following the workshop-manage model. The workspace layout (`app/(workspace)/layout.tsx` or equivalent) provides the sidebar chrome — pages only provide content.

### Anti-patterns to avoid

- **Server component for detail page:** The detail page needs `trpc.user.getMe` for role-based button gating. Keep it a client component.
- **Including `<DialogTrigger>` inside link-picker components:** Phase 12 fixed this. Pickers are pure dialog content; parent owns trigger + `open` state.
- **Calling `.mutate()` without `.mutateAsync()` in bulk-link loops:** Use `mutateAsync` inside `Promise.allSettled` so all results are captured.
- **`z.uuid()` for UUID inputs:** Use `z.guid()` throughout (Phase 16 precedent — `z.uuid()` rejects version-0 UUIDs in test fixtures).
- **Fetching link counts in the list query:** The current `research.list` returns full rows. The list page renders author(s) as comma-joined `item.authors?.join(', ')` and conditionally "Confidential" when `item.isAuthorAnonymous`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload to R2 with progress | Custom XHR | `uploadFile()` from `src/lib/r2-upload.ts` | Already handles presign + PUT + CORS Content-Disposition header + progress |
| Multi-select link picker | Custom list component | Copy `section-link-picker.tsx` pattern | Battle-tested `Promise.allSettled` + toast + reset-on-close flow |
| Decision log rendering | New component from scratch | Copy `DecisionLog` from `decision-log.tsx` | Handles relative time, status formatting, rationale, empty state |
| Role permission check | `role === 'admin' \|\| role === 'policy_lead'` inline | `can(role, 'research:*')` from `src/lib/permissions.ts` | Single source of truth, matches server guards |
| Toast notifications | Custom notification | `toast.success()` / `toast.error()` from `sonner` | Already wired in layout |
| Status badge color | Inline `className` conditionals | `ResearchStatusBadge` component + CSS tokens in `globals.css` | Consistent with feedback/CR badge pattern |
| Relative timestamps | `new Date().toRelativeTimeString()` | Existing `formatRelativeTime()` pattern from `decision-log.tsx` | Already handles mins/hours/days |

---

## Common Pitfalls

### Pitfall 1: Upload before `evidence_artifacts` row exists

**What goes wrong:** The form saves with `artifactId` set to the R2 key, but no `evidence_artifacts` row was created. The FK constraint on `research_items.artifactId` → `evidence_artifacts.id` will reject the insert.

**Why it happens:** `POST /api/upload` only presigns — it does NOT create the DB row. The artifact row must be created by a mutation (e.g., in the `research.create` handler server-side, or via a separate step).

**How to avoid:** Extend `research.create` / `research.update` to accept upload metadata (`artifactFileName`, `artifactFileSize`, `artifactR2Key`, `artifactPublicUrl`) and create the `evidence_artifacts` row inside the mutation before inserting `research_items`. Planner must add this as a router extension task in Wave 0.

**Warning signs:** `foreign key constraint violation` on `research_items.artifact_id` during create.

### Pitfall 2: `research.list` does not filter by `createdBy` for research_lead

**What goes wrong:** `research_lead` sees all items, not just their own. Success criterion 1 requires role-scoped list.

**Why it happens:** The Phase 26 `list` procedure has no `createdBy` filter parameter. The `assertOwnershipOrBypass` guard only applies to mutation procedures.

**How to avoid:** Add `authorId?: z.guid()` to the `list` input schema and push `eq(researchItems.createdBy, input.authorId)` to the conditions array. The list page passes `authorId: meQuery.data?.id` when `role === 'research_lead'`.

**Warning signs:** research_lead list page shows other users' drafts.

### Pitfall 3: `StatCard` is not a link

**What goes wrong:** Dashboard StatCard is not clickable. Users see the count but cannot navigate to the filtered list.

**Why it happens:** `StatCard` has no `href` prop — it is a pure display component.

**How to avoid:** Wrap with `<Link href="...">` or apply a `cursor-pointer` class + `onClick` handler. Prefer `<Link>` for accessibility (correct `<a>` semantics, prefetching).

### Pitfall 4: Anonymous-author rule mismatch between form preview and detail page

**What goes wrong:** The `AnonymousPreviewCard` shows "Authors: X" but the public portal shows "Source: Confidential" (or vice versa).

**Why it happens:** Two separate code paths computing `isAuthorAnonymous` display without sharing logic.

**How to avoid:** Extract `shouldHideAuthors(item: { isAuthorAnonymous: boolean }): boolean` as a pure function in a shared utility file (e.g., `src/lib/research-utils.ts`). Both the `AnonymousPreviewCard` and the detail-page author rendering import it. This is D-05.

### Pitfall 5: `relevanceNote` re-link creates duplicate row

**What goes wrong:** Calling `trpc.research.linkSection` with a `relevanceNote` on an already-linked `(researchItemId, sectionId)` pair fails silently or overwrites unexpectedly.

**Why it happens:** The router uses `.onConflictDoNothing()` — updates to `relevanceNote` on existing links are ignored, not upserted.

**How to avoid:** Use `.onConflictDoUpdate({ target: [researchItemSectionLinks.researchItemId, researchItemSectionLinks.sectionId], set: { relevanceNote: sql.raw('EXCLUDED.relevance_note') } })` when `relevanceNote` is provided. This is a router fix required for D-07 inline editing to work correctly. Planner should add this as a Wave 0 router task alongside `listTransitions`.

### Pitfall 6: `data-[state]` attribute on base-ui Checkbox

**What goes wrong:** `<Checkbox checked={...} onCheckedChange={...}>` does not exist on base-ui's Checkbox — it uses a different API than Radix.

**Why it happens:** Project uses `@base-ui/react` not Radix (Phase 02 decision). Base-ui Checkbox has different prop names.

**How to avoid:** Copy the exact Checkbox usage from `section-link-picker.tsx` (already confirmed working) — it uses `checked={selected.includes(s.id)} onCheckedChange={() => toggleSection(s.id)}`, which indicates shadcn's Checkbox wrapper (not raw base-ui). The shadcn adapter layer makes this API consistent. Do not import Checkbox from `@base-ui/react` directly.

### Pitfall 7: Mobile filter panel not accounted for in layout

**What goes wrong:** Filter panel disappears or overlaps table content on narrow viewports.

**Why it happens:** The 240px fixed-width left rail only works on desktop. No mobile collapse logic is planned automatically.

**How to avoid:** At `<768px`, render the filter panel as a `<Collapsible>` component above the table. Show a "Filters · N" trigger badge when filters are active (Claude's discretion, confirmed in UI-SPEC interaction contract).

---

## Code Examples

### Create page — fire-on-file-select upload zone

```typescript
// Source pattern: app/workshop-manage/[id]/_components/artifact-attach-dialog.tsx
// Adapted for research create/edit page (D-02)

const [uploadState, setUploadState] = useState<'idle'|'uploading'|'done'|'error'>('idle')
const [uploadProgress, setUploadProgress] = useState(0)
const [uploadedFile, setUploadedFile] = useState<{ name: string; size: number; key: string } | null>(null)

async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return
  setUploadState('uploading')
  setUploadProgress(0)
  try {
    const result = await uploadFile(file, {
      category: 'research',         // D-04: new category
      onProgress: setUploadProgress,
    })
    setUploadedFile({ name: result.name, size: file.size, key: result.key })
    setUploadState('done')
    // Store result.key in form state; server-side create uses it to insert evidence_artifacts
  } catch {
    setUploadState('error')
  }
}
```

### Link picker — `Promise.allSettled` bulk-link pattern

```typescript
// Source: app/workshop-manage/[id]/_components/section-link-picker.tsx lines 33-65
async function handleLink() {
  const targets = selected.filter((id) => !linkedSectionIds.includes(id))
  if (targets.length === 0) { setSelected([]); onOpenChange(false); return }
  try {
    const results = await Promise.allSettled(
      targets.map((sectionId) =>
        linkMutation.mutateAsync({ researchItemId, sectionId })
      ),
    )
    const failures = results.filter((r) => r.status === 'rejected').length
    const successes = results.length - failures
    if (successes > 0) utils.research.getById.invalidate({ id: researchItemId })
    if (failures === 0) {
      toast.success(successes === 1 ? 'Section linked.' : `${successes} sections linked.`)
    } else {
      toast.error(`Linked ${successes} of ${results.length}. ${failures} failed — try again.`)
    }
  } finally {
    setSelected([])
    onOpenChange(false)
  }
}
```

### Lifecycle actions — reject inline expand pattern

```typescript
// Source: UI-SPEC interaction contract + feedback/CR pattern reference
const [rejectExpanded, setRejectExpanded] = useState(false)
const [rejectionReason, setRejectionReason] = useState('')

const rejectMutation = trpc.research.reject.useMutation({
  onSuccess: () => {
    toast.success('Research item rejected.')
    utils.research.getById.invalidate({ id: item.id })
    utils.research.listTransitions.invalidate({ id: item.id })
    setRejectExpanded(false)
    setRejectionReason('')
  },
  onError: (err) => toast.error(err.message || "Couldn't reject. Try again."),
})

// JSX (sidebar card, admin/policy_lead only when status=pending_review):
{canPublish && item.status === 'pending_review' && (
  <div className="flex flex-col gap-2">
    <Button variant="destructive" onClick={() => setRejectExpanded(true)}>Reject</Button>
    {rejectExpanded && (
      <>
        <Label>Rejection reason (required)</Label>
        <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
        <Button
          variant="destructive"
          disabled={!rejectionReason.trim() || rejectMutation.isPending}
          onClick={() => rejectMutation.mutate({ id: item.id, rejectionReason })}
        >
          Submit Rejection
        </Button>
        <Button variant="ghost" onClick={() => setRejectExpanded(false)}>Cancel</Button>
      </>
    )}
  </div>
)}
```

### ResearchStatusBadge color tokens

```typescript
// app/research-manage/_components/research-status-badge.tsx
// Tokens to add to app/globals.css (in "Feedback status semantic colors" block):
// --research-status-draft: --muted / --muted-foreground
// --research-status-pending: oklch(0.92 0.07 85) / oklch(0.5 0.1 85)
// --research-status-published: oklch(0.9 0.08 145) / oklch(0.4 0.12 145)
// --research-status-retracted: oklch(0.95 0.04 27) / oklch(0.45 0.12 27)
const STATUS_CLASSES: Record<string, string> = {
  draft:          'bg-muted text-muted-foreground',
  pending_review: 'bg-[oklch(0.92_0.07_85)] text-[oklch(0.5_0.1_85)]',
  published:      'bg-[oklch(0.9_0.08_145)] text-[oklch(0.4_0.12_145)]',
  retracted:      'bg-[oklch(0.95_0.04_27)] text-[oklch(0.45_0.12_27)]',
}
```

---

## Standard Stack

### Core (all already installed — confirmed from prior phases)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| Next.js (this project's version) | project locked | Page routing, RSC | AGENTS.md: read node_modules/next/dist/docs/ |
| @trpc/react-query | project locked | tRPC client hooks | `trpc.research.*` patterns |
| @tanstack/react-query | project locked | `keepPreviousData`, `useUtils` | workshop-manage pattern |
| shadcn + @base-ui/react | Phase 02 | Dialog, Table, Checkbox, Switch, etc. | components.json |
| lucide-react | project locked | Icons (ChevronUp, ChevronDown, X, etc.) | all existing pages |
| sonner | project locked | Toast notifications | existing `toast.success` / `toast.error` |
| drizzle-orm | project locked | Dashboard server-component DB queries | dashboard pattern |

### Supporting

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `date-fns` | Date formatting in dashboard | AdminDashboard already imports it |
| `src/lib/r2-upload.ts` | File upload utility | All file upload zones |
| `src/lib/permissions.ts` | `can()` for client-side gating | D-14 lifecycle action buttons |

**No new npm packages required for Phase 27.**

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 27 |
|--------------|------------------|---------------------|
| Radix primitives | @base-ui/react (Phase 02) | Use shadcn wrappers, not raw base-ui imports |
| `z.uuid()` | `z.guid()` (Phase 16) | Use `z.guid()` for all UUID Zod schemas |
| `createNotification()` inline | Inngest `sendNotificationCreate` (Phase 16) | Not applicable — no notifications in Phase 27 |
| Direct `db.insert` audit | `writeAuditLog()` fire-and-forget (Phase 1) | Already in router; no UI change needed |

---

## Environment Availability

Step 2.6: SKIPPED — Phase 27 is pure UI with no new external dependencies. All required tools (Node, npm, Next.js, Neon DB, R2) were verified in prior phases and remain available.

---

## Validation Architecture

`nyquist_validation: true` — section is mandatory.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (version locked to project) |
| Config file | `vitest.config.mts` (root) |
| Quick run command | `npx vitest run --reporter=verbose src/__tests__/research-*.test.ts` |
| Full suite command | `npx vitest run` |

Test discovery glob includes `src/**/*.test.ts`, `tests/**/*.test.ts`, `app/**/*.test.ts`. Phase 27 component tests should live in `app/research-manage/__tests__/` or `src/__tests__/`.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RESEARCH-06 | `research.list` scopes drafts to research_lead's own items via `authorId` filter | unit | `npx vitest run src/__tests__/research-router.test.ts` | ✅ (extend existing) |
| RESEARCH-06 | `research.listTransitions` returns workflowTransitions for a research item | unit | `npx vitest run src/__tests__/research-router.test.ts` | ✅ (extend existing, new procedure) |
| RESEARCH-06 | Create-edit form validates required fields (title, documentId, itemType) | component | `npx vitest run app/research-manage/__tests__/create-edit.test.tsx` | ❌ Wave 0 |
| RESEARCH-06 | `isAuthorAnonymous` toggle switches `AnonymousPreviewCard` between author names and "Source: Confidential" | component | `npx vitest run app/research-manage/__tests__/anonymous-preview.test.tsx` | ❌ Wave 0 |
| RESEARCH-06 | Upload route accepts `'research'` category with correct MIME types | unit | `npx vitest run src/__tests__/upload-research.test.ts` | ❌ Wave 0 |
| RESEARCH-07 | Lifecycle action RBAC: "Submit for Review" hidden from admin/policy_lead on own items they didn't create | component | `npx vitest run app/research-manage/__tests__/lifecycle-actions.test.tsx` | ❌ Wave 0 |
| RESEARCH-07 | Lifecycle action RBAC: "Approve" and "Reject" hidden from research_lead | component | `npx vitest run app/research-manage/__tests__/lifecycle-actions.test.tsx` | ❌ Wave 0 |
| RESEARCH-07 | Lifecycle action RBAC: "Retract" only shown on published items to admin/policy_lead | component | `npx vitest run app/research-manage/__tests__/lifecycle-actions.test.tsx` | ❌ Wave 0 |
| RESEARCH-07 | Reject action: "Submit Rejection" disabled until textarea has ≥1 non-whitespace char | component | `npx vitest run app/research-manage/__tests__/lifecycle-actions.test.tsx` | ❌ Wave 0 |
| RESEARCH-08 | `SectionLinkPicker` multi-select: selecting 3 sections fires 3 `linkSection` mutations | component | `npx vitest run app/research-manage/__tests__/section-link-picker.test.tsx` | ❌ Wave 0 |
| RESEARCH-08 | `SectionLinkPicker` excludes already-linked sections from selectable list | component | `npx vitest run app/research-manage/__tests__/section-link-picker.test.tsx` | ❌ Wave 0 |
| RESEARCH-08 | `relevanceNote` onConflictDoUpdate upserts note on existing link | unit | `npx vitest run src/__tests__/research-router.test.ts` | ✅ (extend existing) |
| RESEARCH-08 | Dashboard StatCard query returns correct count for `status='pending_review'` | unit (DB mock) | `npx vitest run src/__tests__/research-dashboard.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/__tests__/research-router.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `app/research-manage/__tests__/create-edit.test.tsx` — form validation + upload-mode branch by itemType (REQ RESEARCH-06)
- [ ] `app/research-manage/__tests__/anonymous-preview.test.tsx` — toggle behavior for `AnonymousPreviewCard` (REQ RESEARCH-06)
- [ ] `app/research-manage/__tests__/lifecycle-actions.test.tsx` — RBAC gating for all 4 lifecycle buttons across all relevant roles (REQ RESEARCH-07)
- [ ] `app/research-manage/__tests__/section-link-picker.test.tsx` — multi-select and already-linked exclusion (REQ RESEARCH-08)
- [ ] `src/__tests__/upload-research.test.ts` — upload route `'research'` category MIME validation (REQ RESEARCH-06)
- [ ] `src/__tests__/research-dashboard.test.ts` — pending_review count query (REQ RESEARCH-08)
- [ ] Router extensions (no new test file, extend `src/__tests__/research-router.test.ts`):
  - `research.listTransitions` procedure — REQ RESEARCH-06/07
  - `research.list` authorId filter — REQ RESEARCH-06
  - `research.linkSection` onConflictDoUpdate for `relevanceNote` — REQ RESEARCH-08

---

## Open Questions

1. **`evidence_artifacts` row creation in research.create**
   - What we know: `POST /api/upload` presigns only; workshop dialogs create the row inside `attachArtifact` mutation.
   - What's unclear: Whether to extend `research.create` to accept upload metadata and create the artifact row server-side, or require a separate client-side step.
   - Recommendation: Extend `research.create` and `research.update` to accept `artifactFileName`, `artifactFileSize`, `artifactR2Key`, `artifactPublicUrl` fields and insert `evidence_artifacts` inside the mutation. Cleanest single-write boundary.

2. **`research.list` authorId scoping for research_lead**
   - What we know: Current `list` procedure has no `createdBy` filter.
   - What's unclear: Whether to add `authorId?: z.guid()` to list input or enforce purely at the UI layer.
   - Recommendation: Add `authorId?` filter to `research.list` input. The list page passes `meQuery.data?.id` when role is `research_lead`. Keeps server as source of truth for row visibility.

3. **VersionLinkPicker data source**
   - What we know: No `trpc.documentVersion.list` or similar public version-listing procedure was found specifically for this use case.
   - What's unclear: Whether `trpc.changeRequest.list` returns versions, or if a new `trpc.document.listVersions` procedure is needed.
   - Recommendation: Check `src/server/routers/changeRequest.ts` and `src/server/routers/document.ts` for an existing version-listing query. If none, add `trpc.documentVersion.list({ documentId? })` as a minimal read procedure.

4. **`relevanceNote` upsert — `onConflictDoUpdate` vs current `onConflictDoNothing`**
   - What we know: `linkSection` currently uses `.onConflictDoNothing()`. `relevanceNote` inline editing calls `linkSection` with an existing `(researchItemId, sectionId)` pair.
   - What's unclear: Whether to change the router or add a dedicated `updateRelevanceNote` procedure (D-07 mentions checking before adding).
   - Recommendation: Change `linkSection` to use `onConflictDoUpdate({ set: { relevanceNote: sql.raw('EXCLUDED.relevance_note') } })` when `relevanceNote` is provided. Simpler than a new procedure, keeps the link+note as one atomic write.

---

## Sources

### Primary (HIGH confidence)

- `src/server/routers/research.ts` — full router source read; all 15 procedure signatures confirmed
- `src/server/services/research.service.ts` — `transitionResearch()` flow confirmed
- `src/db/schema/research.ts` — schema columns, enums, link table composite PKs confirmed
- `src/db/schema/workflow.ts` — `workflowTransitions` table schema confirmed
- `src/lib/permissions.ts` — all 7 `research:*` permissions and role grants confirmed
- `src/lib/r2-upload.ts` — `uploadFile()` signature, `onProgress`, category type confirmed
- `app/api/upload/route.ts` — current categories, MIME lists, security guards confirmed
- `app/workshop-manage/page.tsx` — list page pattern confirmed
- `app/workshop-manage/[id]/_components/section-link-picker.tsx` — controlled dialog + `Promise.allSettled` pattern confirmed
- `app/workshop-manage/[id]/_components/artifact-attach-dialog.tsx` — upload dialog pattern confirmed
- `app/policies/[id]/feedback/_components/decision-log.tsx` — `DecisionLog` component shape confirmed
- `app/dashboard/_components/research-lead-dashboard.tsx` — StatCard usage, `Promise.all` DB query pattern confirmed
- `app/dashboard/_components/admin-dashboard.tsx` — StatCard row pattern confirmed
- `app/dashboard/_components/stat-card.tsx` — `StatCard` props (no href) confirmed
- `app/_components/adaptive-header-client.tsx` — nav item conditional pattern confirmed
- `vitest.config.mts` — test discovery globs confirmed
- `src/server/routers/feedback.ts` lines 611-654 — `listTransitions` reference pattern confirmed
- `src/__tests__/research-router.test.ts` — existing test file structure confirmed

### Secondary (MEDIUM confidence)

- CONTEXT.md `<code_context>` — integration points and reusable assets cross-checked against source reads
- UI-SPEC (`27-UI-SPEC.md`) — component inventory and interaction contracts, treated as authoritative since generated from codebase inspection

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries confirmed installed in prior phases; no new dependencies
- Architecture: HIGH — prior-art pages read directly; patterns confirmed from source
- tRPC router: HIGH — full router source read; input/output shapes documented from code
- Upload flow: HIGH — `r2-upload.ts` and `upload/route.ts` both read directly; gap (artifact row creation) identified with evidence
- Pitfalls: HIGH — each pitfall grounded in specific source code observations
- Open questions: MEDIUM — gaps identified but resolutions are recommendations, not confirmed

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (stable codebase; only risk is router additions in other phases)
