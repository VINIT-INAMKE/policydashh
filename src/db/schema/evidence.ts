import { pgTable, uuid, text, timestamp, integer, pgEnum, primaryKey } from 'drizzle-orm/pg-core'
import { users } from './users'
import { feedbackItems } from './feedback'
import { policySections } from './documents'

export const evidenceTypeEnum = pgEnum('evidence_type', ['file', 'link'])

export const evidenceArtifacts = pgTable('evidence_artifacts', {
  id:         uuid('id').primaryKey().defaultRandom(),
  title:      text('title').notNull(),
  type:       evidenceTypeEnum('type').notNull(),
  url:        text('url').notNull(),
  fileName:   text('file_name'),
  fileSize:   integer('file_size'),
  uploaderId: uuid('uploader_id').notNull().references(() => users.id),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const feedbackEvidence = pgTable('feedback_evidence', {
  feedbackId: uuid('feedback_id').notNull().references(() => feedbackItems.id, { onDelete: 'cascade' }),
  artifactId: uuid('artifact_id').notNull().references(() => evidenceArtifacts.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.feedbackId, table.artifactId] }),
])

export const sectionEvidence = pgTable('section_evidence', {
  sectionId:  uuid('section_id').notNull().references(() => policySections.id, { onDelete: 'cascade' }),
  artifactId: uuid('artifact_id').notNull().references(() => evidenceArtifacts.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.sectionId, table.artifactId] }),
])
