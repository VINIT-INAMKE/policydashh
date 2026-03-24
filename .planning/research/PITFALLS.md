# Pitfalls Research

**Domain:** Stakeholder policy consultation platform with real-time collaborative editing, complex approval workflows, content-level RBAC, and immutable audit logging
**Researched:** 2026-03-25
**Confidence:** HIGH (verified against official docs, prior failure post-mortem, and multiple independent sources)

## Critical Pitfalls

### Pitfall 1: Yjs Binary Storage Bypass (Storing Y.Doc as JSON)

**What goes wrong:**
The Yjs collaborative document is serialized to JSON for storage and recreated as a Y.Doc binary when users reconnect. This causes duplicate content on new connections, corrupted merge history, and eventual data loss. The collaboration layer silently breaks because Yjs merging depends on the full binary update history, not a JSON snapshot.

**Why it happens:**
Teams already have a JSON-based persistence layer (e.g., Prisma + PostgreSQL storing Tiptap JSON) and try to reuse it for collaboration persistence. JSON is familiar and inspectable. The Yjs binary format feels opaque and inconvenient. Developers assume "it's the same document, just a different format."

**How to avoid:**
- Primary storage MUST be the Y.Doc as a Uint8Array binary blob (not JSON)
- Use dual storage: binary blob as the authoritative collaborative state, plus a derived JSON/HTML representation for rendering, search indexing, and API responses
- The JSON copy is a read-only projection -- never use it to reconstruct the Y.Doc
- In Hocuspocus, use the `onStoreDocument` hook to persist the binary and separately serialize to JSON for your application layer

**Warning signs:**
- Content duplicates appearing after page refreshes
- "Phantom" edits that no user made
- Collaboration breaks after server restart but works during a session
- Merge conflicts that shouldn't exist (single editor, content still corrupts)

**Phase to address:**
Phase 1 (Editor & Content Foundation) -- get this right from day one. Retrofitting binary storage after building on JSON is a rewrite of the persistence layer.

---

### Pitfall 2: No Formal State Machine for Workflow Transitions

**What goes wrong:**
Each API endpoint performs its own ad-hoc status checks ("if status === 'draft' then allow edit"). Transition logic scatters across controllers, middleware, and even frontend code. Invalid state transitions slip through. Race conditions between concurrent actors cause feedback or CRs to reach impossible states (e.g., a CR that is both "Approved" and "Rejected"). The previous PolicyDash attempt failed exactly this way.

**Why it happens:**
State machines feel like over-engineering for "just a status field." Early on, there are only 2-3 states and if/else works fine. But PolicyDash has two interacting state machines (Feedback lifecycle: Submitted -> Under Review -> Accepted/Partially/Rejected -> Closed; CR lifecycle: Drafting -> In Review -> Approved -> Merged -> Closed) with guard conditions, role-based transition permissions, and cross-entity side effects (merging a CR creates a new document version).

**How to avoid:**
- Define state machines explicitly as configuration (state, valid transitions, guards, side effects) before writing any endpoint code
- Use a database-backed state machine pattern: store transitions as rows, not status columns. Each transition is an immutable record with source state, target state, actor, timestamp, and metadata
- Use `FOR UPDATE SKIP LOCKED` or optimistic locking with version columns to prevent concurrent transition race conditions
- On conflict, return a typed error (e.g., `TransitionConflict`) and wrap callers in retry logic
- The state machine config is the single source of truth -- endpoints only call `transition(entity, event)`, never set status directly

**Warning signs:**
- Status field updated with raw SQL/ORM `update()` calls instead of going through a transition function
- If/else chains checking status in controllers
- "How did this CR end up in state X?" bug reports
- Tests that set status directly instead of walking through transitions

**Phase to address:**
Phase 2 (Feedback & Workflow) -- the state machine must be the first thing built before any workflow endpoint. The data model for transitions (not just current state) must be designed in Phase 1 schema work.

---

### Pitfall 3: Default-Allow Permission Model

**What goes wrong:**
Permissions check for explicit denials rather than explicit grants. New roles, new endpoints, or new content types default to accessible. A stakeholder assigned to Section A can see Sections B and C because the permission check only blocks sections with explicit deny rules. API endpoints without permission decorators are wide open. This was a critical failure in the previous PolicyDash attempt.

