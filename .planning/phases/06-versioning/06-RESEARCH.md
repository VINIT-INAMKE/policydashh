# Phase 6: Versioning - Research

**Researched:** 2026-03-25
**Domain:** Document version management, section-level diff, immutable publish, auto-changelog
**Confidence:** HIGH

## Summary

Phase 6 extends the `document_versions` stub table created in Phase 5 into a full versioning system. The stub already stores `id`, `documentId`, `versionLabel`, `mergeSummary`, `createdBy`, `crId`, and `createdAt`. Phase 6 adds `sectionsSnapshot` (JSONB — full copy of all section content at creation time), `changelog` (JSONB array — structured entries derived from linked CRs and feedback), `publishedAt`, and `isPublished`. The migration must use `ALTER TABLE` rather than a new table.

Section-level diffs compare stored snapshots between two version rows — never live `policy_sections` content. This is critical: once a version is created, its snapshot is the ground truth for diff purposes. The `diff` package is already present in `node_modules` as a transitive dependency. The `react-diff-viewer-continued` package is NOT installed and must be added, OR an inline diff renderer can be built using `diff`'s output directly (recommended to avoid a dependency for a single view).

Published versions are immutable: once `isPublished = true`, the `mergeCR` service and a new `publishVersion` mutation must guard against re-publishing or post-publish edits at the API layer. VER-02 requires manual version creation (not just CR-triggered). The `mergeCR` function currently creates versions atomically — it must be extended to also capture the section snapshot at merge time.

**Primary recommendation:** Extend `document_versions` via `ALTER TABLE` migration; snapshot all sections at version-creation time inside the existing `mergeCR` transaction; build a lightweight inline diff renderer using the already-installed `diff` package rather than adding `react-diff-viewer-continued`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- document_versions STUB table already exists from Phase 5 (CR merge creates versions)
- Phase 5 mergeCR already creates version records with documentId, versionLabel, mergeSummary, crId
- Need to EXTEND document_versions with: sectionsSnapshot (JSONB), changelog, publishedAt, isPublished
- Section-level diffs should compare stored snapshots, not live content
- Published versions must be immutable (no edits allowed after publish)

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VER-01 | Policy documents use semantic versioning (v0.1, v0.2, etc.) | Already implemented in `getNextVersionLabel`; no new logic needed for labeling — just preserve and surface it in the UI |
| VER-02 | New version is created when a CR is merged OR manually by Admin/Policy Lead | mergeCR handles CR-triggered path; need new `version.createManual` tRPC mutation that snapshots current sections |
| VER-03 | Auto-generated changelog for each version: what changed, why, linked feedback IDs | `changelog` JSONB column on `document_versions`; populated at creation time from CR's linked feedback items and their decision rationales |
| VER-04 | Section-level diff view comparing any two versions of a document | `diff` package already installed; compare `sectionsSnapshot` entries between two version rows by `sectionId`; render inline diff in UI |
| VER-05 | Previous versions are archived and accessible as read-only | `version.list` query returns all versions; version detail page renders read-only snapshot content (no editor) |
| VER-06 | Admin/Policy Lead can publish a version, making it visible on the public portal | `version.publish` mutation sets `publishedAt` and `isPublished = true` with permission guard `version:publish` |
| VER-07 | Version snapshots are immutable once published | Guard in `version.publish` (idempotent) and block any future mutation on published versions at service layer |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 | Schema extension + queries | Already in use; `ALTER TABLE` migration pattern established in Phase 5 |
| diff | 8.0.4 | Text diff algorithm | Already in `node_modules` (transitive); `diffWords`/`diffLines` for section content comparison |
| zod | 4.3.6 | Input validation | Already in use for all tRPC input schemas |
| date-fns | 4.1.0 | Timestamp formatting | Already in use |

### To Install
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-diff-viewer-continued | 4.2.0 (latest) | Side-by-side/unified diff UI | Only if inline renderer proves too complex; prefer building inline with `diff` output first |

**Recommendation:** Do NOT add `react-diff-viewer-continued`. The `diff` package is already available. Build a lightweight `<SectionDiffView>` component that maps `diffWords()` output to `<mark>` / `<del>` spans. This avoids a new dependency for a single use case and gives full style control consistent with the existing Tailwind/shadcn system.

