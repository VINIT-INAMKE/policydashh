# Architecture Research

**Domain:** Stakeholder policy consultation platform with real-time collaborative editing
**Researched:** 2026-03-25
**Confidence:** HIGH (core patterns well-established; integration of CRDT + workflow is the novel challenge)

## System Overview

PolicyDash is a dual-model system: real-time collaborative document editing (CRDT-based) alongside structured relational workflow data (feedback, change requests, versions, RBAC). The core architectural challenge is bridging these two worlds cleanly.

```
                            CLIENTS
                 ┌──────────────────────────┐
                 │  Next.js App (RSC + SPA)  │
                 │  ┌──────┐  ┌───────────┐ │
                 │  │Editor│  │ Dashboard  │ │
                 │  │(CRDT)│  │ (tRPC/RSC) │ │
                 │  └──┬───┘  └─────┬─────┘ │
                 └─────┼────────────┼───────┘
                       │            │
          ┌────────────┼────────────┼────────────────┐
          │   WebSocket │    HTTPS   │                │
          │            │            │                │
   ┌──────▼──────┐  ┌──▼────────────▼──┐  ┌────────┐ │
   │ Hocuspocus   │  │   Next.js API    │  │  Auth  │ │
   │ (Yjs CRDT    │  │   (tRPC Router)  │  │Provider│ │
   │  Server)     │  │                  │  │(Clerk) │ │
   │              │  │ ┌──────────────┐ │  └────────┘ │
   │ onStoreDoc ──┼──┼─▶ Workflow     │ │             │
   │ webhook      │  │ │ Engine       │ │             │
   │              │  │ │ (XState)     │ │             │
   └──────┬───────┘  │ └──────────────┘ │             │
          │          │ ┌──────────────┐ │             │
          │          │ │ RBAC         │ │             │
          │          │ │ Service      │ │             │
          │          │ └──────────────┘ │             │
          │          │ ┌──────────────┐ │             │
          │          │ │ Audit Log    │ │             │
          │          │ │ (append-only)│ │             │
          │          │ └──────┬───────┘ │             │
          │          └────────┼─────────┘             │
          │                   │                       │
   ┌──────▼───────────────────▼──────────────────┐    │
   │              PostgreSQL                      │    │
   │  ┌─────────┐ ┌──────────┐ ┌──────────────┐  │    │
   │  │ CRDT    │ │ Workflow │ │ Audit        │  │    │
   │  │ Binary  │ │ Tables   │ │ Event Store  │  │    │
   │  │ Store   │ │          │ │ (append-only)│  │    │
   │  └─────────┘ └──────────┘ └──────────────┘  │    │
   └──────────────────────────────────────────────┘    │
                                                       │
   ┌───────────────────────┐  ┌──────────────────┐    │
   │  S3/MinIO             │  │  Public Portal   │    │
   │  (File/Evidence       │  │  (Static/ISR     │    │
   │   Storage)            │  │   read-only)     │    │
   └───────────────────────┘  └──────────────────┘    │
                                                       │
          ─ ─ ─ ─  SERVER BOUNDARY  ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

### The Dual-Model Problem (Central Architectural Insight)

PolicyDash operates in two distinct data domains that must stay synchronized:

1. **CRDT Domain** -- Real-time collaborative document content. Stored as Yjs binary (Uint8Array). Synced via WebSocket. Conflict-free by design. Content lives in Y.Doc instances managed by Hocuspocus.

2. **Relational Domain** -- Structured workflow data. Feedback items, change requests, versions, RBAC assignments, audit logs. Stored in normalized PostgreSQL tables. Accessed via tRPC. Consistency via transactions.

The bridge between these domains is the **Section** entity: sections have stable IDs in both the CRDT document (as block metadata) and the relational database (as rows). When a section's content changes in the CRDT, the Hocuspocus `onStoreDocument` hook can trigger relational side-effects (version tracking, audit logging). When a CR is merged, the relational system instructs the CRDT to apply changes to specific section fragments.

## Component Responsibilities

| Component | Responsibility | Boundary | Implementation |
|-----------|----------------|----------|----------------|
| **Block Editor** | Notion-style content editing, slash commands, drag/drop, inline comments | Client-side, renders CRDT state | BlockNote + Yjs Y.XmlFragment |
| **Hocuspocus Server** | CRDT sync, WebSocket management, document persistence, awareness (cursors) | Standalone process or embedded in Next.js | @hocuspocus/server with custom extensions |
| **tRPC API Layer** | All structured data operations (feedback, CRs, versions, RBAC, users) | Next.js API routes | tRPC v11 with Zod validation |
| **Workflow Engine** | State machine management for feedback lifecycle, CR lifecycle, version lifecycle | Server-side service layer | XState v5 machines, persisted state in DB |
| **RBAC Service** | Permission evaluation, section-level access scoping, role management | Middleware + DB policies | Application-layer checks + PostgreSQL RLS |
| **Audit Logger** | Immutable event recording for every state change | Append-only service | INSERT-only PostgreSQL table, no UPDATE/DELETE |
| **Version Manager** | Snapshot creation, diff generation, changelog compilation, publishing | Server-side service | Yjs snapshots + relational version metadata |
| **File Storage** | Evidence artifacts, workshop materials, media embeds | External service | S3-compatible (MinIO for dev, S3 for prod) |
| **Auth Provider** | Authentication, session management, invite flows | External service | Clerk (handles JWT, MFA, invites) |
| **Public Portal** | Read-only published policy content, public changelog | Separate route group or subdomain | Next.js ISR pages, no auth required |

## Recommended Project Structure

```
policydash/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (workspace)/            # Authenticated workspace routes
│   │   │   ├── documents/          # Document editor pages
│   │   │   ├── feedback/           # Feedback management
│   │   │   ├── changes/            # Change request views
│   │   │   ├── versions/           # Version history
│   │   │   ├── workshops/          # Workshop management
│   │   │   ├── traceability/       # Traceability matrix
│   │   │   ├── admin/              # Admin/RBAC management
│   │   │   └── layout.tsx          # Auth-gated workspace layout
│   │   ├── (portal)/               # Public portal routes (no auth)
│   │   │   ├── policies/           # Published policy viewer
│   │   │   ├── changelog/          # Public changelog
│   │   │   └── layout.tsx          # Public layout (no sidebar)
│   │   ├── api/
│   │   │   └── trpc/[trpc]/        # tRPC HTTP handler
│   │   └── layout.tsx              # Root layout
│   │
│   ├── server/                     # Server-side business logic
│   │   ├── routers/                # tRPC routers (one per domain)
│   │   │   ├── feedback.ts
│   │   │   ├── changeRequest.ts
│   │   │   ├── version.ts
│   │   │   ├── document.ts
│   │   │   ├── workshop.ts
│   │   │   ├── user.ts
│   │   │   ├── rbac.ts
│   │   │   └── audit.ts
│   │   ├── services/               # Domain services (business rules)
│   │   │   ├── feedback.service.ts
│   │   │   ├── changeRequest.service.ts
│   │   │   ├── version.service.ts
│   │   │   ├── traceability.service.ts
│   │   │   └── audit.service.ts
│   │   ├── machines/               # XState workflow machines
│   │   │   ├── feedback.machine.ts
│   │   │   ├── changeRequest.machine.ts
│   │   │   └── version.machine.ts
│   │   ├── rbac/                   # Permission evaluation
│   │   │   ├── permissions.ts      # Permission definitions
│   │   │   ├── evaluate.ts         # Permission checker
│   │   │   └── middleware.ts       # tRPC middleware
│   │   └── trpc.ts                 # tRPC initialization + context
│   │
│   ├── collab/                     # Hocuspocus collaboration server
│   │   ├── server.ts               # Hocuspocus config + extensions
│   │   ├── extensions/
│   │   │   ├── persistence.ts      # PostgreSQL document persistence
│   │   │   ├── auth.ts             # WebSocket auth (verify Clerk JWT)
│   │   │   ├── rbac.ts             # Section-level read/write filtering
│   │   │   └── audit.ts            # CRDT change audit logging
│   │   └── hooks.ts                # onConnect, onStoreDocument, etc.
│   │
│   ├── db/                         # Database layer
│   │   ├── schema/                 # Drizzle ORM schema files
│   │   │   ├── documents.ts
│   │   │   ├── sections.ts
│   │   │   ├── feedback.ts
│   │   │   ├── changeRequests.ts
│   │   │   ├── versions.ts
│   │   │   ├── workshops.ts
│   │   │   ├── users.ts
│   │   │   ├── rbac.ts
│   │   │   ├── audit.ts
│   │   │   └── files.ts
│   │   ├── migrations/
│   │   └── index.ts                # DB client + connection
│   │
│   ├── components/                 # React components
│   │   ├── editor/                 # BlockNote editor wrapper + config
│   │   ├── feedback/               # Feedback UI components
│   │   ├── workflow/               # CR and version workflow UI
│   │   ├── traceability/           # Matrix/chain visualization
│   │   ├── dashboard/              # Role-aware dashboard panels
│   │   └── ui/                     # Shared UI primitives
│   │
│   ├── lib/                        # Shared utilities
│   │   ├── trpc.ts                 # tRPC client setup
│   │   ├── auth.ts                 # Clerk client helpers
│   │   ├── constants.ts            # IDs, enums, prefixes (FB-, CR-)
│   │   └── types.ts                # Shared TypeScript types
│   │
│   └── hooks/                      # React hooks
│       ├── useCollaboration.ts     # Yjs/Hocuspocus connection
│       ├── usePermissions.ts       # Client-side RBAC checks
│       └── useWorkflow.ts          # Workflow state subscriptions
│
├── drizzle.config.ts
├── next.config.ts
└── package.json
```

### Structure Rationale

- **`server/routers/` + `server/services/`:** Routers handle input validation and output shaping. Services contain business logic. This separation means workflow logic is testable independent of tRPC.
- **`server/machines/`:** XState machines are pure, serializable state definitions. They live alongside services because they ARE the business rules for lifecycle transitions.
- **`collab/`:** Hocuspocus is a separate concern from the tRPC API. It may run as a separate process in production (different scaling profile -- long-lived WebSocket connections vs request/response). Keeping it isolated enables this.
- **`db/schema/`:** One file per domain entity. Drizzle schema files are the single source of truth for database structure. No separate migration authoring -- generate from schema diffs.
- **`(workspace)/` vs `(portal)/`:** Next.js route groups cleanly separate authenticated workspace from public portal. Different layouts, different auth requirements, potentially different caching strategies.

## Architectural Patterns

### Pattern 1: Dual-Model Bridge via Section Stable IDs

**What:** Every section in a policy document has a stable UUID that exists in BOTH the Yjs CRDT tree (as block metadata) AND the PostgreSQL `sections` table. This ID never changes across edits or versions. It is the bridge between real-time content and structured workflow data.

**When to use:** Any time feedback, CRs, or version diffs need to reference specific document content.

**Trade-offs:**
- PRO: Feedback can reference sections without coupling to CRDT internals
- PRO: RBAC can scope access per-section using relational queries
- CON: Must keep section IDs synchronized between CRDT and DB -- Hocuspocus hooks handle this
- CON: Section creation/deletion in editor must propagate to relational DB

**Example:**
```typescript
// In BlockNote editor -- section blocks carry stable IDs
const sectionBlock = {
  id: "block-uuid-123",           // BlockNote's internal ID
  type: "section",
  props: {
    sectionId: "sec-stable-uuid",  // Stable ID shared with DB
    title: "Data Privacy Requirements",
    order: 3,
  },
  children: [/* nested content blocks */],
};

