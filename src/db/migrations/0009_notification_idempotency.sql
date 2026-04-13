-- Phase 16: Notification dispatch migration — idempotency key for dual-write guard
-- NOTIF-06: prevents duplicate notifications during transition window when both
-- the legacy createNotification(...) path and the new notificationDispatchFn fire.
ALTER TABLE notifications
  ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX notifications_idempotency_key_unique
  ON notifications (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
