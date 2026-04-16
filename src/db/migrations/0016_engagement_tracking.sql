-- Phase 24: UX-08 — lastActivityAt mutation tracking
-- UX-09, UX-10, UX-11 — admin engagement visibility

-- Add lastActivityAt; no NOT NULL yet to allow backfill
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;

-- Backfill: all existing users default to their created_at (D-09)
-- No user starts with NULL
UPDATE users SET last_activity_at = created_at WHERE last_activity_at IS NULL;

-- Now safe to add NOT NULL constraint
ALTER TABLE users ALTER COLUMN last_activity_at SET NOT NULL;
ALTER TABLE users ALTER COLUMN last_activity_at SET DEFAULT now();