**Installation (only if inline approach is rejected):**
```bash
npm install react-diff-viewer-continued
```

**Version verification (confirmed 2026-03-25):**
- `diff`: 8.0.4 — already in node_modules
- `react-diff-viewer-continued`: 4.2.0 — latest on npm, NOT installed

## Architecture Patterns

### Recommended Project Structure

New files for Phase 6 follow the existing convention exactly:

```
src/
├── db/
│   ├── schema/
│   │   └── changeRequests.ts         # Extend documentVersions table definition
│   └── migrations/
│       └── 0004_versioning.sql       # ALTER TABLE + new indexes
├── server/
│   ├── services/
│   │   └── version.service.ts        # snapshotSections(), buildChangelog(), publishVersion()
│   └── routers/
│       └── version.ts                # version tRPC router
app/
└── (workspace)/
    └── policies/
        └── [id]/
            └── versions/
                ├── page.tsx                          # Version history list
                ├── [versionId]/
                │   ├── page.tsx                      # Version detail (read-only)
                │   └── _components/
                │       ├── version-snapshot-view.tsx # Read-only section content
                │       └── version-changelog.tsx     # Structured changelog display
                └── _components/
                    ├── version-list.tsx              # List with publish badge
                    ├── version-card.tsx              # Single version row
                    ├── version-diff-view.tsx         # Two-version section diff
                    ├── publish-dialog.tsx            # Confirm + publish
                    └── create-version-dialog.tsx     # Manual version creation
```

### Pattern 1: Extend document_versions via ALTER TABLE

Phase 5 migration created the stub. Phase 6 migration extends it — never recreate:

```sql
-- 0004_versioning.sql
ALTER TABLE document_versions
  ADD COLUMN sections_snapshot JSONB,
  ADD COLUMN changelog         JSONB,
  ADD COLUMN published_at      TIMESTAMPTZ,
  ADD COLUMN is_published      BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing stub rows: snapshot and changelog can be null for historical rows
-- No data migration needed; existing rows remain valid with NULL snapshots

CREATE INDEX idx_document_versions_document ON document_versions(document_id);
CREATE INDEX idx_document_versions_published ON document_versions(is_published) WHERE is_published = true;
```

The Drizzle schema update mirrors this:

```typescript
// src/db/schema/changeRequests.ts — extend documentVersions
export const documentVersions = pgTable('document_versions', {
  id:               uuid('id').primaryKey().defaultRandom(),
  documentId:       uuid('document_id').notNull().references(() => policyDocuments.id),
  versionLabel:     text('version_label').notNull(),
  mergeSummary:     text('merge_summary'),
  createdBy:        uuid('created_by').notNull().references(() => users.id),
  crId:             uuid('cr_id'),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // Phase 6 additions:
  sectionsSnapshot: jsonb('sections_snapshot').$type<SectionSnapshot[] | null>(),
  changelog:        jsonb('changelog').$type<ChangelogEntry[] | null>(),
  publishedAt:      timestamp('published_at', { withTimezone: true }),
  isPublished:      boolean('is_published').notNull().default(false),
}, (t) => [
  unique('uq_document_version').on(t.documentId, t.versionLabel),
])
```

### Pattern 2: Section Snapshot Shape

The snapshot stores all sections at version creation time. Each entry carries the section's stable UUID (DOC-02: UUIDs persist across versions), title, orderIndex, and content:

```typescript
// src/server/services/version.service.ts
export interface SectionSnapshot {
  sectionId:  string       // stable UUID — joins across versions
  title:      string
  orderIndex: number
  content:    Record<string, unknown>  // Tiptap JSON (same type as policySections.content)
}

export interface ChangelogEntry {
  crId:       string
  crReadableId: string
  crTitle:    string
  summary:    string
  feedbackIds: string[]  // readable IDs e.g. ["FB-001", "FB-003"]
  affectedSectionIds: string[]
}
```

### Pattern 3: Snapshot Capture Inside mergeCR Transaction

The existing `mergeCR` in `changeRequest.service.ts` uses `db.transaction`. The snapshot must be captured inside the same transaction so it is consistent with the version row:

