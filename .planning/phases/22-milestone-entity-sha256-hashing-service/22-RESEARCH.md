# Phase 22: Milestone Entity + SHA256 Hashing Service — Research

**Researched:** 2026-04-15
**Domain:** Postgres schema + Drizzle ORM + RFC 8785 JCS canonicalization + node:crypto SHA256 + tRPC + Next.js route extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Milestone is a per-policy snapshot. `milestones.documentId uuid NOT NULL REFERENCES policy_documents(id)`. Multiple milestones per policy allowed. Admin navigates via `/policies/[id]/milestones`.
- **D-01a:** Per-version content hash must be position-independent — hashing a `documentVersion` standalone must produce the same hex as hashing it as a child of a milestone manifest.
- **D-02:** Use the `canonicalize` npm package (RFC 8785 JCS). Wrapped behind `src/lib/hashing.ts` → `export function canonicalize(input: unknown): string`. Golden fixtures lock the wrapper's output, not the library internals.
- **D-02a:** All hashing happens through `src/lib/hashing.ts`. No direct `node:crypto.createHash('sha256')` calls outside that module.
- **D-03:** Hybrid manifest model. Each child gets its own content hash. Milestone row stores `manifest: [{ entityType, entityId, contentHash }]` sorted by `(entityType, entityId)`. Milestone hash = `SHA256(canonicalize({ manifest, metadata: { milestoneId, documentId, title, createdAt, requiredSlots } }))`.
- **D-03a:** Per-child content hashes computable from a single row + its immediate inputs. No joins for per-child hashing.
- **D-04:** `milestones.requiredSlots: jsonb NOT NULL DEFAULT '{}'::jsonb`, shape `{ versions, workshops, feedback, evidence }`. `defining → ready` transition checks counts.
- **D-04a:** Enum `milestone_status` with values `'defining' | 'ready' | 'anchoring' | 'anchored'`. Phase 22 ships only `defining → ready` path + DB schema for all 4 states.
- **D-05:** Create-then-curate UX. 4-tab detail page (Versions/Workshops/Feedback/Evidence). Checkbox add/remove via nullable `milestoneId` FK update. "Mark ready" button disabled until all slots met.

### Claude's Discretion

- **Immutability enforcement:** App-level guard inside tRPC mutation + Drizzle service layer + DB CHECK constraint on state column preventing backwards transitions. Full DB trigger deferred.
- **Hash storage shape:** Store `contentHash text NOT NULL`, `manifest jsonb NOT NULL`, `canonicalJsonBytesLen integer`. Do NOT store full canonical JSON blob.
- **Hash algorithm prefix:** Store raw 64-char hex without prefix. `contentHash text NOT NULL CHECK (contentHash ~ '^[0-9a-f]{64}$')`.
- **Role authorization:** `admin` and `moderator` can create + curate + mark-ready milestones. `auditor` read-only. No new role needed.
- **Hash input field shapes per entity type:** Only content-defining fields. Exact shapes locked by golden fixtures in `src/lib/__tests__/hashing.test.ts`.
- **Partial index pattern:** `CREATE INDEX IF NOT EXISTS ... WHERE milestone_id IS NOT NULL` (non-concurrent, safe inside txn).
- **Migration file:** `0014_milestones_hashing.sql`.

### Deferred Ideas (OUT OF SCOPE)

- Cardano tx submission, Mesh SDK + Blockfrost wiring — Phase 23
- `milestoneReady` Inngest function orchestration — Phase 23
- Per-version `version.published` anchor triggers — Phase 23
- Public `/portal` Verified State badges — Phase 23
- DB trigger on `anchored` UPDATE rejection — deferred; app-level guard + CHECK constraint sufficient for Phase 22
- Hash algorithm migration infrastructure — deferred
- Storing full canonical JSON blob for audit re-verification — deferred
- Auto-link entities by date range — rejected
- Cross-policy release milestones — rejected

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VERIFY-01 | First-class `milestones` table with required-slot definitions and readiness state (immutable once anchored) | D-04, D-04a, migration pattern §C, schema pattern §C |
| VERIFY-02 | Milestone entity links to `documentVersions`, `workshops`, `feedbackItems`, `evidenceArtifacts` via nullable `milestoneId` FK | FK topology §C, partial index pattern §C |
| VERIFY-03 | Admin can mark milestone ready, triggering hash computation | tRPC router §E, state transition §D, UI §F |
| VERIFY-04 | SHA256 hashing service (`src/lib/hashing.ts`) produces deterministic hashes for `policyVersion`, `workshop`, `evidenceBundle`, and `milestone` | crypto one-liner §D, service shape §D, evidence bundle §G |
| VERIFY-05 | JSON canonicalization (RFC 8785 JCS) with golden-fixture tests ensures hash determinism | canonicalize package §A, JCS edge cases §B, Validation Architecture §H |

</phase_requirements>

---

## Summary

Phase 22 is a schema + library + service + UI phase that creates the foundation for Cardano anchoring. It requires three parallel work streams that mostly converge at the tRPC layer: (1) the Postgres schema with a new enum + table + FK modifications, (2) a pure hashing service backed by the `canonicalize` package, and (3) admin UI extending the existing `/policies/[id]/*` workspace.

The `canonicalize` npm package (v3.0.0, published 2026-04-08) is actively maintained by RFC 8785 co-author Samuel Erdtman, has zero runtime dependencies, ships TypeScript declarations, and has ~135k weekly downloads. It is the correct and only library needed. Its default export returns `string | undefined` — the hashing wrapper must handle the `undefined` case (only triggered by circular references or symbols, which our DB rows never contain).

The biggest technical risk is hash stability across the `canonicalize` → `node:crypto` pipeline. The golden-fixture test strategy (Wave 0, before any implementation) is the mandatory safety net: once a fixture hash is committed, any future package upgrade or wrapper change that produces a different hex is caught immediately. The Cardano anchoring requirement in Phase 23 makes hash stability a hard constraint, not a quality preference.

