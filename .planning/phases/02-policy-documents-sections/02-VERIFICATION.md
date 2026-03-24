---
phase: 02-policy-documents-sections
verified: 2026-03-25T03:13:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
---

# Phase 02: Policy Documents & Sections Verification Report

**Phase Goal:** Policy Leads can create and structure policy documents with sections that carry stable identities for all downstream workflow references
**Verified:** 2026-03-25T03:13:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | `policy_documents` and `policy_sections` tables exist with correct columns | VERIFIED | `src/db/schema/documents.ts` defines both tables; UUIDs, FK cascade, orderIndex, jsonb content all present |
| 2  | Document CRUD operations enforce permission checks via `requirePermission` | VERIFIED | All 10 procedures in `document.ts` use `requirePermission`; 12 calls confirmed; `protectedProcedure` count = 0 |
| 3  | Section CRUD operations enforce permission checks via `requirePermission` | VERIFIED | `createSection`, `renameSection`, `deleteSection`, `reorderSections` all use `requirePermission('section:manage')` |
| 4  | Every mutation writes an audit log entry | VERIFIED | 9 `writeAuditLog` calls covering all 7 mutations (create, update, delete, createSection, renameSection, deleteSection, reorderSections, importDocument) |
| 5  | Sections have stable UUID primary keys and integer `order_index` | VERIFIED | `id: uuid('id').primaryKey().defaultRandom()` and `orderIndex: integer('order_index').notNull()` in schema |
| 6  | Deleting a document cascades to delete all its sections | VERIFIED | `onDelete: 'cascade'` on `documentId` FK in schema; migration has `ON DELETE CASCADE` |
| 7  | Markdown parsing splits on H2 headings and produces Tiptap JSON | VERIFIED | `parseMarkdown` in `markdown-import.ts` (117 lines); 43 tests pass (including H2-split, Tiptap structure, preamble Introduction) |
| 8  | User can see a list of all policy documents on `/policies` | VERIFIED | `page.tsx` calls `trpc.document.list.useQuery()`, renders `policies.map()` into card grid; empty state + skeleton present |
| 9  | Admin or Policy Lead can create a new policy document via dialog | VERIFIED | `create-policy-dialog.tsx` (132 lines); `trpc.document.create.useMutation` wired; title validation, success navigation, toast confirmed |
| 10 | Admin or Policy Lead can edit/delete a policy document | VERIFIED | `edit-policy-dialog.tsx` uses `trpc.document.update.useMutation`; `delete-policy-dialog.tsx` uses `trpc.document.delete.useMutation` |
| 11 | Policy Lead can add/reorder/rename/delete sections with stable UUIDs | VERIFIED | All 4 section CRUD dialogs wired to `trpc.document.*` mutations; DnD reorder with optimistic update + rollback in `section-sidebar.tsx` |
| 12 | Section content displayed as read-only Tiptap JSON | VERIFIED | `section-content-view.tsx` calls `renderTiptapToText(section.content)`; empty content placeholder shown when content array is empty |
| 13 | A markdown file can be imported to create a new policy with detected sections | VERIFIED | `import-markdown-dialog.tsx` (326 lines); two-step flow: FileReader + `parseMarkdown` then `trpc.document.importDocument.useMutation`; 5 MB guard, aria-label, .md accept filter all present |

