---
phase: 11-real-time-collaboration
plan: 01
subsystem: collaboration
tags: [yjs, hocuspocus, tiptap, crdt, websocket, comments, drizzle]

requires:
  - phase: 03-block-editor
    provides: Tiptap editor with buildExtensions, StarterKit, custom extensions
  - phase: 04-feedback-system
    provides: Feedback schema patterns, tRPC router conventions, audit logging

provides:
  - Collaboration DB schema (ydoc_snapshots, comment_threads, comment_replies)
  - Standalone Hocuspocus WebSocket server with Clerk auth and binary Y.Doc persistence
  - InlineComment Tiptap mark extension with data-comment-id attribute
  - tRPC comments router with full CRUD (create, list, resolve, reopen, delete, createReply)
  - buildExtensions collaboration option (Collaboration + CollaborationCaret injection, undoRedo disable)

affects: [11-02, 11-03]

tech-stack:
  added: ["@tiptap/extension-collaboration", "@tiptap/extension-collaboration-caret", "@hocuspocus/provider", "@hocuspocus/server", "@hocuspocus/extension-database", "@hocuspocus/transformer"]
  patterns: ["Standalone Hocuspocus server separate from Next.js", "Binary Y.Doc persistence via BYTEA custom type", "Optional collaboration config in buildExtensions", "Custom Tiptap Mark.create for inline comments"]

key-files:
  created:
    - src/db/schema/collaboration.ts
    - src/db/migrations/0007_collaboration.sql
    - src/lib/tiptap-extensions/inline-comment-mark.ts
    - hocuspocus-server/server.ts
    - hocuspocus-server/package.json
    - hocuspocus-server/tsconfig.json
    - hocuspocus-server/.env.example
    - src/server/routers/comments.ts
    - src/__tests__/inline-comment-mark.test.ts
    - src/__tests__/build-extensions-collab.test.ts
    - src/__tests__/comments-router.test.ts
  modified:
    - src/db/schema/index.ts
    - src/lib/tiptap-extensions/build-extensions.ts
    - src/server/routers/_app.ts
    - src/lib/constants.ts
    - src/lib/permissions.ts
    - .gitignore

key-decisions:
  - "Hocuspocus runs as standalone Node.js process (hocuspocus-server/) not inside Next.js -- Vercel cannot hold WebSocket connections"
  - "Y.Doc persistence uses BYTEA custom type for binary Uint8Array storage, not JSON reconstruction"
  - "InlineComment mark always included in buildExtensions (not gated on collaboration) -- comments work in single-user mode"
  - "comment:create permission covers all mutations (resolve, reopen, delete) -- delete has additional author/admin check"
  - "JSON bootstrap from policySections.content happens once in onLoadDocument when doc is empty"

patterns-established:
  - "Optional collaboration config in buildExtensions: when collaboration option absent, editor works in single-user mode as before"
  - "Binary Y.Doc persistence with secondary JSON sync: ydoc_snapshots stores Uint8Array, policySections.content kept in sync by Hocuspocus store hook"
  - "Custom Tiptap Mark for document anchors: commentId attribute stored on spans, metadata in PostgreSQL"

requirements-completed: [EDIT-06, EDIT-07, EDIT-08]

duration: 19min
completed: 2026-03-26
---

# Phase 11 Plan 01: Collaboration Backend Foundation Summary

**Hocuspocus server with Clerk auth and binary Y.Doc persistence, InlineComment mark extension, tRPC comments CRUD router, and buildExtensions collaboration option with undoRedo disable**

## Performance

- **Duration:** 19 min
- **Started:** 2026-03-26T08:24:32Z
- **Completed:** 2026-03-26T08:43:00Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Created 3 new DB tables (ydoc_snapshots, comment_threads, comment_replies) with migration
- Built standalone Hocuspocus WebSocket server with Clerk JWT auth, binary Y.Doc persistence, and Tiptap JSON bootstrap from existing content
- Created InlineComment custom Tiptap Mark extension for anchoring comments to text selections via data-comment-id
- Extended buildExtensions with optional collaboration config that injects Collaboration + CollaborationCaret and disables undoRedo
- Created tRPC comments router with create, list, createReply, resolve, reopen, delete endpoints with audit logging
- Added comment:read and comment:create permissions to the RBAC matrix

