### 🧭Stakeholder Mapping

**Crafting Blockchain Policy Framework for India**

---

## 1️⃣ Government & Regulators (High Influence, High Priority)

| Stakeholder | Likely Role | Why They Matter | Framework Sections |
| --- | --- | --- | --- |
| Ministry of Electronics and Information Technology | Digital policy owner | IT Act, DPDP Act, digital governance | §§2, 5, 8 |
| Ministry of Finance | Fiscal & financial policy | Crypto legality, taxation | §§4, 6 |
| Reserve Bank of India | Financial stability | Payments, systemic risk | §§4, 6 |
| Securities and Exchange Board of India | Market regulation | Asset classification, investor protection | §§4, 5 |
| Central Board of Direct Taxes | Tax enforcement | Compliance, reporting | §6 |
| NITI Aayog | Strategic policy | Long-term innovation framing | §§2, 7, 9 |

**Portal RBAC suggestion:**

- Role: *Stakeholder (Reviewer)*
- Scope: Read-only + feedback on assigned sections
- Visibility: Other gov feedback anonymized

---

## 2️⃣ Law, Policy & Regulatory Experts (High Insight, Medium Power)

| Stakeholder Type | Example Institutions | Why They Matter | Framework Sections |
| --- | --- | --- | --- |
| Technology law experts | National Law Universities, independent practitioners | Legal defensibility | §§4, 5, 10 |
| Financial regulation experts | Former regulators, consultants | Practical enforcement | §§4, 6 |
| Data protection experts | Privacy lawyers, DPDP specialists | Data governance realism | §5 |
| Public policy think tanks | CPR, ORF, Vidhi | Policy coherence | §§3, 8 |

**Portal RBAC suggestion:**

- Role: *Stakeholder (Reviewer)*
- Scope: Comment + evidence upload
- Visibility: Named feedback allowed (opt-in)

---

## 3️⃣ Blockchain Protocols & Infrastructure Providers (High Practical Signal)

| Stakeholder Type | Example Entities | Why They Matter | Framework Sections |
| --- | --- | --- | --- |
| L1 / L2 protocols | Cardano, Ethereum ecosystem orgs | Infrastructure realities | §§4, 7 |
| Developer tooling | Indexing, wallets, infra providers | Custody & security | §5 |
| Open-source foundations | Protocol foundations | Governance models | §§7, 8 |

**Portal RBAC suggestion:**

- Role: *Stakeholder (Reviewer)*
- Scope: Section-specific feedback only
- Visibility: Industry feedback anonymized in public exports

---

## 4️⃣ Indian Startups & Web3 Enterprises (Ground Reality)

| Stakeholder Type | Why They Matter | Framework Sections |
| --- | --- | --- |
| Crypto exchanges (India-facing) | Compliance + consumer protection | §§4, 5, 6 |
| Enterprise blockchain startups | Non-speculative use cases | §§2, 7 |
| Wallet & custody providers | User risk & responsibility | §5 |
| Analytics & compliance firms | Enforcement feasibility | §§6, 8 |

**Portal RBAC suggestion:**

- Role: *Stakeholder (Reviewer)*
- Scope: Feedback + workshop participation
- Visibility: Aggregated insights only

---

## 5️⃣ Academia & Research Institutions (Long-term Signal)

| Stakeholder | Why They Matter | Framework Sections |
| --- | --- | --- |
| IITs / IISc researchers | Technical grounding | §§2, 5 |
| Policy research centres | Evidence-based policy | §§3, 10 |
| Economics & law faculties | Impact analysis | §§6, 10 |

**Portal RBAC suggestion:**

- Role: *Observer / Reviewer*
- Scope: Read + comment
- Visibility: Public attribution allowed

---

## 6️⃣ Civil Society & Consumer Interest Groups (Legitimacy)

| Stakeholder Type | Why They Matter | Framework Sections |
| --- | --- | --- |
| Digital rights orgs | Consumer & privacy protection | §5 |
| Financial inclusion groups | Equity & access | §§3, 7 |
| Public-interest NGOs | Trust & legitimacy | §§7, 10 |

**Portal RBAC suggestion:**

- Role: *Stakeholder (Reviewer)*
- Scope: Consumer protection sections only
- Visibility: Named or anonymized (choice-based)

---

## 7️⃣ International & Comparative Policy Observers (Advisory Only)

| Stakeholder | Why They Matter | Framework Sections |
| --- | --- | --- |
| Global policy experts | Comparative insight | §§3, 9 |
| Multilateral advisors | Standards alignment | §§8, 9 |

**Portal RBAC suggestion:**

- Role: *Observer*
- Scope: Read-only
- Visibility: None in public outputs

---

## 8️⃣ Minimum Catalyst-Ready Stakeholder Set (15+)

You can safely hit **≥15** with:

- 5 government/regulators
- 4 legal/policy experts
- 3 industry/startups
- 2 academia
- 1 civil society

This also gives you **coverage across all framework sections**.

---

## 9️⃣ Stakeholder → Workshop Mapping

| Workshop | Stakeholder Mix |
| --- | --- |
| **Workshop 1: Crypto Legality** | Finance Ministry, RBI, SEBI, legal experts, exchanges |
| **Workshop 2: Data & Custody** | MeitY, privacy experts, wallet/custody providers |
| **Workshop 3: Tax & Innovation** | CBDT, startups, think tanks, academia |

---

## 10️⃣ Why This Mapping Is Strong

- ✔ Aligns directly to **policy sections**
- ✔ Supports **RBAC segmentation**
- ✔ Defensible to **Catalyst reviewers**
- ✔ Scales into your **portal architecture**
- ✔ Avoids over-indexing on any single interest group

---

### Next step I strongly recommend

👉 **Convert this mapping into:**

- Stakeholder invite list (names + orgs)
- RBAC role assignments
- Workshop invitation matrix

If you want, I can:

1. Produce a **stakeholder invite tracker (sheet-ready)**
2. Draft **role-specific invite emails**
3. Create **portal onboarding flows per stakeholder type**

Just tell me which one you want next.

### **Portal design + flow**

---

# 🧩 1. Portal philosophy (important for design decisions)

The portal is **not a document dump**.

