# Requirements: PolicyDash

**Defined:** 2026-03-25
**Core Value:** Every piece of stakeholder feedback is traceable from submission through to the policy version it influenced -- or recorded with rationale for why it wasn't adopted.

## v1 Requirements

### Authentication & Access Control

- [x] **AUTH-01**: User can sign up / log in via Clerk auth provider (email-based)
- [x] **AUTH-02**: Admin can invite users via email with pre-assigned role
- [x] **AUTH-03**: User is assigned one of 7 roles: Admin, Policy Lead, Research Lead, Workshop Moderator, Stakeholder, Observer, Auditor
- [x] **AUTH-04**: User's organization type is tagged: Government, Industry, Legal, Academia, Civil Society, Internal
- [x] **AUTH-05**: Stakeholder can only view and interact with sections they are assigned to (section-level scoping)
- [x] **AUTH-06**: Each role has a defined permission set enforced on every API endpoint (default-deny)
- [x] **AUTH-07**: User session persists across browser refresh
- [x] **AUTH-08**: Privacy preferences: user can choose named or anonymous attribution for public outputs

### Policy Documents & Sections

- [x] **DOC-01**: Admin/Policy Lead can create a new policy document with title and description
- [x] **DOC-02**: Policy document contains ordered sections with stable UUIDs (identity persists across versions)
- [x] **DOC-03**: Policy Lead can create, reorder, and delete sections within a document
- [x] **DOC-04**: Section content is stored as block-based structure (Tiptap JSON)
- [x] **DOC-05**: Existing policy content can be imported from markdown files
- [x] **DOC-06**: Multiple policy documents can exist in the workspace simultaneously

### Block Editor

- [x] **EDIT-01**: Notion-style block editor with slash commands for inserting block types
- [x] **EDIT-02**: Supported block types: text, heading (H1-H3), callout, table, toggle/collapsible, quote, divider, code block
- [x] **EDIT-03**: Drag-and-drop reordering of blocks within a section
- [x] **EDIT-04**: Rich text formatting within blocks (bold, italic, underline, strikethrough, links, inline code)
- [x] **EDIT-05**: Embeds and media support (images, file attachments, rich link previews)
- [ ] **EDIT-06**: Real-time collaborative editing -- multiple users can edit the same section simultaneously via Yjs/Hocuspocus
- [ ] **EDIT-07**: Presence indicators showing who is currently viewing/editing a section
- [ ] **EDIT-08**: Inline comments -- user can select text and leave a comment anchored to that selection

### Feedback System

- [x] **FB-01**: Authenticated user (with permission) can submit feedback tied to a specific policy section
- [x] **FB-02**: Feedback has a human-readable ID (FB-001, FB-002, etc.)
- [x] **FB-03**: Feedback captures: type (Issue, Suggestion, Endorsement, Evidence, Question), priority (Low, Medium, High), impact category (Legal, Security, Tax, Consumer, Innovation, Clarity, Governance, Other)
- [x] **FB-04**: Feedback captures: title, body text, and optional suggested change
- [x] **FB-05**: Feedback can have evidence artifacts attached (files or links)
- [x] **FB-06**: Feedback lifecycle: Submitted -> Under Review -> Accepted / Partially Accepted / Rejected -> Closed
- [x] **FB-07**: Every accept/reject/partial decision requires a mandatory rationale (decision log)
- [x] **FB-08**: Stakeholder can choose anonymous or named attribution per feedback item
- [x] **FB-09**: Stakeholder can view the status and outcome of their own feedback items
- [x] **FB-10**: Policy Lead can filter feedback by section, stakeholder org type, priority, status, impact, and feedback type

### Change Request Workflow

- [x] **CR-01**: Policy Lead can create a Change Request (CR-XXX) from one or more feedback items
- [x] **CR-02**: CR links to affected policy sections and source feedback items
- [x] **CR-03**: CR has an assigned owner (Policy Lead) and title/description
- [x] **CR-04**: CR lifecycle managed by state machine: Drafting -> In Review -> Approved -> Merged -> Closed
- [x] **CR-05**: CR approval requires human sign-off (Policy Lead or Admin)
- [x] **CR-06**: Merging a CR atomically creates a new document version with merge summary
- [x] **CR-07**: All feedback items linked to a merged CR are automatically updated to reflect the version they influenced
- [x] **CR-08**: CR can be closed without merging (with rationale)

### Versioning & Publishing

- [x] **VER-01**: Policy documents use semantic versioning (v0.1, v0.2, etc.)
- [x] **VER-02**: New version is created when a CR is merged or manually by Admin/Policy Lead
- [x] **VER-03**: Auto-generated changelog for each version: what changed, why, linked feedback IDs
- [x] **VER-04**: Section-level diff view comparing any two versions of a document
- [ ] **VER-05**: Previous versions are archived and accessible as read-only
- [x] **VER-06**: Admin/Policy Lead can publish a version, making it visible on the public portal
- [x] **VER-07**: Version snapshots are immutable once published

