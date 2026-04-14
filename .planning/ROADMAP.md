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
- [x] **Phase 10: Workshops & Evidence Management** - Workshop events, artifacts, insight-to-section linking, evidence repository, "claims without evidence" view (completed 2026-03-26)
- [x] **Phase 11: Real-Time Collaboration** - Multi-user Yjs/Hocuspocus editing, presence indicators, inline comments on selected text (completed 2026-03-26)
- [x] **Phase 12: Workshop System Fix** - Fix workshop section/feedback linking, dialog pickers, duplicate UI (completed 2026-03-26)
- [x] **Phase 13: UX Consolidation & Navigation** - Breadcrumbs, PolicyTabBar, consolidated /feedback, cross-nav, r2-upload rename (completed 2026-04-12)

---

### Milestone v0.2: Verifiable Policy OS — Public Consultation & On-Chain Anchoring (Phases 14–25)

- [x] **Phase 14: Collab Rollback** - Remove Yjs/Hocuspocus/inline comments, drop related schema, delete hocuspocus-server; verify single-user editor with auto-save
 (completed 2026-04-13)
- [x] **Phase 15: Stale Verification Closeout** - Re-verify Phase 4 FeedbackDetailSheet + Phase 7 traceability discoverability; fix Phase 9 Export Evidence Pack button
 (completed 2026-04-13)
- [x] **Phase 16: Flow 5 Smoke + Notification Dispatch Migration** - Flow 5 E2E smoke; migrate createNotification callsites to notification.create Inngest event with idempotency
 (completed 2026-04-13)
- [x] **Phase 17: Workshop Lifecycle + Recording Pipeline** - workshops.status state machine, evidence checklist, workshopCompleted nudges, Groq Whisper transcription + llama summary
 (completed 2026-04-14)
- [x] **Phase 18: Async Evidence Pack Export** - Inngest evidencePackExport with R2 streaming binaries and 24h presigned GET email delivery
 (completed 2026-04-14)
- [x] **Phase 19: Public /participate Intake (Flow 1)** - Turnstile-gated public intake form, Clerk invitation auto-register, participateIntake Inngest fn with role-tailored welcome emails
 (completed 2026-04-14)
- [ ] **Phase 20: Cal.com Workshop Register (Flow 2)** - Public /workshops listing with cal.com embed, webhook handler, auto-user-create, MEETING_ENDED attendance, post-workshop feedback link
- [ ] **Phase 20.5: Public /research + /framework Content** - Static /research content page; /framework draft consultation surface with per-section status badges and what-changed log
- [ ] **Phase 21: Public Shell + LLM Consultation Summary + Theme** - Minimal public shell routing; llama-3.3-70b consultation summary per section with human review gate; policy-grade theme
- [ ] **Phase 22: Milestone Entity + SHA256 Hashing Service** - First-class milestones table, RFC 8785 JCS canonicalization, deterministic hashing for version/workshop/evidence/milestone
- [ ] **Phase 23: Cardano Preview-Net Anchoring** - Mesh SDK + Blockfrost per-milestone and per-version anchoring with Verified State badges on public portal
- [ ] **Phase 24: Stakeholder Engagement Tracking Lite** - users.lastActivityAt via tRPC middleware, admin inactive-user widget, basic engagement score
- [ ] **Phase 25: Cross-Phase Integration Smoke** - Full E2E walk: /participate → workshop register → reminders → MEETING_ENDED → feedback → CR → merge → version → milestone → SHA256 → Cardano tx → Verified State badge

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
- [x] 07-01-PLAN.md -- Backend: traceability tRPC router (matrix, sectionChain, stakeholderOutcomes, search), permissions, feedback/CR router extensions, CSV/PDF export Route Handlers
- [x] 07-02-PLAN.md -- Traceability page with matrix table, filter panel, by-section view, by-stakeholder view, export buttons, workspace nav
- [x] 07-03-PLAN.md -- Search tab with debounced cross-entity search, scope tabs (Feedback/Content/CRs), result cards with match highlighting, CR inline filters

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
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 08-01-PLAN.md -- Backend: notifications schema + migration, notification tRPC router, createNotification helper, Resend email service, permissions, last_visited_at on users
- [x] 08-02-PLAN.md -- Dashboard page with role-switch dispatcher, all 7 role dashboards (Policy Lead, Stakeholder, Admin, Research Lead, Auditor, Workshop Moderator, Observer), notification bell in header
- [x] 08-03-PLAN.md -- Wire createNotification + email into existing routers (feedback, CR, version, sectionAssignment), /notifications full page, lastVisitedAt tracking

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
**Plans**: 2 plans
**UI hint**: yes