It is a **policy co-creation workspace** with:

- **Private-by-default collaboration**
- **Role-aware visibility (RBAC)**
- **Evidence-grade audit trails**
- **Public-facing exports** for accountability

Design principles:

- No stakeholder ever sees *everything*
- No feedback is “lost” or informal
- Every change is attributable, reviewable, and exportable

---

# 🧱 2. Core portal structure (common for all users)

### Global navigation (left rail)

- **Dashboard**
- **Policy Framework**
- **My Feedback / Tasks**
- **Workshops**
- **Traceability**
- **Documents**
- **Public View** (read-only mirror)
- **Settings / Profile**

### Core objects in the system

- **Policy Section** (with paragraph anchors)
- **Feedback Item (FB-XXX)**
- **Change Request (CR-XXX)**
- **Workshop**
- **Evidence Artifact**
- **Version (v0.1, v0.2…)**

Everything links to everything else.

---

# 👥 3. Stakeholder-specific portal flows

This is the most important part.

---

## A. Government / Regulator stakeholder flow

### Who they are

Senior or mid-level officials, cautious with time, sensitive to attribution.

### Onboarding

1. Invite link (email)
2. Role auto-assigned: **Stakeholder – Government**
3. Must select:
    - Ministry / Regulator
    - Policy interest areas (e.g., Crypto legality, Data, Tax)
4. Optional: choose **anonymous attribution** for public outputs

---

### Dashboard view

They see:

- “Sections you’re invited to review”
- “Open questions for regulators”
- Upcoming workshops (with agenda)
- “What changed since last version”

They **do not** see:

- Raw startup complaints
- Other regulator comments (unless anonymized)

---

### How they give input

1. Open **Policy Framework → Section 4**
2. Highlight a paragraph
3. Click **“Provide policy input”**

Feedback form (short, respectful):

- Type:
    - Regulatory concern
    - Clarification needed
    - Alignment confirmation
- Risk area: stability / legality / enforcement
- Comment (free text)
- Priority (Low / Medium / High)

Submit → creates `FB-0XX`

---

### What happens next (visible to them)

- Status badge: *Received → Under Review → Addressed*
- They can see **how** their input was handled (accepted / partially / not adopted)
- They **never** see internal debate, only outcomes

---

## B. Legal & policy expert flow

### Who they are

Lawyers, policy researchers, former regulators.

### Dashboard view

- Sections assigned to them
- Open legal questions
- Requests for evidence / citations

---

### How they contribute

They can:

- Submit feedback
- Upload legal references
- Comment on definitions and wording
- Flag *legal risk*

Feedback form includes:

- Legal basis (case law / statute / principle)
- Risk severity
- Suggested alternative language (optional)

---

### Extra capability

They can tag feedback as:

- “High legal risk if ignored”

This flag is visible to:

- Policy Lead
- Admin
- Auditor

---

## C. Industry / Startup stakeholder flow

### Who they are

Founders, compliance heads, infra builders.

### Dashboard view

- “Where policy impacts operations”
- Compliance pain points
- Upcoming industry-focused workshops

They **do not** see:

- Government comments
- Other startups’ raw feedback

---

### How they give input

Their feedback form emphasizes *practicality*:

- Impact type:
    - Compliance burden
    - Operational ambiguity
    - Innovation blocker
- Real-world example (optional)
- Severity (Low → Blocking)

They can also:

- Vote 👍 on issues raised by others (aggregated, anonymous)

---

### What they get back

- Visibility into whether the framework acknowledges the issue
- No exposure to enforcement discussions
- Clear sense of being heard without over-promising outcomes

---

## D. Academia / civil society flow

### Who they are

Researchers, NGOs, public-interest voices.

### Dashboard view

- Consumer protection sections
- Risk & ethics sections
- Open consultation questions

---

### How they contribute

They can:

- Submit commentary
- Upload research
- Flag equity / inclusion / long-term risk issues

Their feedback is tagged as:

- Normative / Ethical / Long-term

This prevents it from being treated as “compliance noise”.

---

## E. Internal team flow (Policy Lead / Research Lead)

### Policy Lead dashboard

- Feedback inbox (filterable)
- Change Requests in progress
- Section health indicators (unreviewed / contested / stable)

Actions:

- Accept / partially accept / reject feedback
- Convert feedback → Change Request
- Draft revised language
- Request clarifications

---

### Research Lead dashboard

- Evidence repository
- “Claims without evidence”
- Research tasks mapped to sections

They attach:

- Evidence → Feedback → Section

---

## F. Admin / Auditor flow

### Admin

- User & role management
- Publish toggles
- Version releases

### Auditor

- Read-only everything
- Can export:
    - Feedback matrix
    - Change logs
    - Milestone evidence packs

This is what protects you during Catalyst review.

---

# 🔁 4. Feedback → framework traceability flow (step-by-step)

1. Stakeholder submits `FB-042` on `Section 6.3`
2. Policy Lead reviews → marks **Accepted**
3. System creates `CR-018`
4. Draft change applied to Section 6.3
5. CR approved → merged into `v0.2`
6. Traceability automatically records:

```
FB-042 → CR-018 → Section 6.3 → Version v0.2
Decision rationale: clarified tax classification

```

### Traceability views

- Per section: “What changed and why”
- Per stakeholder: “Your feedback outcomes”
- Per milestone: exportable matrix

---

# 🌐 5. Public access (Catalyst-safe)

### Public portal shows:

- Latest policy draft (PDF)
- Research report
- Consultation summaries
- Changelog
- Methodology

### Public portal does NOT show:

- Stakeholder identities (unless opted in)
- Raw feedback threads
- Internal deliberations

This **fully satisfies Catalyst** while preserving trust.

---

# 🧠 Why this portal design is strong

- Policy-grade (not startup gimmicky)
- Respects power asymmetries
- Makes feedback *actionable*
- Produces clean evidence trails
- Scales beyond Catalyst into real governance use

---

### 📄 Product Requirements Document (PRD)

---

**Product:** Stakeholder Policy Consultation Portal

**Project:** Crafting Blockchain Policy Framework for India (Catalyst Fund 12)

**Version:** PRD v1.0

**Owner:** Program Admin (Policy Lead)

**Status:** Ready for build

