-- Option C user-profile enrichment: persist the intake fields that the
-- /participate form already collects (designation, org_name, expertise,
-- how_heard) so they stop dying in Clerk publicMetadata and can power the
-- admin profile, self-service /profile, and /stakeholders directory.
--
-- All columns are nullable — existing users pre-dating this migration
-- (webhook-created or seeded) will have NULL values, which the UI renders
-- as "Not set yet" / hidden.
--
-- Index on org_type is added so /stakeholders can filter efficiently.

ALTER TABLE users ADD COLUMN IF NOT EXISTS designation text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS expertise text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS how_heard text;

-- Partial index for stakeholder directory queries — only rows that are
-- non-deleted stakeholders with a set orgType are eligible for listing, so
-- the index matches the exact WHERE clause /stakeholders will use.
CREATE INDEX IF NOT EXISTS users_stakeholder_directory_idx
  ON users (org_type)
  WHERE deleted_at IS NULL AND role = 'stakeholder' AND org_type IS NOT NULL;
