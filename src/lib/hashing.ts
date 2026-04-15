/**
 * src/lib/hashing.ts — Deterministic SHA256 hashing service.
 *
 * RFC 8785 JCS canonicalization (via `canonicalize` npm package) + node:crypto
 * SHA256 primitive. All Phase 22 + Phase 23 hash computations route through
 * this module — per D-02a there must be NO direct `node:crypto.createHash` or
 * `JSON.stringify(sortKeys(...))` calls anywhere else in the codebase.
 *
 * Design invariants:
 *
 *   1. PURE FUNCTIONS ONLY — no DB access, no side effects, no stateful
 *      closures. Safe to import from Inngest `step.run()` bodies and tRPC
 *      handlers alike (Phase 21 Pitfall 3 confirmed the Inngest step
 *      boundary strips RegExp objects and closures; we expose neither).
 *
 *   2. POSITION-INDEPENDENT per-child hashes (D-01a). `hashPolicyVersion(v)`
 *      standalone must produce the same hex as the per-child `contentHash`
 *      in a milestone manifest entry for that same version. This is what
 *      lets Phase 23's per-version anchor path share logic with the
 *      milestone anchor path.
 *
 *   3. GOLDEN-FIXTURE LOCK — `src/lib/__tests__/hashing.test.ts` asserts
 *      exact hex output against committed fixtures. Any wrapper edit that
 *      shifts a fixture hash is a determinism regression and the test
 *      fails immediately.
 *
 *   4. Per RFC 8785 §3.2.2, ARRAYS ARE PRESERVED in input order. The
 *      `canonicalize` library does NOT re-sort arrays. Therefore callers
 *      of `hashWorkshop` MUST pre-sort `linkedArtifactIds` and
 *      `linkedFeedbackIds` ascending by string before calling. This is
 *      documented on each interface and tested via Pitfall 3.
 *
 *   5. `hashEvidenceBundle` and `hashMilestone` perform their own internal
 *      sorting — callers can pass shuffled arrays. This is the stability
 *      guarantee that VERIFY-05 depends on.
 *
 * References:
 *   - 22-CONTEXT.md D-02, D-02a, D-03, D-03a
 *   - 22-RESEARCH.md §A (canonicalize), §B (JCS edge cases), §D (node:crypto), §G (evidence bundle)
 *   - Existing crypto precedents: src/lib/cal-signature.ts, src/lib/feedback-token.ts
 */

import { createHash } from 'node:crypto'
import _canonicalize from 'canonicalize'

// ============================================================
// Primitives: canonicalize + sha256Hex
// ============================================================

/**
 * RFC 8785 JCS canonicalization wrapper.
 *
 * Wraps the `canonicalize` npm package behind a project-local export so
 * golden fixtures lock THIS wrapper's output, not the upstream library's
 * internals. Swapping the underlying package (or porting to a zero-dep
 * implementation) is safe as long as this wrapper's output bit-pattern
 * stays stable against the committed fixtures.
 *
 * The package signature is `(input: unknown) => string | undefined` —
 * `undefined` is returned only for circular references or Symbol values,
 * neither of which can appear in DB rows deserialized from JSONB. We
 * throw on undefined as a belt-and-suspenders guard; `sha256Hex(undefined)`
 * would otherwise silently hash the string `"undefined"` and corrupt the
 * output.
 *
 * Throws on:
 *   - Circular references  (from canonicalize's internal cycle detection)
 *   - NaN / Infinity       (canonicalize itself throws)
 *   - Unrepresentable inputs that produce undefined
 */
export function canonicalize(input: unknown): string {
  const result = _canonicalize(input)
  if (result === undefined) {
    throw new Error(
      'canonicalize returned undefined — input contains a circular reference or unrepresentable value',
    )
  }
  return result
}

/**
 * Core SHA256 primitive. Input MUST be a pre-canonicalized string (or any
 * deterministic string). Uses utf8 encoding explicitly per the
 * cal-signature.ts precedent — `'utf8'` is the default for string input
 * but explicit is better for clarity and future-proofing.
 *
 * Returns lowercase hex, always exactly 64 characters.
 */
export function sha256Hex(canonicalString: string): string {
  return createHash('sha256').update(canonicalString, 'utf8').digest('hex')
}

// ============================================================
// Entity: PolicyVersion
// ============================================================

/**
 * PolicyVersion hash input — content-defining fields only.
 *
 * EXCLUDED (bookkeeping / post-publish mutables):
 *   - consultationSummary    (generated AFTER publish — would break hash)
 *   - isPublished            (boolean flag, changes post-hash)
 *   - updatedAt              (bookkeeping timestamp)
 *   - crId                   (audit trail reference, not content)
 *   - mergeSummary           (audit trail, not content)
 *
 * publishedAt is included but nullable — drafts have null.
 */
export interface PolicyVersionHashInput {
  id: string
  documentId: string
  versionLabel: string
  sectionsSnapshot: unknown
  changelog: unknown
  publishedAt: string | null
  createdBy: string
}

export function hashPolicyVersion(input: PolicyVersionHashInput): string {
  return sha256Hex(canonicalize(input))
}

// ============================================================
// Entity: Workshop
// ============================================================

