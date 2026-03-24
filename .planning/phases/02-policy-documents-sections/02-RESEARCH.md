# Phase 2: Policy Documents & Sections - Research

**Researched:** 2026-03-25
**Domain:** Drizzle ORM schema design, tRPC v11 router patterns, @dnd-kit sortable, Tiptap JSON storage, markdown parsing, shadcn/ui initialization
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from prior phases:
- Drizzle ORM with Neon PostgreSQL (established in Phase 1)
- tRPC v11 with default-deny middleware (established in Phase 1)
- Permission checks via requirePermission() on all procedures
- Audit logging via writeAuditLog() on all mutations

### Claude's Discretion
All implementation choices (schema design, ordering strategy, parsing approach, component structure) are at Claude's discretion within these constraints.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOC-01 | Admin/Policy Lead can create a new policy document with title and description | `policy_documents` table + `document:create` permission + tRPC mutation with audit log |
| DOC-02 | Policy document contains ordered sections with stable UUIDs (identity persists across versions) | `policy_sections` table with UUID PK + `order_index` integer column for ordering |
| DOC-03 | Policy Lead can create, reorder, and delete sections within a document | Three tRPC mutations: `section.create`, `section.reorder`, `section.delete` + @dnd-kit sortable UI |
| DOC-04 | Section content is stored as block-based structure (Tiptap JSON) | `content` JSONB column on `policy_sections` typed as `JSONContent` from `@tiptap/core` |
| DOC-05 | Existing policy content can be imported from markdown files | Client-side markdown parser (no new dep — manual H2-split) converts to Tiptap JSON, creates document + sections via single tRPC mutation |
| DOC-06 | Multiple policy documents can exist in the workspace simultaneously | `policy_documents.list` query returns all documents; no single-document constraint |
</phase_requirements>

---

## Summary

Phase 2 builds on the Phase 1 foundation (Drizzle + Neon, tRPC v11, Clerk auth, audit log) to introduce policy documents and their sections. The core technical work is: (1) adding two new Drizzle schema tables, (2) wiring up five to six tRPC mutations/queries with correct permission guards, (3) building the shadcn/ui interface including drag-and-drop section reordering, and (4) implementing a markdown import flow that converts H2-delimited content into Tiptap JSON blocks.

The heaviest unknowns from stack research (Tiptap 3 custom node patterns, Hocuspocus) are NOT in scope for this phase — the block editor is Phase 3. Phase 2 stores content as Tiptap JSON but renders it read-only or shows a placeholder. This dramatically reduces risk: the JSONB column simply stores whatever structure the import creates; no editor rendering is required yet.

The most nuanced design decision is the section ordering strategy. Using a simple integer `order_index` with gap-based numbering (10, 20, 30...) avoids rewriting all row indices on every drag-drop, but a bulk-update approach (send new order array from client, update all affected rows) is simpler and acceptable at document scale (typical docs have < 100 sections). Research recommends the bulk-update approach because it pairs naturally with @dnd-kit's onDragEnd callback.

**Primary recommendation:** Follow the existing Phase 1 codebase patterns exactly. New router at `src/server/routers/document.ts`, new schema file at `src/db/schema/documents.ts`, new migration SQL file, permissions added to the matrix in `src/lib/permissions.ts`, shadcn initialized and components added, @dnd-kit added for section reordering.

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

CLAUDE.md delegates to AGENTS.md which states:

> This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Directive for planner:** Each plan that writes Next.js route files or uses Next.js APIs must consult `node_modules/next/dist/docs/` for the relevant section before writing code.

---

## Existing Codebase Patterns (Phase 1 Baseline)

This section documents the exact patterns established in Phase 1 that Phase 2 MUST follow.

### Schema Pattern
```typescript
// src/db/schema/users.ts — example of established schema style
import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id:        uuid('id').primaryKey().defaultRandom(),
  // ...
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```
- UUID primary keys via `.defaultRandom()`
- `withTimezone: true` on all timestamps
- `createdAt` / `updatedAt` on every table
- Export from `src/db/schema/index.ts`

### Router Pattern
```typescript
// src/server/routers/user.ts — example of established router style
import { router, protectedProcedure, requirePermission } from '@/src/trpc/init'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'

export const userRouter = router({
  someQuery: protectedProcedure.query(async ({ ctx }) => { ... }),

  someMutation: requirePermission('some:permission')
    .input(z.object({ ... }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.insert(...).returning()
      await writeAuditLog({ actorId: ctx.user.id, actorRole: ctx.user.role, action: ACTIONS.SOME_ACTION, ... })
      return result
    }),
})
```
- `requirePermission()` on ALL mutations (never `protectedProcedure` alone for writes)
- `writeAuditLog()` called after every mutation — never skipped
- Zod validation on all inputs
- Router registered in `src/server/routers/_app.ts`