---

## 1. Problem Statement

Policy drafting for emerging technologies requires **structured stakeholder input**, **controlled visibility**, and **auditable traceability**.

Current tools (public repos, email, documents) fail to:

- Protect sensitive stakeholder inputs
- Attribute feedback to framework sections
- Track how feedback changes policy
- Produce clean evidence for Catalyst reviews

---

## 2. Product Goals

### Primary goals

1. Enable **role-based stakeholder participation (RBAC)**
2. Capture **structured feedback tied to policy sections**
3. Maintain **feedback → change → version traceability**
4. Generate **Catalyst-ready evidence exports**
5. Provide **public access** without exposing sensitive data

### Non-goals

- No real-time co-editing like Google Docs
- No anonymous public commenting
- No decision automation (human approval required)

---

## 3. User Roles (RBAC)

| Role | Description |
| --- | --- |
| Admin | Full system control, publishing |
| Policy Lead | Owns framework, approves changes |
| Research Lead | Owns evidence, research |
| Workshop Moderator | Runs consultations |
| Stakeholder | Provides feedback |
| Observer | Read-only |
| Auditor | Read-only + export |

---

## 4. Core Objects (Data Entities)

- **User**
- **PolicyDocument**
- **PolicySection**
- **SectionAnchor** (paragraph-level)
- **FeedbackItem (FB-XXX)**
- **ChangeRequest (CR-XXX)**
- **Version**
- **Workshop**
- **EvidenceArtifact**
- **AuditLog**

---

## 5. Functional Requirements

### 5.1 Authentication & Access Control

- Email-based login
- Role-based access control (RBAC)
- Section-level access scopes
- Org-type tagging (Gov / Industry / Legal / Academia)

---

### 5.2 Policy Framework Viewer

- Render policy framework by sections
- Stable paragraph anchors
- Version indicator (v0.1, v0.2)
- Diff view between versions (textual)

---

### 5.3 Feedback System (Core)

**Feedback submission must:**

- Be tied to a specific section + anchor
- Capture:
    - Type (Issue / Suggestion / Endorsement / Evidence)
    - Priority
    - Impact category
    - Text input
    - Optional attachments

**Feedback lifecycle states:**

- Submitted
- Under Review
- Accepted / Partially Accepted / Rejected
- Closed

---

### 5.4 Change Request Workflow

- Create CR from one or more feedback items
- Assign owner (Policy Lead)
- Status:
    - Drafting
    - Review
    - Approved
    - Merged
- Merge CR into new version

---

### 5.5 Versioning & Changelog

- Semantic versioning (v0.1 → v0.2)
- Changelog auto-generated:
    - What changed
    - Why (linked feedback IDs)
- Archive previous versions (read-only)

---

### 5.6 Workshops Module

- Create workshop events
- Upload:
    - Agenda
    - Registration link
    - Attendance count
    - Recording
    - Summary
- Link workshop insights to sections

---

### 5.7 Traceability Matrix

- View mapping:
    - Feedback → Change Request → Section → Version
- Filter by:
    - Stakeholder type
    - Section
    - Decision
- Export as CSV / PDF

---

### 5.8 Public Access Layer

- Public page with:
    - Latest policy draft (PDF)
    - Research report
    - Workshop summaries
    - Changelog
- No stakeholder identities exposed

---

### 5.9 Audit & Evidence Export

- Immutable audit logs
- One-click export:
    - Stakeholder list
    - Feedback matrix
    - Version history
    - Workshop evidence
- Catalyst milestone pack

---

## 6. Non-Functional Requirements

- Secure access (HTTPS, auth)
- Read performance optimized (PDF + text)
- Role-based data isolation
- Exportable evidence (PDF/CSV)
- Minimal training required for stakeholders

---

## 7. Success Metrics

- ≥80% stakeholder feedback linked to sections
- Zero feedback without decision rationale
- Ability to generate Catalyst evidence pack in <10 minutes
- Stakeholder completion rate >70%

---

### 👤 User Stories (By Role)

## A. Stakeholder (Government / Industry / Legal)

**US-01**

*As a stakeholder, I want to see only the policy sections relevant to me so I can focus my review.*

**US-02**

*As a stakeholder, I want to submit feedback tied to a specific paragraph so my input is precise.*

**US-03**

*As a stakeholder, I want to see the status of my feedback so I know it was considered.*

**US-04**

*As a stakeholder, I want my identity hidden in public outputs.*

---

## B. Policy Lead

**US-05**

*As a Policy Lead, I want to triage feedback so I can prioritize high-risk issues.*

**US-06**

*As a Policy Lead, I want to convert feedback into change requests.*

**US-07**

*As a Policy Lead, I want to publish a new version with a clear changelog.*

---

## C. Research Lead

**US-08**

*As a Research Lead, I want to attach evidence to sections and feedback.*

**US-09**

*As a Research Lead, I want to see which claims lack evidence.*

---

## D. Workshop Moderator

**US-10**

*As a Moderator, I want to create workshops and upload summaries.*

**US-11**

*As a Moderator, I want workshop insights linked to policy sections.*

---

## E. Admin

**US-12**

*As an Admin, I want to manage users and roles.*

**US-13**

*As an Admin, I want to control what is publicly published.*

---

## F. Auditor / Catalyst Reviewer

**US-14**

*As an Auditor, I want to see a full audit trail.*

**US-15**

*As an Auditor, I want to export milestone evidence.*

---

## 8. MVP vs Phase 2

### MVP (Catalyst-safe)

- RBAC
- Policy viewer
- Feedback + CR workflow
- Versioning
- Public export
- Evidence pack

### Phase 2 (Optional)

- Inline diff editor
- Voting/endorsement
- Analytics dashboards
- Multi-project support

---

## 9. Build Readiness Checklist

- [ ]  PRD approved
- [ ]  Roles finalized
- [ ]  Policy sections imported
- [ ]  Stakeholder list ready
- [ ]  Hosting + auth decided

---

### **RBAC + RACI + UI/UX + traceability**

---

## Portal concept

### Two surfaces

