# Phase 22: Milestone Entity + SHA256 Hashing Service - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 22-milestone-entity-sha256-hashing-service
**Areas discussed:** Milestone identity & scope, Canonicalization approach, Milestone hash composition, Required slots + admin assignment UX

---

## Milestone Identity & Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Per-policy snapshot (Recommended) | One milestone = one policyDocument + its published versions + linked workshops/feedback/evidence for THAT policy. milestones.documentId NOT NULL. Admin navigates via /policies/[id]/milestones. Matches buildEvidencePack(documentId) shape and per-policy public portal (/portal/[policyId]). | ✓ |
| Cross-policy release snapshot | One milestone spans many policies ("Q1 2026 Release"). milestones.documentId omitted or NULLABLE. Top-level /milestones admin page. Hash covers a manifest of version-IDs across docs. Good for quarterly releases bundling multiple policies. | |
| Free-form admin bucket | Admin defines scope entirely at create time — just a name + description, then picker for any entities. No implicit 1-per-doc rule. Most flexible, least invariant, hardest to auto-verify downstream. | |

**User's choice:** Per-policy snapshot
**Notes:** Aligns with the existing `buildEvidencePack(documentId)` composition shape and the per-policy public portal at `/portal/[policyId]`. Multiple milestones per policy allowed for sequential releases. Derived constraint: per-version content hash must be position-independent so Phase 23's per-version anchor path produces the same hex whether the version is hashed standalone or as part of a milestone manifest.

---

## Canonicalization Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Zero-dep recursive key-sort (Recommended) | Write a ~30-line canonicalize() in src/lib/hashing.ts: recursively sort object keys alphabetically, then JSON.stringify. Matches 'in-code only' philosophy. Full auditability. Golden fixtures + permutation tests lock behavior. Edge cases like IEEE 754 negative zero / scientific notation don't apply to our inputs (UUIDs, strings, ints, ISO8601, Tiptap JSONB). | |
| RFC 8785 JCS via canonicalize npm package | ~1KB zero-dep package implementing the full RFC 8785 Canonical JSON spec. Handles number normalization + Unicode NFC. One more dep but trivial. Safer if we ever hash inputs from external sources. Provides formal spec compliance in case auditors/regulators want it. | |
| Both — library as impl, wrap in our own function | Use canonicalize package internally but expose a project-local wrapper (src/lib/hashing.ts) so we can swap implementations later. Golden fixtures lock the wrapper's output, not the library's internals. Hedges against library maintenance risk. | ✓ |

**User's choice:** Hybrid — library backs the impl, local wrapper is the public interface
**Notes:** Formal RFC 8785 compliance is preserved via the library; golden fixtures lock the **wrapper's** output so we can swap to a zero-dep implementation later without fixture drift. Researcher must confirm `canonicalize` package name, maintenance status, and zero-dep claim before planning; a different package or a zero-dep port is acceptable as long as the wrapper signature stays stable.

---