**Why it happens:**
Default-allow feels more "developer-friendly" during rapid prototyping -- everything works out of the box, and you add restrictions as needed. With 7 roles and section-level scoping, the permission matrix is complex, and it seems easier to start permissive and lock down later. But "later" never comes comprehensively, and every new feature ships with a security hole.

**How to avoid:**
- Enforce default-deny at the framework level: every route/resolver requires an explicit permission declaration, and requests without one are rejected (not allowed)
- Implement a permission middleware that throws on missing declarations, not on missing denials
- Section-level scoping: stakeholders see ONLY sections explicitly assigned to them. The query layer must filter by assignment, not filter out denials
- Use Clerk's custom permissions for the 7 roles, but enforce content-level (section) scoping in your own application layer -- Clerk handles "can this role do X?" while your app handles "on which sections?"
- Write integration tests that assert new endpoints with no permission config return 403, not 200

**Warning signs:**
- New API endpoints that work without any auth setup during development
- Permission tests that only verify "authorized user CAN access" without testing "unauthorized user CANNOT access"
- Stakeholders reporting they can see content they shouldn't
- Security audit reveals endpoints with no permission checks

**Phase to address:**
Phase 1 (Foundation) for the permission framework. Phase 2 (Feedback) for section-level scoping. Every subsequent phase must include permission tests for new endpoints as a hard gate.

---

### Pitfall 4: Tiptap Schema Validation Disabled by Default

**What goes wrong:**
Tiptap does not validate content against the ProseMirror schema by default. Invalid content (from copy-paste, API imports, or collaboration sync) enters the document silently. This corrupts the Y.Doc, breaks collaboration synchronization without any error messages, and causes "phantom" rendering bugs where content looks fine for one user but crashes for another.

**Why it happens:**
The default `enableContentCheck: false` is not documented prominently. Developers assume schema validation is automatic (like database constraints). During development, content is created through the editor UI and naturally conforms to the schema. The problem only surfaces when content arrives from external sources (Markdown import, API, collaboration merge) or when the schema evolves and old documents have stale structures.

**How to avoid:**
- Set `enableContentCheck: true` on the Tiptap editor instance from day one
- Listen to `contentError` events and handle them (log, attempt repair, reject)
- When importing Markdown or external content, run it through the schema parser and validate before inserting into the Y.Doc
- When evolving the schema (adding/removing node types), write migrations for existing documents
- Pin Tiptap and ProseMirror versions carefully -- schema-related bugs have been found in specific releases (e.g., CollaborationCaret crash in v3.10.0)

**Warning signs:**
- Content that renders differently for different users in the same session
- Collaboration "freezes" where one user's changes stop appearing for others
- Console errors about unknown node types or invalid content
- Copy-paste from external sources producing garbled output

**Phase to address:**
Phase 1 (Editor & Content Foundation) -- enable validation and error handling as part of editor setup. Do not defer this.

---

### Pitfall 5: Section Identity Not Stable Across Document Versions

**What goes wrong:**
The entire PolicyDash traceability chain (FB -> CR -> Section -> Version) depends on sections having stable identity. If sections are identified by position index or DOM path, reordering sections, inserting new ones, or merging CRs invalidates all existing feedback links. Feedback item FB-042 says "refers to Section 3" but after a CR merge that added a new Section 2, the old Section 3 is now Section 4. The traceability matrix becomes unreliable.

**Why it happens:**
ProseMirror/Tiptap nodes are immutable values without inherent identity. Position-based addressing (offsets) is the natural way to reference content in these editors. Teams don't realize they need a separate identity layer until feedback is already linked to positions that shift.

**How to avoid:**
- Assign a persistent UUID to each section node as a ProseMirror node attribute (stored in the document schema, not derived from position)
- The section UUID survives reordering, editing, and version changes
- Feedback items link to section UUIDs, not positions or indexes
- When creating a new document version, sections carry their UUIDs forward. New sections get new UUIDs. Deleted sections are marked as removed (not physically deleted) to preserve historical links
- Build a custom Tiptap extension for the section node type that enforces UUID generation on creation and preservation on update