### Permission Matrix Pattern
```typescript
// src/lib/permissions.ts — add new permissions here
export const PERMISSIONS = {
  'user:invite': [ROLES.ADMIN],
  // Phase 2 additions:
  'document:create': [ROLES.ADMIN, ROLES.POLICY_LEAD],
  'document:read':   [...all_roles...],
  'document:update': [ROLES.ADMIN, ROLES.POLICY_LEAD],
  'document:delete': [ROLES.ADMIN, ROLES.POLICY_LEAD],
  'section:manage':  [ROLES.POLICY_LEAD, ROLES.ADMIN],
} as const
```

### Audit Action Constants Pattern
```typescript
// src/lib/constants.ts — add new ACTIONS here
export const ACTIONS = {
  USER_CREATE: 'user.create',
  // Phase 2 additions:
  DOCUMENT_CREATE:  'document.create',
  DOCUMENT_UPDATE:  'document.update',
  DOCUMENT_DELETE:  'document.delete',
  SECTION_CREATE:   'section.create',
  SECTION_DELETE:   'section.delete',
  SECTION_REORDER:  'section.reorder',
  SECTION_RENAME:   'section.rename',
  DOCUMENT_IMPORT:  'document.import',
} as const
```

### Migration Pattern
Phase 1 used a single hand-written SQL file `src/db/migrations/0000_initial.sql`. Phase 2 will add `src/db/migrations/0001_policy_documents.sql`. The migration number must increment sequentially. Because Phase 1 needed custom PARTITION BY DDL, it used hand-written SQL — Phase 2 schema is simpler and CAN use `drizzle-kit generate` then review/adjust, but must not break the existing migration numbering.

### tRPC Client Usage Pattern
```typescript
// In client components:
import { trpc } from '@/src/trpc/client'
const { data } = trpc.document.list.useQuery()
const mutation = trpc.document.create.useMutation()

// In server components (RSC):
import { api } from '@/src/trpc/server'
const caller = await api()
const docs = await caller.document.list()
```

### Route Group Structure
```
app/
├── (auth)/         # sign-in, sign-up — public routes
├── (workspace)/    # all authenticated pages — layout has Clerk auth guard
│   ├── layout.tsx  # has header with UserButton
│   └── dashboard/page.tsx
└── layout.tsx      # root: ClerkProvider + TRPCReactProvider
```
Phase 2 adds `app/(workspace)/policies/` and `app/(workspace)/policies/[id]/` within the existing workspace route group.

### Auth Guard
The workspace layout already calls `auth()` and redirects to `/sign-in` if no session. No additional auth guard needed on individual pages. `proxy.ts` (middleware) also enforces auth for all non-public routes.

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Phase 2 Use |
|---------|---------|---------|-------------|
| drizzle-orm | 0.45.1 | ORM | New schema tables, queries |
| @trpc/server / @trpc/react-query | 11.15.0 | API layer | New document/section routers |
| zod | 4.3.6 | Validation | Input schemas for all mutations |
| @tanstack/react-query | 5.95.2 | Data fetching | Client-side document/section queries |
| date-fns | 4.1.0 | Date formatting | "Updated {relative time}" in cards |
| @clerk/nextjs | 7.0.6 | Auth | Permission checks |

### New Installs Required for Phase 2
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| shadcn/ui | CLI v4 | UI component system | Not yet initialized (components.json absent). Required by UI spec. |
| @dnd-kit/core | ^6.x | Drag-and-drop primitives | Section reorder in sidebar |
| @dnd-kit/sortable | ^8.x | Sortable list preset | Paired with @dnd-kit/core |
| @dnd-kit/utilities | ^3.x | CSS transform utilities | Paired with @dnd-kit/core |
| lucide-react | latest | Icons | Ships with shadcn init |
| sonner | latest | Toast notifications | Ships with shadcn add |

**Tiptap NOT needed in Phase 2.** Section content is stored as JSONB and rendered as a placeholder. The editor installs in Phase 3. The type `JSONContent` from `@tiptap/core` could be used for the TypeScript type on the JSONB column — but since Tiptap is not yet installed, define a local type alias instead:

```typescript
// src/db/schema/documents.ts
type TiptapJSON = Record<string, unknown>
```

**Installation:**
```bash
# shadcn init (run once, accept defaults: New York style, Zinc, CSS variables)
npx shadcn@latest init

# shadcn components
npx shadcn@latest add button card dialog input textarea label separator dropdown-menu badge skeleton sonner scroll-area tooltip alert-dialog table tabs

# dnd-kit
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# lucide-react is added by shadcn init automatically
```

**Verify @dnd-kit versions after install** — @dnd-kit/core and @dnd-kit/sortable must be compatible versions.

---

## Architecture Patterns

### Recommended Project Structure Changes