## Task Commits

Each task was committed atomically:

1. **Task 1: DB schema, InlineComment mark, buildExtensions collaboration** - `78eae2c` (test: TDD RED) + `5c9b40e` (feat: TDD GREEN)
2. **Task 2: Hocuspocus server and tRPC comments router** - `b385db2` (feat) + `9219caf` (chore: package-lock)

## Files Created/Modified
- `src/db/schema/collaboration.ts` - ydocSnapshots, commentThreads, commentReplies Drizzle schemas with BYTEA custom type
- `src/db/migrations/0007_collaboration.sql` - SQL migration for 3 new tables with indexes
- `src/lib/tiptap-extensions/inline-comment-mark.ts` - Custom Mark.create with data-comment-id, setInlineComment/unsetInlineComment commands
- `src/lib/tiptap-extensions/build-extensions.ts` - Extended with collaboration option, InlineComment always included, undoRedo disabled when collab active
- `hocuspocus-server/server.ts` - Standalone Hocuspocus server with Clerk auth, Database extension, onLoadDocument bootstrap
- `hocuspocus-server/package.json` - Separate Node.js project with hocuspocus/yjs/neon/clerk deps
- `hocuspocus-server/tsconfig.json` - TypeScript config for ES2022 ESM
- `hocuspocus-server/.env.example` - Environment variable template
- `src/server/routers/comments.ts` - tRPC commentRouter with 6 endpoints and audit logging
- `src/server/routers/_app.ts` - Added comments: commentRouter to appRouter
- `src/lib/constants.ts` - Added COMMENT_* audit action constants
- `src/lib/permissions.ts` - Added comment:read and comment:create permission entries
- `src/db/schema/index.ts` - Added collaboration schema export
- `.gitignore` - Added hocuspocus-server/node_modules

## Decisions Made
- Hocuspocus runs as standalone Node.js process (hocuspocus-server/) not inside Next.js -- Vercel cannot hold persistent WebSocket connections
- Y.Doc persistence uses BYTEA custom type for binary Uint8Array storage, not JSON reconstruction
- InlineComment mark always included in buildExtensions (not gated on collaboration flag) -- comments work in single-user mode too
- comment:create permission covers resolve/reopen/delete mutations; delete has additional author-or-admin ownership check
- JSON bootstrap from policySections.content happens once in onLoadDocument when Y.Doc is empty (first-time migration)
- Raw Neon SQL used in Hocuspocus server (not Drizzle ORM) for BYTEA column compatibility

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added indexes for comment_threads and comment_replies**
- **Found during:** Task 1 (DB schema creation)
- **Issue:** Plan did not specify indexes on frequently queried columns (section_id, author_id, thread_id)
- **Fix:** Added idx_comment_threads_section, idx_comment_threads_author, idx_comment_replies_thread in migration
- **Files modified:** src/db/migrations/0007_collaboration.sql
- **Committed in:** 5c9b40e

**2. [Rule 3 - Blocking] Added hocuspocus-server/node_modules to .gitignore**
- **Found during:** Task 2 (Hocuspocus server setup)
- **Issue:** Root .gitignore only ignored /node_modules, not hocuspocus-server/node_modules
- **Fix:** Added /hocuspocus-server/node_modules to .gitignore
- **Files modified:** .gitignore
- **Committed in:** b385db2

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both fixes necessary for performance (indexes) and clean repository state. No scope creep.

## Issues Encountered
- drizzle-kit push requires DATABASE_URL which is not available in CI/local dev without .env -- used SQL migration file instead (0007_collaboration.sql)
- section-assignments.test.ts pre-existing failure (missing DATABASE_URL) unrelated to this plan

## Known Stubs
None -- all data sources and endpoints are fully wired.

## Next Phase Readiness
- Plan 02 can wire HocuspocusProvider in BlockEditor using the collaboration option in buildExtensions
- Plan 02 can build presence avatars using CollaborationCaret storage
- Plan 03 can build inline comment popover UI using the comments tRPC router and InlineComment mark

## Self-Check: PASSED

All 12 created files verified present. All 4 commit hashes verified in git log.

---
*Phase: 11-real-time-collaboration*
*Completed: 2026-03-26*
