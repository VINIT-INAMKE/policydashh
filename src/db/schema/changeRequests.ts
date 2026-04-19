import { pgTable, uuid, text, timestamp, jsonb, boolean, pgEnum, unique } from 'drizzle-orm/pg-core'
import { users } from './users'
import { policyDocuments, policySections } from './documents'
import { feedbackItems } from './feedback'
import type { SectionSnapshot, ChangelogEntry } from '@/src/server/services/version.service'
import type { ConsultationSummaryJson } from '@/src/server/services/consultation-summary.service'

export const crStatusEnum = pgEnum('cr_status', [
  'drafting', 'in_review', 'approved', 'merged', 'closed',
])

// G8: documentVersions <-> changeRequests is a true circular FK.
// `documentVersions.crId` references `changeRequests.id` with ON DELETE
// SET NULL (a version should survive if its originating CR is deleted),
// and `changeRequests.mergedVersionId` references `documentVersions.id`.
// Drizzle's `() =>` closures delay evaluation to runtime so Postgres sees
// both constraints, but TypeScript's type inference hits infinite
// recursion trying to resolve the cross-table types. We break the cycle
// by declaring `documentVersions.crId` WITHOUT a Drizzle `.references()`
// in the schema file -- the FK lives in migration 0020 (ON DELETE SET
// NULL) only. This mirrors the approach already used for
// `documentVersions.milestoneId`.

// Document versions with section snapshots and publish support
export const documentVersions = pgTable('document_versions', {
  id:                uuid('id').primaryKey().defaultRandom(),
  documentId:        uuid('document_id').notNull().references(() => policyDocuments.id),
  versionLabel:      text('version_label').notNull(),
  mergeSummary:      text('merge_summary'),
  createdBy:         uuid('created_by').notNull().references(() => users.id),
  crId:              uuid('cr_id'),  // FK to change_requests.id (ON DELETE SET NULL) — constraint in migration 0020; TS-level reference skipped to avoid circular-type recursion
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  sectionsSnapshot:  jsonb('sections_snapshot').$type<SectionSnapshot[] | null>(),
  changelog:         jsonb('changelog').$type<ChangelogEntry[] | null>(),
  publishedAt:       timestamp('published_at', { withTimezone: true }),
  isPublished:       boolean('is_published').notNull().default(false),
  consultationSummary: jsonb('consultation_summary').$type<ConsultationSummaryJson | null>(),
  milestoneId:       uuid('milestone_id'),  // FK to milestones - constraint in SQL migration only (avoids circular import)
  txHash:            text('tx_hash'),
  anchoredAt:        timestamp('anchored_at', { withTimezone: true }),
}, (t) => [
  unique('uq_document_version').on(t.documentId, t.versionLabel),
  unique('document_versions_tx_hash_unique').on(t.txHash),
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
