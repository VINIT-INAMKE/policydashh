# PolicyDash

## What This Is

A stakeholder policy consultation platform where organizations create policy documents, gather structured feedback from diverse stakeholders (government, industry, legal, academia, civil society), manage change requests through a governed workflow, and publish versioned policies with full feedback-to-framework traceability. The platform provides a Notion-like editing experience with real-time collaboration, role-based access control with section-level scoping, and a public portal for published policy documents.

## Core Value

Every piece of stakeholder feedback is traceable from submission through to the policy version it influenced — or recorded with rationale for why it wasn't adopted. Nothing gets lost, everything is accountable.

## Current Milestone: v0.2 Verifiable Policy OS — Public Consultation & On-Chain Anchoring

**Goal:** Turn PolicyDash from a closed authenticated workspace into a verifiable policy operating system with a public consultation on-ramp, fully automated workshop/feedback flows via Inngest, LLM-assisted content (Groq), and Cardano preview-net anchoring of every published policy version and completed milestone.

**Target features:**

- Remove all real-time collaborative editing (deferred to v2); single-user editor with auto-save
- Async evidence pack export via Inngest with R2 binary inclusion and email delivery
- Workshop lifecycle state machine with Groq-transcribed + summarized recordings
- Public `/participate` intake form with Clerk-invite auto-registration and Turnstile rate limiting
- Public workshop registration via cal.com embed with webhook-driven user creation and attendance auto-population
- Public `/research` and `/framework` content surfaces with draft-consultation status per section
- Minimal public shell and policy-grade theme (white/slate/saffron-teal) with LLM-generated consultation summary per published version
- First-class Milestone entity with SHA256 hashing of versions/workshops/evidence/milestones
- Cardano preview-net anchoring of every published version and completed milestone (Mesh SDK + Blockfrost)
- Stakeholder engagement tracking (last-activity + engagement score) with admin visibility
- Full cross-phase integration smoke walking the /participate → register → reminders → feedback → CR → merge → version → milestone → hash → Cardano chain end-to-end
- All automation in-code via Inngest (no n8n, Zapier, Tally, Airtable); only external dependencies are cal.com (scheduling), Groq (LLM), Blockfrost (Cardano), Clerk (auth)

## Requirements

### Validated

Shipped in milestone v0.1 (11 core phases + 2 fix/consolidation phases). See `.planning/phases/*/` for verification records and `.planning/v0.1-MILESTONE-AUDIT.md` for the milestone audit.

- ✓ Clerk phone auth, default-deny RBAC across 7 roles, partitioned audit log (v0.1 Phase 1)
- ✓ Policy documents with stable section UUIDs, markdown import, Tiptap block storage (v0.1 Phase 2)
- ✓ Tiptap block editor with slash commands, drag handle, media (v0.1 Phase 3)
- ✓ Structured feedback (FB-NNN) with XState lifecycle, mandatory rationale, section scoping, anonymity, evidence (v0.1 Phase 4)
- ✓ Change Requests (CR-NNN) with XState lifecycle, atomic merge → new version, feedback back-linking (v0.1 Phase 5)
- ✓ Semantic versioning, changelog, word-level section diff, publish, immutable snapshots (v0.1 Phase 6)
- ✓ Traceability matrix (FB → CR → Section → Version) with filter panel and CSV/PDF export (v0.1 Phase 7)
- ✓ Role-aware dashboards (7 roles), in-app notifications, Resend email (v0.1 Phase 8)
- ✓ Public `/portal` read-only published policies, changelog, consultation summary (aggregate counts), PDF export, audit viewer, evidence pack ZIP (v0.1 Phase 9)
- ✓ Workshop module with artifacts, section/feedback links, Claims Without Evidence view (v0.1 Phase 10 + 12 fix)
- ✓ UX consolidation: breadcrumbs, PolicyTabBar, consolidated `/feedback` views, workshop cross-nav, r2-upload rename (v0.1 Phase 13)

### Active

**Collab rollback (Phase 14)**
- [ ] Remove Yjs/Hocuspocus/inline comments and drop associated schema
- [ ] Verify single-user block editor still works with auto-save fallback

**Stale verification closeout (Phase 15)**
- [ ] Re-verify Phase 4 FeedbackDetailSheet wiring after Phase 13 consolidation
- [ ] Re-verify Phase 7 traceability nav discoverability after PolicyTabBar
- [ ] Fix Phase 9 auditor dashboard Export Evidence Pack button to open dialog

