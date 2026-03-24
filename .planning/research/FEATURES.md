# Feature Research

**Domain:** Stakeholder policy consultation platform
**Researched:** 2026-03-25
**Confidence:** HIGH (verified across multiple platform categories and official sources)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any policy consultation platform. Missing these means the product feels broken, not differentiated.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Structured feedback submission** | Every consultation platform (Citizen Space, Decidim, Consul Democracy, EngagementHQ) provides structured ways to submit feedback tied to specific topics or sections. Without this, stakeholders have no meaningful way to participate. | MEDIUM | FB-XXX IDs with types (Issue, Suggestion, Endorsement, Evidence, Question) is already well-scoped in PROJECT.md. Standard in the domain. |
| **Feedback lifecycle management** | Citizen Space, SmartSurvey SmartCE, and Consultation Manager all track feedback from submission through resolution. Stakeholders expect to know what happened to their input. "We Asked, You Said, We Did" is an established pattern (Scottish Government, Northern Ireland, UK local authorities all use it via Citizen Space). | MEDIUM | Submitted -> Under Review -> Accepted/Partially/Rejected -> Closed. The decision log with mandatory rationale is the critical differentiator within this table-stakes feature. |
| **Role-based access control** | Every governance platform (Decidim, Consul Democracy, LEOS, MetricStream, ComplianceBridge) implements RBAC. Policy work involves sensitive content and different participation levels. Without RBAC, the platform is unusable for government stakeholders. | MEDIUM | 7 roles as defined in PROJECT.md is appropriate. Section-level scoping elevates this from basic RBAC to a differentiator (see Differentiators). |
| **Document versioning** | LEOS (EU legislative drafting), LegisPro, Propylon, and every policy management platform (V-Comply, ComplianceBridge, Ruleguard) provide version history. Policy documents are living documents by definition. | MEDIUM | Semantic versioning (v0.1, v0.2) is the right call. The auto-generated changelog linking feedback IDs is a differentiator built on this table-stakes base. |
| **Version comparison / diff view** | LEOS provides annotation-based change tracking. LegisPro has patented change sets. Every document management system with version control offers some form of comparison. Stakeholders and auditors need to see what changed between versions. | HIGH | Section-level diff is the right granularity for v1. Paragraph-level (deferred in PROJECT.md) would add significant complexity for marginal value initially. |
| **Audit trail / immutable log** | Regulatory compliance platforms universally require audit trails (see FDA 21 CFR Part 11, EU Annex 11 patterns). MetricStream, ComplianceBridge, Workiva, and every GRC platform treat this as non-negotiable. Without an audit trail, the platform cannot serve government or regulated industry stakeholders. | MEDIUM | Every action (create, update, publish, merge, decision) logged with who/what/when. Technically straightforward but must be immutable from day one -- retrofitting is painful. |
| **User authentication and invite-based onboarding** | All consultation platforms require authenticated participation. Decidim, Consul Democracy, and Citizen Space all gate participation behind identity verification. Anonymous public commenting is explicitly out of scope (correct decision). | LOW | Auth provider (Clerk/Auth0) handles the hard parts. Invite flow with auto-role-assignment is the platform-specific layer. |
| **Search and filtering** | Decidim uses Elasticsearch. Citizen Space and EngagementHQ provide filtering by topic, status, stakeholder. With potentially hundreds of feedback items per policy document, finding specific feedback is essential. | MEDIUM | Filter by section, stakeholder type, priority, status, impact. Full-text search across feedback content. |
| **Notification system** | Decidim has real-time notifications for followed spaces. Citizen Space notifies participants of consultation outcomes. Stakeholders need to know when their feedback is reviewed, when versions are published, when they are assigned to sections. | LOW | Email + in-app notifications. "What changed since last visit" indicators are a nice UX touch already in PROJECT.md. |
| **Export capabilities** | PDF export of published versions is standard (LEOS, LegisPro, ComplianceBridge). CSV export of feedback data is expected by analysts. Auditors need exportable evidence packs. | MEDIUM | PDF for published versions, CSV for feedback/traceability data. The milestone evidence pack export (stakeholder list, feedback matrix, version history) is a differentiator built on this base. |
| **Public portal for published policies** | Decidim publishes participatory results publicly. Consul Democracy publishes citizen proposals and consultation outcomes. EU "Have Your Say" platform publishes consultation results. Transparency requires a public-facing read-only view. | MEDIUM | Read-only published versions, public changelog, sanitized consultation summaries. Privacy controls are critical -- no stakeholder identities without explicit opt-in. |
| **Rich text / block editor** | LEOS provides rich legislative editing. LegisPro supports structured document authoring. Modern expectation for any content-heavy platform is Notion-level editing quality. | HIGH | This is the highest-complexity table-stakes feature. Block-based editor with slash commands, drag-and-drop, headings, tables, callouts, toggles. Real-time collaboration adds another layer of complexity. |
| **Inline commenting on content** | LEOS has annotation systems. Google Docs normalized inline comments. Notion supports inline discussion. For policy review, commenting on specific content is fundamental. | MEDIUM | Selected-text comments tied to sections. Must handle comment threads, resolution status. |