**Score: 13/13 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema/documents.ts` | policyDocuments and policySections table definitions | VERIFIED | Exports `policyDocuments`, `policySections`; 19 lines, substantive |
| `src/db/migrations/0001_policy_documents.sql` | DDL for both tables with FK cascade and indexes | VERIFIED | `CREATE TABLE policy_documents`, `ON DELETE CASCADE`, 2 index statements |
| `src/db/schema/index.ts` | Exports documents schema | VERIFIED | `export * from './documents'` added |
| `src/lib/permissions.ts` | 5 new document/section permissions | VERIFIED | `document:create`, `document:read`, `document:update`, `document:delete`, `section:manage` all present |
| `src/lib/constants.ts` | 8 new ACTIONS | VERIFIED | `DOCUMENT_CREATE`, `DOCUMENT_UPDATE`, `DOCUMENT_DELETE`, `SECTION_CREATE`, `SECTION_DELETE`, `SECTION_REORDER`, `SECTION_RENAME`, `DOCUMENT_IMPORT` all present |
| `src/server/routers/document.ts` | Document and section tRPC router (documentRouter) | VERIFIED | 349 lines, 10 procedures, 12 requirePermission calls, 9 writeAuditLog calls, all real DB queries |
| `src/server/routers/_app.ts` | documentRouter registered in appRouter | VERIFIED | `document: documentRouter` present |
| `src/lib/markdown-import.ts` | parseMarkdown, ParsedDocument, ParsedSection exports | VERIFIED | All 4 exports present; 117 lines, full implementation |
| `src/lib/tiptap-renderer.ts` | renderTiptapToText export | VERIFIED | 34 lines, handles null/undefined/empty gracefully |
| `src/__tests__/document-permissions.test.ts` | Permission matrix tests | VERIFIED | 43 total tests pass (combined with markdown suite) |
| `src/__tests__/markdown-import.test.ts` | Markdown parsing + Tiptap renderer tests | VERIFIED | Covers H1 extraction, H2 splitting, filename fallback, Introduction preamble, nested H3, Tiptap JSON shape |
| `components.json` | shadcn configuration | VERIFIED | Exists, `"style": "base-nova"`, CSS variables enabled |
| `app/(workspace)/policies/page.tsx` | Policy list page (min 30 lines) | VERIFIED | 53 lines, `trpc.document.list.useQuery()`, grid render, empty state, skeleton, ImportMarkdownDialog wired |
| `app/(workspace)/policies/_components/policy-card.tsx` | Individual policy card (min 20 lines) | VERIFIED | 109 lines, `formatDistanceToNow`, `MoreHorizontal` dropdown, badge with section count, edit/delete dialogs |
| `app/(workspace)/policies/_components/create-policy-dialog.tsx` | Create policy dialog (min 30 lines) | VERIFIED | 132 lines, `trpc.document.create.useMutation`, validation, toast, navigation |
| `app/(workspace)/policies/[id]/page.tsx` | Policy detail page (min 40 lines) | VERIFIED | 128 lines, `trpc.document.getById.useQuery`, `trpc.document.getSections.useQuery`, two-column layout, 280px sidebar |
| `app/(workspace)/policies/[id]/_components/section-sidebar.tsx` | Section sidebar with DnD (min 60 lines) | VERIFIED | 163 lines, DndContext, SortableContext, arrayMove, optimistic reorder with rollback |
| `app/(workspace)/policies/_components/import-markdown-dialog.tsx` | Two-step markdown import dialog (min 80 lines) | VERIFIED | 326 lines, `parseMarkdown`, `trpc.document.importDocument.useMutation`, FileReader, 5 MB guard |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/server/routers/document.ts` | `src/db/schema/documents.ts` | drizzle queries on policyDocuments/policySections | WIRED | Direct import of `policyDocuments`, `policySections`; used in all 10 procedures |
| `src/server/routers/document.ts` | `src/lib/audit.ts` | writeAuditLog in every mutation | WIRED | 9 `writeAuditLog` calls, all mutations covered |
| `src/server/routers/_app.ts` | `src/server/routers/document.ts` | documentRouter registered in appRouter | WIRED | `document: documentRouter` on line 9 |
| `app/(workspace)/policies/page.tsx` | `src/server/routers/document.ts` | `trpc.document.list.useQuery` | WIRED | Line 13 of page.tsx; result rendered to card grid |
| `app/(workspace)/policies/_components/create-policy-dialog.tsx` | `src/server/routers/document.ts` | `trpc.document.create.useMutation` | WIRED | Line 30; mutation fires on form submit, result used for navigation |
| `app/(workspace)/policies/[id]/_components/section-sidebar.tsx` | `src/server/routers/document.ts` | `trpc.document.reorderSections` + optimistic cache | WIRED | Lines 61-84 of section-sidebar.tsx; full optimistic update/rollback pattern |
| `app/(workspace)/policies/_components/import-markdown-dialog.tsx` | `src/lib/markdown-import.ts` | `parseMarkdown` function call | WIRED | Line 6 import; called in `handlePreviewImport` via FileReader onload |
| `app/(workspace)/policies/_components/import-markdown-dialog.tsx` | `src/server/routers/document.ts` | `trpc.document.importDocument.useMutation` | WIRED | Line 116; mutation fires in `handleConfirmImport`, result used for navigation |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `policies/page.tsx` | `policies` (from `trpc.document.list.useQuery`) | `document.ts` list procedure → `db.select().from(policyDocuments).leftJoin(policySections)` | Yes — real Drizzle query with section count join | FLOWING |
| `policies/[id]/page.tsx` | `documentQuery.data` / `sectionsQuery.data` | `getById` → `db.select().from(policyDocuments).where(eq(id))`; `getSections` → `db.select().from(policySections).where(eq(documentId))` | Yes — real Drizzle queries | FLOWING |
| `section-content-view.tsx` | `text` from `renderTiptapToText(section.content)` | `section.content` is `jsonb` from DB via `getSections`; `renderTiptapToText` extracts text nodes | Yes — traverses real Tiptap JSON | FLOWING |
| `import-markdown-dialog.tsx` | `parsedResult` from `parseMarkdown(text, file.name)` | FileReader reads uploaded file; `parseMarkdown` processes actual file content | Yes — real file parsing | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 43 permission + markdown tests pass | `npx vitest run src/__tests__/document-permissions.test.ts src/__tests__/markdown-import.test.ts` | 2 test files, 43 tests, all passed | PASS |
| All key exports present in modules | `grep "^export" src/lib/markdown-import.ts src/lib/tiptap-renderer.ts src/server/routers/document.ts` | All 6 expected exports found | PASS |
| TypeScript compilation (phase 02 files) | `npx tsc --noEmit 2>&1 \| grep "error TS" \| grep -v audit.ts` | Zero errors in phase 02 files | PASS |
| requirePermission on all procedures | Count `requirePermission` in document.ts | 12 occurrences (10 procedures + imports) — zero bare `protectedProcedure` | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DOC-01 | 02-01, 02-02 | Admin/Policy Lead can create a new policy document with title and description | SATISFIED | `create` procedure in `document.ts`; `create-policy-dialog.tsx` UI with tRPC mutation |
| DOC-02 | 02-01, 02-03 | Policy document contains ordered sections with stable UUIDs | SATISFIED | `policySections` table has `uuid().primaryKey().defaultRandom()` and `orderIndex`; sections persisted via `createSection`, reordered via `reorderSections` |
| DOC-03 | 02-01, 02-03 | Policy Lead can create, reorder, and delete sections within a document | SATISFIED | `createSection`, `reorderSections`, `deleteSection` procedures in router; `section-sidebar.tsx` with DnD + `add-section-dialog.tsx` + `delete-section-dialog.tsx` |
| DOC-04 | 02-01, 02-03 | Section content is stored as block-based structure (Tiptap JSON) | SATISFIED | `content: jsonb(...).$type<Record<string, unknown>>()` in `policySections` schema; default `{ type: 'doc', content: [] }`; `renderTiptapToText` for read-only display |
| DOC-05 | 02-01, 02-03 | Existing policy content can be imported from markdown files | SATISFIED | `parseMarkdown` in `markdown-import.ts`; `importDocument` mutation in router; two-step `import-markdown-dialog.tsx` with FileReader + preview |
| DOC-06 | 02-01, 02-02 | Multiple policy documents can exist in the workspace simultaneously | SATISFIED | `list` procedure returns all documents; `/policies` page renders card grid of all; no uniqueness constraint on documents |

