# Project Research Summary

**Project:** PolicyDash — Stakeholder Policy Consultation Platform
**Domain:** Document-centric policy consultation with PR-style change management and end-to-end feedback traceability
**Researched:** 2026-03-25
**Confidence:** HIGH (core stack, features, architecture, pitfalls all verified against official sources and prior attempt post-mortem)

## Executive Summary

PolicyDash sits at an unoccupied intersection in the market: civic participation platforms (Decidim, Consul Democracy) handle broad engagement but lack document-centric workflows; legislative drafting tools (LEOS, LegisPro) have version control but no stakeholder feedback model; public consultation tools (Citizen Space, EngagementHQ) collect feedback well but have no change request or traceability concept. PolicyDash's core differentiator is a structural data model — not a reporting pattern — that maintains a traceable chain from individual feedback item through change request, affected section, and final policy version. Every other platform implements "We Asked, You Said, We Did" as narrative. PolicyDash implements it as a queryable relational chain.

The recommended architecture is a dual-model system: a Yjs CRDT layer (Tiptap 3 + Hocuspocus) for real-time collaborative document editing, and a relational PostgreSQL layer (Drizzle ORM, XState workflows) for structured feedback, change requests, versioning, RBAC, and audit logging. The bridge between these two domains is the Section entity, which carries a stable UUID in both the CRDT document tree and the relational database. This stable identity is the non-negotiable foundation — every feedback item, change request, and version diff references it. The previous PolicyDash attempt failed because it lacked formal state machines (ad-hoc status updates), had a default-allow permission model, and shipped ghost modules (permissions registered before features existed). The new build must treat these three areas as architectural constraints, not implementation details.

The primary risks are all technical rather than product-level: (1) the dual-model synchronization between CRDT and relational state requires careful hook orchestration around Hocuspocus persistence, (2) collaborative editing reconnection edge cases (offline edits, laptop sleep/wake, HMR in dev) will surface only under realistic conditions and must be tested explicitly, and (3) the traceability matrix will become the slowest page in the application without a dedicated link table and materialized view. All three risks have well-documented mitigations and must be addressed in Phase 1 schema and editor foundation work, not deferred.

## Key Findings

### Recommended Stack

The stack is oriented around Next.js 16.2 (App Router + RSC + Turbopack) as the full-stack framework, with Tiptap 3 as the block editor — not BlockNote, which adds a third abstraction layer over Tiptap+ProseMirror and prevents the custom schema control PolicyDash requires. Yjs + Hocuspocus provides self-hosted CRDT collaboration at no per-seat cost, which matters when stakeholder types are diverse (government, industry, academia) with varying engagement. Clerk handles authentication and role-level permissions; section-level content scoping is the application's responsibility, built on top of Clerk's role layer. Drizzle ORM replaces Prisma (used in the failed previous attempt) for SQL-first query control on complex traceability joins. XState 5 models the feedback and change request lifecycles as formal statecharts with guards, preventing the ad-hoc status update anti-pattern that broke the prior implementation.

**Core technologies:**
- **Next.js 16.2 + React 19:** Full-stack framework — Turbopack stable, React Compiler built-in, App Router RSC for public portal performance
- **Tiptap 3.20.x + Yjs 13.6.x + Hocuspocus 2.x:** Block editor + CRDT collaboration — headless control over schema, self-hostable, no vendor lock-in
- **Clerk (latest):** Auth + user management — 50K free MAUs, custom roles/permissions, first-class Next.js 16 support
- **PostgreSQL 16+ via Neon:** Primary database — relational model fits FB->CR->Section->Version traceability; JSONB for document content; partitioned audit table
- **Drizzle ORM 0.45.x:** SQL-first ORM — precise control over complex joins, no codegen, 7.4KB bundle
- **XState 5.28.x:** Workflow state machines — feedback lifecycle and CR lifecycle as formal statecharts with guards and persisted state
- **Zustand 5 + TanStack Query 5:** Client state split — Zustand for ephemeral UI state, TanStack Query for server state caching and mutations
- **Tailwind CSS 4.1 + shadcn/ui CLI v4:** Styling — Oxide engine, OKLCH colors, accessible Radix UI primitives