1. **Public Surface (Open Access)**
    - Public landing page
    - “Milestone artifacts” library:
        - Draft policy document PDFs (versioned)
        - Research report PDFs
        - Workshop summaries (sanitized)
        - Changelog
    - This satisfies “publicly accessible” requirements without exposing raw stakeholder data.
2. **Stakeholder Surface (RBAC Workspace)**
    - Invite-only access
    - Stakeholder-specific dashboards, tasks, feedback forms
    - Traceability view (feedback → section → change)

---

## RBAC model

### Core roles (simple, sufficient)

- **Admin (Program Owner)**
    
    Full control: users, roles, publish toggles, approvals.
    
- **Policy Lead (Editor)**
    
    Writes/edits framework content; proposes revisions; responds to feedback.
    
- **Research Lead (Editor)**
    
    Manages evidence, research notes, synthesis; tags sources to sections.
    
- **Workshop Moderator (Operator)**
    
    Creates sessions, registration links, attendance, uploads recordings, creates summaries.
    
- **Stakeholder (Reviewer)**
    
    Can submit feedback, comment on assigned sections, vote/endorse issues, view relevant docs.
    
- **Observer (Read-only)**
    
    Can view selected materials; cannot comment (useful for late additions).
    
- **Auditor (Read-only + export)**
    
    Can view audit trails and export evidence packs (for Catalyst reporting).
    

### Permissions (high level)

| Action | Admin | Policy Lead | Research Lead | Moderator | Stakeholder | Observer | Auditor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Create/edit policy sections | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Propose change request | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Approve merge/publish | ✅ | ✅ (optional) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create workshops | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Submit feedback | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| View traceability & audit | ✅ | ✅ | ✅ | ✅ | Limited | Limited | ✅ |
| Export milestone evidence | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |

**Stakeholder-specific visibility**: add **“Section Scopes”** (e.g., Section 4 only) + **“Organization Scopes”** (Gov/Industry/Legal) so each stakeholder sees only what you want them to.

---

## RACI: role/responsibility/work mapping

### Milestone 1 workstreams

| Workstream | Admin | Policy Lead | Research Lead | Moderator | Stakeholders | Auditor |
| --- | --- | --- | --- | --- | --- | --- |
| Stakeholder list (≥15) | A | C | R | C | I | I |
| Initial research report | A | C | R | I | C | I |
| Workshop planning & invites | A | C | C | R | I | I |
| Workshop execution + evidence | A | I | C | R | C | I |
| Feedback synthesis | A | C | R | C | C | I |
| Publish public artifacts | A | R | R | R | I | C |

### Milestone 2 workstreams

| Workstream | Admin | Policy Lead | Research Lead | Moderator | Stakeholders | Auditor |
| --- | --- | --- | --- | --- | --- | --- |
| Draft policy framework (≥15 pages) | A | R | C | I | C | I |
| Consultations (2 sessions) | A | C | C | R | C | I |
| Incorporate feedback (≥10 stakeholders) | A | R | C | I | C | I |
| Versioning + changelog | A | R | C | I | I | C |
| Evidence pack export | A | C | C | C | I | R |

Legend: **R** Responsible, **A** Accountable, **C** Consulted, **I** Informed

---

## UI/UX flow (clean, minimal clicks)

### 1) Stakeholder onboarding

- Invite link → accept → select org type (Gov/Industry/Legal/Academia) → NDA/consent checkbox (optional) → landing dashboard
- Dashboard shows:
    - Assigned sections (e.g., “Section 4: Crypto Legality”)
    - Pending feedback requests
    - Upcoming workshops
    - “What changed since last visit”

### 2) Feedback submission (the heart)

From a section page, stakeholder clicks **“Give feedback”**:

- Choose feedback type:
    - ✅ Issue / risk
    - ✅ Suggestion
    - ✅ Evidence / reference
    - ✅ Agreement / endorsement
- Required fields (tight)
    - **Section** (auto-filled)
    - **Claim being challenged** (select paragraph/anchor)
    - **Feedback statement**
    - **Priority** (High/Med/Low)
    - **Impact** (Policy risk / Compliance / Consumer harm / Innovation / Clarity)
    - **Suggested change** (optional)
    - **Evidence** (link/upload)
- Submit → gets a **Trace ID** (e.g., FB-042)

### 3) Triage + decision

Policy Lead sees **Feedback Inbox** with filters:

- By section, stakeholder type, priority, theme
    
    Actions:
    
- Accept → convert to Change Request (CR)
- Needs clarification → ask a question inside the thread
- Reject → must record rationale (auditable)

### 4) Change request workflow (lightweight “pull request”)

- CR-018 created from FB-042
- Links:
    - Affected sections (e.g., 4.3.2 + 4.4)
    - Evidence objects
    - Owner (Policy Lead)
    - Due date
- States:
    - Drafting → Review → Approved → Merged → Published

### 5) Publishing

One button: **“Publish Milestone Artifact”**

- Produces:
    - Public PDF (versioned)
    - Public changelog excerpt
    - Public “Consultation Summary” (sanitized)
- Keeps:
    - Raw stakeholder notes private

---

## Feedback-to-framework traceability (what you asked for)

### Traceability objects (minimum viable)

- **SectionAnchor**: `S4.3.2-p5` (stable anchors per paragraph)
- **FeedbackItem**: `FB-042`
- **ChangeRequest**: `CR-018`
- **Revision**: `v0.1 → v0.2`
- **DecisionLog**: accept/reject + rationale

### Traceability matrix view (UI)

A grid/table stakeholders and auditors love:

| Feedback ID | Stakeholder Org Type | Section Anchor | Theme | Decision | Change Request | Included in Version | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FB-042 | Legal | S4.4-p2 | Legality | Accepted | CR-018 | v0.2 | Definition tightened |
| FB-057 | Industry | S6.3-p1 | Tax compliance | Partially | CR-021 | v0.2 | Added thresholds note |

### “What changed” view (per section)

- v0.1 → v0.2 diff summary
- “Changes driven by”: FB-042, FB-057…
- One-click export as appendix for Catalyst reporting

---

## Portal information architecture (pages)

### Global

- Home dashboard
- Documents (policy drafts, research)
- Feedback inbox
- Workshops
- Traceability
- People & roles
- Exports (Milestone evidence pack)

### Per-section