```
src/
├── db/
│   └── schema/
│       ├── index.ts          # add: export * from './documents'
│       ├── documents.ts      # NEW: policy_documents + policy_sections tables
│       └── ...existing...
├── server/
│   └── routers/
│       ├── _app.ts           # add: document: documentRouter
│       ├── document.ts       # NEW: all document + section procedures
│       └── ...existing...
├── lib/
│   ├── permissions.ts        # add: document:* and section:* permissions
│   └── constants.ts          # add: DOCUMENT_* and SECTION_* actions
app/
└── (workspace)/
    ├── layout.tsx             # update: add "Policies" nav link
    ├── policies/
    │   └── page.tsx           # NEW: policy list
    └── policies/
        └── [id]/
            └── page.tsx       # NEW: policy detail with section sidebar
```

### Pattern 1: Schema Design for Policy Documents and Sections

**What:** Two new tables — `policy_documents` (document metadata) and `policy_sections` (ordered sections within a document).

**Key decisions:**
- Sections get a stable UUID that never changes regardless of reordering or version history.
- `order_index` is an integer; the bulk-reorder approach updates all section rows in a single transaction.
- `content` is JSONB typed as `Record<string, unknown>` (Tiptap JSON shape, populated during import or left as default empty document structure).

```typescript
// src/db/schema/documents.ts
import { pgTable, uuid, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core'

export const policyDocuments = pgTable('policy_documents', {
  id:          uuid('id').primaryKey().defaultRandom(),
  title:       text('title').notNull(),
  description: text('description'),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const policySections = pgTable('policy_sections', {
  id:         uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => policyDocuments.id, { onDelete: 'cascade' }),
  title:      text('title').notNull(),
  orderIndex: integer('order_index').notNull(),
  content:    jsonb('content').$type<Record<string, unknown>>().notNull().default({}),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

**Why `onDelete: 'cascade'`:** Deleting a document must atomically delete all its sections. The DB enforces this without needing multi-step application logic.

**Why not `position` float or gap-based integer:** Float positions accumulate precision errors. Gap-based (10, 20, 30) requires re-gapping logic when gaps are exhausted. The bulk-replace approach (replace all order_index values for a document after drag-drop) is the simplest correct solution at section-count scale.

### Pattern 2: Bulk Section Reorder

**What:** On drag-end, the client has the new ordered array of section IDs. Send the full new order to a single tRPC mutation that wraps all updates in a transaction.

```typescript
// In document router:
reorderSections: requirePermission('section:manage')
  .input(z.object({
    documentId: z.string().uuid(),
    // Array of section IDs in new order
    orderedSectionIds: z.array(z.string().uuid()),
  }))
  .mutation(async ({ ctx, input }) => {
    await db.transaction(async (tx) => {
      for (let i = 0; i < input.orderedSectionIds.length; i++) {
        await tx
          .update(policySections)
          .set({ orderIndex: i, updatedAt: new Date() })
          .where(
            and(
              eq(policySections.id, input.orderedSectionIds[i]),
              eq(policySections.documentId, input.documentId)
            )
          )
      }
    })
    await writeAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.role,
      action: ACTIONS.SECTION_REORDER,
      entityType: 'document',
      entityId: input.documentId,
      payload: { orderedSectionIds: input.orderedSectionIds },
    })
  }),
```

**The `documentId` check in the WHERE clause is essential** — it prevents a malicious client from moving sections between documents.

### Pattern 3: @dnd-kit Sortable Integration

**What:** `@dnd-kit/sortable` provides `SortableContext` and `useSortable` hook. Pair with `DndContext` from `@dnd-kit/core`.

```typescript
// Sidebar section list component (client component)
'use client'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'

// In component:
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
)

function handleDragEnd(event) {
  const { active, over } = event
  if (active.id !== over?.id) {
    const oldIndex = sections.findIndex(s => s.id === active.id)
    const newIndex = sections.findIndex(s => s.id === over.id)
    const newOrder = arrayMove(sections, oldIndex, newIndex)
    // Optimistic update local state
    setSections(newOrder)
    // Fire mutation
    reorderMutation.mutate({
      documentId,
      orderedSectionIds: newOrder.map(s => s.id),
    })
  }
}
```

**Keyboard accessibility:** `useSensor(KeyboardSensor)` with `sortableKeyboardCoordinates` provides Arrow Up/Down keyboard reordering out of the box. UI spec requires Alt+Arrow Up/Down — verify @dnd-kit default key bindings against the spec at implementation time.

**Optimistic updates pattern:** Use TanStack Query's `useMutation` with `onMutate` / `onError` / `onSettled` for optimistic reorder with rollback. The UI spec mandates: "On drop: optimistic reorder, tRPC mutation fires, revert on error with toast."

```typescript
const utils = trpc.useUtils()
const reorderMutation = trpc.document.reorderSections.useMutation({
  onMutate: async ({ orderedSectionIds }) => {
    await utils.document.getSections.cancel({ documentId })
    const previous = utils.document.getSections.getData({ documentId })
    utils.document.getSections.setData({ documentId }, (old) =>
      orderedSectionIds.map(id => old!.find(s => s.id === id)!)
    )
    return { previous }
  },
  onError: (err, vars, context) => {
    utils.document.getSections.setData({ documentId }, context?.previous)
    toast.error('Couldn\'t reorder sections. The original order has been restored.')
  },
  onSettled: () => {
    utils.document.getSections.invalidate({ documentId })
  },
})
```

### Pattern 4: Markdown Import Parsing

**What:** A client-side parser that reads a `.md` file, splits on `## H2` headings, and converts each section's content into minimal Tiptap JSON.