### Differentiators (Competitive Advantage)

Features that set PolicyDash apart from generic consultation platforms (Decidim, Consul Democracy) and generic policy management tools (ComplianceBridge, V-Comply). These align directly with the core value: "Every piece of stakeholder feedback is traceable from submission through to the policy version it influenced."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Full feedback-to-version traceability chain (FB -> CR -> Section -> Version)** | No existing platform provides end-to-end traceability from individual feedback items through change requests to specific section changes in specific versions. Decidim tracks proposals to results but not at this granularity. Citizen Space's "We Asked, You Said, We Did" is a reporting pattern, not a structural data model. LEOS tracks document changes but not the stakeholder feedback that drove them. This is PolicyDash's core differentiator. | HIGH | This is the architectural backbone. The CR workflow (modeled after pull requests) is what makes this possible. Every link in the chain must be a first-class data relationship, not a text annotation. |
| **Change Request workflow (PR-style merging)** | No consultation platform uses a pull-request-style workflow for incorporating feedback into policy versions. Decidim has proposals that can become results, but lacks the structured review-and-merge cycle. Legislative drafting tools (LEOS, LegisPro) have collaborative editing but not feedback-driven change management. This bridges the gap between consultation platforms and software engineering workflows. | HIGH | CR lifecycle: Drafting -> In Review -> Approved -> Merged -> Closed. CRs link to source feedback items and affected sections. Merge creates a new version with merge summary. This is where the "git for policy" metaphor lives. |
| **Decision log with mandatory rationale** | SmartSurvey turns responses into "trackable actions" but doesn't require rationale. Citizen Space reports on outcomes but the decision-making process is opaque. Requiring mandatory rationale for accept/reject/partial decisions is rare in consultation platforms. This is what makes accountability real, not performative. | MEDIUM | Every feedback disposition (accepted, partially accepted, rejected) must include a rationale field. This feeds the traceability matrix and "Your feedback outcomes" stakeholder view. |
| **Section-level access scoping** | Standard RBAC controls who can do what. Section-level scoping controls who can see what. This is rare in consultation platforms -- Decidim scopes by participatory space, not by content section. For policy work where stakeholders are experts in specific domains, showing only relevant sections reduces noise and protects sensitive content. | MEDIUM | Stakeholders assigned to specific sections see only those sections. This is more granular than Decidim's space-level scoping or Consul Democracy's topic-level organization. |
| **Per-stakeholder outcome view ("Your feedback outcomes")** | Citizen Space's "We Asked, You Said, We Did" is organization-level. PolicyDash's per-stakeholder view shows each individual exactly how their specific feedback items were handled -- accepted, rejected with rationale, or incorporated into which version. This closes the feedback loop at the individual level, not just the aggregate. | MEDIUM | Filtered view of the traceability matrix scoped to a single stakeholder's submissions. Shows FB -> decision -> rationale -> version impact for each of their feedback items. |
| **Workshop-as-first-class-entity** | Decidim has meetings as a component but treats them as scheduling tools. Consultation Manager tracks events but separates them from feedback. PolicyDash treating workshops as first-class objects with artifacts (recordings, summaries, attendance), linked insights, and feedback provenance is uncommon. This recognizes that much policy feedback originates in workshops, not forms. | MEDIUM | Workshop events with metadata, artifacts management, insight-to-section linking, feedback-to-workshop provenance. Bridges the gap between event management and consultation management. |
| **Evidence artifact management** | Policy management platforms handle documents but don't distinguish "evidence" as a category linked to claims. Research tools separate evidence from opinions. The "Claims without evidence" view for Research Leads is a novel feature that surfaces unsupported assertions in feedback. | LOW | Evidence objects (files, links) attached to feedback items and sections. The "claims without evidence" analytical view is the differentiating lens. |
| **Traceability matrix with multi-dimensional filtering** | No existing consultation platform provides a grid view of FB -> CR -> Section -> Version with decision rationale, filterable by stakeholder type, section, and decision outcome. This is the "audit dashboard" that makes the platform's core value tangible and inspectable. | HIGH | Grid/table view with cross-cutting filters. Per-section "What changed and why" view. Export as CSV/PDF for auditors. This is the most visible manifestation of the traceability architecture. |
| **Milestone evidence pack export** | GRC platforms (Drata, ZenGRC) export compliance evidence packs, but consultation platforms don't. A one-click export that bundles stakeholder lists, feedback matrices, version histories, workshop evidence, and decision logs into a structured package is valuable for governance reporting. | MEDIUM | Bundles multiple data streams into a single exportable artifact. Useful for funders, oversight bodies, and compliance reviews. |
| **Anonymity controls with attribution flexibility** | Most platforms are all-or-nothing on identity. PolicyDash's stakeholder-controlled privacy (choose named or anonymous, opt in/out of public attribution) with different defaults per stakeholder type (government officials default anonymous, academia default named) is nuanced and reflects real consultation dynamics. | MEDIUM | Privacy preferences per stakeholder. Consultation summaries sanitize identities unless opted in. Aggregation by organization type without exposing individuals. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem valuable but would undermine PolicyDash's core value proposition, add disproportionate complexity, or conflict with the governed workflow model.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time chat / messaging between stakeholders** | "Stakeholders need to discuss feedback with each other." | Moves discussion off the structured feedback record. Creates shadow conversations that undermine traceability. Chat history is hard to audit. Decidim deliberately uses threaded comments rather than real-time chat. High implementation complexity (WebSockets, message persistence, moderation). | Use threaded comments on feedback items and sections. All discussion is contextual, auditable, and tied to specific content. Already in PROJECT.md as out of scope -- correct decision. |
| **AI-assisted policy drafting** | "AI can help write better policies." | Undermines the human-deliberative nature of policy consultation. Attribution becomes murky (who authored this -- AI or a stakeholder?). Audit trail integrity is compromised. Regulatory and government stakeholders may distrust AI-generated content. | Keep AI out of content generation in v1. Could later add AI-assisted summarization of feedback (not drafting) as a separate, clearly-labeled feature. Already out of scope in PROJECT.md -- correct decision. |
| **Decision automation / auto-approval workflows** | "Speed up the review process by auto-approving low-impact feedback." | Removes human accountability from the decision chain. The mandatory rationale for every decision is a core differentiator. Automated decisions undermine trust in the consultation process. Government stakeholders require human sign-off. | Keep all workflow transitions requiring human approval. Provide smart defaults and batch operations to speed up the process without removing human judgment. Already out of scope -- correct decision. |
| **Anonymous public commenting (no auth required)** | "Lower the barrier to participation." | Destroys feedback quality. Enables spam and bad-faith participation. Makes traceability impossible -- can't trace feedback to a stakeholder type if there is no identity. Every serious consultation platform (Decidim, Citizen Space, Consul Democracy) requires authentication. | Require authentication but make anonymity a choice within the authenticated system. Stakeholders can choose to be anonymous to other stakeholders while remaining identifiable to admins for accountability. Already out of scope -- correct decision. |
| **Free-form unstructured feedback** | "Let stakeholders write whatever they want without categories." | Unstructured feedback is expensive to triage, impossible to aggregate, and hard to trace. The structured types (Issue, Suggestion, Endorsement, Evidence, Question) exist to make feedback actionable. Citizen Space and EngagementHQ both use structured response formats. | Maintain structured feedback types. The "Evidence" and "Question" types cover edge cases that might otherwise lead to free-form submissions. |
| **Paragraph-level text anchoring (in v1)** | "Feedback should be anchored to specific paragraphs, not just sections." | Significantly increases editor complexity. Anchors break when text is edited (the "moving target" problem). Section-level feedback provides meaningful granularity without the technical debt. Can be added later as an enhancement. | Section-level feedback first (as planned in PROJECT.md). Design the data model to support finer granularity later. Inline comments on selected text within a section provide a middle ground. |
| **Multi-tenant workspaces (in v1)** | "Multiple organizations should be able to run consultations on the same instance." | Tenant isolation adds complexity to every query, every permission check, every export. Getting the core single-workspace experience right is more important. Can be designed for but not built yet. | Single workspace first, with schema designed for multi-tenant later (as planned in PROJECT.md). Tenant isolation can be a future monetization vector. |
| **Native mobile app** | "Stakeholders should be able to review policies on their phones." | Policy documents are complex, structured content. Mobile-first UX for block editors is poor. The reading experience can be responsive, but the editing and feedback workflows need desktop-class UI. | Responsive web design that provides good reading and basic feedback submission on mobile, but optimizes the full editing/review experience for desktop. Already out of scope -- correct decision. |
| **Real-time co-editing of feedback items** | "Multiple stakeholders should collaborate on feedback together." | Feedback items represent individual stakeholder perspectives. Collaborative feedback blurs attribution and makes the traceability chain ambiguous (whose feedback is it?). | One stakeholder per feedback item. Stakeholders can endorse others' feedback (the Endorsement type) rather than co-authoring it. |
| **Sentiment analysis / NLP on feedback** | "Automatically categorize feedback as positive/negative." | Sentiment analysis is unreliable on policy text (nuanced, technical language). False categorizations undermine trust. The structured feedback types already serve the categorization purpose. | Use the explicit feedback types and priority levels. Human triage (Under Review) provides more reliable categorization than NLP. Could be a v2+ experiment after the core feedback loop is proven. |

