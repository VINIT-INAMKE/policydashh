-- Migration 0027 — partial index on workshops.calcom_booking_uid (B6-2)
-- The cal.com webhook cascade branches (BOOKING_CANCELLED and
-- BOOKING_RESCHEDULED) both probe `workshops.calcomBookingUid` on every
-- incoming webhook. Without an index this is a full-table scan per
-- cascade; the partial index excludes workshops still unprovisioned
-- (NULL) from the B-tree, keeping it small.

CREATE INDEX IF NOT EXISTS workshops_calcom_booking_uid_idx
  ON workshops(calcom_booking_uid)
  WHERE calcom_booking_uid IS NOT NULL;