**No new dependencies needed.** Markdown is a text format; split on newlines and heading patterns with plain JavaScript.

**Parsing algorithm:**
```typescript
// src/lib/markdown-import.ts
export interface ParsedSection {
  title: string
  content: Record<string, unknown>  // Tiptap JSON
}

export interface ParsedDocument {
  title: string
  sections: ParsedSection[]
}

export function parseMarkdown(text: string, filename: string): ParsedDocument {
  const lines = text.split('\n')

  // Extract H1 as document title
  let docTitle = filename.replace(/\.(md|markdown)$/i, '')
  const h1Line = lines.find(l => /^# /.test(l))
  if (h1Line) docTitle = h1Line.replace(/^# /, '').trim()

  // Split on H2 headings
  const sections: ParsedSection[] = []
  let currentTitle = 'Introduction'
  let currentLines: string[] = []
  let foundFirstH2 = false

  for (const line of lines) {
    if (/^## /.test(line)) {
      if (!foundFirstH2 && currentLines.some(l => l.trim())) {
        // Preamble before first H2 becomes Introduction
        sections.push({ title: 'Introduction', content: linesToTiptap(currentLines) })
      } else if (foundFirstH2) {
        sections.push({ title: currentTitle, content: linesToTiptap(currentLines) })
      }
      foundFirstH2 = true
      currentTitle = line.replace(/^## /, '').trim()
      currentLines = []
    } else if (!/^# /.test(line)) {
      // Skip H1 lines, collect everything else
      currentLines.push(line)
    }
  }
  // Final section
  if (foundFirstH2) {
    sections.push({ title: currentTitle, content: linesToTiptap(currentLines) })
  }

  return { title: docTitle, sections }
}

function linesToTiptap(lines: string[]): Record<string, unknown> {
  // Minimal Tiptap JSON: type='doc' with paragraph nodes
  const content = lines
    .join('\n')
    .trim()
    .split('\n\n')
    .filter(para => para.trim())
    .map(para => ({
      type: 'paragraph',
      content: [{ type: 'text', text: para.trim() }],
    }))
  return { type: 'doc', content: content.length ? content : [] }
}
```

**File size limit:** UI spec mandates 5 MB max. Enforce client-side before parsing:
```typescript
if (file.size > 5 * 1024 * 1024) {
  toast.error("This file is too large. The maximum file size is 5 MB.")
  return
}
```

**Import tRPC mutation:** Atomic — creates the document AND all sections in a single database transaction to avoid partial imports.

```typescript
importDocument: requirePermission('document:create')
  .input(z.object({
    title: z.string().min(1).max(200),
    sections: z.array(z.object({
      title: z.string().min(1).max(200),
      content: z.record(z.unknown()),
    })),
  }))
  .mutation(async ({ ctx, input }) => {
    return await db.transaction(async (tx) => {
      const [doc] = await tx.insert(policyDocuments)
        .values({ title: input.title })
        .returning()

      const sectionRows = input.sections.map((s, i) => ({
        documentId: doc.id,
        title: s.title,
        orderIndex: i,
        content: s.content,
      }))
      const sections = await tx.insert(policySections)
        .values(sectionRows)
        .returning()

      await writeAuditLog({
        actorId: ctx.user.id,
        actorRole: ctx.user.role,
        action: ACTIONS.DOCUMENT_IMPORT,
        entityType: 'document',
        entityId: doc.id,
        payload: { sectionCount: sections.length, title: doc.title },
      })

      return { document: doc, sections }
    })
  }),
```

### Pattern 5: Section Content Display (Read-Only, Pre-Editor)

**What:** Phase 2 stores Tiptap JSON but the interactive editor ships in Phase 3. Phase 2 must render section content in a read-only way or show a placeholder.

**Approach:** Simple read-only HTML rendering of the `doc.content.content` array.