**Warning signs:**
- Feedback references using numeric indexes ("Section 3") instead of UUIDs
- Traceability matrix shows broken links after document edits
- Reordering sections in the editor causes feedback to "jump" to wrong sections
- Version diffs showing sections as "deleted and re-created" instead of "moved"

**Phase to address:**
Phase 1 (Editor & Content Foundation) -- the section node type with stable UUID must be defined in the initial Tiptap schema. This cannot be retrofitted without migrating all existing feedback links.

---

### Pitfall 6: Audit Log as a Single Append-Only Table

**What goes wrong:**
Every action in the platform writes to a single `audit_logs` table. At scale, this table grows to millions of rows. Inserts start competing with reads. Autovacuum thrashes on the largest table in the database. Compliance queries ("show me everything that happened to Policy X between January and March") become full table scans. The audit log -- meant to be the source of accountability -- becomes a performance bottleneck that degrades the entire application.

**Why it happens:**
An append-only audit table is the most obvious implementation. It works perfectly in development and early production. Teams don't anticipate the write volume: in PolicyDash, every editor keystroke sync, every feedback status change, every permission check, and every login generates an audit event. With real-time collaboration, the event rate can be orders of magnitude higher than expected.

**How to avoid:**
- Partition the audit table by time (monthly or quarterly) from day one. PostgreSQL partition pruning automatically excludes irrelevant partitions during queries
- Separate high-frequency events (editor syncs, presence updates) from low-frequency governance events (status transitions, permission changes, publish actions). Only governance events go to the audit log. Editor history is tracked by Yjs version vectors
- Index on `(entity_type, entity_id, created_at)` for compliance queries
- Set retention policies: hot partitions (recent 3 months) on fast storage, cold partitions archived or compressed
- Do NOT use triggers for audit logging in high-write paths -- use application-level event emission to a dedicated audit service or async queue
- Consider `pgAudit` extension for database-level operation auditing as a complement to application-level audit logs

**Warning signs:**
- Audit table is the largest table in the database within weeks of launch
- Autovacuum warnings in PostgreSQL logs
- Compliance reports timing out
- Disk usage growing faster than expected
- Inserts to the audit table blocking application transactions

**Phase to address:**
Phase 1 (Foundation) for the partitioned schema design. Phase 4 (Audit & Compliance) for the full audit pipeline. But the table structure must be partitioned from the start -- repartitioning a large table is painful.

---

### Pitfall 7: Ghost Modules (Permissions Defined, Zero Implementation)

**What goes wrong:**
The RBAC system defines permissions for features that don't exist yet. Roles are configured with access to "Workshops," "Evidence Management," and "Traceability Matrix" but these modules have no routes, no UI, and no business logic. The permission system looks complete on paper but the application is hollow. Users with the "Workshop Moderator" role have a dashboard that claims they can manage workshops, but clicking anything leads to 404s or empty pages. The previous PolicyDash had 5 ghost modules.

**Why it happens:**
Teams design the full RBAC matrix upfront (which is good) but then register all permissions and roles before building the features they protect (which is bad). It creates a false sense of completeness and makes it impossible to know what's actually functional versus what's a shell.

**How to avoid:**
- Permission definitions ship with the feature they protect, in the same PR/commit
- Use feature flags to gate unreleased modules entirely -- don't show them in navigation or role configuration
- Maintain a "feature readiness" checklist: a permission is only registered when its protected endpoint, UI, and at least one happy-path test exist
- In the roadmap, each phase defines which roles become active and which permissions are registered in that phase, not all upfront

**Warning signs:**
- Permission seeds or migration files that reference entities with no corresponding route or controller
- Role descriptions mentioning capabilities that produce empty pages
- "Coming soon" placeholders that persist for more than one sprint
- Integration tests for permissions that mock the underlying feature (testing the lock but not the door)

**Phase to address:**
Every phase -- this is a discipline, not a one-time fix. Each phase should register only the permissions for features delivered in that phase.

---

### Pitfall 8: Real-Time Collaboration Without Offline/Reconnection Strategy

