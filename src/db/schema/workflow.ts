import { pgTable, uuid, timestamp, text, jsonb } from 'drizzle-orm/pg-core'

// Stub table for Phase 4+ state machine transitions.
// XState 5 will write state transitions here when feedback/CR workflows ship.
export const workflowTransitions = pgTable('workflow_transitions', {
  id:          uuid('id').primaryKey().defaultRandom(),
  entityType:  text('entity_type').notNull(),
  entityId:    uuid('entity_id').notNull(),
  fromState:   text('from_state'),
  toState:     text('to_state').notNull(),
  actorId:     text('actor_id').notNull(),
  timestamp:   timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  metadata:    jsonb('metadata').$type<Record<string, unknown>>(),
})