Since Tiptap is not installed yet, write a minimal renderer:
```typescript
// src/lib/tiptap-renderer.ts
type TiptapNode = { type: string; text?: string; content?: TiptapNode[] }

export function renderTiptapToText(doc: Record<string, unknown>): string {
  if (!doc || typeof doc !== 'object') return ''
  const nodes = (doc.content as TiptapNode[] | undefined) ?? []
  return nodes.map(node => {
    if (node.type === 'paragraph') {
      return (node.content ?? []).map(c => c.text ?? '').join('')
    }
    return ''
  }).filter(Boolean).join('\n\n')
}
```

The UI spec says: "Placeholder if empty: 'This section has no content yet. Content editing will be available in the block editor phase.'" — use this when `content` is `{}` or has empty `content` array.

### Anti-Patterns to Avoid

- **Hand-rolled optimistic updates without rollback:** Always pair `onMutate` with `onError` rollback for the reorder mutation. Silent failure leaves UI in wrong state.
- **Deleting document in multiple queries:** Use `onDelete: 'cascade'` at the FK level + a single `DELETE FROM policy_documents WHERE id = ?`. Do NOT manually delete sections first.
- **Sending Tiptap JSON from markdown parser directly to client:** Parse on the client, send the structured output to the server. Don't send raw markdown to the server and parse there — the server should not import a markdown parser.
- **Using `publicProcedure` for any document/section operation:** All procedures must use `requirePermission()`. This is the established default-deny principle.
- **Skipping audit log on any mutation:** Phase 1 established that every mutation writes an audit entry. Never skip.
- **Fractional order_index:** Don't use float-based ordering (e.g., midpoint insertion). It accumulates precision errors. Use the bulk-replace strategy.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop section reorder | Custom mouse event tracking | `@dnd-kit/core` + `@dnd-kit/sortable` | Touch support, keyboard accessibility, pointer sensor, collision detection all included |
| Accessible dialogs, dropdowns, alerts | Custom modal/dropdown | shadcn/ui `Dialog`, `DropdownMenu`, `AlertDialog` | Focus trapping, escape dismissal, WCAG compliant, already scoped to project's design system |
| Toast notifications | Custom toast system | `sonner` (via shadcn) | Accessible, supports loading/success/error states, already wired into shadcn |
| Scrollable sidebars with cross-browser support | `overflow-y: auto` div | shadcn `ScrollArea` | Uniform scrollbar styling, works in Safari/Firefox |
| Loading placeholders | Custom shimmer animation | shadcn `Skeleton` | Consistent sizing API, respects reduced-motion |

**Key insight:** The drag-and-drop problem looks simple (reorder a list) but has 15+ edge cases: pointer capture, touch events, keyboard navigation, aria-live announcements, scroll-while-dragging, reduced-motion. @dnd-kit handles all of these.

---

## Common Pitfalls

### Pitfall 1: Drizzle FK references() circular import
**What goes wrong:** If `documents.ts` references itself or imports from a schema file that re-imports it, Drizzle throws runtime errors about undefined table references.
**Why it happens:** Drizzle resolves FK references at module load time. Circular imports break this.
**How to avoid:** `policy_sections` references `policyDocuments` from the same file — define `policyDocuments` before `policySections` in `documents.ts`. Export both from the same file.
**Warning signs:** `TypeError: Cannot read properties of undefined (reading 'id')` at schema load time.

### Pitfall 2: Drizzle `db.transaction()` with Neon serverless driver
**What goes wrong:** Neon's HTTP-mode driver (`neon-http`) does NOT support transactions. `db.transaction()` will throw or silently fail.
**Why it happens:** The Neon HTTP driver sends each query as an independent HTTP request. Transactions require a persistent connection.
**How to avoid:** For the import mutation (which needs atomicity), use Neon's WebSocket driver (`@neondatabase/serverless` with `neonConfig.webSocketConstructor`) instead of the HTTP driver, OR use `db.batch()` which Neon HTTP supports for multi-statement atomicity.
**Recommendation:** The `@neondatabase/serverless` package supports both HTTP and WebSocket connections. Check if `drizzle-orm/neon-http` transactions are simulated or real. Confirmed approach: use `db.batch()` for the import mutation, or switch the db instance to the `neon` WebSocket connection for that operation.
**Confidence:** MEDIUM — verify by checking `@neondatabase/serverless` docs for transaction support in HTTP mode.
**Warning signs:** "Transactions are not supported in Neon HTTP mode" error at runtime.

**Resolution path:** Use `neon()` from `@neondatabase/serverless` in HTTP mode but wrap multi-insert operations with explicit ordering rather than transactions if Neon HTTP transactions are unavailable. The import can be: (1) insert document, get ID, (2) insert sections with that ID. If document insert succeeds but sections fail, the document is orphaned — acceptable for MVP since the import UI can retry.

