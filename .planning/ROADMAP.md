# Roadmap: PolicyDash

## Overview

PolicyDash delivers a stakeholder policy consultation platform where every piece of feedback is traceable from submission through to the policy version it influenced. The build follows the core data pipeline: foundation and auth, then documents with stable section identities, then the block editor, then the feedback-to-change-request-to-version chain that is the product's differentiator. Once the core loop works end-to-end, traceability views, dashboards, the public portal, workshops, and real-time collaboration layer on in order of dependency and risk.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Auth** - Project scaffolding, Clerk auth, database schema, tRPC skeleton, default-deny RBAC, audit log infrastructure
- [ ] **Phase 2: Policy Documents & Sections** - Document model with stable section UUIDs, section CRUD, markdown import
- [ ] **Phase 3: Block Editor** - Single-user Tiptap editor with slash commands, block types, drag-drop, media support
- [ ] **Phase 4: Feedback System** - Structured feedback submission, XState lifecycle, mandatory decision rationale, evidence attachment, anonymity controls
- [ ] **Phase 5: Change Requests** - CR workflow from feedback to section changes, XState lifecycle, CR-to-feedback and CR-to-section linking
- [ ] **Phase 6: Versioning** - Semantic versioning, CR merge creates versions, section-level diffs, auto-generated changelogs, version archive
- [ ] **Phase 7: Traceability & Search** - Traceability matrix views, per-section and per-stakeholder views, full-text search, filtering, CSV/PDF export
- [ ] **Phase 8: Dashboards & Notifications** - Role-aware dashboards for all 7 roles, in-app and email notifications, "what changed since last visit"
- [ ] **Phase 9: Public Portal & Compliance** - Read-only public portal, public changelog, consultation summaries, PDF export, audit trail viewer, evidence pack export
- [ ] **Phase 10: Workshops & Evidence Management** - Workshop events, artifacts, insight-to-section linking, evidence repository, "claims without evidence" view
- [ ] **Phase 11: Real-Time Collaboration** - Multi-user Yjs/Hocuspocus editing, presence indicators, inline comments on selected text

## Phase Details

### Phase 1: Foundation & Auth
**Goal**: Users can authenticate via phone number through Clerk, receive role assignments, and all API endpoints enforce default-deny permissions with audit logging from day one
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-06, AUTH-07, AUDIT-01, AUDIT-02, AUDIT-03
**Success Criteria** (what must be TRUE):
  1. User can sign up and log in via Clerk, and session persists across browser refresh
  2. Admin can invite a user via phone number and the invited user arrives with the correct role pre-assigned
  3. User's organization type (Government, Industry, Legal, Academia, Civil Society, Internal) is stored and visible in their profile
  4. An unauthenticated or unauthorized API request is rejected with 403 (default-deny enforced on every endpoint)
  5. Every create, update, and delete action produces an immutable audit log entry with actor, action, object, and timestamp
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md -- Dependencies, database schema (users, audit, workflow), Drizzle + Neon setup, Vitest config
- [x] 01-02-PLAN.md -- tRPC init with default-deny middleware, Clerk proxy.ts, auth pages, webhook handler, layout providers
- [x] 01-03-PLAN.md -- tRPC routers (user, audit), audit log service, unit tests for permissions/audit/webhook

### Phase 2: Policy Documents & Sections
**Goal**: Policy Leads can create and structure policy documents with sections that carry stable identities for all downstream workflow references
**Depends on**: Phase 1
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06
**Success Criteria** (what must be TRUE):
  1. Admin or Policy Lead can create a new policy document with title and description, and multiple documents can coexist in the workspace
  2. Policy Lead can add, reorder, and delete sections within a document, and each section has a stable UUID that persists across operations
  3. Section content is stored as block-based Tiptap JSON structure in the database
  4. An existing markdown policy file can be imported and converted into a structured document with sections
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 02-01-PLAN.md -- Backend: DB schema (policy_documents + policy_sections), migration, permissions, audit actions, tRPC document router, markdown parser, Tiptap renderer, tests
- [x] 02-02-PLAN.md -- UI setup: shadcn init, install dependencies, policy list page with card grid, create/edit/delete policy dialogs, workspace nav
- [x] 02-03-PLAN.md -- Policy detail page with section sidebar (drag-and-drop), section CRUD dialogs, read-only content view, markdown import flow

### Phase 3: Block Editor
**Goal**: Users editing policy sections have a Notion-quality block editing experience with all core block types, formatting, and media support
**Depends on**: Phase 2
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05
**Success Criteria** (what must be TRUE):
  1. User can type "/" in the editor and select from block types: text, heading (H1-H3), callout, table, toggle, quote, divider, code block
  2. User can drag and drop blocks to reorder them within a section
  3. User can apply rich text formatting (bold, italic, underline, strikethrough, links, inline code) within any block
  4. User can embed images, attach files, and insert rich link previews into a section
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 03-01-PLAN.md -- Install Tiptap 3 deps, custom extensions (callout, slash commands, link preview), extension builder, updateSectionContent tRPC mutation, unit tests
- [x] 03-02-PLAN.md -- Core editor UI: BlockEditor component, EditorToolbar, SlashCommandMenu, FloatingLinkEditor, DragHandle, auto-save, policy page integration
- [x] 03-03-PLAN.md -- Media blocks: Uploadthing setup, image upload, file attachment, link preview OG fetch, code block language selector/copy, final verification