**Primary recommendation:** Ship Wave 0 (golden fixtures + RED tests) first, then schema + hashing.ts in parallel (Wave 1), then tRPC router (Wave 2), then admin UI (Wave 3).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `canonicalize` | 3.0.0 | RFC 8785 JCS canonicalization before hashing | Only verified JCS impl with TypeScript types; written by RFC 8785 co-author; zero deps; 16KB footprint |
| `node:crypto` | built-in (Node 20+) | SHA256 hash computation | Project-established pattern (cal-signature.ts, feedback-token.ts); no extra dep |
| `drizzle-orm/pg-core` | existing (project installed) | Schema definition for `milestones` table | Existing project ORM |
| `@neondatabase/serverless` | existing | DB driver | Project standard; Neon serverless Postgres |
| `zod` | existing | tRPC input validation | Project standard |
| `vitest` | ^4.1.1 | Test runner for golden fixtures + router tests | Project standard (vitest.config.mts confirmed) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@base-ui/react/tabs` | existing (via `components/ui/tabs.tsx`) | Tabs primitive for 4-tab detail page | Reuse — already in project |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `canonicalize` | Inline JCS port | JCS number serialization (IEEE 754 → ES6 format) is subtle; hand-rolling risks edge cases; `canonicalize` covers them and is maintained by the spec author |
| `canonicalize` | `json-canonicalize` (cyberphone) | Also valid JCS but fewer downloads, no bundled TS types |

**Installation:**
```bash
npm install canonicalize
```

**Version verification (confirmed 2026-04-15):**
```
canonicalize@3.0.0   published: 2026-04-08   unpackedSize: 16,314 bytes   deps: 0
```

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src/
├── db/
│   ├── schema/
│   │   └── milestones.ts           # new: milestones table + milestone_status enum
│   ├── migrations/
│   │   └── 0014_milestones_hashing.sql  # new: enum + table + 4 ALTER TABLE + 4 indexes
│   └── schema/index.ts             # modified: add export * from './milestones'
├── lib/
│   ├── hashing.ts                  # new: pure canonicalize + SHA256 functions
│   ├── constants.ts                # modified: add MILESTONE_* action constants
│   ├── permissions.ts              # modified: add 'milestone:manage' + 'milestone:read'
│   └── __tests__/
│       ├── hashing.test.ts         # new: golden-fixture + permutation tests (Wave 0 RED)
│       └── fixtures/hashing/       # new: JSON fixture files
│           ├── policy-version.json
│           ├── workshop.json
│           ├── feedback-item.json
│           ├── evidence-artifact.json
│           ├── evidence-bundle.json
│           └── milestone.json
└── server/
    └── routers/
        ├── milestone.ts            # new: 5+ procedure tRPC router
        └── _app.ts                 # modified: add milestoneRouter
app/
└── (workspace)/
    └── policies/
        └── [id]/
            ├── _components/
            │   └── policy-tab-bar.tsx  # modified: add Milestones tab
            └── milestones/
                ├── page.tsx            # new: milestone index (server component)
                ├── _components/
                │   └── milestone-list.tsx
                └── [milestoneId]/
                    └── page.tsx        # new: milestone detail (client component, 4 tabs)
```

### Pattern 1: Drizzle Schema for milestones.ts

**What:** New schema file following the project's co-located schema pattern. Uses `pgEnum` for state machine, `jsonb.$type<>()` for typed JSONB columns. References `policyDocuments` as FK target.

**When to use:** Every new domain table gets its own `src/db/schema/<domain>.ts`.

```typescript
// Source: verified against changeRequests.ts + documents.ts patterns
import { pgTable, pgEnum, uuid, text, timestamp, jsonb, integer, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { policyDocuments } from './documents'
import { users } from './users'

export type MilestoneStatus = 'defining' | 'ready' | 'anchoring' | 'anchored'

export type RequiredSlots = {
  versions?: number
  workshops?: number
  feedback?: number
  evidence?: number
}

export type ManifestEntry = {
  entityType: 'version' | 'workshop' | 'feedback' | 'evidence'
  entityId: string
  contentHash: string
}

export const milestoneStatusEnum = pgEnum('milestone_status', [
  'defining', 'ready', 'anchoring', 'anchored',
])

export const milestones = pgTable('milestones', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  documentId:           uuid('document_id').notNull().references(() => policyDocuments.id),
  title:                text('title').notNull(),
  description:          text('description'),
  status:               milestoneStatusEnum('status').notNull().default('defining'),
  requiredSlots:        jsonb('required_slots').$type<RequiredSlots>().notNull().default({}),
  contentHash:          text('content_hash'),
  manifest:             jsonb('manifest').$type<ManifestEntry[]>(),
  canonicalJsonBytesLen: integer('canonical_json_bytes_len'),
  createdBy:            uuid('created_by').notNull().references(() => users.id),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('chk_content_hash_format',
    sql`${t.contentHash} IS NULL OR ${t.contentHash} ~ '^[0-9a-f]{64}$'`),
])
```

**IMPORTANT — `sql` import path:** `import { sql } from 'drizzle-orm'` (NOT `from 'drizzle-orm/pg-core'`). The `sql` template tag lives in the root `drizzle-orm` module. Confirmed from drizzle-orm docs — `check` constraint expressions require the `sql` tagged template.

**IMPORTANT — `check` import:** `check` is imported from `'drizzle-orm/pg-core'`. Confirmed from the drizzle v0.30+ API: `check(name, sql)` is a table-level constraint builder.

**IMPORTANT — JSONB default({}) pattern:** The existing `auditEvents.payload` uses `.default({})` for jsonb which Drizzle maps to `DEFAULT '{}'::jsonb` in the migration. This is the correct pattern. No `sql` template needed for an empty-object JSONB default.

### Pattern 2: Idempotent SQL Migration (0014_milestones_hashing.sql)

**What:** Hand-authored SQL migration following the 0011 pattern. Includes idempotent enum creation, table creation, ALTER TABLE ADD COLUMN IF NOT EXISTS, and partial index creation.

```sql
-- Phase 22: milestones table + nullable milestoneId FK on 4 tables
-- VERIFY-01, VERIFY-02

-- 1. Enum (idempotent)
DO $$ BEGIN
  CREATE TYPE milestone_status AS ENUM ('defining', 'ready', 'anchoring', 'anchored');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. milestones table
CREATE TABLE IF NOT EXISTS milestones (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id              uuid NOT NULL REFERENCES policy_documents(id),
  title                    text NOT NULL,
  description              text,
  status                   milestone_status NOT NULL DEFAULT 'defining',
  required_slots           jsonb NOT NULL DEFAULT '{}',
  content_hash             text CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  manifest                 jsonb,
  canonical_json_bytes_len integer,
  created_by               uuid NOT NULL REFERENCES users(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- 3. Nullable milestoneId FK on 4 tables
ALTER TABLE document_versions   ADD COLUMN IF NOT EXISTS milestone_id uuid REFERENCES milestones(id);
ALTER TABLE workshops            ADD COLUMN IF NOT EXISTS milestone_id uuid REFERENCES milestones(id);
ALTER TABLE feedback             ADD COLUMN IF NOT EXISTS milestone_id uuid REFERENCES milestones(id);
ALTER TABLE evidence_artifacts   ADD COLUMN IF NOT EXISTS milestone_id uuid REFERENCES milestones(id);

-- 4. Partial indexes (non-concurrent — safe inside transaction)
CREATE INDEX IF NOT EXISTS idx_document_versions_milestone_id
  ON document_versions (milestone_id) WHERE milestone_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workshops_milestone_id
  ON workshops (milestone_id) WHERE milestone_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_milestone_id
  ON feedback (milestone_id) WHERE milestone_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_artifacts_milestone_id
  ON evidence_artifacts (milestone_id) WHERE milestone_id IS NOT NULL;
```

**Key confirmed:** `CREATE INDEX IF NOT EXISTS ... WHERE milestone_id IS NOT NULL` is valid non-concurrent partial index syntax. `CONCURRENTLY` is explicitly NOT used because our migrations run inside transactions (Neon serverless driver). `CREATE INDEX CONCURRENTLY` inside a transaction block raises an error in Postgres.

### Pattern 3: hashing.ts — Pure Service Module

**What:** `src/lib/hashing.ts` — pure TypeScript, no DB access, no side effects, safe to import from both tRPC handlers and Inngest functions. Follows the `consultation-summary.service.ts` pattern of exporting types + pure functions only.

