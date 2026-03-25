-- Phase 8: Notifications table + last_visited_at on users
CREATE TYPE notification_type AS ENUM (
  'feedback_status_changed',
  'version_published',
  'section_assigned',
  'cr_status_changed'
);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  entity_type TEXT,
  entity_id   UUID,
  link_href   TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read)
  WHERE is_read = false;

ALTER TABLE users ADD COLUMN last_visited_at TIMESTAMPTZ;