// In PostgreSQL -- same sectionId links to workflow data
// sections table
{ id: "sec-stable-uuid", document_id: "doc-uuid", title: "Data Privacy Requirements", order: 3 }

// feedback table references the section
{ id: "FB-001", section_id: "sec-stable-uuid", type: "suggestion", status: "submitted" }
```

### Pattern 2: CRDT Content + Relational Metadata (Separation of Concerns)

**What:** Document content (paragraphs, lists, tables, formatting) lives exclusively in Yjs. Structured metadata (feedback, CRs, versions, permissions) lives exclusively in PostgreSQL. Neither tries to be the other.

**When to use:** Always. This is the foundational data architecture.

**Trade-offs:**
- PRO: Each system does what it is designed for (CRDT for merge-free editing, RDBMS for queries/transactions)
- PRO: You can query "all feedback for section X" without parsing CRDT state
- CON: Two sources of truth for "what does this document look like" -- CRDT for live content, DB for version snapshots
- CON: Consistency requires careful hook orchestration

**Data ownership boundaries:**
```
CRDT (Yjs/Hocuspocus) owns:
  - Live document content (blocks, text, formatting)
  - Cursor positions and awareness
  - Inline comments (ephemeral, synced via awareness)
  - Real-time editing state

PostgreSQL owns:
  - Section registry (stable IDs, order, hierarchy)
  - Feedback items and their lifecycle state
  - Change requests and their lifecycle state
  - Version metadata (number, changelog, publish status)
  - Version content snapshots (Yjs binary snapshots stored as bytea)
  - RBAC assignments (user -> role -> section mappings)
  - Audit log (immutable event stream)
  - Workshop metadata and artifact references
  - File/evidence metadata (actual files in S3)
