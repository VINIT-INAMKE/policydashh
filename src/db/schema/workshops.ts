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

// Phase 20 — cal.com workshop registration lifecycle
export const registrationStatusEnum = pgEnum('registration_status', [
  'registered', 'cancelled', 'rescheduled',
])

export const attendanceSourceEnum = pgEnum('attendance_source', [
  'cal_meeting_ended', 'manual',
])

export const workshops = pgTable('workshops', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  title:               text('title').notNull(),
  description:         text('description'),
  scheduledAt:         timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMinutes:     integer('duration_minutes'),
  registrationLink:    text('registration_link'),
  status:              workshopStatusEnum('status').notNull().default('upcoming'),
  calcomEventTypeId:   text('calcom_event_type_id'),
  maxSeats:            integer('max_seats'),
  createdBy:           uuid('created_by').notNull().references(() => users.id),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  milestoneId:         uuid('milestone_id'),  // FK to milestones — constraint in SQL migration only (avoids circular import)
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

// Phase 20 — cal.com-driven workshop registrations. One row per cal.com booking
// (unique on bookingUid) plus synthetic walk-in rows created when MEETING_ENDED
// reports an attendee email with no prior booking. Attendance is surfaced via
// `attendedAt IS NOT NULL` — no separate attendance table (D-10).
export const workshopRegistrations = pgTable('workshop_registrations', {
  id:               uuid('id').primaryKey().defaultRandom(),
  workshopId:       uuid('workshop_id').notNull().references(() => workshops.id, { onDelete: 'cascade' }),
  bookingUid:       text('booking_uid').notNull(),
  email:            text('email').notNull(),
  emailHash:        text('email_hash').notNull(),
  name:             text('name'),
  userId:           uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  status:           registrationStatusEnum('status').notNull().default('registered'),
  cancelledAt:      timestamp('cancelled_at', { withTimezone: true }),
  attendedAt:       timestamp('attended_at', { withTimezone: true }),
  attendanceSource: attendanceSourceEnum('attendance_source'),
  bookingStartTime: timestamp('booking_start_time', { withTimezone: true }).notNull(),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('workshop_registrations_booking_uid_uniq').on(t.bookingUid),
])