### Phase 4: Feedback System
**Goal**: Stakeholders can submit structured, traceable feedback on policy sections with full lifecycle management, evidence support, and privacy controls
**Depends on**: Phase 3
**Requirements**: FB-01, FB-02, FB-03, FB-04, FB-05, FB-06, FB-07, FB-08, FB-09, FB-10, AUTH-05, AUTH-08, EV-01, EV-02
**Success Criteria** (what must be TRUE):
  1. Authenticated stakeholder can submit feedback (with type, priority, impact, title, body) tied to a specific policy section, and receives a human-readable ID (FB-001)
  2. Stakeholder can only view and submit feedback on sections they are assigned to (section-level scoping enforced)
  3. Policy Lead can transition feedback through lifecycle states (Submitted, Under Review, Accepted/Partially/Rejected, Closed) and must provide rationale for every accept/reject decision
  4. Stakeholder can view the current status and decision outcome of their own feedback items
  5. User can attach evidence (files or links) to feedback items and to policy sections, and can choose anonymous or named attribution per feedback item
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 04-01-PLAN.md -- Schema + XState 5 machine + tRPC routers (feedback, sectionAssignment, evidence), section-access middleware, permissions, migration, unit tests
- [x] 04-02-PLAN.md -- Feedback submission form, inbox page with filter panel, stakeholder outcomes view, shadcn components, workspace nav update
- [x] 04-03-PLAN.md -- Feedback detail sheet with triage actions, rationale dialog, decision log, evidence attachment and list components

### Phase 5: Change Requests
**Goal**: Policy Leads can create governed change requests from feedback, manage them through a PR-style lifecycle, and link them to affected sections
**Depends on**: Phase 4
**Requirements**: CR-01, CR-02, CR-03, CR-04, CR-05, CR-06, CR-07, CR-08
**Success Criteria** (what must be TRUE):
  1. Policy Lead can create a Change Request (CR-XXX) from one or more feedback items, with title, description, and assigned owner
  2. CR links are visible showing which policy sections are affected and which feedback items are the source
  3. CR transitions through lifecycle states (Drafting, In Review, Approved, Merged, Closed) enforced by a state machine with human approval required
  4. Merging a CR atomically creates a new document version, and all linked feedback items are updated to reflect the version they influenced
  5. A CR can be closed without merging, and the closure rationale is recorded
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 05-01-PLAN.md -- CR schema (change_requests, join tables, document_versions stub), XState 5 machine, transitionCR + mergeCR services, tRPC router, permissions, migration, unit tests
- [x] 05-02-PLAN.md -- CR list page with filter panel, CR status badge, CR cards, Create CR two-step dialog, CSS variables
- [x] 05-03-PLAN.md -- CR detail page with lifecycle actions, merge dialog, close dialog, linked feedback list, affected sections table, decision log

### Phase 6: Versioning
**Goal**: Policy documents have a complete version history with diffs, changelogs, and immutable archives so any stakeholder can see exactly what changed and why
**Depends on**: Phase 5
**Requirements**: VER-01, VER-02, VER-03, VER-04, VER-05, VER-06, VER-07
**Success Criteria** (what must be TRUE):
  1. Policy documents use semantic versioning (v0.1, v0.2) and new versions are created on CR merge or manually by Admin/Policy Lead
  2. Each version has an auto-generated changelog showing what changed, why, and which feedback IDs were involved
  3. User can view a section-level diff between any two versions of a document
  4. Previous versions are archived as read-only and accessible for review
  5. Admin/Policy Lead can publish a version, and published version snapshots are immutable
**Plans**: 2 plans
**UI hint**: yes

Plans:
- [x] 06-01-PLAN.md -- Backend: extend documentVersions schema (snapshot, changelog, publish), version.service.ts, tRPC router, mergeCR extension, migration, permissions, unit tests
- [x] 06-02-PLAN.md -- Version history page with list/detail panels, changelog, section diff view, publish dialog, create version dialog

