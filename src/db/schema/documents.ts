import { pgTable, uuid, text, timestamp, integer, jsonb, boolean } from 'drizzle-orm/pg-core'

export const policyDocuments = pgTable('policy_documents', {
  id:          uuid('id').primaryKey().defaultRandom(),
  title:       text('title').notNull(),
  description: text('description'),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  isPublicDraft: boolean('is_public_draft').notNull().default(false),
})

export const policySections = pgTable('policy_sections', {
  id:          uuid('id').primaryKey().defaultRandom(),
  documentId:  uuid('document_id').notNull().references(() => policyDocuments.id, { onDelete: 'cascade' }),
  title:       text('title').notNull(),
  orderIndex:  integer('order_index').notNull(),
  content:     jsonb('content').$type<Record<string, unknown>>().notNull().default({}),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