**What goes wrong:**
The collaboration layer (Yjs + WebSocket) works perfectly when all users are online with stable connections. But when a user's connection drops and reconnects (common on corporate networks, mobile, or in workshop settings), one of several failures occurs: (a) their offline edits are lost, (b) their edits conflict with changes made while they were offline, creating duplicate content, or (c) the reconnection creates a new Y.Doc instance that forks from the shared document.

**Why it happens:**
WebSocket reconnection is treated as an infrastructure concern ("just reconnect the socket") rather than a collaboration concern ("merge the diverged document states"). Development happens on localhost with perfect connectivity. The Yjs provider handles some reconnection automatically, but edge cases around stale tabs, laptop sleep/wake cycles, and network switches are not tested.

**How to avoid:**
- Use a Yjs provider that handles reconnection with full state sync (Hocuspocus does this by default, but test it explicitly)
- Persist the Y.Doc state to IndexedDB on the client so offline edits survive tab closes and reconnections
- On reconnection, sync the local Y.Doc with the server's authoritative state before allowing further edits
- Test explicitly: open editor, disconnect network, make edits, reconnect, verify merge. Automate this test
- Set a `maxBackoffTime` and connection timeout on the WebSocket provider. Show a visible "reconnecting..." indicator to users -- silent failures are the worst kind

**Warning signs:**
- Users reporting "my edits disappeared" after network interruptions
- Duplicate paragraphs or sections appearing after WiFi reconnection
- Workshop participants (often in conference venues with poor WiFi) losing notes
- No visible connection status indicator in the editor UI

**Phase to address:**
Phase 1 (Editor Foundation) for basic reconnection handling. Phase 3 (Versioning & Publishing) for ensuring offline edits merge correctly with versioned content.

---

### Pitfall 9: Traceability Chain Built as Afterthought Joins

**What goes wrong:**
The FB -> CR -> Section -> Version traceability chain is implemented as ad-hoc JOIN queries across loosely related tables. There's a `feedback` table, a `change_requests` table, a `sections` table, and a `versions` table, but the links between them are just foreign keys without a dedicated traceability data model. When a CR references 3 feedback items and affects 2 sections across 1 version, the query to reconstruct this chain involves 4+ JOINs and becomes fragile. Adding "decision rationale" or "partial acceptance" doesn't fit neatly. The traceability matrix view becomes the slowest page in the application.

**Why it happens:**
Traceability is described as a feature ("show me the chain") rather than a data model concern. Teams build CRUD for each entity independently and assume they can stitch together the chain in queries later. The many-to-many relationships (one CR links to many FBs AND many sections) create a combinatorial explosion that simple JOINs handle poorly.

**How to avoid:**
- Design a dedicated `traceability_link` table (or similar) that explicitly records each link in the chain with metadata: `source_type`, `source_id`, `target_type`, `target_id`, `link_type`, `decision`, `rationale`, `created_at`
- The traceability chain is a first-class data model, not a derived view
- Materialize the traceability matrix as a denormalized view or materialized view that is refreshed on relevant events (feedback decision, CR merge, version publish)
- Index the link table on both `(source_type, source_id)` and `(target_type, target_id)` for bidirectional traversal
- The "per-stakeholder feedback outcomes" view and "per-section what changed and why" view should query the link table directly, not reconstruct chains from JOINs

**Warning signs:**
- Traceability matrix queries with 4+ JOINs
- "Show feedback for this section across versions" is slow or inaccurate
- Adding a new link type (e.g., "Workshop insight -> Feedback") requires schema changes to multiple tables
- Traceability data is inconsistent -- a CR was merged but the feedback it addressed isn't marked as linked

**Phase to address:**
Phase 1 (Data Model Design) for the link table schema. Phase 2 (Feedback & Workflow) for populating links when feedback is submitted and CRs are created. Phase 3 (Versioning) for completing the chain when CRs are merged into versions.

---

### Pitfall 10: Clerk Auth Boundary Confusion (What Clerk Does vs. What You Do)

