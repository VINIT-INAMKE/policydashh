-- Enums
CREATE TYPE "user_role" AS ENUM ('admin', 'policy_lead', 'research_lead', 'workshop_moderator', 'stakeholder', 'observer', 'auditor');
CREATE TYPE "org_type" AS ENUM ('government', 'industry', 'legal', 'academia', 'civil_society', 'internal');

-- Users table
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clerk_id" text NOT NULL UNIQUE,
  "phone" text,
  "email" text,
  "name" text,
  "role" "user_role" NOT NULL DEFAULT 'stakeholder',
  "org_type" "org_type",
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Audit events table (PARTITIONED)
CREATE TABLE "audit_events" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  "actor_id" text NOT NULL,
  "actor_role" text NOT NULL,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}',
  "ip_address" inet,
  PRIMARY KEY ("id", "timestamp")
) PARTITION BY RANGE ("timestamp");

-- Monthly partitions (create current + next 2 months)
-- TO ADD FUTURE PARTITIONS: Copy and adjust date range
CREATE TABLE audit_events_2026_03 PARTITION OF audit_events
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE audit_events_2026_04 PARTITION OF audit_events
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE audit_events_2026_05 PARTITION OF audit_events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- Immutability rules: prevent UPDATE and DELETE on audit_events
CREATE RULE no_update_audit AS ON UPDATE TO audit_events DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_events DO INSTEAD NOTHING;

-- Indexes for audit queries
CREATE INDEX idx_audit_entity ON audit_events ("entity_type", "entity_id", "timestamp");
CREATE INDEX idx_audit_actor ON audit_events ("actor_id", "timestamp");
CREATE INDEX idx_audit_action ON audit_events ("action", "timestamp");

-- Workflow transitions stub table
CREATE TABLE "workflow_transitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "from_state" text,
  "to_state" text NOT NULL,
  "actor_id" text NOT NULL,
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  "metadata" jsonb
);

-- Index for workflow transition queries
CREATE INDEX idx_workflow_entity ON workflow_transitions ("entity_type", "entity_id", "timestamp");
