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
