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
- [x] **EDIT-06**: Real-time collaborative editing — Yjs/Hocuspocus (shipped in v0.1 Phase 11, **rolled back in v0.2 Phase 14**, deferred to v2)
- [x] **EDIT-07**: Presence indicators showing who is currently viewing/editing a section (shipped in v0.1 Phase 11, **rolled back in v0.2 Phase 14**, deferred to v2)
- [x] **EDIT-08**: Inline comments anchored to selected text (shipped in v0.1 Phase 11, **rolled back in v0.2 Phase 14**, deferred to v2)

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
- [x] **VER-05**: Previous versions are archived and accessible as read-only
- [x] **VER-06**: Admin/Policy Lead can publish a version, making it visible on the public portal
- [x] **VER-07**: Version snapshots are immutable once published

### Traceability

- [x] **TRACE-01**: Full traceability chain: Feedback -> Change Request -> Section -> Version
- [x] **TRACE-02**: Traceability matrix view: grid of FB -> CR -> Section -> Version with decision rationale
- [x] **TRACE-03**: Filter traceability by stakeholder org type, section, decision outcome, version range
- [x] **TRACE-04**: Per-section "What changed and why" view showing feedback that drove changes
- [x] **TRACE-05**: Per-stakeholder "Your feedback outcomes" view showing how each feedback item was handled
- [x] **TRACE-06**: Export traceability matrix as CSV and PDF

### Workshop Module

- [x] **WS-01**: Workshop Moderator can create workshop events with title, description, date, duration, registration link
- [x] **WS-02**: Workshop artifacts: upload/attach promo materials, recordings, summaries, attendance records
- [x] **WS-03**: Link workshop insights to specific policy sections
- [x] **WS-04**: Link feedback items to workshops (feedback originating from workshop sessions)
- [x] **WS-05**: Workshop list view with upcoming/past filtering

### Evidence & Documents

- [x] **EV-01**: User can upload evidence artifacts (files) or add links as evidence
- [x] **EV-02**: Evidence can be attached to feedback items and policy sections
- [x] **EV-03**: Research Lead has "Claims without evidence" view surfacing feedback lacking supporting evidence
- [x] **EV-04**: Evidence artifacts have metadata: title, type (Link, File), uploader, timestamp

### Public Portal

- [x] **PUB-01**: Published policy versions are viewable on a public read-only page (no auth required)
- [x] **PUB-02**: Public changelog showing version history and what changed
- [x] **PUB-03**: Sanitized consultation summaries (no stakeholder identities unless explicitly opted in)
- [x] **PUB-04**: PDF export of published policy versions
- [x] **PUB-05**: Public portal does NOT expose: raw feedback threads, stakeholder identities, internal deliberations

### Dashboards & UX

- [x] **UX-01**: Role-aware dashboard: each role sees relevant content, tasks, metrics on login
- [x] **UX-02**: Policy Lead dashboard: feedback inbox (filterable), active CRs, section health indicators
- [x] **UX-03**: Research Lead dashboard: evidence repository, "claims without evidence", research tasks
- [x] **UX-04**: Stakeholder dashboard: assigned sections, pending feedback requests, upcoming workshops, "what changed since last visit"
- [x] **UX-05**: Admin dashboard: user management, publish controls, system overview
- [x] **UX-06**: Auditor dashboard: audit trail viewer, export controls
- [x] **UX-07**: Workshop Moderator dashboard: workshop management, artifact uploads, section linking

### Notifications

- [x] **NOTIF-01**: In-app notifications for: feedback status changes, new version published, section assignment, CR status changes
- [x] **NOTIF-02**: Email notifications for key events: feedback reviewed, version published, workshop upcoming
- [x] **NOTIF-03**: "What changed since last visit" indicators on dashboard and section views

### Search & Filtering

- [x] **SRCH-01**: Filter feedback by section, stakeholder type, priority, status, impact category, feedback type
- [x] **SRCH-02**: Full-text search across feedback content
- [x] **SRCH-03**: Search policy document content across sections (section titles only; body JSONB search deferred by v0.1 plan decision)
- [x] **SRCH-04**: Filter CRs by status, section, linked feedback