```typescript
// Extend step 3 inside mergeCR (src/server/services/changeRequest.service.ts)
const sections = await tx
  .select({
    id: policySections.id,
    title: policySections.title,
    orderIndex: policySections.orderIndex,
    content: policySections.content,
  })
  .from(policySections)
  .where(eq(policySections.documentId, cr.documentId))
  .orderBy(asc(policySections.orderIndex))

const sectionsSnapshot: SectionSnapshot[] = sections.map((s) => ({
  sectionId:  s.id,
  title:      s.title,
  orderIndex: s.orderIndex,
  content:    s.content,
}))

const changelog: ChangelogEntry[] = await buildChangelog(tx as unknown as typeof db, crId, cr)

const [version] = await tx
  .insert(documentVersions)
  .values({
    documentId:       cr.documentId,
    versionLabel,
    mergeSummary,
    createdBy:        actorId,
    crId,
    sectionsSnapshot, // NEW
    changelog,        // NEW
  })
  .returning()
```

### Pattern 4: Manual Version Creation

VER-02 requires a path not triggered by CR merge. The `version.createManual` mutation:
- Requires permission `version:manage` (new permission: `[ROLES.ADMIN, ROLES.POLICY_LEAD]`)
- Calls a shared `snapshotDocument(documentId, actorId, summary)` helper
- Generates the next version label via the existing `getNextVersionLabel()`
- Does NOT require a `crId` (crId will be null)
- Changelog will be an empty array or contain a single "manual" entry

### Pattern 5: Publish Immutability Guard

```typescript
// src/server/services/version.service.ts
export async function publishVersion(versionId: string, actorId: string) {
  const [version] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, versionId))
    .limit(1)

  if (!version) throw new TRPCError({ code: 'NOT_FOUND' })
  if (version.isPublished) {
    // Idempotent — already published, return as-is (do not throw)
    return version
  }

  const [updated] = await db
    .update(documentVersions)
    .set({ isPublished: true, publishedAt: new Date() })
    .where(eq(documentVersions.id, versionId))
    .returning()

  return updated
}
```

Immutability for phase 7+ public portal: the `isPublished` flag will be checked in Phase 9's public portal queries. Phase 6 only needs to set the flag correctly and block re-publishing in the service layer.

### Pattern 6: Section-Level Diff

Use the `diff` package's `diffWords` function against the stringified Tiptap JSON content of two snapshots, matched by `sectionId`:

```typescript
// src/server/services/version.service.ts
import { diffWords } from 'diff'

export function computeSectionDiff(
  snapshotA: SectionSnapshot[],
  snapshotB: SectionSnapshot[],
) {
  const mapA = new Map(snapshotA.map((s) => [s.sectionId, s]))
  const mapB = new Map(snapshotB.map((s) => [s.sectionId, s]))

  // All unique section IDs across both versions
  const allIds = new Set([...mapA.keys(), ...mapB.keys()])

  return Array.from(allIds).map((sectionId) => {
    const a = mapA.get(sectionId)
    const b = mapB.get(sectionId)
    const textA = a ? JSON.stringify(a.content) : ''
    const textB = b ? JSON.stringify(b.content) : ''
    return {
      sectionId,
      titleA: a?.title ?? null,
      titleB: b?.title ?? null,
      status: !a ? 'added' : !b ? 'removed' : textA === textB ? 'unchanged' : 'modified',
      diff: textA !== textB ? diffWords(textA, textB) : null,
    }
  })
}
```

The UI renders `diff.Change[]` items: items with `added: true` get green highlight; `removed: true` get red strikethrough; neither = unchanged text.

### Anti-Patterns to Avoid

