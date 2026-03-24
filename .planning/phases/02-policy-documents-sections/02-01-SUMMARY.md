---
phase: 02-policy-documents-sections
plan: 01
subsystem: api, database
tags: [drizzle, trpc, postgresql, tiptap, markdown, permissions]

# Dependency graph
requires:
  - phase: 01-foundation-auth
    provides: "Drizzle schema patterns, tRPC init with requirePermission, audit logging, permission matrix, constants"
provides:
  - "policyDocuments and policySections Drizzle schema tables"
  - "document tRPC router with 10 CRUD procedures"
  - "5 new permissions (document:create/read/update/delete, section:manage)"
  - "8 new audit actions for document and section operations"
  - "Markdown parser (parseMarkdown) converting H2-delimited .md to Tiptap JSON"
  - "Tiptap text renderer (renderTiptapToText) for read-only display"
  - "SQL migration for policy_documents and policy_sections tables"
affects: [02-02, 02-03, 03-block-editor, 04-feedback, 05-change-requests, 06-versioning]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FK cascade delete for parent-child table relationships (document -> sections)"
    - "Sequential updates for reorder operations (Neon HTTP safe, no transactions)"
    - "Markdown H2 splitting with Tiptap JSON output for content import"
    - "Permission-per-procedure pattern: all router procedures use requirePermission"

key-files:
  created:
    - src/db/schema/documents.ts
    - src/db/migrations/0001_policy_documents.sql
    - src/server/routers/document.ts
    - src/lib/markdown-import.ts
    - src/lib/tiptap-renderer.ts
    - src/__tests__/document-permissions.test.ts
    - src/__tests__/markdown-import.test.ts
  modified:
    - src/db/schema/index.ts
    - src/lib/permissions.ts
    - src/lib/constants.ts
    - src/server/routers/_app.ts

key-decisions:
  - "Sequential updates for section reorder instead of transactions (Neon HTTP driver compatibility)"
  - "Empty Tiptap doc { type: 'doc', content: [] } as default section content"
  - "Introduction section auto-created from preamble content before first H2"

patterns-established:
  - "Document-section parent-child with cascade delete and orderIndex ordering"
  - "Import flow: client parses markdown, sends structured sections to importDocument mutation"
  - "All mutations audit-logged with ACTIONS constants"

requirements-completed: [DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06]

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 02 Plan 01: Backend Foundation Summary

**Drizzle schema for policy documents and sections with 10-procedure tRPC router, permission matrix, markdown import parser, and Tiptap JSON renderer**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-24T21:07:11Z
- **Completed:** 2026-03-24T21:12:38Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Two new database tables (policy_documents, policy_sections) with FK cascade delete and ordering indexes
- Document tRPC router with full CRUD: list, getById, getSections, create, update, delete, createSection, renameSection, deleteSection, reorderSections, importDocument
- Permission matrix extended with 5 new permissions enforced on all 10 procedures
- Markdown import parser that splits H2-delimited content into Tiptap JSON sections
- 43 unit tests covering permission matrix and markdown parsing

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema, migration, permissions, constants, and utility modules** (TDD)
   - `18f67ea` (test) - Failing tests for permissions and markdown import
   - `30628da` (feat) - Implementation passing all tests
2. **Task 2: tRPC document router with all CRUD procedures** - `df7139c` (feat)

## Files Created/Modified
- `src/db/schema/documents.ts` - policyDocuments and policySections table definitions
- `src/db/migrations/0001_policy_documents.sql` - DDL for both tables with indexes
- `src/db/schema/index.ts` - Added documents export
- `src/lib/permissions.ts` - 5 new document/section permissions added to matrix
- `src/lib/constants.ts` - 8 new ACTIONS for audit logging
- `src/lib/markdown-import.ts` - parseMarkdown function splitting H2 into Tiptap JSON sections
- `src/lib/tiptap-renderer.ts` - renderTiptapToText for read-only text extraction
- `src/server/routers/document.ts` - Full document router with 10 procedures
- `src/server/routers/_app.ts` - Registered documentRouter
- `src/__tests__/document-permissions.test.ts` - Permission matrix tests for all 5 new permissions
- `src/__tests__/markdown-import.test.ts` - Markdown parsing and Tiptap renderer tests

## Decisions Made
- Sequential updates for section reorder instead of database transactions (Neon HTTP driver may not support db.transaction())
- Empty Tiptap doc `{ type: 'doc', content: [] }` as default content for new sections
- Markdown preamble content (before first H2) auto-creates an "Introduction" section
- Import mutation accepts pre-parsed sections (client-side parsing), keeping the server thin

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in `src/server/routers/audit.ts` (optional input type narrowing) -- not caused by this plan's changes, out of scope

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All backend contracts ready for UI plans (02-02 and 02-03)
- Document router provides full CRUD API for document list page and section management UI
- Markdown import available for bulk content ingestion
- Permission matrix tested and enforced on all procedures

## Self-Check: PASSED

All 11 files verified present. All 3 commit hashes verified in git log.

---
*Phase: 02-policy-documents-sections*
*Completed: 2026-03-25*
