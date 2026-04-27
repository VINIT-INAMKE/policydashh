import { pgTable, uuid, text, timestamp, integer, pgEnum, primaryKey, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './users'
import { policySections } from './documents'
import { feedbackItems } from './feedback'
import { evidenceArtifacts } from './evidence'

// F30: `transcript` added so the recording pipeline can distinguish the
// raw transcription from the structured summary artifact. Existing rows
// remain valid; callers now pick the right type at insert time.
export const workshopArtifactTypeEnum = pgEnum('workshop_artifact_type', [
  'promo', 'recording', 'transcript', 'summary', 'attendance', 'other',
])

export const workshopStatusEnum = pgEnum('workshop_status', [
  'upcoming', 'in_progress', 'completed', 'archived',
])

export const checklistSlotEnum = pgEnum('checklist_slot', [
  'registration_export', 'screenshot', 'recording', 'attendance', 'summary',
])

export const checklistSlotStatusEnum = pgEnum('checklist_slot_status', ['empty', 'filled'])

export const artifactReviewStatusEnum = pgEnum('artifact_review_status', ['draft', 'approved'])

// Phase 20 - cal.com workshop registration lifecycle
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
  // Google Calendar event id, populated by sync workshop.create. NOT NULL —
  // every workshop has a backing calendar event from creation onward.
  googleCalendarEventId: text('google_calendar_event_id').notNull(),
  // 'google_meet' (auto-provisioned) or 'manual' (admin-pasted URL).
  // CHECK constraint defined in 0032 migration.
  meetingProvisionedBy: text('meeting_provisioned_by').notNull(),
  // NOT NULL since 0032 — auto-Meet path stores hangoutLink, manual path
  // stores admin-pasted URL.
  meetingUrl:          text('meeting_url').notNull(),
  maxSeats:            integer('max_seats'),
  timezone:            text('timezone').notNull().default('Asia/Kolkata'),
  // Stamped by workshop.endWorkshop the first time fan-out fires. Re-runs
  // are no-ops via the existing guard.
  completionPipelineSentAt: timestamp('completion_pipeline_sent_at', { withTimezone: true }),
  createdBy:           uuid('created_by').notNull().references(() => users.id),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  milestoneId:         uuid('milestone_id'),
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
  // NULL = Google `addAttendeeToEvent` failed at registration time. Admin
  // can click "Resend invite" in the Attendees tab to retry; success stamps
  // this column.
  inviteSentAt:     timestamp('invite_sent_at', { withTimezone: true }),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('workshop_registrations_booking_uid_uniq').on(t.bookingUid),
  uniqueIndex('workshop_registrations_unique_email_per_workshop')
    .on(t.workshopId, t.emailHash)
    .where(sql`status != 'cancelled'`),
])
