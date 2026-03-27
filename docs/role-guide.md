# PolicyDash Role Guide

This guide explains what each role can do in PolicyDash, how to perform key actions, and what each role sees when they log in. Admin is excluded — admins have full access to everything.

---

## Table of Contents

1. [Policy Lead](#1-policy-lead)
2. [Research Lead](#2-research-lead)
3. [Workshop Moderator](#3-workshop-moderator)
4. [Stakeholder](#4-stakeholder)
5. [Observer](#5-observer)
6. [Auditor](#6-auditor)
7. [Permission Matrix](#7-permission-matrix)

---

## 1. Policy Lead

**Who is this role for?** Government officials or senior team members responsible for drafting, managing, and publishing policy documents. The Policy Lead is the primary driver of the consultation lifecycle.

### What you see when you log in

Your dashboard shows a command-centre view:

- **Open Feedback** — count of feedback items awaiting triage
- **Active CRs** — count of in-progress change requests
- **Total Policies** — documents you manage
- **Published Versions** — how many versions are live on the public portal
- **What Changed Since Last Visit** — new feedback submitted since your last login
- **Feedback Inbox** — top 5 submitted items with priority and section, plus a "Triage Feedback" button
- **Active Change Requests** — top 5 CRs with status badges
- **Section Health** — every section rated Good / Warning / Critical based on open feedback volume

### Navigation

You see: **Dashboard**, **Policies**, **Feedback** in the sidebar.

### What you can do

#### Managing Policy Documents

1. Go to **Policies** in the sidebar
2. Click **Create Policy** to create a new document (title + description)
3. Click any policy card to open it
4. Inside a policy, the left sidebar shows sections — click **Add Section** to create one
5. Drag sections to reorder them
6. Click a section to view its content, then click **Edit** to open the block editor
7. The block editor supports headings, paragraphs, lists, tables, callouts, code blocks, images, and file attachments
8. Use `/` (slash) to access the command menu for inserting any block type
9. Content auto-saves as you type

#### Assigning Stakeholders to Sections

Before stakeholders can submit feedback on a section, they must be assigned to it.

1. Open a policy document
2. Navigate to the section you want to assign
3. The section assignment controls allow you to add/remove users for that section
4. Only assigned stakeholders can submit feedback on that specific section

#### Triaging Feedback

1. Go to **Feedback** or click the feedback link on your dashboard
2. The inbox shows all feedback across your documents with filters (status, section, priority, type, impact, org type)
3. Click any feedback card to open the detail sheet
4. You can see the full feedback body, submitter info (even for anonymous items — you have identity access), and evidence
5. **Triage actions available:**
   - **Start Review** — moves feedback from "Submitted" to "Under Review"
   - **Accept** — marks feedback as accepted (requires rationale, minimum 20 characters)
   - **Partially Accept** — accepts with caveats (requires rationale)
   - **Reject** — rejects with explanation (requires rationale)
   - **Close** — closes feedback without further action
6. Every decision is logged in the Decision Log visible on the feedback detail

#### Creating Change Requests

Once feedback is accepted or partially accepted, you can bundle it into a Change Request (CR):

1. Go to a policy's **Change Requests** tab
2. Click **Create Change Request**
3. **Step 1:** Select accepted/partially accepted feedback items to include
4. **Step 2:** Enter a title and description for the CR
5. The CR is created in **Drafting** status with a human-readable ID (CR-001, CR-002, etc.)

#### Managing CRs Through the Lifecycle

1. Open a CR from the list
2. You can add/remove linked sections and view linked feedback
3. **Lifecycle transitions:**
   - **Submit for Review** — moves from Drafting to In Review
   - **Approve** — moves from In Review to Approved
   - **Request Changes** — sends back to In Review
   - **Merge** — creates a new version of the document (requires a merge summary). This atomically: creates a version snapshot, generates a changelog, and marks all linked feedback as "resolved in version X"
   - **Close** — closes without merging (requires rationale, minimum 20 characters)

#### Versioning and Publishing

1. Go to a policy's **Versions** tab
2. You see all versions with their changelogs and status (Draft / Published)
3. You can **create a manual version** (without a CR) by clicking "Create Version"
4. You can **compare any two versions** using the comparison selector — this shows section-level diffs with word-level highlighting (green = added, red = removed)
5. Click **Publish** on any version to make it publicly accessible on the portal. Published versions are **immutable** — they cannot be edited after publishing.

#### Traceability

1. Go to a policy's **Traceability** tab
2. **Matrix view** — shows the full FB -> CR -> Section -> Version chain in a grid
3. **By Section** — shows what changed in each section and why
4. **By Stakeholder** — shows feedback outcomes per stakeholder
5. **Search** — full-text search across feedback, sections, and CRs
6. Use **Export CSV** or **Export PDF** to download traceability data for reporting

#### Inline Comments

While editing in the block editor:

1. Select text and click the comment bubble (or press **Ctrl+Alt+M**)
2. Type your comment and submit
3. The comment panel shows all comments on the current section (Open and Resolved tabs)
4. You can reply, resolve, reopen, or delete your own comments

---

## 2. Research Lead

**Who is this role for?** Researchers and evidence analysts who review feedback quality, identify claims lacking evidence, and ensure policy positions are evidence-backed.

### What you see when you log in

Your dashboard focuses on evidence gaps:

- **Feedback Without Evidence** — count of feedback items with no supporting evidence
- **Total Evidence Items** — evidence artifacts across the system
- **Claims Without Evidence** — table of feedback items lacking evidence, with "Attach Evidence" action
- **Evidence Overview** — coverage rate percentage
- **"Review Evidence"** button linking to the full evidence gaps page

### Navigation

You see: **Dashboard**, **Policies**, **Feedback** in the sidebar.

### What you can do

#### Reading Policies

1. Go to **Policies** to see all documents
2. Click any policy to read its sections and content
3. You can view version history and diffs but cannot edit content

#### Submitting Feedback (on assigned sections only)

You can only submit feedback on sections you have been assigned to by a Policy Lead.

1. Open a policy and navigate to an assigned section
2. Click **Submit Feedback**
3. Fill in: feedback type (Issue / Suggestion / Endorsement / Evidence / Question), priority, impact category, title, and body
4. Choose **Named** or **Anonymous** attribution
5. Your feedback gets a human-readable ID (FB-001, etc.)

#### Managing Evidence

This is your primary responsibility:

1. Go to **Dashboard** and click **Review Evidence** to see the full evidence gaps page
2. This page shows all feedback items that have no attached evidence
3. Filter by document, section, or feedback type
4. Click **Attach Evidence** on any item to upload a file or add a link
5. You can also attach evidence directly from feedback detail views

#### Viewing Your Feedback Outcomes

1. Go to **Feedback** > **Outcomes**
2. See the status of all feedback you've submitted — accepted, rejected, pending, and which version it influenced

#### Inline Comments

You can participate in inline discussions on policy sections — create comments, reply, resolve, and reopen threads.

---

## 3. Workshop Moderator

**Who is this role for?** Facilitators who organize and run consultation workshops, manage workshop artifacts (recordings, summaries, attendance), and link workshop outcomes to policy sections and feedback.

### What you see when you log in

Your dashboard shows workshop management (currently in early release):

- **Upcoming Workshops** count
- **Total Artifacts** count
- **Manage Workshops** button

### Navigation

You see: **Dashboard**, **Policies**, **Feedback**, **Workshops** in the sidebar. You are one of only two roles (along with Admin) that sees the Workshops link.

### What you can do

#### Creating and Managing Workshops

1. Go to **Workshops** in the sidebar
2. Click **Create Workshop**
3. Fill in: title, description, scheduled date/time, duration, registration link (optional)
4. Your workshop appears in the list with Upcoming / Past tabs

#### Managing Workshop Detail

1. Click any workshop you created to open its detail page
2. You can **edit** title, description, date, duration, and registration link
3. You can **delete** workshops you created

#### Attaching Artifacts

1. On the workshop detail page, click **Attach Artifact**
2. Choose an artifact type: Promotional Material, Recording, Session Summary, Attendance Record, or Other
3. Optionally give it a title
4. Upload a file — it goes to Cloudflare R2 storage
5. Attached artifacts show in the artifact list with download and remove actions

#### Linking Sections and Feedback

1. On the workshop detail page, use **Link Section** to connect policy sections discussed in the workshop
2. Use **Link Feedback** to connect feedback items that originated from the workshop
3. This creates traceability between workshops and the policy consultation process

#### Submitting Feedback

Like other contributors, you can submit feedback on sections you're assigned to.

#### Inline Comments

You can participate in inline discussions on policy sections.

---

## 4. Stakeholder

**Who is this role for?** External participants in the consultation process — industry representatives, legal experts, academics, civil society members. This is the default role for new sign-ups.

### What you see when you log in

Your dashboard is a personal engagement view:

- **What Changed Since Your Last Visit** — sections that were updated since you last logged in, with "View changes" links
- **Your Assigned Sections** — sections you've been assigned to by a Policy Lead, with **Submit Feedback** buttons
- **Your Pending Feedback** — feedback you've submitted that hasn't been resolved yet, with current status badges
- **View All Feedback Outcomes** — link to see how your feedback was handled
- **Upcoming Workshops** — placeholder for future workshop listings

### Navigation

You see: **Dashboard**, **Policies**, **Feedback** in the sidebar.

### What you can do

#### Reading Policies

1. Go to **Policies** to browse all documents
2. Click any policy to read its sections and content
3. You can view version history and compare versions

#### Submitting Feedback

This is your primary action in the system. You can only submit feedback on sections assigned to you.

1. From your dashboard, click **Submit Feedback** next to an assigned section
2. Or navigate to a policy > section and click the feedback submission link
3. Fill in:
   - **Type:** Issue, Suggestion, Endorsement, Evidence, or Question
   - **Priority:** Low, Medium, or High
   - **Impact Category:** Legal, Security, Tax, Consumer, Innovation, Clarity, Governance, or Other
   - **Title and Body:** Describe your feedback
4. **Privacy choice:** Select **Named** (your identity is visible to Policy Leads and Auditors) or **Anonymous** (your identity is hidden from everyone except system admins)
5. Submit — your feedback gets a human-readable ID (FB-001, FB-002, etc.)

#### Tracking Your Feedback

1. Your dashboard shows pending feedback with current status: Submitted, Under Review, Accepted, Partially Accepted, Rejected, or Closed
2. Go to **Feedback** > **Outcomes** to see the full history
3. For accepted feedback, you can see which version of the policy it influenced (e.g., "Resolved in v0.3")

#### Attaching Evidence

1. When submitting feedback or from the feedback detail view, you can attach evidence
2. Upload files (PDFs, images, documents) or add links
3. Evidence supports your feedback claims and is visible to Policy Leads and Research Leads

#### Inline Comments

You can participate in inline discussions on policy sections — create comments, reply, resolve, and reopen.

---

## 5. Observer

**Who is this role for?** Read-only participants who need visibility into the consultation process without active participation. Suitable for senior officials, media, or external monitors.

### What you see when you log in

Your dashboard shows a publication-focused overview:

- **Published Policies** count
- **Open Consultations** count (policies currently receiving feedback)
- **Published Policies list** — policies with at least one published version, showing the latest version label and publication date

### Navigation

You see: **Dashboard**, **Policies**, **Feedback** in the sidebar.

### What you can do

#### Reading Everything

You have broad read access:

1. **Policies** — browse all documents, read all sections and content
2. **Versions** — view version history, read changelogs, compare versions with diffs
3. **Evidence** — view evidence artifacts attached to feedback and sections
4. **Workshops** — view workshop listings and their artifacts
5. **Comments** — read inline comment threads (but you cannot create, reply, or resolve comments)

#### What you cannot do

- Submit feedback
- Upload evidence
- Create or manage change requests
- Publish versions
- Access the traceability matrix or export data
- Access the audit trail
- Create inline comments
- Manage workshops

The Observer role is strictly read-only with no write capabilities.

---

## 6. Auditor

**Who is this role for?** Compliance officers, governance reviewers, and accountability monitors who need to verify the integrity of the consultation process and export evidence for regulatory purposes.

### What you see when you log in

Your dashboard is a compliance monitoring view:

- **Audit Events (7 days)** — recent activity count
- **Total Audit Events** — lifetime count
- **Recent Audit Activity** — last 10 events with action type, actor role, entity, and timestamp
- **View Full Audit Trail** button
- **Export Controls** — Export Audit Log (CSV) and Export Evidence Pack (ZIP)

### Navigation

You see: **Dashboard**, **Policies**, **Feedback**, **Audit** in the sidebar. You are one of only two roles (along with Admin) that sees the Audit link.

### What you can do

#### Audit Trail

1. Go to **Audit** in the sidebar
2. The audit trail shows every significant action in the system: document creation, feedback submission, CR transitions, version publishes, user invites, etc.
3. **Filter by:** action type, actor role, entity type, date range
4. Click any row to expand and see the full metadata payload
5. The audit log is immutable — entries cannot be edited or deleted

#### Evidence Pack Export

1. From the Audit page, click **Export Evidence Pack**
2. Select a policy document
3. The system generates a ZIP containing:
   - **INDEX.md** — table of contents
   - **stakeholders.csv** — participating stakeholders
   - **feedback-matrix.csv** — all feedback with decisions
   - **version-history.json** — complete version chain
   - **decision-log.json** — all workflow transitions
   - **workshop-evidence.json** — linked workshop data
4. Download the ZIP for governance reporting

#### Reading the Full Consultation Record

You have comprehensive read access across the entire system:

1. **All feedback** — you can read every feedback item across all documents (but anonymous submitter identities are masked — you see "Anonymous" not the real name)
2. **All change requests** — read CR details, linked feedback, affected sections, lifecycle transitions, and decision logs
3. **All versions** — read version history, changelogs, section-level diffs
4. **Full traceability** — access the traceability matrix, section chain view, stakeholder outcomes view, and search
5. **Export traceability** — download CSV or PDF exports of traceability data
6. **Evidence** — read all evidence artifacts and export them
7. **Workshops** — read workshop listings and artifacts

#### What you cannot do

- Edit documents or sections
- Submit feedback
- Create or manage change requests
- Publish versions
- Create inline comments (you can read them)
- Manage workshops

Your role is to verify and export — not to participate in the consultation process.

---

## 7. Permission Matrix

Quick reference for what each role can and cannot do:

| Capability | Policy Lead | Research Lead | Workshop Mod | Stakeholder | Observer | Auditor |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Documents** |
| Create/edit/delete documents | Yes | - | - | - | - | - |
| Read documents | Yes | Yes | Yes | Yes | Yes | Yes |
| **Sections** |
| Create/edit/delete/reorder sections | Yes | - | - | - | - | - |
| Edit section content (block editor) | Yes | - | - | - | - | - |
| Assign users to sections | Yes | - | - | - | - | - |
| **Feedback** |
| Submit feedback (assigned sections) | - | Yes | Yes | Yes | - | - |
| Read own feedback | - | Yes | Yes | Yes | Yes | - |
| Read ALL feedback | Yes | - | - | - | - | Yes |
| Triage (accept/reject/review) | Yes | - | - | - | - | - |
| See anonymous identity | Yes | - | - | - | - | - |
| **Evidence** |
| Upload evidence | Yes | Yes | Yes | Yes | - | - |
| Read evidence | Yes | Yes | Yes | Yes | Yes | Yes |
| Export evidence pack | - | - | - | - | - | Yes |
| **Change Requests** |
| Create CRs | Yes | - | - | - | - | - |
| Read CRs | Yes | - | - | - | - | Yes |
| Manage CR lifecycle | Yes | - | - | - | - | - |
| Merge (create version) | Yes | - | - | - | - | - |
| **Versions** |
| Read versions + diffs | Yes | Yes | - | Yes | Yes | Yes |
| Create manual version | Yes | - | - | - | - | - |
| Publish version | Yes | - | - | - | - | - |
| **Traceability** |
| View matrix + search | Yes | - | - | - | - | Yes |
| Export CSV/PDF | Yes | - | - | - | - | Yes |
| **Workshops** |
| Create/manage workshops | - | - | Yes | - | - | - |
| Read workshops | Yes | Yes | Yes | Yes | Yes | Yes |
| **Audit** |
| View audit trail | - | - | - | - | - | Yes |
| **Comments** |
| Create/reply/resolve | Yes | Yes | Yes | Yes | - | - |
| Read comments | Yes | Yes | Yes | Yes | Yes | Yes |
| **Notifications** |
| Receive notifications | Yes | Yes | Yes | Yes | Yes | Yes |
