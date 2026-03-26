-- 0006_workshops.sql
-- Workshop events, artifacts, section links, and feedback links

CREATE TYPE workshop_artifact_type AS ENUM ('promo', 'recording', 'summary', 'attendance', 'other');

CREATE TABLE workshops (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title             text NOT NULL,
  description       text,
  scheduled_at      timestamptz NOT NULL,
  duration_minutes  integer,
  registration_link text,
  created_by        uuid NOT NULL REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_workshops_scheduled ON workshops(scheduled_at);

CREATE TABLE workshop_artifacts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id    uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  artifact_id    uuid NOT NULL REFERENCES evidence_artifacts(id) ON DELETE CASCADE,
  artifact_type  workshop_artifact_type NOT NULL DEFAULT 'other'
);

CREATE TABLE workshop_section_links (
  workshop_id  uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  section_id   uuid NOT NULL REFERENCES policy_sections(id) ON DELETE CASCADE,
  PRIMARY KEY (workshop_id, section_id)
);

CREATE TABLE workshop_feedback_links (
  workshop_id  uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  feedback_id  uuid NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  PRIMARY KEY (workshop_id, feedback_id)
);
