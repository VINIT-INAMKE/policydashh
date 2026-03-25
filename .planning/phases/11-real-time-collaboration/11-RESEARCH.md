# Phase 11: Real-Time Collaboration - Research

**Researched:** 2026-03-25
**Domain:** Yjs/Hocuspocus CRDT collaboration, Tiptap 3 Collaboration extension, presence indicators, inline comments
**Confidence:** HIGH (core stack verified against npm registry and official Tiptap/Hocuspocus docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Tiptap 3 editor exists from Phase 3 (single-user)
- BlockEditor component with useEditor, buildExtensions, auto-save
- Content stored as Tiptap JSON in policySections.content
- Research recommended Yjs + Hocuspocus for real-time sync
- immediatelyRender: false already set on useEditor

### Claude's Discretion
All implementation choices are at Claude's discretion.

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EDIT-06 | Real-time collaborative editing — multiple users can edit the same section simultaneously via Yjs/Hocuspocus | `@tiptap/extension-collaboration` + `@hocuspocus/provider` on the client; `@hocuspocus/server` as a separate Node.js process with `@hocuspocus/extension-database` for binary Yjs state persistence to PostgreSQL |
| EDIT-07 | Presence indicators showing who is currently viewing/editing a section | `@tiptap/extension-collaboration-caret` configures awareness with name/color; HocuspocusProvider exposes `onAwarenessUpdate`; sidebar/avatar strip renders connected users |
| EDIT-08 | Inline comments — user selects text and leaves a comment anchored to that selection | Custom Tiptap Mark extension stores a `commentId` UUID on the selected text span; comments table in PostgreSQL stores thread metadata; tRPC router handles comment CRUD |
</phase_requirements>

---

## Summary

Phase 11 layers Yjs/Hocuspocus collaboration on top of the existing single-user Tiptap 3 editor. The editor already runs in Phase 3 with `immediatelyRender: false`, auto-save, and a full extension set. The additions are surgical: (1) add `@tiptap/extension-collaboration` and `@tiptap/extension-collaboration-caret` to the extension array, (2) replace the single-user auto-save with Hocuspocus server-side persistence, and (3) add a custom `InlineComment` mark extension plus a `commentThreads` PostgreSQL table with a tRPC router.

The critical architectural constraint is that Hocuspocus must run as a separate Node.js process — Vercel's serverless runtime cannot hold persistent WebSocket connections. The recommended deployment is Next.js on Vercel + Hocuspocus on Railway ($5/month). Both services share the same Neon PostgreSQL database. Hocuspocus persists Yjs binary state (`Uint8Array`) in a dedicated `ydoc_snapshots` column. The current Tiptap JSON in `policySections.content` becomes a secondary derived representation written by Hocuspocus on `onStoreDocument` via `TiptapTransformer.fromYdoc`, so the existing versioning/diff machinery continues to work without changes.

Inline comments (EDIT-08) are explicitly NOT covered by the official Tiptap Comments product (paid, private npm registry). The recommended approach is a custom Tiptap `Mark.create()` extension that stores `data-comment-id` attributes on selected text, backed by a `commentThreads` + `commentReplies` schema in PostgreSQL and a new tRPC `comments` router.

**Primary recommendation:** Add 3 npm packages to the Next.js app, write a standalone `hocuspocus-server/` Node.js service, add 2 DB tables, add 1 tRPC router, and surgically update BlockEditor to use the Collaboration extensions. Do not rewrite the editor.

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md references AGENTS.md:

> "This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices."

**Verified from `node_modules/next/dist/docs/01-app/02-guides/custom-server.md`:**
- Next.js 16 still supports custom servers but they are not compatible with standalone output mode
- Custom server approach disables Automatic Static Optimization
- For this phase the custom server is NOT needed in the Next.js app — Hocuspocus runs as a completely separate Node.js process, not attached to Next.js at all
- The Next.js app connects to Hocuspocus via `HocuspocusProvider({ url: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL })` from the client

---

## Standard Stack

### New Packages to Install (Next.js app)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@tiptap/extension-collaboration` | 3.20.x | Tiptap-Yjs bridge; replaces ProseMirror history with collaborative CRDT | Already pinned at ^3.20.5 for other Tiptap extensions |
| `@tiptap/extension-collaboration-caret` | 3.20.x | Renders remote cursors + user name labels inside the editor | The Tiptap 3 rename of the old `@tiptap/extension-collaboration-cursor` (which is 2.x only) |
| `@hocuspocus/provider` | 3.4.4 | WebSocket client that syncs the local Y.Doc with the Hocuspocus server | Used in BlockEditor on the client side |

### Hocuspocus Server Packages (separate `hocuspocus-server/` Node.js process)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@hocuspocus/server` | 3.4.4 | Yjs WebSocket server with auth hooks, lifecycle hooks, extension system | MIT licensed; self-hosted |
| `@hocuspocus/extension-database` | 3.4.4 | Pluggable persistence — `fetch` (load binary) + `store` (write binary) callbacks | Use with `@neondatabase/serverless` to read/write `Uint8Array` to PostgreSQL |
| `@hocuspocus/transformer` | 3.4.4 | `TiptapTransformer.fromYdoc()` to convert Y.Doc to Tiptap JSON for the secondary content column | Also `toYdoc()` for bootstrapping from existing JSON on first-ever connection |
| `yjs` | 13.6.x | CRDT engine (already in package-lock via Tiptap transitive dep; must be explicit in the server package.json) | Must match major version used by Tiptap extensions |
| `@neondatabase/serverless` | 1.0.x | Neon's serverless driver — works in Node.js too, so same driver as Next.js app | No need for pg or pg-pool in the Hocuspocus service |

### Already Installed (no new install needed)

| Library | Already In | Used By Phase 11 For |
|---------|-----------|---------------------|
| `yjs` | Transitive dep of `@tiptap/extension-collaboration` | Pulled in automatically |
| `@neondatabase/serverless` | `^1.0.2` | Hocuspocus server shares Neon DB |
| `drizzle-orm` | `^0.45.1` | Hocuspocus server can use raw Neon SQL directly (no Drizzle needed in server process) |
| `zod` | `^4.3.6` | tRPC comments router input validation |

### Installation

```bash
# In the Next.js app
npm install @tiptap/extension-collaboration @tiptap/extension-collaboration-caret @hocuspocus/provider

# In hocuspocus-server/ (separate package.json)
npm install @hocuspocus/server @hocuspocus/extension-database @hocuspocus/transformer yjs @neondatabase/serverless
```

### Version Verification

Versions above were verified against npm registry search results (2026-03-25):
- `@hocuspocus/server` latest: 3.4.4 (published ~2 months ago)
- `@tiptap/extension-collaboration` latest: 3.20.x (published within days of research date)
- `@tiptap/extension-collaboration-caret` latest: 3.20.x (published within 15 hours of research date)
- `@hocuspocus/provider` latest: 3.4.4

---

## Architecture Patterns

### Deployment Topology

```
Browser (React client)
    |
    |-- HTTPS/WSS --> Hocuspocus Server (Railway, port 1234)
    |                     |-- PostgreSQL (Neon): ydoc_snapshots (binary)
    |                     |-- PostgreSQL (Neon): policy_sections.content (JSON, secondary)
    |
    |-- HTTPS --> Next.js App (Vercel)
                      |-- PostgreSQL (Neon): all other tables
                      |-- tRPC commentThreads router
```

### Project Structure

```
policydash/                     ← Next.js app (existing)
├── src/
│   ├── lib/
│   │   └── tiptap-extensions/
│   │       └── inline-comment-mark.ts     ← NEW: custom Mark extension
│   ├── server/
│   │   └── routers/
│   │       └── comments.ts                ← NEW: tRPC comments router
│   └── db/
│       └── schema/
│           └── collaboration.ts           ← NEW: ydoc_snapshots, comment_threads, comment_replies
├── app/(workspace)/policies/[id]/_components/
│   ├── block-editor.tsx                   ← MODIFIED: add Collaboration extensions
│   ├── presence-avatars.tsx               ← NEW: avatar strip showing online users
│   └── inline-comment-popover.tsx         ← NEW: bubble UI for comments
│
hocuspocus-server/               ← NEW: separate Node.js process
├── package.json
├── server.ts                    ← Hocuspocus.configure() entry point
└── .env                         ← DATABASE_URL, CLERK_SECRET_KEY, PORT
```

### Pattern 1: Tiptap Collaboration Extension Setup

**What:** Add Collaboration (disables ProseMirror history, adds Yjs binding) and CollaborationCaret (renders remote cursors) to the extension array. Replace the `StarterKit` `undoRedo` with Collaboration's own undo.

**Key change in `buildExtensions.ts`:** Accept optional `collaborationDoc` and `collaborationProvider` params. When provided, inject the two new extensions. When absent (no-collab fallback), skip them. This keeps the function backward-compatible.

**Key change in `block-editor.tsx`:** Instantiate `HocuspocusProvider` inside a `useRef` or `useMemo`, connect it to the section's room name (`section-${section.id}`), and pass `provider.document` and `provider` to `buildExtensions`. Disable the auto-save `onUpdate` handler — Hocuspocus `onStoreDocument` owns persistence now.

```typescript
// Source: Tiptap docs — https://tiptap.dev/docs/editor/extensions/functionality/collaboration
// In buildExtensions.ts — new optional params:
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret'
import type { HocuspocusProvider } from '@hocuspocus/provider'
import type * as Y from 'yjs'

export interface BuildExtensionsOptions {
  onSlashCommand?: Partial<SuggestionOptions>
  collaboration?: {
    doc: Y.Doc
    provider: HocuspocusProvider
    user: { name: string; color: string }
  }
}

// Inside buildExtensions(), after StarterKit:
if (options?.collaboration) {
  extensions.push(
    Collaboration.configure({ document: options.collaboration.doc }),
    CollaborationCaret.configure({
      provider: options.collaboration.provider,
      user: options.collaboration.user,
    }),
  )
}
```

```typescript
// Source: Tiptap docs — StarterKit Tiptap 3 undoRedo option
// In buildExtensions(), StarterKit MUST disable undoRedo when collab is active:
StarterKit.configure({
  codeBlock: false,
  undoRedo: options?.collaboration ? false : undefined, // disables built-in history for collab
})
```

### Pattern 2: HocuspocusProvider Initialization in BlockEditor

**What:** Create the provider once per section mount. The provider connects to the Hocuspocus WebSocket server and syncs the Y.Doc.

```typescript
// Source: https://tiptap.dev/docs/hocuspocus/provider/examples
import { HocuspocusProvider } from '@hocuspocus/provider'

// Inside BlockEditor, using useRef to avoid re-creation on re-render:
const providerRef = useRef<HocuspocusProvider | null>(null)

useEffect(() => {
  const provider = new HocuspocusProvider({
    url: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL!,
    name: `section-${section.id}`,
    token: clerkSessionToken,  // sent to onAuthenticate hook
    onConnect: () => console.log('connected'),
    onDisconnect: () => console.log('disconnected'),
  })
  providerRef.current = provider
  return () => {
    provider.destroy()
  }
}, [section.id])
```

### Pattern 3: Hocuspocus Server Configuration

**What:** Standalone Node.js process (not inside Next.js). Handles auth via `onAuthenticate` (validates Clerk session token), loads Y.Doc binary from PostgreSQL via `@hocuspocus/extension-database`, writes back on change.

```typescript
// Source: https://tiptap.dev/docs/hocuspocus/server/examples
// hocuspocus-server/server.ts
import { Server } from '@hocuspocus/server'
import { Database } from '@hocuspocus/extension-database'
import { TiptapTransformer } from '@hocuspocus/transformer'
import { neon } from '@neondatabase/serverless'
import { verifyToken } from '@clerk/backend'

const sql = neon(process.env.DATABASE_URL!)

const server = Server.configure({
  port: Number(process.env.PORT) || 1234,

  async onAuthenticate({ token }) {
    // Validate Clerk session JWT
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    })
    if (!payload) throw new Error('Unauthorized')
    return { userId: payload.sub, userName: payload.name }
  },

  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        // documentName = "section-{uuid}"
        const sectionId = documentName.replace('section-', '')
        const rows = await sql`
          SELECT ydoc_binary FROM ydoc_snapshots WHERE section_id = ${sectionId}
        `
        return rows[0]?.ydoc_binary ?? null  // returns Uint8Array or null
      },
      store: async ({ documentName, state, document }) => {
        // state is Uint8Array — primary Yjs binary
        const sectionId = documentName.replace('section-', '')
        // Also extract Tiptap JSON for existing content column (secondary)
        const json = TiptapTransformer.fromYdoc(document)
        await sql`
          INSERT INTO ydoc_snapshots (section_id, ydoc_binary, updated_at)
          VALUES (${sectionId}, ${state}, NOW())
          ON CONFLICT (section_id) DO UPDATE
            SET ydoc_binary = EXCLUDED.ydoc_binary,
                updated_at = EXCLUDED.updated_at
        `
        // Keep policySections.content in sync for read-only views / versioning
        await sql`
          UPDATE policy_sections
          SET content = ${JSON.stringify(json)}, updated_at = NOW()
          WHERE id = ${sectionId}
        `
      },
    }),
  ],
})

server.listen()
```

### Pattern 4: First-Time Bootstrap (existing JSON → Y.Doc)

**What:** When a section has existing `policySections.content` but no `ydoc_snapshots` row yet, the `fetch` callback returns `null`. Hocuspocus creates an empty Y.Doc. The first connecting client will push the current Tiptap JSON into the Y.Doc via `TiptapTransformer.toYdoc`.

The recommended approach is to bootstrap in the server's `onLoadDocument` hook rather than on the client, to avoid CRDT divergence:

```typescript
// Source: https://tiptap.dev/docs/hocuspocus/guides/persistence
async onLoadDocument({ documentName, document }) {
  const sectionId = documentName.replace('section-', '')
  // Check if Y.Doc is empty (no Hocuspocus state yet)
  if (document.store.clients.size === 0) {
    const rows = await sql`
      SELECT content FROM policy_sections WHERE id = ${sectionId}
    `
    const existingJson = rows[0]?.content
    if (existingJson && existingJson.type === 'doc') {
      // Bootstrap Y.Doc from existing Tiptap JSON
      const ydoc = TiptapTransformer.toYdoc(existingJson, 'default')
      // Copy state into the document
      const update = Y.encodeStateAsUpdate(ydoc)
      Y.applyUpdate(document, update)
    }
  }
  return document
},
```

### Pattern 5: Custom Inline Comment Mark Extension

**What:** A Tiptap `Mark.create()` extension that decorates selected text with a `data-comment-id` attribute. Comment metadata (thread, replies, resolved status) lives in PostgreSQL, not inside the Y.Doc.

```typescript
// Source: Tiptap Mark extension API — https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new
// src/lib/tiptap-extensions/inline-comment-mark.ts
import { Mark } from '@tiptap/core'

export const InlineComment = Mark.create({
  name: 'inlineComment',
  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-comment-id'),
        renderHTML: (attrs) => ({ 'data-comment-id': attrs.commentId }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', { ...HTMLAttributes, class: 'inline-comment-mark' }, 0]
  },
  addCommands() {
    return {
      setInlineComment: (commentId: string) => ({ commands }) => {
        return commands.setMark(this.name, { commentId })
      },
      unsetInlineComment: (commentId: string) => ({ commands }) => {
        return commands.unsetMark(this.name)
      },
    }
  },
})
```

### Pattern 6: Presence Avatar Strip

**What:** A sidebar or top-bar component that reads `provider.awareness.states` and renders avatars/name chips for each connected user. Polls or subscribes to awareness changes.

```typescript
// Uses HocuspocusProvider awareness API
// Source: https://tiptap.dev/docs/hocuspocus/guides/awareness
import { useEffect, useState } from 'react'

function usePresence(provider: HocuspocusProvider) {
  const [users, setUsers] = useState<Array<{ name: string; color: string }>>([])
  useEffect(() => {
    const update = () => {
      const states = Array.from(provider.awareness.getStates().values())
      setUsers(states.map((s) => ({ name: s.user?.name, color: s.user?.color })))
    }
    provider.awareness.on('change', update)
    update()
    return () => provider.awareness.off('change', update)
  }, [provider])
  return users
}
```

### Anti-Patterns to Avoid

- **Do not store Y.Doc as JSON and recreate on fetch:** Converting Tiptap JSON back to a Y.Doc via `TiptapTransformer.toYdoc` on every connection causes CRDT history loss and content duplication. The primary persistence format MUST be `Uint8Array` binary (the output of `Y.encodeStateAsUpdate`). (Verified: Hocuspocus docs persistence guide)

- **Do not keep the single-user `onUpdate` → tRPC save active alongside Collaboration:** Two write paths will fight each other. When Collaboration is active, Hocuspocus `onStoreDocument` owns all writes to `policy_sections.content`. Disable the debounced `debouncedSave` when a provider is connected.

- **Do not use `@tiptap/extension-collaboration-cursor` (2.x):** This is the Tiptap 2 package. The Tiptap 3 equivalent is `@tiptap/extension-collaboration-caret`. They are different packages and not interchangeable.

- **Do not run Hocuspocus inside a Next.js API route:** Serverless functions time out after ~10-30 seconds. WebSocket connections are long-lived. Hocuspocus must be a persistent Node.js process.

- **Do not forget `undoRedo: false` in StarterKit when Collaboration is active:** The Collaboration extension includes its own undo/redo. Running both causes undo history corruption where Ctrl+Z clears the whole document instead of reverting the last change.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CRDT merge conflict resolution | Custom operational transform logic | Yjs (via Collaboration extension) | OT requires centralized server arbitration; CRDT is peer-to-peer and correct by construction |
| WebSocket connection management (reconnect, backoff, message ordering) | Custom WebSocket client | `@hocuspocus/provider` | Provider handles reconnection, binary protocol, awareness, and auth token refresh automatically |
| Awareness/presence state sync | Manual WebSocket messaging for cursor positions | `CollaborationCaret` + provider awareness | Awareness is already part of the Yjs protocol; built into the provider |
| WebSocket server with room management | Custom Node.js ws server | `@hocuspocus/server` | Hocuspocus handles: room isolation by document name, auth hook, persistence hook, extension system |
| Yjs ↔ Tiptap JSON conversion | Custom serializer | `TiptapTransformer` from `@hocuspocus/transformer` | Handles schema-aware conversion including custom node types |

**Key insight:** Yjs CRDT convergence is provably correct only when using the Yjs library's own merge algorithm. Any custom sync layer loses this guarantee and introduces potential split-brain scenarios.

---

## Common Pitfalls

### Pitfall 1: Content Duplication on Reconnect

**What goes wrong:** After reconnecting, content appears doubled (e.g., every paragraph is duplicated).

**Why it happens:** The server bootstrapped a new Y.Doc from Tiptap JSON using `TiptapTransformer.toYdoc`, but the client also had local Yjs state. When both states merge, the CRDT sees two independent inserts and appends both.

**How to avoid:** Bootstrap from JSON exactly once — in `onLoadDocument` when the Y.Doc is provably empty (`document.store.clients.size === 0`). On all subsequent loads, return the stored binary from the database and never touch `toYdoc`.

**Warning signs:** Paragraphs doubling on page refresh; content growing on every reconnect.

### Pitfall 2: Auto-Save Writing Stale JSON

**What goes wrong:** The Phase 3 `debouncedSave` (onUpdate → tRPC → `updateSectionContent`) continues to fire alongside Hocuspocus. The two writes race and one overwrites the other with potentially older content.

**Why it happens:** `block-editor.tsx` still has the `onUpdate: handleUpdate` callback registered even after adding the Collaboration extension.

**How to avoid:** In `block-editor.tsx`, conditionally register `onUpdate` only when no `collaboration` option is active. When Hocuspocus is used, `onStoreDocument` on the server is the sole writer of `policy_sections.content`.

**Warning signs:** `policy_sections.content` updates on every keystroke from one user, overwriting edits from other users.

### Pitfall 3: Clerk Token Not Forwarded to Hocuspocus

**What goes wrong:** All WebSocket connections are rejected by Hocuspocus's `onAuthenticate` hook, showing "Unauthorized" on the client.

**Why it happens:** The `HocuspocusProvider` `token` option is not set, or the token is the Clerk session token string from `useSession().session.getToken()` but the Hocuspocus server tries to verify it as a JWT directly without the right JWKS key.

**How to avoid:**
1. Client: Pass `token` to `HocuspocusProvider` using `useSession().session?.getToken()` (async, returns the current JWT)
2. Server: Use `@clerk/backend`'s `verifyToken()` with `CLERK_SECRET_KEY` from env to verify the token
3. The token is sent as part of the WebSocket handshake and available in `onAuthenticate({ token })`

**Warning signs:** Console shows WebSocket connection closing immediately with code 4000-4003 (Hocuspocus auth rejection codes).

### Pitfall 4: Schema Mismatch Between Clients

**What goes wrong:** One client has all extensions registered; another has fewer (e.g., the public portal's read-only renderer). The Y.Doc contains nodes the receiving ProseMirror schema doesn't know about — content appears corrupted or silently dropped.

**Why it happens:** Tiptap is strict about schema validation. If a Y.Doc update references a node type not in the local schema, ProseMirror drops it.

**How to avoid:** The Hocuspocus server does not need to know the full Tiptap schema. Only the connecting Tiptap editor instances need matching schemas. Ensure all clients connecting to the same room use the same extension set. The public portal uses `tiptap-renderer.ts` (a string renderer, not a live editor) and never connects to Hocuspocus — this is safe.

**Warning signs:** Custom nodes (callout, fileAttachment, linkPreview) disappear for users who join after initial content was written.

### Pitfall 5: Inline Comment Marks Orphaned After Text Deletion

**What goes wrong:** A user deletes text that had an inline comment mark. The `data-comment-id` is gone from the document, but the `comment_threads` row still exists in the database. The comment is now unresolvable (no anchor to display).

**Why it happens:** Yjs CRDT handles text deletion correctly (the mark moves with the text and is deleted with it), but the database row has no awareness of the document change.

**How to avoid:** In the `onStoreDocument` hook on the Hocuspocus server, after writing the Tiptap JSON, scan the JSON for all active `commentId` values and mark any database comment threads whose ID no longer appears in the document as `orphaned`. The UI shows orphaned threads in a "Unanchored Comments" sidebar section rather than hiding them.

**Warning signs:** Comment threads that can never be resolved; comment count in DB diverges from marks in the document.

### Pitfall 6: Memory Leak from HocuspocusProvider Not Destroyed

**What goes wrong:** Navigating between sections leaves disconnected providers in memory. On Hocuspocus server, the room stays open (consuming server memory) because no disconnect event fires.

**Why it happens:** The `HocuspocusProvider` is instantiated but `provider.destroy()` is not called in the `useEffect` cleanup.

**How to avoid:** Always return `() => { provider.destroy() }` from the `useEffect` that creates the provider. Verified pattern from Hocuspocus provider docs.

---

## Database Schema Additions

Two new tables required. These should be added to `src/db/schema/collaboration.ts` and migrated via Drizzle Kit.

### `ydoc_snapshots`

```sql
CREATE TABLE ydoc_snapshots (
  section_id  UUID PRIMARY KEY REFERENCES policy_sections(id) ON DELETE CASCADE,
  ydoc_binary BYTEA NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Drizzle schema:
```typescript
import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core'
import { customType } from 'drizzle-orm/pg-core'
import { policySections } from './documents'

// BYTEA custom type for Yjs binary
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() { return 'bytea' },
  toDriver(val) { return Buffer.from(val) },
  fromDriver(val) { return new Uint8Array(val) },
})

