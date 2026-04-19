-- F30: add 'transcript' to the workshop_artifact_type enum so the recording
-- pipeline can distinguish the raw transcript from the structured summary
-- artifact. The recording-processed function now labels the transcript row
-- with artifactType='transcript' instead of overloading 'summary'.
--
-- ADD VALUE cannot run inside a transaction block in PostgreSQL, so ensure
-- this migration runs standalone if drizzle-kit wraps migrations in a txn.
ALTER TYPE workshop_artifact_type ADD VALUE IF NOT EXISTS 'transcript';
