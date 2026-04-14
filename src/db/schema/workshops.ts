import { pgTable, uuid, text, timestamp, integer, pgEnum, primaryKey, uniqueIndex } from 'drizzle-orm/pg-core'
import { users } from './users'
import { policySections } from './documents'
import { feedbackItems } from './feedback'
import { evidenceArtifacts } from './evidence'

export const workshopArtifactTypeEnum = pgEnum('workshop_artifact_type', [
  'promo', 'recording', 'summary', 'attendance', 'other',
])

export const workshopStatusEnum = pgEnum('workshop_status', [
  'upcoming', 'in_progress', 'completed', 'archived',
])

export const checklistSlotEnum = pgEnum('checklist_slot', [
  'registration_export', 'screenshot', 'recording', 'attendance', 'summary',
])

export const checklistSlotStatusEnum = pgEnum('checklist_slot_status', ['empty', 'filled'])

export const artifactReviewStatusEnum = pgEnum('artifact_review_status', ['draft', 'approved'])

export const workshops = pgTable('workshops', {
  id:               uuid('id').primaryKey().defaultRandom(),
  title:            text('title').notNull(),
  description:      text('description'),
  scheduledAt:      timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMinutes:  integer('duration_minutes'),
  registrationLink: text('registration_link'),
  status:           workshopStatusEnum('status').notNull().default('upcoming'),
  createdBy:        uuid('created_by').notNull().references(() => users.id),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const workshopArtifacts = pgTable('workshop_artifacts', {
  id:           uuid('id').primaryKey().defaultRandom(),
  workshopId:   uuid('workshop_id').notNull().references(() => workshops.id, { onDelete: 'cascade' }),
  artifactId:   uuid('artifact_id').notNull().references(() => evidenceArtifacts.id, { onDelete: 'cascade' }),
  artifactType: workshopArtifactTypeEnum('artifact_type').notNull().default('other'),
  reviewStatus: artifactReviewStatusEnum('review_status').notNull().default('approved'),
})

export const workshopSectionLinks = pgTable('workshop_section_links', {
  workshopId: uuid('workshop_id').notNull().references(() => workshops.id, { onDelete: 'cascade' }),
  sectionId:  uuid('section_id').notNull().references(() => policySections.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.workshopId, table.sectionId] }),
])

export const workshopFeedbackLinks = pgTable('workshop_feedback_links', {
  workshopId: uuid('workshop_id').notNull().references(() => workshops.id, { onDelete: 'cascade' }),
  feedbackId: uuid('feedback_id').notNull().references(() => feedbackItems.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.workshopId, table.feedbackId] }),
])

export const workshopEvidenceChecklist = pgTable('workshop_evidence_checklist', {
  id:          uuid('id').primaryKey().defaultRandom(),
  workshopId:  uuid('workshop_id').notNull().references(() => workshops.id, { onDelete: 'cascade' }),
  slot:        checklistSlotEnum('slot').notNull(),
  status:      checklistSlotStatusEnum('status').notNull().default('empty'),
  artifactId:  uuid('artifact_id').references(() => evidenceArtifacts.id, { onDelete: 'set null' }),
  filledAt:    timestamp('filled_at', { withTimezone: true }),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('workshop_evidence_checklist_uniq').on(t.workshopId, t.slot),
])
