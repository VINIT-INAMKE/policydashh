# Phase 14: Collab Rollback - Research

**Researched:** 2026-04-13
**Domain:** Deletion/rollback of Yjs/Hocuspocus real-time collaboration code added in Phase 11
**Confidence:** HIGH — all findings come from direct codebase inspection (no training-data guesswork required)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COLLAB-ROLLBACK-01 | Yjs/Hocuspocus/inline-comment code removed; EDIT-06/07/08 moved to Deferred v2 status; `ydoc_snapshots`, `comment_threads`, `comment_replies` schema dropped; `hocuspocus-server/` directory deleted | Full inventory below — every file, import, and schema artifact catalogued |
| COLLAB-ROLLBACK-02 | Single-user Tiptap editor with auto-save continues to function without Collaboration extension (verified via render tests) | Auto-save logic and extension wiring fully traced; test patterns documented |
</phase_requirements>

---

## Summary

Phase 11 added real-time collaboration as a conditional layer on top of the single-user Tiptap editor. The architecture is cleanly separated: collab code is gated behind `process.env.NEXT_PUBLIC_HOCUSPOCUS_URL` and behind an optional `collaboration` parameter in `buildExtensions`. This makes rollback well-contained — the base editor never became structurally dependent on Yjs.

The key complication is that `InlineComment` mark (the text-highlighting mechanism for comments) is **always included** in `buildExtensions`, even without collaboration active. The Phase 11 plan explicitly made this decision ("comments work in single-user mode too"). When rolling back, this mark must be deleted along with the comment panel UI, because the comment panel's tRPC calls (`trpc.comments.*`) will point to a router that no longer exists after rollback. Leaving the mark but removing the router would crash any editor that tried to use comment functionality.

The `hocuspocus-server/` directory was **planned but never materialized** in the actual codebase — the root filesystem shows no such directory. This was confirmed by direct `ls` inspection. The `@hocuspocus/provider` npm package IS installed in `package.json` and its imports exist in client-side files.

The existing test suite (Vitest + jsdom, 26 test files) has 2 pre-existing failures unrelated to collab (permission matrix tests). The collab-specific test files (`build-extensions-collab.test.ts`, `inline-comment-mark.test.ts`, `comments-router.test.ts`) must be deleted as part of rollback. The editor render test (`section-content-view.test.tsx`) stubs `BlockEditor` via `next/dynamic` mock — this pattern is the correct template for validating that the editor loads without crashing post-rollback.

**Primary recommendation:** Delete in dependency order — UI components first, then router/schema exports, then schema file, then migration, then npm packages. Run `npm test` after each wave. The render test for `SectionContentView` is the critical gate because it exercises the full dynamic import path.

---

## Standard Stack

### Migration Tooling
| Tool | Version | Purpose | How Used |
|------|---------|---------|----------|
| Drizzle ORM | ^0.45.1 | Schema definition + query builder | Schema files in `src/db/schema/` |
| drizzle-kit | ^0.31.10 | Migration generation and apply | `npx drizzle-kit push` (dev) |
| Neon PostgreSQL | via @neondatabase/serverless ^1.0.2 | Database | Neon HTTP driver |

**Migration naming convention:** Sequential zero-padded integers, e.g. `0000_initial.sql`, `0007_collaboration.sql`. The `meta/_journal.json` only has entry 0 (initial) — Drizzle Kit `push` was used for subsequent changes (schema pushed directly, not via migration files). This means the new drop-table migration should be a **hand-written SQL file** (`0008_drop_collaboration.sql`) applied via `npx drizzle-kit push` or direct `psql` execution, consistent with Phase 1's pattern for DDL that Drizzle cannot generate automatically.

**Migration command:**
```bash
npx drizzle-kit push
```

### Test Framework
| Tool | Version | Purpose |
|------|---------|---------|
| Vitest | ^4.1.1 | Test runner |
| @testing-library/react | ^16.3.2 | React component rendering |
| jsdom | ^29.0.1 | DOM environment for component tests |
| @vitejs/plugin-react | ^6.0.1 | JSX transform |

**Test commands:**
```bash
npm test                    # Full suite (vitest run)
npm test -- src/__tests__/build-extensions-collab.test.ts  # Single file
npm test -- --reporter=verbose  # With per-test output
```

---

## Collab Code Inventory (Complete)

### Subsystem: npm Packages (package.json)

