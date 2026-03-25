-- Phase 4: Feedback System Migration
-- Creates feedback, section_assignments, evidence tables + enums + sequence

-- Human-readable ID counter
CREATE SEQUENCE feedback_id_seq START 1;

-- Section assignments (AUTH-05: scoping)
CREATE TABLE section_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  section_id  UUID NOT NULL REFERENCES policy_sections(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, section_id)
);
CREATE INDEX idx_section_assignments_user ON section_assignments(user_id);
CREATE INDEX idx_section_assignments_section ON section_assignments(section_id);

-- Feedback enums
CREATE TYPE feedback_type    AS ENUM ('issue', 'suggestion', 'endorsement', 'evidence', 'question');
CREATE TYPE feedback_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE impact_category   AS ENUM ('legal', 'security', 'tax', 'consumer', 'innovation', 'clarity', 'governance', 'other');
CREATE TYPE feedback_status   AS ENUM ('submitted', 'under_review', 'accepted', 'partially_accepted', 'rejected', 'closed');

-- Feedback items
CREATE TABLE feedback (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  readable_id        TEXT NOT NULL UNIQUE,
  section_id         UUID NOT NULL REFERENCES policy_sections(id),
  document_id        UUID NOT NULL REFERENCES policy_documents(id),
  submitter_id       UUID NOT NULL REFERENCES users(id),
  feedback_type      feedback_type NOT NULL,
  priority           feedback_priority NOT NULL DEFAULT 'medium',
  impact_category    impact_category NOT NULL DEFAULT 'other',
  title              TEXT NOT NULL,
  body               TEXT NOT NULL,
  suggested_change   TEXT,
  status             feedback_status NOT NULL DEFAULT 'submitted',
  is_anonymous       BOOLEAN NOT NULL DEFAULT false,
  decision_rationale TEXT,
  reviewed_by        UUID REFERENCES users(id),
  reviewed_at        TIMESTAMPTZ,
  xstate_snapshot    JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_section ON feedback(section_id);
CREATE INDEX idx_feedback_document ON feedback(document_id);
CREATE INDEX idx_feedback_submitter ON feedback(submitter_id);
CREATE INDEX idx_feedback_status ON feedback(status);

-- Evidence enums and tables
CREATE TYPE evidence_type AS ENUM ('file', 'link');

CREATE TABLE evidence_artifacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  type        evidence_type NOT NULL,
  url         TEXT NOT NULL,
  file_name   TEXT,
  file_size   INTEGER,
  uploader_id UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Feedback <-> Evidence join (EV-02: attach to feedback items)
CREATE TABLE feedback_evidence (
  feedback_id  UUID NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  artifact_id  UUID NOT NULL REFERENCES evidence_artifacts(id) ON DELETE CASCADE,
  PRIMARY KEY (feedback_id, artifact_id)
);

-- Section <-> Evidence join (EV-02: attach to sections)
CREATE TABLE section_evidence (
  section_id  UUID NOT NULL REFERENCES policy_sections(id) ON DELETE CASCADE,
  artifact_id UUID NOT NULL REFERENCES evidence_artifacts(id) ON DELETE CASCADE,
  PRIMARY KEY (section_id, artifact_id)
);