**Critical version constraints:** Tiptap 3 requires disabling built-in history when using the Collaboration extension. Drizzle Kit 0.45.x must match ORM version. XState 5 requires TypeScript 5+. Hocuspocus must run as a separate process from Next.js (Vercel is serverless; WebSockets are long-lived).

### Expected Features

No existing platform provides the intersection PolicyDash occupies. The feature set is validated against Decidim, Consul Democracy, Citizen Space, LEOS, and ComplianceBridge. Table stakes are well-defined; differentiators are structurally novel rather than incremental improvements.

**Must have (table stakes — v1):**
- Auth with RBAC (7 roles) — without role separation, the platform is unusable for government stakeholders
- Policy document model with stable section identities — sections are the anchoring unit for all workflow data
- Block editor (Notion-style, single-user first) — must be Notion-quality; real-time collaboration follows
- Structured feedback submission (FB-XXX IDs, 5 types) — the input side of the core loop
- Feedback lifecycle with mandatory decision rationale — mandatory rationale is non-negotiable; every disposition requires it
- Change Request workflow (PR-style, CR-XXX IDs) — the bridge between feedback and version changes
- Document versioning with auto-generated changelog — output side of the loop
- Section-level diff view — auditors and stakeholders must see what changed between versions
- Anonymity controls — government stakeholders will not participate without identity protection
- Traceability matrix (basic view) — the visible proof that the core value proposition works
- Audit trail (immutable from day one) — cannot be retrofitted; must be present at launch
- Invite-based onboarding and section-level access scoping — controlled access is the model
- Role-aware dashboards and basic notification system

**Should have (v1.x — after core loop validated):**
- Real-time collaborative editing (Yjs CRDT layer added to the already-working Tiptap editor)
- Workshop module as first-class entity (artifacts, insight linking, feedback provenance)
- Evidence artifact management with "claims without evidence" analytical view
- Public portal for published policy versions (ISR, read-only, privacy-sanitized)
- Per-stakeholder outcome view ("your feedback outcomes" filtered traceability)
- Milestone evidence pack export (for governance reporting)
- Inline comments on selected text, PDF/CSV export, "what changed since last visit" indicators

**Defer (v2+):**
- Multi-tenant workspaces (design schema for it, do not build it)
- Paragraph-level text anchoring (section-level is sufficient; paragraph anchors break on text edits)
- AI-assisted feedback summarization (needs enough feedback data to be useful; clearly label as AI)
- Advanced analytics, third-party API, sortition

**Confirmed anti-features (explicitly out of scope):**
- Real-time chat between stakeholders (undermines traceability)
- AI-assisted policy drafting (attribution and audit trail integrity problems)
- Decision automation (removes human accountability from the chain)
- Anonymous public commenting (destroys feedback quality and traceability)

### Architecture Approach

PolicyDash is a dual-model system where CRDT (Yjs) and relational (PostgreSQL) data must stay synchronized via the Section entity's stable UUID. The editor, collaboration server, workflow engine, and data layer are cleanly separated: Tiptap renders CRDT state; Hocuspocus manages WebSocket sync and document persistence; tRPC handles all structured data mutations; XState machines enforce lifecycle transitions server-side; PostgreSQL enforces access at the row level via RLS policies; and Clerk provides the JWT-based identity that flows through all layers. The public portal is a separate route group with no write access, rendered from pre-computed version snapshots.

