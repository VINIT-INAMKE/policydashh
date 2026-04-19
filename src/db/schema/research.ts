import { pgTable, pgEnum, uuid, text, timestamp, boolean, date, index, primaryKey } from 'drizzle-orm/pg-core'
import { users } from './users'
import { policyDocuments, policySections } from './documents'
import { feedbackItems } from './feedback'
import { evidenceArtifacts } from './evidence'
// NOTE: do NOT import documentVersions or milestones here.
// milestoneId, previousVersionId, and researchItemVersionLinks.versionId
// use SQL-only FKs (constraints added in migration 0025) to avoid the
// circular Drizzle type recursion documented in:
//   - src/db/schema/feedback.ts line 43 (resolvedInVersionId)
//   - src/db/schema/workshops.ts line 53 (milestoneId)
//   - src/db/schema/changeRequests.ts line 31 (crId)

// Phase 26: research module — citable research items attached to a policy document
//   - RESEARCH-01 schema + link tables
//   - RESEARCH-02 readable-ID sequence (seq defined in migration 0025)
//   - Q1: documentId NOT NULL (per-policy scope)
//   - Q7: isAuthorAnonymous flag (public listPublic must null out authors)

export const researchItemTypeEnum = pgEnum('research_item_type', [
  'report', 'paper', 'dataset', 'memo', 'interview_transcript',
  'media_coverage', 'legal_reference', 'case_study',
])

export const researchItemStatusEnum = pgEnum('research_item_status', [
  'draft', 'pending_review', 'published', 'retracted',
])

export const researchItems = pgTable('research_items', {
  id:                uuid('id').primaryKey().defaultRandom(),
  readableId:        text('readable_id').notNull().unique(),
  documentId:        uuid('document_id').notNull().references(() => policyDocuments.id),
  title:             text('title').notNull(),
  itemType:          researchItemTypeEnum('item_type').notNull(),
  status:            researchItemStatusEnum('status').notNull().default('draft'),
  createdBy:         uuid('created_by').notNull().references(() => users.id),

  // Optional citation metadata
  description:       text('description'),
  externalUrl:       text('external_url'),
  artifactId:        uuid('artifact_id').references(() => evidenceArtifacts.id),
  doi:               text('doi'),                                 // Q10: plain text
  authors:           text('authors').array(),                     // null-hidden on public queries when isAuthorAnonymous = true
  publishedDate:     date('published_date'),
  peerReviewed:      boolean('peer_reviewed').notNull().default(false),
  journalOrSource:   text('journal_or_source'),
  versionLabel:      text('version_label'),
  previousVersionId: uuid('previous_version_id'),                  // self-FK - constraint in SQL migration only (Pitfall 3: self-FK must come after CREATE TABLE)
  isAuthorAnonymous: boolean('is_author_anonymous').notNull().default(false),   // Q7

  // Review fields populated on approve / retract
  reviewedBy:        uuid('reviewed_by').references(() => users.id),
  reviewedAt:        timestamp('reviewed_at', { withTimezone: true }),
  retractionReason:  text('retraction_reason'),

  // Milestone anchoring (SQL-only FK, same as workshops.milestoneId / evidence_artifacts.milestoneId)
  milestoneId:       uuid('milestone_id'),                         // FK to milestones - constraint in SQL migration only (avoids circular import)

  // Cardano anchoring fields — Q4: milestone-only in v0.2 (columns present so v0.3 can wire per-item anchoring without another migration)
  contentHash:       text('content_hash'),
  txHash:            text('tx_hash'),
  anchoredAt:        timestamp('anchored_at', { withTimezone: true }),

  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_research_items_document').on(t.documentId),
  index('idx_research_items_status').on(t.status),
  index('idx_research_items_created_by').on(t.createdBy),
])

// Link tables — composite PK pattern from workshopSectionLinks (workshops.ts lines 64–76)
export const researchItemSectionLinks = pgTable('research_item_section_links', {
  researchItemId: uuid('research_item_id').notNull().references(() => researchItems.id, { onDelete: 'cascade' }),
  sectionId:      uuid('section_id').notNull().references(() => policySections.id, { onDelete: 'cascade' }),
  relevanceNote:  text('relevance_note'),
}, (t) => [
  primaryKey({ columns: [t.researchItemId, t.sectionId] }),
])

export const researchItemVersionLinks = pgTable('research_item_version_links', {
  researchItemId: uuid('research_item_id').notNull().references(() => researchItems.id, { onDelete: 'cascade' }),
  versionId:      uuid('version_id').notNull(),   // FK to document_versions - constraint in SQL migration only (avoids circular import)
}, (t) => [
  primaryKey({ columns: [t.researchItemId, t.versionId] }),
])

export const researchItemFeedbackLinks = pgTable('research_item_feedback_links', {
  researchItemId: uuid('research_item_id').notNull().references(() => researchItems.id, { onDelete: 'cascade' }),
  feedbackId:     uuid('feedback_id').notNull().references(() => feedbackItems.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.researchItemId, t.feedbackId] }),
])
