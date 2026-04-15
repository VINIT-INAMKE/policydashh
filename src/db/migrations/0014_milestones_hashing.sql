-- Phase 22: milestones table + SHA256 hashing foundation
-- VERIFY-01, VERIFY-02
--
-- Adds:
--   1. milestone_status enum (defining → ready → anchoring → anchored)
--   2. milestones table with content_hash CHECK constraint
--   3. Nullable milestone_id FK column on 4 target tables
--   4. Partial indexes on each FK column (non-null subset only)
--
-- Idempotent pattern (DO $$ BEGIN ... EXCEPTION WHEN duplicate_object;
-- CREATE TABLE IF NOT EXISTS; ALTER TABLE ADD COLUMN IF NOT EXISTS;
-- CREATE INDEX IF NOT EXISTS) — matches 0011_cal_com_workshop_register.sql.
-- Indexes created in-transaction (non-blocking variant forbidden inside a
-- transaction block — migrations run inside Neon serverless transactions).

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
  content_hash             text,
  manifest                 jsonb,
  canonical_json_bytes_len integer,
  created_by               uuid NOT NULL REFERENCES users(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_content_hash_format
    CHECK (content_hash IS NULL OR content_hash ~ '^[0-9a-f]{64}$')
);

-- 3. Nullable milestone_id FK columns on 4 target tables
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS milestone_id uuid;
ALTER TABLE workshops         ADD COLUMN IF NOT EXISTS milestone_id uuid;
ALTER TABLE feedback          ADD COLUMN IF NOT EXISTS milestone_id uuid;
ALTER TABLE evidence_artifacts ADD COLUMN IF NOT EXISTS milestone_id uuid;

-- 4. FK constraints (idempotent — add only if not already present)
-- Using DO blocks because ALTER TABLE ADD CONSTRAINT does not support IF NOT EXISTS.
DO $$ BEGIN
  ALTER TABLE document_versions
    ADD CONSTRAINT document_versions_milestone_id_fkey
    FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE workshops
    ADD CONSTRAINT workshops_milestone_id_fkey
    FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE feedback
    ADD CONSTRAINT feedback_milestone_id_fkey
    FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE evidence_artifacts
    ADD CONSTRAINT evidence_artifacts_milestone_id_fkey
    FOREIGN KEY (milestone_id) REFERENCES milestones(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 5. Partial indexes (safe inside transaction block)
CREATE INDEX IF NOT EXISTS idx_document_versions_milestone_id
  ON document_versions (milestone_id) WHERE milestone_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workshops_milestone_id
  ON workshops (milestone_id) WHERE milestone_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_milestone_id
  ON feedback (milestone_id) WHERE milestone_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_artifacts_milestone_id
  ON evidence_artifacts (milestone_id) WHERE milestone_id IS NOT NULL;