```

### Pattern 3: State Machine Per Lifecycle (XState)

**What:** Each entity with a lifecycle (Feedback, Change Request, Version) gets its own XState machine definition. The machine defines valid states, transitions, guards (conditions), and actions (side-effects). Machine state is persisted in the entity's database row.

**When to use:** Every workflow transition in the system.

**Trade-offs:**
- PRO: Impossible to reach invalid states -- the machine rejects invalid transitions
- PRO: Visual state charts serve as living documentation
- PRO: Guards enforce business rules (e.g., "only Policy Lead can approve CRs")
- PRO: Actions trigger side-effects (audit log, notifications) deterministically
- CON: XState has a learning curve for the team
- CON: Machine definitions must be kept in sync with DB enum types

**Example:**
```typescript
// Feedback lifecycle machine
import { setup, assign } from 'xstate';

export const feedbackMachine = setup({
  types: {
    context: {} as {
      feedbackId: string;
      sectionId: string;
      submittedBy: string;
      reviewedBy: string | null;
      rationale: string | null;
    },
    events: {} as
      | { type: 'SUBMIT' }
      | { type: 'START_REVIEW'; reviewerId: string }
      | { type: 'ACCEPT'; rationale: string }
      | { type: 'PARTIALLY_ACCEPT'; rationale: string }
      | { type: 'REJECT'; rationale: string }
      | { type: 'CLOSE' },
  },
  guards: {
    hasRationale: ({ event }) => 'rationale' in event && event.rationale.length > 0,
  },
}).createMachine({
  id: 'feedback',
  initial: 'submitted',
  states: {
    submitted: {
      on: { START_REVIEW: { target: 'underReview' } },
    },
    underReview: {
      on: {
        ACCEPT:           { target: 'accepted', guard: 'hasRationale' },
        PARTIALLY_ACCEPT: { target: 'partiallyAccepted', guard: 'hasRationale' },
        REJECT:           { target: 'rejected', guard: 'hasRationale' },
      },
    },
    accepted:          { on: { CLOSE: 'closed' } },
    partiallyAccepted: { on: { CLOSE: 'closed' } },
    rejected:          { on: { CLOSE: 'closed' } },
    closed:            { type: 'final' },
  },
});
```

### Pattern 4: Append-Only Audit Log

**What:** Every mutation in the system (feedback submission, CR state change, version publish, RBAC modification, document edit save) writes an immutable event to the `audit_events` table. No UPDATE or DELETE on this table, ever. The table has a database-level trigger that prevents modifications.

**When to use:** Every write operation.

**Trade-offs:**
- PRO: Complete, tamper-evident history for compliance
- PRO: Can reconstruct state at any point in time
- PRO: Auditor role gets full visibility without special logic
- CON: Table grows indefinitely -- partition by month/year
- CON: Must decide granularity (every keystroke? no. every save/transition? yes.)

**Schema pattern:**
```sql
CREATE TABLE audit_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id      UUID NOT NULL REFERENCES users(id),
  actor_role    TEXT NOT NULL,
  action        TEXT NOT NULL,       -- 'feedback.submit', 'cr.approve', 'version.publish'
  entity_type   TEXT NOT NULL,       -- 'feedback', 'change_request', 'version', 'section'
  entity_id     UUID NOT NULL,
  payload       JSONB NOT NULL,      -- action-specific data (old state, new state, rationale)
  ip_address    INET
) PARTITION BY RANGE (timestamp);