### Traceability

- [ ] **TRACE-01**: Full traceability chain: Feedback -> Change Request -> Section -> Version
- [ ] **TRACE-02**: Traceability matrix view: grid of FB -> CR -> Section -> Version with decision rationale
- [ ] **TRACE-03**: Filter traceability by stakeholder org type, section, decision outcome, version range
- [ ] **TRACE-04**: Per-section "What changed and why" view showing feedback that drove changes
- [ ] **TRACE-05**: Per-stakeholder "Your feedback outcomes" view showing how each feedback item was handled
- [ ] **TRACE-06**: Export traceability matrix as CSV and PDF

### Workshop Module

- [ ] **WS-01**: Workshop Moderator can create workshop events with title, description, date, duration, registration link
- [ ] **WS-02**: Workshop artifacts: upload/attach promo materials, recordings, summaries, attendance records
- [ ] **WS-03**: Link workshop insights to specific policy sections
- [ ] **WS-04**: Link feedback items to workshops (feedback originating from workshop sessions)
- [ ] **WS-05**: Workshop list view with upcoming/past filtering

### Evidence & Documents

- [x] **EV-01**: User can upload evidence artifacts (files) or add links as evidence
- [x] **EV-02**: Evidence can be attached to feedback items and policy sections
- [ ] **EV-03**: Research Lead has "Claims without evidence" view surfacing feedback lacking supporting evidence
- [ ] **EV-04**: Evidence artifacts have metadata: title, type (Link, File), uploader, timestamp

### Public Portal

- [ ] **PUB-01**: Published policy versions are viewable on a public read-only page (no auth required)
- [ ] **PUB-02**: Public changelog showing version history and what changed
- [ ] **PUB-03**: Sanitized consultation summaries (no stakeholder identities unless explicitly opted in)
- [ ] **PUB-04**: PDF export of published policy versions
- [ ] **PUB-05**: Public portal does NOT expose: raw feedback threads, stakeholder identities, internal deliberations

### Dashboards & UX

- [ ] **UX-01**: Role-aware dashboard: each role sees relevant content, tasks, metrics on login
- [ ] **UX-02**: Policy Lead dashboard: feedback inbox (filterable), active CRs, section health indicators
- [ ] **UX-03**: Research Lead dashboard: evidence repository, "claims without evidence", research tasks
- [ ] **UX-04**: Stakeholder dashboard: assigned sections, pending feedback requests, upcoming workshops, "what changed since last visit"
- [ ] **UX-05**: Admin dashboard: user management, publish controls, system overview
- [ ] **UX-06**: Auditor dashboard: audit trail viewer, export controls
- [ ] **UX-07**: Workshop Moderator dashboard: workshop management, artifact uploads, section linking

### Notifications

- [ ] **NOTIF-01**: In-app notifications for: feedback status changes, new version published, section assignment, CR status changes
- [ ] **NOTIF-02**: Email notifications for key events: feedback reviewed, version published, workshop upcoming
- [ ] **NOTIF-03**: "What changed since last visit" indicators on dashboard and section views

### Search & Filtering

- [ ] **SRCH-01**: Filter feedback by section, stakeholder type, priority, status, impact category, feedback type
- [ ] **SRCH-02**: Full-text search across feedback content
- [ ] **SRCH-03**: Search policy document content across sections
- [ ] **SRCH-04**: Filter CRs by status, section, linked feedback

### Audit & Compliance

- [x] **AUDIT-01**: Immutable append-only audit log recording every action (create, update, publish, merge, decision)
- [x] **AUDIT-02**: Audit log captures: actor, action, object type, object ID, timestamp, metadata
- [x] **AUDIT-03**: Audit log is partitioned for performance (monthly or quarterly)
- [ ] **AUDIT-04**: Auditor can view full audit trail with filtering
- [ ] **AUDIT-05**: Milestone evidence pack export: stakeholder list, feedback matrix, version history, workshop evidence, decision logs
- [ ] **AUDIT-06**: Evidence pack exportable as structured ZIP with index

## v2 Requirements

### Advanced Editor

- **EDIT-V2-01**: Paragraph-level text anchors for pinpoint feedback targeting
- **EDIT-V2-02**: Inline databases (Notion-style)
- **EDIT-V2-03**: Templates for common policy section structures

### Multi-Tenant

- **MT-01**: Organizations get isolated workspaces with separate users, policies, and data
- **MT-02**: Organization-level billing and usage tracking
- **MT-03**: Cross-organization policy sharing (read-only)

### Analytics

- **ANLYT-01**: Stakeholder engagement analytics (participation rates, response times)
- **ANLYT-02**: Feedback analytics (distribution by type, priority, impact, section)
- **ANLYT-03**: Policy health dashboard (sections with most contention, unresolved feedback)

### Advanced Workflow