- Section content (readable)
- Linked evidence
- Open feedback items
- Resolved items (with decision + version)

---

## Data model (practical)

- `users(id, org, role, scopes[])`
- `sections(id, version, anchors[])`
- `documents(id, type, version, public_url, private_url)`
- `feedback(id, section_anchor, author, priority, theme[], evidence_ids[])`
- `change_requests(id, feedback_ids[], owner, status, merged_version)`
- `workshops(id, date, reg_link, promo_assets[], attendance, recording, summary_doc)`
- `audit_log(actor, action, object_id, timestamp)`

---

## Meeting Catalyst “open access” while using RBAC

You can publish **only these** publicly:

- Policy draft PDFs (versioned)
- Research report PDFs
- Workshop summaries (sanitized)
- A public “consultation insights” summary (no names unless permitted)
- Changelog + methodology

Everything else (raw notes, stakeholder identities, recordings if sensitive) stays behind RBAC.

---

## If you want to build it quickly (implementation options)

### Option A: No-code fast (1–2 weeks of build time in real life)

- Portal: Notion / Softr / Retool
- Auth + RBAC: Stytch/Auth0
- Storage: Drive/S3
- Traceability: Airtable base + embedded views

### Option B: Standard web app

- Frontend: Next.js
- Auth: Auth0 / Clerk
- DB: Postgres
- Files: S3
- Audit: append-only log table
- PDF export: server-side rendering

---

### **Feedback-to-Framework Data Schema + APIs**

---

## 1) Data schema (Postgres)

### 1.1 Users, orgs, roles, scopes

```sql
-- Organizations (stakeholder entities)
CREATE TABLE orgs (
  id            UUID PRIMARY KEY,
  name          TEXT NOT NULL,
  org_type      TEXT NOT NULL CHECK (org_type IN ('GOV', 'REGULATOR', 'INDUSTRY', 'LEGAL', 'ACADEMIA', 'CIVIL', 'INTERNAL')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users
CREATE TABLE users (
  id            UUID PRIMARY KEY,
  org_id        UUID REFERENCES orgs(id),
  email         TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  title         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles (RBAC)
CREATE TABLE roles (
  id            UUID PRIMARY KEY,
  code          TEXT UNIQUE NOT NULL CHECK (code IN ('ADMIN','POLICY_LEAD','RESEARCH_LEAD','MODERATOR','STAKEHOLDER','OBSERVER','AUDITOR')),
  description   TEXT
);

-- User-role mapping (many-to-many)
CREATE TABLE user_roles (
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id       UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Section scopes: which sections a user can access (read/comment)
CREATE TABLE user_section_scopes (
  id            UUID PRIMARY KEY,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  section_id    UUID, -- references policy_sections(id) defined later
  can_comment   BOOLEAN NOT NULL DEFAULT false,
  can_view      BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Privacy preferences (per user/org)
CREATE TABLE privacy_prefs (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  public_attribution BOOLEAN NOT NULL DEFAULT false, -- allow name/org in public exports
  default_anonymous  BOOLEAN NOT NULL DEFAULT true
);

```

---

### 1.2 Policy documents, sections, anchors, versions

```sql
-- Policy document container (e.g., "Blockchain Policy Framework India")
CREATE TABLE policy_documents (
  id            UUID PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Versions (v0.1, v0.2 etc) for a policy document
CREATE TABLE policy_versions (
  id            UUID PRIMARY KEY,
  policy_document_id UUID NOT NULL REFERENCES policy_documents(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL, -- "v0.1"
  status        TEXT NOT NULL CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_policy_version ON policy_versions(policy_document_id, version_label);

-- Sections: stable identity across versions (e.g., Section 4)
CREATE TABLE policy_sections (
  id            UUID PRIMARY KEY,
  policy_document_id UUID NOT NULL REFERENCES policy_documents(id) ON DELETE CASCADE,
  section_code  TEXT NOT NULL, -- "S4"
  title         TEXT NOT NULL,
  sort_order    INT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_section_code ON policy_sections(policy_document_id, section_code);

-- Section content per version
CREATE TABLE policy_section_revisions (
  id            UUID PRIMARY KEY,
  policy_version_id UUID NOT NULL REFERENCES policy_versions(id) ON DELETE CASCADE,
  section_id    UUID NOT NULL REFERENCES policy_sections(id) ON DELETE CASCADE,
  content_md    TEXT NOT NULL, -- markdown content
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_section_revision ON policy_section_revisions(policy_version_id, section_id);

-- Paragraph/anchor map: stable anchor IDs for precise feedback (generated when publishing or saving)
CREATE TABLE section_anchors (
  id            UUID PRIMARY KEY,
  section_revision_id UUID NOT NULL REFERENCES policy_section_revisions(id) ON DELETE CASCADE,
  anchor_key    TEXT NOT NULL, -- "S4.3.2-p5" or hash
  start_offset  INT NOT NULL,  -- character offset in content_md (or token index)
  end_offset    INT NOT NULL,
  excerpt       TEXT,          -- short excerpt for context
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_anchor_key ON section_anchors(section_revision_id, anchor_key);

```

**Notes**

- `policy_sections` are stable (“Section 4”), while `policy_section_revisions` are version-specific content.
- `section_anchors` tie feedback to exact text regions for traceability.

---

### 1.3 Feedback, evidence, decisions

