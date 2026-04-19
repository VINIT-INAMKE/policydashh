-- B13: one-time-use enforcement for workshop feedback JWTs.
-- Keyed on SHA-256(token) so the raw token never touches the DB. On each
-- submission /api/intake/workshop-feedback inserts the hash; subsequent
-- submissions carrying the same token are rejected 401 at read-time.

CREATE TABLE IF NOT EXISTS workshop_feedback_token_nonces (
  token_hash  TEXT PRIMARY KEY,
  workshop_id UUID NOT NULL,
  used_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wft_nonces_workshop_idx
  ON workshop_feedback_token_nonces (workshop_id);
