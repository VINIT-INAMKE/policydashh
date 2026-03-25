import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core'
import { users } from './users'
import { policySections } from './documents'

export const sectionAssignments = pgTable('section_assignments', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sectionId:  uuid('section_id').notNull().references(() => policySections.id, { onDelete: 'cascade' }),
  assignedBy: uuid('assigned_by').notNull().references(() => users.id),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('section_assignments_user_section_unique').on(table.userId, table.sectionId),
])
