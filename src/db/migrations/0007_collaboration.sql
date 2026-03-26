-- 0007_collaboration.sql
-- Real-time collaboration: Y.Doc persistence and inline comment threads

CREATE TABLE ydoc_snapshots (
  section_id  uuid PRIMARY KEY REFERENCES policy_sections(id) ON DELETE CASCADE,
  ydoc_binary bytea NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE comment_threads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id  uuid NOT NULL REFERENCES policy_sections(id) ON DELETE CASCADE,
  comment_id  uuid NOT NULL UNIQUE,
  author_id   text NOT NULL,
  body        text NOT NULL,
  resolved    boolean NOT NULL DEFAULT false,
  orphaned    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comment_threads_section ON comment_threads(section_id);
CREATE INDEX idx_comment_threads_author ON comment_threads(author_id);

CREATE TABLE comment_replies (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  uuid NOT NULL REFERENCES comment_threads(id) ON DELETE CASCADE,
  author_id  text NOT NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_comment_replies_thread ON comment_replies(thread_id);
