/**
 * GREEN TDD contract for RESEARCH-01 — research schema contract
 *
 * Wave 0 (Plan 26-00) locked the RED stubs (it.todo). Plan 26-01 flips them to
 * real passing assertions by importing the freshly-authored
 * `@/src/db/schema/research` module.
 *
 * Expected exports from '@/src/db/schema/research':
 *   - researchItems                (table)
 *   - researchItemSectionLinks     (table, composite PK on [researchItemId, sectionId])
 *   - researchItemVersionLinks     (table, composite PK on [researchItemId, versionId])
 *   - researchItemFeedbackLinks    (table, composite PK on [researchItemId, feedbackId])
 *   - researchItemStatusEnum       (pgEnum — 4 values)
 *   - researchItemTypeEnum         (pgEnum — 8 values)
 */

import { describe, it, expect } from 'vitest'
import {
  researchItems,
  researchItemSectionLinks,
  researchItemVersionLinks,
  researchItemFeedbackLinks,
  researchItemStatusEnum,
  researchItemTypeEnum,
} from '@/src/db/schema/research'
import * as schemaBarrel from '@/src/db/schema'

describe('research schema (RESEARCH-01)', () => {
  it("exports researchItems table from '@/src/db/schema/research'", () => {
    expect(researchItems).toBeDefined()
    // Drizzle tables expose columns through the `id` proxy; this confirms
    // the object is a real pgTable with at least one column.
    expect(researchItems.id).toBeDefined()
  })

  it("exports researchItemStatusEnum with enumValues ['draft', 'pending_review', 'published', 'retracted']", () => {
    expect(researchItemStatusEnum).toBeDefined()
    expect(researchItemStatusEnum.enumValues).toEqual([
      'draft', 'pending_review', 'published', 'retracted',
    ])
  })

  it("exports researchItemTypeEnum with enumValues ['report', 'paper', 'dataset', 'memo', 'interview_transcript', 'media_coverage', 'legal_reference', 'case_study']", () => {
    expect(researchItemTypeEnum).toBeDefined()
    expect(researchItemTypeEnum.enumValues).toEqual([
      'report', 'paper', 'dataset', 'memo', 'interview_transcript',
      'media_coverage', 'legal_reference', 'case_study',
    ])
  })

  it('researchItems table has required columns defined', () => {
    expect(researchItems.id).toBeDefined()
    expect(researchItems.readableId).toBeDefined()
    expect(researchItems.documentId).toBeDefined()
    expect(researchItems.title).toBeDefined()
    expect(researchItems.itemType).toBeDefined()
    expect(researchItems.status).toBeDefined()
    expect(researchItems.createdBy).toBeDefined()
    expect(researchItems.isAuthorAnonymous).toBeDefined()
    expect(researchItems.milestoneId).toBeDefined()
    expect(researchItems.contentHash).toBeDefined()
    expect(researchItems.txHash).toBeDefined()
    expect(researchItems.anchoredAt).toBeDefined()
    expect(researchItems.createdAt).toBeDefined()
    expect(researchItems.updatedAt).toBeDefined()
  })

  it('researchItems table has optional/conditional columns defined', () => {
    expect(researchItems.description).toBeDefined()
    expect(researchItems.externalUrl).toBeDefined()
    expect(researchItems.artifactId).toBeDefined()
    expect(researchItems.doi).toBeDefined()
    expect(researchItems.authors).toBeDefined()
    expect(researchItems.publishedDate).toBeDefined()
    expect(researchItems.peerReviewed).toBeDefined()
    expect(researchItems.journalOrSource).toBeDefined()
    expect(researchItems.versionLabel).toBeDefined()
    expect(researchItems.previousVersionId).toBeDefined()
    expect(researchItems.reviewedBy).toBeDefined()
    expect(researchItems.reviewedAt).toBeDefined()
    expect(researchItems.retractionReason).toBeDefined()
  })

  it('exports researchItemSectionLinks with composite PK columns + relevanceNote metadata column', () => {
    expect(researchItemSectionLinks).toBeDefined()
    expect(researchItemSectionLinks.researchItemId).toBeDefined()
    expect(researchItemSectionLinks.sectionId).toBeDefined()
    expect(researchItemSectionLinks.relevanceNote).toBeDefined()
  })

  it('exports researchItemVersionLinks with composite PK columns (versionId is SQL-only FK to documentVersions to avoid circular import)', () => {
    expect(researchItemVersionLinks).toBeDefined()
    expect(researchItemVersionLinks.researchItemId).toBeDefined()
    expect(researchItemVersionLinks.versionId).toBeDefined()
  })

  it('exports researchItemFeedbackLinks with composite PK columns', () => {
    expect(researchItemFeedbackLinks).toBeDefined()
    expect(researchItemFeedbackLinks.researchItemId).toBeDefined()
    expect(researchItemFeedbackLinks.feedbackId).toBeDefined()
  })

  it('barrel @/src/db/schema re-exports researchItems, researchItemSectionLinks, researchItemVersionLinks, researchItemFeedbackLinks, researchItemStatusEnum, researchItemTypeEnum', () => {
    const barrel = schemaBarrel as Record<string, unknown>
    expect(barrel.researchItems).toBe(researchItems)
    expect(barrel.researchItemSectionLinks).toBe(researchItemSectionLinks)
    expect(barrel.researchItemVersionLinks).toBe(researchItemVersionLinks)
    expect(barrel.researchItemFeedbackLinks).toBe(researchItemFeedbackLinks)
    expect(barrel.researchItemStatusEnum).toBe(researchItemStatusEnum)
    expect(barrel.researchItemTypeEnum).toBe(researchItemTypeEnum)
  })
})
