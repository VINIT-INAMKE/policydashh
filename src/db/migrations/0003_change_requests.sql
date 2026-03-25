-- Phase 5: Change Request System Migration
-- Creates CR tables, document_versions stub, join tables, sequence, enum, indexes

-- CR status enum
CREATE TYPE cr_status AS ENUM ('drafting', 'in_review', 'approved', 'merged', 'closed');

-- Human-readable CR-NNN ID counter
CREATE SEQUENCE cr_id_seq START 1;

-- Document versions (minimal stub for merge — Phase 6 extends)
CREATE TABLE document_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID NOT NULL REFERENCES policy_documents(id),
  version_label  TEXT NOT NULL,
  merge_summary  TEXT,
  created_by     UUID NOT NULL REFERENCES users(id),
  cr_id          UUID,  -- FK added after change_requests table
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_label)
);

-- Change requests
CREATE TABLE change_requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  readable_id        TEXT NOT NULL UNIQUE,
  document_id        UUID NOT NULL REFERENCES policy_documents(id),
  owner_id           UUID NOT NULL REFERENCES users(id),
  title              TEXT NOT NULL,
  description        TEXT,
  status             cr_status NOT NULL DEFAULT 'drafting',
  approver_id        UUID REFERENCES users(id),
  approved_at        TIMESTAMPTZ,
  merged_by          UUID REFERENCES users(id),
  merged_at          TIMESTAMPTZ,
  merged_version_id  UUID REFERENCES document_versions(id),
  closure_rationale  TEXT,
  xstate_snapshot    JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from document_versions.cr_id -> change_requests.id
ALTER TABLE document_versions ADD CONSTRAINT fk_dv_cr FOREIGN KEY (cr_id) REFERENCES change_requests(id);

-- CR <-> Feedback join table
CREATE TABLE cr_feedback_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cr_id       UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
  feedback_id UUID NOT NULL REFERENCES feedback(id),
  UNIQUE (cr_id, feedback_id)
);

-- CR <-> Section join table
CREATE TABLE cr_section_links (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cr_id      UUID NOT NULL REFERENCES change_requests(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES policy_sections(id),
  UNIQUE (cr_id, section_id)
);

-- Add resolved_in_version_id to feedback table
ALTER TABLE feedback ADD COLUMN resolved_in_version_id UUID REFERENCES document_versions(id);

-- Indexes
CREATE INDEX idx_change_requests_document ON change_requests(document_id);
CREATE INDEX idx_change_requests_status ON change_requests(status);
CREATE INDEX idx_cr_feedback_links_cr ON cr_feedback_links(cr_id);
CREATE INDEX idx_cr_section_links_cr ON cr_section_links(cr_id);
