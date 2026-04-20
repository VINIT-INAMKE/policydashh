# Domain Model: Research Module

**Project:** PolicyDash Research Module
**Researched:** 2026-04-19
**Confidence:** HIGH (grounded in existing schema + crossref/datacite standards)

---

## What Is a "Research Item"?

In policy consultation platforms, a research item is a **citable, versioned document that
provides evidence or context informing a specific policy position**. It is upstream of
feedback: stakeholders cite research to support their feedback; policy leads cite research
to justify decisions in Change Requests.

### Taxonomy (by type)

| Type | Description | Produces |
|------|-------------|---------|
| `report` | Commissioned multi-section report (PDF) | Downloadable artifact |
| `paper` | Academic/working paper, may carry DOI | Downloadable artifact + citation |
| `dataset` | Structured data file (CSV, XLSX) used as evidence | Evidence artifact |
| `memo` | Internal policy memo or briefing note | Downloadable artifact |
| `interview_transcript` | Raw or cleaned transcript from expert interview | Evidence artifact |
| `media_coverage` | Press coverage, external commentary (URL-link only) | External link |
| `legal_reference` | Statute, regulation, court ruling, official guidance | External link + optional PDF |
| `case_study` | Real-world implementation example | Downloadable artifact |

### How It Differs From Existing Entities

| Dimension | `evidence_artifacts` (existing) | `workshop_artifacts` (existing) | Research Item (new) |
|-----------|--------------------------------|--------------------------------|---------------------|
| **Origin** | Uploaded to support a feedback/section claim | Produced during/after a workshop | Authored or curated by research_lead before/during consultation |
| **Scope** | Tied to feedback or section | Tied to workshop lifecycle | Tied to policy document, version, AND/OR section |
| **Lifecycle** | No states — upload = live | draft/approved (artifact_review_status) | draft → pending_review → published → (retracted) |
| **Public surface** | No | No | YES — `/research` page lists published items |
| **Citation** | Not a first-class concept | Not a first-class concept | Yes — DOI, author, publication date |
| **Anchoring** | Via milestone manifest only | Via milestone manifest only | Can be independently anchored (like `documentVersions`) |

**Key architectural decision:** A research item is NOT an `evidence_artifact`. It owns its
own table and its own lifecycle. It may *reference* `evidence_artifacts` for its binary
file (same R2 upload flow), or carry a URL for external references.

---

## Core Attributes

### Required

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `readableId` | text | Human-visible, e.g. `RI-001` |
| `documentId` | UUID | FK → `policy_documents` — every research item belongs to exactly one policy document |
| `title` | text | Title of the research item |
| `itemType` | enum | `report`, `paper`, `dataset`, `memo`, `interview_transcript`, `media_coverage`, `legal_reference`, `case_study` |
| `status` | enum | `draft`, `pending_review`, `published`, `retracted` |
| `createdBy` | UUID | FK → `users` — the research_lead who created it |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### Optional / Conditional

| Field | Type | Condition |
|-------|------|-----------|
| `description` | text | Abstract or summary |
| `externalUrl` | text | For `media_coverage`, `legal_reference` — no file upload |
| `artifactId` | UUID | FK → `evidence_artifacts` — for file-based types; NULL for URL-only |
| `doi` | text | For `paper` — e.g. `10.1234/xyz` |
| `authors` | text[] | Author names (display only, not linked to users table) |
| `publishedDate` | date | Original publication date of the source document |
| `peerReviewed` | boolean | For academic papers |
| `journalOrSource` | text | Publisher or source name |
| `versionLabel` | text | `v1`, `v2` etc. — internal version of this research item |
| `previousVersionId` | UUID | Self-FK → `research_items.id` — links to prior version |
| `reviewedBy` | UUID | FK → `users` — who approved publication |
| `reviewedAt` | timestamp | When approved |
| `retractionReason` | text | Required if `status = retracted` |
| `contentHash` | text | SHA-256 of canonical JSON (for anchoring, same pattern as milestones) |
| `txHash` | text | Cardano tx hash if anchored |
| `anchoredAt` | timestamp | |

---

## Linking Model

Research items use a separate linking table (many-to-many) rather than a direct FK on the
item itself. This is consistent with how `workshopSectionLinks`, `crFeedbackLinks`, etc.
work throughout PolicyDash.

### `research_item_section_links`

Links a published research item to one or more policy sections it directly informs.

| Field | Notes |
|-------|-------|
| `researchItemId` | FK → `research_items` |
| `sectionId` | FK → `policy_sections` |
| `relevanceNote` | text (optional) — why this item is relevant to this section |

### `research_item_version_links`

Links a research item to a specific `documentVersions` row (e.g. "this report informed v1.3").
Optional — not every research item needs explicit version pinning.

| Field | Notes |
|-------|-------|
| `researchItemId` | FK → `research_items` |
| `versionId` | FK → `document_versions` |

### `research_item_feedback_links`

Allows stakeholders and research leads to cite a published research item when submitting
feedback, or for a policy lead to attach research items to feedback during review.

| Field | Notes |
|-------|-------|
| `researchItemId` | FK → `research_items` |
| `feedbackId` | FK → `feedback` |

---

## Status State Machine

```
draft
  └─ [submit for review] ──► pending_review
                                    ├─ [approve] ──► published
                                    └─ [reject]  ──► draft  (returned for edits)

published
  └─ [retract] ──► retracted   (soft state — row preserved for audit trail)
```

Transitions are guarded by role: `research_lead` drives draft→pending_review;
`admin` or `policy_lead` drives pending_review→published and published→retracted.

---

## Versioning Pattern

Two options evaluated against the existing codebase:

**Option A — reuse `documentVersions` pattern directly**
Adds a `versionLabel` + `previousVersionId` self-FK on `research_items`. A new version of
a white paper is a new row with `previousVersionId` pointing to the old one. The old row
remains published (browsable history) until superseded. `status` on the old version becomes
implicitly historic but is NOT set to `retracted` — that is reserved for integrity failures.

**Option B — separate `research_item_versions` table**
Creates a parent stub (identity) + child version rows, similar to `documentVersions` vs
`policyDocuments`. More normalised but significantly more schema overhead for what amounts
to an optional feature.

**Recommendation: Option A** — `previousVersionId` self-FK on `research_items`. Justification:
- Matches Crossref/DataCite `IsNewVersionOf` / `IsPreviousVersionOf` relation pattern
- Avoids circular import issues (same problem that forced `documentVersions.crId` to skip
  Drizzle `.references()` — see `changeRequests.ts` G8 comment)
- Sufficient for v0.2 scope; can be migrated to Option B in v0.3 if volume demands it

---

## Public Surface Taxonomy

| Surface | Content | Auth Required |
|---------|---------|---------------|
| `/research` (existing, static) | Prose landscape overview | No |
| `/research/items` (new) | Filterable listing of published research items | No |
| `/research/items/[id]` (new) | Detail page with metadata + download/link | No |

The existing `/research` page stays untouched as editorial content. The new listing
is an adjacent route, consistent with how `/framework` coexists with `/portal`.
