-- ============================================================================
-- post-drizzle-push-gaps.sql
--
-- Run AFTER `npx drizzle-kit push` against an empty DB.
-- Contains DDL that drizzle-kit push won't generate from src/db/schema/*:
--   1. audit_events partitioning (drizzle creates it as a regular table —
--      we drop and recreate as PARTITION BY RANGE + 24 monthly partitions
--      + immutability rules + indexes)
--   2. plpgsql function audit_events_create_partition (0022)
--   3. Sequences: feedback_id_seq, cr_id_seq, research_item_id_seq (none in schema)
--   4. CHECK constraints on milestones (chk_content_hash_format, chk_tx_hash_hex_format)
--   5. UNIQUE INDEX on workshop_registrations.booking_uid (0011)
--
-- Idempotent: every block uses IF NOT EXISTS or DO/EXCEPTION blocks so it can
-- be re-run safely.
-- ============================================================================

-- 1. audit_events partitioning rebuild ---------------------------------------
DROP TABLE IF EXISTS audit_events CASCADE;

CREATE TABLE audit_events (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  timestamp    timestamptz NOT NULL DEFAULT now(),
  actor_id     text NOT NULL,
  actor_role   text NOT NULL,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    text NOT NULL,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address   inet,
  PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Monthly partitions: 2026-03 → 2027-12 (22 partitions)
CREATE TABLE IF NOT EXISTS audit_events_2026_03 PARTITION OF audit_events FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE IF NOT EXISTS audit_events_2026_04 PARTITION OF audit_events FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS audit_events_2026_05 PARTITION OF audit_events FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS audit_events_2026_06 PARTITION OF audit_events FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS audit_events_2026_07 PARTITION OF audit_events FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS audit_events_2026_08 PARTITION OF audit_events FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS audit_events_2026_09 PARTITION OF audit_events FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS audit_events_2026_10 PARTITION OF audit_events FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS audit_events_2026_11 PARTITION OF audit_events FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS audit_events_2026_12 PARTITION OF audit_events FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_01 PARTITION OF audit_events FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_02 PARTITION OF audit_events FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_03 PARTITION OF audit_events FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_04 PARTITION OF audit_events FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_05 PARTITION OF audit_events FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_06 PARTITION OF audit_events FOR VALUES FROM ('2027-06-01') TO ('2027-07-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_07 PARTITION OF audit_events FOR VALUES FROM ('2027-07-01') TO ('2027-08-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_08 PARTITION OF audit_events FOR VALUES FROM ('2027-08-01') TO ('2027-09-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_09 PARTITION OF audit_events FOR VALUES FROM ('2027-09-01') TO ('2027-10-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_10 PARTITION OF audit_events FOR VALUES FROM ('2027-10-01') TO ('2027-11-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_11 PARTITION OF audit_events FOR VALUES FROM ('2027-11-01') TO ('2027-12-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_12 PARTITION OF audit_events FOR VALUES FROM ('2027-12-01') TO ('2028-01-01');

-- Immutability rules (no UPDATE / DELETE)
DO $$ BEGIN
  CREATE RULE no_update_audit AS ON UPDATE TO audit_events DO INSTEAD NOTHING;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE RULE no_delete_audit AS ON DELETE TO audit_events DO INSTEAD NOTHING;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events (entity_type, entity_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_events (actor_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events (action, timestamp);

-- 2. audit_events_create_partition() helper function (0022) -------------------
CREATE OR REPLACE FUNCTION audit_events_create_partition(p_month_start DATE)
RETURNS VOID AS $$
DECLARE
  v_start DATE := date_trunc('month', p_month_start)::date;
  v_end   DATE := (v_start + INTERVAL '1 month')::date;
  v_name  TEXT := 'audit_events_' || to_char(v_start, 'YYYY_MM');
  v_sql   TEXT;
BEGIN
  v_sql := format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_events FOR VALUES FROM (%L) TO (%L);',
    v_name, v_start, v_end
  );
  EXECUTE v_sql;
END;
$$ LANGUAGE plpgsql;

-- 3. Sequences (used by router code via nextval()) ---------------------------
CREATE SEQUENCE IF NOT EXISTS feedback_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS cr_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS research_item_id_seq START 1;

-- 4. CHECK constraints on milestones (0014, 0015) ----------------------------
DO $$ BEGIN
  ALTER TABLE milestones
    ADD CONSTRAINT chk_content_hash_format
    CHECK (content_hash IS NULL OR content_hash ~ '^[0-9a-f]{64}$');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE milestones
    ADD CONSTRAINT chk_tx_hash_hex_format
    CHECK (tx_hash IS NULL OR tx_hash ~ '^[0-9a-f]{64}$');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 5. workshop_registrations UNIQUE INDEX on booking_uid (0011) ---------------
CREATE UNIQUE INDEX IF NOT EXISTS workshop_registrations_booking_uid_uniq
  ON workshop_registrations (booking_uid);