/**
 * Workshop hash input — row fields + explicit sorted FK arrays.
 *
 * `linkedArtifactIds` and `linkedFeedbackIds` are UUID arrays that the
 * CALLER is responsible for sorting. RFC 8785 JCS preserves array order;
 * the canonicalize library does NOT re-sort arrays. Unsorted arrays
 * produce non-deterministic hashes (Pitfall 3).
 *
 * The FK array approach (instead of embedding full child blobs) is what
 * makes the per-child hash composable with milestone manifests (D-03a).
 */
export interface WorkshopHashInput {
  id: string
  title: string
  scheduledAt: string // ISO 8601 string — caller converts Date
  durationMinutes: number | null
  status: string
  createdBy: string
  linkedArtifactIds: string[] // MUST be pre-sorted ascending by string
  linkedFeedbackIds: string[] // MUST be pre-sorted ascending by string
}

export function hashWorkshop(input: WorkshopHashInput): string {
  return sha256Hex(canonicalize(input))
}

// ============================================================
// Entity: FeedbackItem
// ============================================================

/**
 * FeedbackItem hash input — content + decision state.
 *
 * EXCLUDED:
 *   - xstateSnapshot   (internal state machine state, not content)
 *   - updatedAt        (bookkeeping)
 *   - createdAt        (bookkeeping; readableId + submitterId provide identity)
 *   - source           (Phase 20 intake vs workshop marker, not content)
 *   - submitterId      (PII — anonymized at source per LLM-04 / Phase 21)
 */
export interface FeedbackItemHashInput {
  id: string
  readableId: string
  sectionId: string
  documentId: string
  feedbackType: string
  priority: string
  impactCategory: string
  title: string
  body: string
  suggestedChange: string | null
  status: string
  decisionRationale: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  resolvedInVersionId: string | null
  isAnonymous: boolean
}

export function hashFeedbackItem(input: FeedbackItemHashInput): string {
  return sha256Hex(canonicalize(input))
}

// ============================================================
// Entity: EvidenceArtifact (single + bundle)
// ============================================================

/**
 * EvidenceArtifact hash input — row fields only.
 * `content` is the inline text/URL content column; `url` is always present
 * (points to R2 for files, external URL for links).
 */
export interface EvidenceArtifactHashInput {
  id: string
  title: string
  type: 'file' | 'link'
  url: string
  fileName: string | null
  fileSize: number | null
  uploaderId: string
  content: string | null
}

export function hashEvidenceArtifact(input: EvidenceArtifactHashInput): string {
  return sha256Hex(canonicalize(input))
}

/**
 * hashEvidenceBundle — hashes a SET of artifacts via Merkle-lite composition.
 *
 * We do NOT hash ZIP bytes (Phase 18's fflate.zipSync output is
 * non-deterministic across Node versions, OS, and compression levels).
 * Instead we:
 *
 *   1. Sort the artifact array by id ascending (internal sort — callers
 *      may pass shuffled input)
 *   2. Compute per-artifact hashes via `hashEvidenceArtifact`
 *   3. Canonicalize the ordered list of `{ id, contentHash }` tuples
 *   4. SHA256 the result
 *
 * This keeps per-artifact hashes re-derivable from a single row (D-03a)
 * and makes bundle verification composable: an auditor can confirm any
 * specific artifact's contribution without the full ZIP.
 */
export function hashEvidenceBundle(artifacts: EvidenceArtifactHashInput[]): string {
  const sorted = [...artifacts].sort((a, b) => a.id.localeCompare(b.id))
  const entries = sorted.map((a) => ({
    id: a.id,
    contentHash: hashEvidenceArtifact(a),
  }))
  return sha256Hex(canonicalize(entries))
}

// ============================================================
// Entity: Milestone
// ============================================================

/**
 * ManifestEntry — one row in a milestone manifest.
 *
 * `contentHash` is the hex output of the per-child hash function
 * (e.g. `hashPolicyVersion`). This is the composability requirement
 * D-03a relies on.
 */
export interface ManifestEntry {
  entityType: 'version' | 'workshop' | 'feedback' | 'evidence'
  entityId: string
  contentHash: string
}

/**
 * MilestoneMetadata — non-manifest fields included in the milestone hash.
 * These are the context that binds the manifest to a specific milestone
 * identity. Included in the hash so that two milestones with identical
 * manifests but different identities still produce distinct hashes.
 */
export interface MilestoneMetadata {
  milestoneId: string
  documentId: string
  title: string
  createdAt: string // ISO 8601
  requiredSlots: {
    versions?: number
    workshops?: number
    feedback?: number
    evidence?: number
  }
}

export interface MilestoneHashInput {
  manifest: ManifestEntry[]
  metadata: MilestoneMetadata
}

/**
 * hashMilestone — hashes a milestone for Cardano anchoring.
 *
 * Sorts the manifest internally by `(entityType, entityId)` ascending
 * so callers can pass unsorted arrays. This is the stability guarantee
 * for VERIFY-05 permutation tests.
 *
 * The single returned hex is what Phase 23's Inngest function will
 * persist into `milestones.contentHash` and embed in the Cardano tx
 * metadata under CIP-10 label 674.
 */
export function hashMilestone(input: MilestoneHashInput): string {
  const sortedManifest = [...input.manifest].sort((a, b) => {
    const typeCmp = a.entityType.localeCompare(b.entityType)
    if (typeCmp !== 0) return typeCmp
    return a.entityId.localeCompare(b.entityId)
  })
  const canonical = canonicalize({
    manifest: sortedManifest,
    metadata: input.metadata,
  })
  return sha256Hex(canonical)
}