### Phase 7: Traceability & Search
**Goal**: The full feedback-to-version traceability chain is visible, queryable, and exportable -- proving the platform's core value proposition
**Depends on**: Phase 6
**Requirements**: TRACE-01, TRACE-02, TRACE-03, TRACE-04, TRACE-05, TRACE-06, SRCH-01, SRCH-02, SRCH-03, SRCH-04
**Success Criteria** (what must be TRUE):
  1. User can view a traceability matrix grid showing Feedback -> CR -> Section -> Version with decision rationale for each link
  2. User can filter the traceability matrix by stakeholder org type, section, decision outcome, and version range
  3. User can view per-section "What changed and why" and per-stakeholder "Your feedback outcomes" views
  4. User can export the traceability matrix as CSV and PDF
  5. User can search feedback content (full-text), policy document content, and filter CRs by status, section, and linked feedback
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [ ] 07-01-PLAN.md -- Backend: traceability tRPC router (matrix, sectionChain, stakeholderOutcomes, search), permissions, feedback/CR router extensions, CSV/PDF export Route Handlers
- [ ] 07-02-PLAN.md -- Traceability page with matrix table, filter panel, by-section view, by-stakeholder view, export buttons, workspace nav
- [ ] 07-03-PLAN.md -- Search tab with debounced cross-entity search, scope tabs (Feedback/Content/CRs), result cards with match highlighting, CR inline filters

### Phase 8: Dashboards & Notifications
**Goal**: Every role has a tailored dashboard showing relevant content and tasks, and users are notified of important events in-app and via email
**Depends on**: Phase 7
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, NOTIF-01, NOTIF-02, NOTIF-03
**Success Criteria** (what must be TRUE):
  1. Each of the 7 roles sees a distinct dashboard on login with content, tasks, and metrics relevant to their role
  2. Policy Lead dashboard shows feedback inbox (filterable), active CRs, and section health indicators
  3. Stakeholder dashboard shows assigned sections, pending feedback requests, upcoming workshops, and "what changed since last visit" indicators
  4. User receives in-app notifications for feedback status changes, new version published, section assignment, and CR status changes
  5. User receives email notifications for key events: feedback reviewed, version published, workshop upcoming
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD
- [ ] 08-03: TBD

### Phase 9: Public Portal & Compliance
**Goal**: Published policies are publicly accessible with full privacy controls, and auditors can review the complete audit trail and export governance evidence packs
**Depends on**: Phase 6
**Requirements**: PUB-01, PUB-02, PUB-03, PUB-04, PUB-05, AUDIT-04, AUDIT-05, AUDIT-06
**Success Criteria** (what must be TRUE):
  1. Published policy versions are viewable on a public read-only page without authentication
  2. Public portal shows a changelog and sanitized consultation summaries that never expose stakeholder identities unless explicitly opted in
  3. User can download a PDF export of any published policy version
  4. Auditor can view the full audit trail with filtering by action type, actor, object, and date range
  5. Admin/Auditor can export a milestone evidence pack (stakeholder list, feedback matrix, version history, workshop evidence, decision logs) as a structured ZIP
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 09-01: TBD
- [ ] 09-02: TBD

### Phase 10: Workshops & Evidence Management
**Goal**: Workshop Moderators can manage consultation events as first-class entities with artifacts and insight linking, and Research Leads can identify claims lacking evidence
**Depends on**: Phase 4
**Requirements**: WS-01, WS-02, WS-03, WS-04, WS-05, EV-03, EV-04
**Success Criteria** (what must be TRUE):
  1. Workshop Moderator can create workshop events with title, description, date, duration, and registration link
  2. Workshop Moderator can upload and manage artifacts (promo materials, recordings, summaries, attendance records) for each workshop
  3. Workshop insights can be linked to specific policy sections, and feedback items can be linked to workshops they originated from
  4. Research Lead can view a "Claims without evidence" report surfacing feedback items that lack supporting evidence
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 10-01: TBD
- [ ] 10-02: TBD

### Phase 11: Real-Time Collaboration
**Goal**: Multiple users can simultaneously edit the same policy section with live presence awareness and inline discussion via comments
**Depends on**: Phase 3
**Requirements**: EDIT-06, EDIT-07, EDIT-08
**Success Criteria** (what must be TRUE):
  1. Two or more users can edit the same section simultaneously and see each other's changes in real time via Yjs/Hocuspocus CRDT sync
  2. Users can see presence indicators showing who is currently viewing or editing a section
  3. User can select text within a section and leave an inline comment anchored to that selection
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 11-01: TBD
- [ ] 11-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11

Note: Phases 9, 10, and 11 have partial independence. Phase 9 (Public Portal) depends on Phase 6. Phase 10 (Workshops) depends on Phase 4. Phase 11 (Collaboration) depends on Phase 3. However, sequential execution is recommended to maintain focus.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Auth | 0/3 | Planning complete | - |
| 2. Policy Documents & Sections | 0/3 | Planning complete | - |
| 3. Block Editor | 0/3 | Planning complete | - |
| 4. Feedback System | 3/3 | Complete | 2026-03-25 |
| 5. Change Requests | 0/3 | Planning complete | - |
| 6. Versioning | 0/2 | Planning complete | - |
| 7. Traceability & Search | 0/3 | Planning complete | - |
| 8. Dashboards & Notifications | 0/3 | Not started | - |
| 9. Public Portal & Compliance | 0/2 | Not started | - |
| 10. Workshops & Evidence Management | 0/2 | Not started | - |
| 11. Real-Time Collaboration | 0/2 | Not started | - |