## Feature Dependencies

```
[Auth & RBAC]
    |
    +--requires--> [User Roles & Permissions]
    |                   |
    |                   +--requires--> [Section-Level Scoping]
    |                   |
    |                   +--requires--> [Role-Aware Dashboards]
    |
    +--requires--> [Invite-Based Onboarding]

[Block Editor]
    |
    +--requires--> [Policy Document Model with Sections]
    |                   |
    |                   +--requires--> [Section Content Versioning]
    |                   |                   |
    |                   |                   +--requires--> [Document Versioning (v0.1, v0.2)]
    |                   |                   |                   |
    |                   |                   |                   +--requires--> [Version Diff View]
    |                   |                   |                   |
    |                   |                   |                   +--requires--> [Auto-Generated Changelog]
    |                   |                   |                   |
    |                   |                   |                   +--requires--> [Public Portal]
    |                   |                   |
    |                   |                   +--enhances--> [Traceability Matrix]
    |                   |
    |                   +--requires--> [Inline Comments]
    |
    +--requires--> [Real-Time Collaboration]

[Structured Feedback Submission]
    |
    +--requires--> [Auth & RBAC] (stakeholder must be authenticated)
    |
    +--requires--> [Policy Document Model with Sections] (feedback targets a section)
    |
    +--requires--> [Feedback Lifecycle Management]
    |                   |
    |                   +--requires--> [Decision Log with Rationale]
    |                   |
    |                   +--enhances--> [Per-Stakeholder Outcome View]
    |                   |
    |                   +--enhances--> [Notification System]
    |
    +--requires--> [Anonymity Controls]

[Change Request Workflow]
    |
    +--requires--> [Structured Feedback Submission] (CRs created from feedback)
    |
    +--requires--> [Policy Document Model with Sections] (CRs target sections)
    |
    +--requires--> [Document Versioning] (merge creates new version)
    |
    +--enhances--> [Traceability Matrix]

[Traceability Matrix]
    |
    +--requires--> [Structured Feedback Submission]
    |
    +--requires--> [Change Request Workflow]
    |
    +--requires--> [Document Versioning]
    |
    +--enhances--> [Milestone Evidence Pack Export]
    |
    +--enhances--> [Audit Trail]

[Workshop Module]
    |
    +--requires--> [Auth & RBAC]
    |
    +--enhances--> [Structured Feedback Submission] (feedback linked to workshops)
    |
    +--enhances--> [Evidence Artifact Management]

[Evidence Artifact Management]
    |
    +--requires--> [Structured Feedback Submission]
    |
    +--enhances--> [Traceability Matrix]
```