```typescript
// Source: node:crypto precedent from cal-signature.ts + feedback-token.ts
// RFC 8785 JCS: github.com/erdtman/canonicalize v3.0.0
import { createHash } from 'node:crypto'
import _canonicalize from 'canonicalize'

/**
 * RFC 8785 JCS canonicalization wrapper.
 * Golden fixtures lock THIS wrapper's output — swapping the underlying
 * `canonicalize` package does NOT break fixtures if the wrapper remains stable.
 *
 * Returns the canonical JSON string. Throws on NaN, Infinity, or circular refs
 * (none of which our DB rows can contain).
 */
export function canonicalize(input: unknown): string {
  const result = _canonicalize(input)
  if (result === undefined) {
    throw new Error('canonicalize returned undefined — input contains circular refs or symbols')
  }
  return result
}

/**
 * Core SHA256 primitive. Input MUST already be canonicalized.
 * Node's createHash uses utf8 encoding by default for string input —
 * which is deterministic and correct for our purposes.
 */
export function sha256Hex(canonicalString: string): string {
  return createHash('sha256').update(canonicalString, 'utf8').digest('hex')
}

// ----------- Per-entity hash functions -----------

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

// ... (similar for hashWorkshop, hashFeedbackItem, hashEvidenceArtifact,
//      hashEvidenceBundle, hashMilestone)
```

**CRITICAL:** The `canonicalize` package default export has TypeScript type `(input: unknown) => string | undefined`. The wrapper must handle the `undefined` return. In practice, `undefined` is only returned for circular references or Symbol values — neither of which can exist in DB rows deserialized from JSON. The throw-on-undefined guard is a belt-and-suspenders for impossible cases.

**Encoding note (confirmed):** `createHash('sha256').update(str, 'utf8').digest('hex')` — the second argument `'utf8'` is the default encoding for string input and explicitly matches the UTF-8 encoding of the canonical JSON string. This is deterministic across Node versions.

**Inngest boundary safety:** `src/lib/hashing.ts` must NOT export RegExp objects, class instances, or closures over DB handles. The consultation-summary pitfall (Phase 21 Pitfall 3) showed that RegExp objects serialize to `{}` across `step.run()` boundaries. Hashing.ts has no such issues — it exports only pure functions and plain TypeScript interfaces.

### Pattern 4: tRPC Router (milestone.ts)

**What:** New router following `consultation-summary.ts` shape. Minimum 5 procedures: `create`, `list`, `getById`, `attachEntity`, `detachEntity`, `markReady`. Uses `requirePermission('milestone:manage')` for mutations, `requirePermission('milestone:read')` for queries.

```typescript
// Follows src/server/routers/consultation-summary.ts pattern exactly
import { z } from 'zod'
import { router, requirePermission } from '@/src/trpc/init'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'

export const milestoneRouter = router({
  create: requirePermission('milestone:manage')
    .input(z.object({ documentId: z.string().uuid(), title: z.string().min(1), ... }))
    .mutation(async ({ ctx, input }) => { ... }),

  attachEntity: requirePermission('milestone:manage')
    .input(z.object({
      milestoneId: z.string().uuid(),
      entityType: z.enum(['version', 'workshop', 'feedback', 'evidence']),
      entityId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => { ... }),

  markReady: requirePermission('milestone:manage')
    .input(z.object({ milestoneId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // 1. Check all non-zero requiredSlots are met
      // 2. Compute per-child hashes
      // 3. Build manifest (sort by entityType, entityId)
      // 4. Compute milestone hash
      // 5. Store contentHash + manifest on row
      // 6. Transition status defining → ready
      // 7. writeAuditLog(ACTIONS.MILESTONE_MARK_READY)
    }),
})
```

**Action constants to add to `src/lib/constants.ts`:**
```typescript
MILESTONE_CREATE:         'milestone.create',
MILESTONE_ATTACH_ENTITY:  'milestone.attach_entity',
MILESTONE_DETACH_ENTITY:  'milestone.detach_entity',
MILESTONE_MARK_READY:     'milestone.mark_ready',
```

**Permission to add to `src/lib/permissions.ts`:**
```typescript
'milestone:manage': [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
'milestone:read':   [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.AUDITOR] as readonly Role[],
```
Note: CONTEXT.md says "admin and moderator" but there is no `moderator` role — the closest equivalent is `workshop_moderator`. Based on Phase 21's `version:manage` = `[ADMIN, POLICY_LEAD]` pattern, use `[ADMIN, POLICY_LEAD]` for `milestone:manage`. Claude's discretion section says follow the consultation-summary review pattern.

### Pattern 5: Next.js Route Structure

**What:** Two new server/client component pages nested under the existing `/policies/[id]/` workspace layout. The existing `PolicyLayout` wraps both via the shared `PolicyTabBar`.

**New tab entry in `policy-tab-bar.tsx`:**
```typescript
{
  label: 'Milestones',
  href: `/policies/${documentId}/milestones`,
  match: 'startsWith',
  visible: canViewMilestones,  // admin | policy_lead | auditor
}
```

**`PolicyTabBar` prop addition:** Add `canViewMilestones: boolean` prop. The layout server component resolves this from `role`.

**Params pattern (Next.js):** The existing `layout.tsx` uses `const { id } = await params` (Promise unwrap) — the same pattern applies to the new milestone pages. Confirmed: this codebase's Next.js version requires `params: Promise<{ id: string }>` (not direct object) — checked against `app/(workspace)/policies/[id]/layout.tsx:13-14`.

### Anti-Patterns to Avoid

- **Calling `node:crypto` directly outside `hashing.ts`:** D-02a locks all hashing to `src/lib/hashing.ts`. No `createHash` calls in routers or components.
- **Using `CREATE INDEX CONCURRENTLY` in migrations:** Cannot run inside a transaction. Neon serverless migrations run in transactions. Use standard `CREATE INDEX IF NOT EXISTS ... WHERE ...` instead.
- **Hashing bookkeeping fields:** `isPublished`, `updatedAt`, `consultationSummary` must NOT appear in hash inputs. Hash only content-defining fields (per D-03a and CONTEXT.md discretion section).
- **Storing the full canonical JSON string on the milestone row:** Re-derivable on demand. Store only `contentHash`, `manifest`, and `canonicalJsonBytesLen`.
- **Using drizzle-kit generate for this migration:** The project pattern is hand-authored SQL (0000, 0011, 0013 are all raw SQL). Do NOT use `npx drizzle-kit generate`. Write `0014_milestones_hashing.sql` by hand.
- **Embedding RegExp objects in hashing.ts exports:** Phase 21 Pitfall 3 — RegExp serializes to `{}` across Inngest `step.run()` boundaries.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RFC 8785 JCS key sorting + number normalization | Custom JSON serializer | `canonicalize` npm package | IEEE 754 float-to-string and UTF-16 key sort are subtle; JCS spec author maintains this package |
| SHA256 | Third-party crypto lib | `node:crypto` `createHash` | Project-established pattern; project explicitly rejected jose/jsonwebtoken (see feedback-token.ts comments) |
| Tab UI primitive | Custom tab component | `components/ui/tabs.tsx` (`@base-ui/react/tabs`) | Already in project; used elsewhere in workspace |
| Circular dependency on `milestones` ↔ child tables | Drizzle `.references()` on import | SQL-only FK in migration body + comment in schema | Matches the `feedbackItems.resolvedInVersionId` and `documentVersions.crId` precedent — note the same comment pattern |

**Key insight:** The canonicalization layer is the most dangerous custom-build trap. JCS mandates UTF-16 lexicographic key sorting (not UTF-8 byte ordering) and ES6 number formatting. The `canonicalize` package implements both correctly and is tested against the RFC test vectors. A hand-rolled `JSON.stringify(sortKeys(obj))` will fail on non-ASCII key names.