**Automation pipeline (Phases 16–18)**
- [ ] Flow 5 end-to-end smoke test (feedback.decide → Inngest → notification + email + auto-draft CR)
- [ ] Migrate all `createNotification(...).catch(...)` callsites to `notification.create` Inngest event
- [ ] Workshop lifecycle status machine (upcoming/in_progress/completed/archived)
- [ ] Workshop evidence checklist auto-creation with 72h and 7d moderator nudges
- [ ] Workshop recording → Whisper transcription → llama summary via Groq (human-reviewed before publish)
- [ ] Async evidence pack export via Inngest with R2 binaries and presigned-GET email delivery

**Public consultation surface (Phases 19–21)**
- [ ] Public `/participate` form with Cloudflare Turnstile and Clerk-invite auto-register
- [ ] `participateIntake` Inngest fn with role-tailored welcome emails
- [ ] Public `/workshops` listing and `/workshops/[id]/register` cal.com embed
- [ ] Cal.com webhook handler creating workshopRegistrations + Clerk-inviting new users
- [ ] Attendance auto-populated from cal.com BOOKING_COMPLETED webhook
- [ ] Post-workshop feedback link emailed to attendees (back-links to workshop via workshopFeedbackLinks)
- [ ] Public `/research` content page (executive summary, Indian landscape, gap clusters, download)
- [ ] Public `/framework` draft consultation surface (per-section status: Draft/Under Review/Validated, what-changed log)
- [ ] LLM-generated prose consultation summary (llama-3.3-70b) cached in `documentVersions.consultationSummary`, regenerated automatically on every version.published
- [ ] Policy-grade theme (white/slate/saffron or teal accent, document cards not startup cards)

**Verification layer (Phases 22–23)**
- [ ] First-class `milestones` entity with required-slot definitions and readiness state
- [ ] SHA256 hashing service covering policyVersion, workshop, evidenceBundle, milestone
- [ ] Cardano preview-net anchoring via Mesh SDK + Blockfrost
- [ ] `milestoneReady` Inngest fn: hash → metadata JSON → submit tx → store txHash → Verified State badge
- [ ] Per-version anchoring on every `version.published` event (not just milestones)
- [ ] Public Verified State badges with Cardanoscan preview-net explorer links

**Stakeholder engagement (Phase 24)**
- [ ] `users.lastActivityAt` column updated via tRPC middleware on every mutation
- [ ] Admin dashboard widget listing inactive users
- [ ] Basic engagement score (feedback count + workshop attendance count)

**Integration smoke (Phase 25)**
- [ ] Cross-phase E2E walk: /participate → Clerk invite → workshop register → 48h + 2h reminders fire → workshop complete → checklist nudge → feedback submit → feedback.decide → Inngest → CR → merge → version → milestone ready → SHA256 → Cardano tx → Verified State badge

**Carried from v0.1 Active (still in scope, now delivered under v0.2 phases):**

**Editor & Content**
- [x] Notion-style block editor (drag/drop blocks, slash commands, headings, callouts, tables, toggles) — v0.1
- [ ] ~~Real-time collaborative editing~~ — **DEFERRED to v2** (collab rollback Phase 14)
- [ ] ~~Inline comments on selected text~~ — **DEFERRED to v2** (collab rollback Phase 14)
- [x] Embeds and media support (files, images, rich link previews) — v0.1 (OG preview endpoint still stubbed)
- [x] Policy documents with sections (stable identity across versions) — v0.1
- [x] Markdown import for existing policy content — v0.1
- [x] Section content versioning (section revisions per document version) — v0.1

**Feedback System**
- [ ] Structured feedback submission (FB-XXX) tied to policy sections
- [ ] Feedback types: Issue, Suggestion, Endorsement, Evidence, Question
- [ ] Feedback priority (Low, Medium, High) and impact categories
- [ ] Feedback lifecycle: Submitted → Under Review → Accepted/Partially/Rejected → Closed
- [ ] Decision log with mandatory rationale for accept/reject
- [ ] Anonymity controls (stakeholders choose named or anonymous)
- [ ] Feedback filtering by section, stakeholder type, priority, status, impact

