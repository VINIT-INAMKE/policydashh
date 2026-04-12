# WHAT WE ARE BUILDING

---

Not:

- a dashboard
- a SaaS
- a workflow tool

But:

> **A Verifiable Policy Operating System**
> 

Where:

- every action = structured
- every decision = traceable
- every artifact = provable
- every outcome = exportable
- every critical state = anchored on-chain

---

### SYSTEM ARCHITECTURE (HIGH LEVEL)

```
Frontend (UX Layer)
        ↓
Application Layer (Logic + APIs)
        ↓
State Layer (Database + Files)
        ↓
Verification Layer (Hashing)
        ↓
Blockchain Layer (Cardano Anchoring)
```

---

### FRONTEND (UNIFIED INTERFACE)

#### Framework

- Next.js (app router) OR SvelteKit
- Tailwind (UI)
- Zustand / Redux (state)

---

### Core UX Modules (ALL IN ONE APP)

#### Public Layer

- Policy page
- Research
- Framework
- Workshops
- Participate

---

#### Workspace Layer (Login)

#### **Dashboard**

- Active project (India Blockchain Policy)
- Stakeholder counts
- Evidence

#### **Stakeholder Module**

- Add / import stakeholders
- Tag (gov, industry, legal, etc.)
- Track engagement

#### Workshop Module

- Create workshop
- Assign participants
- Upload recordings
- Auto-generate summary

#### Feedback Engine

- Structured input (by section)
- Tagging (issue type)
- Status (accepted/rejected)

#### Revision Engine

- Section-wise editing
- Linked feedback
- Version history
- Diff view

#### Evidence Vault

- Screenshots
- Attendance
- Docs
- Videos
- Auto-link to milestone

#### Export Engine

- Generate:
    - Milestone pack
    - Policy draft PDF
    - Evidence bundle

---

### BACKEND (CORE ENGINE)

#### Stack

- Node.js (NestJS preferred)
- PostgreSQL (main DB)
- Object storage (S3 / MinIO)
- GraphQL API

#### Core Entities

```
User
Stakeholder
Workshop
Feedback
PolicySection
Revision
Artifact
Milestone
```

#### Relationships

- Feedback → PolicySection
- Revision → Feedback
- Workshop → Stakeholders
- Artifact → Workshop / Milestone
- Milestone → All entities

---

### VERIFICATION LAYER (CRITICAL)

Before touching blockchain, we need:

#### Hashing layer

Every important object:

- Policy version
- Workshop summary
- Feedback dataset
- Evidence bundle

→ generate SHA256 hash

#### **Example:**

```
policy_v3_hash = hash(JSON(policy_v3))
```

---

### CARDANO INTEGRATION (ANCHORING STRATEGY)

Use Cardano NOT for raw storage.

Use it for:

> **State anchoring + proof of integrity**
> 

#### What goes on-chain:

- Policy version hash
- Milestone completion hash
- Evidence bundle hash
- Governance decisions (optional)

#### Flow:

```
System Event (e.g. milestone complete)
→ Generate hash
→ Create metadata JSON
→ Submit transaction to Cardano
→ Store Tx Hash in DB
→ Display as “Verified State”
```

#### Tools:

- Cardano Serialization Lib (JS)
- Blockfrost API
- Mesh SDK (recommended)

#### Metadata Example:

```json
{
  "project": "India Blockchain Policy",
  "milestone": "M1",
  "hash": "0xABC123...",
  "timestamp": "2026-04-11",
  "type": "milestone_completion"
}
```

---

### GOVERNANCE LAYER (BUILT-IN)

Instead of external DAO tools:

Embed:

#### Roles:

- Admin
- Policy Lead
- Reviewer
- Observer

#### Actions:

- Approve revision
- Mark feedback accepted/rejected
- Validate milestone

#### Optional (Advanced):

- Token-weighted voting (later)

---

### INTERNAL AUTOMATION

Instead of external tools:

Build internal event system:

```
Event: workshop_created
→ notify participants
→ create evidence checklist

Event: feedback_submitted
→ tag + link to section

Event: milestone_ready
→ trigger hash + blockchain anchor
```

---

### UI FLOW (END-TO-END)

#### Example: Workshop lifecycle

1. Create workshop
2. Add participants
3. Conduct session
4. Upload recording
5. Collect feedback
6. Auto-link feedback → sections
7. Generate summary
8. Add artifacts
9. Mark milestone ready
10. Anchor hash on Cardano
11. Export bundle

---

### Phase 1

- Auth + dashboard
- Stakeholder module
- Workshop module
- Feedback + revision
- Evidence upload
- Export (basic)

---

#### Phase 2

- Hashing layer
- Cardano anchoring
- Versioning
- Diff viewer

---

#### FINAL POSITIONING

This platform becomes:

> **Civilization Lab OS (Policy Engine v1)**
> 
> 
> anchored on **Cardano**
>