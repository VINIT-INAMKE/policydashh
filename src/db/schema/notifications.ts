import { pgTable, uuid, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users'

export const notifTypeEnum = pgEnum('notification_type', [
  'feedback_status_changed',
  'version_published',
  'section_assigned',
  'cr_status_changed',
  // P24: added by migration 0024 so Cardano anchor-failure notifications
  // stop being mislabeled as cr_status_changed.
  'anchoring_failed',
])

export const notifications = pgTable('notifications', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:       notifTypeEnum('type').notNull(),
  title:      text('title').notNull(),
  body:       text('body'),
  entityType: text('entity_type'),   // e.g. 'feedback', 'cr', 'version'
  entityId:   uuid('entity_id'),     // linked record UUID
  linkHref:   text('link_href'),     // deep link for click-through
  isRead:     boolean('is_read').notNull().default(false),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // NOTIF-06: idempotency key for dual-write guard during notification dispatch
  // migration. Mirrors the partial unique index in migration 0009 - only
  // non-null values participate in uniqueness, so legacy createNotification
  // callsites (which leave this NULL) are unaffected during the transition.
  idempotencyKey: text('idempotency_key').unique(),
  // P30: stamped by notificationDispatchFn's send-email step on successful
  // delivery. On Inngest retry the step re-reads this column and skips the
  // email send when it's already set, eliminating duplicate emails if the
  // step fails after a successful Resend response but before returning.
  emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
})