### Dependency Notes

- **Auth & RBAC is foundational:** Everything depends on knowing who the user is and what they can do. Must be built first.
- **Block Editor and Document Model are co-dependent:** The editor renders the document model. Sections with stable identity across versions are the anchoring concept for feedback, change requests, and traceability. This is the second foundational layer.
- **Feedback Submission requires both Auth and Document Model:** A stakeholder must be authenticated, and feedback must target a section that exists within a document.
- **Change Request Workflow requires Feedback AND Versioning:** CRs are created from feedback items and produce new document versions when merged. Both must exist before CRs are meaningful.
- **Traceability Matrix is a read layer over everything else:** It does not produce data -- it visualizes the relationships between feedback, CRs, sections, and versions. It requires all of those to exist first.
- **Workshop Module and Evidence Management are enhancers:** They enrich the feedback system but are not prerequisites for the core consultation workflow. Can be built in a later phase without blocking the core loop.
- **Public Portal requires Document Versioning:** You can only publish a version if versioning exists. Also requires privacy/anonymity controls to sanitize stakeholder data.
- **Real-Time Collaboration enhances the Block Editor:** The editor must work for single users first. Adding real-time collaboration (CRDT/OT) is a significant complexity multiplier that can be layered on.

## MVP Definition

### Launch With (v1)