**What goes wrong:**
Teams assume Clerk handles all authorization. Clerk handles authentication (who is this user?) and role-based permission checks (does this role have permission X?). But Clerk does NOT handle content-level scoping (can this stakeholder see Section 3 of Policy Document A?). The application ships with proper role checks ("is user a Stakeholder?") but missing content checks ("is this Stakeholder assigned to this section?"). Every stakeholder can see every section.

**Why it happens:**
Clerk's Organizations feature provides role and permission management, which feels comprehensive. The docs show how to check `has({ permission: "org:document:edit" })` and teams assume this covers their needs. But Clerk permissions are role-scoped, not resource-scoped. "Can edit documents" is different from "can edit THIS document's Section 3." Additionally, Clerk's System Permissions are not included in session claims, requiring custom permission checks server-side.

**How to avoid:**
- Draw a clear boundary: Clerk owns authentication + role permissions. Your application owns resource-level authorization (section assignments, document access, feedback visibility)
- Build an authorization layer in your application that takes Clerk's role as input and combines it with resource ownership/assignment data from your database
- Never use Clerk's `<Show>` component for security -- it only hides UI elements; the content is still in the DOM and accessible via source code
- Test authorization at the API level, not just the UI level. A `curl` request with a valid Stakeholder token should not return sections the stakeholder isn't assigned to
- Use Clerk's `auth()` for "who" and your DB queries for "which resources"

**Warning signs:**
- Authorization checks only in frontend components, not in API routes
- All stakeholders seeing all sections in API responses (even if UI hides some)
- Permission checks using `<Show>` component for sensitive content
- No test that verifies a stakeholder CANNOT access unassigned sections via the API

