-- P1 (URGENT): audit_events partition coverage extension.
--
-- The initial migration (0000_initial.sql lines 34-39) only created monthly
-- partitions through 2026-05-31. From 2026-06-01 onward every writeAuditLog()
-- call would throw `ERROR: no partition of relation "audit_events" found for
-- row`, silently swallowing audit writes or cascading as a 500.
--
-- This migration creates monthly partitions from 2026-06 through 2027-12
-- inclusive (19 months). IF NOT EXISTS is used so a partial re-run is safe.
--
-- TO EXTEND FURTHER: at least once per year copy the CREATE TABLE lines and
-- bump the dates. Or run the `audit_events_create_partition` function below
-- from a cron/pg_cron job on the first of each month.
-- REMINDER: add 2028_* partitions before 2027-12-01.

CREATE TABLE IF NOT EXISTS audit_events_2026_06 PARTITION OF audit_events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS audit_events_2026_07 PARTITION OF audit_events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS audit_events_2026_08 PARTITION OF audit_events
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS audit_events_2026_09 PARTITION OF audit_events
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS audit_events_2026_10 PARTITION OF audit_events
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS audit_events_2026_11 PARTITION OF audit_events
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS audit_events_2026_12 PARTITION OF audit_events
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE TABLE IF NOT EXISTS audit_events_2027_01 PARTITION OF audit_events
  FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_02 PARTITION OF audit_events
  FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_03 PARTITION OF audit_events
  FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_04 PARTITION OF audit_events
  FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_05 PARTITION OF audit_events
  FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_06 PARTITION OF audit_events
  FOR VALUES FROM ('2027-06-01') TO ('2027-07-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_07 PARTITION OF audit_events
  FOR VALUES FROM ('2027-07-01') TO ('2027-08-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_08 PARTITION OF audit_events
  FOR VALUES FROM ('2027-08-01') TO ('2027-09-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_09 PARTITION OF audit_events
  FOR VALUES FROM ('2027-09-01') TO ('2027-10-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_10 PARTITION OF audit_events
  FOR VALUES FROM ('2027-10-01') TO ('2027-11-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_11 PARTITION OF audit_events
  FOR VALUES FROM ('2027-11-01') TO ('2027-12-01');
CREATE TABLE IF NOT EXISTS audit_events_2027_12 PARTITION OF audit_events
  FOR VALUES FROM ('2027-12-01') TO ('2028-01-01');

-- Helper function: create next-month partition if absent. Can be called
-- monthly via pg_cron or an external cron invoking psql. Safe to re-invoke.
-- Example invocation:
--   SELECT audit_events_create_partition(date_trunc('month', now() + interval '1 month')::date);
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