Plans:
- [x] 09-01-PLAN.md -- Public portal: (public) route group, proxy.ts whitelist, Tiptap HTML renderer, portal home, policy detail with version selector/section nav, public changelog, sanitized consultation summary, PDF export route
- [x] 09-02-PLAN.md -- Audit viewer: /audit page with filter panel and paginated event table, evidence pack service + ZIP export route, workspace-nav audit link, auditor dashboard wiring

### Phase 10: Workshops & Evidence Management
**Goal**: Workshop Moderators can manage consultation events as first-class entities with artifacts and insight linking, and Research Leads can identify claims lacking evidence
**Depends on**: Phase 4
**Requirements**: WS-01, WS-02, WS-03, WS-04, WS-05, EV-03, EV-04
**Success Criteria** (what must be TRUE):
  1. Workshop Moderator can create workshop events with title, description, date, duration, and registration link
  2. Workshop Moderator can upload and manage artifacts (promo materials, recordings, summaries, attendance records) for each workshop
  3. Workshop insights can be linked to specific policy sections, and feedback items can be linked to workshops they originated from
  4. Research Lead can view a "Claims without evidence" report surfacing feedback items that lack supporting evidence
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 10-01-PLAN.md -- Backend: workshop schema (4 tables), migration, permissions, audit constants, workshop tRPC router (CRUD + artifacts + links), evidence router enhancements (EV-03 claimsWithoutEvidence query, EV-04 uploader name join)
- [x] 10-02-PLAN.md -- Workshop UI: list page with upcoming/past tabs, create/edit forms, detail page with artifacts + section/feedback link pickers, workspace nav, dashboard replacement
- [x] 10-03-PLAN.md -- Evidence UI: Claims Without Evidence full page with filters and table, evidence list metadata enhancement (uploader name + timestamp), research lead dashboard link update

### Phase 11: Real-Time Collaboration
**Goal**: Multiple users can simultaneously edit the same policy section with live presence awareness and inline discussion via comments
**Depends on**: Phase 3
**Requirements**: EDIT-06, EDIT-07, EDIT-08
**Success Criteria** (what must be TRUE):
  1. Two or more users can edit the same section simultaneously and see each other's changes in real time via Yjs/Hocuspocus CRDT sync
  2. Users can see presence indicators showing who is currently viewing or editing a section
  3. User can select text within a section and leave an inline comment anchored to that selection
**Plans**: 3 plans
**UI hint**: yes

Plans:
- [x] 11-01-PLAN.md -- Backend foundation: DB schema (ydoc_snapshots, comment_threads, comment_replies), Hocuspocus server, InlineComment mark, comments tRPC router, buildExtensions collaboration option
- [x] 11-02-PLAN.md -- Client collaboration: HocuspocusProvider in BlockEditor, PresenceBar avatars, ConnectionStatus indicator, remote cursor CSS, auto-save fallback
- [x] 11-03-PLAN.md -- Inline comments UI: CommentBubble floating trigger, CommentPanel with open/resolved tabs, CommentThread with replies, resolve/reopen workflow, comment anchor highlighting

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11

