import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'

// Cal.com webhook replay protection (M2). See migration 0031.
//
// Insert with `.onConflictDoNothing()` keyed on event_id. If RETURNING comes
// back empty, the event was already processed; the handler returns 200
// without rerunning side effects.
export const processedWebhookEvents = pgTable(
  'processed_webhook_events',
  {
    eventId:      text('event_id').primaryKey(),
    triggerEvent: text('trigger_event').notNull(),
    receivedAt:   timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('processed_webhook_events_received_at_idx').on(t.receivedAt),
  ],
)
