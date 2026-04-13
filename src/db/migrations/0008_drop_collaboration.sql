-- 0008_drop_collaboration.sql
-- Phase 14: Collab Rollback — remove Yjs persistence and inline comment tables
-- Drop order matters: comment_replies has FK → comment_threads, so replies first.
DROP TABLE IF EXISTS comment_replies CASCADE;
DROP TABLE IF EXISTS comment_threads CASCADE;
DROP TABLE IF EXISTS ydoc_snapshots CASCADE;