Note: Phases 9, 10, and 11 have partial independence. Phase 9 (Public Portal) depends on Phase 6. Phase 10 (Workshops) depends on Phase 4. Phase 11 (Collaboration) depends on Phase 3. However, sequential execution is recommended to maintain focus.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Auth | 3/3 | Complete | 2026-03-25 |
| 2. Policy Documents & Sections | 3/3 | Complete | 2026-03-25 |
| 3. Block Editor | 3/3 | Complete | 2026-03-25 |
| 4. Feedback System | 3/3 | Complete | 2026-03-25 |
| 5. Change Requests | 3/3 | Complete | 2026-03-25 |
| 6. Versioning | 2/2 | Complete | 2026-03-25 |
| 7. Traceability & Search | 3/3 | Complete | 2026-03-25 |
| 8. Dashboards & Notifications | 3/3 | Complete | 2026-03-25 |
| 9. Public Portal & Compliance | 2/2 | Complete | 2026-03-25 |
| 10. Workshops & Evidence Management | 3/3 | Complete | 2026-03-26 |
| 11. Real-Time Collaboration | 3/3 | Complete (rolled back in v0.2 P14) | 2026-03-26 |
| 12. Workshop System Fix | 2/2 | Complete | 2026-04-12 |
| 13. UX Consolidation & Navigation | 5/5 | Complete | 2026-04-12 |
| 14. Collab Rollback | 4/4 | Complete    | 2026-04-13 |
| 15. Stale Verification Closeout | 1/1 | Complete    | 2026-04-13 |
| 16. Flow 5 Smoke + Notification Migration | 5/5 | Complete    | 2026-04-13 |
| 17. Workshop Lifecycle + Recording Pipeline | 6/6 | Complete    | 2026-04-14 |
| 18. Async Evidence Pack Export | 3/3 | Complete    | 2026-04-14 |
| 19. Public /participate Intake | 6/6 | Complete    | 2026-04-14 |
| 20. Cal.com Workshop Register | 2/6 | In Progress|  |
| 20.5. Public /research + /framework Pages | 0/0 | v0.2 Planning | - |
| 21. Public Shell + Consultation Summary + Theme | 0/0 | v0.2 Planning | - |
| 22. Milestone Entity + SHA256 Hashing | 0/0 | v0.2 Planning | - |
| 23. Cardano Preview-Net Anchoring | 0/0 | v0.2 Planning | - |
| 24. Stakeholder Engagement Tracking | 0/0 | v0.2 Planning | - |
| 25. Cross-Phase Integration Smoke | 0/0 | v0.2 Planning | - |

### Phase 12: Workshop System Fix

**Goal:** Workshop artifacts, section linking, and feedback linking all work end-to-end
**Requirements**: Fix section link picker (document.list returns no sections), build feedback link picker selection UI, remove duplicate section/feedback rendering between detail page and picker components, fix orphaned DialogTrigger when pickers controlled externally
**Depends on:** Phase 10
**Plans:** 2/2 plans complete

Plans:
- [ ] 12-01-PLAN.md -- Fix document.list with includeSections, rewrite section-link-picker as pure dialog content, fix artifact-attach-dialog orphaned DialogTrigger
- [ ] 12-02-PLAN.md -- Add feedback.listAll query, rewrite feedback-link-picker with card UI, search, type filter, multi-select

### Phase 13: UX Consolidation & Navigation

**Goal:** App navigation feels coherent with breadcrumbs, tab bars, consolidated views, and the primary user flows (read → feedback → track) take 2-3 clicks instead of 5-6
**Requirements**: Add breadcrumbs across all nested routes, convert policy sub-pages to tab bar navigation, consolidate duplicate feedback views (/feedback global vs /policies/[id]/feedback), add cross-navigation between workshops and linked sections/feedback, add /users and /notifications to workspace nav, rename uploadthing.ts to r2-upload.ts and update all imports, add direct "Give Feedback" action from section content view
**Depends on:** Phase 12
**Plans:** 5/5 plans complete

Plans:
- [x] TBD (run /gsd:plan-phase 13 to break down)
 (completed 2026-04-12)

---

#### Milestone v0.2 — Verifiable Policy OS: Public Consultation & On-Chain Anchoring

**Started:** 2026-04-13
**Phases:** 14–25 (12 phases, Phase 20.5 inserted between 20 and 21)
**Goal:** Turn PolicyDash from a closed authenticated workspace into a verifiable policy operating system with a public consultation on-ramp, fully automated workshop/feedback flows via Inngest, LLM-assisted content (Groq), and Cardano preview-net anchoring of every published policy version and completed milestone.

## Execution Order

Critical path: **14 → 15 → 16 → {17 ∥ 19} → 20 → 25**

Parallelizable once prereqs land: 18 (after 16), 20.5 (after 17), 21 (after 20.5), 22→23, 24 (after 20).

### Phase 14: Collab Rollback

