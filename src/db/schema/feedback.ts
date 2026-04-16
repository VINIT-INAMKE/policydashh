import { pgTable, uuid, text, timestamp, boolean, jsonb, pgEnum, unique } from 'drizzle-orm/pg-core'
import { users } from './users'
import { policySections, policyDocuments } from './documents'

export const feedbackTypeEnum = pgEnum('feedback_type', [
  'issue', 'suggestion', 'endorsement', 'evidence', 'question',
])

export const feedbackPriorityEnum = pgEnum('feedback_priority', [
  'low', 'medium', 'high',
])

export const impactCategoryEnum = pgEnum('impact_category', [
  'legal', 'security', 'tax', 'consumer', 'innovation', 'clarity', 'governance', 'other',
])

export const feedbackStatusEnum = pgEnum('feedback_status', [
  'submitted', 'under_review', 'accepted', 'partially_accepted', 'rejected', 'closed',
])

// Phase 20 - distinguishes public /participate intake feedback from
// post-workshop feedback submitted via the JWT deep-link flow. Nullable
// because legacy rows (Phases 1-19) carry no source.
export const feedbackSourceEnum = pgEnum('feedback_source', ['intake', 'workshop'])

export const feedbackItems = pgTable('feedback', {
  id:                uuid('id').primaryKey().defaultRandom(),
  readableId:        text('readable_id').notNull().unique(),
  sectionId:         uuid('section_id').notNull().references(() => policySections.id),
  documentId:        uuid('document_id').notNull().references(() => policyDocuments.id),
  submitterId:       uuid('submitter_id').notNull().references(() => users.id),
  feedbackType:      feedbackTypeEnum('feedback_type').notNull(),
  priority:          feedbackPriorityEnum('priority').notNull().default('medium'),
  impactCategory:    impactCategoryEnum('impact_category').notNull().default('other'),
  title:             text('title').notNull(),
  body:              text('body').notNull(),
  suggestedChange:   text('suggested_change'),
  status:            feedbackStatusEnum('status').notNull().default('submitted'),
  isAnonymous:       boolean('is_anonymous').notNull().default(false),
  decisionRationale: text('decision_rationale'),
  reviewedBy:        uuid('reviewed_by').references(() => users.id),
  reviewedAt:        timestamp('reviewed_at', { withTimezone: true }),
  resolvedInVersionId: uuid('resolved_in_version_id'),  // FK to documentVersions - constraint in SQL migration only (avoids circular import)
  xstateSnapshot:    jsonb('xstate_snapshot').$type<Record<string, unknown> | null>(),
  source:            feedbackSourceEnum('source'),
  milestoneId:       uuid('milestone_id'),  // FK to milestones - constraint in SQL migration only (avoids circular import)
  createdAt:         timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