- **WF-01**: Batch feedback triage (select multiple, apply same decision)
- **WF-02**: Feedback endorsement voting (stakeholders upvote others' feedback)
- **WF-03**: Two-person approval rule for CR merges

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time chat between stakeholders | Moves discussion off structured feedback record, undermines traceability, creates shadow conversations |
| AI-assisted policy drafting | Undermines human-deliberative nature, attribution ambiguity, government stakeholder distrust |
| Decision automation / auto-approval | Removes human accountability, undermines core differentiator of mandatory rationale |
| Anonymous public commenting | Destroys feedback quality, enables spam, makes traceability impossible |
| Native mobile app | Policy documents are complex structured content, block editor UX requires desktop |
| Co-authored feedback items | Blurs attribution, makes traceability chain ambiguous |
| Sentiment analysis / NLP | Unreliable on policy text, structured feedback types already serve categorization |
| Free-form unstructured feedback | Expensive to triage, impossible to aggregate, hard to trace |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 4 | Complete |
| AUTH-06 | Phase 1 | Complete |
| AUTH-07 | Phase 1 | Complete |
| AUTH-08 | Phase 4 | Complete |
| DOC-01 | Phase 2 | Complete |
| DOC-02 | Phase 2 | Complete |
| DOC-03 | Phase 2 | Complete |
| DOC-04 | Phase 2 | Complete |
| DOC-05 | Phase 2 | Complete |
| DOC-06 | Phase 2 | Complete |
| EDIT-01 | Phase 3 | Complete |
| EDIT-02 | Phase 3 | Complete |
| EDIT-03 | Phase 3 | Complete |
| EDIT-04 | Phase 3 | Complete |
| EDIT-05 | Phase 3 | Complete |
| EDIT-06 | Phase 11 | Pending |
| EDIT-07 | Phase 11 | Pending |
| EDIT-08 | Phase 11 | Pending |
| FB-01 | Phase 4 | Complete |
| FB-02 | Phase 4 | Complete |
| FB-03 | Phase 4 | Complete |
| FB-04 | Phase 4 | Complete |
| FB-05 | Phase 4 | Complete |
| FB-06 | Phase 4 | Complete |
| FB-07 | Phase 4 | Complete |
| FB-08 | Phase 4 | Complete |
| FB-09 | Phase 4 | Complete |
| FB-10 | Phase 4 | Complete |
| CR-01 | Phase 5 | Complete |
| CR-02 | Phase 5 | Complete |
| CR-03 | Phase 5 | Complete |
| CR-04 | Phase 5 | Complete |
| CR-05 | Phase 5 | Complete |
| CR-06 | Phase 5 | Complete |
| CR-07 | Phase 5 | Complete |
| CR-08 | Phase 5 | Complete |
| VER-01 | Phase 6 | Complete |
| VER-02 | Phase 6 | Complete |
| VER-03 | Phase 6 | Complete |
| VER-04 | Phase 6 | Complete |
| VER-05 | Phase 6 | Pending |
| VER-06 | Phase 6 | Complete |
| VER-07 | Phase 6 | Complete |
| TRACE-01 | Phase 7 | Pending |
| TRACE-02 | Phase 7 | Pending |
| TRACE-03 | Phase 7 | Pending |
| TRACE-04 | Phase 7 | Pending |
| TRACE-05 | Phase 7 | Pending |
| TRACE-06 | Phase 7 | Pending |
| WS-01 | Phase 10 | Pending |
| WS-02 | Phase 10 | Pending |
| WS-03 | Phase 10 | Pending |
| WS-04 | Phase 10 | Pending |
| WS-05 | Phase 10 | Pending |
| EV-01 | Phase 4 | Complete |
| EV-02 | Phase 4 | Complete |
| EV-03 | Phase 10 | Pending |
| EV-04 | Phase 10 | Pending |
| PUB-01 | Phase 9 | Pending |
| PUB-02 | Phase 9 | Pending |
| PUB-03 | Phase 9 | Pending |
| PUB-04 | Phase 9 | Pending |
| PUB-05 | Phase 9 | Pending |
| UX-01 | Phase 8 | Pending |
| UX-02 | Phase 8 | Pending |
| UX-03 | Phase 8 | Pending |
| UX-04 | Phase 8 | Pending |
| UX-05 | Phase 8 | Pending |
| UX-06 | Phase 8 | Pending |
| UX-07 | Phase 8 | Pending |
| NOTIF-01 | Phase 8 | Pending |
| NOTIF-02 | Phase 8 | Pending |
| NOTIF-03 | Phase 8 | Pending |
| SRCH-01 | Phase 7 | Pending |
| SRCH-02 | Phase 7 | Pending |
| SRCH-03 | Phase 7 | Pending |
| SRCH-04 | Phase 7 | Pending |
| AUDIT-01 | Phase 1 | Complete |
| AUDIT-02 | Phase 1 | Complete |
| AUDIT-03 | Phase 1 | Complete |
| AUDIT-04 | Phase 9 | Pending |
| AUDIT-05 | Phase 9 | Pending |
| AUDIT-06 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 87 total
- Mapped to phases: 87
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after roadmap creation*