All 6 requirements (DOC-01 through DOC-06) are SATISFIED. No orphaned requirements detected — all 6 are claimed in plan frontmatter and verified in the codebase.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `create-policy-dialog.tsx` | 86, 98 | `placeholder="..."` | Info | HTML form placeholder text — not a stub; form is fully implemented with real mutation wiring |

No blockers or warnings found. The two `placeholder` attributes are legitimate HTML input placeholders for UX guidance, not implementation stubs.

---

### Human Verification Required

The following behaviors require manual testing against a running server:

#### 1. Drag-and-drop section reorder persists after page refresh

**Test:** On `/policies/[id]`, drag a section to a new position in the sidebar, release, then hard-refresh the page.
**Expected:** Sections appear in the new order after refresh (verifies `reorderSections` mutation fired and `orderIndex` was updated in DB).
**Why human:** DnD interaction requires a browser with pointer events; persistence requires a live DB connection.

#### 2. Create policy navigates to detail page with empty section state

**Test:** Click "Create Policy", enter title, submit. Observe navigation target and detail page initial state.
**Expected:** Navigates to `/policies/[new-id]`, sidebar shows "No sections" empty state with copy "Add sections to organize your policy document."
**Why human:** Navigation and multi-step flow require a running Next.js app.

#### 3. Markdown import end-to-end

**Test:** Click "Import Markdown", upload a `.md` file with `## H2` headings, verify Step 2 preview shows correct title and sections, click "Import Policy".
**Expected:** Navigates to `/policies/[new-id]` with all detected sections in sidebar; toast "Policy imported with N sections."
**Why human:** FileReader API and two-step dialog flow require a browser environment.

#### 4. Section deletion clears selection

**Test:** Select a section in the sidebar, open its "Delete Section" dialog, confirm delete.
**Expected:** Sidebar removes the section, content area reverts to "Select a section from the sidebar to view its content."
**Why human:** Reactive state reset after mutation requires browser rendering.

---

### Gaps Summary

No gaps found. All 13 must-have truths are verified. All 18 required artifacts exist and are substantive. All 8 key links are wired. Data flows from real Drizzle DB queries through tRPC to UI render. The only TypeScript compilation error is the pre-existing `src/server/routers/audit.ts` issue present before Phase 2 began — it is not caused by Phase 2 changes and does not affect Phase 2 functionality.

Phase goal achieved: Policy Leads can create and structure policy documents with sections that carry stable UUIDs. The complete data model (schema, migration), API layer (10-procedure tRPC router, permission matrix, audit logging), utility functions (markdown parser, Tiptap renderer), and UI (list page, detail page, all CRUD dialogs, markdown import) are fully implemented and wired.

---

_Verified: 2026-03-25T03:13:00Z_
_Verifier: Claude (gsd-verifier)_
