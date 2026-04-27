-- src/db/migrations/0032_workshops_google_calendar.sql
-- Google Calendar pivot. Drops cal.com columns, adds Google event id +
-- meeting provisioning columns, promotes meetingUrl to NOT NULL, adds
-- inviteSentAt to workshop_registrations.
--
-- Pre-condition (verified on preview-net 2026-04-28): zero workshop rows
-- exist. Migration is destructive on calcom_event_type_id / calcom_booking_uid
-- columns; safe because no production data depends on them.

-- 1. Drop cal.com columns + their partial index from migration 0027
DROP INDEX IF EXISTS workshops_calcom_booking_uid_idx;
ALTER TABLE workshops DROP COLUMN IF EXISTS calcom_event_type_id;
ALTER TABLE workshops DROP COLUMN IF EXISTS calcom_booking_uid;

-- 2. Add Google Calendar columns (NOT NULL with provisional default for any
--    existing rows; default dropped at end so future inserts must supply value)
ALTER TABLE workshops
  ADD COLUMN google_calendar_event_id text NOT NULL DEFAULT '',
  ADD COLUMN meeting_provisioned_by text NOT NULL DEFAULT 'manual';

-- 3. Promote meeting_url to NOT NULL with provisional empty default
UPDATE workshops SET meeting_url = '' WHERE meeting_url IS NULL;
ALTER TABLE workshops ALTER COLUMN meeting_url SET NOT NULL;
ALTER TABLE workshops ALTER COLUMN meeting_url SET DEFAULT '';

-- 4. Drop the provisional defaults (next inserts must supply real values)
ALTER TABLE workshops ALTER COLUMN google_calendar_event_id DROP DEFAULT;
ALTER TABLE workshops ALTER COLUMN meeting_provisioned_by DROP DEFAULT;
ALTER TABLE workshops ALTER COLUMN meeting_url DROP DEFAULT;

-- 5. Add CHECK to constrain meeting_provisioned_by enum-like
ALTER TABLE workshops ADD CONSTRAINT workshops_meeting_provisioned_by_check
  CHECK (meeting_provisioned_by IN ('google_meet', 'manual'));

-- 6. workshop_registrations.invite_sent_at — NULL means invite send failed
ALTER TABLE workshop_registrations ADD COLUMN invite_sent_at timestamptz;
