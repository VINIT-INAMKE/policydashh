# Phase 22: Milestone Entity + SHA256 Hashing Service - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a first-class `milestones` entity + a deterministic content-hashing service (`src/lib/hashing.ts`) stable enough that Phase 23 can anchor the hash to Cardano without the hash ever drifting due to JSON key order, array ordering, or nested-object serialization quirks.

Scope:
- `milestones` table with `defining → ready → anchoring → anchored` state machine and admin-defined required-slot definitions
- Nullable `milestoneId` FK on `documentVersions`, `workshops`, `feedbackItems`, `evidenceArtifacts` (each with partial index `WHERE milestoneId IS NOT NULL`)
- `src/lib/hashing.ts` producing deterministic SHA256 hashes for `policyVersion`, `workshop`, `evidenceBundle`, `milestone` inputs
- RFC 8785 JCS canonicalization pass before hashing
- Admin milestone detail page showing linked entities + "Mark ready" button
- Golden-fixture tests verifying hash stability across permuted inputs, nested objects, and array orderings
- Immutability enforcement after `anchored`

Out of scope (belongs in Phase 23):
- Cardano tx submission, Mesh SDK + Blockfrost wiring
- `milestoneReady` Inngest function orchestration
- Per-version `version.published` anchor triggers
- Public `/portal` Verified State badges
- Cardanoscan explorer links

</domain>

<decisions>
## Implementation Decisions

### Milestone Identity & Scope
- **D-01:** A milestone is a **per-policy snapshot**. `milestones.documentId uuid NOT NULL REFERENCES policy_documents(id)`. One milestone always belongs to exactly one `policyDocument`. Multiple milestones per policy are allowed (sequential releases, e.g., "v1.0 milestone", "v2.0 milestone"). Admin navigates via `/policies/[id]/milestones` (nested under the existing per-policy workspace, not a top-level route).
- **D-01a:** Because Phase 23 SC-6 requires a per-version anchor on every `version.published` event (independent of milestones), the **per-version content hash must be position-independent** — i.e., hashing a `documentVersion` standalone must produce the same hash as hashing it as a child of a milestone manifest. This is a hash-function constraint, not a schema constraint.

### Canonicalization
- **D-02:** Use the `canonicalize` npm package (RFC 8785 JCS implementation) wrapped behind a project-local export: `src/lib/hashing.ts` → `export function canonicalize(input: unknown): string`. Golden-fixture tests lock the **wrapper's** output, not the library's internals, so we can swap implementations later without fixture drift. Researcher must confirm exact package name, current maintenance status, and zero-dep status before planning — a zero-dep alternative is acceptable if `canonicalize` is unmaintained.
- **D-02a:** All hashing happens through `src/lib/hashing.ts`. No direct `node:crypto.createHash('sha256')` calls outside that module. Existing `node:crypto` precedents in `src/lib/feedback-token.ts` and `src/lib/cal-signature.ts` (HMAC use cases) are NOT this module — hashing service is net-new.

### Hash Composition (Merkle / Manifest)
- **D-03:** **Hybrid manifest model.** Each linked child entity (version, workshop, feedback, evidence) gets its own deterministic content hash via `hashPolicyVersion()`, `hashWorkshop()`, `hashEvidenceBundle()`. The milestone row stores an explicit manifest as JSONB: an array of `{ entityType: 'version'|'workshop'|'feedback'|'evidence', entityId: uuid, contentHash: string }` tuples sorted deterministically by `(entityType, entityId)`. The milestone hash is then `SHA256(canonicalize({ manifest, metadata: { milestoneId, documentId, title, createdAt, requiredSlots } }))`. The single milestone hash is what goes into the Cardano tx metadata (Phase 23, CIP-10 label 674); the manifest stays local on the milestone row for auditor re-verification of any specific child.
- **D-03a:** Per-child content hashes MUST be computable from a single row + its immediate composition inputs (e.g., `hashPolicyVersion(version)` reads `documentVersions.sectionsSnapshot` + `changelog` + `versionLabel` + `publishedAt` + `documentId` — all already materialized in the row). No joins required for per-child hashing. This is what makes them reusable by Phase 23's per-version anchor path.

### Required Slots & State Transition
- **D-04:** `milestones.requiredSlots: jsonb NOT NULL DEFAULT '{}'::jsonb`, shape `{ versions: number, workshops: number, feedback: number, evidence: number }` (minimum counts per entity type; any key omitted or zero means that type is not required). Admin sets slots at create time. `defining → ready` transition is a tRPC mutation that checks `COUNT(linked_entities WHERE milestoneId = m.id) >= requiredSlots[entityType]` for every non-zero slot. If any slot unmet, mutation fails with a structured error listing unmet slots.
- **D-04a:** State enum: `milestone_status` with values `'defining' | 'ready' | 'anchoring' | 'anchored'`. Initial state is `defining`. `ready → anchoring` transition belongs to Phase 23's Inngest function. `anchoring → anchored` transition belongs to Phase 23 post-tx-confirmation. Phase 22 only ships the `defining → ready` path + the DB schema for all 4 states.

