-- Phase 17: Workshop lifecycle state machine + evidence checklist + artifact review status
-- WS-06: workshops.status enum with audited transitions
-- WS-13: workshop_evidence_checklist table with 5 required slots
-- WS-14: workshop_artifacts.review_status + evidence_artifacts.content for LLM drafts

-- Status enum for workshop lifecycle
CREATE TYPE workshop_status AS ENUM ('upcoming', 'in_progress', 'completed', 'archived');

-- Status column on workshops. Defaults to 'upcoming' for existing rows and new inserts.
ALTER TABLE workshops
  ADD COLUMN status workshop_status NOT NULL DEFAULT 'upcoming';

-- Evidence checklist slot enums
CREATE TYPE checklist_slot AS ENUM (
  'registration_export',
  'screenshot',
  'recording',
  'attendance',
  'summary'
);

CREATE TYPE checklist_slot_status AS ENUM ('empty', 'filled');

-- Evidence checklist table — tracks required artifact slots per workshop
CREATE TABLE workshop_evidence_checklist (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id  UUID NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  slot         checklist_slot NOT NULL,
  status       checklist_slot_status NOT NULL DEFAULT 'empty',
  artifact_id  UUID REFERENCES evidence_artifacts(id) ON DELETE SET NULL,
  filled_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workshop_id, slot)
);

-- Artifact review status enum (draft for LLM output, approved for everything else)
CREATE TYPE artifact_review_status AS ENUM ('draft', 'approved');

-- Add review_status to workshop_artifacts. Default 'approved' so existing artifacts keep their visibility.
-- Only LLM-generated transcripts/summaries will be inserted with 'draft'.
ALTER TABLE workshop_artifacts
  ADD COLUMN review_status artifact_review_status NOT NULL DEFAULT 'approved';

-- Nullable content column on evidence_artifacts for LLM-generated text storage.
-- Transcripts and summaries are stored here rather than as R2 files for Phase 17.
-- RESEARCH Pitfall 4: do not overload evidence_artifacts.url with text content.
ALTER TABLE evidence_artifacts
  ADD COLUMN content TEXT;
