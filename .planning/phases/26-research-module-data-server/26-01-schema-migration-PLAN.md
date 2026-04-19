---
phase: 26-research-module-data-server
plan: 01
type: execute
wave: 1
depends_on: ["26-00"]
files_modified:
  - src/db/schema/research.ts
  - src/db/schema/index.ts
  - src/db/migrations/0025_research_module.sql
  - scripts/apply-migration-0025.mjs
autonomous: true
requirements:
  - RESEARCH-01
  - RESEARCH-02
must_haves:
  truths:
    - "research_items table exists in the database with 25+ columns per DOMAIN.md Core Attributes"
    - "Three link tables (research_item_section_links, research_item_version_links, research_item_feedback_links) exist with composite PKs"
    - "research_item_id_seq PostgreSQL sequence exists and produces monotonically increasing integers"
    - "isAuthorAnonymous boolean NOT NULL DEFAULT false column present on research_items (Q7)"
    - "research_items.milestoneId nullable column with SQL-only FK to milestones (avoids circular Drizzle import)"
    - "research_items.previousVersionId self-FK added via separate ALTER TABLE (Pitfall 3)"
    - "research_item_version_links.versionId references document_versions via SQL-only FK"
    - "src/__tests__/research-schema.test.ts flips from RED to GREEN"
  artifacts:
    - path: "src/db/schema/research.ts"
      provides: "Drizzle schema for researchItems + 3 link tables + 2 enums"
      min_lines: 80
      contains: "researchItems"
    - path: "src/db/schema/index.ts"
      provides: "Barrel re-export of research schema"
      contains: "export * from './research'"
    - path: "src/db/migrations/0025_research_module.sql"
      provides: "DDL for all tables + sequence + enums + SQL-only FKs + partial indexes"
      min_lines: 100
      contains: "CREATE SEQUENCE IF NOT EXISTS research_item_id_seq"
    - path: "scripts/apply-migration-0025.mjs"
      provides: "Neon HTTP runner for migration 0025"
      min_lines: 60
      contains: "0025_research_module.sql"
  key_links:
    - from: "src/db/schema/research.ts"
      to: "src/db/schema/documents.ts, src/db/schema/users.ts, src/db/schema/evidence.ts, src/db/schema/feedback.ts"
      via: "drizzle .references(() => X.id) for non-circular FKs"
      pattern: "references\\(\\(\\) =>"
    - from: "src/db/migrations/0025_research_module.sql"
      to: "milestones (Phase 22) + document_versions (Phase 6)"
      via: "ALTER TABLE ... ADD CONSTRAINT inside DO block for circular FKs"
      pattern: "research_items_milestone_id_fkey"
    - from: "scripts/apply-migration-0025.mjs"
      to: "Neon HTTP driver (@neondatabase/serverless)"
      via: "sql.query(stmt) form + DO-block-aware statement splitter"
      pattern: "sql.query"
    - from: "src/__tests__/research-schema.test.ts"
      to: "src/db/schema/research.ts"
      via: "import { researchItems, researchItemStatusEnum, ... } from '@/src/db/schema/research'"
      pattern: "from '@/src/db/schema/research'"
---

<objective>
Create the `research_items` table + three link tables + `research_item_id_seq` sequence per Phase 22 Pattern 2 (hand-written SQL applied via Neon HTTP runner, not drizzle-kit push). Flip src/__tests__/research-schema.test.ts from RED to GREEN.

Purpose: RESEARCH-01 + RESEARCH-02 data substrate — every subsequent wave depends on this schema. Circular FKs (milestoneId -> milestones, previousVersionId -> researchItems self, versionId -> document_versions) are applied via SQL-only ALTER TABLE statements to avoid TypeScript infinite-recursion type errors (established precedent: resolvedInVersionId on feedback.ts line 43, milestoneId on workshops.ts line 53).

Output: src/db/schema/research.ts + src/db/schema/index.ts (barrel update) + src/db/migrations/0025_research_module.sql + scripts/apply-migration-0025.mjs. Running the apply script creates all objects in the Neon dev database idempotently.