**Phase to address:**
Phase 1 (Auth Foundation) for the Clerk integration and application-level authorization layer design. Phase 2 for section-level scoping implementation.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store Y.Doc as JSON only (skip binary) | Simpler persistence, inspectable data | Collaboration breaks on reconnect, content duplication, full rewrite of persistence layer | Never |
| Status column instead of transition table | Faster to implement, fewer tables | No audit trail of transitions, race conditions, impossible to answer "who moved this to X and when?" | Never for workflow entities (FB, CR). Acceptable for simple UI state |
| Single unpartitioned audit_logs table | Simpler schema, faster initial development | Performance degradation at scale, autovacuum thrashing, compliance query timeouts | Only if you will partition before reaching 1M rows |
| Clerk-only authorization (no app-level resource checks) | Faster to ship, less custom code | Every stakeholder sees every section, content-level privacy violations | Never for section-scoped content |
| Inline permission checks in controllers (no middleware) | Quick to add per-endpoint | Inconsistent enforcement, missed endpoints, hard to audit what's protected | Never -- use middleware/decorator pattern from the start |
| Testing permissions with mocked features | Can write permission tests before features exist | Ghost modules: permissions look tested but protect nothing real | Only in design phase for schema validation, replace with real tests when feature ships |
| Position-based section references | No custom Tiptap extension needed | All feedback links break on section reorder | Never |
| Skip `enableContentCheck` on Tiptap | Fewer errors during development | Silent schema violations corrupt collaboration state | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Clerk + Next.js middleware | Using `auth()` in layout components for authorization -- layouts don't re-render on navigation so auth checks become stale | Check auth in each page/route handler. Use `auth()` in layouts only for display (username, avatar), never for access control |
| Tiptap + Yjs (Hocuspocus) | Destroying the Yjs provider from a React component on unmount, causing reconnection issues on re-render | Keep the provider lifecycle independent from component lifecycle. Use a singleton or context provider |
| Tiptap + Collaboration Cursor | Using CollaborationCaret extension without pinning compatible versions | Pin Tiptap + Yjs + Hocuspocus versions together. Test cursor rendering after any version bump. Known crash in Tiptap v3.10.0 |
| Yjs + Hot Module Reload (dev) | HMR creates new WebSocket connections to the same Yjs room, causing document state corruption during development | Detect HMR and skip provider recreation, or use a dev-only singleton pattern for the Yjs provider |
| PostgreSQL + Audit Triggers | Using `AFTER INSERT/UPDATE` triggers on high-frequency tables for audit logging | Use application-level event emission. Triggers block the triggering transaction and cannot be easily async |
| Clerk + Custom Roles (7 roles) | Mapping all 7 PolicyDash roles to Clerk Organization roles, hitting limits or awkward UX in Clerk's role management UI | Map to 3-4 Clerk roles (Admin, Editor, Member, Observer) and handle fine-grained role distinctions (Policy Lead vs. Research Lead vs. Workshop Moderator) in your application layer |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Yjs document size growth (tombstones) | Editor becomes sluggish, initial load takes seconds, memory usage climbs | Implement periodic Yjs document compaction/garbage collection. Large policy documents (100+ sections) will accumulate tombstones from edits | 50+ concurrent edits on a 100+ section document |
| WebSocket server per-document memory | Server RAM grows linearly with active documents. Each document holds full Yjs state in memory | Use Hocuspocus with lazy loading -- only load documents into memory when active, unload after timeout. Do NOT preload all documents | 50+ simultaneously active documents |
| Traceability matrix full-chain query | Matrix view takes 5+ seconds, times out for policies with 200+ feedback items | Materialize the traceability chain. Refresh on events (FB decision, CR merge, version publish). Paginate the matrix view | 200+ feedback items across 20+ sections |
| Audit log table scan for compliance reports | Report generation takes minutes, blocks other queries | Partition by month. Index `(entity_type, entity_id, created_at)`. Generate compliance reports from archived/read-replica data | 1M+ audit events (reachable within months with real-time editing events) |
| N+1 queries on section-scoped permission checks | Page load sends N queries to check permissions on N sections | Batch permission checks: load all section assignments for the current user in one query, cache for the session duration | 10+ sections per document with per-section RBAC |
| Awareness protocol broadcast storm | UI stutters when many users are in the same document, cursors lag | Throttle awareness updates to 500ms-1s intervals. Awareness state is ephemeral -- slight lag is acceptable | 10+ simultaneous users in one document |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Default-allow permission model | Stakeholders access sections, feedback, and documents they shouldn't see. Privacy violations for government stakeholders who require anonymity | Default-deny at middleware level. Every endpoint requires explicit permission declaration. Test that unprotected endpoints return 403 |
| Clerk `<Show>` component used for access control | Sensitive content (government stakeholder feedback, private sections) is in the DOM, accessible via browser dev tools, even when visually hidden | Never use `<Show>` for security. Omit sensitive data from API responses entirely. Authorization must happen server-side |
| Stakeholder identity leakage in API responses | A stakeholder who chose anonymous feedback has their name in the API response's `created_by` field, visible to anyone inspecting network requests | Sanitize API responses based on anonymity settings at the serialization layer, not the UI layer. Anonymous feedback should have `created_by: null` in the API response |
| Audit log tampering via UPDATE/DELETE | If the audit_logs table allows UPDATE or DELETE, a compromised admin account can erase evidence of their actions | Revoke UPDATE and DELETE privileges on the audit table for the application database user. Only the application service account has INSERT. Use a separate, more restricted role for audit reads |
| Hardcoded auth secrets or fallback tokens | Previous PolicyDash had hardcoded JWT fallback secrets. If Clerk is unreachable, the app falls back to a weak secret, bypassing all auth | No fallback auth. If Clerk is unreachable, the app returns 503, not a degraded auth mode. Remove all fallback paths. Health checks monitor Clerk availability |
| Rate limiting race conditions | Previous PolicyDash had race conditions in rate limiting. Concurrent requests bypass rate limits | Use atomic rate limiting (Redis `INCR` with TTL, or PostgreSQL advisory locks). Never check-then-increment in separate operations |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visible connection/sync status in collaborative editor | Users type into a disconnected editor, lose all changes when they refresh. No indication anything is wrong | Show a persistent connection indicator (green/yellow/red). Yellow = reconnecting, Red = offline. Disable save/submit actions when disconnected |
| "What changed since last visit" that misses changes | Stakeholders see a "no changes" indicator but miss important updates because the indicator tracks page views, not content diffs | Track changes at the section level against the user's last-viewed version. Show per-section change indicators. "3 new feedback items on Section 2 since your last visit" |
| Feedback submission without confirmation of what it links to | Stakeholder submits feedback but isn't sure which section it's attached to. Feedback ends up linked to the wrong section | Show a clear, visual confirmation: "Your feedback will be attached to Section: [section title]. Is this correct?" before submission |
| Traceability matrix overwhelms with data | The full matrix for a large policy (200+ feedback items) is an impenetrable wall of data | Default to filtered views: "Your feedback outcomes" for stakeholders, "Section X feedback summary" for policy leads. Full matrix available but not the default |
| Merge summary that's auto-generated but uninformative | CR merge produces a changelog entry like "Merged CR-015" with no meaningful description of what changed or why | Require a merge summary (like a git commit message). Pre-populate with linked feedback IDs and affected section names, but require the Policy Lead to write a human-readable summary |
| Workshop module feels disconnected from policy work | Workshops are a first-class entity but users don't see how workshop artifacts connect to policy feedback and changes | Show bidirectional links: from workshop view, show "feedback items generated from this workshop." From feedback view, show "discussed in Workshop: [name]" |

