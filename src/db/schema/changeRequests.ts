import { pgTable, uuid, text, timestamp, jsonb, pgEnum, unique } from 'drizzle-orm/pg-core'
import { users } from './users'
import { policyDocuments, policySections } from './documents'
import { feedbackItems } from './feedback'

export const crStatusEnum = pgEnum('cr_status', [
  'drafting', 'in_review', 'approved', 'merged', 'closed',
])

// Minimal stub for Phase 6 — only columns needed for merge.
// Phase 6 extends this table with content snapshots, diff data, etc.
export const documentVersions = pgTable('document_versions', {
  id:            uuid('id').primaryKey().defaultRandom(),
  documentId:    uuid('document_id').notNull().references(() => policyDocuments.id),
  versionLabel:  text('version_label').notNull(),
  mergeSummary:  text('merge_summary'),
  createdBy:     uuid('created_by').notNull().references(() => users.id),
  crId:          uuid('cr_id'),  // FK added after changeRequests defined (avoid circular)
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('uq_document_version').on(t.documentId, t.versionLabel),
])

export const changeRequests = pgTable('change_requests', {
  id:               uuid('id').primaryKey().defaultRandom(),
  readableId:       text('readable_id').notNull().unique(),
  documentId:       uuid('document_id').notNull().references(() => policyDocuments.id),
  ownerId:          uuid('owner_id').notNull().references(() => users.id),
  title:            text('title').notNull(),
  description:      text('description'),
  status:           crStatusEnum('status').notNull().default('drafting'),
  approverId:       uuid('approver_id').references(() => users.id),
  approvedAt:       timestamp('approved_at', { withTimezone: true }),
  mergedBy:         uuid('merged_by').references(() => users.id),
  mergedAt:         timestamp('merged_at', { withTimezone: true }),
  mergedVersionId:  uuid('merged_version_id').references(() => documentVersions.id),
  closureRationale: text('closure_rationale'),
  xstateSnapshot:   jsonb('xstate_snapshot').$type<Record<string, unknown> | null>(),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const crFeedbackLinks = pgTable('cr_feedback_links', {
  id:         uuid('id').primaryKey().defaultRandom(),
  crId:       uuid('cr_id').notNull().references(() => changeRequests.id, { onDelete: 'cascade' }),
  feedbackId: uuid('feedback_id').notNull().references(() => feedbackItems.id),
}, (t) => [
  unique('uq_cr_feedback').on(t.crId, t.feedbackId),
])

export const crSectionLinks = pgTable('cr_section_links', {
  id:        uuid('id').primaryKey().defaultRandom(),
  crId:      uuid('cr_id').notNull().references(() => changeRequests.id, { onDelete: 'cascade' }),
  sectionId: uuid('section_id').notNull().references(() => policySections.id),
}, (t) => [
  unique('uq_cr_section').on(t.crId, t.sectionId),
])
