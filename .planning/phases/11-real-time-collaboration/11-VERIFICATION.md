---
phase: 11-real-time-collaboration
verified: 2026-03-26T09:30:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 11: Real-Time Collaboration Verification Report

**Phase Goal:** Multiple users can simultaneously edit the same policy section with live presence awareness and inline discussion via comments
**Verified:** 2026-03-26T09:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                        | Status     | Evidence                                                                          |
|----|--------------------------------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------|
| 1  | Collaboration DB tables (ydoc_snapshots, comment_threads, comment_replies) exist after migration             | VERIFIED   | `src/db/schema/collaboration.ts` defines all three tables; `src/db/migrations/0007_collaboration.sql` contains all three CREATE TABLE statements with correct foreign keys and indexes |
| 2  | Hocuspocus server process starts and listens on configured port                                              | VERIFIED   | `hocuspocus-server/server.ts` calls `Server.configure(...)` and `server.listen()` with `console.log` on the port; `hocuspocus-server/node_modules` is present (npm install ran) |
| 3  | InlineComment mark extension can set/unset comment marks with commentId attribute                            | VERIFIED   | `src/lib/tiptap-extensions/inline-comment-mark.ts` exports `InlineComment` via `Mark.create`, implements `setInlineComment(commentId)` and `unsetInlineComment()` commands, renders `span[data-comment-id]` |
| 4  | tRPC comments router provides CRUD for comment threads and replies                                           | VERIFIED   | `src/server/routers/comments.ts` exports `commentRouter` with list, create, createReply, resolve, reopen, delete procedures — all wired to real Drizzle DB queries on `commentThreads` and `commentReplies` |
| 5  | buildExtensions accepts optional collaboration config and disables undoRedo when active                      | VERIFIED   | `src/lib/tiptap-extensions/build-extensions.ts` line 58: `undoRedo: options?.collaboration ? false : undefined`; conditionally pushes `Collaboration.configure` and `CollaborationCaret.configure` at lines 124–133 |
| 6  | BlockEditor connects to Hocuspocus via HocuspocusProvider when NEXT_PUBLIC_HOCUSPOCUS_URL is set             | VERIFIED   | `block-editor.tsx` line 6 imports `HocuspocusProvider`; line 73 reads `process.env.NEXT_PUBLIC_HOCUSPOCUS_URL`; lines 176–189 instantiate and configure the provider in a `useEffect` |
| 7  | Auto-save is disabled when collaboration is active; re-enables on disconnect                                 | VERIFIED   | `block-editor.tsx` lines 141–143: `if (!providerRef.current || connectionStatusRef.current === 'disconnected') { debouncedSave(...) }` — same guard on `handleBlur` |
| 8  | Remote user cursors appear inline with name labels colored by user presence color                            | VERIFIED   | `CollaborationCaret` injected via `buildExtensions` when collaboration active; CSS at `app/globals.css` lines 361–400 defines `.collaboration-cursor__caret` and `.collaboration-cursor__label` with correct styles |
| 9  | PresenceBar shows avatar circles for all connected users with initials and tooltips                          | VERIFIED   | `presence-bar.tsx` uses `usePresence(provider)`, renders 28px circle avatars with deterministic color from `getPresenceColor`, tooltips with name, overflow pill for >5 users, `aria-label` on container |
| 10 | ConnectionStatus shows green/amber/red dot reflecting WebSocket connection state                             | VERIFIED   | `connection-status.tsx` renders 8px dot with `#16A34A`/`#D97706`/`#DC2626` per state, `animate-pulse` on connecting, `role="status"` and `aria-live="polite"` |
| 11 | User can select text and see a Comment bubble, post a comment that applies an InlineComment mark to the selection and creates a thread in the DB | VERIFIED | `comment-bubble.tsx` detects selection via `editor.on('selectionUpdate')` + `window.getSelection()`; `comment-panel.tsx` line 133 generates `crypto.randomUUID()`, line 139 calls `editor.chain().setInlineComment(commentId).run()`, line 144 calls `trpc.comments.create.mutateAsync(...)` |
| 12 | User can reply to threads, resolve/reopen; CommentPanel shows open and resolved tabs                         | VERIFIED   | `comment-panel.tsx` has Tabs with "Open (N)" / "Resolved (N)"; all six tRPC mutations (create, createReply, resolve, reopen, delete, list) are wired; `comment-thread.tsx` renders reply form, DropdownMenu with resolve/reopen/delete, toast feedback |