- **Diffing live section content instead of snapshots:** If the section is subsequently edited, the diff becomes meaningless. Always diff from stored snapshots.
- **Storing snapshot outside the transaction:** If snapshot capture happens after `tx.commit()`, a crash leaves a version row with no snapshot. Always capture inside the `db.transaction` block.
- **Re-using the same version label for manual creates:** `getNextVersionLabel` must be called inside the create transaction to avoid race conditions (two simultaneous creates could compute the same label). The unique constraint `uq_document_version` will catch this but prefer preventing it at query time with `FOR UPDATE SKIP LOCKED` or sequential creates.
- **Allowing edits after publish:** The publish guard must be at the service layer, not just the UI. The `mergeCR` and future section editing mutations should check `isPublished` on the document's latest version before allowing changes — but this concern is deferred to Phase 9 (public portal). For Phase 6, the guard is: published versions cannot be re-published, and the UI hides the publish button after publish.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text diff algorithm | Custom Myers diff | `diff` package (already installed) | Battle-tested, handles edge cases, supports word/line/char modes |
| Version label generation | Custom parsing | `getNextVersionLabel()` already in `changeRequest.service.ts` | Already exists and is tested; extract to shared `version.service.ts` helper |
| Section content serialization | Custom serializer | `JSON.stringify()` on Tiptap content JSONB | Tiptap content is already stored as JSONB; stringify is sufficient for diff input |

**Key insight:** Phase 5 already solved version label generation and transaction atomicity. Phase 6 extends existing patterns, not replaces them.

## Common Pitfalls

### Pitfall 1: Snapshot Null for Pre-Phase-6 Versions

**What goes wrong:** The version history list and diff view query `sectionsSnapshot` on Phase 5 stub rows. These will be NULL.

**Why it happens:** The `0003_change_requests.sql` migration did not include `sections_snapshot`. Any CR merged before this migration runs will have no snapshot.

**How to avoid:** In the diff UI, check `if (!versionA.sectionsSnapshot || !versionB.sectionsSnapshot)` and show a "Snapshot not available for this version" message rather than throwing.

**Warning signs:** `TypeError: Cannot read properties of null` in diff view; empty diff for early versions.

### Pitfall 2: Drizzle Schema Must Match Migration Column Order

**What goes wrong:** Drizzle infers column order from schema definition order. If schema columns are defined in a different order than the `ALTER TABLE` adds them, TypeScript types work but Drizzle's introspection may emit false positives in `drizzle-kit push`.

**Why it happens:** `ALTER TABLE ADD COLUMN` appends to physical storage; Drizzle schema defines logical order.

**How to avoid:** Append the four new columns at the bottom of the `documentVersions` table definition. Do not reorder existing columns.

### Pitfall 3: Changelog Built from Stale Feedback State

**What goes wrong:** The changelog captures feedback IDs but if feedback `readableId` is generated from a sequence, the readable IDs used at changelog build time should match what the user sees in the UI. The current schema uses `feedbackItems.readableId` (text, unique). This is correct.

**Why it happens:** If `buildChangelog` joins via `feedbackItems.id` (UUID) but shows readable IDs, it must do the join at insert time, not lazily.

**How to avoid:** Build `ChangelogEntry` with `feedbackReadableIds: string[]` at version creation time inside the transaction, not computed at query time.

### Pitfall 4: Version Label Race on Manual Creates

**What goes wrong:** Two concurrent `version.createManual` calls for the same document compute the same label (`v0.3`) and both attempt to insert. The unique constraint `uq_document_version` catches this with a PostgreSQL error.

**Why it happens:** `getNextVersionLabel` reads the latest label then inserts — not atomic.

**How to avoid:** Wrap manual version create in a transaction with the label computed and inserted in the same transaction. The unique constraint is the final guard. Surface a user-friendly error on conflict.

### Pitfall 5: Import Cycle if version.service imports from changeRequest.service

**What goes wrong:** `changeRequest.service.ts` calls `mergeCR`, which may need `buildChangelog` from `version.service.ts`. If `version.service.ts` imports `getNextVersionLabel` from `changeRequest.service.ts`, there's a circular import.

**Why it happens:** Phase 5 placed `getNextVersionLabel` in `changeRequest.service.ts`. Phase 6 needs it in the merge path AND the manual-create path.

**How to avoid:** Move `getNextVersionLabel` to `version.service.ts`. Update `changeRequest.service.ts` to import it from there. Both files then have a one-directional dependency: `changeRequest.service` imports from `version.service`.

### Pitfall 6: Zod v4 Record Schema for Snapshot Types