**Goal:** Real-time collaboration code is fully removed so v0.2 work can layer onto a smaller, stable type surface
**Depends on:** v0.1 Phase 13
**Requirements:** COLLAB-ROLLBACK-01, COLLAB-ROLLBACK-02
**Success Criteria** (what must be TRUE):
  1. `ydoc_snapshots`, `comment_threads`, `comment_replies` tables dropped via migration with no dangling FK references
  2. `hocuspocus-server/` directory deleted from repo; `NEXT_PUBLIC_HOCUSPOCUS_URL` removed from `.env.example`
  3. Block editor loads and accepts input in single-user mode without any Yjs/Collaboration extension imports; auto-save fires on idle
  4. `EDIT-06`, `EDIT-07`, `EDIT-08` annotated as "rolled back in v0.2 Phase 14, deferred to v2" in REQUIREMENTS.md
  5. Render tests pass after each deletion step (not just typecheck) — prevents the `providerRef.current` class of bug
**Plans:** 4/4 plans complete

Plans:
- [x] 14-01-PLAN.md — Delete 10 standalone collab files (UI components, hooks, utilities, collab-specific tests)
- [x] 14-02-PLAN.md — Rewrite block-editor.tsx and build-extensions.ts to remove all providerRef/Yjs/InlineComment code paths
- [x] 14-03-PLAN.md — Delete commentRouter, clean permissions/constants, drop collaboration schema + apply DB migration
- [x] 14-04-PLAN.md — Remove collab npm packages, clean env/css, verify absence audits, final acceptance gate

### Phase 15: Stale Verification Closeout

**Goal:** v0.1 audit gaps (stale verifications on Phase 4, Phase 7, plus Phase 9 auditor dashboard bug) are resolved before any new surfaces are built on top of them
**Depends on:** Phase 14
**Requirements:** FIX-05, FIX-06, EV-08
**Success Criteria** (what must be TRUE):
  1. Stakeholder clicking a feedback row in `/feedback` opens the detail sheet with triage actions and decision log (verifies Phase 4 FeedbackDetailSheet wiring works post-Phase 13 consolidation)
  2. Traceability page is reachable via PolicyTabBar from any policy detail page (verifies Phase 7 discoverability)
  3. Auditor dashboard "Export Evidence Pack" button opens `EvidencePackDialog` directly (fixes Phase 9 audit gap — one-line fix, previously routed as Link to `/audit`)
  4. Phase 4 and Phase 7 VERIFICATION.md files are updated to `status: passed` with a re-verified timestamp
**Plans:** 1/1 plans complete

Plans:
- [x] 15-01-PLAN.md — Re-verify FIX-05 + FIX-06 (no code change), fix EV-08 (EvidencePackDialog trigger prop + auditor dashboard in-place mount), flip Phase 4/7/9 VERIFICATION.md to passed

### Phase 16: Flow 5 Smoke + Notification Dispatch Migration

**Goal:** All notification dispatch runs through Inngest (off the mutation critical path) with transition-window dual-write to prevent duplicate sends; Flow 5 (feedback decided → notification + email + auto-draft CR) smoke-tested end-to-end against a running dev server
**Depends on:** Phase 15
**Requirements:** FIX-07, NOTIF-04, NOTIF-05, NOTIF-06
**Success Criteria** (what must be TRUE):
  1. Admin decides a feedback item (accept/partial/reject) and within ~5 seconds: in-app notification appears for submitter, email sent via Resend, if accept/partial a draft CR is auto-created with linked feedback and sections
  2. `createNotification(...).catch(console.error)` callsites replaced with `sendEvent('notification.create', ...)` in `feedback.ts`, `changeRequest.ts`, `version.ts`, `sectionAssignment.ts`; `feedback.decide:398` pattern confirmed as reference
  3. `notificationDispatch` Inngest fn inserts the DB row and sends the Resend email with retry safety
  4. Transition-window dual-write guarded by idempotency key (`createdBy + entityType + entityId + action`) prevents duplicate notifications during cutover
  5. Flow 5 smoke walk produces all four observable effects (in-app notification, email send, auto-draft CR, workflowTransition log) on a single feedback.decide call
**Plans:** 5/5 plans complete

