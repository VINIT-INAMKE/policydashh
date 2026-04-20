# Integration Map: Research Module ↔ Existing PolicyDash Modules

**Project:** PolicyDash Research Module
**Researched:** 2026-04-19

All table and file references are to the actual codebase at the paths shown.

---

## 1. Evidence Vault (`src/db/schema/evidence.ts`)

### Current state

`evidence_artifacts` holds file/link records. It is linked to feedback via
`feedback_evidence(feedbackId, artifactId)` and to sections via
`section_evidence(sectionId, artifactId)`. It also has a nullable `milestoneId`
column (FK constraint in SQL migration only to avoid circular import).

### Integration point

Research items that are files (reports, papers, datasets, transcripts) **reuse
`evidence_artifacts` as their binary storage record**. The `research_items` table
carries a nullable `artifactId` FK pointing to an `evidence_artifacts` row.

**Why this works:**
- The R2 upload endpoint (`app/api/upload/route.ts`) already creates `evidence_artifacts`
  rows. A research_lead uploading a PDF goes through the same upload flow.
- The `evidenceArtifacts.type` enum (`file` | `link`) already covers both cases.
- Binary storage, file name, file size, and uploader are already normalised there.

**What research_items adds on top:**
Citation metadata (authors, DOI, publicationDate, peerReviewed), moderation state
(`pending_review`, `published`, `retracted`), section/version links, and anchor fields.
These do NOT belong on `evidence_artifacts` — that table is intentionally thin.

**What NOT to do:** Do not add lifecycle columns to `evidence_artifacts`. That table
is used by feedback, sections, workshops, and milestones. Adding status/review fields
there would affect all those consumers.

---

## 2. Workshops Module (`src/db/schema/workshops.ts`)

### Current state

Workshops produce `workshop_artifacts` (records in `evidence_artifacts` typed as
`promo`, `recording`, `transcript`, `summary`, `attendance`, `other`). A completed
workshop's transcript and summary are artifacts in `workshop_artifacts`.

### Integration point

A workshop-produced transcript can be **elevated to a research item** by the research_lead.
The flow:

1. Workshop completes → Groq generates transcript + summary → stored as
   `workshop_artifacts` rows referencing `evidence_artifacts` rows.
2. Research lead reviews the transcript. If it meets publication quality, they create
   a `research_items` row with `itemType = 'interview_transcript'`, linking to the
   existing `evidence_artifacts` row via `artifactId`.
3. The research item then goes through draft → pending_review → published.

This is a create-from-existing flow, not automatic promotion. The Inngest pipeline does
not need to change — research item creation is a manual research_lead action.

**Linking table:** `research_item_section_links` can reference the same `policySections`
that `workshopSectionLinks` already links. If a workshop was scoped to sections A, B, C,
the resulting research item can be linked to the same sections without duplicating any data.

---

## 3. Versioning / Document Versions (`src/db/schema/changeRequests.ts`)

### Current state

`document_versions` has `sectionsSnapshot`, `changelog`, `publishedAt`, `isPublished`,
`consultationSummary` (JSONB), and nullable `milestoneId` and `txHash`. The `version.publish`
Inngest event triggers both `consultationSummaryGenerateFn` and `versionAnchorFn`.

### Integration point

`research_item_version_links(researchItemId, versionId)` allows policy leads and
research leads to tag which version(s) a research item informed.

**Two uses:**
1. **Prospective:** Before publishing v1.3, a policy lead links the research items that
   justified the changes in that version. This makes the traceability chain
   `research_item → version → CR → feedback` navigable from the public portal.
2. **Retrospective:** After publishing, research items can still be linked to confirm
   which evidence base was available at that version's cut-off.

**What to avoid:** Do not add a `researchItemId` column directly to `document_versions`.
A version may be informed by multiple research items; one-to-many via FK is insufficient.

---

## 4. Milestones (`src/db/schema/milestones.ts`)

### Current state

`milestones` has `requiredSlots: { versions?, workshops?, feedback?, evidence? }` and a
`manifest: ManifestEntry[]` where each entry is `{ entityType, entityId, contentHash }`.
`ManifestEntry.entityType` currently accepts `'version' | 'workshop' | 'feedback' | 'evidence'`.

### Integration point

When a milestone is being assembled, the research_lead (or admin) can include published
research items in the milestone's evidence bundle. This requires:

1. **Adding `'research_item'` to `ManifestEntry.entityType`** — a one-line type change
   in `milestones.ts`.
2. **Adding `research_items?: number` to `RequiredSlots`** — optional, same JSONB pattern.
3. **Adding `milestoneId` nullable FK on `research_items`** — same pattern as
   `workshops.milestoneId` and `evidence_artifacts.milestoneId` (SQL-constraint-only
   to avoid circular import).

The `milestoneReadyFn` in `src/inngest/functions/` already iterates manifest entries
to compute the milestone hash. Research items participate automatically once `entityType`
is extended.

---