This plan addresses RESEARCH-01 (schema + link tables + isAuthorAnonymous filter) and RESEARCH-02 (readable ID sequence).
</objective>

<execution_context>
@D:/aditee/policydash/.claude/get-shit-done/workflows/execute-plan.md
@D:/aditee/policydash/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/26-research-module-data-server/26-CONTEXT.md
@.planning/phases/26-research-module-data-server/26-RESEARCH.md
@.planning/research/research-module/DOMAIN.md
@.planning/research/research-module/INTEGRATION.md
@src/db/schema/feedback.ts
@src/db/schema/workshops.ts
@src/db/schema/milestones.ts
@src/db/schema/evidence.ts
@src/db/schema/changeRequests.ts
@src/db/schema/index.ts
@src/db/migrations/0014_milestones_hashing.sql
@scripts/apply-migration-0014.mjs
@src/db/migrations/0002_feedback_system.sql
@AGENTS.md

<interfaces>
<!-- Tables this plan creates — subsequent waves consume these exports. -->

From (this plan) src/db/schema/research.ts:
```typescript
export const researchItemTypeEnum: ReturnType<typeof pgEnum>
export const researchItemStatusEnum: ReturnType<typeof pgEnum>
export const researchItems: ReturnType<typeof pgTable>       // 25+ columns
export const researchItemSectionLinks: ReturnType<typeof pgTable>
export const researchItemVersionLinks: ReturnType<typeof pgTable>
export const researchItemFeedbackLinks: ReturnType<typeof pgTable>
```

From (existing) src/db/schema/documents.ts (this plan depends on):
```typescript
export const policyDocuments: ReturnType<typeof pgTable>  // id uuid PK
export const policySections:  ReturnType<typeof pgTable>  // id uuid PK
```

From (existing) src/db/schema/users.ts:
```typescript
export const users: ReturnType<typeof pgTable>  // id uuid PK
```

From (existing) src/db/schema/evidence.ts:
```typescript
export const evidenceArtifacts: ReturnType<typeof pgTable>  // id uuid PK (artifactId target)
```

