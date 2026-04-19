-- P24: extend the notification_type enum with 'anchoring_failed'.
--
-- Milestone and version Cardano anchor-failure notifications previously
-- reused 'cr_status_changed' which confused the in-app notifications UI
-- (the anchor failure rendered with a change-request icon). A dedicated
-- enum value lets the dispatch helpers + UI distinguish anchor failures.
--
-- Postgres enum alteration: ALTER TYPE ... ADD VALUE IF NOT EXISTS. Must
-- run outside a transaction per PG docs but the neon-http driver executes
-- each statement autonomously, so this is effectively already isolated.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'anchoring_failed';
