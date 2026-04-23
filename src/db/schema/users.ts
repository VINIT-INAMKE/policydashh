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
  // Option C profile enrichment (migration 0028): the /participate form
  // collects these four fields, Clerk stashes them on publicMetadata, and
  // the webhook now hydrates them onto the row. Surfaced on /users/[id],
  // /profile, and /stakeholders. All nullable because legacy rows pre-date
  // the webhook change and because the participate flow is the only writer.
  designation: text('designation'),        // e.g. "Partner, Fintech Practice"
  orgName:     text('org_name'),           // e.g. "Ministry of Electronics and IT"
  expertise:   text('expertise'),          // long-form bio (matches participate form's 20-1000 char range)
  howHeard:    text('how_heard'),          // acquisition channel (social / newsletter / …)
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