**Change Request Workflow**
- [ ] Create Change Request (CR-XXX) from one or more feedback items
- [ ] CR lifecycle: Drafting → In Review → Approved → Merged → Closed
- [ ] CR links to affected sections and source feedback items
- [ ] CR owner assignment (Policy Lead)
- [ ] Merge CR into new document version with merge summary
- [ ] Full traceability chain: FB → CR → Section → Version

**Versioning & Publishing**
- [ ] Semantic versioning (v0.1, v0.2, etc.)
- [ ] Auto-generated changelog (what changed, why, linked feedback IDs)
- [ ] Diff view between versions (section-level)
- [ ] Archive previous versions (read-only)
- [ ] Publish version to public portal

**RBAC & Access Control**
- [ ] 7 roles: Admin, Policy Lead, Research Lead, Workshop Moderator, Stakeholder, Observer, Auditor
- [ ] Section-level scoping (stakeholders see only assigned sections)
- [ ] Organization-type tagging (Government, Industry, Legal, Academia, Civil Society, Internal)
- [ ] Role-aware dashboard (each role sees relevant content)
- [ ] Auth via provider (Clerk, Auth0, or similar)

**Stakeholder Experience**
- [ ] Invite-based onboarding (email invite → role auto-assigned → select org type → dashboard)
- [ ] "What changed since last visit" indicators
- [ ] Feedback status visibility (stakeholders see how their input was handled)
- [ ] Privacy preferences (public attribution opt-in/opt-out)

**Workshops Module**
- [ ] Create workshop events with metadata (agenda, date, duration, registration link)
- [ ] Workshop artifacts: promo materials, recordings, summaries, attendance
- [ ] Link workshop insights to policy sections
- [ ] Link feedback items to workshops (created during/after sessions)

**Evidence & Documents**
- [ ] Evidence artifact management (files and links)
- [ ] Attach evidence to feedback items and sections
- [ ] "Claims without evidence" view for Research Lead

**Traceability Matrix**
- [ ] Grid view: Feedback → CR → Section → Version with decision rationale
- [ ] Filter by stakeholder type, section, decision outcome
- [ ] Per-section "What changed and why" view
- [ ] Per-stakeholder "Your feedback outcomes" view
- [ ] Export as CSV/PDF

**Public Portal**
- [ ] Read-only public view of published policy versions
- [ ] Public changelog
- [ ] Consultation summaries (sanitized, no stakeholder identities unless opted in)
- [ ] PDF export of published versions

**Audit & Compliance**
- [ ] Immutable audit log (every action: create, update, publish, merge, decision)
- [ ] Milestone evidence pack export (stakeholder list, feedback matrix, version history, workshop evidence)
- [ ] Auditor role: read-only everything + export capabilities

### Out of Scope

- Real-time chat between stakeholders — high complexity, not core to consultation value
- Decision automation — human approval required for all workflow transitions
- Anonymous public commenting — all feedback requires authentication
- Mobile native app — web-first, responsive design
- Multi-tenant workspaces — single workspace first, designed for multi-tenant later
- Paragraph-level anchors — section-level feedback first, text anchors in future version
- AI-assisted policy drafting — not in v1
- **Real-time collaborative editing (Yjs/Hocuspocus)** — deferred to v2 in v0.2 Phase 14. Reason: system userflow must be solid before layering multi-user concurrency; single-user editor with auto-save is sufficient for consultation workflows
- **Inline comments on selected text** — deferred to v2 bundled with collab rollback
- **Presence indicators on editor** — deferred to v2 bundled with collab rollback
- **External automation tools** (n8n, Zapier, Make, Tally, Airtable, Calendly) — replaced by in-code Inngest + tRPC + cal.com webhooks. Automation stays in our stack.
- **LLM-authored policy text** — Groq is used for transcription, summarization, and consultation summaries only. Humans review before anything publishes. No LLM drafting of policy sections.
- **Compound-beta agentic LLM** — not used for v0.2 tasks; direct inference on llama-3.1-8b-instant / llama-3.3-70b-versatile / whisper-large-v3-turbo is cheaper and sufficient
- **Cardano mainnet anchoring** — v0.2 uses preview-net only for verification infrastructure; mainnet cutover is a later decision
- **Expert review packet flow** (Flow 6 from newDoc2) — deferred to v0.3; couples with Milestone entity + framework review state machine
- **Workshop auto-publish of LLM summaries** — human-in-loop review required; moderator approves before summary becomes public
- **Bulk CSV stakeholder import** — auto-creation via /participate and cal.com register covers the common path; bulk import deferred until volume justifies it
- **Landing page `/india-blockchain-policy`** — deferred within v0.2 until system userflow is validated end-to-end; revisit after Phase 25 integration smoke passes