### Admin Assignment UX
- **D-05:** **Create-then-curate** workflow. Admin creates an empty milestone (name, description, `requiredSlots`) from the `/policies/[id]/milestones` index. Lands on `/policies/[id]/milestones/[milestoneId]` detail page. Four tabs — Versions / Workshops / Feedback / Evidence — each list entities belonging to this policy that are NOT yet attached to any milestone of this policy, plus entities already attached to THIS milestone. Checkbox add/remove mutations update nullable `milestoneId` FK. Detail page header shows current slot status ("Versions: 2/1 ✓, Workshops: 0/1 ✗") and a "Mark ready" button disabled until all slots met. Post-`anchored` the UI is read-only.

### Claude's Discretion
The following were deliberately not discussed in depth — Claude (planner + executor) decides:

- **Immutability enforcement layer** — recommended: app-level guard inside the tRPC mutation + Drizzle service layer + a DB CHECK constraint on the state column preventing backwards transitions. Full DB trigger deferred unless Nyquist validation flags a gap.
- **Hash storage shape** — recommended: store `contentHash text NOT NULL`, `manifest jsonb NOT NULL`, and `canonicalJsonBytesLen integer` for audit metadata. Do NOT store the full canonical JSON blob on the row (re-derivable from manifest + children; storing it duplicates DB size). Auditors re-derive on demand.
- **Hash algorithm prefix** — recommended: store the raw 64-char hex without prefix (`contentHash text NOT NULL CHECK (contentHash ~ '^[0-9a-f]{64}$')`); algo is `sha256` by invariant, not by column. If we ever migrate algos, a new column `hashAlgo` gets added then. Matches `emailHash` pattern in `workshop_registrations`.
- **Role authorization** — recommended: `admin` and `moderator` can create + curate + mark-ready milestones, following Phase 21's consultation-summary review pattern. `auditor` read-only. No new role needed.
- **Hash input field shapes per entity type** — recommended: hash only **content-defining** fields, NOT bookkeeping. For `policyVersion`: `{ id, documentId, versionLabel, sectionsSnapshot, changelog, publishedAt, createdBy }`. **Exclude** `consultationSummary` (generated AFTER publish, would break hash stability) and `isPublished` / `updatedAt` (bookkeeping). For `workshop`: `{ id, title, scheduledAt, durationMinutes, status, createdBy, linkedArtifactIds: uuid[], linkedFeedbackIds: uuid[] }` — explicit FK arrays, sorted, instead of embedded blobs. For `feedbackItems`: `{ id, readableId, sectionId, documentId, feedbackType, priority, impactCategory, title, body, suggestedChange, status, decisionRationale, reviewedBy, reviewedAt, resolvedInVersionId, isAnonymous }`. For `evidenceArtifacts`: `{ id, title, type, url, fileName, fileSize, uploaderId, content }`. Exact shapes are locked by golden fixtures in `src/lib/__tests__/hashing.test.ts`.
- **Partial index pattern** — recommended: `CREATE INDEX CONCURRENTLY idx_document_versions_milestone_id ON document_versions (milestone_id) WHERE milestone_id IS NOT NULL;` (and similar on workshops / feedback / evidence_artifacts). Migration uses `CREATE INDEX IF NOT EXISTS` without `CONCURRENTLY` since our migrations run in transactions.
- **Migration file** — recommended: `0014_milestones_hashing.sql` containing the milestone_status enum, milestones table, 4 `ALTER TABLE ADD COLUMN milestone_id` statements, 4 partial indexes, and a CHECK constraint on `contentHash` format.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, executor) MUST read these before planning or implementing.**

### Phase 22 requirements & goals
- `.planning/ROADMAP.md` §495–507 — Phase 22 goal, dependency on Phase 18, success criteria 1–6 (required-slot definitions, immutability after anchored, `src/lib/hashing.ts` location, RFC 8785 JCS canonicalization, golden-fixture determinism tests)
- `.planning/REQUIREMENTS.md` §216–220 — VERIFY-01 through VERIFY-05 (milestones table, FK topology, admin mark-ready action, hashing service file path, canonicalization + golden fixtures)
- `.planning/PROJECT.md` §11–28 — v0.2 "Verifiable Policy OS" framing, "All automation in-code via Inngest (no n8n, Zapier, Tally, Airtable); only external dependencies are cal.com, Groq, Blockfrost, Clerk" constraint

