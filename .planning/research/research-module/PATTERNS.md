# Platform Patterns: Research Item Management

**Domain:** Policy consultation platforms
**Researched:** 2026-04-19

---

## How Comparable Platforms Handle Research Items

### Regulations.gov (U.S. Federal Rulemaking)

**Model:** The rulemaking docket is the unit of organisation. A docket contains the
Proposed Rule, all supporting documents (economic analyses, environmental analyses,
referenced studies), all public comments, and the Final Rule. Every document in the
docket is typed: `Notice`, `Proposed Rule`, `Rule`, `Public Submission`, `Other`.

**Linking pattern:** Documents link to a docket via `docketId` (string ID) — flat FK,
not many-to-many. There is no section-level linking; linking is always to the entire
rulemaking, not a sub-section of a proposed rule.

**Metadata:** Each document has `documentId`, `postedDate`, `agencyId`, `docketId`,
`documentType`, and an optional `attachments[]` array of binary files. No DOI, no
peer-review status, no version chain.

**Source:** [ACUS report on improving Regulations.gov docket access](https://www.acus.gov/document/improving-access-regulationsgovs-rulemaking-dockets)

**Relevance to PolicyDash:** The docket pattern is equivalent to PolicyDash's
`milestoneId` grouping. The document type enum maps to our `itemType`. The Regulations.gov
approach is flat — no section-level links — which is intentionally simpler than what
PolicyDash needs.

---

### Decidim (Open-Source Participatory Democracy)

**Model:** Decidim uses "Participatory Texts" — a document is split into `Proposal` rows
where each paragraph or article is a separate `Proposal`. Researchers and citizens can
comment on or amend individual paragraphs. The document is managed as a collection of
proposals, not as a monolithic uploaded file.

**States:** `draft → published` for the overall participatory text document. Individual
proposals (paragraphs) have their own lifecycle: `not_answered → evaluating →
accepted/rejected/withdrawn`.

**Linking:** Proposals link to a `ParticipatoryProcess` (the policy process entity),
not to individual sections of a policy document. No many-to-many section links.

**Metadata:** Authors, body text, vote counts, amendment tracking. No DOI, no file
attachment beyond inline content, no peer-review status.

**Source:** [Decidim Participatory Texts docs](https://docs.decidim.org/en/develop/admin/components/proposals/participatory_texts.html) (404 at time of research — confirmed via GitHub README and issue #3752)

**Relevance to PolicyDash:** The paragraph-as-proposal pattern is the inspiration for
PolicyDash's section-level feedback. For research items specifically, Decidim's model
is too granular and too comment-focused — PolicyDash needs citable documents, not
inline text collaboration. Decidim's `draft → published` document lifecycle maps
directly to our state machine.

---

### Crossref / DataCite (Academic Citation Standards)

**Versioning relations (HIGH confidence, from official documentation):**

| Relation | Meaning |
|----------|---------|
| `IsNewVersionOf` | This item supersedes the referenced item |
| `IsPreviousVersionOf` | The referenced item supersedes this item |
| `HasVersion` / `IsVersionOf` | Canonical-DOI to specific-version linking |
| `hasPreprint` / `isPreprintOf` | Preprint → published record |

**Retraction pattern:** Do NOT delete or overwrite the original record. Deposit a
separate document with `<update type="retraction">` pointing at the original DOI.
Prefix the original title with `RETRACTED:` in its metadata. This preserves the audit
trail while flagging integrity failure.

**Metadata fields researchers expect:**

| Field | Notes |
|-------|-------|
| `title` | Document title |
| `authors` | Ordered list (family, given, ORCID optional) |
| `publicationDate` | ISO date of original publication |
| `doi` | Digital Object Identifier (optional for grey literature) |
| `peerReviewed` | Boolean or review type |
| `abstract` / `description` | Summary |
| `version` | Semantic or natural language version label |
| `resourceType` | `report`, `dataset`, `paper`, `text`, etc. |

**Source:** [Crossref versioning best practices](https://www.crossref.org/documentation/principles-practices/best-practices/versioning/), [DataCite relationType appendix](https://datacite-metadata-schema.readthedocs.io/en/4.5/appendices/appendix-1/relationType/)

**Relevance to PolicyDash:** The `IsNewVersionOf` self-FK pattern on `research_items`
is the correct industry standard. The retraction-as-separate-record pattern means we
set `status = 'retracted'` + populate `retractionReason` rather than deleting rows.

---

### Cardano CIP-0100 (Governance Metadata Anchoring)

**Model:** Any governance document can be anchored by publishing a JSON-LD file
externally (IPFS/Arweave/any URL) and submitting a Cardano transaction whose metadata
contains `{ uri, hash }` where `hash` is the `blake2b-256` of the raw bytes at that URI.

**Fields on the anchor:**
```json
{
  "hashAlgorithm": "blake2b-256",
  "authors": [...],
  "body": { ... },
  "@context": "...",
  "@type": "..."
}
```

**Source:** [CIP-0100 README](https://github.com/cardano-foundation/CIPs/blob/master/CIP-0100/README.md) (HIGH confidence — official Cardano Foundation repository)

**Relevance to PolicyDash:** PolicyDash already uses SHA-256 (not blake2b-256) for
`milestones.contentHash` and `documentVersions.txHash`. The existing `cardano.ts` and
`milestoneReadyFn` pipeline (CIP-10 label 674 metadata, Mesh SDK) is the anchor
infrastructure for research items. Research items should reuse that pipeline unchanged;
only the `entityType` field in the manifest changes.

---

### Public Research Page Conventions (Multi-Source Synthesis)

Observed across Regulations.gov, OECD iLibrary, ODI (Overseas Development Institute),
NITI Aayog document portal, and academic repository UIs (Zenodo, SSRN):

**Standard filter facets:**
- Document type (report / paper / dataset / etc.)
- Date range (publication date)
- Policy section / topic tag
- Author / organisation
- Status (all / published / retracted)

**Standard card fields:**
- Title (linked to detail page)
- Type badge
- Author(s) + source/publisher
- Publication date
- Excerpt/abstract (2-3 lines)
- Download CTA (if file) or "View source" (if URL)

**Standard detail page sections:**
- Full metadata header (title, type, authors, date, DOI if present, peer-review flag)
- Abstract / description
- Linked policy sections (which sections this informs)
- Download / external link button
- Version history (if versioned)
- Anchor/verification badge (PolicyDash-specific)

**Download flow:**
- Files: presigned R2 GET URL (24h expiry, same pattern as evidence pack export in
  `evidencePackExportFn`) — NOT a direct S3 link
- External URLs: open in new tab via `target="_blank" rel="noopener noreferrer"`

---

## Pattern Summary for Phase Design

| Pattern | Source | Confidence | Apply to PolicyDash |
|---------|--------|------------|---------------------|
| `draft → pending_review → published → retracted` lifecycle | Decidim, COPE retraction guidelines | HIGH | Yes — four-state enum |
| `IsNewVersionOf` self-FK on items table | Crossref, DataCite | HIGH | Yes — `previousVersionId` on `research_items` |
| Retraction = status flag, NOT delete | Crossref, COPE | HIGH | Yes — `status='retracted'` + `retractionReason` |
| Many-to-many section links | PolicyDash existing patterns | HIGH | Yes — `research_item_section_links` table |
| DOI + `peerReviewed` + `authors` metadata fields | DataCite schema 4.7 | HIGH | Yes — optional fields on `research_items` |
| Presigned URL download (not direct R2 link) | PolicyDash existing (`evidencePackExportFn`) | HIGH | Yes — reuse R2 presign pattern |
| Flat docket-style linking (docket = document) | Regulations.gov | MEDIUM | Partial — `documentId` FK satisfies this |
| Cardano SHA-256 anchoring per item | CIP-0100, PolicyDash `milestones.ts` | HIGH | Optional per item, reuse existing pipeline |
| Public listing with type/date/section filters | ODI, Zenodo, OECD iLibrary | MEDIUM | Yes — standard facets for `/research/items` |
