-- Phase 23: Cardano preview-net anchoring columns
-- txHash stores the 64-char hex Cardano transaction hash
-- anchoredAt records when the tx was confirmed on-chain

ALTER TABLE milestones ADD COLUMN IF NOT EXISTS tx_hash text;
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS anchored_at timestamptz;

ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS tx_hash text;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS anchored_at timestamptz;

-- txHash format check (64 lowercase hex chars) on milestones
-- (documentVersions uses same format but shares the pattern via application code)
DO $$ BEGIN
  ALTER TABLE milestones ADD CONSTRAINT chk_tx_hash_hex_format
    CHECK (tx_hash IS NULL OR tx_hash ~ '^[0-9a-f]{64}$');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- UNIQUE constraints for VERIFY-08 idempotency layer 1
DO $$ BEGIN
  ALTER TABLE milestones ADD CONSTRAINT milestones_tx_hash_unique UNIQUE (tx_hash);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE document_versions ADD CONSTRAINT document_versions_tx_hash_unique UNIQUE (tx_hash);
EXCEPTION WHEN duplicate_object THEN null; END $$;
