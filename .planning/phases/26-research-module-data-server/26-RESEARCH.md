# Phase 26: Research Module — Data & Server — Research

**Researched:** 2026-04-19
**Domain:** Drizzle ORM schema, tRPC router patterns, RBAC, state machine lifecycle, Neon HTTP migrations
**Confidence:** HIGH (all findings grounded in actual codebase reads)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
| # | Decision |
|---|----------|
| Q1 | `documentId NOT NULL` — scoped per policy |
| Q2 | `admin + policy_lead + research_lead` can create; only admin + policy_lead can publish |
| Q3 | Moderation gate required (no self-publish) |
| Q4 | Milestone-only anchoring; no individual per-item tx |
| Q5 | Section-level links only (FK `policy_sections`) |
| Q7 | `isAuthorAnonymous boolean NOT NULL DEFAULT false` |
| Q8 | No authorship transfer in v0.2 |
| Q10 | DOI stored as plain text |

### Claude's Discretion
- Exact SQL index names and migration statement ordering
- Whether to use composite PK or surrogate UUID on link tables (research: composite PK matches workshop/evidence pattern)
- Order of audit write vs DB write within mutations (research: INSERT workflow_transitions first per R6 invariant)
- readableId padding width (research: use 3 digits matching FB-NNN pattern)

### Deferred Ideas (OUT OF SCOPE)
- No UI (Phase 27)
- No public listing (Phase 28)
- No individual per-item Cardano anchor (milestone-only for v0.2)
- No authorship transfer mutation
- No DOI external validation
- No per-section-version linking (section-level only)
- No Inngest function for research items
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RESEARCH-01 | `research_items` table + 3 link tables exist; migration 0025 applied | Schema section, migration conventions section |
| RESEARCH-02 | `readableId` via `nextval('research_item_id_seq')` produces RI-001, RI-002, … collision-free | Readable ID section — exact `nextval` call pattern from feedback router |
| RESEARCH-03 | 7 new RBAC permissions with grants in `permissions.ts` | Permissions section — exact format, grant table shape |
| RESEARCH-04 | tRPC `research` router with 16 procs, permission guards, audit writes, Zod validation | Router conventions section — full anatomy |
| RESEARCH-05 | State machine (draft → pending_review → published/draft, published → retracted) enforced in service layer with workflow_transitions logging | State machine section — mirrored from feedback.service.ts |
</phase_requirements>

---

## Summary

Phase 26 adds a `research_items` domain entity with its own lifecycle, three linking tables, RBAC, and a tRPC router — all backend only. Every pattern needed is already present in the codebase and has been read verbatim. The work mirrors the feedback system (readable ID, XState-style state machine with fallback valid-transition table, workflow_transitions logging, audit fire-and-forget) and the milestone system (SQL-only circular FK, ManifestEntry union extension, partial indexes). No new dependencies are required.

The critical risk is the 7-permission delta hitting the RBAC test file; the planner must account for updating `feedback-permissions.test.ts` (or a new `research-permissions.test.ts`) to cover every new grant and deny. The state machine is simpler than feedback (4 states, 5 transitions vs 6 states, 5 events) — the bigger risk is the rejecting-back-to-draft transition path, which has no precedent in the feedback machine (feedback cannot go backward).

**Primary recommendation:** Mirror `feedback.service.ts` R1 fallback pattern exactly — VALID_TRANSITIONS table plus XState machine (or XState-style guard table without XState). Given that the research machine has no `xstateSnapshot` storage precedent for simpler lifecycles (workshop transitions do NOT use XState snapshots), implement a pure VALID_TRANSITIONS table approach in `research.lifecycle.ts` without XState, and call that from `research.service.ts`. This eliminates the snapshot JSONB column and its associated corruption-fallback complexity.

---

## Standard Stack

### Core (all already installed — zero new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | installed | Schema definition, queries | Project ORM |
| @neondatabase/serverless | installed | Migration runner (`sql.query()`) | Pattern 2 — all migrations since 0011 |
| zod | v4 installed | Input validation on tRPC procedures | Project validator |
| @trpc/server | v11 installed | Router definition, `TRPCError` | Project RPC layer |
| vitest | installed | Unit tests | Project test runner |

No new packages. The entire phase is code-only + SQL migration.

**Version verification:** All packages confirmed as already installed in `package.json`. No install step needed.

---

## Architecture Patterns

### Recommended File Structure

```
src/
├── db/
│   ├── schema/
│   │   └── research.ts                     ← NEW: all 4 tables + enums
│   └── migrations/
│       └── 0025_research_module.sql         ← NEW: DDL
├── server/
│   ├── routers/
│   │   ├── _app.ts                          ← MOD: add research subRouter
│   │   └── research.ts                      ← NEW: 16 procedures
│   └── services/
│       ├── research.service.ts              ← NEW: transitionResearch(), linkSection(), etc.
│       └── research.lifecycle.ts            ← NEW: VALID_TRANSITIONS table + guard
├── lib/
│   ├── permissions.ts                       ← MOD: 7 new entries
│   └── constants.ts                         ← MOD: RESEARCH_* ACTIONS
scripts/
└── apply-migration-0025.mjs                 ← NEW: Neon HTTP runner
src/__tests__/
└── research-*.test.ts                       ← NEW: router, service, lifecycle, perms
```

