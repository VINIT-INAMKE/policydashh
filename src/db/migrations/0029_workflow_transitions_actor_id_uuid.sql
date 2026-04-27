-- Tighten workflow_transitions.actor_id from text to uuid.
--
-- Root cause (production 500s on /api/trpc/{research,feedback,changeRequest}
-- .listTransitions, 2026-04-23): each of those procedures does
--   leftJoin(users, eq(workflowTransitions.actorId, users.id))
-- which emits `workflow_transitions.actor_id = users.id` as SQL. With
-- actor_id as `text` and users.id as `uuid`, Postgres rejects the JOIN:
--   ERROR: operator does not exist: text = uuid
--
-- Every value currently stored in actor_id is a user UUID (verified via
-- data audit before this migration; 9/9 rows match ^[0-9a-f]{8}-...
-- shape). Tightening the column type makes the join work without any
-- query-level cast and prevents the loose-type bug from reappearing.

ALTER TABLE workflow_transitions
  ALTER COLUMN actor_id TYPE uuid USING actor_id::uuid;