| Package | Type | Action |
|---------|------|--------|
| `@hocuspocus/provider` ^3.4.4 | dependency | REMOVE |
| `@tiptap/extension-collaboration` ^3.20.5 | dependency | REMOVE |
| `@tiptap/extension-collaboration-caret` ^3.20.5 | dependency | REMOVE |

Note: `yjs` is NOT a direct dependency in `package.json` — it is a transitive dependency via the packages above. No direct `import ... from 'yjs'` exists in application code. Only `import type * as Y from 'yjs'` in `build-extensions.ts` (type-only, erased at compile time).

### Subsystem: Database Schema

| File | What It Contains | Action |
|------|-----------------|--------|
| `src/db/schema/collaboration.ts` | `ydocSnapshots`, `commentThreads`, `commentReplies` table definitions; custom `bytea` type | DELETE entire file |
| `src/db/schema/index.ts` line 11 | `export * from './collaboration'` | REMOVE this line |
| `src/db/migrations/0007_collaboration.sql` | CREATE TABLE for all 3 tables + indexes | KEEP as historical record; write new DROP migration |

**FK relationships (incoming — what references these tables):**
- `ydocSnapshots.sectionId` → `policySections.id` (CASCADE): no other table references `ydoc_snapshots`
- `commentThreads.sectionId` → `policySections.id` (CASCADE): no other table references `comment_threads`
- `commentReplies.threadId` → `commentThreads.id` (CASCADE): `comment_replies` references `comment_threads`, but since we're dropping both, `comment_replies` must be dropped first

**Drop order (safe):**
```sql
-- 0008_drop_collaboration.sql
DROP TABLE IF EXISTS comment_replies CASCADE;
DROP TABLE IF EXISTS comment_threads CASCADE;
DROP TABLE IF EXISTS ydoc_snapshots CASCADE;
```

Using `CASCADE` ensures any dependent objects (indexes, constraints) are also dropped. Drop `comment_replies` before `comment_threads` because `comment_replies` has a FK into `comment_threads`. `ydoc_snapshots` has no dependents beyond `policySections` (CASCADE from the other direction).

### Subsystem: Editor Client

| File | References | Action |
|------|-----------|--------|
| `app/(workspace)/policies/[id]/_components/block-editor.tsx` | `HocuspocusProvider` import (line 6), `useSession`/`useUser` from Clerk (line 8), `getPresenceColor` (line 19), `PresenceBar` (line 28), `ConnectionStatus` (line 29), `CommentBubble`/`PendingComment` (line 30), `CommentPanel` (line 31), `providerRef` (line 87), `connectionStatus` state (line 88), `providerReady` state (line 89), `session`/`user` (lines 92-93), entire `useEffect` for provider init (lines 161-221), `collaboration:` option in `buildExtensions` (lines 264-274), conditional content prop (lines 347-352), `commentPanelOpen`/`pendingComment`/`activeCommentId` state (lines 82-84), comment handlers (lines 393-431), `PresenceBar` + `ConnectionStatus` JSX (lines 455-467), `CommentBubble` JSX (line 527), `CommentPanel` JSX (lines 541-551) | HEAVY EDIT — remove all collab/comment code, restore to single-user |
| `app/(workspace)/policies/[id]/_components/presence-bar.tsx` | Entire file. Props: `provider: HocuspocusProvider \| null`, uses `usePresence` hook | DELETE entire file |
| `app/(workspace)/policies/[id]/_components/connection-status.tsx` | Entire file. No Hocuspocus import but exists solely for collab UI | DELETE entire file |
| `app/(workspace)/policies/[id]/_components/comment-bubble.tsx` | Entire file. `PendingComment` type, `CommentBubble` component | DELETE entire file |
| `app/(workspace)/policies/[id]/_components/comment-panel.tsx` | Entire file. `trpc.comments.*` mutations, `setInlineComment` editor command | DELETE entire file |
| `app/(workspace)/policies/[id]/_components/comment-thread.tsx` | Entire file. `ThreadData` type, reply/resolve/reopen UI | DELETE entire file |
| `src/lib/hooks/use-presence.ts` | Entire file. `usePresence(provider: HocuspocusProvider \| null)` hook | DELETE entire file |
| `src/lib/collaboration/presence-colors.ts` | Entire file. `getPresenceColor`, `getInitials`, `PRESENCE_COLORS` | DELETE entire file (and `src/lib/collaboration/` directory) |
| `src/lib/tiptap-extensions/build-extensions.ts` | Imports `Collaboration`, `CollaborationCaret` (lines 9-10), `import type { HocuspocusProvider }` (line 14), `import type * as Y` (line 15), `InlineComment` (line 21), `collaboration?` in `BuildExtensionsOptions` (lines 29-33), `undoRedo: options?.collaboration ? false : undefined` (line 58), conditional `if (options?.collaboration)` block (lines 124-134) | EDIT — remove collab imports, collab option, undoRedo condition, InlineComment |
| `src/lib/tiptap-extensions/inline-comment-mark.ts` | Entire file. Custom Mark extension | DELETE entire file |
| `app/globals.css` lines 361-401 | `.collaboration-cursor__caret`, `.collaboration-cursor__label`, `.inline-comment-mark`, `@media reduced-motion` block for cursor | EDIT — remove those CSS blocks |