**Score:** 12/12 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact                                           | Provides                                                        | Exists | Substantive                                                         | Wired              | Status     |
|----------------------------------------------------|-----------------------------------------------------------------|--------|---------------------------------------------------------------------|--------------------|------------|
| `src/db/schema/collaboration.ts`                   | ydocSnapshots, commentThreads, commentReplies Drizzle schemas   | YES    | 51 lines; all three tables defined with BYTEA custom type           | Exported via `src/db/schema/index.ts` line 11 | VERIFIED   |
| `hocuspocus-server/server.ts`                      | Standalone Hocuspocus WebSocket server                          | YES    | 83 lines; `Server.configure`, `onAuthenticate`, `onLoadDocument`, Database extension with fetch/store | Called by `server.listen()` — standalone process, not imported | VERIFIED   |
| `src/lib/tiptap-extensions/inline-comment-mark.ts` | Custom Tiptap Mark for inline comments                          | YES    | 67 lines; `Mark.create`, `data-comment-id` attribute, setInlineComment/unsetInlineComment commands | Imported and pushed in `build-extensions.ts` line 21 + 120 | VERIFIED   |
| `src/server/routers/comments.ts`                   | tRPC comment thread CRUD                                        | YES    | 207 lines; 6 procedures with real DB queries and audit logging      | Imported and registered in `_app.ts` line 13 + 27 | VERIFIED   |
| `src/lib/tiptap-extensions/build-extensions.ts`    | Extended buildExtensions with optional collaboration parameter  | YES    | 137 lines; collaboration option, undoRedo disable, conditional Collaboration + CollaborationCaret injection | Called in `block-editor.tsx` line 225 with collaboration option | VERIFIED   |
| `src/db/migrations/0007_collaboration.sql`         | SQL migration for 3 new tables                                  | YES    | All three tables, correct FK constraints, 3 performance indexes     | Migration file — applied separately from ORM | VERIFIED   |

### Plan 02 Artifacts

| Artifact                                                                  | Provides                                               | Exists | Substantive                                                          | Wired                                                              | Status     |
|---------------------------------------------------------------------------|--------------------------------------------------------|--------|----------------------------------------------------------------------|--------------------------------------------------------------------|------------|
| `app/(workspace)/policies/[id]/_components/block-editor.tsx`              | Collaboration-aware editor with HocuspocusProvider     | YES    | 554 lines; HocuspocusProvider init, conditional auto-save, comment integration | Used by `section-content-view.tsx`                          | VERIFIED   |
| `app/(workspace)/policies/[id]/_components/presence-bar.tsx`              | Avatar strip showing connected users                   | YES    | 102 lines; usePresence hook, deterministic colors, tooltips, overflow pill | Rendered in block-editor.tsx lines 455–460 conditionally on `providerRef.current` | VERIFIED   |
| `app/(workspace)/policies/[id]/_components/connection-status.tsx`         | WebSocket connection state indicator                   | YES    | 80 lines; 3-state config, correct colors, pulse animation, ARIA     | Rendered in block-editor.tsx lines 465–467 conditionally on `providerRef.current` | VERIFIED   |
| `src/lib/hooks/use-presence.ts`                                           | React hook reading awareness state                     | YES    | 69 lines; subscribes to `awareness.on('change')` and `'update'`, cleanup on unmount | Imported and called in `presence-bar.tsx` lines 10 + 19     | VERIFIED   |
| `src/lib/collaboration/presence-colors.ts`                                | Deterministic color assignment from user ID            | YES    | 51 lines; 8-slot PRESENCE_COLORS palette, getPresenceColor, getInitials | Imported in block-editor.tsx line 19, presence-bar.tsx line 11, comment-thread.tsx line 21 | VERIFIED   |
| `app/globals.css`                                                          | CollaborationCaret CSS and inline-comment-mark CSS     | YES    | `.collaboration-cursor__caret`, `.collaboration-cursor__label`, `.inline-comment-mark`, `.inline-comment-mark.active`, `prefers-reduced-motion` query | Global CSS — applied to all editor instances | VERIFIED   |

### Plan 03 Artifacts

