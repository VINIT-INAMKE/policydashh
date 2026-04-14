-- Phase 20.5: isPublicDraft flag on policy_documents
-- PUB-07 — filters public draft consultation surface

ALTER TABLE policy_documents ADD COLUMN IF NOT EXISTS is_public_draft boolean NOT NULL DEFAULT false;
