-- src/db/migrations/0033_drop_processed_webhook_events.sql
-- The cal.com webhook handler is being deleted in this pivot, taking the
-- replay-protection table with it.
DROP TABLE IF EXISTS processed_webhook_events;