**The `providerRef.current` bug pattern (explicitly called out in success criteria):**

Current code in `block-editor.tsx` accesses `providerRef.current` in multiple places:
- Line 141: `if (!providerRef.current || ...` in `handleUpdate`
- Line 155: `if (!providerRef.current || ...` in `handleBlur`
- Line 265: `collaboration: providerRef.current ? { ... } : undefined` in extensions
- Line 347: `content: providerRef.current ? undefined : ...` in `useEditor`
- Lines 455, 465: `{providerRef.current && <PresenceBar ...>}` in JSX

After rollback, ALL of these must be removed, not just the useEffect that creates the provider. The trap is doing a partial removal and leaving references to `providerRef.current` — those would not cause TypeScript errors (the ref can be null) but would silently affect runtime behavior (e.g., auto-save never fires because `providerRef.current` is never null in a weird state).

### Subsystem: tRPC Router

| File | References | Action |
|------|-----------|--------|
| `src/server/routers/comments.ts` | Entire file. `commentRouter` with list/create/createReply/resolve/reopen/delete | DELETE entire file |
| `src/server/routers/_app.ts` | `import { commentRouter }` (line 13), `comments: commentRouter` (line 27) | EDIT — remove import and router key |

**Notification wiring:** Confirmed NONE. The `comments.ts` router has NO calls to `createNotification`. No other router references `comment` operations. The inline comment system is entirely self-contained within the comments router. No notification fanout to undo.

### Subsystem: Env / Config

| File | References | Action |
|------|-----------|--------|
| `.env.local` line 1-2 | `# NEXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1234` (commented out) | DELETE the commented lines |
| `.env.example` | No reference to `NEXT_PUBLIC_HOCUSPOCUS_URL` — **already absent** | No action needed |
| `package.json` | `@hocuspocus/provider`, `@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-caret` in dependencies | REMOVE 3 packages + run `npm install` |

Note: `NEXT_PUBLIC_HOCUSPOCUS_URL` is NOT in `.env.example` — it was only ever in `.env.local` as a comment. The success criterion says "removed from `.env.example`" but it was never there. This is already satisfied.

### Subsystem: Tests

| File | What It Tests | Action |
|------|--------------|--------|
| `src/__tests__/inline-comment-mark.test.ts` | `InlineComment` mark — attributes, parseHTML, renderHTML | DELETE |
| `src/__tests__/build-extensions-collab.test.ts` | `buildExtensions` with collaboration option — Collaboration, CollaborationCaret presence | DELETE |
| `src/__tests__/comments-router.test.ts` | `commentRouter` permissions, input validation, ACTIONS constants | DELETE |

**Tests that must PASS after rollback (do not delete):**
- `src/__tests__/editor-extensions.test.ts` — tests `buildExtensions()` without collab; requires update to remove `inlineComment` from expected names
- `src/__tests__/section-content-view.test.tsx` — render test for the component that mounts BlockEditor; this is the critical render test
- All other 23 test files — must remain green

**Pre-existing test failures (NOT caused by this rollback):**
- `src/__tests__/feedback-permissions.test.ts` — 2 failures on `feedback:read_own` auditor permission
- `src/__tests__/document-router-scope.test.ts` — 1 failure (separate issue)
These were failing before Phase 14 and are out of scope.

### Subsystem: hocuspocus-server

**CONFIRMED: The `hocuspocus-server/` directory does NOT exist in the repository.**