-- Prevent any modification after insert
CREATE RULE no_update_audit AS ON UPDATE TO audit_events DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_events DO INSTEAD NOTHING;
```

### Pattern 5: Section-Level RBAC (Application + Database Layers)

**What:** Access control is enforced at two layers. Application layer (tRPC middleware) checks "can this user perform this action on this entity?" before executing business logic. Database layer (PostgreSQL RLS) acts as a safety net, ensuring queries only return rows the user has access to even if application logic has a bug.

**When to use:** Every data access operation.

**Architecture:**

```
User Request
    ↓
[Clerk JWT] → extract userId, roles
    ↓
[tRPC Middleware] → load user's section assignments
    ↓                → check: does role + section assignment permit this action?
    ↓                → DENY early if not (throws TRPCError FORBIDDEN)
    ↓
[Service Layer] → execute business logic
    ↓
[PostgreSQL RLS] → row-level policies filter results
                   → uses session variable: SET app.current_user_id = 'xxx'
                   → policies on feedback, sections, CRs check section_assignments
```

**Section assignment model:**
```
users ──┐
        ├── section_assignments ──┐
roles ──┘     (user_id,          ├── sections
              role,               │
              section_id,         │
              permissions[])  ────┘
```

A stakeholder assigned to sections A and B with role "Stakeholder" can:
- READ content of sections A and B only
- SUBMIT feedback on sections A and B only
- Cannot see feedback on section C
- Cannot see other stakeholders' draft feedback

A Policy Lead assigned to sections A, B, C can:
- READ/WRITE all content in assigned sections
- Review and decide on feedback in assigned sections
- Create and manage CRs for assigned sections

## Data Flow

### Flow 1: Feedback Submission Pipeline

```
Stakeholder views section (filtered by RBAC)
    ↓
