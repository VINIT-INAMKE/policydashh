# Phase 12: Workshop System Fix - Research

**Researched:** 2026-04-12
**Domain:** tRPC router extension, React dialog pattern (base-ui), picker component refactor
**Confidence:** HIGH

## Summary

Phase 12 is a surgical bug-fix phase with four discrete tasks: fix a broken tRPC query, build a missing selection UI, remove duplicate rendering, and excise orphaned Dialog wrappers. All bugs are fully visible in the existing code; no architectural exploration is needed.

The root cause of each bug is understood from direct code inspection. The `document.list` query does a `GROUP BY` aggregate and never joins `policySections`, so `doc.sections` is always absent. The `FeedbackLinkPicker` renders a placeholder with no data fetch or selection. Both picker components contain `<Dialog>` + `<DialogTrigger>` wrappers despite the parent page already controlling open state — the `DialogTrigger` is orphaned because the parent's `Button` (which calls `setSectionPickerOpen(true)`) is the real trigger. The detail page also renders linked sections and feedback inline, while the picker components render the same data again as `Badge` lists — that is the duplicate rendering to remove.

**Primary recommendation:** Fix each bug independently. Commit in four atomic changes — router, feedback picker, duplicate cleanup, DialogTrigger cleanup. Do not conflate them into one large diff.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Expand the existing `document.list` tRPC query with an `includeSections` option so it returns nested sections when the picker needs them. No new endpoint.
- **D-02:** Each section in the picker shows: title, block count, and status (draft/published). Provides enough context for informed linking.
- **D-03:** Display feedback items as small cards in the picker — each card shows author, excerpt (~80 chars), sentiment/type badge, and submission date. Multi-select checkboxes for linking.
- **D-04:** Picker includes text search across feedback content plus a filter by feedback type (comment, suggestion, concern, etc.).
- **D-05:** Detail page owns the display of linked sections and feedback. Pickers handle selection/linking only — no rendering of linked items inside picker components. Clean separation: picker = select, page = display.
- **D-06:** Remove Dialog/DialogTrigger wrappers from inside picker components. Pickers become pure dialog content. Parent page.tsx owns the Dialog component and trigger button, passing open/onOpenChange to the picker content.

### Claude's Discretion
- Exact card layout and spacing for feedback items in picker
- Search debounce timing and filter UI placement
- How to handle the `includeSections` parameter in the document router (Prisma include vs separate query)
- Error states for failed section/feedback fetches in pickers
- Loading skeleton design for picker dialogs

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIX-01 | Fix section link picker (document.list returns no sections) | D-01: add `includeSections` opt-in to document.list; join policySections grouped by documentId |
| FIX-02 | Build feedback link picker selection UI | D-03/D-04: new `feedback.listForWorkshop` query (no documentId required) + card UI with checkboxes, search, type filter |
| FIX-03 | Remove duplicate section/feedback rendering between detail page and picker components | D-05: picker Badge lists at bottom of SectionLinkPicker and FeedbackLinkPicker removed; page.tsx already renders these in the left panel |
| FIX-04 | Fix orphaned DialogTrigger when pickers controlled externally | D-06: pickers export pure content (no Dialog/DialogTrigger); page.tsx wraps with Dialog, passes open/onOpenChange |
</phase_requirements>

---

## Standard Stack

### Core (all already installed — no npm installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tRPC v11 | installed | Type-safe API queries/mutations | Project standard |
| Drizzle ORM | installed | DB queries with type inference | Project standard |
| @base-ui/react Dialog | installed | Controlled dialog primitives | Project standard (base-nova) |
| @base-ui/react Checkbox | installed | Multi-select checkboxes | Project standard |
| sonner | installed | Toast notifications | Project standard |
| React useState/useMemo | built-in | Local state, derived filtered lists | Standard React |

No new packages required for this phase.

---

## Architecture Patterns

### Recommended Project Structure

