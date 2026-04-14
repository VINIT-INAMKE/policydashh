-- Phase 20: cal.com workshop register
-- WS-07, WS-10, WS-11, WS-15

-- Enums (idempotent create)
DO $$ BEGIN
  CREATE TYPE registration_status AS ENUM ('registered', 'cancelled', 'rescheduled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_source AS ENUM ('cal_meeting_ended', 'manual');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE feedback_source AS ENUM ('intake', 'workshop');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- workshops: new columns (D-01 cal.com event-type id, D-07 per-workshop capacity)
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS calcom_event_type_id text;
ALTER TABLE workshops ADD COLUMN IF NOT EXISTS max_seats integer;

-- feedback: new source column (D-18, WS-15 — distinguishes intake vs workshop feedback)
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS source feedback_source;

-- workshop_registrations table (D-09, WS-10)
CREATE TABLE IF NOT EXISTS workshop_registrations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id        uuid NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  booking_uid        text NOT NULL,
  email              text NOT NULL,
  email_hash         text NOT NULL,
  name               text,
  user_id            uuid REFERENCES users(id) ON DELETE SET NULL,
  status             registration_status NOT NULL DEFAULT 'registered',
  cancelled_at       timestamptz,
  attended_at        timestamptz,
  attendance_source  attendance_source,
  booking_start_time timestamptz NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Unique on booking_uid so BOOKING_CREATED webhook can INSERT ... ON CONFLICT DO NOTHING
-- for idempotent handling of cal.com webhook retries (D-15).
CREATE UNIQUE INDEX IF NOT EXISTS workshop_registrations_booking_uid_uniq
  ON workshop_registrations (booking_uid);