export const ydocSnapshots = pgTable('ydoc_snapshots', {
  sectionId: uuid('section_id').primaryKey().references(() => policySections.id, { onDelete: 'cascade' }),
  ydocBinary: bytea('ydoc_binary').notNull(),
  updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

### `comment_threads` + `comment_replies`

```typescript
export const commentThreads = pgTable('comment_threads', {
  id:         uuid('id').primaryKey().defaultRandom(),
  sectionId:  uuid('section_id').notNull().references(() => policySections.id, { onDelete: 'cascade' }),
  commentId:  uuid('comment_id').notNull().unique(),  // matches data-comment-id in Tiptap mark
  authorId:   text('author_id').notNull(),             // Clerk userId
  body:       text('body').notNull(),
  resolved:   boolean('resolved').notNull().default(false),
  orphaned:   boolean('orphaned').notNull().default(false),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const commentReplies = pgTable('comment_replies', {
  id:        uuid('id').primaryKey().defaultRandom(),
  threadId:  uuid('thread_id').notNull().references(() => commentThreads.id, { onDelete: 'cascade' }),
  authorId:  text('author_id').notNull(),
  body:      text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

---

## Code Examples

### Verified Patterns from Official Sources

#### Adding Collaboration to useEditor (Tiptap 3)

```typescript
// Source: https://tiptap.dev/docs/editor/extensions/functionality/collaboration
// The critical change: disable undoRedo in StarterKit, use Collaboration instead
const editor = useEditor({
  immediatelyRender: false,  // already set in block-editor.tsx
  extensions: buildExtensions({
    onSlashCommand: { ... },
    collaboration: {
      doc: providerRef.current!.document,
      provider: providerRef.current!,
      user: { name: clerkUser.fullName, color: generateColor(clerkUser.id) },
    },
  }),
  // Do NOT set onUpdate when collaboration is active
})
```

#### CollaborationCaret CSS (presence cursor styling)

```css
/* globals.css — add to project */
.collaboration-cursor__caret {
  border-left: 1px solid currentColor;
  border-right: 1px solid currentColor;
  word-break: normal;
  pointer-events: none;
}
.collaboration-cursor__label {
  border-radius: 2px 2px 2px 0;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  padding: 2px 4px;
  position: absolute;
  top: -1.4em;
  left: -1px;
  user-select: none;
  white-space: nowrap;
}
```

#### Clerk Token for HocuspocusProvider

```typescript
// Source: Clerk docs — https://clerk.com/docs/reference/backend/verify-token
// Client side — in block-editor.tsx
import { useSession } from '@clerk/nextjs'

const { session } = useSession()

// Inside useEffect:
const token = await session?.getToken()
const provider = new HocuspocusProvider({
  url: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL!,
  name: `section-${section.id}`,
  token: token ?? '',
})
```

#### Inline Comment: Creating a Thread

```typescript
// In inline-comment-popover.tsx — when user submits a comment
const commentId = crypto.randomUUID()

// 1. Write the mark to the editor
editor.chain().focus().setInlineComment(commentId).run()

// 2. Save thread to DB via tRPC
createThread.mutate({
  sectionId: section.id,
  commentId,
  body: inputValue,
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@tiptap/extension-collaboration-cursor` (presence) | `@tiptap/extension-collaboration-caret` | Tiptap 3.0 stable | Different package name; old package stuck at 2.x |
| `history: false` in StarterKit (Tiptap 2) | `undoRedo: false` in StarterKit (Tiptap 3) | Tiptap 3.0 migration | Must use new option name or undo/redo conflicts |
| Socket.IO for real-time | Yjs + Hocuspocus | 2022-onward | Yjs CRDT is conflict-free; Socket.IO is raw messaging with no merge guarantee |
| Tiptap Cloud Comments (paid) | Custom mark + PostgreSQL table | Available since Tiptap OSS | Tiptap Comments requires private npm registry and paid subscription; custom mark approach is fully open source |

**Deprecated/outdated:**
- `@tiptap/extension-collaboration-cursor`: Stuck at 2.x, not compatible with Tiptap 3. Do not install.
- `y-websocket` standalone: Raw Yjs WebSocket server with no auth hooks, no persistence hooks. Use Hocuspocus instead.
- Tiptap Comments (paid extension): Requires Tiptap private npm registry access. Not suitable for this project.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js runtime | Hocuspocus server process | Must verify on Railway deploy | 18+ (LTS) | — |
| PostgreSQL / Neon | ydoc_snapshots persistence | Already deployed | Neon serverless | — |
| Railway / Render (or equiv) | Hocuspocus WebSocket hosting | Not yet provisioned | — | Render, Fly.io, or VPS |
| Clerk secret key | Hocuspocus onAuthenticate | Available (CLERK_SECRET_KEY in env) | — | — |

**Missing dependencies with no fallback:**
- Hocuspocus hosting platform (Railway/Render) must be provisioned before the feature can be end-to-end tested. Local dev uses `ws://localhost:1234`. Production requires a deployed URL set in `NEXT_PUBLIC_HOCUSPOCUS_URL`.

**Missing dependencies with fallback:**
- Hocuspocus server process: In development, run with `npx ts-node hocuspocus-server/server.ts` or `node --experimental-specifier-resolution=node hocuspocus-server/server.js`. No external service needed locally.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.mts` (exists) |
| Quick run command | `npm test` (runs `vitest run`) |
| Full suite command | `npm test` |
| Test include pattern | `src/**/*.test.ts`, `src/**/*.test.tsx` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EDIT-06 | Collaboration extension added to buildExtensions when collaboration option provided | unit | `npm test -- src/lib/tiptap-extensions/build-extensions.test.ts` | No — Wave 0 |
| EDIT-06 | StarterKit disables undoRedo when collaboration active | unit | `npm test -- src/lib/tiptap-extensions/build-extensions.test.ts` | No — Wave 0 |
| EDIT-07 | usePresence hook returns connected users from awareness | unit | `npm test -- src/lib/hooks/use-presence.test.ts` | No — Wave 0 |
| EDIT-08 | InlineComment mark setInlineComment command adds data-comment-id attribute | unit | `npm test -- src/lib/tiptap-extensions/inline-comment-mark.test.ts` | No — Wave 0 |
| EDIT-08 | comments tRPC router createThread validates input and writes to DB | unit (mocked DB) | `npm test -- src/server/routers/comments.test.ts` | No — Wave 0 |

**Note on EDIT-06 E2E:** True multi-user collaboration requires two real browser connections. This cannot be unit-tested with jsdom. Playwright multi-page tests are the correct tool but are not part of the current test setup. Wave 0 unit tests cover the extension configuration; manual verification covers real-time sync.

### Sampling Rate

- **Per task commit:** `npm test` (unit tests only, ~5s)
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + manual smoke test (two browser tabs editing same section)

### Wave 0 Gaps

- [ ] `src/lib/tiptap-extensions/build-extensions.test.ts` — covers EDIT-06 (collaboration option wiring)
- [ ] `src/lib/hooks/use-presence.test.ts` — covers EDIT-07 (awareness hook)
- [ ] `src/lib/tiptap-extensions/inline-comment-mark.test.ts` — covers EDIT-08 (mark commands)
- [ ] `src/server/routers/comments.test.ts` — covers EDIT-08 (tRPC router validation)

---

## Open Questions

1. **Hocuspocus hosting for production**
   - What we know: Local dev uses `ws://localhost:1234`; production needs a persistent Node.js host
   - What's unclear: Which hosting platform is provisioned (Railway, Render, Fly.io, VPS)
   - Recommendation: Planner should include a task to provision Railway and set `NEXT_PUBLIC_HOCUSPOCUS_URL` in Vercel env vars. If not yet available, Gate the feature behind a `NEXT_PUBLIC_COLLAB_ENABLED=true` env flag.

2. **Clerk token expiry during long editing sessions**
   - What we know: Clerk JWTs expire (default 60s to 3 minutes for session tokens; longer for template tokens)
   - What's unclear: Whether Hocuspocus auto-retries authentication on token expiry
   - Recommendation: Use `session.getToken()` in a `onSyncStart` or periodic refresh inside the provider's `token` option as a function (HocuspocusProvider supports `token: () => Promise<string>`). Investigate Hocuspocus provider `token` as async function.

3. **BYTEA Drizzle custom type for ydoc_snapshots**
   - What we know: Drizzle ORM does not have a built-in `bytea` column type; requires `customType`
   - What's unclear: Whether Neon's serverless HTTP driver (not WebSocket) handles binary `Uint8Array` correctly with Drizzle's `customType` or whether raw SQL (`sql` tagged template) is safer
   - Recommendation: Use raw Neon `sql` tagged template in the Hocuspocus server for the binary column to avoid Drizzle driver serialization surprises. Use Drizzle only for the schema definition in the Next.js app (migrations only).

---

## Sources

### Primary (HIGH confidence)

- [Tiptap Collaboration Extension Docs](https://tiptap.dev/docs/editor/extensions/functionality/collaboration) — `@tiptap/extension-collaboration` setup, `undoRedo: false` requirement
- [Tiptap CollaborationCaret Extension Docs](https://tiptap.dev/docs/editor/extensions/functionality/collaboration-caret) — `@tiptap/extension-collaboration-caret` setup, user name/color config
- [Hocuspocus Getting Started](https://tiptap.dev/docs/hocuspocus/getting-started/overview) — server setup, extension system
- [Hocuspocus Database Extension Docs](https://tiptap.dev/docs/hocuspocus/server/extensions/database) — `fetch`/`store` callback format, `Uint8Array` requirement
- [Hocuspocus Persistence Guide](https://tiptap.dev/docs/hocuspocus/guides/persistence) — critical warning: never store as JSON and recreate as Y.Doc
- [Hocuspocus Authentication Guide](https://tiptap.dev/docs/hocuspocus/guides/authentication) — `onAuthenticate` hook, token forwarding
- [Hocuspocus Awareness Guide](https://tiptap.dev/docs/hocuspocus/guides/awareness) — presence sync
- [npm: @hocuspocus/server](https://www.npmjs.com/package/@hocuspocus/server) — version 3.4.4 confirmed
- [npm: @tiptap/extension-collaboration-caret](https://www.npmjs.com/package/@tiptap/extension-collaboration-caret) — version 3.20.x (Tiptap 3 rename)
- [Liveblocks: Migrating Tiptap 2 → 3](https://liveblocks.io/docs/guides/migrating-from-tiptap-2-to-3) — confirms `undoRedo: false` (Tiptap 3) vs `history: false` (Tiptap 2)
- [Clerk verifyToken docs](https://clerk.com/docs/reference/backend/verify-token) — server-side JWT validation

### Secondary (MEDIUM confidence)

- [Hocuspocus Transformer — GitHub source](https://github.com/ueberdosis/hocuspocus/blob/main/packages/transformer/src/Tiptap.ts) — `TiptapTransformer.fromYdoc` / `toYdoc` usage
- [sereneinserenade/tiptap-comment-extension](https://github.com/sereneinserenade/tiptap-comment-extension) — open-source comment mark pattern (Tiptap 2, but mark approach is valid for Tiptap 3 with same API)
- Next.js 16 custom server docs (`node_modules/next/dist/docs/01-app/02-guides/custom-server.md`) — confirms Hocuspocus must NOT run inside Next.js custom server for Vercel deployment

### Tertiary (LOW confidence — flag for validation)

- Hocuspocus `token` option as `async function` for refresh: documented in provider examples but exact API for function-returning token needs verification against `@hocuspocus/provider` 3.4.4 source before implementation.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — npm versions verified, Tiptap 3 and Hocuspocus 3.x are actively published and the extension names are confirmed
- Architecture: HIGH — separation of Next.js + Hocuspocus is documented explicitly by Tiptap team (Vercel is serverless, can't hold WebSocket); BYTEA persistence pattern is documented in Hocuspocus guides
- Pitfalls: HIGH — content duplication on reconnect, auto-save conflict, and undoRedo conflict are documented in Hocuspocus guides and Tiptap GitHub issues
- Inline comments: MEDIUM — custom mark approach is correct Tiptap 3 API; the community extension is Tiptap 2 only and the mark must be written fresh for Tiptap 3 (same API, just not copy-paste-able)

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (Hocuspocus and Tiptap release frequently; recheck versions before install)