## Milestone Hash Composition

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid manifest (Recommended) | Each child gets its own content hash (per-version hash reusable by Phase 23's per-version anchor). Milestone has an explicit manifest: [{entityType, entityId, contentHash}] sorted by (type, id), stored as JSONB on the milestone row. Milestone hash = SHA256(canonical(manifest + milestone metadata)). Single hash goes to Cardano; manifest lives locally for re-verification. Matches Git commit / OCI manifest model. Auditors can re-verify any child independently. | ✓ |
| Pure Merkle hash-of-hashes | Each child gets its own content hash; milestone hash = SHA256(canonical(sorted list of child hashes + milestone metadata)). No explicit manifest stored — child hashes are re-derived on demand. Lighter storage but re-verification requires walking every child row and re-computing. | |
| Flat canonical blob | Collect all linked entity DATA (not hashes) into one big object, canonicalize the whole thing, single SHA256. Simplest implementation. BUT breaks Phase 23 SC-6 (per-version anchor needs version-level hashes anyway) and re-verification requires re-fetching every source row. Adding one feedback row forces full re-canonicalize of everything. | |

**User's choice:** Hybrid manifest
**Notes:** Per-child hashes are reusable by Phase 23's per-version anchor path (version gets its own Cardano tx regardless of milestone membership). Only the root milestone hash goes into the Cardano tx metadata; the manifest stays local on the milestone row for auditor re-verification. Models after Git commit objects, not OCI image manifests.

---

## Required Slots (Ready Transition Gate)

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-defined JSONB per milestone (Recommended) | milestones.requiredSlots: jsonb = { versions: N, workshops: N, feedback: N, evidence: N } (min counts per entity type). Admin sets requirements at create time. state transition guard checks counts against linked entities. Most flexible — supports version-only milestones, consultation-complete milestones, full-cycle milestones without extra enum. | ✓ |
| Fixed 4-slot template | Every milestone requires ≥1 published version, ≥1 completed workshop, ≥1 closed feedback, ≥1 evidence artifact. Simple invariant, clear failure messages. Breaks down for legitimate 'version-only' milestones (e.g., minor revision with no workshop). | |
| Enum milestoneType driving template | milestones.type enum: 'full_cycle' \| 'version_only' \| 'consultation_complete'. Each implies its own slot requirements in code. Opinionated, fewer edge cases, but requires schema change to add a new template. | |

**User's choice:** Admin-defined JSONB per milestone
**Notes:** Supports version-only milestones (minor revision anchoring) without requiring schema changes. Transition guard is a tRPC mutation that returns structured errors listing unmet slots so the admin UI can explain what's missing.

---

## Admin Assignment UX

| Option | Description | Selected |
|--------|-------------|----------|
| Create-then-curate on detail page (Recommended) | Admin creates empty milestone → navigates to detail page → tabs for Versions/Workshops/Feedback/Evidence show available-but-unattached rows → checkbox add/remove. Iterative curation until slots filled, then 'Mark ready' button enables. Post-ready is immutable. Matches 'admin views detail page showing all linked entities' from ROADMAP. | ✓ |
| Explicit picker on create modal | Create-milestone modal has 4 tabs with checkboxes for all entities. Admin commits everything upfront. Less iterative but simpler state model (no 'empty' milestones). Harder UX for large catalogs. | |
| Auto-link by date range | Admin sets fromDate/toDate on milestone; all versions.publishedAt / workshops.scheduledAt / feedbackItems.createdAt / evidenceArtifacts.createdAt within window auto-link. Zero manual assignment. Breaks down for edge cases and removes admin agency over what belongs in a milestone. | |

**User's choice:** Create-then-curate on detail page
**Notes:** Iterative curation matches the ROADMAP success criterion 3 ("Admin can view a milestone detail page showing all linked entities and click 'Mark milestone ready'"). Post-`anchored` UI is read-only.

---

## Follow-up: Areas Deferred to Claude's Discretion

User opted NOT to discuss the following after the 5 core decisions were locked. These are captured in `22-CONTEXT.md` under `### Claude's Discretion` with recommended defaults:

- Immutability enforcement layer (DB trigger vs app guard vs both)
- Hash storage shape (contentHash column vs + canonicalJson blob)
- Hash algo prefix (`sha256:...` vs plain hex)
- Entity-type hash input field shapes (exact column sets per entity)
- Role authorization (admin-only vs admin+moderator)
- Partial index pattern for `milestoneId` FKs
- Migration file naming (`0014_milestones_hashing.sql`)

## Deferred Ideas (Not in Scope)

Captured in `22-CONTEXT.md` `<deferred>`:

- Cardano tx submission, Mesh SDK, Blockfrost pre-check, per-version anchor trigger (all Phase 23)
- Public Verified State badges + Cardanoscan links (Phase 23)
- DB trigger for anchored UPDATE rejection (deferred unless Nyquist flags a gap)
- Hash algorithm migration infrastructure (deferred until needed)
- Storing full canonical JSON blob for audit (re-derivable on demand)
- Auto-link entities by date range (rejected)
- Cross-policy release milestones (rejected — D-01 picks per-policy)
