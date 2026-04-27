-- Booking system robustness pass (audit findings, 2026-04-27).
--
-- 1. Partial unique index on workshop_registrations to prevent the
--    "double-click" oversell mode. Two concurrent register POSTs from the
--    same email both pass the count gate; only the first INSERT wins, the
--    second hits 23505 and the route maps to 409. Cancelled rows are
--    excluded from uniqueness so a stakeholder who cancelled and re-
--    registers is allowed.
--
-- 2. Workshops gain a `completion_pipeline_sent_at` column so the cal.com
--    webhook MEETING_ENDED handler can re-fire the post-completion fan-out
--    (sendWorkshopCompleted → evidence-nudge emails, feedback-invite batch)
--    after a transient Inngest send failure WITHOUT re-firing on every
--    redelivery once the pipeline ran. Today the dispatch is gated by
--    `status === 'completed'`, which short-circuits the entire branch and
--    drops the pipeline permanently if Inngest send fails post-status-flip.

CREATE UNIQUE INDEX IF NOT EXISTS workshop_registrations_unique_email_per_workshop
  ON workshop_registrations (workshop_id, email_hash)
  WHERE status != 'cancelled';

ALTER TABLE workshops
  ADD COLUMN IF NOT EXISTS completion_pipeline_sent_at timestamptz;
