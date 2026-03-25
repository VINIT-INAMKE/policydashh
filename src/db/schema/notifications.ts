import { pgTable, uuid, text, timestamp, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users'

export const notifTypeEnum = pgEnum('notification_type', [
  'feedback_status_changed',
  'version_published',
  'section_assigned',
  'cr_status_changed',
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
})