**Major components:**
1. **Block Editor (Tiptap + Yjs client)** — renders CRDT state, section blocks with stable UUIDs, slash commands, inline comments; single-user first, collaboration extension layered on
2. **Hocuspocus Server (separate process)** — CRDT sync, WebSocket management, document persistence (binary bytea), section structure change detection, Clerk JWT verification on connect
3. **tRPC API Layer** — all structured data (feedback CRUD, CR workflow, version management, RBAC, audit); input validation via Zod; XState machines called from service layer
4. **Workflow Engine (XState)** — feedback machine (Submitted->UnderReview->Accepted/Partially/Rejected->Closed) and CR machine (Drafting->InReview->Approved->Merged->Closed) as persisted statecharts with guards
5. **RBAC Service** — two-layer enforcement: tRPC middleware checks Clerk role + section assignments, PostgreSQL RLS acts as safety net
6. **Audit Logger** — INSERT-only PostgreSQL table (partitioned by month), no UPDATE/DELETE privileges for application user; governance events only (not every CRDT keystroke)
7. **Version Manager** — Yjs snapshot capture, section-level diff computation, changelog generation, public portal ISR revalidation on publish
8. **Public Portal** — separate Next.js route group, ISR pages, sanitized published content, no auth required

**Key patterns:**
- Dual-model bridge via stable Section UUIDs (CRDT block metadata + PostgreSQL foreign keys)
- CRDT content (Uint8Array binary) stored separately from relational metadata — never serialize Y.Doc to JSON for persistence
- State machine per lifecycle entity — machine is the single authority for valid transitions; `status` column updated only by machine output
- Default-deny permissions — every endpoint requires explicit permission declaration; missing config returns 403
- Dedicated traceability link table — not ad-hoc JOIN chains; materialized on feedback decisions and CR merges

### Critical Pitfalls

The previous PolicyDash attempt is a documented cautionary tale. Research identified 10 pitfalls; the top 5 that must be addressed in Phase 1 are:

1. **Yjs binary storage bypass** — storing Y.Doc as JSON breaks CRDT merge semantics, causes content duplication on reconnect, and requires a full persistence layer rewrite. Store Y.Doc as Uint8Array binary (bytea) from day one. JSON is a read-only derived projection, never the source of truth.

2. **No formal state machine** — ad-hoc `status` column updates scatter transition logic across endpoints, create race conditions, and enable impossible states. The previous attempt failed this way. Use XState machines as the single transition authority; store each transition as an immutable row, not just the current state column.

3. **Default-allow permission model** — new endpoints default to accessible, and "lock down later" never happens comprehensively. Enforce default-deny at the middleware level: every route requires an explicit permission declaration, and requests without one are rejected. The previous attempt had this as a critical failure.

4. **Tiptap schema validation disabled by default** — `enableContentCheck` defaults to false; invalid content from copy-paste or API import enters the Y.Doc silently, corrupting collaboration state with no error output. Enable it from day one and handle `contentError` events.

5. **Section identity not stable across versions** — position-based section references break when sections are reordered or inserted, invalidating all feedback links. Assign a persistent UUID to each section node as a ProseMirror attribute. This cannot be retrofitted without migrating all feedback links.

