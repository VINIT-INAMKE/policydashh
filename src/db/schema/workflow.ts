import { pgTable, uuid, timestamp, text, jsonb } from 'drizzle-orm/pg-core'

// Stub table for Phase 4+ state machine transitions.
// XState 5 will write state transitions here when feedback/CR workflows ship.
//
// Migration 0029 tightened actor_id from text to uuid so the leftJoin with
// users.id in {research,feedback,changeRequest}.listTransitions works at
// all. Any actor passed to appendWorkflowTransition must be a user UUID.
export const workflowTransitions = pgTable('workflow_transitions', {
  id:          uuid('id').primaryKey().defaultRandom(),
  entityType:  text('entity_type').notNull(),
  entityId:    uuid('entity_id').notNull(),
  fromState:   text('from_state'),
  toState:     text('to_state').notNull(),
  actorId:     uuid('actor_id').notNull(),
  timestamp:   timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  metadata:    jsonb('metadata').$type<Record<string, unknown>>(),
})