The minimum viable product that validates the core value proposition: feedback-to-version traceability.

- [ ] **Auth with RBAC (7 roles)** -- Without roles, you cannot separate Policy Leads from Stakeholders from Auditors
- [ ] **Policy document model with sections** -- Sections are the anchoring unit for feedback, CRs, and versioning
- [ ] **Block editor (single-user first)** -- Must be Notion-quality for policy content authoring; real-time collab can follow
- [ ] **Structured feedback submission (FB-XXX)** -- The input side of the core loop
- [ ] **Feedback lifecycle with decision log** -- The processing side; mandatory rationale for every disposition
- [ ] **Change Request workflow (CR-XXX)** -- The bridge between feedback and version changes
- [ ] **Document versioning with changelog** -- The output side; versions capture what changed and why
- [ ] **Section-level diff view** -- Auditors and stakeholders need to see what changed between versions
- [ ] **Anonymity controls** -- Government stakeholders will not participate without identity protection
- [ ] **Traceability matrix (basic view)** -- The proof that the core value works; FB -> CR -> Section -> Version
- [ ] **Audit trail (immutable log)** -- Must be present from day one; cannot be retrofitted
- [ ] **Invite-based onboarding** -- Controlled access; stakeholders are invited, not self-registering
- [ ] **Notification system (basic)** -- Email notifications for feedback status changes, version publications
- [ ] **Section-level access scoping** -- Stakeholders see only assigned sections
- [ ] **Role-aware dashboards** -- Each role gets a relevant landing page

### Add After Validation (v1.x)

Features to add once the core feedback-to-version loop is working and validated with real users.

- [ ] **Real-time collaborative editing** -- Add after the block editor is stable; requires CRDT/OT infrastructure
- [ ] **Workshop module** -- Add when running first real stakeholder workshops; needs event management + artifact linking
- [ ] **Evidence artifact management** -- Add when stakeholders start attaching supporting documents to feedback
- [ ] **Public portal** -- Add when first policy version is ready for public consumption
- [ ] **Per-stakeholder outcome view** -- Add when enough feedback has been processed to make the view meaningful
- [ ] **Milestone evidence pack export** -- Add when first governance reporting cycle needs it
- [ ] **Inline comments on selected text** -- Enhances the review experience after basic feedback submission is proven
- [ ] **"What changed since last visit" indicators** -- Quality-of-life feature after core workflow is established
- [ ] **PDF export of published versions** -- Add alongside public portal
- [ ] **CSV export of traceability data** -- Add when auditors request it

### Future Consideration (v2+)

Features to defer until the product has proven its consultation workflow with real stakeholders.