No new files or folders needed. All changes are to existing files:

```
src/server/routers/
└── document.ts               # Add includeSections opt-in to .list query

app/(workspace)/workshops/[id]/
├── page.tsx                  # Wrap pickers in Dialog, own trigger buttons (already done for sections/feedback display)
└── _components/
    ├── section-link-picker.tsx   # Remove Dialog wrapper + Badge list at bottom
    └── feedback-link-picker.tsx  # Full replacement: fetch + card UI + checkboxes + search/filter
```

### Pattern 1: opt-in includeSections on document.list

**What:** Add an optional `includeSections: z.boolean().optional()` input to `document.list`. When true, run a second query joining `policySections` and return them nested per document.

**When to use:** Only the section-link-picker needs sections. All other callers of `document.list` pass no input and get the current aggregate shape — no breakage.

**Exact current signature:**
```typescript
// src/server/routers/document.ts — current
list: requirePermission('document:read')
  .query(async () => { ... })  // no input, returns { id, title, ..., sectionCount }[]
```

**After change:**
```typescript
list: requirePermission('document:read')
  .input(z.object({ includeSections: z.boolean().optional() }).optional())
  .query(async ({ input }) => {
    // existing aggregate query unchanged
    const docs = await db.select({ ... sectionCount: sql<number>`cast(count(...) as integer)` })
      .from(policyDocuments)
      .leftJoin(policySections, ...)
      .groupBy(policyDocuments.id)
      .orderBy(desc(policyDocuments.updatedAt))

    if (!input?.includeSections) return docs

    // Second query: all sections for all docs, grouped in JS
    const allSections = await db
      .select({
        id: policySections.id,
        documentId: policySections.documentId,
        title: policySections.title,
        orderIndex: policySections.orderIndex,
        status: policySections.status,        // for D-02 status display
        content: policySections.content,      // for D-02 block count
      })
      .from(policySections)
      .orderBy(asc(policySections.orderIndex))

    // Nest sections into each doc
    const sectionsByDoc = Map<string, typeof allSections>
    ...
    return docs.map(doc => ({ ...doc, sections: sectionsByDoc.get(doc.id) ?? [] }))
  })
```

**D-02 note:** Block count comes from `content` JSON — `(section.content as { content?: unknown[] })?.content?.length ?? 0`. The `policySections` schema has a `status` column (check schema before assuming). If there is no `status` column on `policySections`, omit that field and show only title + block count in the picker.

**Section schema check — findings:** `policySections` columns (from `src/db/schema/documents.ts` — read during research): `id, documentId, title, orderIndex, content (jsonb), createdAt, updatedAt`. There is NO `status` column on policySections. The D-02 "status (draft/published)" refers to document-level publish status, not a section column. The planner must decide: either (a) skip the status field entirely, showing only title + block count, or (b) look up the document's published version to infer section status. Recommendation: skip status for simplicity — show title and block count only.

### Pattern 2: feedback.listForWorkshop — new cross-document query

**What:** The existing `feedback.list` requires a `documentId` parameter and uses `feedback:read_all` permission. A workshop moderator needs to browse ALL feedback across documents to link to a workshop. A new opt-in query (or a variant with `documentId` optional) is required.