### Audit & Compliance

- [x] **AUDIT-01**: Immutable append-only audit log recording every action (create, update, publish, merge, decision)
- [x] **AUDIT-02**: Audit log captures: actor, action, object type, object ID, timestamp, metadata
- [x] **AUDIT-03**: Audit log is partitioned for performance (monthly or quarterly)
- [x] **AUDIT-04**: Auditor can view full audit trail with filtering
- [x] **AUDIT-05**: Milestone evidence pack export: stakeholder list, feedback matrix, version history, workshop evidence, decision logs
- [x] **AUDIT-06**: Evidence pack exportable as structured ZIP with index

## v0.2 Requirements

Added 2026-04-13 for milestone v0.2 Verifiable Policy OS — Public Consultation & On-Chain Anchoring. Phases 14–25.

### Collab Rollback

- [x] **COLLAB-ROLLBACK-01**: Yjs/Hocuspocus/inline-comment code removed; EDIT-06, EDIT-07, EDIT-08 moved to Deferred v2 status; `ydoc_snapshots`, `comment_threads`, `comment_replies` schema dropped; `hocuspocus-server/` directory deleted
- [x] **COLLAB-ROLLBACK-02**: Single-user Tiptap editor with auto-save continues to function without Collaboration extension (verified via render tests)

### v0.1 Closeout

- [x] **FIX-05**: Re-verify Phase 4 FeedbackDetailSheet triage workflow reachable after v0.1 Phase 13 /feedback consolidation
- [x] **FIX-06**: Re-verify Phase 7 traceability page discoverable via PolicyTabBar after v0.1 Phase 13 navigation work
- [x] **FIX-07**: v0.1 Flow 5 (feedback.decide → Inngest → notification + email + auto-draft CR) smoke test passes end-to-end

### Notification Dispatch Migration

- [x] **NOTIF-04**: Every `createNotification(...).catch(console.error)` callsite in application routers migrated to `notification.create` Inngest event
- [x] **NOTIF-05**: `notificationDispatch` Inngest fn handles DB insert + Resend email dispatch off the mutation critical path
- [x] **NOTIF-06**: Migration uses transition-window dual-write with idempotency key on `createdBy + entityType + entityId + action` to prevent duplicate sends

### Workshop Lifecycle (extensions)

- [x] **WS-06**: `workshops.status` enum (`upcoming` → `in_progress` → `completed` → `archived`) with audited state transitions
- [ ] **WS-07**: Workshop linked to cal.com event type via `calcomEventTypeId` FK on `workshops`
- [ ] **WS-08**: Public `/workshops` listing shows upcoming workshops with cal.com embed for registration
- [ ] **WS-09**: Cal.com webhook handler verifies HMAC-SHA256 signature on raw request body before processing
- [ ] **WS-10**: Cal.com `BOOKING_CREATED` webhook creates `workshopRegistrations` row, auto-inviting unknown emails via Clerk
- [ ] **WS-11**: Cal.com `MEETING_ENDED` webhook transitions workshop to `completed` and auto-populates attendance
- [x] **WS-12**: `workshopCompleted` Inngest fn fires 72h + 7d moderator nudges on missing evidence checklist slots
- [x] **WS-13**: Workshop has evidence checklist with required artifact slots (`registration_export`, `screenshot`, `recording`, `attendance`, `summary`)
- [x] **WS-14**: Moderator recording upload triggers Groq Whisper transcription + llama summary pipeline (moderator-reviewed before publish)
- [ ] **WS-15**: Post-workshop feedback link is emailed to attendees and back-links to the workshop via `workshopFeedbackLinks`

### Async Evidence Pack (extensions)

- [ ] **EV-05**: Evidence pack export is async via Inngest (not sync tRPC)
- [ ] **EV-06**: Async evidence pack includes R2 binaries (recordings, screenshots, attachments) via streaming `fflate.Zip` + R2 multipart upload
- [ ] **EV-07**: Completed evidence pack uploaded to R2 and download URL emailed to requester (24h presigned GET)
- [x] **EV-08**: Phase 9 auditor dashboard "Export Evidence Pack" button opens `EvidencePackDialog` directly (not Link to `/audit`)