Plans:
- [x] 16-00-PLAN.md - Wave 0 test scaffolds (create-draft-cr, notification-create, notification-dispatch)
- [x] 16-01-PLAN.md - Migration 0009 idempotency_key + notification.create event + sendNotificationCreate helper
- [x] 16-02-PLAN.md - notificationDispatchFn Inngest function + register in functions barrel
- [x] 16-03-PLAN.md - Migrate 7 createNotification callsites across 4 routers to sendNotificationCreate
- [x] 16-04-PLAN.md - Flow 5 end-to-end smoke walk + create-draft-cr.test.ts promotion + SMOKE.md evidence

### Phase 17: Workshop Lifecycle + Recording Pipeline (Groq)

**Goal:** Workshops have a real status machine with completion events, an evidence checklist with auto-nudges, and recordings are transcribed + summarized via Groq Whisper + llama in a background pipeline
**Depends on:** Phase 16
**Requirements:** WS-06, WS-12, WS-13, WS-14, LLM-01, LLM-02, LLM-03
**Success Criteria** (what must be TRUE):
  1. Moderator can transition a workshop through `upcoming → in_progress → completed → archived` via admin actions, with each transition audited
  2. Workshop completion triggers `workshopCompleted` Inngest fn that creates evidence checklist rows for required artifact slots
  3. Moderator receives a nudge email at 72h and 7d after completion if evidence slots are still empty, with deep-links to the upload targets
  4. Moderator uploads a workshop recording → `workshopRecordingProcessed` Inngest fn transcribes via Whisper-large-v3-turbo and summarizes via llama-3.1-8b-instant
  5. Transcript and summary appear as workshop artifacts in draft state; moderator reviews and approves before they become visible beyond admins
  6. Uploads > 25MB are rejected at R2 presign step; `src/lib/llm.ts` wrapper enforces `max_tokens` on every Groq chat call
**Plans:** 6/6 plans complete

Plans:
- [x] 17-00-PLAN.md — Wave 0 scaffolds: install groq-sdk, add GROQ_API_KEY to .env.example, create 4 RED test files
- [x] 17-01-PLAN.md — Migration 0010 schema substrate + workshop.transition/approveArtifact mutations + workshop.completed Inngest event (WS-06)
- [x] 17-02-PLAN.md — src/lib/llm.ts Groq SDK wrapper with chatComplete/transcribeAudio/summarizeTranscript (LLM-01/02/03)
- [x] 17-03-PLAN.md — workshopCompletedFn Inngest function: checklist creation + 72h/7d nudges (WS-12, WS-13)
- [x] 17-04-PLAN.md — R2 recording category + workshopRecordingProcessedFn 4-step pipeline (WS-14)
- [x] 17-05-PLAN.md — UI surfaces + 17-SMOKE.md deferred placeholder

### Phase 18: Async Evidence Pack Export

**Goal:** Evidence pack export runs async via Inngest with R2 binary inclusion; completed pack is uploaded and delivered via presigned-GET email link
**Depends on:** Phase 16 (Inngest pattern)
**Requirements:** EV-05, EV-06, EV-07
**Success Criteria** (what must be TRUE):
  1. Admin or Auditor clicks "Export Evidence Pack" → receives toast "Your pack is being generated, you'll get an email when ready"
  2. `evidencePackExport` Inngest fn gathers metadata (CSVs/JSONs) and fetches R2 binaries (recordings, screenshots, attachments) via streaming download
  3. fflate `zipSync` assembles the archive and uploads to `evidence-packs/{documentId}-{timestamp}.zip` via R2 `PutObjectCommand`. Multipart streaming upload is documented as a deferred upgrade path (see `evidence-pack-export.ts` JSDoc) — current pack sizes are bounded by single-policy scope.
  4. Requester receives email with presigned-GET URL (24h expiry) and pack metadata (file count, total size, timestamp)
  5. Fallback path: if binary fetch times out, deliver a manifest-only pack with presigned links (documented as degraded-mode)
**Plans:** 3/3 plans complete

Plans:
- [x] 18-00-PLAN.md — Wave 0 TDD scaffolds: RED contracts for evidencePackExport fn, email helper, dialog queued state
- [x] 18-01-PLAN.md — Backend: evidenceExportRequestedEvent + evidencePackExportFn (6-step pipeline) + sendEvidencePackReadyEmail + barrel registration
- [x] 18-02-PLAN.md — Trigger surface: evidence.requestExport tRPC mutation + dialog async conversion + sync route deletion

### Phase 19: Public `/participate` Intake (Clerk Invite + Turnstile)

