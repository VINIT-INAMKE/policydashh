# Phase 5: Change Requests - Research

**Researched:** 2026-03-25
**Domain:** Change Request lifecycle, XState 5 state machines, atomic merge with version creation, CR-feedback linking
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- XState 5 already installed and pattern established in Phase 4 (feedback machine)
- State transition table (workflow_transitions) exists from Phase 1
- transitionFeedback service pattern from Phase 4 — follow same pattern for CRs
- Human-readable IDs via PostgreSQL nextval() sequence (established in Phase 4 for FB-NNN)
- tRPC with requirePermission() for all procedures
- Audit logging via writeAuditLog() on all mutations

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CR-01 | Policy Lead can create a Change Request (CR-XXX) from one or more feedback items | `change_requests` table with `cr_id_seq` sequence; `cr_feedback_links` join table; `changeRequest.create` tRPC procedure under `feedback:review` permission |
| CR-02 | CR links to affected policy sections and source feedback items | `cr_section_links` join table (cr_id → section_id) and `cr_feedback_links` join table (cr_id → feedback_id); both populated at creation and editable in Drafting state |
| CR-03 | CR has an assigned owner (Policy Lead) and title/description | `owner_id`, `title`, `description` columns on `change_requests` table |
| CR-04 | CR lifecycle managed by state machine: Drafting → In Review → Approved → Merged → Closed | `changeRequestMachine` following `feedbackMachine` XState 5 pattern; status persisted as `cr_status` pgEnum |
| CR-05 | CR approval requires human sign-off (Policy Lead or Admin) | `APPROVE` event only available in `in_review` state; `feedback:review` permission (admin + policy_lead) enforces sign-off |
| CR-06 | Merging a CR atomically creates a new document version with merge summary | Single DB transaction: insert into `document_versions` + update CR status + bulk-update feedback; bridges to Phase 6 schema |
| CR-07 | All feedback items linked to a merged CR are automatically updated to reflect the version they influenced | Bulk UPDATE feedback WHERE id IN (select feedback_id from cr_feedback_links where cr_id = ?) SET resolved_in_version = ? inside the merge transaction |
| CR-08 | CR can be closed without merging (with rationale) | `CLOSE` event available in `drafting`, `in_review`, and `approved` states (pre-merge only); requires rationale field; recorded in workflowTransitions metadata |
</phase_requirements>

---

## Summary

Phase 5 introduces Change Requests as the governing layer between stakeholder feedback and policy document versions. A CR aggregates one or more feedback items, carries them through a PR-style approval process, and atomically converts into a new document version on merge. The phase follows the exact same engineering pattern as Phase 4 (feedback): schema + XState machine + service + tRPC router + tests, then UI.

The codebase is fully prepared for this phase. Phase 4 shipped the complete `transitionFeedback` service pattern (create actor from snapshot, send event, detect no-op, update row, log to workflowTransitions). Phase 5 replicates this verbatim as `transitionCR`. The only new complexity is the **atomic merge operation** (CR-06/CR-07): a PostgreSQL transaction that simultaneously inserts a `document_versions` row, updates the CR status to `merged`, and bulk-updates every linked feedback row with `resolved_in_version`. This is a multi-table transaction but straightforward with Drizzle's `db.transaction()`.

The `document_versions` table does not exist yet — Phase 6 owns versioning fully. Phase 5 must create a **minimal version stub schema** sufficient to record the CR merge (document_id, version string, merge summary, created_by, created_at). Phase 6 will extend this table with diff data, changelog, and publish controls. This forward-compatible approach avoids cross-phase coupling while satisfying CR-06.

**Primary recommendation:** Build in three waves: (1) CR schema + machine + service + router + tests (back-end complete), (2) CR creation UI + management views (Policy Lead workflow), (3) CR detail panel + feedback linkage display (traceability UI). All three waves together satisfy all 8 CR requirements.

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md contains `@AGENTS.md`: "This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices."

