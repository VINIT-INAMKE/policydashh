-- B9: soft-delete support so Clerk `user.deleted` events can anonymize the
-- users row without breaking FK references (feedback, section assignments,
-- workshop registrations, etc.) and freeing the email for re-invite.

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Index used by any "exclude deleted" query paths (currently the webhook
-- handler and any future profile lookups); partial index keeps it tiny.
CREATE INDEX IF NOT EXISTS users_deleted_at_idx
  ON users (deleted_at)
  WHERE deleted_at IS NOT NULL;