**Goal:** Any visitor can submit `/participate` form, get role-classified, auto-registered via Clerk invitation API, and receive a role-tailored welcome email — with layered abuse protection
**Depends on:** Phase 16
**Requirements:** INTAKE-01, INTAKE-02, INTAKE-03, INTAKE-04, INTAKE-05, INTAKE-06, INTAKE-07
**Success Criteria** (what must be TRUE):
  1. Unauthenticated visitor can load `/participate` and submit the form with role, org type, expertise, email, and interest
  2. Cloudflare Turnstile token is verified server-side before any Clerk or DB call; missing/invalid token returns 403
  3. Submission fires `participateIntake` Inngest event and returns a success toast within 500ms (user does not wait for Clerk API)
  4. `participateIntake` Inngest fn: rate-limits per emailHash, auto-creates Clerk user via `invitations.createInvitation({ emailAddress, publicMetadata: { role: 'stakeholder', orgType } })` if unknown, no-ops on duplicate submit via idempotency key
  5. Role-tailored welcome email sent via Resend per 6 org buckets (government / industry / legal / academia / civil_society / internal) — 6 templates
  6. Existing Clerk user routed to their existing account, no duplicate invite, still receives welcome email
  7. Turnstile failure, rate limit hit, and Clerk errors surfaced cleanly in the UI without exposing internals
**Plans:** 6/6 plans complete

Plans:
- [x] 19-00-PLAN.md — Wave 0 RED tests (4 files) + @marsidev/react-turnstile install + Turnstile env vars
- [x] 19-01-PLAN.md — participate.intake event + POST /api/intake/participate Route Handler (Turnstile verify + emailHash + event send)
- [x] 19-02-PLAN.md — participateIntakeFn Inngest function (rateLimit + Clerk invitations.createInvitation + welcome email step)
- [x] 19-03-PLAN.md — WelcomeEmail react-email component (6 org buckets) + sendWelcomeEmail helper in src/lib/email.ts
- [x] 19-04-PLAN.md — Public /participate page shell + client form (8 fields + Turnstile) + success panel
- [x] 19-05-PLAN.md — proxy.ts public-route whitelist (/participate + /api/intake) + end-to-end smoke walk

### Phase 20: Cal.com Workshop Register