### Public Intake On-Ramp

- [ ] **INTAKE-01**: Public can submit `/participate` form with role, organization type, expertise, email, and interest
- [ ] **INTAKE-02**: Cloudflare Turnstile captcha gates the `/participate` form server-side before any processing
- [ ] **INTAKE-03**: `/participate` submission triggers `participateIntake` Inngest fn (rate-limited, idempotent per emailHash)
- [ ] **INTAKE-04**: Submission auto-creates a Clerk user via `invitations.createInvitation` when email is unknown (role pre-assigned to `stakeholder`)
- [ ] **INTAKE-05**: Role-tailored welcome email sent per 6 org buckets (government, industry, legal, academia, civil_society, internal) via Resend
- [ ] **INTAKE-06**: Existing Clerk user on `/participate` submission is routed to existing account with no duplicate invite
- [ ] **INTAKE-07**: `/participate` form is reachable without authentication

### Public Surface Extensions

- [ ] **PUB-06**: Public `/research` content page with executive summary, current Indian landscape, key gap clusters, research report download
- [ ] **PUB-07**: Public `/framework` draft consultation surface with per-section status badges (Draft / Under Review / Validated) for documents tagged `isPublicDraft: true`
- [ ] **PUB-08**: `/framework` page shows a "what changed" log aggregating recent CR merges per section
- [ ] **PUB-09**: Minimal public shell (header, footer) with routing between `/`, `/participate`, `/workshops`, `/research`, `/framework`, `/portal`
- [ ] **PUB-10**: Public surfaces use a policy-grade theme (white / off-white base, dark blue / slate typography, muted saffron or teal accent, document cards)

### LLM-Assisted Content (Groq)

- [x] **LLM-01**: Groq SDK wrapper (`src/lib/llm.ts`) routes tasks to appropriate models with fail-fast env validation via `requireEnv('GROQ_API_KEY')`
- [x] **LLM-02**: Workshop recording is transcribed via `whisper-large-v3-turbo` within Inngest `step.run` (uploads > 25 MB rejected at R2 presign step)
- [x] **LLM-03**: Workshop transcript is summarized via `llama-3.1-8b-instant` with structured output (key discussion points, decisions, action items)
- [ ] **LLM-04**: Per-section consultation summary prose is generated via `llama-3.3-70b-versatile` from aggregated accepted feedback
- [ ] **LLM-05**: Consultation summary cached in `documentVersions.consultationSummary` (JSONB) and auto-regenerated on every `version.published` event
- [ ] **LLM-06**: Consultation summary generation sees only anonymized feedback content (bodies without submitter identity)
- [ ] **LLM-07**: All LLM outputs enter a human review gate (`pending → draft → approved`) before any public rendering
- [ ] **LLM-08**: LLM output guardrail regex detects stakeholder names leaking through summaries and blocks publish

### Engagement Tracking & UX Extensions

- [ ] **UX-08**: `users.lastActivityAt` updated via tRPC middleware on every authenticated mutation
- [ ] **UX-09**: Admin dashboard widget lists inactive users (no activity in configurable window) with engagement score
- [ ] **UX-10**: Basic engagement score calculated from feedback count + workshop attendance count
- [ ] **UX-11**: Workshop attendance history visible on stakeholder profile (auto-populated from cal.com webhooks)

### Verification Layer (Cardano Anchoring)