### Pattern 1: Drizzle Schema Shape

Grounded in `src/db/schema/feedback.ts` (lines 1–49) and `src/db/schema/workshops.ts` (lines 64–76).

**Main table** — follows feedback.ts layout verbatim:
```typescript
// src/db/schema/research.ts
import { pgTable, pgEnum, uuid, text, timestamp, boolean, date, index, primaryKey } from 'drizzle-orm/pg-core'
import { users } from './users'
import { policyDocuments } from './documents'
import { policySections } from './documents'
import { feedbackItems } from './feedback'
import { evidenceArtifacts } from './evidence'
// NOTE: no import of documentVersions — circular import avoided via SQL-only FK

export const researchItemTypeEnum = pgEnum('research_item_type', [
  'report', 'paper', 'dataset', 'memo', 'interview_transcript',
  'media_coverage', 'legal_reference', 'case_study',
])

export const researchItemStatusEnum = pgEnum('research_item_status', [
  'draft', 'pending_review', 'published', 'retracted',
])

export const researchItems = pgTable('research_items', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  readableId:         text('readable_id').notNull().unique(),
  documentId:         uuid('document_id').notNull().references(() => policyDocuments.id),
  title:              text('title').notNull(),
  itemType:           researchItemTypeEnum('item_type').notNull(),
  status:             researchItemStatusEnum('status').notNull().default('draft'),
  createdBy:          uuid('created_by').notNull().references(() => users.id),
  // Optional citation fields
  description:        text('description'),
  externalUrl:        text('external_url'),
  artifactId:         uuid('artifact_id').references(() => evidenceArtifacts.id),
  doi:                text('doi'),
  authors:            text('authors').array(),
  publishedDate:      date('published_date'),
  peerReviewed:       boolean('peer_reviewed').notNull().default(false),
  journalOrSource:    text('journal_or_source'),
  versionLabel:       text('version_label'),
  previousVersionId:  uuid('previous_version_id'),  // self-FK — constraint in SQL only (circular)
  isAuthorAnonymous:  boolean('is_author_anonymous').notNull().default(false),
  // Review fields
  reviewedBy:         uuid('reviewed_by').references(() => users.id),
  reviewedAt:         timestamp('reviewed_at', { withTimezone: true }),
  retractionReason:   text('retraction_reason'),
  // Milestone anchoring (SQL-only FK, same as workshops.milestoneId)
  milestoneId:        uuid('milestone_id'),
  // Cardano anchoring fields (Q4: milestone-only in v0.2, columns present for v0.3)
  contentHash:        text('content_hash'),
  txHash:             text('tx_hash'),
  anchoredAt:         timestamp('anchored_at', { withTimezone: true }),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_research_items_document').on(t.documentId),
  index('idx_research_items_status').on(t.status),
  index('idx_research_items_created_by').on(t.createdBy),
])
```

**Link tables** — follow `workshopSectionLinks` / `feedbackEvidence` composite-PK pattern exactly (verified in `src/db/schema/workshops.ts` lines 64–76, `src/db/schema/evidence.ts` lines 21–33):
```typescript
export const researchItemSectionLinks = pgTable('research_item_section_links', {
  researchItemId: uuid('research_item_id').notNull().references(() => researchItems.id, { onDelete: 'cascade' }),
  sectionId:      uuid('section_id').notNull().references(() => policySections.id, { onDelete: 'cascade' }),
  relevanceNote:  text('relevance_note'),
}, (t) => [
  primaryKey({ columns: [t.researchItemId, t.sectionId] }),
])

export const researchItemVersionLinks = pgTable('research_item_version_links', {
  researchItemId: uuid('research_item_id').notNull().references(() => researchItems.id, { onDelete: 'cascade' }),
  versionId:      uuid('version_id').notNull(),  // FK to document_versions — SQL only (avoids circular import)
}, (t) => [
  primaryKey({ columns: [t.researchItemId, t.versionId] }),
])

export const researchItemFeedbackLinks = pgTable('research_item_feedback_links', {
  researchItemId: uuid('research_item_id').notNull().references(() => researchItems.id, { onDelete: 'cascade' }),
  feedbackId:     uuid('feedback_id').notNull().references(() => feedbackItems.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.researchItemId, t.feedbackId] }),
])
```

**Why `researchItemVersionLinks.versionId` uses SQL-only FK:**
`documentVersions` is defined in `changeRequests.ts` which already imports from `feedback.ts`. Adding `references(() => documentVersions)` in `research.ts` creates a potential import chain; use the same SQL-only pattern established by `workshops.milestoneId` (verified in `src/db/schema/workshops.ts` line 53 comment).

### Pattern 2: Migration SQL (0025)

Grounded in `0014_milestones_hashing.sql` — the canonical template for complex migrations. Key conventions:

