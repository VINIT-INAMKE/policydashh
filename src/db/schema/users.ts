import { pgTable, uuid, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('user_role', [
  'admin', 'policy_lead', 'research_lead', 'workshop_moderator',
  'stakeholder', 'observer', 'auditor'
])

export const orgTypeEnum = pgEnum('org_type', [
  'government', 'industry', 'legal', 'academia', 'civil_society', 'internal'
])

export const users = pgTable('users', {
  id:        uuid('id').primaryKey().defaultRandom(),
  clerkId:   text('clerk_id').notNull().unique(),
  phone:     text('phone'),          // Phone number from Clerk (primary auth method)
  email:     text('email'),          // Optional email if user adds one later in Clerk
  name:      text('name'),           // Display name from Clerk profile
  role:      roleEnum('role').notNull().default('stakeholder'),
  orgType:   orgTypeEnum('org_type'),   // nullable until user sets profile
  lastVisitedAt: timestamp('last_visited_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