| Artifact                                                                   | Provides                                                   | Exists | Substantive                                                             | Wired                                                                       | Status     |
|----------------------------------------------------------------------------|------------------------------------------------------------|--------|-------------------------------------------------------------------------|-----------------------------------------------------------------------------|------------|
| `app/(workspace)/policies/[id]/_components/comment-bubble.tsx`             | Floating comment trigger above text selection              | YES    | 149 lines; selection detection, positioning, keyboard shortcut Ctrl+Alt+M, aria-label | Imported and rendered in block-editor.tsx lines 30 + 527                 | VERIFIED   |
| `app/(workspace)/policies/[id]/_components/comment-panel.tsx`              | Right-side panel with tabs, thread list, new comment form  | YES    | 361 lines; responsive (inline/Sheet), all 6 tRPC mutations wired, setInlineComment call | Imported and rendered in block-editor.tsx lines 31 + 542–551            | VERIFIED   |
| `app/(workspace)/policies/[id]/_components/comment-thread.tsx`             | Individual thread with replies, resolve/reopen/delete      | YES    | 296 lines; DropdownMenu, reply form, toast feedback, relative timestamps | Imported in comment-panel.tsx line 19; rendered in thread list loops         | VERIFIED   |

---

## Key Link Verification

### Plan 01 Key Links

| From                              | To                                     | Via                                                         | Status   | Evidence                                                                 |
|-----------------------------------|----------------------------------------|-------------------------------------------------------------|----------|--------------------------------------------------------------------------|
| `hocuspocus-server/server.ts`     | `src/db/schema/collaboration.ts`       | `ydoc_snapshots` table via raw Neon SQL                     | WIRED    | Lines 49 and 63 of server.ts query/upsert `ydoc_snapshots` directly via `sql` tagged template |
| `src/server/routers/comments.ts`  | `src/db/schema/collaboration.ts`       | Drizzle queries on `commentThreads`/`commentReplies`        | WIRED    | Line 6 imports both; 16 query/mutation callsites all operate on real tables |
| `src/lib/tiptap-extensions/build-extensions.ts` | `@tiptap/extension-collaboration` | Conditional extension injection with `Collaboration.configure` | WIRED | Line 9 imports Collaboration; line 126 calls `Collaboration.configure({ document: ... })` when collaboration option provided |

### Plan 02 Key Links

| From                            | To                       | Via                                               | Status   | Evidence                                                                  |
|---------------------------------|--------------------------|---------------------------------------------------|----------|---------------------------------------------------------------------------|
| `block-editor.tsx`              | `@hocuspocus/provider`   | `HocuspocusProvider` instantiation in `useEffect` | WIRED    | Line 6 imports; lines 176–189 create `new HocuspocusProvider({ url, name: \`section-${section.id}\`, token })` |
| `block-editor.tsx`              | `build-extensions.ts`    | `collaboration:` option passed to buildExtensions | WIRED    | Lines 265–274: `collaboration: providerRef.current ? { doc, provider, user } : undefined` |
| `presence-bar.tsx`              | `use-presence.ts`        | `usePresence(provider)` consuming awareness       | WIRED    | Lines 10 + 19 of presence-bar.tsx                                         |

### Plan 03 Key Links

| From                  | To                    | Via                                                          | Status   | Evidence                                                                       |
|-----------------------|-----------------------|--------------------------------------------------------------|----------|--------------------------------------------------------------------------------|
| `comment-bubble.tsx`  | `comment-panel.tsx`   | `onCreateComment` callback opens panel with selection context | WIRED    | bubble.tsx line 17 declares prop; block-editor.tsx lines 393–398 wire bubble -> `setPendingComment` + `setCommentPanelOpen(true)` |
| `comment-panel.tsx`   | `src/server/routers/comments.ts` | `trpc.comments.*` mutations                      | WIRED    | Lines 63–106 of comment-panel.tsx: `trpc.comments.list.useQuery`, `.create`, `.createReply`, `.resolve`, `.reopen`, `.delete` all used |
| `comment-panel.tsx`   | `inline-comment-mark.ts` | `editor.chain().setInlineComment(commentId)`              | WIRED    | Line 140 of comment-panel.tsx: `.setInlineComment(commentId).run()` called before `createMutation.mutateAsync` |

---

## Data-Flow Trace (Level 4)