## "Looks Done But Isn't" Checklist

- [ ] **Real-time collaboration:** Works for 2 users on localhost -- test with 5+ users, network interruptions, and tab sleep/wake cycles
- [ ] **Feedback lifecycle:** Feedback can be submitted and reviewed -- verify that decision rationale is mandatory (not optional) and that the decision is immutable once set
- [ ] **CR merge:** CR merges into a new version -- verify that the traceability links are created atomically (FB -> CR -> Section -> Version), not as a separate async step that might fail
- [ ] **Section-level RBAC:** Stakeholders can't see restricted sections in the UI -- verify they also can't access them via the API (direct URL, GraphQL introspection, etc.)
- [ ] **Audit log:** Events are being written -- verify that UPDATE and DELETE are revoked on the audit table, not just "not used by the application"
- [ ] **Anonymity:** Anonymous feedback shows no author in the UI -- verify it also shows no author in the API response, PDF exports, and audit logs (audit can store user ID internally but must not expose it in stakeholder-visible exports)
- [ ] **Version diff:** Diff view shows changes between versions -- verify it handles section reordering (not just content changes within sections), section additions, and section deletions
- [ ] **Markdown import:** Existing policy content imports correctly -- verify that imported sections get stable UUIDs and that the import doesn't corrupt the Y.Doc binary state
- [ ] **State machine transitions:** Workflow transitions work for the happy path -- verify that invalid transitions (e.g., going from "Closed" back to "Submitted") are rejected, not just unused
- [ ] **Public portal:** Published policies are readable -- verify that unpublished versions, draft content, stakeholder identities, and internal feedback are NOT accessible from the public portal routes

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Y.Doc stored as JSON only | HIGH | Must rebuild the persistence layer. Existing documents lose collaboration history. Recreate Y.Docs from the JSON snapshots (losing merge capability). All active collaboration sessions must be terminated and restarted |
| No state machine (ad-hoc status checks) | HIGH | Audit all endpoints for status logic. Extract into a centralized state machine. Migrate existing entities by inferring transition history from audit logs (if they exist) or accepting data loss on transition history. Fix any entities in impossible states manually |
| Default-allow permissions | MEDIUM | Audit all endpoints. Add missing permission checks. The dangerous period is retrospective -- data that was exposed cannot be un-exposed. Notify affected stakeholders per privacy policy |
| Section identity by position | HIGH | Must assign UUIDs to all existing sections. Must update all feedback links to use UUIDs instead of positions. Must verify no links were broken during the migration. Essentially a data migration across every table that references sections |
| Unpartitioned audit table at scale | MEDIUM | Can partition an existing table using `pg_partman` or manual partition migration. Requires maintenance window. Index creation on large tables will lock or take significant time. Consider `CREATE TABLE ... PARTITION BY RANGE` and migrate data in batches |
| Ghost modules | LOW | Remove unused permission definitions. Update role descriptions to reflect actual capabilities. No data migration needed, but requires honest communication with stakeholders about what's actually built vs. planned |
| Traceability chain as ad-hoc JOINs | MEDIUM | Create the link table and backfill from existing foreign key relationships. Accuracy depends on whether the original FK relationships are complete. Missing links cannot be reconstructed |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Y.Doc binary storage | Phase 1: Editor Foundation | Load test: create doc, edit, close, reopen, edit again. No content duplication. Binary blob exists in DB |
| State machine for workflows | Phase 1: Schema Design + Phase 2: Workflow | Attempt invalid transition via API. Must return 400/409, not succeed. Transition table has audit trail |
| Default-deny permissions | Phase 1: Auth Foundation | New endpoint with no permission config returns 403. Integration test suite includes negative auth cases |
| Tiptap schema validation | Phase 1: Editor Foundation | Paste malformed HTML into editor. Content is sanitized or rejected. `contentError` event fires |
| Stable section UUIDs | Phase 1: Editor Schema | Reorder sections in editor. Feedback links still point to correct sections. UUID preserved in version history |
| Partitioned audit table | Phase 1: Schema Design | Audit table is partitioned from first migration. `EXPLAIN` on compliance query shows partition pruning |
| Ghost modules prevention | Every phase | Each phase's permission definitions have corresponding routes, handlers, and tests |
| Offline/reconnection handling | Phase 1: Editor + Phase 3: Versioning | Disconnect network, edit, reconnect. Changes merge correctly. No content loss or duplication |
| Traceability data model | Phase 1: Schema + Phase 2: Feedback | Link table populated on FB submission, CR creation, CR merge. Matrix query uses link table, not multi-JOIN |
| Clerk auth boundary | Phase 1: Auth Foundation | API call with valid Stakeholder token to unassigned section returns 403. Clerk check passes but app-level check fails |

