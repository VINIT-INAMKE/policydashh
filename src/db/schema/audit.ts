import { pgTable, uuid, timestamp, text, jsonb, inet } from 'drizzle-orm/pg-core'

// NOTE: This table is PARTITIONED BY RANGE (timestamp) in the migration.
// Drizzle ORM cannot express partition DDL, so the migration file contains
// raw SQL for partition creation and immutability rules.
// See: src/db/migrations/0000_initial.sql
export const auditEvents = pgTable('audit_events', {
  id:          uuid('id').primaryKey().defaultRandom(),
  timestamp:   timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  actorId:     text('actor_id').notNull(),
  actorRole:   text('actor_role').notNull(),
  action:      text('action').notNull(),
  entityType:  text('entity_type').notNull(),
  entityId:    text('entity_id').notNull(),
  payload:     jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  ipAddress:   inet('ip_address'),
})