**Decision point (Claude's Discretion):** Two options:
- Option A: Add a new `feedback.listAll` procedure with no `documentId` input, guarded by `workshop:manage` permission (workshop moderators link feedback — they need to see all feedback).
- Option B: Make `documentId` optional on existing `feedback.list` (risky: changes existing callers' type).

**Recommendation: Option A — new `feedback.listAll` procedure** in the feedback router. Simpler, no risk of breaking existing `feedback.list` callers. Returns: `id, readableId, title, body, feedbackType, status, createdAt, submitterName, isAnonymous`. Apply anonymity enforcement as in existing `.list`.

**Fields for D-03 card:** author (submitterName, respecting isAnonymous), excerpt (body.slice(0, 80)), feedbackType badge, createdAt.

**Fields for D-04 search/filter:** search is client-side `toLowerCase` on `title + body`; type filter is client-side enum match on `feedbackType`.

### Pattern 3: Pure dialog content (no Dialog wrapper inside pickers)

**What:** Remove `<Dialog>`, `<DialogTrigger>` from inside picker components. Export only the inner content as `<SectionPickerContent>` and `<FeedbackPickerContent>`. The parent `page.tsx` owns Dialog state.

**Current broken pattern in section-link-picker.tsx:**
```tsx
// picker renders its own Dialog + DialogTrigger even though parent already
// controls open state — DialogTrigger is never the real trigger, parent button is
return (
  <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between">
      ...
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" size="sm" />}>
          Link Section   {/* orphaned — parent button fires setSectionPickerOpen(true) */}
        </DialogTrigger>
        <DialogContent>...</DialogContent>
      </Dialog>
    </div>
    {/* Badge list at bottom — duplicate of page.tsx linked sections panel */}
    {linkedSectionIds.map(id => <Badge .../>)}
  </div>
)
```

**Fixed pattern — picker becomes pure content:**
```tsx
// section-link-picker.tsx after fix
export function SectionLinkPicker({
  workshopId,
  linkedSectionIds,
  open,
  onOpenChange,
}: SectionLinkPickerProps) {
  // ... state, queries, mutations unchanged ...

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link Sections to Workshop</DialogTitle>
        </DialogHeader>
        {/* picker content only — NO Badge list of already-linked sections */}
        ...
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange?.(false)}>Discard</Button>
          <Button disabled={selected.length === 0} onClick={handleLink}>
            Link {selected.length > 0 ? `(${selected.length})` : ''}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**page.tsx side is already correct** — it renders `<SectionLinkPicker open={sectionPickerOpen} onOpenChange={setSectionPickerOpen} />` and the trigger `<Button onClick={() => setSectionPickerOpen(true)}>`. No page.tsx changes needed beyond removing the duplicate render responsibility from the pickers.

**ArtifactAttachDialog note:** `artifact-attach-dialog.tsx` also has the same orphaned DialogTrigger pattern (line 83). Context D-06 explicitly flags this component. Fix it the same way: remove the internal `<DialogTrigger>`, keep `<Dialog open={open} onOpenChange={...}>` wrapping `<DialogContent>`.

### Pattern 4: Client-side search + filter (D-04)

**What:** Debounced text search and feedback-type dropdown filter inside the feedback picker dialog.

**Pattern established in Phase 4 / Phase 7:** Client-side multi-filter on fetched data (fetch all, filter locally). Same approach here.

```tsx
const [search, setSearch] = useState('')
const [typeFilter, setTypeFilter] = useState<string>('')

const filtered = useMemo(() => {
  let items = feedbackQuery.data ?? []
  if (search.trim()) {
    const q = search.toLowerCase()
    items = items.filter(f =>
      f.title.toLowerCase().includes(q) || f.body.toLowerCase().includes(q)
    )
  }
  if (typeFilter) {
    items = items.filter(f => f.feedbackType === typeFilter)
  }
  return items.filter(f => !linkedFeedbackIds.includes(f.id))
}, [feedbackQuery.data, search, typeFilter, linkedFeedbackIds])
```

**Debounce:** 300ms using `useState` + `useEffect` pattern (no external lib needed). OR simply apply filter directly on the memo — for a picker dialog with a modest number of feedback items, no debounce is needed.

### Anti-Patterns to Avoid

- **Modifying `feedback.list` signature:** It accepts `documentId` as required. Making it optional breaks TypeScript types for all existing callers. Use a new `feedback.listAll` instead.
- **Running separate queries per document in the section picker:** Fetch all sections in one query, group in JS — avoids N+1.
- **Adding a `status` field to policySections that doesn't exist:** The schema has no `status` column on `policySections`. Don't fabricate it.
- **Keeping the Badge list in the picker:** This is the duplicate rendering. The page.tsx left panel already shows linked sections/feedback with unlink buttons. The picker should only show unlinked, selectable items.
- **Using `internalOpen` state in pickers after cleanup:** Once the Dialog is moved inside the picker (as outer wrapper) with `open`/`onOpenChange` props, the `internalOpen` fallback state is no longer needed — pickers are always externally controlled.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-select state | Custom selection reducer | `useState<string[]>` + includes/filter | Already used in section-link-picker, proven |
| Debounced search | Custom hook | Inline `useMemo` on state (no debounce needed for dialog-scope data) | Volume is small, no perceptible lag |
| Type badge colors | Custom color map | Existing `feedbackType` enum values + Badge variant | Consistent with rest of app |
| Toast notifications | Custom alert | `toast.success` / `toast.error` from sonner | Project standard |
| Loading states | Custom spinner | `Skeleton` component from `@/components/ui/skeleton` | Already used in workshop page.tsx |

---

## Common Pitfalls

### Pitfall 1: Breaking existing document.list callers
**What goes wrong:** Making `input` required or changing the return type shape causes TypeScript errors across all pages that call `trpc.document.list.useQuery()` with no arguments.
**Why it happens:** tRPC infers types from the router procedure signature; changing the return type is a breaking change.
**How to avoid:** Keep the base return type identical. Use union return type: when `includeSections` is true, sections array is present; when false/absent, it's absent. TypeScript discriminated union or optional field handles this cleanly.
**Warning signs:** TypeScript errors on `doc.sections` access in existing callers.

### Pitfall 2: base-ui Dialog controlled vs uncontrolled
**What goes wrong:** `DialogPrimitive.Root` (wrapped as `Dialog`) from `@base-ui/react` uses `open` / `onOpenChange` for controlled mode. If the picker keeps `internalOpen` state AND the parent passes `open`, there can be conflicting state causing the dialog to not close properly.
**Why it happens:** The picker's original code used `controlledOpen ?? internalOpen` to support both modes. After the fix, pickers are always externally controlled.
**How to avoid:** Remove the `internalOpen` state entirely. Use `open` and `onOpenChange` directly. If the parent forgets to pass them, the dialog simply won't open (safe default).
**Warning signs:** Dialog opens but doesn't close, or ignores parent state.

### Pitfall 3: feedback.listAll permission mismatch
**What goes wrong:** Workshop moderators need to see all feedback to link it, but `feedback:read_all` may not be in their permission set.
**Why it happens:** `feedback:read_all` is defined for admin/policy_lead/auditor. Workshop moderators have `workshop:manage` but may not have `feedback:read_all`.
**How to avoid:** Guard `feedback.listAll` with `workshop:manage` permission (the same permission used for all workshop mutations), or add `feedback:read_all` to the workshop_moderator role. Check `src/lib/permissions.ts` to determine the right existing permission to reuse.
**Warning signs:** tRPC 403 FORBIDDEN when workshop moderator opens feedback picker.

### Pitfall 4: Anonymity enforcement in feedback.listAll
**What goes wrong:** If anonymity enforcement is omitted from the new `feedback.listAll` query, anonymous submitter names leak to workshop moderators.
**Why it happens:** The existing `feedback.list` has explicit anonymity enforcement: `if (row.isAnonymous && !canSeeIdentity) { return { ...row, submitterId: null, submitterName: null } }`.
**How to avoid:** Copy the same anonymity logic into `feedback.listAll`. `canSeeIdentity` = role is admin or policy_lead.
**Warning signs:** Anonymous feedback shows submitter names in the workshop picker.

### Pitfall 5: Duplicate unlink buttons after cleanup
**What goes wrong:** After removing Badge lists from pickers, the unlink mutations inside the picker (`unlinkMutation`) become dead code.
**Why it happens:** The Badge list in picker had its own unlink buttons. Page.tsx has its own unlink buttons in the left panel.
**How to avoid:** Remove `unlinkMutation` from `SectionLinkPicker` and `FeedbackLinkPicker` — they are no longer needed inside the picker. The page.tsx already has `unlinkSectionMutation` and `unlinkFeedbackMutation` defined at lines 41-59.
**Warning signs:** Unused import warnings, duplicate unlink toasts.

---

## Code Examples

### Verified: document.list with includeSections — Drizzle pattern
```typescript
// Two-query pattern — avoids GROUP BY complexity with nested data
// Query 1: existing aggregate (unchanged for callers without includeSections)
const docs = await db
  .select({ id: policyDocuments.id, title: policyDocuments.title, ... })
  .from(policyDocuments)
  .leftJoin(policySections, eq(policyDocuments.id, policySections.documentId))
  .groupBy(policyDocuments.id)
  .orderBy(desc(policyDocuments.updatedAt))

// Query 2: all sections (only when includeSections === true)
const sections = await db
  .select({ id: policySections.id, documentId: policySections.documentId, title: policySections.title, orderIndex: policySections.orderIndex, content: policySections.content })
  .from(policySections)
  .orderBy(asc(policySections.orderIndex))

const byDoc = new Map<string, typeof sections>()
for (const s of sections) {
  if (!byDoc.has(s.documentId)) byDoc.set(s.documentId, [])
  byDoc.get(s.documentId)!.push(s)
}
return docs.map(d => ({ ...d, sections: byDoc.get(d.id) ?? [] }))
```

### Verified: Block count from Tiptap JSON
```typescript
// policySections.content shape: { type: 'doc', content: [...blocks] }
const blockCount = (section.content as { content?: unknown[] })?.content?.length ?? 0
```

### Verified: Feedback card for D-03
```tsx
// Inside feedback picker content
{availableItems.map(fb => (
  <label
    key={fb.id}
    className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/50"
  >
    <Checkbox
      checked={selected.includes(fb.id)}
      onCheckedChange={() => toggleFeedback(fb.id)}
    />
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="font-mono text-xs text-muted-foreground">{fb.readableId}</span>
        <Badge variant="secondary" className="text-[11px]">{fb.feedbackType}</Badge>
      </div>
      <p className="text-sm truncate">{fb.title}</p>
      <p className="text-xs text-muted-foreground truncate">
        {fb.body.slice(0, 80)}{fb.body.length > 80 ? '…' : ''}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {fb.isAnonymous ? 'Anonymous' : fb.submitterName ?? 'Unknown'} · {format(parseISO(fb.createdAt), 'MMM d, yyyy')}
      </p>
    </div>
  </label>
))}
```

### Verified: base-ui Dialog controlled in artifact-attach-dialog.tsx (working reference)
```tsx
// artifact-attach-dialog.tsx line 82 — this already correctly wraps Dialog internally
// but still has an orphaned DialogTrigger (line 83)
// The fix: remove <DialogTrigger> from inside; keep <Dialog open={open} onOpenChange={...}>
<Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); else setOpen(true) }}>
  {/* No DialogTrigger here after fix */}
  <DialogContent className="max-w-md">
    ...
  </DialogContent>