Additional high-priority pitfalls: Audit log as a single unpartitioned table (performance degrades at scale — partition by month from the first migration); Ghost modules (permissions registered before features exist — ship permissions in the same PR as the feature they protect); Clerk auth boundary confusion (Clerk handles role-level, application handles resource-level — never use Clerk's `<Show>` for security).

## Implications for Roadmap

Based on combined research, the dependency graph and pitfall-to-phase mapping suggest a 6-phase structure. The architecture file explicitly models this build order; the feature dependency graph in FEATURES.md confirms it.

### Phase 1: Foundation and Schema
**Rationale:** Auth, database schema, tRPC skeleton, and project scaffolding are prerequisites for every subsequent phase. Critically, the audit table partition strategy, section UUID design, stable section model, and default-deny permission framework must be established here — these cannot be retrofitted. The previous attempt's three critical failures (no state machine, default-allow, ghost modules) all have their root causes in Phase 1 decisions.
**Delivers:** Working Next.js app with Clerk auth, complete Drizzle schema (all tables including partitioned audit log and traceability link table), tRPC skeleton with default-deny middleware, basic RBAC structure, invite-based onboarding
**Addresses:** Auth with RBAC, invite-based onboarding, audit trail (schema), section model
**Avoids:** Default-allow permissions (Pitfall 3), unpartitioned audit table (Pitfall 6), ghost modules (Pitfall 7), Clerk auth boundary confusion (Pitfall 10)
**Research flag:** Standard patterns — Clerk, Drizzle, Next.js setup is well-documented; skip research-phase

### Phase 2: Editor and Content Foundation
**Rationale:** The block editor with stable section UUIDs must exist before feedback can be submitted (feedback references sections). This is the highest-complexity table-stakes feature and shapes ~40% of the codebase. Single-user Tiptap first — collaboration is addable without changing the schema or editor UI.
**Delivers:** Tiptap block editor with custom section node type (stable UUID, ProseMirror attribute), Hocuspocus server for persistence (no RBAC filtering yet), document CRUD, section registry sync to PostgreSQL, Tiptap schema validation enabled
**Addresses:** Block editor, policy document model with sections, section identity
**Avoids:** Y.Doc stored as JSON (Pitfall 1), Tiptap schema validation disabled (Pitfall 4), section identity by position (Pitfall 5), Y.Doc + HMR issues (integration gotcha)
**Research flag:** May need research-phase for Tiptap 3 custom section node extension patterns and Hocuspocus onStoreDocument binary persistence setup

### Phase 3: Feedback System and Workflow Engine
**Rationale:** With sections existing as stable identities, feedback can now be submitted against them. This phase introduces XState machines for the feedback lifecycle — the state machine must be the first thing built before any feedback endpoint. Audit logging of feedback transitions begins here.
**Delivers:** Feedback submission (FB-XXX), XState feedback machine (Submitted->UnderReview->Accepted/Partially/Rejected->Closed), mandatory decision rationale enforcement, feedback lifecycle management, evidence file upload (Uploadthing/S3), audit events for all feedback transitions, section-level access scoping enforcement, role-aware dashboards (Policy Lead, Stakeholder views), basic email notifications
**Addresses:** Structured feedback, feedback lifecycle with decision log, anonymity controls, section-level RBAC scoping, notification system
**Avoids:** Ad-hoc status updates instead of state machine (Pitfall 2), ghost modules for feedback permissions (Pitfall 7), N+1 permission checks (performance trap)
**Research flag:** XState 5 persistence patterns (persisting machine state snapshots to PostgreSQL) may need research-phase

### Phase 4: Change Request Workflow and Traceability Chain
**Rationale:** CRs are created from existing feedback items and produce new document versions when merged. Both feedback (Phase 3) and a version concept (introduced here) must exist. The traceability link table — designed in Phase 1 schema — gets populated as CRs link to feedback items and sections. This is the core differentiator phase.
**Delivers:** CR workflow (CR-XXX, Drafting->InReview->Approved->Merged->Closed), XState CR machine, CR-to-feedback linking (many feedback per CR), CR-to-section linking, CR merge flow creating new document version, traceability link table population, traceability matrix basic view (FB->CR->Section->Version queryable), decision rationale on CR merge
**Addresses:** Change Request workflow, traceability matrix, per-stakeholder outcome view (foundation)
**Avoids:** Traceability chain as ad-hoc JOINs (Pitfall 9), CR merge without atomic traceability link creation ("Looks Done But Isn't" checklist)
**Research flag:** CR merge atomicity (creating version + audit events + traceability links in a single transaction) is novel; may need research-phase

### Phase 5: Versioning, Publishing, and Public Portal
**Rationale:** Version publishing depends on CRs being mergeable (Phase 4). This phase completes the full feedback-to-published-version loop and makes the traceability chain visible end-to-end. The public portal is the external face of the platform.
**Delivers:** Yjs snapshot capture for version creation, section-level diff computation (jsdiff), auto-generated changelogs linked to CR and FB IDs, publish workflow (Policy Lead triggers publish), public portal (Next.js ISR, read-only, privacy-sanitized), PDF export of published versions, CSV export of traceability data, per-stakeholder outcome view
**Addresses:** Document versioning, section-level diff view, public portal, PDF/CSV export, per-stakeholder outcome view
**Avoids:** Published content exposing stakeholder identities (security checklist), public portal accessing unpublished draft content (route separation)
**Research flag:** Yjs snapshot diff between versions for section-level comparison may need research-phase (community patterns exist but are non-obvious)

### Phase 6: Real-Time Collaboration and Extended Features
**Rationale:** The Tiptap editor already works for single users. Adding Yjs collaboration is additive (the Collaboration extension layers on without changing the schema or API). This phase also introduces workshops and evidence management, which enrich the feedback system but are not on the critical path for the core loop. Deferred deliberately to validate core traceability first.
**Delivers:** Real-time collaborative editing (Yjs CRDT, multi-user cursors via awareness protocol), offline/reconnection strategy with IndexedDB, connection status indicator, workshop module (first-class entity, artifacts, insight linking, feedback provenance), evidence artifact management with "claims without evidence" view, milestone evidence pack export, inline comments on selected text, "what changed since last visit" indicators
**Addresses:** Real-time collaboration, workshop module, evidence management, milestone export
**Avoids:** Real-time collaboration without reconnection strategy (Pitfall 8), Yjs tombstone accumulation (performance trap), awareness protocol broadcast storm (performance trap)
**Research flag:** Needs research-phase for Yjs offline persistence (IndexedDB provider), reconnection testing strategy, and Hocuspocus RBAC section filtering (Approach A vs B decision)

### Phase Ordering Rationale

- Schema first because the audit table partition strategy, stable section UUID design, and traceability link table cannot be added after data exists
- Editor before feedback because feedback must reference sections that exist as stable entities in both CRDT and relational DB
- Feedback before CRs because CRs aggregate existing feedback items — CRs have no inputs without feedback
- CRs before versioning because versions are produced by CR merges — versioning has no trigger without CRs
- Versioning before public portal because the portal publishes versions — it has nothing to show without them
- Real-time collaboration deliberately last — Tiptap works without Yjs; layering collaboration on a stable single-user editor is lower risk than building collaboration into an unproven editor
- RBAC is cross-cutting and layered progressively: default-deny framework in Phase 1, section-level scoping in Phase 3, CRDT document filtering in Phase 6

### Research Flags

Phases needing deeper research during planning:
- **Phase 2:** Tiptap 3 custom section node extension with ProseMirror attributes (stable UUID), Hocuspocus binary persistence setup, Tiptap + HMR dev gotcha
- **Phase 3:** XState 5 machine state persistence patterns (storing machine snapshots in PostgreSQL, not just current state column)
- **Phase 4:** CR merge atomicity — creating version row, audit events, and traceability links atomically in one database transaction
- **Phase 5:** Yjs snapshot diffing for section-level version comparison (community patterns are sparse)
- **Phase 6:** Yjs IndexedDB offline persistence, reconnection testing, Hocuspocus RBAC section filtering architecture

Phases with standard patterns (skip research-phase):
- **Phase 1:** Clerk + Next.js 16, Drizzle schema setup, tRPC initialization — all well-documented with official guides
- **Phase 5 (public portal):** Next.js ISR for published content, PDF generation with @react-pdf/renderer — standard patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core technologies verified against official docs and npm. Tiptap 3 vs BlockNote decision well-reasoned. One MEDIUM caveat: Drizzle is pre-1.0 (0.45.x) and Neon was acquired by Databricks (May 2025) — both mitigated (Drizzle heading to 1.0 beta; Neon uses standard PG so migration is trivial if needed) |
| Features | HIGH | Validated across 15+ competitor platforms. Feature dependency graph is internally consistent. MVP scope is appropriate — validates the core differentiator without over-engineering. Anti-features are well-justified |
| Architecture | HIGH | Core patterns (dual-model, state machine, append-only audit) are established and well-sourced. The CRDT + relational bridge is the novel part — Hocuspocus onStoreDocument hook patterns are documented but real-world integration complexity should be treated as MEDIUM confidence |
| Pitfalls | HIGH | Verified against official docs, academic CRDT papers, and the previous PolicyDash failure post-mortem. The 10 pitfalls identified have clear prevention strategies with phase assignments |

**Overall confidence:** HIGH

### Gaps to Address

- **Hocuspocus + Vercel deployment topology:** Hocuspocus must run outside Vercel (Railway, Render, or VPS). Latency between the Vercel Next.js app and the Hocuspocus server on a different platform needs to be validated early. Evaluate during Phase 2.
- **Tiptap Comments pricing:** The research notes that Tiptap's inline comment extension may require a Tiptap Cloud subscription. The alternative (custom mark-based comments) is more work. Decide before Phase 6 whether to build custom or pay. Community package `tiptap-comment-extension` is a fallback.
- **Clerk 7-role vs 3-4 role mapping:** Research recommends mapping the 7 PolicyDash roles to 3-4 Clerk Organization roles and handling fine-grained distinctions in the application layer. This boundary decision must be made explicitly in Phase 1 before role assignment logic is built anywhere else.
- **Neon acquisition by Databricks:** Monitor Neon product direction. If Neon pivots away from the Vercel integration story, fall back to direct PostgreSQL on Supabase or a managed PG provider. The Drizzle schema is portable.
- **Drizzle pre-1.0 status:** Drizzle 0.45.x is mature but not 1.0. Pin versions tightly. Review Drizzle release notes before each dependency update. If 1.0 ships during development, evaluate the migration path.

## Sources

### Primary (HIGH confidence)
- [Next.js 16 Release Blog](https://nextjs.org/blog/next-16) — features, Turbopack stability, React Compiler
- [Tiptap 3.0 Stable Release](https://tiptap.dev/blog/release-notes/tiptap-3-0-is-stable) — v3 feature list
- [Hocuspocus Persistence Guide](https://tiptap.dev/docs/hocuspocus/guides/persistence) — binary storage requirement, onStoreDocument hook
- [Yjs GitHub](https://github.com/yjs/yjs) — CRDT architecture, 900K+ weekly downloads
- [Clerk RBAC Docs](https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions) — custom roles/permissions via Backend API
- [Drizzle ORM npm](https://www.npmjs.com/package/drizzle-orm) — version 0.45.1, 7.4KB bundle
- [XState npm](https://www.npmjs.com/package/xstate) — v5.28.0 confirmed
- [Decidim Features](https://decidim.org/features/) — civic participation platform feature set
- [LEOS - EU Legislative Editing Software](https://interoperable-europe.ec.europa.eu/collection/justice-law-and-security/solution/leos-open-source-software-editing-legislation) — legislative drafting feature set
- [Citizen Space by Delib](https://www.delib.net/citizen_space) — "We Asked, You Said, We Did" pattern

### Secondary (MEDIUM confidence)
- [Drizzle vs Prisma (Bytebase)](https://www.bytebase.com/blog/drizzle-vs-prisma/) — performance benchmarks, DX comparison
- [Neon vs Supabase (Bytebase)](https://www.bytebase.com/blog/neon-vs-supabase/) — architecture, Vercel integration
- [CRDT Libraries Comparison (2025)](https://velt.dev/blog/best-crdt-libraries-real-time-data-sync) — Yjs as industry standard
- [Database-Backed State Machines (Lawrence Jones)](https://blog.lawrencejones.dev/state-machines/) — transition table patterns
- [Oso RBAC Best Practices](https://www.osohq.com/learn/rbac-best-practices) — default-deny patterns
- [shadcn/ui CLI v4](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4) — Tailwind v4 compatibility, March 2026
- [Yjs Community: Versioning Discussion](https://discuss.yjs.dev/t/for-versioning-should-i-store-snapshot-or-document-copies/2421) — snapshot vs document copy patterns
- PolicyDash previous attempt post-mortem (internal: ghost modules, no state machine, hardcoded JWT secrets, default-allow permissions)

### Tertiary (LOW confidence — needs validation during implementation)
- [Ink & Switch: Upwelling](https://www.inkandswitch.com/upwelling/) — real-time collaboration + version control integration (academic prototype, not production-proven)
- [@react-pdf/renderer npm](https://www.npmjs.com/package/@react-pdf/renderer) — v4.3.2 confirmed; SSR quirks with Next.js App Router noted but not fully characterized

---
*Research completed: 2026-03-25*
*Ready for roadmap: yes*
