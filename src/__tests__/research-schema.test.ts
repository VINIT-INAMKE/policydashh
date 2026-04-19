/**
 * RED TDD stub for RESEARCH-01 — research schema contract
 *
 * Wave 0 contract lock for Phase 26 Plan 26-01. All tests here are `it.todo`
 * (pending) — they describe the behavior Plan 26-01 must make GREEN without
 * failing the test suite at Wave 0 time.
 *
 * Target module: `@/src/db/schema/research` (does NOT yet exist at Wave 0)
 *
 * Expected exports from '@/src/db/schema/research':
 *   - researchItems                (table)
 *   - researchItemSectionLinks     (table, composite PK on [researchItemId, sectionId])
 *   - researchItemVersionLinks     (table, composite PK on [researchItemId, versionId])
 *   - researchItemFeedbackLinks    (table, composite PK on [researchItemId, feedbackId])
 *   - researchItemStatusEnum       (pgEnum — 4 values: draft, pending_review, published, retracted)
 *   - researchItemTypeEnum         (pgEnum — 8 values: report, paper, dataset, memo,
 *                                   interview_transcript, media_coverage, legal_reference, case_study)
 *
 * Schema barrel `@/src/db/schema` must re-export all of the above.
 *
 * Referenced via future test-ready imports:
 *   import { researchItems, researchItemSectionLinks, researchItemVersionLinks,
 *     researchItemFeedbackLinks, researchItemStatusEnum, researchItemTypeEnum,
 *   } from '@/src/db/schema/research'
 */

import { describe, it } from 'vitest'

describe('research schema (RESEARCH-01)', () => {
  it.todo("exports researchItems table from '@/src/db/schema/research'")

  it.todo("exports researchItemStatusEnum with enumValues ['draft', 'pending_review', 'published', 'retracted']")

  it.todo("exports researchItemTypeEnum with enumValues ['report', 'paper', 'dataset', 'memo', 'interview_transcript', 'media_coverage', 'legal_reference', 'case_study']")

  it.todo("researchItems table has required columns: researchItems.id, researchItems.readableId, researchItems.documentId, researchItems.title, researchItems.itemType, researchItems.status, researchItems.createdBy, researchItems.isAuthorAnonymous, researchItems.milestoneId, researchItems.contentHash, researchItems.txHash, researchItems.anchoredAt, researchItems.createdAt, researchItems.updatedAt all defined")

  it.todo("researchItems table has optional/conditional columns: researchItems.description, researchItems.externalUrl, researchItems.artifactId, researchItems.doi, researchItems.authors, researchItems.publishedDate, researchItems.peerReviewed, researchItems.journalOrSource, researchItems.versionLabel, researchItems.previousVersionId, researchItems.reviewedBy, researchItems.reviewedAt, researchItems.retractionReason all defined")

  it.todo("exports researchItemSectionLinks with composite PK columns researchItemSectionLinks.researchItemId + researchItemSectionLinks.sectionId and researchItemSectionLinks.relevanceNote metadata column")

  it.todo("exports researchItemVersionLinks with composite PK columns researchItemVersionLinks.researchItemId + researchItemVersionLinks.versionId (versionId is SQL-only FK to documentVersions to avoid circular import)")

  it.todo("exports researchItemFeedbackLinks with composite PK columns researchItemFeedbackLinks.researchItemId + researchItemFeedbackLinks.feedbackId")

  it.todo("barrel @/src/db/schema re-exports researchItems, researchItemSectionLinks, researchItemVersionLinks, researchItemFeedbackLinks, researchItemStatusEnum, researchItemTypeEnum")
})