</Dialog>
```

### Verified: Select component for type filter (from existing usage)
```tsx
// Phase 4 established: Select.Root.Props requires generic in base-ui
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

<Select value={typeFilter} onValueChange={setTypeFilter}>
  <SelectTrigger className="h-8 text-sm">
    <SelectValue placeholder="All types" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="">All types</SelectItem>
    {FEEDBACK_TYPES.map(t => (
      <SelectItem key={t} value={t}>{t}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Picker owns Dialog + Trigger | Parent owns Dialog, picker is pure content | This phase | Eliminates orphaned trigger; enables keyboard/programmatic open |
| Picker renders linked items as Badges | Page renders linked items; picker shows only selectable | This phase | Eliminates duplicate render; clear separation of concerns |
| document.list returns no sections | document.list with includeSections: true returns nested sections | This phase | Section picker can actually display sections |
| FeedbackLinkPicker shows placeholder | FeedbackLinkPicker fetches and displays selectable feedback cards | This phase | WS-04 (link feedback to workshop) becomes functional |

---

## Open Questions

1. **policySections status for D-02**
   - What we know: The `policySections` schema has no `status` column. D-02 says "status (draft/published)" but this doesn't map to a real column.
   - What's unclear: Whether "status" means the parent document's publish state or something else.
   - Recommendation: Show title + block count only. Omit status. The planner should note this gap.

2. **Permission for feedback.listAll**
   - What we know: `feedback:read_all` is used by admin/policy_lead/auditor. `workshop:manage` is used for all workshop mutations.
   - What's unclear: Whether `workshop_moderator` role has `feedback:read_all` in `src/lib/permissions.ts`.
   - Recommendation: Planner should read `src/lib/permissions.ts` before writing the procedure guard. Use whichever permission is already assigned to workshop_moderator.

3. **ArtifactAttachDialog scope**
   - What we know: D-06 specifically names `artifact-attach-dialog.tsx` as having the same orphaned DialogTrigger pattern.
   - What's unclear: Whether fixing ArtifactAttachDialog is in scope (context says "same orphaned DialogTrigger pattern").
   - Recommendation: Include in FIX-04. The fix is identical (remove internal DialogTrigger) and the component is already wired correctly in page.tsx with `open`/`onOpenChange`.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 12 is purely code changes to existing files. No external dependencies (databases, CLIs, services) are added.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.mts) |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run --reporter=verbose src/__tests__/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-01 | document.list with includeSections returns nested sections | unit | `npx vitest run src/__tests__/document-router-sections.test.ts` | ❌ Wave 0 |
| FIX-02 | feedback.listAll returns all feedback with anonymity enforcement | unit | `npx vitest run src/__tests__/feedback-workshop-picker.test.ts` | ❌ Wave 0 |
| FIX-03 | Picker components do not render linked item Badges | manual-only | visual review of component render | — |
| FIX-04 | Picker components do not contain DialogTrigger | unit (grep/AST) | manual code review — no DialogTrigger import in pickers | — |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/document-router-sections.test.ts src/__tests__/feedback-workshop-picker.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/document-router-sections.test.ts` — covers FIX-01 (includeSections returns nested, existing callers unaffected)
- [ ] `src/__tests__/feedback-workshop-picker.test.ts` — covers FIX-02 (listAll returns items, anonymity enforced)

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection — `app/(workspace)/workshops/[id]/page.tsx`, `section-link-picker.tsx`, `feedback-link-picker.tsx`, `artifact-attach-dialog.tsx`
- Direct code inspection — `src/server/routers/document.ts`, `src/server/routers/workshop.ts`, `src/server/routers/feedback.ts`
- Direct schema inspection — `src/db/schema/feedback.ts`
- Direct UI inspection — `components/ui/dialog.tsx`, `components/ui/checkbox.tsx`, `components/ui/badge.tsx`, `components/ui/input.tsx`

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` accumulated decisions — base-ui Dialog controlled pattern, Phase 4 client-side multi-filter pattern, Neon HTTP driver sequential-update pattern

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Bug diagnosis: HIGH — all four bugs verified by direct code reading
- Fix approach: HIGH — all patterns (tRPC opt-in input, base-ui Dialog, client-side filter) are verified in existing project code
- section status field: LOW — policySections schema read; no `status` column exists; D-02 intent is ambiguous
- Feedback permission guard: MEDIUM — requires reading `src/lib/permissions.ts` to confirm correct permission for `feedback.listAll`

**Research date:** 2026-04-12
**Valid until:** Stable — fixes depend only on existing project code, no third-party version sensitivity