The Phase 11 plans described creating it, but direct `ls D:/aditee/policydash/` confirms it was never committed to the repo. This success criterion is therefore already satisfied with no action needed.

---

## Architecture Patterns

### Block Editor Current Wiring (Single-User Path)

The editor already supports single-user mode. When `NEXT_PUBLIC_HOCUSPOCUS_URL` is absent (which it is by default — `.env.local` has it commented out), the editor runs as single-user:

```typescript
// Current: providerRef stays null when no HOCUSPOCUS_URL
if (!HOCUSPOCUS_URL) {
  providerRef.current = null
  setProviderReady(true)
  return
}

// Current: content prop uses section.content when no provider
content: providerRef.current
  ? undefined
  : (section.content ?? { type: 'doc', content: [{ type: 'paragraph' }] })

// Current: auto-save fires when no provider
if (!providerRef.current || connectionStatusRef.current === 'disconnected') {
  debouncedSave(editor.getJSON() as Record<string, unknown>)
}
```

After rollback, `block-editor.tsx` should be simplified to remove all collaboration branches. The auto-save is already there and correct — it just needs the conditional removed so it always fires.

### Post-Rollback BlockEditor Target State

Key properties of the clean post-rollback editor:
1. No `HocuspocusProvider`, `useSession`, `useUser` (Clerk) imports
2. No `providerRef`, `connectionStatus`, `providerReady` state
3. `buildExtensions` called without `collaboration:` option
4. `content` prop always set from `section.content` (no conditional)
5. `handleUpdate` always calls `debouncedSave` (no provider check)
6. `handleBlur` always calls `debouncedSave.flush()` (no provider check)
7. No `PresenceBar`, `ConnectionStatus`, `CommentBubble`, `CommentPanel` rendered
8. No comment state (`commentPanelOpen`, `pendingComment`, `activeCommentId`)
9. No comment click handler `useEffect`
10. `getPresenceColor` import removed

The `useSession` and `useUser` from Clerk should be removed only if no other code in the file needs them after stripping collaboration. Based on the current file, they are imported solely for collaboration — safe to remove.

### Post-Rollback buildExtensions Target State