```sql
-- Evidence (files/links)
CREATE TABLE evidence_artifacts (
  id            UUID PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('LINK','FILE')),
  title         TEXT,
  url           TEXT,          -- for LINK or stored file URL
  file_mime     TEXT,
  uploaded_by   UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Feedback items
CREATE TABLE feedback_items (
  id            UUID PRIMARY KEY,
  fb_code       TEXT UNIQUE NOT NULL,  -- "FB-042"
  policy_version_id UUID NOT NULL REFERENCES policy_versions(id) ON DELETE CASCADE,
  section_id    UUID NOT NULL REFERENCES policy_sections(id),
  anchor_id     UUID REFERENCES section_anchors(id), -- optional but recommended
  submitted_by  UUID REFERENCES users(id),
  submitted_by_org UUID REFERENCES orgs(id),
  anonymity     TEXT NOT NULL CHECK (anonymity IN ('ANON','NAMED')) DEFAULT 'ANON',
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('ISSUE','SUGGESTION','ENDORSEMENT','EVIDENCE','QUESTION')),
  priority      TEXT NOT NULL CHECK (priority IN ('LOW','MED','HIGH')),
  impact        TEXT NOT NULL CHECK (impact IN ('LEGAL','SECURITY','TAX','CONSUMER','INNOVATION','CLARITY','GOVERNANCE','OTHER')),
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('SUBMITTED','UNDER_REVIEW','ACCEPTED','PARTIALLY_ACCEPTED','REJECTED','CLOSED')) DEFAULT 'SUBMITTED',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_feedback_section ON feedback_items(section_id, status, priority);

-- Feedback ↔ Evidence many-to-many
CREATE TABLE feedback_evidence (
  feedback_id   UUID REFERENCES feedback_items(id) ON DELETE CASCADE,
  evidence_id   UUID REFERENCES evidence_artifacts(id) ON DELETE CASCADE,
  PRIMARY KEY (feedback_id, evidence_id)
);

-- Decision log (required for accept/reject trace)
CREATE TABLE feedback_decisions (
  id            UUID PRIMARY KEY,
  feedback_id   UUID NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
  decided_by    UUID REFERENCES users(id),
  decision      TEXT NOT NULL CHECK (decision IN ('ACCEPTED','PARTIALLY_ACCEPTED','REJECTED')),
  rationale     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_feedback_decision ON feedback_decisions(feedback_id);

```

---

### 1.4 Change requests, merges, and traceability

```sql
-- Change requests (like a PR)
CREATE TABLE change_requests (
  id            UUID PRIMARY KEY,
  cr_code       TEXT UNIQUE NOT NULL, -- "CR-018"
  policy_document_id UUID NOT NULL REFERENCES policy_documents(id) ON DELETE CASCADE,
  target_version_id UUID NOT NULL REFERENCES policy_versions(id) ON DELETE CASCADE, -- e.g., v0.2 draft
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL CHECK (status IN ('DRAFTING','IN_REVIEW','APPROVED','MERGED','CLOSED')) DEFAULT 'DRAFTING',
  owner_id      UUID REFERENCES users(id),
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link feedback items to CRs
CREATE TABLE change_request_feedback (
  change_request_id UUID REFERENCES change_requests(id) ON DELETE CASCADE,
  feedback_id   UUID REFERENCES feedback_items(id) ON DELETE CASCADE,
  PRIMARY KEY (change_request_id, feedback_id)
);

-- What sections are modified by CR
CREATE TABLE change_request_sections (
  change_request_id UUID REFERENCES change_requests(id) ON DELETE CASCADE,
  section_id        UUID REFERENCES policy_sections(id) ON DELETE CASCADE,
  PRIMARY KEY (change_request_id, section_id)
);

-- Merge record: CR merged into a version
CREATE TABLE change_request_merges (
  id            UUID PRIMARY KEY,
  change_request_id UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
  merged_into_version_id UUID NOT NULL REFERENCES policy_versions(id) ON DELETE CASCADE,
  merged_by     UUID REFERENCES users(id),
  merge_summary TEXT,
  merged_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

```

**Traceability is now trivial**:

- `feedback_items` → `change_request_feedback` → `change_requests` → `change_request_merges` → `policy_versions`
- `feedback_items.anchor_id` ties to exact paragraph.

---

### 1.5 Workshops and linking to sections/feedback

```sql
CREATE TABLE workshops (
  id            UUID PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  scheduled_at  TIMESTAMPTZ NOT NULL,
  duration_mins INT NOT NULL DEFAULT 90,
  created_by    UUID REFERENCES users(id),
  reg_link      TEXT,
  public_visible BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workshop_artifacts (
  id            UUID PRIMARY KEY,
  workshop_id   UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('PROMO','REG_FORM','SCREENSHOT','RECORDING','SUMMARY','ATTENDANCE')),
  evidence_id   UUID NOT NULL REFERENCES evidence_artifacts(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link workshop insights to sections
CREATE TABLE workshop_sections (
  workshop_id   UUID REFERENCES workshops(id) ON DELETE CASCADE,
  section_id    UUID REFERENCES policy_sections(id) ON DELETE CASCADE,
  PRIMARY KEY (workshop_id, section_id)
);

-- Optionally link feedback items to workshops (created during/after session)
CREATE TABLE workshop_feedback (
  workshop_id   UUID REFERENCES workshops(id) ON DELETE CASCADE,
  feedback_id   UUID REFERENCES feedback_items(id) ON DELETE CASCADE,
  PRIMARY KEY (workshop_id, feedback_id)
);

```

---

### 1.6 Audit log (append-only)

```sql
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id),
  action        TEXT NOT NULL, -- "FEEDBACK_SUBMITTED", "CR_MERGED", etc.
  object_type   TEXT NOT NULL, -- "feedback_items"
  object_id     UUID NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_audit_object ON audit_logs(object_type, object_id, created_at);

```

---

## 2) API design (REST)

### 2.1 Auth & RBAC

Assume JWT with claims:

- `user_id`
- `roles[]`
- `org_id`
- `scopes: { section_ids:[], can_comment:bool }`

**Authorization pattern**:

- All endpoints validate role
- Section endpoints additionally validate `user_section_scopes`

---

## 3) API endpoints

### 3.1 Policy documents & versions

**GET** `/api/policy-documents`

List documents visible to user.

**GET** `/api/policy-documents/{docId}`

Metadata, latest published version.

**GET** `/api/policy-documents/{docId}/versions`

Admin/Leads: list all versions. Stakeholders: published + assigned drafts if allowed.

**POST** `/api/policy-documents/{docId}/versions` *(ADMIN / POLICY_LEAD)*

Create new draft version (e.g., v0.2).

Request:

```json
{ "version_label": "v0.2" }

```

**POST** `/api/policy-versions/{versionId}/publish` *(ADMIN / POLICY_LEAD)*

Publishes version (generates anchors, changelog snapshot, public exports).

---

### 3.2 Sections, anchors, revisions

**GET** `/api/policy-versions/{versionId}/sections`

Returns section list + titles.

**GET** `/api/policy-versions/{versionId}/sections/{sectionId}`

