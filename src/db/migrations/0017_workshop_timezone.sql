-- F9: per-workshop timezone. Replaces the hardcoded 'Asia/Kolkata' used for
-- cal.com booking attendee timeZone and for rendering scheduledAt in emails.
-- Default mirrors the prior hardcoded value so existing rows stay correct.

ALTER TABLE workshops
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata';