From (existing) src/db/schema/feedback.ts:
```typescript
export const feedbackItems: ReturnType<typeof pgTable>  // id uuid PK (feedbackId link target)
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write src/db/schema/research.ts + update barrel src/db/schema/index.ts</name>
  <files>src/db/schema/research.ts, src/db/schema/index.ts</files>
  <read_first>
    - src/db/schema/feedback.ts (exact import pattern + `resolvedInVersionId` SQL-only FK comment style)
    - src/db/schema/workshops.ts lines 35–76 (workshops table shape + composite-PK link tables + milestoneId SQL-only FK comment)
    - src/db/schema/evidence.ts (feedbackEvidence / sectionEvidence composite-PK pattern)
    - src/db/schema/milestones.ts (ManifestEntry type location — do NOT modify in this plan, Plan 26-03 handles)
    - src/db/schema/index.ts (current barrel exports — plan will append ./research)
    - .planning/phases/26-research-module-data-server/26-RESEARCH.md §Pattern 1 (verbatim schema shape to implement)
    - .planning/research/research-module/DOMAIN.md Core Attributes (required + optional field list)
    - AGENTS.md (Next.js-specific docs — N/A for schema files but confirm no Next.js API is invoked)
  </read_first>
  <action>
    Create `src/db/schema/research.ts` with this EXACT content (copy verbatim from RESEARCH.md Pattern 1, normalize spacing):

    ```typescript
    import { pgTable, pgEnum, uuid, text, timestamp, boolean, date, index, primaryKey } from 'drizzle-orm/pg-core'
    import { users } from './users'
    import { policyDocuments, policySections } from './documents'
    import { feedbackItems } from './feedback'
    import { evidenceArtifacts } from './evidence'
    // NOTE: do NOT import documentVersions or milestones here.
    // milestoneId, previousVersionId, and researchItemVersionLinks.versionId
    // use SQL-only FKs (constraints added in migration 0025) to avoid the
    // circular Drizzle type recursion documented in:
    //   - src/db/schema/feedback.ts line 43 (resolvedInVersionId)
    //   - src/db/schema/workshops.ts line 53 (milestoneId)
    //   - src/db/schema/changeRequests.ts line 31 (crId)

    // Phase 26: research module — citable research items attached to a policy document
    //   - RESEARCH-01 schema + link tables
    //   - RESEARCH-02 readable-ID sequence (seq defined in migration 0025)
    //   - Q1: documentId NOT NULL (per-policy scope)
    //   - Q7: isAuthorAnonymous flag (public listPublic must null out authors)

    export const researchItemTypeEnum = pgEnum('research_item_type', [
      'report', 'paper', 'dataset', 'memo', 'interview_transcript',
      'media_coverage', 'legal_reference', 'case_study',
    ])

    export const researchItemStatusEnum = pgEnum('research_item_status', [
      'draft', 'pending_review', 'published', 'retracted',
    ])

    export const researchItems = pgTable('research_items', {
      id:                uuid('id').primaryKey().defaultRandom(),
      readableId:        text('readable_id').notNull().unique(),
      documentId:        uuid('document_id').notNull().references(() => policyDocuments.id),
      title:             text('title').notNull(),
      itemType:          researchItemTypeEnum('item_type').notNull(),
      status:            researchItemStatusEnum('status').notNull().default('draft'),
      createdBy:         uuid('created_by').notNull().references(() => users.id),

      // Optional citation metadata
      description:       text('description'),
      externalUrl:       text('external_url'),
      artifactId:        uuid('artifact_id').references(() => evidenceArtifacts.id),
      doi:               text('doi'),                                 // Q10: plain text
      authors:           text('authors').array(),                     // null-hidden on public queries when isAuthorAnonymous = true
      publishedDate:     date('published_date'),
      peerReviewed:      boolean('peer_reviewed').notNull().default(false),
      journalOrSource:   text('journal_or_source'),
      versionLabel:      text('version_label'),
      previousVersionId: uuid('previous_version_id'),                  // self-FK - constraint in SQL migration only (Pitfall 3: self-FK must come after CREATE TABLE)
      isAuthorAnonymous: boolean('is_author_anonymous').notNull().default(false),   // Q7

      // Review fields populated on approve / retract
      reviewedBy:        uuid('reviewed_by').references(() => users.id),
      reviewedAt:        timestamp('reviewed_at', { withTimezone: true }),
      retractionReason:  text('retraction_reason'),

      // Milestone anchoring (SQL-only FK, same as workshops.milestoneId / evidence_artifacts.milestoneId)
      milestoneId:       uuid('milestone_id'),                         // FK to milestones - constraint in SQL migration only (avoids circular import)

      // Cardano anchoring fields — Q4: milestone-only in v0.2 (columns present so v0.3 can wire per-item anchoring without another migration)
      contentHash:       text('content_hash'),
      txHash:            text('tx_hash'),
      anchoredAt:        timestamp('anchored_at', { withTimezone: true }),

      createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    }, (t) => [
      index('idx_research_items_document').on(t.documentId),
      index('idx_research_items_status').on(t.status),
      index('idx_research_items_created_by').on(t.createdBy),
    ])

    // Link tables — composite PK pattern from workshopSectionLinks (workshops.ts lines 64–76)
    export const researchItemSectionLinks = pgTable('research_item_section_links', {
      researchItemId: uuid('research_item_id').notNull().references(() => researchItems.id, { onDelete: 'cascade' }),
      sectionId:      uuid('section_id').notNull().references(() => policySections.id, { onDelete: 'cascade' }),
      relevanceNote:  text('relevance_note'),
    }, (t) => [
      primaryKey({ columns: [t.researchItemId, t.sectionId] }),
    ])

    export const researchItemVersionLinks = pgTable('research_item_version_links', {
      researchItemId: uuid('research_item_id').notNull().references(() => researchItems.id, { onDelete: 'cascade' }),
      versionId:      uuid('version_id').notNull(),   // FK to document_versions - constraint in SQL migration only (avoids circular import)
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

    Then update `src/db/schema/index.ts` by appending one line to the existing barrel (preserve existing order):

    ```typescript
    export * from './research'
    ```

    Full updated barrel content:
    ```typescript
    export * from './users'
    export * from './audit'
    export * from './workflow'
    export * from './documents'
    export * from './feedback'
    export * from './sectionAssignments'
    export * from './evidence'
    export * from './changeRequests'
    export * from './notifications'
    export * from './workshops'
    export * from './milestones'
    export * from './research'
    ```
  </action>
  <verify>
    <automated>test -f src/db/schema/research.ts && grep -q "export \* from './research'" src/db/schema/index.ts && npx tsc --noEmit src/db/schema/research.ts 2>&1 | grep -qvE "Type instantiation is excessively deep"</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/db/schema/research.ts`
    - `grep -q "export const researchItemTypeEnum = pgEnum('research_item_type'" src/db/schema/research.ts`
    - `grep -q "'report', 'paper', 'dataset', 'memo'" src/db/schema/research.ts`
    - `grep -q "'interview_transcript', 'media_coverage', 'legal_reference', 'case_study'" src/db/schema/research.ts`
    - `grep -q "export const researchItemStatusEnum = pgEnum('research_item_status'" src/db/schema/research.ts`
    - `grep -q "'draft', 'pending_review', 'published', 'retracted'" src/db/schema/research.ts`
    - `grep -q "export const researchItems = pgTable('research_items'" src/db/schema/research.ts`
    - `grep -q "readableId:.*text('readable_id').notNull().unique()" src/db/schema/research.ts`
    - `grep -q "documentId:.*uuid('document_id').notNull().references(() => policyDocuments.id)" src/db/schema/research.ts`
    - `grep -q "createdBy:.*references(() => users.id)" src/db/schema/research.ts`
    - `grep -q "isAuthorAnonymous:.*boolean('is_author_anonymous').notNull().default(false)" src/db/schema/research.ts`
    - `grep -q "artifactId:.*uuid('artifact_id').references(() => evidenceArtifacts.id)" src/db/schema/research.ts`
    - `grep -q "previousVersionId:.*uuid('previous_version_id')" src/db/schema/research.ts` (no .references — SQL-only FK)
    - `grep -q "milestoneId:.*uuid('milestone_id')" src/db/schema/research.ts` (no .references — SQL-only FK)
    - `grep -q "FK to milestones - constraint in SQL migration only" src/db/schema/research.ts`
    - `grep -q "doi:.*text('doi')" src/db/schema/research.ts`
    - `grep -q "authors:.*text('authors').array()" src/db/schema/research.ts`
    - `grep -q "peerReviewed:.*boolean('peer_reviewed')" src/db/schema/research.ts`
    - `grep -q "contentHash:.*text('content_hash')" src/db/schema/research.ts`
    - `grep -q "txHash:.*text('tx_hash')" src/db/schema/research.ts`
    - `grep -q "export const researchItemSectionLinks = pgTable('research_item_section_links'" src/db/schema/research.ts`
    - `grep -q "export const researchItemVersionLinks = pgTable('research_item_version_links'" src/db/schema/research.ts`
    - `grep -q "export const researchItemFeedbackLinks = pgTable('research_item_feedback_links'" src/db/schema/research.ts`
    - `grep -q "primaryKey({ columns: \[t.researchItemId, t.sectionId\] })" src/db/schema/research.ts`
    - `grep -q "primaryKey({ columns: \[t.researchItemId, t.versionId\] })" src/db/schema/research.ts`
    - `grep -q "primaryKey({ columns: \[t.researchItemId, t.feedbackId\] })" src/db/schema/research.ts`
    - `grep -q "index('idx_research_items_document').on(t.documentId)" src/db/schema/research.ts`
    - `grep -q "export \* from './research'" src/db/schema/index.ts`
    - `npx tsc --noEmit` reports no new errors beyond pre-existing baseline (schema must not introduce circular-type recursion)
    - `npm test -- --run src/__tests__/research-schema.test.ts` — at least the 9 schema tests now pass (flip from RED to GREEN is the Nyquist signal)
  </acceptance_criteria>
  <done>research.ts schema module exists with 2 enums, 4 tables, composite PKs on link tables, SQL-only FK comments on milestoneId/previousVersionId/versionId, 3 indexes on researchItems; barrel re-exports research.ts; research-schema.test.ts flips GREEN.</done>
</task>

<task type="auto">
  <name>Task 2: Write migration SQL + Neon HTTP apply script + apply to dev DB</name>
  <files>src/db/migrations/0025_research_module.sql, scripts/apply-migration-0025.mjs</files>
  <read_first>
    - src/db/migrations/0014_milestones_hashing.sql (FULL file — canonical DO-block idempotent migration pattern, ALTER TABLE ADD CONSTRAINT inside DO block)
    - scripts/apply-migration-0014.mjs (FULL file — canonical DO-block-aware statement splitter, sql.query() form)
    - src/db/migrations/0002_feedback_system.sql (feedback_id_seq creation — exact pattern to replicate for research_item_id_seq)
    - .planning/phases/26-research-module-data-server/26-RESEARCH.md §Pattern 2 (SQL migration template with DO blocks)
    - src/db/schema/research.ts (column list — SQL must match TypeScript shape exactly)
  </read_first>
  <action>
    Create `src/db/migrations/0025_research_module.sql` with this EXACT content:

    ```sql
    -- Phase 26: research module — research_items table + 3 link tables + readable-ID sequence
    -- RESEARCH-01, RESEARCH-02
    --
    -- Adds:
    --   1. research_item_type + research_item_status enums (idempotent via DO block)
    --   2. research_item_id_seq sequence (matches feedback_id_seq pattern)
    --   3. research_items table with citation + anchoring fields
    --   4. research_item_section_links, research_item_version_links, research_item_feedback_links
    --   5. SQL-only FKs for circular references:
    --        - research_items.milestone_id -> milestones.id (ON DELETE SET NULL)
    --        - research_items.previous_version_id -> research_items.id (self-FK)
    --        - research_item_version_links.version_id -> document_versions.id (ON DELETE CASCADE)
    --   6. Partial indexes on milestone_id (matching 0014 pattern)
    --
    -- Canonical migration pattern: 0014_milestones_hashing.sql
    -- Applied via scripts/apply-migration-0025.mjs (Neon HTTP driver, Pattern 2).

    -- 1. Enums (idempotent)
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

    -- 2. Readable-ID sequence (RESEARCH-02 — matches feedback_id_seq pattern)
    CREATE SEQUENCE IF NOT EXISTS research_item_id_seq START 1;

    -- 3. research_items table (no circular FKs here — those come as ALTER TABLE below)
    CREATE TABLE IF NOT EXISTS research_items (
      id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      readable_id          text NOT NULL UNIQUE,
      document_id          uuid NOT NULL REFERENCES policy_documents(id),
      title                text NOT NULL,
      item_type            research_item_type NOT NULL,
      status               research_item_status NOT NULL DEFAULT 'draft',
      created_by           uuid NOT NULL REFERENCES users(id),

      description          text,
      external_url         text,
      artifact_id          uuid REFERENCES evidence_artifacts(id),
      doi                  text,
      authors              text[],
      published_date       date,
      peer_reviewed        boolean NOT NULL DEFAULT false,
      journal_or_source    text,
      version_label        text,
      previous_version_id  uuid,     -- self-FK added below via ALTER TABLE (Pitfall 3)
      is_author_anonymous  boolean NOT NULL DEFAULT false,

      reviewed_by          uuid REFERENCES users(id),
      reviewed_at          timestamptz,
      retraction_reason    text,

      milestone_id         uuid,     -- circular FK added below (see 0014 for pattern)

      content_hash         text,
      tx_hash              text,
      anchored_at          timestamptz,

      created_at           timestamptz NOT NULL DEFAULT now(),
      updated_at           timestamptz NOT NULL DEFAULT now()
    );

    -- 4. Link tables (composite PK — no circular FKs, can use inline REFERENCES)
    CREATE TABLE IF NOT EXISTS research_item_section_links (
      research_item_id  uuid NOT NULL REFERENCES research_items(id) ON DELETE CASCADE,
      section_id        uuid NOT NULL REFERENCES policy_sections(id) ON DELETE CASCADE,
      relevance_note    text,
      PRIMARY KEY (research_item_id, section_id)
    );

    CREATE TABLE IF NOT EXISTS research_item_version_links (
      research_item_id  uuid NOT NULL REFERENCES research_items(id) ON DELETE CASCADE,
      version_id        uuid NOT NULL,
      PRIMARY KEY (research_item_id, version_id)
    );

    CREATE TABLE IF NOT EXISTS research_item_feedback_links (
      research_item_id  uuid NOT NULL REFERENCES research_items(id) ON DELETE CASCADE,
      feedback_id       uuid NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
      PRIMARY KEY (research_item_id, feedback_id)
    );

    -- 5. SQL-only FKs for circular references (idempotent — ADD only if not already present)

    -- 5a. research_items.milestone_id -> milestones.id  (ON DELETE SET NULL per 0014 pattern)
    DO $$ BEGIN
      ALTER TABLE research_items
        ADD CONSTRAINT research_items_milestone_id_fkey
        FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- 5b. research_items.previous_version_id -> research_items.id  (self-FK, ON DELETE SET NULL)
    -- Pitfall 3: must be added via ALTER TABLE AFTER the CREATE TABLE above, not inline.
    DO $$ BEGIN
      ALTER TABLE research_items
        ADD CONSTRAINT research_items_previous_version_id_fkey
        FOREIGN KEY (previous_version_id) REFERENCES research_items(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- 5c. research_item_version_links.version_id -> document_versions.id
    -- (circular avoided because documentVersions is in changeRequests.ts — SQL FK only)
    DO $$ BEGIN
      ALTER TABLE research_item_version_links
        ADD CONSTRAINT research_item_version_links_version_id_fkey
        FOREIGN KEY (version_id) REFERENCES document_versions(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- 6. Indexes (inline index() in Drizzle creates index with auto-generated name; we recreate here
    --    with IF NOT EXISTS for idempotency — names match the TypeScript declarations)
    CREATE INDEX IF NOT EXISTS idx_research_items_document    ON research_items (document_id);
    CREATE INDEX IF NOT EXISTS idx_research_items_status      ON research_items (status);
    CREATE INDEX IF NOT EXISTS idx_research_items_created_by  ON research_items (created_by);

    -- Partial index on milestone_id (matches 0014 pattern for other milestone-linked tables)
    CREATE INDEX IF NOT EXISTS idx_research_items_milestone_id
      ON research_items (milestone_id) WHERE milestone_id IS NOT NULL;

    -- Partial index on previous_version_id for version-chain navigation
    CREATE INDEX IF NOT EXISTS idx_research_items_previous_version_id
      ON research_items (previous_version_id) WHERE previous_version_id IS NOT NULL;
    ```

    Then create `scripts/apply-migration-0025.mjs` mirroring apply-migration-0014.mjs verbatim (only migration filename + probe table names change):

    ```javascript
    #!/usr/bin/env node
    /**
     * Phase 26-01 - apply migration 0025_research_module via Neon HTTP driver.
     *
     * Phase 14/16 Pattern 2 - hand-written DDL applied via sql.query(stmt), not
     * drizzle-kit push, so journal drift on meta/_journal.json never stops us.
     *
     * Splits the file on ";\n" at statement boundaries, strips block comments, and
     * ignores any empty / comment-only chunks. DO $$ ... $$ blocks are preserved as
     * single atomic statements because they contain no bare semicolons on their own
     * lines in our migration file.
     */

    import { readFileSync } from 'node:fs'
    import { fileURLToPath } from 'node:url'
    import path from 'node:path'
    import { config as dotenvConfig } from 'dotenv'
    import { neon } from '@neondatabase/serverless'

    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)

    dotenvConfig({ path: path.join(__dirname, '..', '.env.local') })

    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      console.error('DATABASE_URL not set')
      process.exit(1)
    }

    const sql = neon(connectionString)
    const migrationPath = path.join(
      __dirname,
      '..',
      'src',
      'db',
      'migrations',
      '0025_research_module.sql',
    )
    const raw = readFileSync(migrationPath, 'utf8')

    // Split on "END $$;" for DO blocks and ";" for simple statements, preserving
    // DO $$ ... END $$; as a single chunk.
    const statements = []
    let current = ''
    let inDoBlock = false
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (trimmed === '' || trimmed.startsWith('--')) {
        if (inDoBlock) current += line + '\n'
        continue
      }
      if (trimmed.startsWith('DO $$')) {
        inDoBlock = true
        current += line + '\n'
        continue
      }
      if (inDoBlock) {
        current += line + '\n'
        if (trimmed.endsWith('END $$;')) {
          statements.push(current.trim())
          current = ''
          inDoBlock = false
        }
        continue
      }
      current += line + '\n'
      if (trimmed.endsWith(';')) {
        statements.push(current.trim())
        current = ''
      }
    }

    console.log(`Applying 0025 migration: ${statements.length} statements`)

    for (const stmt of statements) {
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 80)
      console.log(`  -> ${preview}${stmt.length > 80 ? '...' : ''}`)
      try {
        // Neon HTTP driver: sql.query(string) form for raw DDL (Pattern 2).
        await sql.query(stmt)
      } catch (err) {
        console.error(`FAILED statement:\n${stmt}\n`)
        throw err
      }
    }

    // Sanity-check: every object exists.
    const probes = [
      { sql: 'SELECT 1 FROM research_items LIMIT 1',                label: 'research_items' },
      { sql: 'SELECT 1 FROM research_item_section_links LIMIT 1',   label: 'research_item_section_links' },
      { sql: 'SELECT 1 FROM research_item_version_links LIMIT 1',   label: 'research_item_version_links' },
      { sql: 'SELECT 1 FROM research_item_feedback_links LIMIT 1',  label: 'research_item_feedback_links' },
      { sql: "SELECT nextval('research_item_id_seq') AS n",         label: 'research_item_id_seq' },
    ]
    for (const p of probes) {
      const result = await sql.query(p.sql)
      console.log(`${p.label} probe ->`, result)
    }

    // Run the sequence twice more to confirm monotonic increment (RESEARCH-02 guard)
    const n1 = await sql.query("SELECT nextval('research_item_id_seq') AS n")
    const n2 = await sql.query("SELECT nextval('research_item_id_seq') AS n")
    console.log(`Sequence monotonic check: ${JSON.stringify(n1)} -> ${JSON.stringify(n2)}`)

    console.log('Migration 0025 applied cleanly.')
    ```

    Execute the apply script to ensure migration lands in the dev database:

    ```bash
    node scripts/apply-migration-0025.mjs
    ```

    Expected output: all probes return without error, sequence increments monotonically, final line `Migration 0025 applied cleanly.`
  </action>
  <verify>
    <automated>test -f src/db/migrations/0025_research_module.sql && test -f scripts/apply-migration-0025.mjs && grep -q "CREATE SEQUENCE IF NOT EXISTS research_item_id_seq" src/db/migrations/0025_research_module.sql && node scripts/apply-migration-0025.mjs 2>&1 | grep -q "Migration 0025 applied cleanly"</automated>
  </verify>
  <acceptance_criteria>
    - `test -f src/db/migrations/0025_research_module.sql`
    - `test -f scripts/apply-migration-0025.mjs`
    - `grep -q "CREATE SEQUENCE IF NOT EXISTS research_item_id_seq START 1" src/db/migrations/0025_research_module.sql`
    - `grep -q "CREATE TYPE research_item_type AS ENUM" src/db/migrations/0025_research_module.sql`
    - `grep -q "CREATE TYPE research_item_status AS ENUM" src/db/migrations/0025_research_module.sql`
    - `grep -q "CREATE TABLE IF NOT EXISTS research_items" src/db/migrations/0025_research_module.sql`
    - `grep -q "CREATE TABLE IF NOT EXISTS research_item_section_links" src/db/migrations/0025_research_module.sql`
    - `grep -q "CREATE TABLE IF NOT EXISTS research_item_version_links" src/db/migrations/0025_research_module.sql`
    - `grep -q "CREATE TABLE IF NOT EXISTS research_item_feedback_links" src/db/migrations/0025_research_module.sql`
    - `grep -q "research_items_milestone_id_fkey" src/db/migrations/0025_research_module.sql`
    - `grep -q "REFERENCES milestones(id) ON DELETE SET NULL" src/db/migrations/0025_research_module.sql`
    - `grep -q "research_items_previous_version_id_fkey" src/db/migrations/0025_research_module.sql` (self-FK via ALTER TABLE per Pitfall 3)
    - `grep -q "research_item_version_links_version_id_fkey" src/db/migrations/0025_research_module.sql`
    - `grep -q "REFERENCES document_versions(id)" src/db/migrations/0025_research_module.sql`
    - `grep -q "is_author_anonymous  boolean NOT NULL DEFAULT false" src/db/migrations/0025_research_module.sql`
    - `grep -q "authors              text\[\]" src/db/migrations/0025_research_module.sql`
    - `grep -q "idx_research_items_document" src/db/migrations/0025_research_module.sql`
    - `grep -q "idx_research_items_milestone_id" src/db/migrations/0025_research_module.sql`
    - `grep -q "WHERE milestone_id IS NOT NULL" src/db/migrations/0025_research_module.sql`
    - `grep -q "0025_research_module.sql" scripts/apply-migration-0025.mjs`
    - `grep -q "sql.query(stmt)" scripts/apply-migration-0025.mjs`
    - `grep -q "research_item_id_seq" scripts/apply-migration-0025.mjs` (probe present)
    - `grep -q "Migration 0025 applied cleanly" scripts/apply-migration-0025.mjs`
    - `node scripts/apply-migration-0025.mjs` exits 0 (migration applied successfully against dev DB)
    - Running `node scripts/apply-migration-0025.mjs` a SECOND time also exits 0 (idempotent)
    - The sequence monotonic check output shows n2 > n1 (strictly increasing)
  </acceptance_criteria>
  <done>0025_research_module.sql covers enums + sequence + 4 tables + 3 SQL-only FKs + 3 regular indexes + 2 partial indexes; apply-migration-0025.mjs probes every object + runs sequence twice to prove monotonic increment; migration applied cleanly AND idempotently against dev DB.</done>
</task>

</tasks>

<verification>
1. `test -f src/db/schema/research.ts` — schema module exists
2. `grep -q "export \* from './research'" src/db/schema/index.ts` — barrel updated
3. `test -f src/db/migrations/0025_research_module.sql` — migration exists
4. `test -f scripts/apply-migration-0025.mjs` — apply script exists
5. `node scripts/apply-migration-0025.mjs` — exits 0 (first run: applies; second run: idempotent)
6. `npm test -- --run src/__tests__/research-schema.test.ts` — all 9 schema tests GREEN
7. `npx tsc --noEmit` — no new TypeScript errors (circular-type recursion avoided via SQL-only FKs)
</verification>

<success_criteria>
- research_items table exists in Neon dev DB with all 25 columns per DOMAIN.md
- 3 link tables exist with composite PKs
- research_item_id_seq sequence exists, confirmed monotonic via the apply-script probe
- 3 SQL-only FKs present: milestoneId -> milestones (SET NULL), previousVersionId -> researchItems (self, SET NULL), versionId -> document_versions (CASCADE)
- 5 indexes present (3 regular + 2 partial on nullable FKs)
- src/__tests__/research-schema.test.ts flips from RED to GREEN (9 tests pass)
- TypeScript compiles without circular-type-recursion errors
- Migration is idempotent (can re-run against same DB without failure)
</success_criteria>

<output>
After completion, create `.planning/phases/26-research-module-data-server/26-01-SUMMARY.md` documenting:
- Schema file line count + column count per table
- Migration statement count (printed by apply script)
- Confirmation that sequence is monotonic (n2 > n1)
- Confirmation that re-running apply script is idempotent
- research-schema.test.ts pass count (should be 9 GREEN)
- Unblocks: Plans 26-04 (service depends on researchItems table), 26-05 (router depends on researchItems)
</output>