Opens feedback form on section "sec-uuid-123"
    ↓
Fills: type=Suggestion, priority=High, content="...", evidence=[file]
    ↓
[tRPC] feedback.submit mutation
    ↓
[RBAC Middleware] → verify user has section assignment + submit permission
    ↓
[Feedback Service]
    ├── Generate ID: FB-001
    ├── Upload evidence file → S3, store metadata in files table
    ├── INSERT feedback row (status: 'submitted', section_id, submitter_id)
    ├── Initialize XState machine → persist state snapshot
    ├── INSERT audit_event (action: 'feedback.submit')
    └── Return FB-001 to client
    ↓
[Dashboard] shows FB-001 in "Submitted" column for Policy Lead
```

### Flow 2: Change Request Lifecycle (Feedback to Version)

This is the core traceability pipeline:

```
Policy Lead reviews feedback items on a section
    ↓
Groups related feedback: FB-001, FB-003, FB-007
    ↓
[tRPC] changeRequest.create mutation
    ├── Generate ID: CR-001
    ├── Link source feedback items: [FB-001, FB-003, FB-007]
    ├── Link affected sections: [sec-uuid-123, sec-uuid-456]
    ├── Set CR status: 'drafting'
    ├── Assign CR owner (Policy Lead)
    ├── INSERT audit_event
    └── Transition linked feedback to 'accepted' (with rationale)
    ↓
Policy Lead edits section content in BlockNote editor
    ↓  (CRDT changes flow via Hocuspocus WebSocket)
    ↓
CR moves through review workflow:
    drafting → in_review → approved → merged
    ↓ (each transition = audit event + guard check)
    ↓
[tRPC] changeRequest.merge mutation
    ├── Verify CR status is 'approved'
    ├── Create Yjs snapshot of current document state
    ├── Store snapshot as new version (V0.2)
    ├── Compute section-level diff (V0.1 → V0.2)
    ├── Generate changelog entries linked to CR-001 and FB items
    ├── UPDATE version metadata
    ├── Transition CR to 'merged'
    ├── INSERT audit_events (cr.merge, version.create)
    └── Return version V0.2 metadata
    ↓
Traceability chain is now queryable:
    FB-001 → CR-001 → Section "sec-uuid-123" → Version 0.2
```

### Flow 3: Real-Time Collaborative Editing

```
User opens document in BlockNote editor
    ↓
[useCollaboration hook]
    ├── Create Y.Doc instance
    ├── Connect HocuspocusProvider (WebSocket)
    │   ├── Send Clerk JWT for authentication
    │   └── Hocuspocus verifies token, loads user's section assignments
    ├── Provider syncs document state from server
    └── BlockNote renders CRDT state as blocks
    ↓
User types in section "Data Privacy"
    ↓
[BlockNote] → ProseMirror transaction → Y.js update (binary delta)
    ↓
[HocuspocusProvider] → sends update via WebSocket
    ↓
[Hocuspocus Server]
    ├── Merges update into server Y.Doc (CRDT merge, no conflicts)
    ├── Broadcasts update to all other connected clients
    ├── onStoreDocument (debounced, ~2-5 seconds)
    │   ├── Persist Y.Doc binary to PostgreSQL (documents.content bytea)
    │   ├── Detect section structure changes (new/deleted/reordered sections)
    │   └── Sync section registry to relational DB if structure changed
    └── Awareness updates (cursors, selections) broadcast immediately
    ↓
Other connected users see changes in real-time
```

### Flow 4: Version Publishing to Public Portal

```
Policy Lead triggers "Publish Version 0.2"
    ↓
[tRPC] version.publish mutation
    ├── Verify all linked CRs are in 'merged' status
    ├── Take final Yjs snapshot → store as version content
    ├── Convert Yjs content to static HTML/JSON for public portal
    ├── Sanitize: strip stakeholder identities (unless opted-in)
    ├── Generate public changelog (what changed, why, linked FB IDs)
    ├── SET version.published = true, version.published_at = now()
    ├── INSERT audit_event (version.publish)
    └── Trigger ISR revalidation for public portal pages
    ↓
[Public Portal] (no auth)
    ├── /policies/[slug]/v/[version] → rendered policy content
    ├── /changelog → public changelog with version diffs
    └── PDF export of published version