**What goes wrong:** Snapshot content is `Record<string, unknown>`. Zod v4 requires `z.record(z.string(), z.unknown())` (two args). `z.record(z.unknown())` crashes at runtime.

**Why it happens:** Zod v4 breaking change from v3 (established in Phase 3 decisions).

**How to avoid:** All Zod schemas for content fields must use `z.record(z.string(), z.unknown())`.

## Code Examples

### Query: List Versions for a Document

```typescript
// src/server/routers/version.ts
list: requirePermission('version:read')
  .input(z.object({ documentId: z.string().uuid() }))
  .query(async ({ input }) => {
    const rows = await db
      .select({
        id: documentVersions.id,
        documentId: documentVersions.documentId,
        versionLabel: documentVersions.versionLabel,
        mergeSummary: documentVersions.mergeSummary,
        createdBy: documentVersions.createdBy,
        crId: documentVersions.crId,
        createdAt: documentVersions.createdAt,
        isPublished: documentVersions.isPublished,
        publishedAt: documentVersions.publishedAt,
        // NOTE: sectionsSnapshot and changelog are large — omit from list, include only in getById
        creatorName: users.name,
      })
      .from(documentVersions)
      .leftJoin(users, eq(documentVersions.createdBy, users.id))
      .where(eq(documentVersions.documentId, input.documentId))
      .orderBy(desc(documentVersions.createdAt))

    return rows
  }),
```

### Query: Get Version Detail with Snapshot

```typescript
getById: requirePermission('version:read')
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input }) => {
    const [version] = await db
      .select()
      .from(documentVersions)
      .leftJoin(users, eq(documentVersions.createdBy, users.id))
      .where(eq(documentVersions.id, input.id))
      .limit(1)

    if (!version) throw new TRPCError({ code: 'NOT_FOUND' })
    return version
  }),
```

### Inline Diff Renderer (no new dependency)

```tsx
// app/(workspace)/policies/[id]/versions/_components/version-diff-view.tsx
'use client'
import { diffWords, type Change } from 'diff'

function SectionDiffHunk({ changes }: { changes: Change[] }) {
  return (
    <span className="font-mono text-sm leading-relaxed">
      {changes.map((part, i) => (
        <span
          key={i}
          className={
            part.added
              ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
              : part.removed
              ? 'bg-red-100 text-red-700 line-through dark:bg-red-950 dark:text-red-300'
              : 'text-foreground'
          }
        >
          {part.value}
        </span>
      ))}
    </span>
  )
}
```

### Permissions Extension

```typescript
// src/lib/permissions.ts — add Phase 6 entries
// Versioning (Phase 6)
'version:read':    [ROLES.ADMIN, ROLES.POLICY_LEAD, ROLES.AUDITOR, ROLES.OBSERVER, ROLES.RESEARCH_LEAD] as readonly Role[],
'version:manage':  [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
'version:publish': [ROLES.ADMIN, ROLES.POLICY_LEAD] as readonly Role[],
```

### Audit Action Constants