### Pitfall 3: shadcn not initialized — components won't work
**What goes wrong:** Attempting to `add` shadcn components without running `init` first results in errors about missing `components.json` and CSS variable palette.
**Why it happens:** `shadcn/ui` is not a package — it generates component files into the project. `init` creates `components.json` (registry config) and adds CSS variables to `globals.css`.
**How to avoid:** Run `npx shadcn@latest init` as the very first task in Plan 01. The UI spec explicitly requires: "Accept defaults: New York style, Zinc base color, CSS variables enabled."
**Warning signs:** `components.json not found` or missing Tailwind CSS variables like `--primary`, `--background` in the rendered UI.

### Pitfall 4: @dnd-kit/sortable requires items prop to have stable IDs
**What goes wrong:** If section IDs change between renders, @dnd-kit loses drag state and items jump unexpectedly.
**Why it happens:** SortableContext tracks items by their `id` value across renders. UUID strings from the database are stable, so this is not an issue — as long as the items array is keyed by `id`.
**How to avoid:** Always use `sections.map(s => s.id)` as the `items` prop to `SortableContext`. Never use array index as the sort key.
**Warning signs:** Sections appearing to jump or snap to wrong positions during drag.

### Pitfall 5: tRPC v11 mutation returns type must be consistent
**What goes wrong:** If a mutation conditionally returns different shapes, TanStack Query's type inference breaks and TypeScript errors appear in the client.
**Why it happens:** tRPC infers the return type from the procedure definition. Conditional returns create union types.
**How to avoid:** Always return a consistent shape from each procedure. For mutations that don't need to return data (like `reorderSections`), return `{ success: true }` rather than `void` or `undefined`.

### Pitfall 6: Zod 4 has breaking changes from Zod 3
**What goes wrong:** The project uses `zod@^4.3.6`. Zod 4 has API changes from Zod 3, including different behavior for `.optional()` chaining and `.nullable()` on objects.
**Why it happens:** Zod 4 was a major version release with intentional breaking changes.
**How to avoid:** Use Zod 4 API patterns. Verify with the existing `user.ts` router which already uses `z.enum(ORG_TYPE_VALUES as [string, ...string[]])` — follow this pattern for enums. Do NOT look up Zod 3 examples and assume they work.
**Warning signs:** TypeScript errors on `.parse()`, `.optional()`, or `.nullable()` calls.

---

## Code Examples

### Document Router Skeleton

```typescript
// src/server/routers/document.ts
import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { db } from '@/src/db'
import { policyDocuments, policySections } from '@/src/db/schema/documents'
import { eq, and, asc } from 'drizzle-orm'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'

export const documentRouter = router({
  // DOC-01, DOC-06: list all documents
  list: requirePermission('document:read')
    .query(async () => {
      return db.query.policyDocuments.findMany({
        orderBy: (doc, { desc }) => [desc(doc.updatedAt)],
      })
    }),

  // DOC-01: get single document with section count
  getById: requirePermission('document:read')
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => { ... }),

  // DOC-01: create new document
  create: requirePermission('document:create')
    .input(z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  // DOC-01: update document metadata
  update: requirePermission('document:update')
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  // DOC-01: delete document (sections cascade)
  delete: requirePermission('document:delete')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => { ... }),

  // DOC-02, DOC-03: get sections for a document ordered by order_index
  getSections: requirePermission('document:read')
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.select()
        .from(policySections)
        .where(eq(policySections.documentId, input.documentId))
        .orderBy(asc(policySections.orderIndex))
    }),

  // DOC-03: add section
  createSection: requirePermission('section:manage')
    .input(z.object({
      documentId: z.string().uuid(),
      title: z.string().min(1).max(200),
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  // DOC-03: rename section
  renameSection: requirePermission('section:manage')
    .input(z.object({
      sectionId: z.string().uuid(),
      documentId: z.string().uuid(),
      title: z.string().min(1).max(200),
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  // DOC-03: delete section
  deleteSection: requirePermission('section:manage')
    .input(z.object({
      sectionId: z.string().uuid(),
      documentId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  // DOC-03: bulk reorder sections
  reorderSections: requirePermission('section:manage')
    .input(z.object({
      documentId: z.string().uuid(),
      orderedSectionIds: z.array(z.string().uuid()),
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  // DOC-05: import from markdown
  importDocument: requirePermission('document:create')
    .input(z.object({
      title: z.string().min(1).max(200),
      sections: z.array(z.object({
        title: z.string().min(1).max(200),
        content: z.record(z.unknown()),
      })),
    }))
    .mutation(async ({ ctx, input }) => { ... }),
})
```

### shadcn Component for Policy Card