- [ ] **VERIFY-01**: First-class `milestones` table with required-slot definitions and readiness state (immutable once anchored)
- [ ] **VERIFY-02**: Milestone entity links to `documentVersions`, `workshops`, `feedbackItems`, `evidenceArtifacts` via nullable `milestoneId` FK
- [ ] **VERIFY-03**: Admin can mark milestone ready, triggering hash computation and Cardano anchoring
- [ ] **VERIFY-04**: SHA256 hashing service (`src/lib/hashing.ts`) produces deterministic hashes for `policyVersion`, `workshop`, `evidenceBundle`, and `milestone`
- [ ] **VERIFY-05**: JSON canonicalization (RFC 8785 JCS or explicit sort+stringify) with golden-fixture tests ensures hash determinism
- [ ] **VERIFY-06**: `milestoneReady` Inngest fn anchors milestone state to Cardano preview-net via Mesh SDK + Blockfrost in 5 steps (compute-hash → persist-hash → check-existing-tx → submit-tx → confirm-loop)
- [ ] **VERIFY-07**: Every `version.published` event triggers a per-version Cardano anchor tx
- [ ] **VERIFY-08**: Cardano anchor fn is idempotent (DB unique constraint on hash + Blockfrost metadata-label pre-check + `concurrency: { key: 'cardano-wallet', limit: 1 }`)
- [ ] **VERIFY-09**: Public `/portal` displays Verified State badges with Cardanoscan preview-net explorer links on anchored versions and milestones

### Cross-Phase Integration

- [ ] **INTEGRATION-01**: End-to-end smoke test walks the full chain: `/participate` submit → Clerk invite → workshop register → 48h + 2h reminders fire → `MEETING_ENDED` webhook → workshop completed + attendance populated → moderator nudge → feedback submit → feedback.decide → notification Inngest → CR → merge → version published → per-version Cardano anchor → milestone ready → milestone hash → milestone Cardano anchor → Verified State badge visible on public portal

## v2 Requirements

### Advanced Editor