**Goal:** Visitors can register for workshops via cal.com embed; webhook handler creates `workshopRegistrations`, auto-creates Clerk users, auto-populates attendance from `MEETING_ENDED`, and emails post-workshop feedback links back-linked to workshops
**Depends on:** Phase 17 + Phase 19
**Requirements:** WS-07, WS-08, WS-09, WS-10, WS-11, WS-15
**Success Criteria** (what must be TRUE):
  1. Admin creating a workshop auto-creates a matching cal.com event type via cal.com API; `workshops.calcomEventTypeId` FK stored
  2. Public `/workshops` listing shows upcoming workshops with cal.com embed widget per workshop
  3. Visitor can book a slot via the embed; cal.com sends `BOOKING_CREATED` webhook to `/api/webhooks/cal`
  4. Webhook handler verifies HMAC-SHA256 signature on raw request body (not after `req.json()`) before any processing; idempotent on `bookingUid`
  5. `BOOKING_CREATED` handler creates `workshopRegistrations` row; if attendee email unknown, Clerk-invites via `invitations.createInvitation`
  6. `MEETING_ENDED` webhook (flat payload shape — NOT `BOOKING_COMPLETED` which doesn't exist) transitions workshop to `completed` status and auto-populates attendance from cal.com attendee list
  7. Post-workshop feedback link emailed to attendees; clicking it lands on a pre-filled feedback form with `workshopId` set, and submission creates a `workshopFeedbackLinks` row
**Plans:** 2/6 plans executed

Plans:
- [x] 20-01-PLAN.md — Migration 0011 + schema + Inngest events + lib helpers (cal-signature, feedback-token, email helpers)
- [x] 20-02-PLAN.md — Cal.com API client + workshopCreatedFn + admin create mutation + maxSeats UI
- [ ] 20-03-PLAN.md — Cal webhook route (HMAC + 4 dispatchers) + Clerk userId backfill + proxy.ts /workshops
- [ ] 20-04-PLAN.md — workshopRegistrationReceivedFn + workshopFeedbackInviteFn Inngest workers
- [ ] 20-05-PLAN.md — Public /workshops SSR listing + cal-embed modal + spots-left badge
- [ ] 20-06-PLAN.md — /participate mode-switch + workshop-feedback form + submit route + VALIDATION.md map

### Phase 20.5: Public `/research` + `/framework` Content Pages

**Goal:** Public visitors can read the research backing the policy and see the draft framework under consultation with per-section status and a "what changed" log
**Depends on:** Phase 17 (framework page surfaces document-level status)
**Requirements:** PUB-06, PUB-07, PUB-08
**Success Criteria** (what must be TRUE):
  1. Public `/research` page renders executive summary, current Indian landscape, key gap clusters, and a downloadable research report (PDF) without authentication
  2. Public `/framework` page lists documents tagged `isPublicDraft: true` with per-section status badges: Draft / Under Review / Validated (derived from section-level CR and review state)
  3. `/framework` shows a "what changed" log aggregating recent CR merges per section with dates and short summaries (no stakeholder identity surfaced)
  4. Both pages load without authentication; `proxy.ts` `publicRoutes` explicitly allow them
**Plans:** TBD (run /gsd:plan-phase 20.5)

### Phase 21: Public Shell + Consultation Summary LLM + Theme

**Goal:** Minimal public shell ties the public surfaces together with a policy-grade theme; LLM-generated consultation summary prose is cached per published version and auto-regenerated on every publish, gated by human review before public display
**Depends on:** Phase 20.5
**Requirements:** LLM-04, LLM-05, LLM-06, LLM-07, LLM-08, PUB-09, PUB-10
**Success Criteria** (what must be TRUE):
  1. Minimal public shell (header, footer) wraps `/`, `/participate`, `/workshops`, `/research`, `/framework`, `/portal` with consistent navigation; landing page at `/` is deferred but shell routes exist
  2. Policy-grade theme applied: white/off-white base, dark blue/slate typography, saffron or teal accent, document cards (verified against reference design in `newDoc2.md`)
  3. `version.published` event triggers `consultationSummaryGenerate` Inngest fn that calls llama-3.3-70b-versatile with anonymized accepted-feedback content grouped by section
  4. LLM output cached in `documentVersions.consultationSummary` (JSONB) with status `pending`; never rendered publicly until moderator reviews and marks `approved`
  5. Guardrail regex scans generated text for stakeholder name patterns and blocks publish if any match (belt-and-suspenders alongside anonymization at input)
  6. Consultation summary only visible publicly when status is `approved`; draft versions show "Summary under review" placeholder
  7. Moderator review modal shows pending/draft summaries with side-by-side raw feedback counts for verification
**Plans:** TBD (run /gsd:plan-phase 21)

### Phase 22: Milestone Entity + SHA256 Hashing Service

**Goal:** First-class Milestone entity links all its constituent state (versions, workshops, feedback, evidence) and exposes a deterministic SHA256 hash service; golden-fixture tests guarantee hash stability under Cardano anchoring
**Depends on:** Phase 18 (evidence pack foundations)
**Requirements:** VERIFY-01, VERIFY-02, VERIFY-03, VERIFY-04, VERIFY-05
**Success Criteria** (what must be TRUE):
  1. `milestones` table exists with required-slot definitions, readiness state (`defining → ready → anchoring → anchored`), and immutability enforcement after `anchored`
  2. `documentVersions`, `workshops`, `feedbackItems`, `evidenceArtifacts` each have nullable `milestoneId` FK with partial indexes
  3. Admin can view a milestone detail page showing all linked entities and click "Mark milestone ready" to trigger hash computation
  4. `src/lib/hashing.ts` produces deterministic SHA256 hashes for `policyVersion`, `workshop`, `evidenceBundle`, `milestone` inputs
  5. Canonical JSON pass (RFC 8785 JCS or explicit sort+stringify) normalizes input before hashing
  6. Golden-fixture tests verify hash stability across permuted inputs, nested objects, and array orderings — failure means hash is non-deterministic and anchoring cannot proceed
**Plans:** TBD (run /gsd:plan-phase 22)

### Phase 23: Cardano Preview-Net Anchoring

**Goal:** Every published policy version and completed milestone is SHA256-hashed and anchored to Cardano preview-net via Mesh SDK + Blockfrost, with Verified State badges and Cardanoscan explorer links on the public portal
**Depends on:** Phase 22 + user-provided funded preview-net wallet
**Requirements:** VERIFY-06, VERIFY-07, VERIFY-08, VERIFY-09
**Success Criteria** (what must be TRUE):
  1. `src/lib/cardano.ts` built with `import 'server-only'` guard, Mesh SDK + Blockfrost wired, env vars validated via `requireEnv`
  2. Admin marks milestone ready → `milestoneReady` Inngest fn executes 5 steps: compute-hash → persist-hash → check-existing-tx → submit-tx → confirm-loop
  3. `check-existing-tx` queries Blockfrost `/metadata/txs/labels/:label` for existing tx matching this content hash; if found, reuses existing txHash (prevents double-anchor on redeploy or retry)
  4. `submit-tx` builds Cardano tx with metadata JSON (CIP-10 label 674) containing `{ project, type, hash, milestoneId, timestamp }`, signs with service wallet, submits via Blockfrost
  5. `confirm-loop` polls until tx confirmed (step.sleep 30s between polls); stores `txHash` and `anchoredAt` on milestone row
  6. Every `version.published` event triggers a per-version anchor via the same pipeline (different metadata type)
  7. DB-level `UNIQUE(milestoneId)` / `UNIQUE(versionId)` constraint + `concurrency: { key: 'cardano-wallet', limit: 1 }` enforce idempotency at three layers
  8. Public `/portal` renders Verified State badge on anchored versions and milestones, linking to `https://preview.cardanoscan.io/transaction/{txHash}` explorer page
**Plans:** TBD (run /gsd:plan-phase 23)

### Phase 24: Stakeholder Engagement Tracking (lite)

**Goal:** Admins have visibility into stakeholder engagement — who is active, who has gone dormant, and how engagement is measured — without building a full CRM
**Depends on:** Phase 20 (needs cal.com attendance data to be meaningful)
**Requirements:** UX-08, UX-09, UX-10, UX-11
**Success Criteria** (what must be TRUE):
  1. `users.lastActivityAt` column updated via tRPC middleware on every authenticated mutation; migration backfills to `createdAt` for existing users
  2. Admin dashboard widget lists users with no activity in a configurable window (default 30 days), sortable by last activity and engagement score
  3. Basic engagement score computed from feedback count + workshop attendance count; formula documented in code comment
  4. Stakeholder profile page shows workshop attendance history auto-populated from cal.com `MEETING_ENDED` webhook events
**Plans:** TBD (run /gsd:plan-phase 24)

### Phase 25: Cross-Phase Integration Smoke

**Goal:** A full end-to-end walk from public intake through feedback decision, CR merge, version publish, milestone completion, and Cardano anchoring proves the entire v0.2 chain works as a single product — the gap I bailed on in the v0.1 audit
**Depends on:** All prior v0.2 phases (14–24)
**Requirements:** INTEGRATION-01
**Success Criteria** (what must be TRUE):
  1. Fresh visitor submits `/participate` → receives welcome email → clicks Clerk invite link → sets password → lands on stakeholder dashboard
  2. Same visitor views `/workshops`, books a slot via cal.com embed, receives cal.com confirmation + ICS attachment
  3. Cal.com reminder emails fire on schedule (spot-check via dev-mode time acceleration)
  4. After session ends, `MEETING_ENDED` webhook transitions workshop to completed; attendance auto-populated; post-workshop feedback email arrives with deep-link
  5. Stakeholder submits feedback via deep-link → `workshopFeedbackLinks` row created → workflowTransition audit log shows correct actor
  6. Admin reviews feedback, accepts it with rationale → Inngest fires `feedback.reviewed` → notification + email + auto-draft CR created
  7. Admin merges CR → new document version published → `version.published` event triggers per-version Cardano anchor → `consultationSummaryGenerate` fires → moderator reviews LLM summary → marks approved
  8. Admin marks milestone ready → milestone hash computed → Cardano tx submitted → confirmed → Verified State badge visible on `/portal` with Cardanoscan preview-net link
  9. Integration smoke report written to `.planning/v0.2-INTEGRATION-SMOKE.md` documenting any gaps, flaky steps, or regressions
**Plans:** TBD (run /gsd:plan-phase 25)