- [ ] **Multi-tenant workspaces** -- Defer until single-workspace model is validated; design schema for it now
- [ ] **Paragraph-level text anchoring** -- Defer until section-level feedback limitations are validated by user pain
- [ ] **AI-assisted feedback summarization** -- Defer until there is enough feedback data to make summarization useful; clearly label as AI-generated
- [ ] **Advanced analytics (engagement metrics, response rates, demographic breakdowns)** -- Defer until there is enough usage data
- [ ] **API for third-party integrations** -- Defer until external tools need to connect
- [ ] **Markdown import for existing policy content** -- Nice to have for migration; not critical for new consultations
- [ ] **Sortition / random stakeholder selection for review panels** -- Decidim has this; relevant for large-scale consultations

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Auth with RBAC (7 roles) | HIGH | MEDIUM | P1 |
| Policy document model with sections | HIGH | MEDIUM | P1 |
| Block editor (Notion-style) | HIGH | HIGH | P1 |
| Structured feedback submission | HIGH | MEDIUM | P1 |
| Feedback lifecycle + decision log | HIGH | MEDIUM | P1 |
| Change Request workflow | HIGH | HIGH | P1 |
| Document versioning + changelog | HIGH | MEDIUM | P1 |
| Section-level diff view | HIGH | HIGH | P1 |
| Anonymity controls | HIGH | LOW | P1 |
| Traceability matrix (basic) | HIGH | MEDIUM | P1 |
| Audit trail (immutable) | HIGH | LOW | P1 |
| Invite-based onboarding | MEDIUM | LOW | P1 |
| Section-level access scoping | HIGH | MEDIUM | P1 |
| Role-aware dashboards | MEDIUM | MEDIUM | P1 |
| Notification system (basic) | MEDIUM | LOW | P1 |
| Real-time collaborative editing | MEDIUM | HIGH | P2 |
| Workshop module | MEDIUM | MEDIUM | P2 |
| Evidence artifact management | MEDIUM | LOW | P2 |
| Public portal | MEDIUM | MEDIUM | P2 |
| Per-stakeholder outcome view | MEDIUM | MEDIUM | P2 |
| Milestone evidence pack export | MEDIUM | MEDIUM | P2 |
| Inline comments on text | MEDIUM | MEDIUM | P2 |
| PDF/CSV export | MEDIUM | LOW | P2 |
| "What changed since last visit" | LOW | LOW | P2 |
| Multi-tenant workspaces | LOW | HIGH | P3 |
| Paragraph-level text anchoring | LOW | HIGH | P3 |
| AI-assisted summarization | LOW | HIGH | P3 |
| Advanced analytics | LOW | MEDIUM | P3 |
| Third-party API | LOW | MEDIUM | P3 |
| Markdown import | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch -- validates the core feedback-to-version traceability proposition
- P2: Should have, add after core loop is working -- enriches the consultation experience
- P3: Nice to have, future consideration -- expansion features after product-market fit

## Competitor Feature Analysis

| Feature | Decidim | Consul Democracy | Citizen Space | LEOS | PolicyDash (Our Approach) |
|---------|---------|-----------------|---------------|------|---------------------------|
| **Feedback submission** | Proposals, comments, endorsements within participatory spaces | Citizen proposals, debates, comments | Structured survey responses with coding/tagging | Annotations on legislative text | Structured typed feedback (Issue/Suggestion/Endorsement/Evidence/Question) tied to specific policy sections |
| **Feedback-to-outcome traceability** | Proposals can become "results" with progress tracking | Proposals reach vote thresholds for action | "We Asked, You Said, We Did" reporting (narrative, not structural) | Change tracking in document but no feedback linkage | Full structural chain: FB -> CR -> Section -> Version with mandatory rationale at every decision point |
| **Change management workflow** | Proposals -> Amendments -> Results (loose coupling) | Proposals -> Voting -> Implementation (binary) | No structured change workflow | Co-editing with version control (no feedback-driven workflow) | PR-style Change Requests: Drafting -> In Review -> Approved -> Merged -> Closed, explicitly linked to source feedback |
| **Document versioning** | No document versioning (process-based, not document-based) | No document versioning | No document versioning (survey-based) | Full version control with Akoma Ntoso XML | Semantic versioning per document with section-level revisions, auto-generated changelog |
| **Version diff** | N/A | N/A | N/A | XML-based diff | Section-level diff between any two versions |
| **Rich text editing** | Basic rich text in proposals | Basic rich text | Survey/form builder | Legislative XML editor (specialized) | Notion-style block editor with slash commands, drag-and-drop, tables, callouts, toggles |
| **RBAC** | Admin, participants, moderators per space | Admin, moderators, users | Admin, authors, respondents | Authors, co-editors, reviewers | 7 roles with section-level scoping: Admin, Policy Lead, Research Lead, Workshop Moderator, Stakeholder, Observer, Auditor |
| **Privacy / anonymity** | Public by default; some anonymous features | Public participation | Anonymous survey options | Internal collaboration (not public-facing) | Stakeholder-controlled privacy with per-type defaults; public attribution opt-in/opt-out |
| **Workshop / events** | Meetings component with scheduling, minutes | Community events | No event management | No event management | First-class workshop entity with artifacts, insight linking, feedback provenance |
| **Evidence management** | No dedicated evidence model | No dedicated evidence model | No dedicated evidence model | No dedicated evidence model | Evidence artifacts attached to feedback and sections; "Claims without evidence" analytical view |
| **Audit trail** | Action logs (admin-level) | Basic logging | Consultation audit trail | Version history | Immutable audit log covering every action with who/what/when; auditor role with read-only access + export |
| **Public portal** | Public participatory spaces | Public citizen proposals and budgets | Published consultation results | N/A (internal tool) | Read-only published versions with public changelog and sanitized consultation summaries |
| **Export** | Open data exports | Open data | Consultation reports | XML/PDF export | PDF versions, CSV traceability data, milestone evidence pack bundles |