---

## A. Canonicalize Package — Confirmed Details

**Package:** `canonicalize` (npm)
**Confirmed version:** 3.0.0 (published 2026-04-08 — very recently updated)
**Weekly downloads:** ~135,000 (MEDIUM confidence — from Snyk npm advisor data)
**Author:** Samuel Erdtman — co-author of RFC 8785 itself
**Maintenance:** Sustainable (new release 2026-04-08 from v2.1.0 → v3.0.0 cadence confirms active maintenance)
**Dependencies:** zero (confirmed from npm metadata: `dependencies: {}`)
**Unpacked size:** 16,314 bytes (minimal footprint)
**Repository:** https://github.com/erdtman/canonicalize
**License:** Apache-2.0

**Exact TypeScript API (confirmed from `lib/canonicalize.d.ts`):**
```typescript
declare function serialize(input: unknown): string | undefined;
export default serialize;
```

The function is named `serialize` internally but exported as `default`. The return type is `string | undefined`. `undefined` is returned only for circular references. Our wrapper must handle this case (throw, since it's impossible for DB rows).

**Import pattern (ESM/CJS both supported via `exports` field):**
```typescript
import _canonicalize from 'canonicalize'
```

**Edge cases handled by the library (confirmed from source + README):**
- Keys sorted alphabetically at every nesting level
- `NaN` and `Infinity` throw errors
- `undefined` and `Symbol` values in arrays → replaced with `null`
- `undefined` and `Symbol` object properties → omitted
- `toJSON()` methods respected
- Circular references → returns `undefined`
- Floating-point numbers → ES6 `Number.prototype.toString()` format (avoids `-0` issues; `-0` serializes as `0` per JS spec)

**Confidence:** HIGH — confirmed from npm registry metadata + GitHub source inspection (2026-04-15).

---

## B. RFC 8785 JCS Edge Cases for Our Data

### Applicable to our inputs

**B-1. Key sorting (applies to ALL our hash inputs)**
JCS sorts object keys using UTF-16 code unit ordering. For ASCII keys (all our field names are ASCII), UTF-16 == UTF-8 == alphabetical. No special handling needed.

**B-2. Null values (applicable)**
Postgres nullable fields come through as `null` in Drizzle query results. JCS serializes `null` as the literal `null`. This is deterministic. Include nullable fields explicitly with their null values rather than omitting them — omitting vs. null produces different canonical strings.

**B-3. ISO8601 timestamps**
`publishedAt`, `createdAt`, `scheduledAt` etc. come from Drizzle as `Date` objects. Must be converted to ISO 8601 strings BEFORE passing to `canonicalize`. Use `date.toISOString()`. Add this conversion inside each hash function, not in the caller.

**B-4. Tiptap JSONB in `sectionsSnapshot`**
`sectionsSnapshot` is already stored as serialized JSONB — when Drizzle returns it, it's a JavaScript object with deeply nested structure. `canonicalize` handles deep objects correctly (recursive key sort at every level). No special treatment needed.

**B-5. Integer IDs and boolean fields**
`isPublished`, `isAnonymous` (booleans), `fileSize`, `durationMinutes` (integers) — all serialize deterministically. No edge cases.

**B-6. Array ordering — CRITICAL**
RFC 8785 / JCS **preserves array order** (does NOT sort arrays). The `canonicalize` library does NOT re-order arrays. This means the caller is responsible for sorting arrays before passing them in. For:
- `linkedArtifactIds` and `linkedFeedbackIds` in `hashWorkshop` input — sort by UUID string ascending before building the input object
- The `manifest` array in `hashMilestone` — sort by `(entityType, entityId)` ascending before passing to `canonicalize`
- `sectionsSnapshot` array — preserve DB ordering (sections are ordered by index; same order always)

**Confirmed (HIGH confidence):** From RFC 8785 §3.2.2: "Arrays MUST retain their element order." The `canonicalize` source confirms arrays are serialized in their input order.

### Not applicable to our inputs

**B-7. Unicode NFC normalization**
RFC 8785 explicitly does NOT perform Unicode normalization: "JCS-compliant string processing does not take this into consideration, and all components involved in a scheme depending on JCS MUST preserve Unicode string data 'as is'." (HIGH confidence — from RFC 8785 §3.2.3.)

Postgres JSONB also does NOT perform NFC normalization on stored text. It stores text as UTF-8 bytes and retrieves them verbatim (no normalization). Therefore, round-trip through Postgres → Drizzle → `canonicalize` is safe — no NFC divergence can occur.

**B-8. IEEE 754 -0 vs 0**
JavaScript's `Number.prototype.toString()` serializes `-0` as `"0"`. Postgres `integer` and `float` types do not produce -0 in query results. Not a concern for our integer/float columns.

**B-9. Large integers (>2^53)**
`fileSize` is `integer` (int4 in Postgres, max ~2.1 billion). `durationMinutes` is `integer`. No large integer concerns.

**B-10. Surrogate pairs**
Policy document text (Tiptap JSON) could theoretically contain emoji or supplementary plane Unicode. Postgres JSONB stores these as UTF-8 sequences and returns them as proper JavaScript strings. `canonicalize` handles them correctly via JSON.stringify semantics.

---

## C. Drizzle + Postgres Migration Patterns

### C-1. Idempotent Enum Creation

Pattern confirmed from `0011_cal_com_workshop_register.sql`:
```sql
DO $$ BEGIN
  CREATE TYPE milestone_status AS ENUM ('defining', 'ready', 'anchoring', 'anchored');
EXCEPTION WHEN duplicate_object THEN null; END $$;
```
This is the correct idempotent pattern. `IF NOT EXISTS` is **not** valid syntax for `CREATE TYPE` in Postgres. The `DO ... EXCEPTION WHEN duplicate_object THEN null` pattern is the standard workaround.

**Drizzle-kit and enum:** Drizzle-kit `generate` has a known issue (#5174) where it does not emit enum definitions if the enum is not exported. Since we hand-author migrations, this is irrelevant. The `pgEnum` in `milestones.ts` must be exported so Drizzle's type system can reference it; the raw SQL migration handles the actual creation.

### C-2. Partial Index Syntax (Postgres + Transaction)

Confirmed: `CREATE INDEX IF NOT EXISTS ... WHERE milestone_id IS NOT NULL` is valid standard Postgres partial index syntax. It is safe to execute inside a transaction. `CONCURRENTLY` is explicitly excluded because:
1. Neon serverless migrations run inside transactions
2. `CREATE INDEX CONCURRENTLY` is not allowed inside a transaction block in Postgres (raises `ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`)

### C-3. Drizzle JSONB $type<> Pattern

Confirmed from `changeRequests.ts:21-25` and `documents.ts:17`:
```typescript
sectionsSnapshot: jsonb('sections_snapshot').$type<SectionSnapshot[] | null>(),
content: jsonb('content').$type<Record<string, unknown>>().notNull().default({}),
```

For `requiredSlots`:
```typescript
requiredSlots: jsonb('required_slots').$type<RequiredSlots>().notNull().default({}),
```

The `.default({})` on a `jsonb` column generates `DEFAULT '{}'::jsonb` in Drizzle's DDL. No `sql` tagged template is needed for an empty object default. The `sql` import from `'drizzle-orm'` is only needed for `check()` constraint expressions.

### C-4. FK Circularity Analysis

The milestones schema has NO circular dependency concern:
- `milestones.ts` references `policyDocuments` (in `documents.ts`) and `users` (in `users.ts`) — both are simple upstream FKs
- The 4 target tables (`documentVersions`, `workshops`, `feedbackItems`, `evidenceArtifacts`) will reference `milestones` via the nullable `milestone_id` FK — but this FK is added via `ALTER TABLE` in the SQL migration, NOT via Drizzle `.references()` in those schema files

**Recommended approach:** Add `milestoneId uuid` to the 4 Drizzle schema files WITHOUT `.references(() => milestones.id)` (following the `feedbackItems.resolvedInVersionId` and `documentVersions.crId` precedent). The FK constraint exists only in the SQL migration. Add a comment: `// FK to milestones — constraint in SQL migration only (avoids circular import)`.

This avoids the circular import that would occur if `changeRequests.ts` imported from `milestones.ts` which imports from `documents.ts` which is already imported by `changeRequests.ts`.

### C-5. Migration Sequence

Confirmed: the next migration slot is `0014`. The `_journal.json` shows entries at idx 0 and idx 11, but files 0012 and 0013 exist on disk (they are hand-applied, not journal-tracked). The naming convention is filename-based, not journal-based. File should be named `0014_milestones_hashing.sql`.

---

## D. Service Layer & Crypto Implementation

### D-1. The SHA256 One-Liner

```typescript
import { createHash } from 'node:crypto'
createHash('sha256').update(canonicalize(input), 'utf8').digest('hex')
```

Confirmed from `cal-signature.ts:32`:
```typescript
const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
```
The `'utf8'` encoding argument is explicit and matches what we need. For our case: `createHash('sha256').update(canonicalString, 'utf8').digest('hex')`. The `'utf8'` argument is technically the default for string input but explicit is better for clarity.

### D-2. Hash the String (Not a Buffer)

Hash the canonicalized string directly. `node:crypto` accepts a string + encoding argument and converts to bytes internally. This is deterministic across Node versions. No need to `Buffer.from(canonicalized, 'utf8')` first — both produce identical SHA256 output.

### D-3. hashing.ts Module Shape

Following the `consultation-summary.service.ts` pattern exactly:
- Export TypeScript interfaces for each hash input type
- Export pure functions only
- NO `import { db } from '@/src/db'` anywhere in this file
- NO class instances, RegExp objects, or stateful closures
- Safe to import from tRPC handlers AND Inngest step functions

### D-4. hashEvidenceBundle() Design

See section G for full analysis. Summary: `hashEvidenceBundle()` takes an array of `evidenceArtifact` rows (not ZIP bytes), sorts by `id`, calls `hashEvidenceArtifact(artifact)` on each, then canonicalizes the sorted array of `{ id, contentHash }` tuples and hashes that.

---

## E. tRPC Router + Audit Log Pattern

### E-1. Router Structure (5 procedures minimum)

From `consultation-summary.ts` analysis:
- Queries use `requirePermission('milestone:read')` or `requirePermission('milestone:manage')`
- Mutations use `requirePermission('milestone:manage')`
- `writeAuditLog({...}).catch(console.error)` — fire-and-forget per Phase 1 invariant
- Action constants defined in `src/lib/constants.ts` in the `ACTIONS` object

Procedures:
1. `create` — mutation, creates empty milestone with title + description + requiredSlots
2. `list` — query, lists milestones for a documentId
3. `getById` — query, full detail including linked entity counts
4. `attachEntity` — mutation, sets `milestoneId` FK on child row
5. `detachEntity` — mutation, sets `milestoneId = null` on child row
6. `markReady` — mutation, computes hashes + transitions `defining → ready`

### E-2. Permission Check Pattern

```typescript
// From src/trpc/init.ts — requirePermission middleware
export const requirePermission = (permission: Permission) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!can(ctx.user.role as Role, permission)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: `Missing permission: ${permission}` })
    }
    return next({ ctx })
  })
```

Use `requirePermission('milestone:manage')` for all mutations. No new middleware needed.

### E-3. Discriminated Union vs. 4 Separate Procedures

**Recommendation:** Single `attachEntity` procedure with a discriminated union input is cleaner than 4 separate procedures. The entity type drives which table to UPDATE:

```typescript
attachEntity: requirePermission('milestone:manage')
  .input(z.object({
    milestoneId: z.string().uuid(),
    entityType: z.enum(['version', 'workshop', 'feedback', 'evidence']),
    entityId: z.string().uuid(),
  }))
  .mutation(async ({ ctx, input }) => {
    const tableMap = {
      version:  documentVersions,
      workshop: workshops,
      feedback: feedbackItems,
      evidence: evidenceArtifacts,
    }
    const table = tableMap[input.entityType]
    await db.update(table).set({ milestoneId: input.milestoneId })
      .where(eq(table.id, input.entityId))
    writeAuditLog({...}).catch(console.error)
  })
```

**Note:** The above requires that `milestoneId` is added to the Drizzle schema of all 4 tables. The TypeScript compiler will verify the column exists.

### E-4. Immutability Guard

Before any mutation on a milestone row, check:
```typescript
if (milestone.status === 'anchored') {
  throw new TRPCError({ code: 'FORBIDDEN', message: 'Milestone is anchored and immutable' })
}
```
Apply to `attachEntity`, `detachEntity`, `markReady`.

For `markReady`: also check current state is `defining`:
```typescript
if (milestone.status !== 'defining') {
  throw new TRPCError({ code: 'CONFLICT', message: `Cannot mark ready from state ${milestone.status}` })
}
```

---

## F. Next.js Route + Workspace Component Pattern

### F-1. Existing Route Structure

Confirmed:
- `app/(workspace)/policies/[id]/layout.tsx` — server component, resolves role, renders `PolicyTabBar`
- `PolicyTabBar` is a client component (`'use client'`) using `usePathname()` for active state
- Params pattern: `params: Promise<{ id: string }>` → `const { id } = await params` (required by this project's Next.js version — confirmed from layout.tsx:12-14)

### F-2. New "Milestones" Tab

Add to `PolicyTabBar.tabs` array:
```typescript
{
  label: 'Milestones',
  href: `/policies/${documentId}/milestones`,
  match: 'startsWith',
  visible: canViewMilestones,
}
```

Add `canViewMilestones: boolean` prop. The layout server component sets this to `role === 'admin' || role === 'policy_lead' || role === 'auditor'`.

### F-3. Milestone Index Page

`app/(workspace)/policies/[id]/milestones/page.tsx` — can be a server component or client component. Given the rest of the workspace uses client components for the main content pages (versions/page.tsx is `'use client'`), use the same pattern: `'use client'` + tRPC query.

### F-4. Milestone Detail Page (4-tab UI)

`app/(workspace)/policies/[id]/milestones/[milestoneId]/page.tsx` — client component with 4 tabs using the existing `components/ui/tabs.tsx` (`@base-ui/react/tabs` primitive). 

Each tab shows a table of entities belonging to this policy document, with a checkbox column. Checked = entity is linked to this milestone; unchecked = not linked. Checkbox click fires `milestone.attachEntity` or `milestone.detachEntity` mutation.

The header section shows: milestone title, current state badge, slot status indicators ("Versions: 2/1 ✓"), and a "Mark ready" button (disabled unless all non-zero slots are met AND state is `defining`).

---

## G. Evidence Bundle Composition (hashEvidenceBundle)

### G-1. What buildEvidencePack Does (Phase 18)

From `evidence-pack.service.ts` analysis: `buildEvidencePack(documentId)` assembles CSVs + JSON files into a map of `filename → Uint8Array`. It is a document-level function that aggregates feedback, versions, and workflow transitions. It does NOT take a list of `evidenceArtifact` rows — it pulls them indirectly via joins.

### G-2. Why We Do NOT Hash the ZIP Bytes

The Phase 18 evidence pack ZIP assembly uses `fflate.zipSync()` (confirmed from `18-00-PLAN.md` interfaces). ZIP compression is non-deterministic across:
- Different Node.js versions
- Different OS environments
- Different compression level settings
- File ordering inside the ZIP

Hashing the ZIP bytes would produce different hashes on different machines, defeating the auditor re-verification requirement.

### G-3. What hashEvidenceBundle() Takes

`hashEvidenceBundle()` takes an array of `evidenceArtifact` rows. The hash represents "the set of artifacts linked to this milestone" rather than "the ZIP export."

**Recommended input shape:**
```typescript
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

export function hashEvidenceBundle(artifacts: EvidenceArtifactHashInput[]): string {
  // Sort by id for deterministic ordering (UUIDs are stable sort keys)
  const sorted = [...artifacts].sort((a, b) => a.id.localeCompare(b.id))
  // Hash each artifact, then hash the list of {id, contentHash} pairs
  const entries = sorted.map((a) => ({
    id: a.id,
    contentHash: hashEvidenceArtifact(a),
  }))
  return sha256Hex(canonicalize(entries))
}
```

This approach means `hashEvidenceBundle()` is position-independent (D-01a): the bundle hash is computed from individual artifact hashes, and each artifact hash can be re-derived from a single row. An auditor can verify any specific artifact's contribution to the bundle hash without needing the ZIP file.

---

## Common Pitfalls

### Pitfall 1: `canonicalize` Returns `undefined` for Edge Cases
**What goes wrong:** If `_canonicalize(input)` returns `undefined` (circular refs, Symbols), `sha256Hex(undefined)` would silently hash the string `"undefined"`.
**Why it happens:** The TypeScript return type is `string | undefined`.
**How to avoid:** The wrapper function throws on `undefined`. In practice, this is unreachable for DB rows but the guard prevents silent corruption.
**Warning signs:** Any test that passes `undefined` to `hashPolicyVersion()` should throw, not return a hash.

### Pitfall 2: Date Objects vs. ISO Strings in Hash Inputs
**What goes wrong:** `canonicalize(date)` where `date` is a JavaScript `Date` object calls `date.toJSON()` which returns an ISO string — but the format includes milliseconds (`2026-04-15T10:00:00.000Z`). If the Drizzle query returns a Date object and the golden fixture was created with a string, hashes diverge.
**Why it happens:** Drizzle returns `timestamp` columns as JavaScript `Date` objects by default.
**How to avoid:** Hash input types must specify `string` for all timestamp fields. The hash functions convert Date → `.toISOString()` internally. Fixture inputs use ISO strings. Callers must pass pre-converted strings.
**Warning signs:** Fixture hash mismatch when running tests against real DB rows vs. fixture JSON.

### Pitfall 3: Array Ordering in Workshop Inputs
**What goes wrong:** `workshops` has `workshopArtifacts`, `workshopSectionLinks`, `workshopFeedbackLinks` as separate join tables. If the hash input includes an unsorted array of artifact/feedback IDs, the hash changes as rows are inserted in different orders.
**Why it happens:** SQL `SELECT ... FROM workshop_artifacts WHERE workshop_id = ?` returns rows in non-deterministic order without `ORDER BY`.
**How to avoid:** `hashWorkshop()` input uses `linkedArtifactIds: string[]` and `linkedFeedbackIds: string[]` — the caller must sort these arrays ascending by UUID string BEFORE passing to `hashWorkshop()`. This is documented in the function's JSDoc.
**Warning signs:** Flaky golden fixture tests that pass on one run and fail on another.

### Pitfall 4: Drizzle Enum Not Exported
**What goes wrong:** drizzle-kit issue #5174 — if `milestoneStatusEnum` is not exported from `milestones.ts`, drizzle-kit (if ever run for introspection) may fail to detect the enum.
**Why it happens:** Drizzle-kit's schema scanner only processes exported symbols.
**How to avoid:** Always `export const milestoneStatusEnum = pgEnum(...)`. This is the project's existing pattern (all enums in all schema files are exported).

### Pitfall 5: Postgres jsonb Unicode Surrogate Handling
**What goes wrong:** If `sectionsSnapshot` contains `\uD83D\uDE00` (emoji stored as surrogate pairs in UTF-16 escapes), Postgres JSONB converts them to direct UTF-8 encoding on storage. This means the bytes retrieved from DB differ from what was inserted if the input used `\uXXXX` escapes.
**Why it happens:** Postgres JSONB normalizes Unicode escapes to their literal UTF-8 representations.
**How to avoid:** This is not a problem for our hash stability because: (a) the hash is computed from the row AS READ FROM DB, not from the original insert payload; (b) all hash computations use the Drizzle query result, not the original client input. The hash is stable as long as the row content doesn't change — and it doesn't, because once published, `sectionsSnapshot` is immutable (VER-07).
**Warning signs:** If a golden fixture is created from a manually crafted JSON with `\uXXXX` escapes rather than a real DB row, the fixture hash may diverge from the DB-derived hash.

### Pitfall 6: Non-Concurrent Index in Transaction
**What goes wrong:** Using `CREATE INDEX CONCURRENTLY` in the migration SQL causes `ERROR: CREATE INDEX CONCURRENTLY cannot run inside a transaction block`.
**Why it happens:** Neon serverless (and most migration frameworks) run each migration in an implicit transaction.
**How to avoid:** Use `CREATE INDEX IF NOT EXISTS` without `CONCURRENTLY`. This is already documented in CONTEXT.md Claude's Discretion and confirmed correct.

### Pitfall 7: Drizzle `check()` Import
**What goes wrong:** `check` is imported from `'drizzle-orm/pg-core'` but the `sql` template tag it uses must come from `'drizzle-orm'`. Mixing up the import paths causes TS errors.
**How to avoid:** Two imports:
```typescript
import { pgTable, ..., check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
```

---

## Code Examples

### Golden Fixture File Format
```json
// src/lib/__tests__/fixtures/hashing/policy-version.json
{
  "input": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "documentId": "550e8400-e29b-41d4-a716-446655440001",
    "versionLabel": "v1.0",
    "sectionsSnapshot": [{ "id": "s1", "title": "Scope", "content": {} }],
    "changelog": [{ "sectionId": "s1", "summary": "Initial" }],
    "publishedAt": "2026-04-15T10:00:00.000Z",
    "createdBy": "550e8400-e29b-41d4-a716-446655440002"
  },
  "expectedHash": "<computed-once-locked-forever>"
}
```

The `expectedHash` is computed by running the actual `hashPolicyVersion()` once against this input. Once committed, it MUST NOT change. Any diff is a determinism regression.

### Permutation Test Pattern
```typescript
// src/lib/__tests__/hashing.test.ts
import fixture from './fixtures/hashing/policy-version.json'

it('hash is stable across key permutations', () => {
  const { input, expectedHash } = fixture
  // Shuffle object keys via destructuring + rebuild in different order
  const permuted = {
    createdBy:       input.createdBy,
    publishedAt:     input.publishedAt,
    versionLabel:    input.versionLabel,
    sectionsSnapshot: input.sectionsSnapshot,
    changelog:       input.changelog,
    documentId:      input.documentId,
    id:              input.id,
  }
  expect(hashPolicyVersion(permuted)).toBe(expectedHash)
})
```

### createHash One-Liner (confirmed)
```typescript
// Source: node:crypto, verified against cal-signature.ts pattern
import { createHash } from 'node:crypto'
const hex = createHash('sha256').update(canonicalString, 'utf8').digest('hex')
// hex is always exactly 64 lowercase hex characters
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 22 is purely code/config changes. All dependencies (`canonicalize` npm package, `node:crypto`, existing Drizzle/Neon stack) require only `npm install canonicalize`. No external services, runtimes, or DBs need to be verified beyond the existing project stack.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `canonicalize` | hashing.ts | ✗ (not installed) | 3.0.0 (install needed) | None — install required |
| `node:crypto` | hashing.ts | ✓ | Node 20 built-in | — |
| `vitest` | golden fixture tests | ✓ | ^4.1.1 | — |
| `@base-ui/react/tabs` | milestone detail UI | ✓ | existing via tabs.tsx | — |

**Missing dependencies requiring installation:**
```bash
npm install canonicalize
```

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is mandatory.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.1 |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run --reporter=dot` |
| Full suite command | `npx vitest run` |
| Estimated runtime | ~40s (full suite; baseline ~330 passing + Phase 22 new tests) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VERIFY-01 | `milestones` table created with correct columns + enum + CHECK constraint | unit (schema fixture) | `npx vitest run --reporter=dot src/lib/__tests__/hashing.test.ts` | ❌ Wave 0 |
| VERIFY-02 | `milestoneId` FK nullable on all 4 tables | unit (schema) | `npx vitest run --reporter=dot src/db/schema/__tests__/milestones.test.ts` | ❌ Wave 0 |
| VERIFY-03 | `milestoneRouter.markReady` computes hash + transitions state | unit (tRPC) | `npx vitest run --reporter=dot src/server/routers/__tests__/milestone.test.ts` | ❌ Wave 0 |
| VERIFY-04 | `hashPolicyVersion`, `hashWorkshop`, `hashEvidenceBundle`, `hashMilestone` return 64-char hex | unit (hashing) | `npx vitest run --reporter=dot src/lib/__tests__/hashing.test.ts` | ❌ Wave 0 |
| VERIFY-05 | Golden fixtures pass for all 6 hash functions across permuted inputs + array orderings | unit (golden fixture) | `npx vitest run --reporter=dot src/lib/__tests__/hashing.test.ts` | ❌ Wave 0 |

### Golden Fixture Coverage (VERIFY-04 + VERIFY-05)

Fixture files at `src/lib/__tests__/fixtures/hashing/`:

| Fixture File | Hash Function | Key Tests |
|---|---|---|
| `policy-version.json` | `hashPolicyVersion` | key permutation, null publishedAt, large sectionsSnapshot |
| `workshop.json` | `hashWorkshop` | sorted linkedArtifactIds, sorted linkedFeedbackIds, permuted keys |
| `feedback-item.json` | `hashFeedbackItem` | null fields, boolean isAnonymous, enum string values |
| `evidence-artifact.json` | `hashEvidenceArtifact` | null fileName, null fileSize, type 'link' vs 'file' |
| `evidence-bundle.json` | `hashEvidenceBundle` | array order independence (shuffled input = same hash) |
| `milestone.json` | `hashMilestone` | manifest sorted by (entityType, entityId), nested JSONB |

### tRPC Mutation Test Coverage (VERIFY-03)

`src/server/routers/__tests__/milestone.test.ts` — follows `consultation-summary.test.ts` pattern (vi.mock db, vi.mock audit, dynamic import via variable-path):

| Test Case | Requirement |
|---|---|
| `milestoneRouter` is exported | VERIFY-03 |
| `create` procedure defined | VERIFY-03 |
| `list` procedure defined | VERIFY-03 |
| `getById` procedure defined | VERIFY-03 |
| `attachEntity` procedure defined | VERIFY-02, VERIFY-03 |
| `detachEntity` procedure defined | VERIFY-02, VERIFY-03 |
| `markReady` procedure defined | VERIFY-03 |
| `markReady` throws if state is `anchored` | VERIFY-01 (immutability) |
| `markReady` throws if slots unmet (structured error listing unmet slots) | VERIFY-01, VERIFY-03 |
| `markReady` accepts if all slots met | VERIFY-03, VERIFY-04 |

### Hashing Test Coverage (VERIFY-04 + VERIFY-05)

`src/lib/__tests__/hashing.test.ts`:

| Test Case | Requirement |
|---|---|
| `canonicalize(obj)` matches known RFC 8785 test vector | VERIFY-05 |
| `canonicalize` wrapper throws on `undefined` return | VERIFY-05 |
| `hashPolicyVersion(input)` returns 64-char lowercase hex | VERIFY-04 |
| Key-permuted input to `hashPolicyVersion` returns same hash | VERIFY-05 |
| `hashPolicyVersion` with null `publishedAt` is stable | VERIFY-04 |
| `hashWorkshop` with shuffled `linkedArtifactIds` returns same hash | VERIFY-05 |
| `hashEvidenceBundle` with shuffled artifact array returns same hash | VERIFY-05 |
| `hashMilestone` with permuted manifest entries returns same hash (sorted) | VERIFY-05 |
| D-01a: `hashPolicyVersion(version)` == per-child hash inside milestone manifest | VERIFY-04 |
| Golden fixture: `hashPolicyVersion(fixture.input)` === `fixture.expectedHash` | VERIFY-05 |
| Golden fixture: `hashWorkshop(fixture.input)` === `fixture.expectedHash` | VERIFY-05 |
| Golden fixture: `hashEvidenceBundle(fixture.input)` === `fixture.expectedHash` | VERIFY-05 |
| Golden fixture: `hashMilestone(fixture.input)` === `fixture.expectedHash` | VERIFY-05 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=dot`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/__tests__/hashing.test.ts` — covers VERIFY-04, VERIFY-05 (RED against missing hashing.ts + canonicalize)
- [ ] `src/lib/__tests__/fixtures/hashing/*.json` — golden fixture files (empty `expectedHash` fields until hashing.ts ships)
- [ ] `src/server/routers/__tests__/milestone.test.ts` — covers VERIFY-03 (RED against missing milestone.ts router)
- [ ] `canonicalize` package install: `npm install canonicalize` — required before any test can run

---

## J. Wave Breakdown Recommendation

### Wave 0 (TDD — MUST run before any implementation)
**All tests RED; no implementation. Establishes the non-negotiable contract.**

- 22-00-PLAN.md (TDD)
  - Task 1: `npm install canonicalize` + `src/lib/__tests__/hashing.test.ts` (RED — all 14+ hash tests fail, missing hashing.ts + canonicalize wrapper)
  - Task 2: `src/lib/__tests__/fixtures/hashing/*.json` — 6 fixture files with input shapes but `expectedHash: ""` (to be filled post Wave 1)
  - Task 3: `src/server/routers/__tests__/milestone.test.ts` (RED — all router existence + procedure tests fail)
  - Task 4: Create `22-VALIDATION.md` from template; set `nyquist_compliant: true` + `wave_0_complete: true`

### Wave 1 (Schema + Hashing — can partially parallelize)
Two plans, with schema and hashing partially independent:

- 22-01-PLAN.md: Schema + migration
  - `src/db/schema/milestones.ts` (new)
  - `src/db/schema/index.ts` (add `milestones` export)
  - Modify 4 schema files to add `milestoneId` column (without `.references()`)
  - `src/db/migrations/0014_milestones_hashing.sql` (new)
  - `src/lib/constants.ts` (add 4 MILESTONE_* actions)
  - `src/lib/permissions.ts` (add `milestone:manage`, `milestone:read`)

- 22-02-PLAN.md: Hashing service
  - `npm install canonicalize`
  - `src/lib/hashing.ts` (pure functions: canonicalize wrapper, sha256Hex, 6 hash functions + types)
  - Fill `expectedHash` values in the 6 fixture JSON files (run `hashXxx(fixture.input)` + copy hex)
  - Flip Wave 0 RED tests for hashing.test.ts → GREEN

Both plans can run in parallel (schema doesn't depend on hashing.ts and vice versa), but the fixture fill step in 22-02 requires hashing.ts to be complete first.

### Wave 2 (tRPC Router)
Depends on Wave 1 (needs schema + hashing.ts + constants/permissions):

- 22-03-PLAN.md: tRPC milestone router
  - `src/server/routers/milestone.ts` (all 6 procedures)
  - `src/server/routers/_app.ts` (register `milestone: milestoneRouter`)
  - Flip Wave 0 RED tests for milestone.test.ts → GREEN

### Wave 3 (Admin UI)
Depends on Wave 2 (needs tRPC router for type inference):

- 22-04-PLAN.md: Admin milestone UI
  - `app/(workspace)/policies/[id]/layout.tsx` (add `canViewMilestones` prop)
  - `app/(workspace)/policies/[id]/_components/policy-tab-bar.tsx` (add Milestones tab)
  - `app/(workspace)/policies/[id]/milestones/page.tsx` (milestone index)
  - `app/(workspace)/policies/[id]/milestones/_components/milestone-list.tsx`
  - `app/(workspace)/policies/[id]/milestones/[milestoneId]/page.tsx` (detail + 4 tabs + mark-ready)

**Total: 5 plans (00–04)**

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `JSON.stringify(sortKeys(obj))` | `canonicalize` (RFC 8785 JCS) | Phase 22 first use | Correct UTF-16 key sort; IEEE 754 number format; standard-compliant |
| Hash ZIP bytes | Hash input manifest (artifact row fields) | Phase 22 design | Deterministic across Node versions and environments |

**Deprecated/outdated:**
- `JSON.stringify` with manual key sort: does not handle IEEE 754 edge cases or UTF-16 key ordering for non-ASCII keys. Replaced by `canonicalize` package.

---

## Open Questions

1. **`hashFeedbackItem` — should `xstateSnapshot` be included?**
   - What we know: `feedbackItems.xstateSnapshot jsonb` stores XState machine state, not content
   - What's unclear: Is this content-defining (part of the auditable record) or bookkeeping?
   - Recommendation: EXCLUDE `xstateSnapshot` from `hashFeedbackItem`. It is internal state machine state, not policy content. Same reasoning as excluding `isPublished` and `updatedAt` from `hashPolicyVersion`. The CONTEXT.md discretion section's `feedbackItems` hash fields list does not include `xstateSnapshot`.

2. **`hashWorkshop` — should recording transcript/summary content be included?**
   - What we know: Workshop has `workshopArtifacts` (join table to `evidenceArtifacts`) and Groq-generated transcript/summary stored as artifacts
   - What's unclear: The CONTEXT.md specifies `linkedArtifactIds: uuid[]` as the workshop hash component — is this the right granularity?
   - Recommendation: YES — use `linkedArtifactIds` (sorted) in `hashWorkshop`. The artifact content is captured separately via `hashEvidenceArtifact`. This keeps per-child hashes computable from a single row + immediate FK arrays (D-03a).

3. **`milestone_id` vs `milestoneId` in Drizzle schema**
   - What we know: Drizzle maps `uuid('milestone_id')` to TypeScript property `milestoneId` via camelCase convention
   - Recommendation: Use `uuid('milestone_id')` in all 4 modified schema files, which Drizzle automatically maps to `milestoneId` in TypeScript. Consistent with all existing FK column naming in the project (e.g., `documentId`, `workshopId`).

---

## Sources

### Primary (HIGH confidence)
- `src/db/migrations/0011_cal_com_workshop_register.sql` — idempotent migration pattern
- `src/db/migrations/0013_consultation_summary.sql` — minimal JSONB ALTER TABLE pattern
- `src/db/schema/changeRequests.ts` — JSONB $type<>, unique constraint patterns
- `src/db/schema/workshops.ts` — pgEnum, FK pattern, join table patterns
- `src/db/schema/feedback.ts` — nullable FK pattern (`resolvedInVersionId`)
- `src/lib/cal-signature.ts` — `createHmac + 'utf8'` pattern
- `src/lib/feedback-token.ts` — `node:crypto` HMAC pattern, `jose` rejection rationale
- `src/server/services/consultation-summary.service.ts` — pure service module pattern
- `src/server/routers/consultation-summary.ts` — 5-procedure tRPC + writeAuditLog + ACTIONS pattern
- `src/server/routers/_app.ts` — router registration pattern
- `src/lib/constants.ts` — ACTIONS + PERMISSIONS pattern
- `src/trpc/init.ts` — `requirePermission` middleware
- `app/(workspace)/policies/[id]/layout.tsx` — params Promise pattern, tab bar prop passing
- `app/(workspace)/policies/[id]/_components/policy-tab-bar.tsx` — tab structure
- `components/ui/tabs.tsx` — `@base-ui/react/tabs` primitive
- `vitest.config.mts` — test runner config (jsdom, globals, include patterns)
- npm registry: `canonicalize@3.0.0` — version, deps, exports (confirmed 2026-04-15)
- GitHub erdtman/canonicalize — source, TS types, edge cases (confirmed 2026-04-15)
- RFC 8785 §3.2.2 — array ordering (MUST preserve); §3.2.3 — no Unicode normalization

### Secondary (MEDIUM confidence)
- Snyk npm advisor: canonicalize ~135k weekly downloads, sustainable maintenance rating
- RFC 8785 (IETF) — JCS spec as confirmed by official rfc-editor.org

### Tertiary (LOW confidence)
- Postgres JSONB Unicode escape normalization behavior (surrogate pairs → UTF-8) — from PostgreSQL docs; not directly tested in this codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against npm registry + project codebase
- Migration patterns: HIGH — verified against existing 0011, 0013 migrations
- Architecture: HIGH — all patterns verified against existing codebase files
- Hashing service design: HIGH — verified against RFC 8785 + node:crypto docs
- Pitfalls: HIGH — all sourced from code analysis + RFC text + Node.js docs
- Evidence bundle design: HIGH — verified against Phase 18 evidence-pack.service.ts

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (stable stack; `canonicalize` v3.0.0 just released so unlikely to change before planning)