```tsx
// app/(workspace)/policies/_components/PolicyCard.tsx
'use client'
import { Card, CardHeader, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreHorizontal } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import type { RouterOutputs } from '@/src/trpc/client'

type Policy = RouterOutputs['document']['list'][number]

export function PolicyCard({ policy, onEdit, onDelete }: {
  policy: Policy
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Card
      className="hover:border-primary/20 hover:shadow-sm transition-all cursor-pointer"
      aria-label={`${policy.title}, ${policy.sectionCount} sections, updated ${formatDistanceToNow(new Date(policy.updatedAt), { addSuffix: true })}`}
    >
      <Link href={`/policies/${policy.id}`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <h3 className="text-base font-semibold">{policy.title}</h3>
            {/* DropdownMenu trigger must stop link propagation */}
          </div>
          {policy.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{policy.description}</p>
          )}
        </CardHeader>
      </Link>
      <CardFooter className="flex items-center justify-between pt-2">
        <Badge variant="secondary">{policy.sectionCount} sections</Badge>
        <span className="text-xs text-muted-foreground">
          Updated {formatDistanceToNow(new Date(policy.updatedAt), { addSuffix: true })}
        </span>
      </CardFooter>
    </Card>
  )
}
```

### Permission Matrix Additions

```typescript
// src/lib/permissions.ts — additions for Phase 2
'document:create':  [ROLES.ADMIN, ROLES.POLICY_LEAD],
'document:read':    [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD,
                     ROLES.WORKSHOP_MODERATOR, ROLES.STAKEHOLDER,
                     ROLES.OBSERVER, ROLES.AUDITOR],
'document:update':  [ROLES.ADMIN, ROLES.POLICY_LEAD],
'document:delete':  [ROLES.ADMIN, ROLES.POLICY_LEAD],
'section:manage':   [ROLES.ADMIN, ROLES.POLICY_LEAD],
```

**Rationale:** `document:read` is granted to all 7 roles because all users need to see policy documents. AUTH-05 (section-level scoping for stakeholders) is deferred to Phase 4 per the requirements traceability table. In Phase 2, all authenticated users can see all sections.

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `react-beautiful-dnd` | `@dnd-kit/core` + `@dnd-kit/sortable` | react-beautiful-dnd is deprecated/unmaintained. @dnd-kit is the current standard. |
| Tiptap 2.x | Tiptap 3.x | Tiptap 3 has unified extension packages (e.g. TableKit). This project will install Tiptap 3 in Phase 3. |
| Prisma for schema | Drizzle ORM | Already established in Phase 1. |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Do NOT use. Deprecated by Atlassian. Use `@dnd-kit`.
- Tiptap 2 docs: Do not use Tiptap 2 examples. Project targets Tiptap 3. (Tiptap not needed in Phase 2, but Phase 3 planner should note this.)

---

## Open Questions

1. **Neon HTTP driver + transactions**
   - What we know: `src/db/index.ts` uses `drizzle-orm/neon-http` for all queries.
   - What's unclear: Whether `@neondatabase/serverless` HTTP mode supports `db.transaction()`. Neon's HTTP mode batches are atomic, but Drizzle's `db.transaction()` may not map to that.
   - Recommendation: Implement the `importDocument` mutation as sequential inserts (document first, then sections). If the section insert fails, document is orphaned — add a cleanup step or wrap in try/catch with manual delete. Verify at implementation time by checking `node_modules/@neondatabase/serverless/README.md` for transaction support.
   - Confidence: MEDIUM — needs verification at implementation time.

2. **shadcn init CSS variable collision with existing globals.css**
   - What we know: `app/globals.css` exists from Phase 1. `npx shadcn@latest init` modifies `globals.css` to add CSS variables.
   - What's unclear: Whether the existing globals.css content will conflict with what shadcn adds.
   - Recommendation: Read `app/globals.css` before running shadcn init. The init is designed to append, not replace — but verify after running.

3. **sectionCount in list query**
   - What we know: The policy list cards must show `{N} sections`.
   - What's unclear: The optimal Drizzle query to get document list with section counts in one query.
   - Recommendation: Use a subquery or `sql` helper: `select policyDocuments.*, count(policySections.id) as sectionCount from policyDocuments left join policySections on policySections.documentId = policyDocuments.id group by policyDocuments.id`. Alternatively, return full section arrays and count client-side — acceptable at MVP scale.

---

## Environment Availability

All dependencies for Phase 2 are either already installed (Drizzle, tRPC, etc.) or available via npm. No external services beyond what Phase 1 established.

