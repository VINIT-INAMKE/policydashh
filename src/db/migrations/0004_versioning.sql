-- Phase 6: Extend document_versions with snapshot, changelog, publish columns
ALTER TABLE document_versions
  ADD COLUMN sections_snapshot JSONB,
  ADD COLUMN changelog         JSONB,
  ADD COLUMN published_at      TIMESTAMPTZ,
  ADD COLUMN is_published      BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_document_versions_document ON document_versions(document_id);
CREATE INDEX idx_document_versions_published ON document_versions(is_published) WHERE is_published = true;