```

## How Real-Time Collaboration Integrates with Versioned Content

This is the trickiest architectural boundary. The approach:

1. **Live editing happens in the CRDT only.** The Yjs document is the single source of truth for "what the document looks like right now." Multiple users edit simultaneously via Hocuspocus. No version is created during editing.

2. **Versions are snapshots of CRDT state.** When a CR is merged or a manual version is created, the system takes a Yjs snapshot (lightweight: state vector + delete set) and stores it alongside version metadata in PostgreSQL. The snapshot can reconstruct the document state at that point.

3. **Diffs are computed between snapshots.** Section-level diffs compare the content of each section between two Yjs snapshots. This powers the changelog and "what changed" views.

4. **The CRDT never stops.** Editors can keep working while a version is being created. The snapshot captures a point-in-time; ongoing edits continue on the live document. This is safe because CRDT snapshots are non-destructive.

5. **Published content is static.** The public portal does not run Yjs. Published versions are pre-rendered HTML/JSON exported from the Yjs snapshot at publish time.

```
Timeline:

  ──────────────────────────────────────────────▶  time
  │                    │                    │
  │  Live editing      │  Snapshot taken    │  More editing
  │  (CRDT updates     │  (Version 0.2)    │  (CRDT continues)
  │   flowing)         │                    │
                       │
                       ▼
                  ┌─────────┐
                  │ Yjs     │
                  │ Snapshot │──▶ PostgreSQL (bytea)
                  │ (binary) │──▶ Static HTML (public portal)
                  └─────────┘──▶ Diff vs V0.1 (changelog)