**Directive enforcement for Phase 5:**
- Before writing any Next.js App Router page or layout, read `node_modules/next/dist/docs/` for the applicable pattern
- Do not assume standard Next.js 14/15 route conventions — verify against the installed Next.js 16.2.1 docs
- Phase 5 adds new pages under `app/(workspace)/changes/` — verify route group and layout conventions

---

## Standard Stack

No new packages required. Everything Phase 5 needs is already installed from Phases 1–4:

| Library | Purpose | Already Present |
|---------|---------|-----------------|
| `xstate` | CR state machine (`changeRequestMachine`) | Yes — Phase 4 |
| `@xstate/react` | React bindings for machine state | Yes — Phase 4 |
| `drizzle-orm` | Schema + queries + transactions | Yes — Phase 1 |
| `@trpc/server` / tRPC v11 | Typed API router | Yes — Phase 1 |
| `zod` | Input validation | Yes — Phase 1 |
| `@clerk/nextjs` | Auth context for `ctx.user` | Yes — Phase 1 |
| `lucide-react` | Icons in CR status badges | Yes |
| shadcn/ui components | Badge, Dialog, Table, Select, Tabs | Installed in prior phases |

**New shadcn components needed for Phase 5 UI:**

| Component | Purpose |
|-----------|---------|
| `command` | Multi-select feedback items when creating a CR |
| `popover` | Wrapper for the multi-select Command popover |

Install: `npx shadcn@latest add command popover` (if not already present — check `components/ui/command.tsx`)

Note: `components/ui/command.tsx` and `components/ui/popover.tsx` already appear in git status as untracked, meaning they were generated but not committed in Phase 4. They are available.

---

## Architecture Patterns

### Existing Pattern: Phase 4 transitionFeedback Service (Replicate Exactly)

The `transitionCR` service in `src/server/services/changeRequest.service.ts` must follow the identical 11-step pattern from `src/server/services/feedback.service.ts`:

```typescript
// Source: src/server/services/feedback.service.ts (Phase 4)
export async function transitionFeedback(feedbackId, event, actorId) {
  // 1. Fetch row
  // 2. Restore actor from xstate_snapshot (or fresh start)
  // 3. Capture previousState
  // 4. Send event
  // 5. Capture newSnapshot / newState
  // 6. Detect no-op (state unchanged = invalid transition → TRPCError BAD_REQUEST)
  // 7. Build updateData
  // 8. db.update() the entity row
  // 9. db.insert() workflowTransitions
  // 10. actor.stop()
  // 11. return updated row
}
```

The only differences for `transitionCR`:
- Fetches from `changeRequests` table instead of `feedbackItems`
- Uses `changeRequestMachine` instead of `feedbackMachine`
- The `MERGE` event triggers the atomic merge operation (see below) instead of a simple field update
- The `CLOSE` event stores `closureRationale` from the event payload

### Existing Pattern: Human-Readable ID via PostgreSQL Sequence

Reuse the same `nextval()` approach from feedback submission:

```typescript
// Source: src/server/routers/feedback.ts — submit procedure
const [seqResult] = await db.execute(sql`SELECT nextval('feedback_id_seq') AS seq`)
const num = Number((seqResult as Record<string, unknown>).seq)
const readableId = `FB-${String(num).padStart(3, '0')}`
```

For CRs:
```typescript
// In migration: CREATE SEQUENCE cr_id_seq START 1;
// In create procedure:
const [seqResult] = await db.execute(sql`SELECT nextval('cr_id_seq') AS seq`)
const num = Number((seqResult as Record<string, unknown>).seq)
const readableId = `CR-${String(num).padStart(3, '0')}`
```

### New Pattern: XState 5 CR Machine