Returns content + anchors.

Response:

```json
{
  "section": { "id":"...", "code":"S4", "title":"Crypto Asset Legality & Classification" },
  "revision": { "id":"...", "content_md":"..." },
  "anchors": [
    { "id":"...", "anchor_key":"S4.3.2-p5", "start_offset":1200, "end_offset":1420, "excerpt":"..." }
  ]
}

```

**PUT** `/api/policy-versions/{versionId}/sections/{sectionId}` *(POLICY_LEAD)*

Updates section content in that version; regenerates anchors optionally.

Request:

```json
{ "content_md":"...", "regen_anchors": true }

```

**GET** `/api/policy-versions/{versionId}/diff?from=v0.1&to=v0.2`

Returns section-level diff metadata (optionally textual diffs if you implement).

---

### 3.3 Feedback

**POST** `/api/feedback` *(STAKEHOLDER + INTERNAL ROLES)*

Create feedback item.

Request:

```json
{
  "policy_version_id": "uuid",
  "section_id": "uuid",
  "anchor_id": "uuid",
  "anonymity": "ANON",
  "feedback_type": "ISSUE",
  "priority": "HIGH",
  "impact": "TAX",
  "title": "Tax reporting thresholds unclear",
  "body": "The framework should mention..."
}

```

**GET** `/api/feedback?versionId=&sectionId=&status=&priority=&impact=`

Filtered feedback list (scoped by RBAC).

**GET** `/api/feedback/{feedbackId}`

Feedback detail + evidence + decision + linked CRs.

**POST** `/api/feedback/{feedbackId}/evidence`

Attach evidence artifact(s).

Request:

```json
{ "evidence_ids": ["uuid1","uuid2"] }

```

**POST** `/api/feedback/{feedbackId}/decision` *(POLICY_LEAD / ADMIN)*

Record decision (required for accept/reject).

Request:

```json
{
  "decision": "ACCEPTED",
  "rationale": "Clarifies treatment of..."
}

```

**PATCH** `/api/feedback/{feedbackId}`

Update status (e.g., UNDER_REVIEW, CLOSED) with permission checks.

---

### 3.4 Change Requests (CR)

**POST** `/api/change-requests` *(POLICY_LEAD / ADMIN / RESEARCH_LEAD optional)*

Create CR.

Request:

```json
{
  "policy_document_id":"uuid",
  "target_version_id":"uuid",
  "title":"Clarify taxation simplification language",
  "description":"Address feedback FB-042 and FB-057",
  "feedback_ids":["uuidA","uuidB"],
  "section_ids":["uuidS6"]
}

```

**GET** `/api/change-requests?status=&versionId=&sectionId=`

List CRs.

**GET** `/api/change-requests/{crId}`

Detail includes feedback links and affected sections.

**PATCH** `/api/change-requests/{crId}` *(OWNER / POLICY_LEAD / ADMIN)*

Update status, description, assign owner.

**POST** `/api/change-requests/{crId}/approve` *(POLICY_LEAD / ADMIN)*

Moves to APPROVED (optionally requires 2-person rule).

**POST** `/api/change-requests/{crId}/merge` *(POLICY_LEAD / ADMIN)*

Records merge → creates merge record → updates statuses.

Request:

```json
{
  "merged_into_version_id":"uuid",
  "merge_summary":"Updated Section 6.3 to include..."
}

```

---

### 3.5 Traceability

**GET** `/api/traceability?docId=&fromVersion=&toVersion=&sectionId=&orgType=`

Returns matrix rows.

Response:

```json
[
  {
    "fb_code":"FB-042",
    "org_type":"LEGAL",
    "section_code":"S6",
    "anchor_key":"S6.3-p2",
    "impact":"TAX",
    "decision":"ACCEPTED",
    "cr_code":"CR-018",
    "merged_version":"v0.2"
  }
]

```

**GET** `/api/sections/{sectionId}/changes?from=v0.1&to=v0.2`

“What changed” view: diffs + feedback drivers.

---

### 3.6 Workshops

**POST** `/api/workshops` *(MODERATOR / ADMIN)*

Create workshop.

**GET** `/api/workshops?upcoming=true`

List.

**GET** `/api/workshops/{workshopId}`

Details + artifacts + linked sections.

**POST** `/api/workshops/{workshopId}/artifacts` *(MODERATOR)*

Attach promo/recordings/summaries.

**POST** `/api/workshops/{workshopId}/link-section` *(MODERATOR)*

Link to section(s).

---

### 3.7 Public exports (open access)

**GET** `/public/policy/latest`

Public metadata + PDF URL

**GET** `/public/policy/{versionLabel}`

Public PDF + changelog + consultation summaries

**POST** `/api/exports/milestone-pack?milestone=1|2` *(AUDITOR / ADMIN)*

Builds a zip:

- stakeholder list (sanitized)
- workshop evidence index
- feedback matrix
- version changelog
- published PDFs

---

## 4) ID conventions (human-friendly codes)

Implement codes via sequences:

- FB-001, FB-002…
- CR-001…

Store both:

- UUID primary key
- human code for UI and exports

---

## 5) Key implementation notes (avoid future pain)

1. **Anchor stability:** generate anchors consistently (e.g., per paragraph) and keep `anchor_key` stable within a revision. For diffs across versions, map by paragraph order + similarity if needed.
2. **Privacy:** store identity but enforce anonymity in public endpoints and exports by checking `privacy_prefs`.
3. **Decision required:** enforce that any move to ACCEPTED/REJECTED requires a row in `feedback_decisions`.
4. **Audit log everywhere:** every create/update/publish/merge writes an audit log entry.

---

### 📋 Expanded RACI → Full Workplan

---

**Project:** Crafting Blockchain Policy Framework for India

**Funding:** Project Catalyst – Fund 12

---

## 🔹 Role Legend (consistent across milestones)

- **A – Accountable:** Final ownership, approval authority
- **R – Responsible:** Executes the work
- **C – Consulted:** Provides input / validation
- **I – Informed:** Visibility only

### Core Roles

- **Admin / Program Owner**
- **Policy Lead**
- **Research Lead**
- **Workshop Moderator**
- **Stakeholders** (Gov, Industry, Legal, Academia, Civil Society)
- **Auditor** (Catalyst reporting / evidence export)