```typescript
// Remove these imports:
// import { Collaboration } from '@tiptap/extension-collaboration'
// import { CollaborationCaret } from '@tiptap/extension-collaboration-caret'
// import type { HocuspocusProvider } from '@hocuspocus/provider'
// import type * as Y from 'yjs'
// import { InlineComment } from './inline-comment-mark'

export interface BuildExtensionsOptions {
  onSlashCommand?: Partial<SuggestionOptions>
  // Remove: collaboration?: { ... }
}

// Remove in StarterKit.configure:
// undoRedo: options?.collaboration ? false : undefined
// → just: (no undoRedo key, use default)

// Remove from extensions array:
// InlineComment,

// Remove entire block:
// if (options?.collaboration) { extensions.push(Collaboration..., CollaborationCaret...) }
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drop migration | Custom migration runner | `npx drizzle-kit push` or hand-written SQL | Existing project pattern |
| Verifying editor loads | Custom DOM assertions | Vitest + RTL render test (existing `section-content-view.test.tsx` pattern) | Already established |

---

## Common Pitfalls

### Pitfall 1: Leaving `providerRef.current` Access Sites
**What goes wrong:** Removing the `useEffect` that creates the provider but leaving the `if (!providerRef.current || ...)` guards in `handleUpdate` and `handleBlur`. `providerRef.current` will always be null, so auto-save will correctly fire, but the code now has dead logic referencing a deleted concept. More dangerously — if some future phase accidentally reinstates a ref, auto-save could silently stop.
**How to avoid:** Search for every occurrence of `providerRef` in `block-editor.tsx` and remove them all. The post-rollback `handleUpdate` should be unconditional.

### Pitfall 2: Forgetting `InlineComment` in `editor-extensions.test.ts`
**What goes wrong:** `src/__tests__/editor-extensions.test.ts` tests `buildExtensions()` and checks `names.length >= 15` and lists required extension names. After removing `InlineComment`, the extension count drops by 1. The test `'returns more than 15 extensions'` expects `>= 15` — need to verify this still passes after removal.
**How to avoid:** Run `npm test -- src/__tests__/editor-extensions.test.ts` after modifying `build-extensions.ts`. Also: `build-extensions-collab.test.ts` checks that `inlineComment` is always present — this test must be deleted before `InlineComment` is removed, or the test will fail.

### Pitfall 3: Deleting Tests Before Removing Code
**What goes wrong:** Deleting `inline-comment-mark.test.ts` before deleting `inline-comment-mark.ts` looks clean. But if the code is deleted first and the test file is not deleted immediately, `npm test` will fail on import.
**How to avoid:** Delete test files in the same wave as their corresponding source files.

### Pitfall 4: Forgetting `comment:read` / `comment:create` Permissions in `permissions.ts`
**What goes wrong:** `src/lib/permissions.ts` defines `comment:read` and `comment:create` permission entries. After deleting the comments router, these permission keys become dead code. They won't crash anything, but they pollute the permissions matrix and `comments-router.test.ts` tests them.
**How to avoid:** Remove `comment:read` and `comment:create` entries from `src/lib/permissions.ts` in the same wave as deleting `comments.ts`. Also clean up the ACTIONS constants in `src/lib/constants.ts` (`COMMENT_CREATE`, `COMMENT_REPLY`, `COMMENT_RESOLVE`, `COMMENT_REOPEN`, `COMMENT_DELETE`).

### Pitfall 5: CommentPanel Uses `setInlineComment` Command
**What goes wrong:** `comment-panel.tsx` calls `editor.chain().focus().setTextSelection(...).setInlineComment(commentId).run()`. This command is defined in `InlineComment` mark extension. If `CommentPanel` is deleted but `InlineComment` is kept, there's no crash. But if `InlineComment` is deleted while `CommentPanel` still exists, TypeScript will error on unknown command.
**How to avoid:** Delete `comment-panel.tsx` before or in the same wave as deleting `inline-comment-mark.ts`.

### Pitfall 6: `section-content-view.test.tsx` render test currently stubs BlockEditor
**What goes wrong:** The render test stubs `BlockEditor` via `vi.mock('next/dynamic', ...)`. This means the test does NOT exercise the actual `block-editor.tsx` code — it only verifies `SectionContentView` renders correctly. After rollback, we need an additional test that exercises `buildExtensions()` without the collab option to confirm no import crashes.
**How to avoid:** The existing `editor-extensions.test.ts` already calls `buildExtensions()` directly without mocking. This test IS the correct render-gate for `buildExtensions`. After deleting collab extensions, run this test to confirm clean import.

### Pitfall 7: `.env.local` retains commented-out Hocuspocus line
**What goes wrong:** The `.env.local` file has `# NEXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1234` (commented). While harmless now, any developer who uncomments it will get a runtime error because the provider code is deleted.
**How to avoid:** Remove the commented line from `.env.local` as part of the rollback.

---

## Deletion Ordering / Dependency Graph (Safe Order for Waves)

The dependency graph is: **UI consumers → mark/hook utilities → router → schema exports → schema file → migration → npm packages**.

### Wave 1: Delete standalone UI components (no dependents in remaining code)
Files that are entirely self-contained and can be deleted without breaking anything else:

1. `app/(workspace)/policies/[id]/_components/presence-bar.tsx` — only imported by `block-editor.tsx`
2. `app/(workspace)/policies/[id]/_components/connection-status.tsx` — only imported by `block-editor.tsx`
3. `app/(workspace)/policies/[id]/_components/comment-thread.tsx` — only imported by `comment-panel.tsx`
4. `app/(workspace)/policies/[id]/_components/comment-bubble.tsx` — only imported by `block-editor.tsx`
5. `app/(workspace)/policies/[id]/_components/comment-panel.tsx` — imports from `comment-thread.tsx` (already deleted) and `block-editor.tsx`
6. `src/__tests__/inline-comment-mark.test.ts` — test for mark to be deleted
7. `src/__tests__/build-extensions-collab.test.ts` — tests for collab option to be deleted
8. `src/__tests__/comments-router.test.ts` — tests for router to be deleted
9. `src/lib/hooks/use-presence.ts` — only used by `presence-bar.tsx` (deleted)
10. `src/lib/collaboration/presence-colors.ts` — only used by `presence-bar.tsx` and `block-editor.tsx`

**Delete all 10. Run `npm test` — should pass (deleted test files, not-yet-edited source files don't import deleted components directly except block-editor which we haven't touched yet).**