```

## How Section-Level RBAC Scoping Works

The section-level RBAC system requires coordination across three layers:

### Layer 1: Database (Section Assignments Table)

```sql
CREATE TABLE section_assignments (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  section_id  UUID REFERENCES sections(id),
  role        TEXT NOT NULL,  -- role within this section scope
  permissions TEXT[] NOT NULL, -- ['read', 'write', 'submit_feedback', 'review_feedback']
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS policy: users only see sections they are assigned to
CREATE POLICY section_access ON sections
  FOR SELECT
  USING (
    id IN (
      SELECT section_id FROM section_assignments
      WHERE user_id = current_setting('app.current_user_id')::uuid
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE id = current_setting('app.current_user_id')::uuid
      AND role IN ('admin', 'auditor')  -- admin/auditor see everything
    )
  );
```

### Layer 2: tRPC Middleware (Application Logic)

```typescript
// RBAC middleware that runs before every tRPC procedure
const requireSectionAccess = (permission: string) =>
  t.middleware(async ({ ctx, next, input }) => {
    const sectionId = (input as any).sectionId;
    if (!sectionId) throw new TRPCError({ code: 'BAD_REQUEST' });

    const hasAccess = await ctx.rbac.checkSectionPermission(
      ctx.userId, sectionId, permission
    );
    if (!hasAccess) throw new TRPCError({ code: 'FORBIDDEN' });

    return next({ ctx });
  });

// Usage in router
export const feedbackRouter = router({
  submit: protectedProcedure
    .use(requireSectionAccess('submit_feedback'))
    .input(feedbackSubmitSchema)
    .mutation(({ ctx, input }) => { /* ... */ }),
});
```

### Layer 3: Hocuspocus (CRDT Document Filtering)

This is the most nuanced layer. When a user opens the editor, they should only see sections they have access to. Two approaches:

**Approach A: Document-level access (simpler, recommended for V1)**
- If a user has access to ANY section in a document, they can load the full CRDT document
- Section content they should not see is rendered as "[Restricted Section]" placeholders in the editor UI
- Feedback submission is gated by tRPC middleware, not the editor
- Simpler because one Y.Doc per document

**Approach B: Section-level Y.Doc splitting (complex, V2+)**
- Each section has its own Y.Doc fragment
- Hocuspocus only syncs fragments the user has access to
- True content isolation but significantly more complex CRDT management

**Recommendation: Start with Approach A.** The security boundary is enforced by tRPC (server-side) for all mutations. The editor filtering is a UX convenience, not a security mechanism. Move to Approach B only if there are strict confidentiality requirements where even seeing a section title is prohibited.

## Build Order (Dependency Graph)

Components must be built in this order based on dependencies:

```
Phase 1: Foundation (no dependencies)
├── PostgreSQL schema (all tables)
├── Auth provider setup (Clerk)
├── tRPC skeleton (context, middleware, router shell)
└── Project scaffolding (Next.js + all config)

Phase 2: Core Content (depends on Phase 1)
├── Block editor integration (BlockNote + basic config)
├── Hocuspocus server (basic persistence, no RBAC yet)
├── Document CRUD (create, list, open)
└── Section model (stable IDs, registration in DB)

Phase 3: Feedback System (depends on Phase 2)
├── Feedback state machine (XState)
├── Feedback CRUD + lifecycle transitions
├── Feedback <-> Section linking
├── Audit logging (start simple, every feedback transition)
└── Evidence file upload (S3)

Phase 4: Change Request Workflow (depends on Phase 3)
├── CR state machine (XState)
├── CR CRUD + lifecycle transitions
├── CR <-> Feedback linking (traceability)
├── CR <-> Section linking
└── CR merge flow (create version from CR)

Phase 5: Versioning & Publishing (depends on Phase 4)
├── Yjs snapshot capture
├── Version metadata + changelog generation
├── Section-level diff computation
├── Publish workflow (version → public portal)
├── Public portal pages (ISR)
└── Traceability matrix (query across FB→CR→Section→Version)

Phase 6: RBAC & Polish (can partially parallelize with Phase 3+)
├── Section assignment management
├── RBAC middleware (tRPC)
├── RBAC in Hocuspocus (section filtering)
├── Role-aware dashboards
├── PostgreSQL RLS policies
└── Stakeholder onboarding flow

Phase 7: Workshops & Extended Features
├── Workshop CRUD + artifacts
├── Workshop <-> Feedback linking
├── Workshop <-> Section linking
├── Milestone evidence pack export
└── Advanced audit views
```

**Rationale for this order:**
- Schema and auth are prerequisites for everything
- You need the editor working before feedback makes sense (feedback references sections)
- Feedback must exist before CRs (CRs aggregate feedback)
- CRs must exist before versioning (versions capture CR merges)
- RBAC is cross-cutting but can be layered on progressively -- start with "everyone sees everything" and add restrictions
- Workshops are valuable but not on the critical path for the core traceability pipeline

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 users (V1) | Single Next.js server, Hocuspocus embedded in same process. PostgreSQL on single instance. All fine. |
| 100-1K users | Separate Hocuspocus to its own process/server (WebSocket connections have different scaling profile than HTTP). Add connection pooling (PgBouncer). S3 for file storage. |
| 1K-10K users | Hocuspocus horizontal scaling with Redis for cross-instance Y.Doc sync. PostgreSQL read replicas for portal/reporting queries. CDN for public portal. Audit log table partitioning. |
| 10K+ users | Multi-tenant schema isolation (workspace_id partition key on all tables, a la Notion). Separate read/write databases (CQRS). Potentially move audit log to dedicated event store. |

### First Bottleneck: Hocuspocus WebSocket Connections

WebSocket connections are long-lived and memory-intensive. A single Hocuspocus server can handle ~500-1000 concurrent document editing sessions. When you hit this:
- Run Hocuspocus as a separate process with its own scaling group
- Use Redis adapter for cross-instance document sync
- Implement connection affinity (same document -> same server when possible)

### Second Bottleneck: Audit Log Table Size

The append-only audit table will grow fastest. When queries slow:
- Partition by timestamp (monthly or yearly partitions)
- Index on (entity_type, entity_id) and (actor_id, timestamp)
- Archive old partitions to cold storage for compliance, query hot partitions only

## Anti-Patterns

### Anti-Pattern 1: Storing Document Content in PostgreSQL JSON

**What people do:** Store block content as JSONB in PostgreSQL alongside metadata, bypassing CRDT.
**Why it is wrong:** Loses real-time collaboration capability. Every save becomes a full document write that can conflict with other users' saves. No merge semantics. The previous PolicyDash attempt likely had this problem.
**Do this instead:** Document content lives in Yjs. PostgreSQL stores only the binary Y.Doc state (for persistence) and relational references (section IDs, feedback links).

### Anti-Pattern 2: RBAC Checks Only in the UI

**What people do:** Hide UI elements for unauthorized users but still serve the data in API responses.
**Why it is wrong:** Any user with browser dev tools can see restricted data. This is not access control; it is UI decoration.
**Do this instead:** Enforce access control in tRPC middleware (application layer) AND PostgreSQL RLS (database layer). UI filtering is a third layer for UX, not security.

### Anti-Pattern 3: Unguarded Workflow Transitions

**What people do:** Use simple status string columns and update them directly: `UPDATE feedback SET status = 'accepted'`. Any code path can set any status.
**Why it is wrong:** Nothing prevents invalid transitions (e.g., jumping from 'submitted' directly to 'closed' without review). Business rules are scattered across multiple UPDATE calls. The previous PolicyDash had "no state machine" as a critical flaw.
**Do this instead:** Use XState machines as the single authority for valid transitions. The machine's guards enforce business rules. The `status` column is only ever updated by the machine's output.

### Anti-Pattern 4: Single Y.Doc per Workspace

**What people do:** Put all documents in one giant Y.Doc to simplify sync.
**Why it is wrong:** Y.Doc size grows linearly with all content. Every user loading any document downloads the entire workspace. Memory explodes.
**Do this instead:** One Y.Doc per policy document. Each document has its own Hocuspocus room. Users only load the document they are editing.

### Anti-Pattern 5: Converting Y.Doc to JSON for Persistence

**What people do:** Serialize Y.Doc to JSON for storage, then reconstruct from JSON on load.
**Why it is wrong:** As explicitly warned in Hocuspocus docs: "Converting Y.Doc to JSON and reconstructing it as binary on reconnection breaks Yjs's merge semantics, causing duplicate content and update conflicts across sessions."
**Do this instead:** Always persist Y.Doc as Uint8Array (binary). Store in PostgreSQL as `bytea` column. For rendering in non-editor contexts (public portal, PDF export), convert to HTML/JSON as a one-way export.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Clerk (Auth) | JWT verification in tRPC context + Hocuspocus onConnect | Clerk webhooks sync user data to local users table. Invite flow uses Clerk invitation API. |
| S3/MinIO (Files) | Presigned URLs for upload/download | Upload: client gets presigned URL from tRPC, uploads directly to S3. Download: tRPC generates presigned read URL. File metadata in PostgreSQL. |
| Email (Notifications) | Event-driven from workflow transitions | When feedback status changes, audit event triggers notification. Use Resend or similar transactional email. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| BlockNote Editor <-> Hocuspocus | WebSocket (Yjs sync protocol) | Binary CRDT updates. Awareness protocol for cursors. Auth via JWT in connection params. |
| Hocuspocus <-> PostgreSQL | Direct DB writes in hooks | onStoreDocument persists Y.Doc binary. onLoadDocument retrieves it. Debounced writes (2-5s). |
| Hocuspocus <-> tRPC Services | Internal function calls or HTTP webhooks | When document structure changes (sections added/removed), Hocuspocus notifies the relational layer. Can be direct function call if same process, or webhook if separate. |
| tRPC <-> XState Machines | In-process function calls | Service instantiates machine, sends event, reads new state, persists to DB. No separate process for XState. |
| Workspace <-> Public Portal | Shared database, different rendering | Portal reads published version snapshots. No write access. Can use ISR/SSG for performance. |

## Sources

- [Notion Data Model Architecture](https://www.notion.com/blog/data-model-behind-notion) -- block-based data model, render tree hierarchy, permission inheritance
- [Notion System Design](https://www.educative.io/blog/notion-system-design) -- six subsystem decomposition, WebSocket MessageStore pattern
- [BlockNote Collaboration Docs](https://www.blocknotejs.org/docs/features/collaboration) -- Yjs integration, provider options, setup patterns
- [BlockNote Yjs Integration Deep Dive](https://deepwiki.com/TypeCellOS/BlockNote/8.1-yjs-integration) -- Y.XmlFragment mapping, plugin architecture, awareness protocol
- [Hocuspocus Persistence Guide](https://tiptap.dev/docs/hocuspocus/guides/persistence) -- onStoreDocument/onLoadDocument hooks, binary persistence requirement
- [Yjs Community: Versioning Discussion](https://discuss.yjs.dev/t/for-versioning-should-i-store-snapshot-or-document-copies/2421) -- snapshots vs document copies, state vector + delete set approach
- [XState Documentation](https://stately.ai/docs/xstate) -- actor-based state management, v5 machine API
- [PostgreSQL Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) -- RLS policy syntax, USING clauses
- [tRPC Next.js Integration](https://trpc.io/docs/client/nextjs) -- createCaller for RSC, React Query hooks for client
- [CRDT Libraries Comparison (2025)](https://velt.dev/blog/best-crdt-libraries-real-time-data-sync) -- Yjs as industry standard for document collaboration
- [Workflow Engine vs State Machine](https://workflowengine.io/blog/workflow-engine-vs-state-machine/) -- when to use state machines for human-driven workflows
- [Event Sourcing with PostgreSQL](https://github.com/eugene-khyst/postgresql-event-sourcing) -- append-only event store patterns
- [tRPC vs Server Actions (2026)](https://caisy.io/blog/trpc-vs-server-actions) -- tRPC for complex mutation workflows, Server Actions for simple forms

---
*Architecture research for: PolicyDash -- Stakeholder Policy Consultation Platform*
*Researched: 2026-03-25*