The CR lifecycle has 5 states (vs feedback's 6), one additional guard (`hasMergedVersion`), and an important constraint: `CLOSE` must be available from `drafting`, `in_review`, AND `approved` — but NOT from `merged`. `merged` and `closed` are both terminal.

```typescript
// Source: Pattern derived from src/server/machines/feedback.machine.ts
import { setup, assign } from 'xstate'

export type CRStatus = 'drafting' | 'in_review' | 'approved' | 'merged' | 'closed'

export type CREvent =
  | { type: 'SUBMIT_FOR_REVIEW' }
  | { type: 'APPROVE'; approverId: string }
  | { type: 'REQUEST_CHANGES' }           // Approved → back to In Review
  | { type: 'MERGE'; mergedVersionId: string; mergedBy: string }
  | { type: 'CLOSE'; rationale: string }

export const changeRequestMachine = setup({
  types: {
    context: {} as {
      crId: string
      ownerId: string
      approverId: string | null
      mergedVersionId: string | null
      closureRationale: string | null
    },
    input: {} as { crId: string; ownerId: string },
    events: {} as CREvent,
  },
  guards: {
    hasRationale: ({ event }) =>
      'rationale' in event && (event as { rationale: string }).rationale.trim().length > 0,
  },
  actions: {
    setApprover: assign(({ event }) => ({
      approverId: 'approverId' in event ? (event as { approverId: string }).approverId : null,
    })),
    setMergedVersion: assign(({ event }) => ({
      mergedVersionId: 'mergedVersionId' in event
        ? (event as { mergedVersionId: string }).mergedVersionId
        : null,
    })),
    setClosure: assign(({ event }) => ({
      closureRationale: 'rationale' in event ? (event as { rationale: string }).rationale : null,
    })),
  },
}).createMachine({
  id: 'changeRequest',
  initial: 'drafting',
  context: ({ input }) => ({
    crId: input.crId,
    ownerId: input.ownerId,
    approverId: null,
    mergedVersionId: null,
    closureRationale: null,
  }),
  states: {
    drafting:   {
      on: {
        SUBMIT_FOR_REVIEW: 'in_review',
        CLOSE: { target: 'closed', guard: 'hasRationale', actions: 'setClosure' },
      },
    },
    in_review:  {
      on: {
        APPROVE:          { target: 'approved', actions: 'setApprover' },
        CLOSE:            { target: 'closed', guard: 'hasRationale', actions: 'setClosure' },
      },
    },
    approved:   {
      on: {
        MERGE:            { target: 'merged', actions: 'setMergedVersion' },
        REQUEST_CHANGES:  'in_review',
        CLOSE:            { target: 'closed', guard: 'hasRationale', actions: 'setClosure' },
      },
    },
    merged:     { type: 'final' },
    closed:     { type: 'final' },
  },
})
```

### New Pattern: Atomic CR Merge Transaction (CR-06 + CR-07)

The merge is the most complex operation in this phase. It must be a single PostgreSQL transaction:

```typescript
// Pattern: Drizzle db.transaction() for atomic merge
// Source: Drizzle ORM transaction docs + Phase 4 codebase conventions

async function mergeCR(crId: string, mergeSummary: string, actorId: string) {
  return await db.transaction(async (tx) => {
    // 1. Fetch the CR to get documentId
    const [cr] = await tx.select().from(changeRequests).where(eq(changeRequests.id, crId))
    if (!cr || cr.status !== 'approved') throw new TRPCError({ code: 'BAD_REQUEST' })

    // 2. Generate version string (Phase 6 will add semver logic; here use timestamp-based stub)
    // Phase 5 creates a minimal document_versions row — Phase 6 extends the table
    const [version] = await tx.insert(documentVersions).values({
      documentId: cr.documentId,
      versionLabel: await getNextVersionLabel(tx, cr.documentId), // e.g. 'v0.1', 'v0.2'
      mergeSummary,
      createdBy: actorId,
      crId,           // back-reference for traceability
    }).returning()

    // 3. Update CR status to merged
    await tx.update(changeRequests)
      .set({ status: 'merged', mergedVersionId: version.id, mergedBy: actorId, mergedAt: new Date() })
      .where(eq(changeRequests.id, crId))

    // 4. Bulk-update linked feedback items (CR-07)
    const linkedFeedback = await tx
      .select({ feedbackId: crFeedbackLinks.feedbackId })
      .from(crFeedbackLinks)
      .where(eq(crFeedbackLinks.crId, crId))

    if (linkedFeedback.length > 0) {
      const feedbackIds = linkedFeedback.map(r => r.feedbackId)
      await tx.update(feedbackItems)
        .set({ resolvedInVersionId: version.id })
        .where(inArray(feedbackItems.id, feedbackIds))
    }

    return version
  })
}
```

**Note on `resolvedInVersionId` column:** This field needs to be added to the `feedback` table in the Phase 5 migration. It is a nullable FK to `document_versions.id`. Phase 4 did not include it because Phase 5 defines the concept of "version that resolved this feedback."

### New Pattern: Minimal document_versions Schema Stub

Phase 5 creates a minimal `document_versions` table. Phase 6 will add diff/changelog/publish columns via a new migration without modifying the table destructively.

```typescript
// src/db/schema/changeRequests.ts (includes versions stub)
export const documentVersions = pgTable('document_versions', {
  id:           uuid('id').primaryKey().defaultRandom(),
  documentId:   uuid('document_id').notNull().references(() => policyDocuments.id),
  versionLabel: text('version_label').notNull(),   // 'v0.1', 'v0.2', etc.
  mergeSummary: text('merge_summary'),
  createdBy:    uuid('created_by').notNull().references(() => users.id),
  crId:         uuid('cr_id').references(() => changeRequests.id),  // nullable (manual versions in Phase 6)
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

**Version labeling logic:** Simple sequential minor version per document. Query `MAX(version_label)` for the document, parse the minor number, increment. E.g. `v0.1 → v0.2 → v0.3`. No semver complexity in Phase 5 — Phase 6 adds major version bumps and publish gating.

### Existing Pattern: requirePermission + writeAuditLog

All CR mutations follow the established Phase 4 pattern:

```typescript
// Source: src/server/routers/feedback.ts
create: requirePermission('cr:create')
  .input(z.object({ ... }))
  .mutation(async ({ ctx, input }) => {
    // ... operation ...
    await writeAuditLog({
      actorId: ctx.user.id,
      actorRole: ctx.user.role,
      action: ACTIONS.CR_CREATE,
      entityType: 'change_request',
      entityId: cr.id,
      payload: { readableId, feedbackIds: input.feedbackIds },
    })
    return { id: cr.id, readableId }
  }),
```

**New permissions to add to `src/lib/permissions.ts`:**
```typescript
'cr:create':         [ROLES.ADMIN, ROLES.POLICY_LEAD],
'cr:read':           [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.AUDITOR],
'cr:manage':         [ROLES.ADMIN, ROLES.POLICY_LEAD],  // edit/transition/merge/close
```

**New ACTIONS to add to `src/lib/constants.ts`:**
```typescript
CR_CREATE:          'cr.create',
CR_UPDATE:          'cr.update',
CR_SUBMIT_REVIEW:   'cr.submit_for_review',
CR_APPROVE:         'cr.approve',
CR_REQUEST_CHANGES: 'cr.request_changes',
CR_MERGE:           'cr.merge',
CR_CLOSE:           'cr.close',
```

### Recommended Project Structure for Phase 5

New files to create (following Phase 4 parallel structure):

```
src/db/schema/changeRequests.ts       # CR table, join tables, document_versions stub
src/db/schema/index.ts                # Add changeRequests export
src/db/migrations/0003_change_requests.sql

src/server/machines/changeRequest.machine.ts
src/server/services/changeRequest.service.ts    # transitionCR + mergeCR
src/server/routers/changeRequest.ts
src/server/routers/_app.ts            # Add changeRequest router

src/__tests__/cr-machine.test.ts
src/__tests__/cr-service.test.ts      # integration (optional, mock db)

app/(workspace)/changes/page.tsx      # CR list page
app/(workspace)/changes/[id]/page.tsx # CR detail page
components/change-requests/           # CR UI components
```

### Anti-Patterns to Avoid

- **Do not use `db.update()` outside a transaction for the merge** — the CR status update and feedback bulk-update must be atomic. If feedback update fails after CR status update, the system is in an inconsistent state.
- **Do not store the full XState snapshot context as the source of truth** — the DB column (`status`, `mergedVersionId`, etc.) is the authoritative state. The `xstate_snapshot` column is for actor restoration only.
- **Do not skip the no-op check in transitionCR** — the pattern `if (newState === previousState) throw BAD_REQUEST` prevents silent failures when an invalid event is sent (XState ignores unhandled events rather than throwing).
- **Do not allow MERGE from `in_review`** — must be `approved` first. The machine enforces this but document it explicitly in tests.
- **Do not create a separate sequence for each document** — `cr_id_seq` is global, producing globally unique CR-001, CR-002 etc., same as `feedback_id_seq`. This is intentional for human readability.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| State machine validation | Custom if/else status checks | XState 5 machine — replicates `feedbackMachine` pattern |
| Transaction atomicity | Manual rollback logic | `db.transaction(async (tx) => { ... })` — Drizzle built-in |
| Permission enforcement | Ad-hoc role checks in router | `requirePermission('cr:create')` middleware from `src/trpc/init.ts` |
| Transition logging | Custom log table | Existing `workflowTransitions` table + established INSERT pattern |
| Audit trail | Manual log writes | `writeAuditLog()` from `src/lib/audit.ts` |
| Human-readable IDs | UUID or random string | `nextval('cr_id_seq')` with `CR-NNN` format (mirrors FB-NNN) |

**Key insight:** Phase 4 solved the hard architectural problems. Phase 5 is a replication exercise with one novel piece (the merge transaction). Resist the temptation to design new patterns when the existing ones fit.

---

## Common Pitfalls

### Pitfall 1: Forgetting `resolved_in_version_id` Column on feedback Table

**What goes wrong:** Phase 5 migration creates `document_versions` and links CRs to it, but never adds the FK column to the `feedback` table. CR-07 requires bulk-updating feedback with the version ID. This breaks silently if the column doesn't exist — Drizzle will error at runtime.

**Why it happens:** The feedback schema was defined in Phase 4. Adding a column in Phase 5 requires a new migration (not modifying the existing Phase 4 migration).

**How to avoid:** Phase 5 migration must include `ALTER TABLE feedback ADD COLUMN resolved_in_version_id UUID REFERENCES document_versions(id)`. Add corresponding column to `src/db/schema/feedback.ts` too.

**Warning signs:** `inArray` update in `mergeCR` silently succeeds but `SELECT resolved_in_version_id FROM feedback` returns NULL for all rows.

### Pitfall 2: XState Snapshot Restoration Without Context Input

**What goes wrong:** `createActor(changeRequestMachine, { snapshot: row.xstateSnapshot })` fails or produces wrong initial context because `input` is not provided alongside the snapshot.

**Why it happens:** XState 5 `setup()` machines with `input` type require the `input` to be provided when creating a fresh actor. Snapshot restoration bypasses the context initializer — but passing both `snapshot` and `input` together causes type issues.

**How to avoid:** Follow the exact pattern from `feedback.service.ts` lines 35-43:
```typescript
const actorOptions = {
  input: { crId: row.id, ownerId: row.ownerId },
  ...(row.xstateSnapshot ? { snapshot: row.xstateSnapshot as any } : {}),
}
const actor = createActor(changeRequestMachine, actorOptions as any)
```
The `as any` cast on both sides is intentional — TypeScript cannot reconcile the conditional `snapshot` type without it. This is the established codebase pattern.

### Pitfall 3: Merged/Closed CR Status Mutation Attempts

**What goes wrong:** A Policy Lead tries to call `transitionCR` on a merged or closed CR. The XState actor is in a `final` state. `actor.send(event)` is a no-op. The no-op check (`if (newState === previousState)`) catches this and throws `BAD_REQUEST`. But the error message "Invalid transition" is confusing — it should say "CR is already finalized."

**How to avoid:** Before creating the actor, check `row.status` and throw a specific error:
```typescript
if (row.status === 'merged' || row.status === 'closed') {
  throw new TRPCError({ code: 'BAD_REQUEST', message: `CR ${row.readableId} is already ${row.status}` })
}
```

### Pitfall 4: Version Label Collision Under Concurrent Merges

**What goes wrong:** Two CRs for the same document are merged concurrently. Both read `MAX(version_label) = 'v0.2'` and both try to insert `v0.3`. PostgreSQL unique constraint on `(document_id, version_label)` catches this — but Drizzle will throw an uncaught unique violation error.

**How to avoid:** Add `unique()` constraint on `(documentId, versionLabel)` in the Drizzle schema. Wrap the merge transaction in a try/catch and retry once (optimistic concurrency). For Phase 5, retry-on-conflict is sufficient since concurrent merges are an edge case.

**Warning signs:** `duplicate key value violates unique constraint "document_versions_document_id_version_label_unique"` in server logs.

### Pitfall 5: CR-02 Link Tables Missing Section Records

**What goes wrong:** A Policy Lead creates a CR from feedback items on Section A, but the CR-to-section link is inferred from the feedback items rather than explicitly stored. If later, more sections are added to the CR scope, there's no explicit `cr_section_links` row.

**How to avoid:** Always create explicit `cr_section_links` rows. At creation, auto-populate from the unique `section_id` values of the linked feedback items. The UI should allow adding/removing section links while the CR is in `drafting` state.

---

## Code Examples

### CR Schema (Drizzle)

```typescript
// Source: Pattern from src/db/schema/feedback.ts
import { pgTable, uuid, text, timestamp, jsonb, pgEnum, unique } from 'drizzle-orm/pg-core'
import { users } from './users'
import { policyDocuments } from './documents'

export const crStatusEnum = pgEnum('cr_status', [
  'drafting', 'in_review', 'approved', 'merged', 'closed',
])

export const changeRequests = pgTable('change_requests', {
  id:               uuid('id').primaryKey().defaultRandom(),
  readableId:       text('readable_id').notNull().unique(),
  documentId:       uuid('document_id').notNull().references(() => policyDocuments.id),
  ownerId:          uuid('owner_id').notNull().references(() => users.id),
  title:            text('title').notNull(),
  description:      text('description'),
  status:           crStatusEnum('status').notNull().default('drafting'),
  approverId:       uuid('approver_id').references(() => users.id),
  approvedAt:       timestamp('approved_at', { withTimezone: true }),
  mergedBy:         uuid('merged_by').references(() => users.id),
  mergedAt:         timestamp('merged_at', { withTimezone: true }),
  mergedVersionId:  uuid('merged_version_id'),  // FK added after documentVersions table defined
  closureRationale: text('closure_rationale'),
  xstateSnapshot:   jsonb('xstate_snapshot').$type<Record<string, unknown> | null>(),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Join tables
export const crFeedbackLinks = pgTable('cr_feedback_links', {
  crId:       uuid('cr_id').notNull().references(() => changeRequests.id, { onDelete: 'cascade' }),
  feedbackId: uuid('feedback_id').notNull().references(() => feedbackItems.id),
}, (t) => [unique().on(t.crId, t.feedbackId)])

export const crSectionLinks = pgTable('cr_section_links', {
  crId:      uuid('cr_id').notNull().references(() => changeRequests.id, { onDelete: 'cascade' }),
  sectionId: uuid('section_id').notNull().references(() => policySections.id),
}, (t) => [unique().on(t.crId, t.sectionId)])

export const documentVersions = pgTable('document_versions', {
  id:           uuid('id').primaryKey().defaultRandom(),
  documentId:   uuid('document_id').notNull().references(() => policyDocuments.id),
  versionLabel: text('version_label').notNull(),
  mergeSummary: text('merge_summary'),
  createdBy:    uuid('created_by').notNull().references(() => users.id),
  crId:         uuid('cr_id').references(() => changeRequests.id),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.documentId, t.versionLabel)])
```

### tRPC Router Structure for CRs

```typescript
// Source: Pattern from src/server/routers/feedback.ts
export const changeRequestRouter = router({
  create:           requirePermission('cr:create').input(...).mutation(...),
  list:             requirePermission('cr:read').input(...).query(...),
  getById:          requirePermission('cr:read').input(...).query(...),
  update:           requirePermission('cr:manage').input(...).mutation(...),  // edit title/desc while drafting
  addFeedback:      requirePermission('cr:manage').input(...).mutation(...),
  removeFeedback:   requirePermission('cr:manage').input(...).mutation(...),
  submitForReview:  requirePermission('cr:manage').input(...).mutation(...),
  approve:          requirePermission('cr:manage').input(...).mutation(...),
  requestChanges:   requirePermission('cr:manage').input(...).mutation(...),
  merge:            requirePermission('cr:manage').input(...).mutation(...),  // calls mergeCR()
  close:            requirePermission('cr:manage').input(...).mutation(...),  // requires rationale
  listTransitions:  requirePermission('cr:read').input(...).query(...),       // decision log
})
```

### Test Structure (mirrors feedback-machine.test.ts)

```typescript
// Source: Pattern from src/server/machines/feedback.machine.ts test
describe('CR State Machine', () => {
  function createCRActor() {
    return createActor(changeRequestMachine, {
      input: { crId: 'test-cr-001', ownerId: 'user-001' },
    }).start()
  }

  it('starts in drafting state', ...)
  it('transitions drafting → in_review on SUBMIT_FOR_REVIEW', ...)
  it('transitions in_review → approved on APPROVE', ...)
  it('transitions approved → merged on MERGE', ...)
  it('blocks MERGE from in_review (must be approved first)', ...)
  it('allows CLOSE from drafting with rationale', ...)
  it('allows CLOSE from in_review with rationale', ...)
  it('allows CLOSE from approved with rationale', ...)
  it('blocks CLOSE without rationale', ...)
  it('merged is a final state — no further transitions', ...)
  it('closed is a final state — no further transitions', ...)
  it('REQUEST_CHANGES returns approved → in_review', ...)
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual status if/else in services | XState 5 `setup().createMachine()` with guards | Phase 4 established | State machine rejects invalid transitions at machine level, not application level |
| Separate migration per table | One migration per phase bundling all tables | Phase 1 decision | Phase 5 migration bundles: `change_requests`, `cr_feedback_links`, `cr_section_links`, `document_versions`, plus `ALTER TABLE feedback ADD COLUMN resolved_in_version_id` |
| Ad-hoc version numbering | Sequential `v0.N` labels from query | Phase 5 establishes | Phase 6 can extend to semver without breaking the label column format |

---

## Open Questions

1. **Should `CLOSE` be allowed from `approved` state?**
   - What we know: The requirement (CR-08) says "CR can be closed without merging" — approved CRs haven't merged yet, so closure should be allowed.
   - What's unclear: Is there a business reason to force merged/close once approved?
   - Recommendation: Allow CLOSE from `approved`. Policy Leads may approve, then discover a conflict and want to close rather than merge. This is low risk.

2. **Initial `versionLabel` for a document's first merge**
   - What we know: No versioning logic exists yet. Phase 6 owns semver.
   - What's unclear: What should the first merged CR produce? `v0.1`? `v1.0`?
   - Recommendation: Default to `v0.1` for the first merge, then `v0.2`, `v0.3`, etc. Store as simple text — Phase 6 can implement semver parsing on top of this column without altering existing data.

3. **CR edit restrictions after status change**
   - What we know: Title/description edits while `drafting` are clearly fine. Editing while `in_review` or later is ambiguous.
   - Recommendation: Allow title/description edits only in `drafting` state. Check `cr.status === 'drafting'` in the `update` tRPC procedure and throw `BAD_REQUEST` otherwise.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 5 is purely code/schema changes. All external dependencies (PostgreSQL/Neon, Clerk) are already established and confirmed operational from Phases 1–4.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + jsdom |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run src/__tests__/cr-machine.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CR-04 | CR state machine enforces valid transitions | unit | `npx vitest run src/__tests__/cr-machine.test.ts` | ❌ Wave 1 |
| CR-04 | MERGE blocked from non-approved states | unit | `npx vitest run src/__tests__/cr-machine.test.ts` | ❌ Wave 1 |
| CR-04 | CLOSE requires rationale guard | unit | `npx vitest run src/__tests__/cr-machine.test.ts` | ❌ Wave 1 |
| CR-05 | Only policy_lead/admin can approve | unit | `npx vitest run src/__tests__/cr-permissions.test.ts` | ❌ Wave 1 |
| CR-06 | Atomic merge creates document_versions row | unit (mock db) | `npx vitest run src/__tests__/cr-merge.test.ts` | ❌ Wave 1 |
| CR-07 | Linked feedback gets resolved_in_version_id set | unit (mock db) | `npx vitest run src/__tests__/cr-merge.test.ts` | ❌ Wave 1 |
| CR-08 | CLOSE from drafting/in_review/approved with rationale | unit | `npx vitest run src/__tests__/cr-machine.test.ts` | ❌ Wave 1 |
| CR-01 | CR creation produces CR-NNN readableId | smoke (manual) | Manual verify via Drizzle Studio | — |
| CR-02 | cr_section_links + cr_feedback_links rows exist | smoke (manual) | Manual verify via Drizzle Studio | — |
| CR-03 | CR has owner, title, description | smoke (manual) | Covered by create procedure Zod validation | — |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/cr-machine.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/cr-machine.test.ts` — covers CR-04, CR-05, CR-08
- [ ] `src/__tests__/cr-permissions.test.ts` — covers permission matrix additions
- [ ] `src/__tests__/cr-merge.test.ts` — covers CR-06, CR-07 (mock Drizzle tx)

*(Framework already installed — vitest.config.mts exists, no setup needed)*

---

## Sources

### Primary (HIGH confidence)
- `src/server/machines/feedback.machine.ts` — XState 5 `setup().createMachine()` pattern; exact code to replicate
- `src/server/services/feedback.service.ts` — 11-step `transitionFeedback` pattern; `transitionCR` replicates this
- `src/server/routers/feedback.ts` — tRPC router structure, `requirePermission`, `writeAuditLog`, sequence ID generation
- `src/db/schema/feedback.ts` — Drizzle schema conventions (pgEnum, uuid pk, nullable FK, xstateSnapshot jsonb)
- `src/db/schema/workflow.ts` — `workflowTransitions` table structure used by all lifecycle services
- `src/db/migrations/0002_feedback_system.sql` — Migration pattern for sequences, enums, tables
- `src/trpc/init.ts` — `requirePermission()` middleware definition
- `src/lib/permissions.ts` — PERMISSIONS matrix extension pattern (`as readonly Role[]`)
- `src/lib/constants.ts` — ACTIONS constant pattern for audit log action strings
- `src/lib/audit.ts` — `writeAuditLog()` interface
- `vitest.config.mts` — Test framework config; `src/**/*.test.ts` glob pattern

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` — Drizzle `db.transaction()` for atomic operations; XState 5 actor model
- `.planning/research/ARCHITECTURE.md` — Pattern 3 (State Machine Per Lifecycle) describes the `transitionX` service pattern
- `.planning/phases/04-feedback-system/04-RESEARCH.md` — Phase 4 research confirming all patterns this phase inherits

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All packages already installed and in use; no new dependencies
- Architecture: HIGH — Exact patterns from Phase 4 codebase; verified from source files
- Pitfalls: HIGH — Derived from actual code inspection (actor snapshot pattern, xstateSnapshot as any, no-op check)
- Merge transaction: HIGH — Drizzle `db.transaction()` pattern is well-established; version label logic is simple

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable patterns; no fast-moving dependencies)
