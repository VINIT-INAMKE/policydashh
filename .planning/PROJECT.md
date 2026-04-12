# PolicyDash

## What This Is

A stakeholder policy consultation platform where organizations create policy documents, gather structured feedback from diverse stakeholders (government, industry, legal, academia, civil society), manage change requests through a governed workflow, and publish versioned policies with full feedback-to-framework traceability. The platform provides a Notion-like editing experience with real-time collaboration, role-based access control with section-level scoping, and a public portal for published policy documents.

## Core Value

Every piece of stakeholder feedback is traceable from submission through to the policy version it influenced — or recorded with rationale for why it wasn't adopted. Nothing gets lost, everything is accountable.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Editor & Content**
- [ ] Notion-style block editor (drag/drop blocks, slash commands, headings, callouts, tables, toggles)
- [ ] Real-time collaborative editing (multiple simultaneous editors)
- [ ] Inline comments on selected text
- [ ] Embeds and media support (files, images, rich link previews)
- [ ] Policy documents with sections (stable identity across versions)
- [ ] Markdown import for existing policy content
- [ ] Section content versioning (section revisions per document version)

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
*Last updated: 2026-04-12 after Phase 13 (UX Consolidation & Navigation) — milestone v0.1 complete*