### Phase 23 downstream constraints (inform hash shape + storage decisions)
- `.planning/ROADMAP.md` §509–523 — Phase 23 `milestoneReady` Inngest 5-step pipeline (compute-hash → persist-hash → check-existing-tx → submit-tx → confirm-loop), Blockfrost `/metadata/txs/labels/:label` pre-check requires hash retrievability, CIP-10 label 674 metadata JSON shape `{ project, type, hash, milestoneId, timestamp }`, 3-layer idempotency (DB UNIQUE + Blockfrost pre-check + Inngest `concurrency: { key: 'cardano-wallet', limit: 1 }`)
- `.planning/REQUIREMENTS.md` §221–224 — VERIFY-06 through VERIFY-09 (per-version anchor trigger, idempotency guarantees, Verified State badges)

### Existing schema — add nullable `milestoneId` FK to all 4
- `src/db/schema/changeRequests.ts` §13–28 — `documentVersions` table, `sectionsSnapshot` / `changelog` / `consultationSummary` JSONB shape, `uq_document_version(documentId, versionLabel)` precedent
- `src/db/schema/workshops.ts` §32–45 — `workshops` table, linked child tables (`workshopArtifacts`, `workshopSectionLinks`, `workshopFeedbackLinks`, `workshopEvidenceChecklist`, `workshopRegistrations`)
- `src/db/schema/feedback.ts` §26–48 — `feedbackItems` table, XState snapshot field, `resolvedInVersionId` linkage
- `src/db/schema/evidence.ts` §8–32 — `evidenceArtifacts` + `feedbackEvidence` + `sectionEvidence` join tables
- `src/db/schema/documents.ts` §3–10 — `policyDocuments` table (milestones FK target), `is_public_draft` column from Phase 20.5
- `src/db/schema/index.ts` — barrel exports; new `milestones.ts` file must be added here

### Migration patterns to follow
- `src/db/migrations/0011_cal_com_workshop_register.sql` — idempotent enum creation via `DO $$ BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`, nested FK with `ON DELETE SET NULL` / `CASCADE`
- `src/db/migrations/0013_consultation_summary.sql` — minimal JSONB column addition pattern
- Next slot is `0014_milestones_hashing.sql`
- `drizzle.config.ts` — schema at `./src/db/schema`, out at `./src/db/migrations`, `postgresql` dialect

### Hashing crypto precedents (NOT to be reused — informational)
- `src/lib/cal-signature.ts` — `createHmac` HMAC-SHA256 pattern, `timingSafeEqual` comparison. HMAC not raw hash, but same `node:crypto` import style.
- `src/lib/feedback-token.ts` — `createHmac` for JWT-style token signing. Same import style.
- `src/inngest/functions/participate-intake.ts` §48–64 and `src/inngest/events.ts` §230, §291 — existing `emailHash` SHA-256 hex regex `^[0-9a-f]{64}$` is the precedent for hash column CHECK constraint format.

### Evidence pack composition precedent (Phase 18)
- `src/server/services/evidence-pack.service.ts` — `buildEvidencePack(documentId)` builds stakeholder CSV, feedback matrix CSV, version history JSON, workshop evidence listing, decision logs. Phase 18 ZIP assembly uses `zipSync` + R2 upload. For Phase 22's `hashEvidenceBundle()`, we do NOT hash the ZIP bytes — we hash the **input manifest** (artifact IDs + titles + types + URLs + content field) via `canonicalize + SHA256`, because ZIP compression is non-deterministic across Node versions.
- `.planning/phases/18-async-evidence-pack-export/18-00-PLAN.md` — Wave 0 test contract for evidence pack Inngest pipeline (useful for understanding the async fn pattern Phase 23 will follow)

### Service layer pattern
- `src/server/services/consultation-summary.service.ts` — Phase 21 "pure TS, cross-Inngest-boundary-safe" service with exported types. `src/lib/hashing.ts` should follow the same pattern: pure functions, explicit type imports, no side effects, no DB access inside the hashing module.

### tRPC router + audit log precedent
- `src/server/routers/consultation-summary.ts` — Phase 21's 5-procedure pattern with `writeAuditLog` + action constants. The milestone router should follow this shape for `create`, `attachEntity`, `detachEntity`, `markReady` procedures (action constants: `MILESTONE_CREATE`, `MILESTONE_ATTACH_ENTITY`, `MILESTONE_DETACH_ENTITY`, `MILESTONE_MARK_READY`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **4 target tables already exist** and just need `milestoneId uuid REFERENCES milestones(id)` (nullable, no cascade since milestones are additive metadata):
  - `documentVersions` in `src/db/schema/changeRequests.ts:13`
  - `workshops` in `src/db/schema/workshops.ts:32`
  - `feedbackItems` in `src/db/schema/feedback.ts:26`
  - `evidenceArtifacts` in `src/db/schema/evidence.ts:8`
