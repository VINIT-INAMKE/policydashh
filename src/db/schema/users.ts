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
  email:     text('email'),          // Email from Clerk (primary auth method)
  phone:     text('phone'),          // Optional phone if user adds one later in Clerk
  name:      text('name'),           // Display name from Clerk profile
  role:      roleEnum('role').notNull().default('stakeholder'),
  orgType:   orgTypeEnum('org_type'),   // nullable until user sets profile
  lastVisitedAt: timestamp('last_visited_at', { withTimezone: true }),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
  // B9: set when Clerk signals `user.deleted`. Row is anonymized at the same
  // time (email nulled, name wiped, clerkId rewritten to a deleted-sentinel) so
  // the original email is free to be invited again. FK references (feedback,
  // sections, etc.) stay intact so audit trails remain queryable.
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