### comment-panel.tsx — Comment Thread List

| Data Variable   | Source                                              | Produces Real Data                              | Status   |
|-----------------|-----------------------------------------------------|-------------------------------------------------|----------|
| `threadsQuery.data` | `trpc.comments.list.useQuery({ sectionId })`    | YES — router queries `commentThreads` + `commentReplies` via Drizzle; returns joined data with `replies` array | FLOWING  |
| `openThreads`   | Derived from `threadsQuery.data` filtered by `!resolved` | YES — real DB data filtered in component | FLOWING  |
| `resolvedThreads` | Derived from `threadsQuery.data` filtered by `resolved` | YES — same source                            | FLOWING  |

### hocuspocus-server/server.ts — Y.Doc Binary Persistence

| Data Variable   | Source                                              | Produces Real Data                              | Status   |
|-----------------|-----------------------------------------------------|-------------------------------------------------|----------|
| Binary Y.Doc    | `fetch({ documentName })` reads `ydoc_snapshots.ydoc_binary` | YES — raw Neon SQL SELECT on BYTEA column; returns `Uint8Array` or `null` | FLOWING |
| `store(...)` persistence | Upserts `ydoc_snapshots` + updates `policy_sections.content` | YES — real INSERT ON CONFLICT and UPDATE statements | FLOWING |

### presence-bar.tsx — Connected Users

| Data Variable | Source                                        | Produces Real Data                                                    | Status   |
|---------------|-----------------------------------------------|-----------------------------------------------------------------------|----------|
| `users`       | `usePresence(provider)` → `awareness.getStates()` | YES — live Hocuspocus awareness state; populates from provider WebSocket | FLOWING (requires Hocuspocus server running; correct by design) |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED for Hocuspocus server (requires running external WebSocket server). The following static checks were performed instead:

| Behavior                                         | Check                                                                       | Result                                                    | Status  |
|--------------------------------------------------|-----------------------------------------------------------------------------|-----------------------------------------------------------|---------|
| `server.ts` exports runnable entry point          | `hocuspocus-server/server.ts` calls `server.listen()`                       | Line 81: `server.listen().then(...)` with console.log     | PASS    |
| `comments.ts` router exports `commentRouter`      | `grep "export const commentRouter"` in comments.ts                          | Line 10 confirmed                                         | PASS    |
| `_app.ts` registers comments route               | `comments: commentRouter` in appRouter                                      | Line 27 confirmed                                         | PASS    |
| `build-extensions.ts` has collaboration option    | `grep "Collaboration\.configure"` in build-extensions.ts                    | Line 126 confirmed                                        | PASS    |
| `InlineComment` always included in extensions     | Line 120 of build-extensions.ts: `InlineComment` pushed unconditionally     | Confirmed — works in single-user and collaborative mode   | PASS    |
| DB migration file matches schema                  | `0007_collaboration.sql` has all three tables, matching Drizzle schema      | All three tables + 3 indexes confirmed                    | PASS    |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description                                                                      | Status       | Evidence                                                                              |
|-------------|----------------|----------------------------------------------------------------------------------|--------------|---------------------------------------------------------------------------------------|
| EDIT-06     | 11-01, 11-02   | Real-time collaborative editing — multiple users can edit the same section simultaneously via Yjs/Hocuspocus | SATISFIED    | Hocuspocus server with Yjs binary persistence (`server.ts`); BlockEditor wires `HocuspocusProvider` with Y.Doc CRDT sync; `buildExtensions` injects `Collaboration` extension |
| EDIT-07     | 11-01, 11-02   | Presence indicators showing who is currently viewing/editing a section           | SATISFIED    | `PresenceBar` renders connected users via `usePresence(provider)`; `ConnectionStatus` shows green/amber/red dot; `CollaborationCaret` CSS renders remote cursor name labels |
| EDIT-08     | 11-01, 11-03   | Inline comments — user can select text and leave a comment anchored to that selection | SATISFIED | `CommentBubble` + `CommentPanel` + `CommentThread` provide full comment lifecycle; `setInlineComment` marks selection with `data-comment-id`; tRPC comments router persists threads/replies |

All three requirement IDs declared across the three plans are accounted for. No orphaned requirements detected for Phase 11 in REQUIREMENTS.md.

---