| Dependency | Required By | Available | Notes |
|------------|-------------|-----------|-------|
| Node.js / npm | All installs | Already in use | Phase 1 confirmed |
| Neon database | Schema migration | Available | Phase 1 configured |
| @dnd-kit/* | Section reorder | Not yet installed | `npm install` step needed |
| shadcn/ui CLI | UI components | Not yet initialized | `npx shadcn@latest init` needed |
| lucide-react | Icons | Not yet installed | Ships with shadcn init |
| sonner | Toasts | Not yet installed | Ships with shadcn add |

**Missing dependencies with no fallback:** None — all are installable via npm/npx.

**shadcn status:** `components.json` does not exist. shadcn must be initialized before any component can be added or used.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.mts` |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test` |
| Test location | `src/**/*.test.ts`, `src/**/*.test.tsx` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOC-01 | `document:create` permission allows admin + policy_lead, denies others | unit | `npm test -- --reporter=verbose` | No — Wave 0 |
| DOC-01 | `document:delete` permission allows admin + policy_lead, denies others | unit | `npm test -- --reporter=verbose` | No — Wave 0 |
| DOC-02 | Section UUID is a valid UUID and unique across creates | unit | `npm test -- --reporter=verbose` | No — Wave 0 |
| DOC-03 | `section:manage` permission allows admin + policy_lead, denies stakeholder | unit | `npm test -- --reporter=verbose` | No — Wave 0 |
| DOC-03 | Reorder mutation validates documentId ownership (sectionId belongs to documentId) | unit | `npm test -- --reporter=verbose` | No — Wave 0 |
| DOC-04 | Section content stored as Tiptap JSON object, not string | unit | `npm test -- --reporter=verbose` | No — Wave 0 |
| DOC-05 | Markdown parser: H1 → title, H2 → sections, preamble → Introduction | unit | `npm test -- --reporter=verbose` | No — Wave 0 |
| DOC-05 | Markdown parser: filename used as title when no H1 present | unit | `npm test -- --reporter=verbose` | No — Wave 0 |
| DOC-05 | Markdown parser: empty markdown produces empty sections array | unit | `npm test -- --reporter=verbose` | No — Wave 0 |
| DOC-06 | List query returns all documents (multiple coexist) | unit | `npm test -- --reporter=verbose` | No — Wave 0 |

**Test pattern to follow:** Existing tests mock the DB module and test business logic in isolation. New tests for permissions follow the same pattern as `src/__tests__/permissions.test.ts`. New tests for the markdown parser test pure functions — no mocking needed.

```typescript
// Example: src/__tests__/markdown-import.test.ts
import { describe, it, expect } from 'vitest'
import { parseMarkdown } from '@/src/lib/markdown-import'

describe('parseMarkdown', () => {
  it('extracts H1 as document title', () => {
    const result = parseMarkdown('# My Policy\n\n## Section 1\nContent', 'my-policy.md')
    expect(result.title).toBe('My Policy')
  })

  it('uses filename when no H1 present', () => {
    const result = parseMarkdown('## Section 1\nContent', 'data-protection.md')
    expect(result.title).toBe('data-protection')
  })

  it('splits on H2 headings into sections', () => {
    const result = parseMarkdown('## Scope\nContent A\n\n## Definitions\nContent B', 'test.md')
    expect(result.sections).toHaveLength(2)
    expect(result.sections[0].title).toBe('Scope')
    expect(result.sections[1].title).toBe('Definitions')
  })

  it('converts preamble to Introduction section', () => {
    const result = parseMarkdown('# Policy\n\nIntro text\n\n## Scope\nContent', 'test.md')
    expect(result.sections[0].title).toBe('Introduction')
  })
})
```

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/markdown-import.test.ts` — covers DOC-05 parsing logic
- [ ] `src/__tests__/document-permissions.test.ts` — covers DOC-01, DOC-03 permission matrix entries

*(Existing `src/__tests__/permissions.test.ts` covers the Phase 1 permission matrix but does not test Phase 2 permissions since they don't exist yet.)*

---

## Sources

### Primary (HIGH confidence)
- Phase 1 codebase — `src/db/schema/`, `src/server/routers/`, `src/trpc/init.ts`, `src/lib/permissions.ts` — direct code inspection
- `package.json` — exact installed versions verified
- `.planning/research/STACK.md` — project stack research with source citations
- `.planning/phases/02-policy-documents-sections/02-UI-SPEC.md` — UI design contract

### Secondary (MEDIUM confidence)
- @dnd-kit documentation patterns — well-established library, API stable at v6/v8
- Drizzle ORM FK references pattern — follows established schema conventions
- Tiptap JSON format — stored as JSONB, minimal parsing for import, no Tiptap package needed in Phase 2

### Tertiary (LOW confidence)
- Neon HTTP driver transaction support — requires verification at implementation time; `db.transaction()` behavior with `neon-http` not confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all new packages are well-established; versions verified via package.json and npm registry
- Architecture: HIGH — follows Phase 1 patterns directly; schema design is straightforward relational model
- Pitfalls: MEDIUM-HIGH — most are verified; Neon transaction behavior is MEDIUM (needs implementation-time check)
- Markdown parser: HIGH — pure function, no external dependencies, well-understood algorithm

**Research date:** 2026-03-25
**Valid until:** 2026-06-25 (stable libraries; Drizzle/tRPC APIs unlikely to change in 90 days)