## 5. Change Requests & Feedback (`src/db/schema/changeRequests.ts`, `src/db/schema/feedback.ts`)

### Current state

`crFeedbackLinks` links feedback to CRs. `feedbackEvidence` links evidence artifacts to
feedback. The traceability chain is `feedback → CR → section → version`.

### Integration point

`research_item_feedback_links(researchItemId, feedbackId)` allows a feedback submission
or a CR to cite a published research item. This extends the traceability chain to:

`research_item → feedback → CR → section → version`

Making this navigable from the traceability matrix (Phase 7 UI at `app/audit/`) is a
follow-on enhancement. The linking table alone is sufficient for v0.2.

**Permission note:** `feedback:submit` is granted to `stakeholder`, `research_lead`, and
`workshop_moderator` (see `src/lib/permissions.ts` L34). Research leads can already
submit feedback, so citing research items in their own feedback is consistent with their
existing role.

---

## 6. Cardano Anchoring (`src/lib/cardano.ts`, `src/inngest/functions/`)

### Current state

Two anchoring pipelines exist:
- `milestoneReadyFn` — anchors completed milestones via `milestone.ready` event
- `versionAnchorFn` — anchors each published version via `version.published` event

Both use `src/lib/cardano.ts` which wraps `@meshsdk/core` + Blockfrost, builds CIP-10
label 674 metadata, and has 3-layer idempotency via `txHash` UNIQUE index.

### Integration point

**Should research items be anchored?** Yes — selectively, not automatically.

**What anchoring proves for a research item:**
- At time T, the research item with this exact content (SHA-256 of canonical JSON) was
  published and marked as evidence for this policy consultation.
- Retraction or edit AFTER anchoring is detectable (the current content hash no longer
  matches the on-chain hash).

**Recommended approach:** Anchor on publish (when `status` transitions to `published`),
not on every edit. This mirrors `versionAnchorFn`. The research_lead or admin triggers
publication; Inngest handles the anchor asynchronously.

**Required changes:**
- New `research_item_published` Inngest event (parallel to `version.published`).
- New `researchItemAnchorFn` — identical structure to `versionAnchorFn` with
  `entityType: 'research_item'` in the CIP-10 metadata.
- `research_items.contentHash`, `research_items.txHash`, `research_items.anchoredAt`
  columns (already identified in DOMAIN.md).

**Not required:** Changes to `cardano.ts` or `milestoneReadyFn`. Reuse is clean.

---

## 7. Public Shell (`app/(public)/`)

### Current state

`app/(public)/research/page.tsx` is a 92-line static server component. It has four
prose sections (Overview, Key Themes, Research Outputs, Shape This Policy) and a
`ResearchTocAside` client component. `proxy.ts` already whitelists `/research(.*)`.

### Integration point

New routes slot in under the existing public shell without touching the existing page:

```
app/(public)/research/page.tsx        ← UNTOUCHED (existing static editorial)
app/(public)/research/items/page.tsx  ← NEW (filterable listing)
app/(public)/research/items/[id]/page.tsx  ← NEW (detail + download)
```

The public layout (`app/(public)/layout.tsx`) already applies `.cl-landing` styles and
Newsreader/Inter fonts. New pages inherit these automatically.

`proxy.ts` wildcard `/research(.*)` already covers `/research/items` and
`/research/items/[id]` — no changes needed to middleware.

---

## 8. RBAC (`src/lib/permissions.ts`)

### Current state

`research_lead` currently has read-only access to most entities. It has:
- `feedback:submit` (can submit feedback)
- `evidence:upload` (can upload artifacts)
- `workshop:read` (can read workshops)
- `document:read` (can read documents)
- `version:read` (can read versions)

No permissions exist for research item management.

### New permissions required

| Permission | Grantees | Notes |
|-----------|----------|-------|
| `research:create` | `research_lead`, `admin` | Create draft items |
| `research:manage_own` | `research_lead`, `admin` | Edit/delete own drafts |
| `research:submit_review` | `research_lead`, `admin` | Submit for review |
| `research:publish` | `admin`, `policy_lead` | Approve and publish |
| `research:retract` | `admin`, `policy_lead` | Retract published items |
| `research:read_drafts` | `admin`, `policy_lead`, `research_lead` | See unpublished items |
| `research:read_published` | ALL authenticated roles + (public) | Published items are public |

---

## Integration Diagram

```
research_items
    │
    ├─ artifactId ──────────────► evidence_artifacts (file storage via R2)
    │
    ├─ documentId ──────────────► policy_documents
    │
    ├─ milestoneId ─────────────► milestones (manifest entry, optional)
    │
    ├─ previousVersionId ───────► research_items (self-FK, versioning chain)
    │
    ├─ txHash / contentHash ────► Cardano (via researchItemAnchorFn, reuses cardano.ts)
    │
    ├── research_item_section_links ──► policy_sections
    │
    ├── research_item_version_links ──► document_versions
    │
    └── research_item_feedback_links ──► feedback
```