1. **No transaction wrapper** — Neon HTTP runner executes each statement individually via `sql.query(stmt)`
2. **Idempotent** — every DDL uses `IF NOT EXISTS`; enum creation in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END $$`
3. **Sequence creation** — matches `feedback_id_seq` exactly:
   ```sql
   CREATE SEQUENCE IF NOT EXISTS research_item_id_seq START 1;
   ```
4. **SQL-only FKs** — all circular references added via `DO $$ BEGIN ALTER TABLE ADD CONSTRAINT ... EXCEPTION WHEN duplicate_object THEN null; END $$`
5. **Partial indexes** — `CREATE INDEX IF NOT EXISTS ... WHERE milestone_id IS NOT NULL` (matches 0014 lines 72–84)

```sql
-- 0025_research_module.sql excerpt (key structural pieces)
DO $$ BEGIN
  CREATE TYPE research_item_type AS ENUM (
    'report', 'paper', 'dataset', 'memo', 'interview_transcript',
    'media_coverage', 'legal_reference', 'case_study'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE research_item_status AS ENUM (
    'draft', 'pending_review', 'published', 'retracted'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE SEQUENCE IF NOT EXISTS research_item_id_seq START 1;

CREATE TABLE IF NOT EXISTS research_items ( ... );

-- SQL-only FKs (circular: previousVersionId → document_versions, milestoneId → milestones)
DO $$ BEGIN
  ALTER TABLE research_items
    ADD CONSTRAINT research_items_milestone_id_fkey
    FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE research_items
    ADD CONSTRAINT research_items_previous_version_id_fkey
    FOREIGN KEY (previous_version_id) REFERENCES research_items(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE research_item_version_links
    ADD CONSTRAINT research_item_version_links_version_id_fkey
    FOREIGN KEY (version_id) REFERENCES document_versions(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Partial indexes for milestone FK
CREATE INDEX IF NOT EXISTS idx_research_items_milestone_id
  ON research_items (milestone_id) WHERE milestone_id IS NOT NULL;
```

**ON DELETE behaviour for milestoneId:** `SET NULL` (matches all 4 existing milestoneId FKs in 0014 — deleting a milestone unlinks entities rather than cascading deletion).

### Pattern 3: Readable ID Generation

Exact pattern from `src/server/routers/feedback.ts` lines 40–43:
```typescript
// In research.ts router — create procedure:
const seqRows = await db.execute(sql`SELECT nextval('research_item_id_seq') AS seq`)
const seqResult = seqRows.rows[0] as Record<string, unknown>
const num = Number(seqResult.seq)
const readableId = `RI-${String(num).padStart(3, '0')}`
```

**Why this is collision-safe:** PostgreSQL sequences are transaction-safe and monotonic. `nextval()` never returns the same value twice under concurrent writes. The pattern is identical to `feedback_id_seq` which has been in production since Phase 4 with no collisions reported.

**Collision stress test:** The test file must call `create` N times in parallel (e.g., `Promise.all(Array.from({ length: 20 }, () => createItem(...)))`) and assert all returned `readableId` values are unique — same approach as feedback-machine tests.

### Pattern 4: State Machine (No XState — Pure Transition Table)

**Key architectural decision:** Do NOT use XState + `xstateSnapshot` column for the research state machine.

Rationale:
- Workshop transitions (`src/server/routers/workshop.ts`) use a pure `ALLOWED_TRANSITIONS` const map without XState or snapshot persistence (confirmed in STATE.md Phase 17 entry: "ALLOWED_TRANSITIONS const map encodes workshop state machine")
- The research lifecycle has only 4 states and 5 transitions — XState overhead is unjustified
- Avoiding `xstateSnapshot` column eliminates the snapshot-corruption fallback complexity in `feedback.service.ts` lines 73–119

**`src/server/services/research.lifecycle.ts`:**
```typescript
// Source: mirrors feedback.service.ts R1 fallback VALID_TRANSITIONS table
export type ResearchItemStatus = 'draft' | 'pending_review' | 'published' | 'retracted'

export const VALID_TRANSITIONS: Record<ResearchItemStatus, ResearchItemStatus[]> = {
  draft:          ['pending_review'],
  pending_review: ['published', 'draft'],   // 'draft' = reject returns to editable
  published:      ['retracted'],
  retracted:      [],
}

export function assertValidTransition(from: ResearchItemStatus, to: ResearchItemStatus): void {
  const allowed = VALID_TRANSITIONS[from] ?? []
  if (!allowed.includes(to)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Invalid transition: cannot move from ${from} to ${to}`,
    })
  }
}
```

**`src/server/services/research.service.ts`:**
```typescript
// Source: mirrors feedback.service.ts insert-then-update order (R6 invariant)
export async function transitionResearch(
  researchItemId: string,
  toStatus: ResearchItemStatus,
  actorId: string,
  meta?: Record<string, unknown>,
) {
  const [row] = await db.select().from(researchItems).where(eq(researchItems.id, researchItemId)).limit(1)
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Research item not found' })

  assertValidTransition(row.status as ResearchItemStatus, toStatus)

  // R6 invariant: INSERT workflow_transitions FIRST — if DB update fails,
  // audit row survives and retry can recover. (feedback.service.ts lines 144–162)
  await db.insert(workflowTransitions).values({
    entityType: 'research_item',
    entityId: researchItemId,
    fromState: row.status,
    toState: toStatus,
    actorId,
    metadata: meta ?? {},
  })

  const updateData: Record<string, unknown> = {
    status: toStatus,
    updatedAt: new Date(),
  }
  // Populate review fields on approve
  if (toStatus === 'published') {
    updateData.reviewedBy = actorId
    updateData.reviewedAt = new Date()
  }
  if (toStatus === 'retracted' && meta?.retractionReason) {
    updateData.retractionReason = meta.retractionReason
  }

  const [updated] = await db
    .update(researchItems)
    .set(updateData)
    .where(eq(researchItems.id, researchItemId))
    .returning()

  return Object.assign(updated, { previousStatus: row.status, newStatus: toStatus })
}
```

### Pattern 5: tRPC Router Anatomy

Grounded in `src/server/routers/feedback.ts` (full read) and `src/trpc/init.ts`.

```typescript
// src/server/routers/research.ts — structural skeleton
import { router, requirePermission, protectedProcedure } from '@/src/trpc/init'
import { z } from 'zod'
import { writeAuditLog } from '@/src/lib/audit'
import { ACTIONS } from '@/src/lib/constants'
import { transitionResearch } from '@/src/server/services/research.service'
import { db } from '@/src/db'
import { TRPCError } from '@trpc/server'
import { sql } from 'drizzle-orm'

export const researchRouter = router({
  // QUERIES
  list:        requirePermission('research:read_drafts').input(...).query(...),
  listPublic:  protectedProcedure.input(...).query(...),   // all authenticated roles + unauthenticated via public route
  getById:     protectedProcedure.input(...).query(...),

  // MUTATIONS — create / update
  create:      requirePermission('research:create').input(...).mutation(async ({ ctx, input }) => {
    // 1. nextval sequence → readableId
    // 2. db.insert(researchItems)
    // 3. writeAuditLog fire-and-forget (.catch(console.error))
    // 4. return { id, readableId }
  }),
  update:      requirePermission('research:manage_own').input(...).mutation(...),

  // MUTATIONS — lifecycle transitions (each calls transitionResearch())
  submitForReview: requirePermission('research:submit_review').input(...).mutation(...),
  approve:         requirePermission('research:publish').input(...).mutation(...),
  reject:          requirePermission('research:publish').input(...).mutation(...),  // returns to draft
  retract:         requirePermission('research:retract').input(...).mutation(...),

  // MUTATIONS — link tables (idempotent — onConflictDoNothing pattern from Phase 10)
  linkSection:     requirePermission('research:manage_own').input(...).mutation(...),
  unlinkSection:   requirePermission('research:manage_own').input(...).mutation(...),
  linkVersion:     requirePermission('research:manage_own').input(...).mutation(...),
  unlinkVersion:   requirePermission('research:manage_own').input(...).mutation(...),
  linkFeedback:    requirePermission('research:manage_own').input(...).mutation(...),
  unlinkFeedback:  requirePermission('research:manage_own').input(...).mutation(...),
})
```

**Key conventions from codebase:**
- `requirePermission(perm)` from `src/trpc/init.ts` line 131 — single-permission guard, throws `FORBIDDEN` automatically
- `writeAuditLog({...}).catch(console.error)` — fire-and-forget, never awaited in mutation critical path (feedback.ts line 62–75 pattern)
- Link table mutations use `.onConflictDoNothing()` for idempotency (Phase 10 STATE.md decision: "onConflictDoNothing for idempotent workshop section/feedback linking")
- `z.guid()` not `z.uuid()` for all UUID inputs (Phase 16 precedent — Zod 4 `z.uuid()` rejects version-0 UUIDs used in test fixtures)

**Audit write ordering vs DB write:**
Per R6 invariant documented in `feedback.service.ts` lines 139–162 comments: insert `workflowTransitions` FIRST, then update the main row. For non-transition mutations (create, update, link/unlink): `writeAuditLog` fire-and-forget AFTER the primary DB write (standard feedback.ts pattern).

### Pattern 6: Permissions Addition

`src/lib/permissions.ts` — exact format (verified lines 1–85):

```typescript
// Add in src/lib/permissions.ts — inside the PERMISSIONS object:

// Research Module (Phase 26)
'research:create':          [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD] as readonly Role[],
'research:manage_own':      [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD] as readonly Role[],
'research:submit_review':   [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD] as readonly Role[],
'research:publish':         [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
'research:retract':         [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
'research:read_drafts':     [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD] as readonly Role[],
'research:read_published':  [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.RESEARCH_LEAD, ROLES.WORKSHOP_MODERATOR, ROLES.STAKEHOLDER, ROLES.OBSERVER, ROLES.AUDITOR] as readonly Role[],
```

`Permission` type is `keyof typeof PERMISSIONS` (line 87) — adding new keys automatically extends the union type. No other type changes needed.

### Pattern 7: ACTIONS Constants Addition

`src/lib/constants.ts` — format (verified lines 29–108, action string format is `'entity.verb'`):

```typescript
// Add to ACTIONS object in src/lib/constants.ts:
RESEARCH_CREATE:           'research.create',
RESEARCH_UPDATE:           'research.update',
RESEARCH_SUBMIT_REVIEW:    'research.submit_review',
RESEARCH_APPROVE:          'research.approve',
RESEARCH_REJECT:           'research.reject',
RESEARCH_RETRACT:          'research.retract',
RESEARCH_SECTION_LINK:     'research.section_link',
RESEARCH_SECTION_UNLINK:   'research.section_unlink',
RESEARCH_VERSION_LINK:     'research.version_link',
RESEARCH_VERSION_UNLINK:   'research.version_unlink',
RESEARCH_FEEDBACK_LINK:    'research.feedback_link',
RESEARCH_FEEDBACK_UNLINK:  'research.feedback_unlink',
```

### Pattern 8: ManifestEntry + RequiredSlots Extension

`src/db/schema/milestones.ts` lines 22–26 — exact location:

```typescript
// BEFORE:
export type ManifestEntry = {
  entityType: 'version' | 'workshop' | 'feedback' | 'evidence'
  entityId: string
  contentHash: string
}

export type RequiredSlots = {
  versions?: number
  workshops?: number
  feedback?: number
  evidence?: number
}

// AFTER:
export type ManifestEntry = {
  entityType: 'version' | 'workshop' | 'feedback' | 'evidence' | 'research_item'
  entityId: string
  contentHash: string
}

export type RequiredSlots = {
  versions?: number
  workshops?: number
  feedback?: number
  evidence?: number
  research_items?: number
}
```

No Drizzle schema changes — `manifest` and `requiredSlots` are both `jsonb` columns with TypeScript-only type assertions (`.$type<>()`) in milestones.ts lines 44–42. TypeScript change only.

### Pattern 9: appRouter Registration

`src/server/routers/_app.ts` — append pattern (verified lines 1–30):

```typescript
import { researchRouter } from './research'

export const appRouter = router({
  // ... existing routers ...
  milestone: milestoneRouter,
  research: researchRouter,   // ← add at end
})
```

### Anti-Patterns to Avoid

- **Do NOT add `.references(() => documentVersions)` in `research.ts`** — circular import chain; FK lives in SQL migration only (same as all milestoneId columns)
- **Do NOT use XState + `xstateSnapshot` column** — overkill for 4-state machine; workshop pattern (ALLOWED_TRANSITIONS const) is the right precedent
- **Do NOT await `writeAuditLog`** — fire-and-forget with `.catch(console.error)` is the Phase 1 invariant (feedback.ts lines 62–75)
- **Do NOT use `z.uuid()` for UUID inputs** — use `z.guid()` (Phase 16 decision, Zod 4 rejects v0 UUIDs in test fixtures)
- **Do NOT use `db.transaction()`** — Neon HTTP driver does not support transactions (Phase 2 STATE.md decision: "Sequential updates instead of transactions for Neon HTTP driver compatibility")
- **Do NOT use `drizzle-kit push`** — always use the Neon HTTP runner pattern (`apply-migration-0025.mjs`) per Pattern 2 / Phase 14/16 precedent

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Readable ID collision prevention | Custom locking / in-memory counter | `nextval('research_item_id_seq')` | PostgreSQL sequences are atomic; same pattern has zero collisions since Phase 4 |
| Idempotent link table inserts | Check-then-insert with race condition | `.onConflictDoNothing()` | Drizzle built-in, established in Phase 10 |
| Permission checking | Custom role-array lookup | `can(role, permission)` from `src/lib/permissions.ts` | Single source of truth, typed, tested |
| Auth guard on procedures | Manual `ctx.user.role` check | `requirePermission('research:...')` from `src/trpc/init.ts` | Middleware throws FORBIDDEN automatically |
| Audit log writes | Custom table insert | `writeAuditLog({...})` from `src/lib/audit.ts` | Handles `ipAddress`, types `Action`, standard interface |
| State transition enforcement | Ad-hoc `if/else` in router | `assertValidTransition()` in `research.lifecycle.ts` | Centralised, testable, mirrors feedback R1 fallback |

---

## Common Pitfalls

### Pitfall 1: Circular Import → Drizzle Type Error

**What goes wrong:** Adding `references(() => documentVersions)` in `research.ts` causes TypeScript to hit infinite recursion resolving cross-table generic types. The compiler hangs or produces `Type instantiation is excessively deep` errors.

**Why it happens:** `documentVersions` (in `changeRequests.ts`) already has cross-references; adding a reverse reference creates a cycle.

**How to avoid:** SQL-only FK for `researchItemVersionLinks.versionId` and `researchItems.milestoneId` and `researchItems.previousVersionId`. Comment each with `// FK to X — constraint in SQL migration only (avoids circular import)` to match the exact pattern in `feedback.ts` line 43 and `workshops.ts` line 53.

**Warning signs:** TypeScript errors mentioning `Type instantiation is excessively deep` or unusually slow type-checking.

### Pitfall 2: `workflowTransitions` Write Order

**What goes wrong:** If the `workflowTransitions` INSERT is placed AFTER the `researchItems` UPDATE, a transient INSERT failure leaves the row in the new state with no audit record. XState guards (or VALID_TRANSITIONS guards) then block re-running the same transition, making the audit entry permanently unrecoverable.

**Why it happens:** The natural order is "update first, then record it" — but this is wrong for append-only audit tables.

**How to avoid:** Always INSERT `workflowTransitions` first (R6 invariant). If the status UPDATE fails, the transition row survives as a durable record; a retry can re-apply. Verified in `feedback.service.ts` lines 139–162 comments.

### Pitfall 3: Self-FK on `research_items.previousVersionId`

**What goes wrong:** Adding `references(() => researchItems)` in the same table declaration will compile but Postgres may reject the FK on the first migration run if the table creation is a single statement (self-referential FKs require the table to exist first).

**How to avoid:** Always add `previousVersionId` self-FK as a separate `ALTER TABLE ADD CONSTRAINT` statement in the migration, AFTER the `CREATE TABLE IF NOT EXISTS research_items` statement.

### Pitfall 4: `research:read_published` Grant Width

**What goes wrong:** Granting `research:read_published` only to authenticated roles means the future public listing (Phase 28) cannot call `research.listPublic` from server components without being authenticated.

**How to avoid:** `research:read_published` should be granted to ALL 7 authenticated roles. The `listPublic` procedure in the router should be a `protectedProcedure` (requires auth) for authenticated access; Phase 28 will add a public-route equivalent that queries directly without the tRPC permission guard (same pattern as public portal which calls DB directly from server components, not via `requirePermission`).

### Pitfall 5: Anonymous Author Filter Missing from Public Queries

**What goes wrong:** `listPublic` returns `authors` array even when `isAuthorAnonymous = true`, leaking confidential source names.

**How to avoid:** In `listPublic`, map results: if `row.isAuthorAnonymous`, return `authors: null` (or replace with `["Source: Confidential"]`). Same pattern as feedback anonymity enforcement in `feedback.ts` lines 199–217.

### Pitfall 6: `manage_own` Scope Not Enforced

**What goes wrong:** `requirePermission('research:manage_own')` only checks the role has the permission — it does not check `createdBy === ctx.user.id`. An admin has the permission but should be able to manage ANY item; a `research_lead` should only manage their own drafts.

**How to avoid:** In the `update`, `submitForReview`, and link mutations, add a secondary check after the DB fetch:
```typescript
if (ctx.user.role === 'research_lead' && row.createdBy !== ctx.user.id) {
  throw new TRPCError({ code: 'FORBIDDEN', message: 'Can only manage your own research items' })
}
```
Admin and policy_lead bypass this secondary check (they always have full access). Pattern established by Phase 10 workshop ownership check (STATE.md: "Ownership check on workshop update/delete: creator or admin only").

### Pitfall 7: 16-Procedure Router — Permission Drift

**What goes wrong:** With 16 procedures, it's easy for a procedure to accidentally use the wrong permission (e.g., `linkFeedback` gets `research:publish` instead of `research:manage_own`).

**How to avoid:** Map every procedure to its permission before writing any code (documented in the router section above). The RBAC test file must exercise every permission/role combination including denials — the `feedback-permissions.test.ts` pattern (108 individual `expect(can(...)).toBe(...)` calls) is the required approach.

---

## Code Examples

### Verified: Sequence nextval Pattern
```typescript
// Source: src/server/routers/feedback.ts lines 40–43
const seqRows = await db.execute(sql`SELECT nextval('research_item_id_seq') AS seq`)
const seqResult = seqRows.rows[0] as Record<string, unknown>
const num = Number(seqResult.seq)
const readableId = `RI-${String(num).padStart(3, '0')}`
```

### Verified: workflowTransitions Insert Shape
```typescript
// Source: src/server/services/feedback.service.ts lines 151–161
await db.insert(workflowTransitions).values({
  entityType: 'research_item',   // discriminator string — not a typed enum
  entityId: researchItemId,
  fromState: previousState,
  toState: newState,
  actorId,
  metadata: { event: 'APPROVE', ...extraMeta },
})
```

### Verified: Audit Fire-and-Forget
```typescript
// Source: src/server/routers/feedback.ts lines 62–74
writeAuditLog({
  actorId: ctx.user!.id,
  actorRole: ctx.user!.role,
  action: ACTIONS.RESEARCH_CREATE,
  entityType: 'research_item',
  entityId: item.id,
  payload: { readableId, documentId: input.documentId, itemType: input.itemType },
}).catch(console.error)
```

### Verified: onConflictDoNothing for Link Tables
```typescript
// Source: Phase 10 STATE.md pattern — confirmed in workshop router
await db.insert(researchItemSectionLinks)
  .values({ researchItemId: input.researchItemId, sectionId: input.sectionId })
  .onConflictDoNothing()
```

### Verified: requirePermission Middleware
```typescript
// Source: src/trpc/init.ts lines 131–137
export const requirePermission = (permission: Permission) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!can(ctx.user.role as Role, permission)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: `Missing permission: ${permission}` })
    }
    return next({ ctx })
  })
```

### Verified: SQL-Only FK Comment Pattern
```typescript
// Source: src/db/schema/feedback.ts line 43
resolvedInVersionId: uuid('resolved_in_version_id'),  // FK to documentVersions - constraint in SQL migration only (avoids circular import)

// Source: src/db/schema/workshops.ts line 53
milestoneId: uuid('milestone_id'),  // FK to milestones - constraint in SQL migration only (avoids circular import)
```

### Verified: Neon HTTP Runner Pattern
```javascript
// Source: scripts/apply-migration-0014.mjs lines 77–86
for (const stmt of statements) {
  try {
    await sql.query(stmt)   // sql.query(string) form — NOT tagged template
  } catch (err) {
    console.error(`FAILED statement:\n${stmt}\n`)
    throw err
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact on Phase 26 |
|--------------|------------------|--------------|---------------------|
| XState for all state machines | Pure VALID_TRANSITIONS const for simple machines (workshops Phase 17) | Phase 17 | Use pure table approach, no xstateSnapshot column |
| `drizzle-kit push` for schema changes | Neon HTTP runner (`sql.query()`) | Phase 14 | Write `apply-migration-0025.mjs` |
| Direct `createNotification()` | Inngest event dispatch | Phase 16 | No notifications needed for research module v0.2 |
| `z.uuid()` for UUID inputs | `z.guid()` for UUID inputs | Phase 16 | All input schemas use `z.guid()` |
| Single-source audit log insert | fire-and-forget `writeAuditLog(...).catch(console.error)` | Phase 1 | All mutations follow this pattern |

**No deprecated patterns relevant to Phase 26.** The workshop state machine (Phase 17) is the most recent comparable implementation and is the direct template.

---

## Open Questions

1. **`update` permission scope for `pending_review` items**
   - What we know: `research:manage_own` covers create + update + link operations
   - What's unclear: Can a `research_lead` update metadata (title, description) after submitting for review (status = `pending_review`)? Or does submission lock the item until approved/rejected?
   - Recommendation: Lock updates once `pending_review` — add status guard in `update` mutation: `if (row.status !== 'draft') throw FORBIDDEN`. If admin wants to force-update, they reject first (returns to draft) then research_lead edits. This matches the workshop artifact review pattern.

2. **`listPublic` procedure vs public-route direct query**
   - What we know: Phase 28 needs a public (no-auth) listing. Phase 26 only provides the authenticated `listPublic` proc.
   - What's unclear: Should `listPublic` use `protectedProcedure` (requires auth) or be a `publicProcedure`?
   - Recommendation: Use `protectedProcedure` for Phase 26 since no unauthenticated consumer exists yet. Phase 28 will add a server-component direct DB query for the public surface (same pattern as `/portal` page which calls DB directly without tRPC).

3. **`manage_own` permission for link mutations — who can link to a published item?**
   - What we know: CONTEXT.md says `research:manage_own` covers link operations
   - What's unclear: Can a `policy_lead` link a published research item to a version/section (they authored neither), or does linking require the item owner?
   - Recommendation: `requirePermission('research:manage_own')` for link mutations is sufficient — admin and policy_lead both have this permission (verified against INTEGRATION.md §8). The secondary ownership check (`createdBy === ctx.user.id`) should apply only in the `update` mutation, not in link mutations (policy leads should be able to link published items to versions they manage).

---

## Environment Availability

Step 2.6: SKIPPED — no external dependencies identified. Phase 26 is entirely code and SQL with no new CLI tools, services, runtimes, or package installs.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (already installed) |
| Config file | `vitest.config.mts` (exists, covers `src/**/*.test.ts` and `tests/**/*.test.ts`) |
| Quick run command | `npm test -- --reporter=verbose src/__tests__/research` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| RESEARCH-01 | Schema tables importable + link table composite PK | unit (schema import) | `npm test -- src/__tests__/research-schema.test.ts` | ❌ Wave 0 |
| RESEARCH-02 | readableId uniqueness under 20 concurrent creates | unit (mocked db.execute) | `npm test -- src/__tests__/research-router.test.ts` | ❌ Wave 0 |
| RESEARCH-03 | Permission matrix: all 7 grants + denials for all 7 new permissions | unit (pure `can()` calls) | `npm test -- src/__tests__/research-permissions.test.ts` | ❌ Wave 0 |
| RESEARCH-04 | Router procedure guards: FORBIDDEN on wrong role, NOT_FOUND on missing item | unit (mocked router) | `npm test -- src/__tests__/research-router.test.ts` | ❌ Wave 0 |
| RESEARCH-05 | State machine: valid transitions pass, invalid transitions throw BAD_REQUEST | unit (pure lifecycle functions) | `npm test -- src/__tests__/research-lifecycle.test.ts` | ❌ Wave 0 |
| RESEARCH-05 | workflowTransitions INSERT fires before status UPDATE (R6 order) | unit (call-order spy) | `npm test -- src/__tests__/research-service.test.ts` | ❌ Wave 0 |
| RESEARCH-01 | isAuthorAnonymous filter: listPublic nulls authors when flag true | unit (mocked query) | `npm test -- src/__tests__/research-router.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- src/__tests__/research`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + `npx tsc --noEmit` before `/gsd:verify-work`

### Wave 0 Gaps (all gaps — this is a greenfield router)

- [ ] `src/__tests__/research-permissions.test.ts` — covers RESEARCH-03 (7 permissions × 7 roles = 49 `can()` assertions)
- [ ] `src/__tests__/research-lifecycle.test.ts` — covers RESEARCH-05 state machine (valid + invalid transitions, retractionReason guard)
- [ ] `src/__tests__/research-service.test.ts` — covers RESEARCH-05 service layer (workflowTransitions insert order, reviewedBy population on approve)
- [ ] `src/__tests__/research-router.test.ts` — covers RESEARCH-02, RESEARCH-04 (readableId uniqueness, permission guards, anonymous author filter)

**Test pattern to follow:** `src/__tests__/feedback-permissions.test.ts` (no DB, no mocks — pure function calls on `can()` and `assertValidTransition()`). Mock DB via `vi.mock('@/src/db')` following Phase 16 vi.hoisted() pattern for router tests.

---

## Sources

### Primary (HIGH confidence — verified by direct file reads)

- `src/db/schema/feedback.ts` — exact table shape, `milestoneId` SQL-only FK comment pattern
- `src/db/schema/milestones.ts` — `ManifestEntry` type (lines 22–27), `RequiredSlots` type (lines 17–22)
- `src/db/schema/workshops.ts` — link table composite PK pattern, `milestoneId` SQL-only FK
- `src/db/schema/evidence.ts` — `feedbackEvidence` / `sectionEvidence` link table pattern
- `src/db/schema/changeRequests.ts` — `crFeedbackLinks` unique constraint pattern, `documentVersions` SQL-only FK comment (G8)
- `src/db/schema/workflow.ts` — `workflowTransitions` table shape: `entityType: text`, `entityId: uuid`, `fromState: text`, `toState: text`, `actorId: text`, `metadata: jsonb`
- `src/server/services/feedback.service.ts` — full transitionFeedback() including R6 insert-first invariant, R1 VALID_TRANSITIONS fallback table
- `src/server/routers/feedback.ts` — `nextval` readableId pattern (lines 40–43), `requirePermission` attachment, `writeAuditLog` fire-and-forget, `onConflictDoNothing` pattern
- `src/server/routers/milestone.ts` — `requirePermission` usage, helper function patterns
- `src/server/routers/_app.ts` — exact appRouter shape for registration
- `src/trpc/init.ts` — `requirePermission` implementation, `protectedProcedure`, `z.guid()` precedent
- `src/lib/permissions.ts` — full permission matrix format, `can()` function signature
- `src/lib/constants.ts` — `ACTIONS` object format (dot-separated verb strings), all existing action constants
- `src/lib/audit.ts` — `writeAuditLog` interface: `actorId, actorRole, action, entityType, entityId, payload`
- `src/db/migrations/0002_feedback_system.sql` — `feedback_id_seq` creation: `CREATE SEQUENCE feedback_id_seq START 1`
- `src/db/migrations/0014_milestones_hashing.sql` — full migration template: idempotent DDL, DO blocks, partial indexes, ON DELETE SET NULL
- `scripts/apply-migration-0014.mjs` — Neon HTTP runner template: DO-block-aware statement splitter, `sql.query(stmt)` form
- `src/__tests__/feedback-permissions.test.ts` — test structure: pure `can()` assertions, no DB mocking needed
- `src/__tests__/feedback-machine.test.ts` — state machine test structure
- `vitest.config.mts` — confirmed `src/**/*.test.ts` discovery, `tests/**/*.test.ts` coverage
- `src/server/routers/_app.ts` — confirmed no `research` router exists yet

### Secondary (MEDIUM confidence — from PLANNING docs authored 2026-04-19)

- `.planning/research/research-module/DOMAIN.md` — research_items core attributes, status machine diagram
- `.planning/research/research-module/INTEGRATION.md` — permission grants table (§8), ManifestEntry extension (§4)
- `.planning/research/research-module/QUESTIONS.md` — Q1–Q10 decisions (all locked in CONTEXT.md)

### Tertiary (LOW confidence — not needed, all replaced by primary sources)

None. All findings are grounded in direct codebase reads.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Schema shape | HIGH | Read actual schema files verbatim |
| Migration conventions | HIGH | Read 0014 SQL + runner script in full |
| Readable ID generation | HIGH | Read exact nextval lines from feedback router |
| State machine pattern | HIGH | Read feedback.service.ts in full + verified workshop precedent in STATE.md |
| tRPC router anatomy | HIGH | Read feedback.ts router in full |
| Permissions format | HIGH | Read permissions.ts in full |
| ACTIONS constants format | HIGH | Read constants.ts in full |
| ManifestEntry extension | HIGH | Read milestones.ts in full |
| Test patterns | HIGH | Read feedback-permissions.test.ts and feedback-machine.test.ts in full |

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (stable stack — no fast-moving dependencies)