### Key Competitive Insight

No existing platform occupies the intersection where PolicyDash sits:

- **Civic participation platforms** (Decidim, Consul Democracy) are designed for broad citizen engagement (thousands of participants, simple proposals, voting). They lack document-centric workflows, structured change management, and fine-grained traceability.
- **Legislative drafting tools** (LEOS, LegisPro, Propylon) are document-centric but treat feedback as annotations, not as structured objects with lifecycles. They have no stakeholder management or consultation workflow.
- **Public consultation tools** (Citizen Space, EngagementHQ, SmartSurvey) are survey-oriented. They collect feedback well but have no concept of change requests, version merging, or structural traceability.
- **Policy management platforms** (ComplianceBridge, V-Comply, MetricStream) focus on internal policy lifecycle (draft, review, approve, distribute) but have no external stakeholder consultation model.
- **Stakeholder management tools** (Simply Stakeholders, Tractivity, Consultation Manager, Jambo) track relationships and interactions but have no document editing, version control, or structured feedback workflow.

PolicyDash's unique position is: **a document-centric consultation platform with PR-style change management and end-to-end feedback traceability**. It combines the structured editing of legislative drafting tools, the stakeholder engagement of consultation platforms, and the workflow discipline of software engineering (pull requests, merge, version control).

## Sources

- [Decidim Features](https://decidim.org/features/) -- Official feature list for the leading open-source participatory democracy platform
- [Consul Democracy](https://consuldemocracy.org/) -- Open-source civic engagement platform used by 100+ institutions in 35 countries
- [Citizen Space by Delib](https://www.delib.net/citizen_space) -- UK government consultation platform with "We Asked, You Said, We Did" pattern
- [EngagementHQ by Granicus](https://granicus.com/product/engagementhq/) -- Community engagement platform with sentiment analysis
- [LEOS - EU Legislative Editing Software](https://interoperable-europe.ec.europa.eu/collection/justice-law-and-security/solution/leos-open-source-software-editing-legislation) -- Open-source collaborative legislative drafting
- [LegisPro by Xcential](https://xcential.com/legispro/drafting/) -- Legislative drafting with patented change sets
- [Propylon Drafting](https://propylon.com/drafting/) -- Legislative authoring and collaboration
- [Simply Stakeholders](https://simplystakeholders.com/) -- Stakeholder relationship management platform
- [Tractivity](https://www.tractivity.co.uk) -- UK stakeholder management software
- [Consultation Manager](https://www.consultationmanager.com/) -- Stakeholder engagement for government
- [SmartSurvey SmartCE](https://www.smartsurvey.com/solutions/citizen-engagement) -- UK sovereign consultation platform with action tracking
- [Scottish Government Citizen Space](https://consult.gov.scot/we_asked_you_said/) -- "We Asked, You Said, We Did" implementation
- [PolicyEngine](https://www.policyengine.org/) -- Policy impact simulation (different domain -- tax/benefit microsimulation, not consultation)
- [Best Citizen Engagement Software for 2026](https://research.com/software/best-citizen-engagement-software) -- Market overview
- [ComplianceBridge](https://compliancebridge.com/products/policy-management-software/) -- Policy management software
- [Digital Regulation Platform - Collaborative Governance](https://digitalregulation.org/collaborative-governance/) -- Framework for collaborative regulatory governance

---
*Feature research for: Stakeholder policy consultation platform*
*Researched: 2026-03-25*