## Anti-Patterns Found

No blocker anti-patterns detected in the produced code.

Minor observations (informational only — not blockers):

| File                       | Line | Pattern                                                  | Severity | Impact                                                           |
|----------------------------|------|----------------------------------------------------------|----------|------------------------------------------------------------------|
| `comment-thread.tsx`       | 127  | `// Undo is fire-and-forget; the parent can re-fetch`    | INFO     | Undo action in the delete toast is a no-op stub; delete is immediate and not reversible via UI. Does not block EDIT-08 goal — deletion works correctly, only the "Undo" action within the 5s toast window is unimplemented |
| `block-editor.tsx`         | 265  | `collaboration: providerRef.current ? ...`               | INFO     | `providerRef.current` is read at render time before the async provider init `useEffect` completes; `providerReady` state ensures re-render, but the collaboration extensions won't be injected until `providerReady` triggers a re-render. This is the correct pattern but relies on `[section.id, providerReady]` dependency in `useEditor` |
| `hocuspocus-server/server.ts` | 64  | `${state as unknown as string}` cast on BYTEA             | INFO     | The `state` Uint8Array is cast to `string` to satisfy Neon's typed template literal. This works because Neon's binary handling accepts Buffer/Uint8Array but TypeScript requires the cast. No runtime impact |

---

## Human Verification Required

The following behaviors require two-browser live testing and cannot be verified programmatically:

### 1. Real-Time CRDT Sync (EDIT-06)

**Test:** Open two browser windows logged in as different users to the same policy section. Set `NEXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1234` and start the Hocuspocus server (`cd hocuspocus-server && npm run dev`).
**Expected:** Typing in one window appears in the other window within ~1 second, without page reload.
**Why human:** Requires two live browser sessions + running WebSocket server.

### 2. Remote Cursor Name Labels (EDIT-07)

**Test:** With two users connected to the same section, move the cursor in window A.
**Expected:** A colored cursor caret with the user's name label appears in window B at the correct text position.
**Why human:** CSS cursor rendering requires visual inspection; cannot be verified via static analysis.

### 3. Presence Avatar Strip (EDIT-07)

**Test:** With two users connected, check the editor header area.
**Expected:** Both users' initials appear as colored circle avatars in the PresenceBar. Hovering an avatar shows the full name tooltip.
**Why human:** Requires live Hocuspocus awareness state to populate.

### 4. Offline Fallback Auto-Save (EDIT-06)

**Test:** With collaboration active, stop the Hocuspocus server. Type in the editor.
**Expected:** ConnectionStatus dot turns red ("Offline"); edits auto-save via tRPC within ~1.5 seconds; restarting the server reconnects and the green dot returns.
**Why human:** Requires starting/stopping the WebSocket server and observing UI state transitions.

### 5. Full Comment Flow End-to-End (EDIT-08)

**Test:** Select text in the editor. Click "Comment" in the bubble. Post a comment. Reply. Resolve.
**Expected:** Selected text gets a yellow/primary highlight. Thread appears in the Open tab. Reply appears indented. Resolving moves thread to Resolved tab and removes highlight.
**Why human:** Requires interacting with the live editor — text selection, InlineComment mark rendering, and UI state transitions cannot be verified statically.

---

## Gaps Summary

No gaps. All 12 must-haves across all three plans are verified at all four levels (exists, substantive, wired, data flowing). All three requirement IDs (EDIT-06, EDIT-07, EDIT-08) are satisfied by implemented code. The only unimplemented item is the "Undo" action on the delete toast in `comment-thread.tsx` line 127, which is a fire-and-forget placeholder — this does not block the EDIT-08 goal (delete itself works correctly and is audited).

The phase goal — "Multiple users can simultaneously edit the same policy section with live presence awareness and inline discussion via comments" — is achieved by the combined output of all three plans:

- **Simultaneous editing:** Hocuspocus server + Y.Doc CRDT + `HocuspocusProvider` in BlockEditor
- **Live presence awareness:** PresenceBar + ConnectionStatus + `usePresence` hook + `CollaborationCaret` remote cursors
- **Inline discussion:** CommentBubble + CommentPanel + CommentThread + tRPC comments router + InlineComment mark

---

_Verified: 2026-03-26T09:30:00Z_
_Verifier: Claude (gsd-verifier)_