```typescript
// src/lib/constants.ts — ACTIONS additions
VERSION_CREATE:  'version.create',
VERSION_PUBLISH: 'version.publish',
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store diff at query time | Snapshot at creation time | Best practice for immutable audit systems | Diffs are consistent even if section content changes post-version |
| Separate version content table | JSONB snapshot column on versions table | PostgreSQL JSONB support matured | Simpler query path; no extra join for snapshot content |

## Open Questions

1. **Tiptap JSON content as diff input**
   - What we know: `policy_sections.content` is `JSONB` (Tiptap JSON format). `diff` operates on strings.
   - What's unclear: Should the diff be on `JSON.stringify(content)` (machine-readable) or on extracted plain text (human-readable)?
   - Recommendation: Use `JSON.stringify` for the initial implementation. The diff view notes this is structural. A future phase can extract text from Tiptap nodes using `editor.getText()` equivalent. This avoids an editor dependency in the server service.

2. **Manual version creation — when is a snapshot "current"?**
   - What we know: Manual versions should snapshot the current live section content.
   - What's unclear: If a section is being edited concurrently, the snapshot may lag by milliseconds.
   - Recommendation: Accept this — the snapshot is taken at transaction commit time. Document the behavior. No locking mechanism is needed for Phase 6.

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — phase is code/config/DB changes only; `diff` package already installed).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.mts` |
| Quick run command | `npm test -- --reporter=verbose src/__tests__/versioning.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VER-01 | `getNextVersionLabel` increments v0.N correctly | unit | `npm test -- src/__tests__/versioning.test.ts` | Wave 0 |
| VER-02 | Manual version create inserts with null crId and valid snapshot | unit | `npm test -- src/__tests__/versioning.test.ts` | Wave 0 |
| VER-03 | `buildChangelog` returns correct ChangelogEntry[] from linked feedback | unit | `npm test -- src/__tests__/versioning.test.ts` | Wave 0 |
| VER-04 | `computeSectionDiff` returns added/removed/modified/unchanged per section | unit | `npm test -- src/__tests__/versioning.test.ts` | Wave 0 |
| VER-05 | Version list returns all versions for a document ordered by createdAt desc | manual-only | — | Covered by VER-01/VER-02 |
| VER-06 | `publishVersion` sets isPublished=true and publishedAt | unit | `npm test -- src/__tests__/versioning.test.ts` | Wave 0 |
| VER-07 | `publishVersion` called twice is idempotent (no error, no duplicate) | unit | `npm test -- src/__tests__/versioning.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- src/__tests__/versioning.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/versioning.test.ts` — covers VER-01 through VER-07 (service-level pure logic tests, no DB connection required)

## Project Constraints (from CLAUDE.md)

CLAUDE.md delegates to AGENTS.md which states:

> This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Directives for Phase 6:**
- Before writing any Next.js page or layout code, verify the App Router file convention in `node_modules/next/dist/docs/01-app/02-guides/` and `03-api-reference/`
- `params` in page components is a `Promise<{...}>` — must be `await`-ed (established in Phase 5: `const { id: documentId, crId } = await params`)
- No `export default` shorthand for server components with dynamic params — use the full async function form
- tRPC v11 uses `createTRPCReact` (not `createReactTRPCContext`) — established in Phase 1 decisions
- Toaster imported from `sonner` directly (not shadcn wrapper) — established in Phase 2 decisions
- `z.record(z.string(), z.unknown())` — Zod v4 requires two args — established in Phase 3 decisions
- No `publicProcedure` in application routers — all mutations require `requirePermission` — established in Phase 1 decisions
- shadcn components use base-nova style with `@base-ui/react` primitives (not Radix) — established in Phase 2 decisions
- tRPC dates serialized as strings in UI interfaces — established in Phase 2 decisions

## Sources

### Primary (HIGH confidence)
- Codebase: `src/db/schema/changeRequests.ts` — confirmed exact stub schema, columns, and unique constraint
- Codebase: `src/server/services/changeRequest.service.ts` — confirmed `mergeCR` transaction structure and `getNextVersionLabel` implementation
- Codebase: `src/db/migrations/0003_change_requests.sql` — confirmed existing `ALTER TABLE feedback` pattern for adding columns post-creation
- Codebase: `package.json` — confirmed installed packages; `diff` present, `react-diff-viewer-continued` absent
- npm: `diff` 8.0.4, `react-diff-viewer-continued` 4.2.0 — verified current versions 2026-03-25
- Codebase: `src/lib/permissions.ts` — confirmed permission matrix pattern and role constants
- Codebase: `vitest.config.mts` — confirmed test setup, jsdom environment, path alias

### Secondary (MEDIUM confidence)
- Codebase: Phase 3 decision notes in STATE.md — `z.record(z.string(), z.unknown())` requirement for Zod v4
- Codebase: Phase 5 decision notes in STATE.md — `documentVersions` defined before `changeRequests` to avoid forward-reference FK circular import pattern

### Tertiary (LOW confidence)
- None — all findings are directly verified against codebase and npm registry.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed against node_modules and npm registry
- Architecture: HIGH — all patterns derived from existing Phase 5 code; no speculative patterns
- Pitfalls: HIGH — all derived from actual Phase 3/4/5 decisions in STATE.md or direct schema inspection

**Research date:** 2026-03-25
**Valid until:** 2026-06-25 (stable stack; diff and Drizzle APIs are stable)
