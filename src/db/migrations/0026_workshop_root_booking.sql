-- Phase workshop-meetings-redesign (2026-04-21):
-- Workshops now have one root seated cal.com booking created at
-- workshop-creation time, with vinay@konma.io as primary attendee. Public
-- registrants are added as seats on top. Both columns are backfilled
-- asynchronously by workshopCreatedFn, so they must be nullable.

ALTER TABLE workshops
  ADD COLUMN IF NOT EXISTS calcom_booking_uid TEXT,
  ADD COLUMN IF NOT EXISTS meeting_url        TEXT;