### Wave 2: Edit `block-editor.tsx` to remove all collab/comment code
This is the most complex edit. Remove:
- All imports: `HocuspocusProvider`, `useSession`, `useUser`, `getPresenceColor`, `PresenceBar`, `ConnectionStatus`, `CommentBubble`/`PendingComment`, `CommentPanel`
- State: `commentPanelOpen`, `pendingComment`, `activeCommentId`, `providerRef`, `connectionStatus`, `providerReady`, `session`, `user`
- Entire provider `useEffect` (lines 161-221)
- Collaboration option from `buildExtensions` call (lines 264-274)
- Conditional `content` prop → unconditional `section.content ?? default`
- Remove `if (!providerRef.current || ...)` guards from `handleUpdate` and `handleBlur` — make both unconditional
- Comment handlers (`handleCreateComment`, `handleCloseCommentPanel`, `handleClearPending`)
- Comment click handler `useEffect` (lines 412-431)
- `PresenceBar` + `ConnectionStatus` JSX from header
- `CommentBubble` and `CommentPanel` JSX
- The `HOCUSPOCUS_URL` const at line 73
- The `CollabConnectionStatus` type alias

**Run `npm test` — `section-content-view.test.tsx` (render test) should pass because it stubs BlockEditor dynamically. `editor-extensions.test.ts` still passes because we haven't touched `build-extensions.ts` yet.**

### Wave 3: Edit `build-extensions.ts` + delete `inline-comment-mark.ts`
1. Remove collab imports from `build-extensions.ts` (lines 9-10: `Collaboration`, `CollaborationCaret`; line 14: `HocuspocusProvider` type; line 15: `Y` type; line 21: `InlineComment`)
2. Remove `collaboration?` field from `BuildExtensionsOptions` interface
3. Remove `undoRedo: options?.collaboration ? false : undefined` → just remove the `undoRedo` key
4. Remove `InlineComment` from extensions array (line 121)
5. Remove the `if (options?.collaboration)` block (lines 124-134)
6. Delete `src/lib/tiptap-extensions/inline-comment-mark.ts`