- `documentVersions.sectionsSnapshot jsonb` is already an immutable point-in-time capture — perfect input for `hashPolicyVersion()` with zero additional joins.
- `src/db/schema/index.ts` barrel exports all schema files; adding `./milestones` there registers the new table with Drizzle automatically.
- `node:crypto` is the established hashing runtime (3 existing usages). `createHash('sha256').update(canonicalized).digest('hex')` is the one-liner.

### Established Patterns
- **Raw idempotent SQL migrations** (not drizzle-generated) — every migration uses `IF NOT EXISTS` + `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object` so re-running is safe. Next slot `0014_milestones_hashing.sql`.
- **Drizzle schema + TypeScript types** co-located in `src/db/schema/<domain>.ts`. New file: `src/db/schema/milestones.ts`.
- **JSONB `$type<>()` assertion for structured payloads on rows** — `documentVersions.consultationSummary: jsonb.$type<ConsultationSummaryJson>()` precedent. Use for `milestones.manifest` and `milestones.requiredSlots`.
- **Service layer for pure logic** that's safe to cross Inngest `step.run` boundaries — no RegExp objects, no closures over DB handles. `src/server/services/consultation-summary.service.ts` is the reference (Phase 21).
- **tRPC routers with `writeAuditLog`** for state transitions — 5-procedure pattern from `src/server/routers/consultation-summary.ts`.
- **Nyquist validation** — every task's `<automated>` verify must point at an existing test command. Golden-fixture tests for hashing become the validation source for VERIFY-04 and VERIFY-05.

### Integration Points
- **Schema barrel export** — `src/db/schema/index.ts` adds `export * from './milestones'`.
- **tRPC router tree** — a new `milestone` router registers under `src/server/routers/` and joins the root router. Follow Phase 21's pattern.
- **Admin workspace nav** — `/policies/[id]/milestones` and `/policies/[id]/milestones/[milestoneId]` are new routes under `app/(workspace)/policies/[id]/`. PolicyTabBar (from Phase 13) gets a new "Milestones" tab.
- **Audit log action constants** — add `MILESTONE_CREATE`, `MILESTONE_ATTACH_ENTITY`, `MILESTONE_DETACH_ENTITY`, `MILESTONE_MARK_READY` to the audit action constants file.
- **Downstream: Phase 23** will add an Inngest function that reads `src/lib/hashing.ts` + the milestone row + the manifest to rebuild the Cardano tx metadata payload. Keep `src/lib/hashing.ts` pure and importable from both tRPC handlers and Inngest functions.

</code_context>

<specifics>
## Specific Ideas

- **Hash should be re-verifiable by a 3rd-party auditor** who has only (a) the Cardano tx, (b) the manifest pulled from the milestone row, and (c) the child entity rows. They should be able to re-compute `hashPolicyVersion(version)` for any version in the manifest and get the same hex. This is the design target — Git commit model, not OCI image model.
- **Golden fixtures lock the wrapper's output**, not the library's internals. If we swap `canonicalize` package for a zero-dep alternative later, the golden fixtures should still pass bit-for-bit. If they don't, the wrapper has a bug or the new impl disagrees on an edge case we care about.
- **Position-independent per-version hash.** Hashing a `documentVersion` standalone (Phase 23 per-version anchor path) must produce the exact same 64-char hex as hashing it as a child entry in a milestone manifest. This constraint forces `hashPolicyVersion(version)` to take only the row as input, not any milestone context.
- **Phase 22 delivers state transition `defining → ready` only.** `ready → anchoring → anchored` belongs to Phase 23's Inngest function. Phase 22 ships the schema for all 4 states + the enum, but the later two transitions are dead code paths until Phase 23.

</specifics>

<deferred>
## Deferred Ideas

- **Cardano tx submission & Mesh SDK wiring** — Phase 23
- **Blockfrost `/metadata/txs/labels/:label` pre-check** — Phase 23
- **Per-version anchor trigger on `version.published` events** — Phase 23
- **Public Verified State badges + Cardanoscan explorer links** — Phase 23
- **DB trigger on `anchored` UPDATE rejection** — deferred unless Nyquist flags a gap; app-level guard + CHECK constraint sufficient for Phase 22
- **Hash algorithm migration infrastructure** (algo prefix / versioned hash column) — deferred until there's a concrete reason; SHA-256 is invariant for v0.2
- **Storing full canonical JSON blob for audit re-verification** — deferred; re-derivable on demand from manifest + children
- **Auto-link entities by date range** — considered and rejected; create-then-curate gives admin full agency
- **Cross-policy release milestones** — considered and rejected (D-01 picks per-policy); if quarterly release bundling is needed later, a separate "Release" entity could compose multiple milestones

### Reviewed Todos (not folded)

None — no pending todos matched Phase 22.

</deferred>

---

*Phase: 22-milestone-entity-sha256-hashing-service*
*Context gathered: 2026-04-15*