---

# 🟦 MILESTONE 1

## Stakeholder Engagement & Initial Research

**Duration:** 6 weeks

**Purpose:** Validate and strengthen the policy framework direction

---

## 🗓 Timeline Overview (Milestone 1)

| Week | Focus |
| --- | --- |
| Week 1 | Stakeholder onboarding + research setup |
| Week 2 | Desk research + interviews |
| Week 3 | Interviews + Workshop 1 |
| Week 4 | Workshop 2 |
| Week 5 | Workshop 3 + synthesis |
| Week 6 | Research report finalization + evidence packaging |

---

## 🧩 Workplan Breakdown (Milestone 1)

### 1. Stakeholder Identification & Onboarding

| Task | RACI | Output | Evidence |
| --- | --- | --- | --- |
| Finalize stakeholder categories | A: Admin | Stakeholder taxonomy | Internal doc |
| Identify ≥15 stakeholders | R: Research Lead | Stakeholder list | Stakeholder list file |
| Verify roles & affiliations | R: Research Lead | Verified list | Notes / links |
| Portal onboarding (RBAC) | R: Admin | User accounts | Portal user logs |

---

### 2. Initial Desk Research

| Task | RACI | Output | Evidence |
| --- | --- | --- | --- |
| Policy & regulatory scan | R: Research Lead | Research notes | Research workspace |
| Global comparative scan | R: Research Lead | Summary notes | Citations |
| Map findings to framework sections | C: Policy Lead | Section annotations | Tagged notes |

---

### 3. Stakeholder Interviews (1:1)

| Task | RACI | Output | Evidence |
| --- | --- | --- | --- |
| Prepare interview guides | A: Policy Lead | Interview templates | Templates |
| Conduct interviews (8–12) | R: Research Lead | Interview notes | Dated notes |
| Tag insights to sections | R: Research Lead | Feedback items (FB-IDs) | Traceability logs |

---

### 4. Stakeholder Workshops (Minimum 3)

| Workshop | RACI | Output | Evidence |
| --- | --- | --- | --- |
| Workshop 1 – Crypto Legality | R: Moderator | Session summary | Screenshots, recording |
| Workshop 2 – Data & Custody | R: Moderator | Session summary | Screenshots, recording |
| Workshop 3 – Tax & Innovation | R: Moderator | Session summary | Screenshots, recording |
| Promotion & registration | R: Moderator | Flyers, forms | Links + images |

---

### 5. Research Synthesis & Report

| Task | RACI | Output | Evidence |
| --- | --- | --- | --- |
| Synthesize findings | R: Research Lead | Draft report | Working doc |
| Review against framework | C: Policy Lead | Gap notes | Comments |
| Finalize report | A: Admin | Research report PDF | Public link |

---

### 6. Milestone 1 Evidence Export

| Task | RACI | Output | Evidence |
| --- | --- | --- | --- |
| Compile evidence pack | R: Auditor | Evidence folder | ZIP / links |
| Publish public artifacts | A: Admin | Public pages | URLs |

---

# 🟩 MILESTONE 2

## Policy Framework Drafting

**Duration:** 4–5 weeks

**Purpose:** Produce consultative draft + integrate stakeholder input

---

## 🗓 Timeline Overview (Milestone 2)

| Week | Focus |
| --- | --- |
| Week 1 | Draft consolidation |
| Week 2 | Stakeholder consultations (2 sessions) |
| Week 3 | Feedback incorporation |
| Week 4 | Versioning + publication |

---

## 🧩 Workplan Breakdown (Milestone 2)

### 1. Policy Draft Consolidation

| Task | RACI | Output | Evidence |
| --- | --- | --- | --- |
| Consolidate Sections 1–11 | R: Policy Lead | Full draft | Working doc |
| Internal review | C: Research Lead | Review notes | Comments |
| Lock v0.1 | A: Admin | Draft PDF | Versioned file |

---

### 2. Stakeholder Consultation Sessions (Minimum 2)

| Task | RACI | Output | Evidence |
| --- | --- | --- | --- |
| Design consultation agenda | R: Policy Lead | Agenda doc | PDF |
| Conduct Session 1 | R: Moderator | Feedback items | Screenshots |
| Conduct Session 2 | R: Moderator | Feedback items | Screenshots |
| Collect ≥10 stakeholder inputs | R: Research Lead | FB records | Traceability IDs |

---

### 3. Feedback → Framework Integration

| Task | RACI | Output | Evidence |
| --- | --- | --- | --- |
| Triage feedback | R: Policy Lead | Decisions | Decision logs |
| Create change requests | R: Policy Lead | CR records | CR IDs |
| Merge accepted changes | R: Policy Lead | Updated draft | Diff summary |

---

### 4. Versioning & Publication

| Task | RACI | Output | Evidence |
| --- | --- | --- | --- |
| Update changelog | R: Policy Lead | CHANGELOG.md | File |
| Publish v0.2 draft | A: Admin | Public PDF | URL |
| Publish consultation summary | R: Research Lead | Summary doc | Public page |

---

### 5. Milestone 2 Evidence Export

| Task | RACI | Output | Evidence |
| --- | --- | --- | --- |
| Compile Milestone 2 pack | R: Auditor | Evidence bundle | ZIP / links |
| Final Catalyst submission | A: Admin | Submission | Portal logs |

---

# 📦 Evidence Checklist (Catalyst-Ready)

### Milestone 1

- ✔ Stakeholder list (≥15)
- ✔ Research report (public)
- ✔ Workshop promos + registrations
- ✔ Screenshots + recordings
- ✔ Feedback summaries

### Milestone 2

- ✔ Policy framework draft (≥15 pages)
- ✔ Consultation session evidence (2)
- ✔ Feedback-to-framework traceability
- ✔ Versioned documents (v0.1 → v0.2)

---

## 🧠 Why This Workplan Is Strong

- Directly maps to **Catalyst acceptance criteria**
- Clean separation of **accountability vs execution**
- Evidence-first (no ambiguity during review)
- Scales naturally into your **RBAC portal**
- Supports audits, extensions, or follow-on funding

---