## Context

- Reference documents exist: `platform.md` (full PRD with SQL schema, API design, RBAC model, stakeholder mapping, RACI matrix) and `policydraft.md` (sample blockchain policy framework — first document to import)
- Previous attempt exists but was architecturally flawed: built generic policy CRUD instead of the feedback-to-framework traceability system. 60+ backend issues identified. Starting fresh.
- The platform must support diverse stakeholder types with different sensitivity levels (government officials need anonymity, industry feedback is aggregated, academia can be publicly attributed)
- Workshops are a first-class entity, not an afterthought — they drive stakeholder engagement and produce evidence artifacts
- The Change Request workflow is intentionally modeled after pull requests: feedback drives changes, changes are reviewed and merged into versions
- The platform originally designed for Cardano Catalyst Fund 12 policy work, but is being built as a general-purpose tool for any policy domain

## Constraints

- **Auth**: Use an auth provider (Clerk, Auth0, or similar) — don't build custom JWT auth from scratch
- **Editor**: Must feel like Notion — block-based, slash commands, drag-and-drop, real-time collab
- **Stack**: Research phase will determine optimal stack. Previous app used Next.js + Prisma + PostgreSQL + Tailwind.
- **Privacy**: Stakeholder identity must be protected by default. Public outputs never expose names without explicit opt-in.
- **Traceability**: The FB → CR → Section → Version chain is non-negotiable. Every policy change must be traceable to the feedback that prompted it.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Start fresh instead of fixing old codebase | 60+ backend issues, no state machine, broken workflow, ghost modules. Faster to rebuild than patch. | — Pending |
| Section-level feedback before paragraph anchors | Reduces complexity significantly while still providing meaningful traceability. Anchors can be added later. | — Pending |
| Auth provider instead of custom | Custom JWT auth in old app had critical issues (hardcoded fallbacks, default-allow permissions). Provider eliminates this class of bugs. | — Pending |
| Full CR workflow over lightweight mode | Traceability is the core value. CRs provide the structured link between feedback and version changes. | — Pending |
| Single workspace first, multi-tenant later | Get the core experience right before adding tenant isolation. Schema should be designed to support it. | — Pending |
| Notion-style block editor | Policy documents are complex, structured content. Block editor provides the flexibility needed for headings, tables, callouts, toggles, embeds. | — Pending |
| **v0.2: Drop real-time collab, defer to v2** | v0.1 shipped Yjs/Hocuspocus/inline comments (Phase 11) but the feature added complexity that blocked the bigger goal: public consultation on-ramp + verifiable anchoring. Single-user editor with auto-save is sufficient. Strip the code so it doesn't drag type surface. | — Pending |
| **v0.2: All automation in-code via Inngest** | User directive. External tools (n8n, Tally, Airtable) were the docs' default assumption; we replace them because Inngest already runs in our stack, durable execution works on Vercel serverless, and keeping state in one Postgres is cleaner than syncing to external CRMs. | — Pending |
| **v0.2: Cal.com delegated scheduling** | Workshop registration flow originally spec'd custom ICS + Inngest reminder chain + timezone handling. Cal.com ships all of that as a hosted product with webhooks. Half of Phase 20 deleted; we only handle the webhook + auto-create-user via Clerk invitation. | — Pending |
| **v0.2: Clerk-invite for public auto-registration** | Public `/participate` and workshop register must create real user accounts without going through sign-up flow. Clerk's invitations API creates a user synchronously and sends invite email; our existing webhook reconciles. No separate `leads` table needed. | — Pending |
| **v0.2: Groq direct inference, not compound-beta** | Compound-beta has built-in web search + code execution tools priced higher than direct inference. PolicyDash workloads are summarization + transcription + classification — direct inference on small models is cheaper and sufficient. | — Pending |
| **v0.2: Cardano preview-net first** | Mainnet anchoring requires real ADA and operational rigor. Preview-net delivers the verifiability story without the funding commitment. User provides funded wallet at Phase 23. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-13 — milestone v0.2 (Verifiable Policy OS — Public Consultation & On-Chain Anchoring) started*
