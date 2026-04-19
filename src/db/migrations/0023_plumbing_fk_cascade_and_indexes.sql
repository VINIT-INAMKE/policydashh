-- P-agent plumbing fixes bundled into a single migration because they all
-- belong to the same review pass and share the same apply-script lifecycle.
--
-- P15: cr_feedback_links.feedback_id and cr_section_links.section_id default
--      to ON DELETE NO ACTION, which blocks feedback/section deletion rather
--      than cascading cleanly. Switch to ON DELETE CASCADE so link rows are
--      cleaned up when the parent feedback or section is removed.
--
-- P16: workshop_feedback_token_nonces.workshop_id is uuid NOT NULL but has
--      no FK constraint, so a workshop deletion leaves orphan nonce rows.
--      Add ON DELETE CASCADE so nonces are cleaned up automatically.
--
-- P27: workshop_registrations(email) is scanned by findWorkshopByCalEventTypeId
--      and the MEETING_ENDED attendee loop. Add an index so lookups stay O(log n).

-- ---- P15: CR link FKs -----------------------------------------------------

ALTER TABLE cr_feedback_links
  DROP CONSTRAINT IF EXISTS cr_feedback_links_feedback_id_feedback_id_fk;
ALTER TABLE cr_feedback_links
  ADD CONSTRAINT cr_feedback_links_feedback_id_feedback_id_fk
  FOREIGN KEY (feedback_id)
  REFERENCES feedback(id)
  ON DELETE CASCADE;

ALTER TABLE cr_section_links
  DROP CONSTRAINT IF EXISTS cr_section_links_section_id_policy_sections_id_fk;
ALTER TABLE cr_section_links
  ADD CONSTRAINT cr_section_links_section_id_policy_sections_id_fk
  FOREIGN KEY (section_id)
  REFERENCES policy_sections(id)
  ON DELETE CASCADE;

-- ---- P16: workshop feedback token nonces FK -------------------------------

ALTER TABLE workshop_feedback_token_nonces
  DROP CONSTRAINT IF EXISTS workshop_feedback_token_nonces_workshop_id_workshops_id_fk;
ALTER TABLE workshop_feedback_token_nonces
  ADD CONSTRAINT workshop_feedback_token_nonces_workshop_id_workshops_id_fk
  FOREIGN KEY (workshop_id)
  REFERENCES workshops(id)
  ON DELETE CASCADE;

-- ---- P27: workshop_registrations email index ------------------------------

CREATE INDEX IF NOT EXISTS idx_workshop_registrations_email
  ON workshop_registrations (email);

-- ---- P30: notifications.email_sent_at for dispatch idempotency ------------
-- Ensures the send-email step in notificationDispatchFn can skip re-sending
-- when the notification row has already had its email delivered. Combined
-- with the per-function concurrency limit, this eliminates duplicate emails
-- during Inngest retries.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;