**Run `npm test -- src/__tests__/editor-extensions.test.ts` — verify `buildExtensions()` still works and extension count >= 15 still holds (removing InlineComment drops count by 1 from what it was — verify it's still above 15).**

### Wave 4: Delete tRPC comments router + clean permissions/constants
1. Delete `src/server/routers/comments.ts`
2. Edit `src/server/routers/_app.ts` — remove `import { commentRouter }` and `comments: commentRouter`
3. Edit `src/lib/permissions.ts` — remove `comment:read` and `comment:create` entries
4. Edit `src/lib/constants.ts` — remove `COMMENT_CREATE`, `COMMENT_REPLY`, `COMMENT_RESOLVE`, `COMMENT_REOPEN`, `COMMENT_DELETE` from ACTIONS

**Run `npm test` — full suite should pass (the comments-router tests were deleted in Wave 1).**

### Wave 5: Schema removal + migration
1. Edit `src/db/schema/index.ts` — remove `export * from './collaboration'`
2. Delete `src/db/schema/collaboration.ts`
3. Write `src/db/migrations/0008_drop_collaboration.sql`:
   ```sql
   -- 0008_drop_collaboration.sql
   -- Rollback Phase 11: drop Yjs and inline comment tables
   DROP TABLE IF EXISTS comment_replies CASCADE;
   DROP TABLE IF EXISTS comment_threads CASCADE;
   DROP TABLE IF EXISTS ydoc_snapshots CASCADE;
   ```
4. Apply: `npx drizzle-kit push` (or run the SQL directly if drizzle-kit push conflicts)

**Run `npm test` — no test references the collaboration schema directly (comments-router.test.ts was deleted).**

### Wave 6: npm packages + env cleanup
1. Edit `package.json` — remove `@hocuspocus/provider`, `@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-caret` from dependencies
2. Run `npm install` to update `package-lock.json`
3. Edit `.env.local` — remove commented `# NEXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1234` lines
4. Edit `app/globals.css` — remove `.collaboration-cursor__caret`, `.collaboration-cursor__label`, `.collaboration-cursor__caret[data-idle]`, `@media (prefers-reduced-motion)` collab block, `.inline-comment-mark`, `.inline-comment-mark.active` (lines 361-401)

**Run `npm test` final — full suite pass is the acceptance gate.**

### Wave 7: REQUIREMENTS.md annotation
Edit `.planning/REQUIREMENTS.md` to ensure `EDIT-06`, `EDIT-07`, `EDIT-08` entries are annotated. Per the current file (already verified), lines 35-37 already read:

```
- [x] **EDIT-06**: Real-time collaborative editing — Yjs/Hocuspocus (shipped in v0.1 Phase 11, **rolled back in v0.2 Phase 14**, deferred to v2)
- [x] **EDIT-07**: Presence indicators showing who is currently viewing/editing a section (shipped in v0.1 Phase 11, **rolled back in v0.2 Phase 14**, deferred to v2)
- [x] **EDIT-08**: Inline comments anchored to selected text (shipped in v0.1 Phase 11, **rolled back in v0.2 Phase 14**, deferred to v2)
```

**The annotation is already present.** This success criterion is already satisfied. The plan only needs to verify it's there, not add it.

---

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `ydoc_snapshots` table: holds binary Y.Doc state per sectionId. `comment_threads` + `comment_replies`: inline comment data. All reference `policy_sections.id` via CASCADE FK. | DROP all 3 tables via migration (Wave 5). Data loss is intentional — these tables are being removed entirely. |
| Live service config | `hocuspocus-server/` directory: CONFIRMED DOES NOT EXIST in the repo. No separate process to stop. | No action needed. |
| OS-registered state | No Task Scheduler tasks, pm2 processes, or systemd units for hocuspocus were found. | None — verified by absence of hocuspocus-server directory. |
| Secrets/env vars | `.env.local`: `# NEXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1234` (commented). `.env.example`: no reference (already absent). | Remove commented lines from `.env.local` (Wave 6). |
| Build artifacts | No compiled hocuspocus binaries. `node_modules/@hocuspocus/` will be removed by `npm install` after package.json edit. | Run `npm install` after removing packages (Wave 6). |

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.1 + @testing-library/react ^16.3.2 |
| Config file | `vitest.config.mts` (root) |
| Quick run command | `npm test -- src/__tests__/editor-extensions.test.ts src/__tests__/section-content-view.test.tsx` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COLLAB-ROLLBACK-01 | `buildExtensions()` does not include `collaboration` or `collaborationCaret` extensions | unit | `npm test -- src/__tests__/editor-extensions.test.ts` | ✅ exists (needs minor update after InlineComment removal) |
| COLLAB-ROLLBACK-01 | Schema exports do not include collab tables | unit | TypeScript compile: `npx tsc --noEmit` | ✅ inferred via compile |
| COLLAB-ROLLBACK-01 | `commentRouter` no longer registered in appRouter | unit | `npm test -- src/__tests__/comments-router.test.ts` | Will be deleted (COLLAB-ROLLBACK-01 means this test is removed) |
| COLLAB-ROLLBACK-02 | `SectionContentView` renders with BlockEditor stub without crashing | render | `npm test -- src/__tests__/section-content-view.test.tsx` | ✅ exists |
| COLLAB-ROLLBACK-02 | `buildExtensions()` imports cleanly without Collaboration packages | unit | `npm test -- src/__tests__/editor-extensions.test.ts` | ✅ exists |

### Per-Wave Test Cadence (critical — success criteria demands "after each deletion step")

| Wave | Action | Test Command | Acceptance Signal |
|------|--------|-------------|-------------------|
| Wave 1 | Delete 10 standalone files | `npm test` | All tests pass (deleted test files removed from suite) |
| Wave 2 | Edit `block-editor.tsx` | `npm test -- src/__tests__/section-content-view.test.tsx` | Render test passes; no import errors |
| Wave 3 | Edit `build-extensions.ts`, delete `inline-comment-mark.ts` | `npm test -- src/__tests__/editor-extensions.test.ts` | `buildExtensions()` returns array without collaboration/collaborationCaret; count still >= 15 |
| Wave 4 | Delete comments router, clean permissions | `npm test` | Full suite passes |
| Wave 5 | Remove schema + migration | `npx tsc --noEmit` | TypeScript clean compile |
| Wave 6 | Remove npm packages + env cleanup | `npm test` | Final full suite green (excluding the 3 pre-existing failures) |
| Wave 7 | Annotate REQUIREMENTS.md | Manual inspection | EDIT-06/07/08 show "rolled back in v0.2 Phase 14" text |

### Wave 0 Gaps

One test file update is needed before or during Wave 3:

- [ ] `src/__tests__/editor-extensions.test.ts` — update to remove `inlineComment` from expected extension names list and verify count expectations hold after its removal. The test at line 43 checks `>= 15` — the base extensions without InlineComment number 17 (StarterKit, CodeBlockLowlight, Image, FileHandler, Table, TableRow, TableCell, TableHeader, Details, DetailsSummary, DetailsContent, NodeRange, Callout, FileAttachment, LinkPreview, SlashCommands, Placeholder). Removing InlineComment still leaves 17 — count test passes.

No new test files need to be created. The existing render test pattern (stub BlockEditor via `next/dynamic` mock) is sufficient for COLLAB-ROLLBACK-02.

---

## Environment Availability

Step 2.6: No new external dependencies in this phase. Drizzle Kit and npm are already available. SKIPPED (only package removals and schema drops — no new tools required).

---

## Code Examples

### Example: Post-Rollback `handleUpdate` (simplified)
```typescript
// Source: current block-editor.tsx (remove the provider guard)
const handleUpdate = useCallback(
  ({ editor }: { editor: Editor }) => {
    isDirtyRef.current = true
    debouncedSave(editor.getJSON() as Record<string, unknown>)
  },
  [debouncedSave],
)
```

### Example: Drop migration SQL
```sql
-- src/db/migrations/0008_drop_collaboration.sql
-- Phase 14: Collab Rollback — remove Yjs persistence and inline comment tables
DROP TABLE IF EXISTS comment_replies CASCADE;
DROP TABLE IF EXISTS comment_threads CASCADE;
DROP TABLE IF EXISTS ydoc_snapshots CASCADE;
```

### Example: Cleaned `_app.ts` (after removing commentRouter)
```typescript
// Remove line: import { commentRouter } from './comments'
// Remove line in router: comments: commentRouter,
export const appRouter = router({
  user: userRouter,
  audit: auditRouter,
  document: documentRouter,
  feedback: feedbackRouter,
  sectionAssignment: sectionAssignmentRouter,
  evidence: evidenceRouter,
  changeRequest: changeRequestRouter,
  version: versionRouter,
  traceability: traceabilityRouter,
  notification: notificationRouter,
  workshop: workshopRouter,
  // comments: commentRouter  ← REMOVED
})
```

---

## Open Questions

1. **Drizzle Kit journal mismatch** — `meta/_journal.json` only has entry 0 (initial migration tag). Migrations 0001-0007 were applied via `drizzle-kit push` (which doesn't write journal entries for subsequent pushes). The new drop migration `0008_drop_collaboration.sql` may need to be applied directly via `psql` or `drizzle-kit push` rather than `drizzle-kit migrate`. The planner should default to `drizzle-kit push` (the established project pattern) and fall back to direct SQL if push fails.

2. **Pre-existing test failures** — `feedback-permissions.test.ts` has 2 failures and `document-router-scope.test.ts` has 1 failure before Phase 14 starts. The acceptance signal for "tests pass" should be interpreted as "no new test failures introduced" relative to the pre-Phase-14 baseline. The planner should document the 3 pre-existing failures as known baseline noise.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection via Read tool — all file paths, line numbers, and code snippets verified against actual source
- `package.json` — package versions verified from actual file
- `src/db/migrations/0007_collaboration.sql` — exact SQL verified
- `.planning/phases/11-real-time-collaboration/11-01-PLAN.md`, `11-02-PLAN.md`, `11-03-PLAN.md` — Phase 11 implementation intent

### Secondary (HIGH confidence — all from direct file inspection)
- `src/lib/permissions.ts` — comment permissions verified
- `src/lib/constants.ts` — ACTIONS constants verified
- `vitest.config.mts` — test configuration verified

### Tertiary (N/A)
No WebSearch was needed. All research findings come directly from the codebase.

---

## Metadata

**Confidence breakdown:**
- Collab code inventory: HIGH — every file inspected directly
- Schema and migration: HIGH — schema file and migration SQL read directly
- Deletion ordering: HIGH — based on actual import graph, not assumptions
- Test patterns: HIGH — existing test files read directly
- hocuspocus-server status: HIGH — confirmed absent via `ls`

**Research date:** 2026-04-13
**Valid until:** Indefinite — findings are based on static code analysis, not external dependencies