- **EDIT-V2-01**: Paragraph-level text anchors for pinpoint feedback targeting
- **EDIT-V2-02**: Inline databases (Notion-style)
- **EDIT-V2-03**: Templates for common policy section structures
- **EDIT-V2-04**: Real-time collaborative editing (rolled back from v0.1 Phase 11 in v0.2 Phase 14; formerly EDIT-06)
- **EDIT-V2-05**: Presence indicators for active editors (rolled back from v0.1 Phase 11 in v0.2 Phase 14; formerly EDIT-07)
- **EDIT-V2-06**: Inline comments anchored to selected text (rolled back from v0.1 Phase 11 in v0.2 Phase 14; formerly EDIT-08)

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
| EDIT-06 | Phase 11 | Complete |
| EDIT-07 | Phase 11 | Complete |
| EDIT-08 | Phase 11 | Complete |
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
| VER-05 | Phase 6 | Complete |
| VER-06 | Phase 6 | Complete |
| VER-07 | Phase 6 | Complete |
| TRACE-01 | Phase 7 | Pending |
| TRACE-02 | Phase 7 | Complete |
| TRACE-03 | Phase 7 | Complete |
| TRACE-04 | Phase 7 | Complete |
| TRACE-05 | Phase 7 | Complete |
| TRACE-06 | Phase 7 | Complete |
| WS-01 | Phase 10 | Complete |
| WS-02 | Phase 10 | Complete |
| WS-03 | Phase 10 | Complete |
| WS-04 | Phase 10 | Complete |
| WS-05 | Phase 10 | Complete |
| EV-01 | Phase 4 | Complete |
| EV-02 | Phase 4 | Complete |
| EV-03 | Phase 10 | Complete |
| EV-04 | Phase 10 | Complete |
| PUB-01 | Phase 9 | Complete |
| PUB-02 | Phase 9 | Complete |
| PUB-03 | Phase 9 | Complete |
| PUB-04 | Phase 9 | Complete |
| PUB-05 | Phase 9 | Complete |
| UX-01 | Phase 8 | Complete |
| UX-02 | Phase 8 | Complete |
| UX-03 | Phase 8 | Complete |
| UX-04 | Phase 8 | Complete |
| UX-05 | Phase 8 | Complete |
| UX-06 | Phase 8 | Complete |
| UX-07 | Phase 8 | Complete |
| NOTIF-01 | Phase 8 | Complete |
| NOTIF-02 | Phase 8 | Complete |
| NOTIF-03 | Phase 8 | Complete |
| SRCH-01 | Phase 7 | Complete |
| SRCH-02 | Phase 7 | Complete |
| SRCH-03 | Phase 7 | Complete |
| SRCH-04 | Phase 7 | Complete |
| AUDIT-01 | Phase 1 | Complete |
| AUDIT-02 | Phase 1 | Complete |
| AUDIT-03 | Phase 1 | Complete |
| AUDIT-04 | Phase 9 | Complete |
| AUDIT-05 | Phase 9 | Complete |
| AUDIT-06 | Phase 9 | Complete |
| COLLAB-ROLLBACK-01 | Phase 14 | Complete |
| COLLAB-ROLLBACK-02 | Phase 14 | Complete |
| FIX-05 | Phase 15 | Complete |
| FIX-06 | Phase 15 | Complete |
| EV-08 | Phase 15 | Complete |
| FIX-07 | Phase 16 | Complete |
| NOTIF-04 | Phase 16 | Complete |
| NOTIF-05 | Phase 16 | Complete |
| NOTIF-06 | Phase 16 | Complete |
| WS-06 | Phase 17 | Complete |
| WS-12 | Phase 17 | Complete |
| WS-13 | Phase 17 | Complete |
| WS-14 | Phase 17 | Complete |
| LLM-01 | Phase 17 | Complete |
| LLM-02 | Phase 17 | Complete |
| LLM-03 | Phase 17 | Complete |
| EV-05 | Phase 18 | Pending |
| EV-06 | Phase 18 | Pending |
| EV-07 | Phase 18 | Pending |
| INTAKE-01 | Phase 19 | Pending |
| INTAKE-02 | Phase 19 | Pending |
| INTAKE-03 | Phase 19 | Pending |
| INTAKE-04 | Phase 19 | Pending |
| INTAKE-05 | Phase 19 | Pending |
| INTAKE-06 | Phase 19 | Pending |
| INTAKE-07 | Phase 19 | Pending |
| WS-07 | Phase 20 | Pending |
| WS-08 | Phase 20 | Pending |
| WS-09 | Phase 20 | Pending |
| WS-10 | Phase 20 | Pending |
| WS-11 | Phase 20 | Pending |
| WS-15 | Phase 20 | Pending |
| PUB-06 | Phase 20.5 | Pending |
| PUB-07 | Phase 20.5 | Pending |
| PUB-08 | Phase 20.5 | Pending |
| LLM-04 | Phase 21 | Pending |
| LLM-05 | Phase 21 | Pending |
| LLM-06 | Phase 21 | Pending |
| LLM-07 | Phase 21 | Pending |
| LLM-08 | Phase 21 | Pending |
| PUB-09 | Phase 21 | Pending |
| PUB-10 | Phase 21 | Pending |
| VERIFY-01 | Phase 22 | Pending |
| VERIFY-02 | Phase 22 | Pending |
| VERIFY-03 | Phase 22 | Pending |
| VERIFY-04 | Phase 22 | Pending |
| VERIFY-05 | Phase 22 | Pending |
| VERIFY-06 | Phase 23 | Pending |
| VERIFY-07 | Phase 23 | Pending |
| VERIFY-08 | Phase 23 | Pending |
| VERIFY-09 | Phase 23 | Pending |
| UX-08 | Phase 24 | Pending |
| UX-09 | Phase 24 | Pending |
| UX-10 | Phase 24 | Pending |
| UX-11 | Phase 24 | Pending |
| INTEGRATION-01 | Phase 25 | Pending |

**Coverage:**
- v1 requirements: 87 total — 87 mapped, 87 complete
- v0.2 requirements: 55 total — 55 mapped, 0 complete
- Total: 142 requirements — 142 mapped, 87 complete, 55 pending, 0 unmapped

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-04-13 after milestone v0.2 definition (55 new requirements added across 9 categories + collab rollback; 5 v0.1 pending flipped to Complete; 3 v0.1 editor reqs annotated as rolled back in v0.2 Phase 14)*