## Sources

- [Tiptap Persistence Docs: Y.Doc binary storage requirements](https://tiptap.dev/docs/hocuspocus/guides/persistence)
- [Tiptap Schema Docs: content validation and enableContentCheck](https://tiptap.dev/docs/editor/core-concepts/schema)
- [Tiptap Best Practices (Liveblocks)](https://liveblocks.io/docs/guides/tiptap-best-practices-and-tips)
- [Tiptap Collaboration Extension Docs](https://tiptap.dev/docs/editor/extensions/functionality/collaboration)
- [Yjs Awareness Protocol Docs](https://docs.yjs.dev/getting-started/adding-awareness)
- [Yjs WebSocket Server Scaling Guide (Velt)](https://velt.dev/blog/yjs-websocket-server-real-time-collaboration)
- [Database-Backed State Machines (Lawrence Jones)](https://blog.lawrencejones.dev/state-machines/)
- [Ink & Switch: Peritext CRDT for Rich Text (academic paper)](https://www.inkandswitch.com/peritext/static/cscw-publication.pdf)
- [Ink & Switch: Upwelling - Real-time Collaboration + Version Control](https://www.inkandswitch.com/upwelling/)
- [Matthew Weidner: Collaborative Text Editing Without CRDTs](https://mattweidner.com/2025/05/21/text-without-crdts.html)
- [Oso RBAC Best Practices](https://www.osohq.com/learn/rbac-best-practices)
- [Postgres RLS Implementation Guide (Permit.io)](https://www.permit.io/blog/postgres-rls-implementation-guide)
- [Clerk RBAC with Organizations Docs](https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions)
- [Clerk Authorization Checks Docs](https://clerk.com/docs/guides/secure/authorization-checks)
- [Event Sourcing Pitfalls (DZone)](https://dzone.com/articles/event-sourcing-guide-when-to-use-avoid-pitfalls)
- [PostgreSQL Audit Logging (Bytebase)](https://www.bytebase.com/blog/postgres-audit-logging/)
- [QCon SF: Database-Backed Workflow Orchestration (InfoQ)](https://www.infoq.com/news/2025/11/database-backed-workflow/)
- [Contentstack: Financial Services Content Governance with RBAC and Audit Logs](https://www.contentstack.com/blog/strategy/financial-services-content-governance-rbac-and-audit-logs-at-scale)
- PolicyDash previous attempt post-mortem (internal context: 60+ backend issues, ghost modules, no state machine, hardcoded JWT secrets, default-allow permissions)

---
*Pitfalls research for: Stakeholder policy consultation platform (PolicyDash)*
*Researched: 2026-03-25*
