-- Cal.com webhook replay protection (audit M2).
--
-- HMAC verifies authenticity but not freshness — captured signatures are
-- valid forever. A leaked or replayed payload would re-trigger seat
-- cancellation / reschedule / completion pipeline branches. We dedup by
-- a deterministic event id derived from the payload (booking uid +
-- triggerEvent + startTime) and keep the row for ~7 days; redelivery
-- inside that window is a no-op 200.
--
-- Eviction is intentionally lazy: a future cron job runs
-- `DELETE FROM processed_webhook_events WHERE received_at < now() - interval '7 days'`
-- when the table grows large enough to matter. With ~few-hundred events
-- per workshop per day, the table stays small for the lifetime of this
-- consultation and the cron can wait.

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  event_id      text        PRIMARY KEY,
  trigger_event text        NOT NULL,
  received_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS processed_webhook_events_received_at_idx
  ON processed_webhook_events (received_at);
