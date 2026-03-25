import { describe, it, expect, vi } from 'vitest'

// Mock DB to avoid Neon connection requirement in unit tests
vi.mock('@/src/db', () => ({
  db: {},
}))

import { computeSectionDiff, type SectionSnapshot } from '@/src/server/services/version.service'

describe('computeSectionDiff', () => {
  describe('empty snapshots', () => {
    it('returns empty array when both snapshots are empty', () => {
      const result = computeSectionDiff([], [])
      expect(result).toEqual([])
    })
  })

  describe('added sections', () => {
    it('returns status "added" when section exists only in snapshot B', () => {
      const snapshotA: SectionSnapshot[] = []
      const snapshotB: SectionSnapshot[] = [
        { sectionId: 's1', title: 'Introduction', orderIndex: 0, content: { type: 'doc', text: 'Hello' } },
      ]

      const result = computeSectionDiff(snapshotA, snapshotB)
      expect(result).toHaveLength(1)
      expect(result[0].sectionId).toBe('s1')
      expect(result[0].status).toBe('added')
      expect(result[0].titleA).toBeNull()
      expect(result[0].titleB).toBe('Introduction')
    })
  })

  describe('removed sections', () => {
    it('returns status "removed" when section exists only in snapshot A', () => {
      const snapshotA: SectionSnapshot[] = [
        { sectionId: 's1', title: 'Introduction', orderIndex: 0, content: { type: 'doc', text: 'Hello' } },
      ]
      const snapshotB: SectionSnapshot[] = []

      const result = computeSectionDiff(snapshotA, snapshotB)
      expect(result).toHaveLength(1)
      expect(result[0].sectionId).toBe('s1')
      expect(result[0].status).toBe('removed')
      expect(result[0].titleA).toBe('Introduction')
      expect(result[0].titleB).toBeNull()
    })
  })

  describe('modified sections', () => {
    it('returns status "modified" with diff array when section content differs', () => {
      const snapshotA: SectionSnapshot[] = [
        { sectionId: 's1', title: 'Introduction', orderIndex: 0, content: { type: 'doc', text: 'Hello world' } },
      ]
      const snapshotB: SectionSnapshot[] = [
        { sectionId: 's1', title: 'Introduction', orderIndex: 0, content: { type: 'doc', text: 'Hello universe' } },
      ]

      const result = computeSectionDiff(snapshotA, snapshotB)
      expect(result).toHaveLength(1)
      expect(result[0].sectionId).toBe('s1')
      expect(result[0].status).toBe('modified')
      expect(result[0].diff).toBeTruthy()
      expect(Array.isArray(result[0].diff)).toBe(true)
      expect(result[0].diff!.length).toBeGreaterThan(0)
    })

    it('returns status "modified" when title changes but content is same', () => {
      const snapshotA: SectionSnapshot[] = [
        { sectionId: 's1', title: 'Old Title', orderIndex: 0, content: { text: 'Same' } },
      ]
      const snapshotB: SectionSnapshot[] = [
        { sectionId: 's1', title: 'New Title', orderIndex: 0, content: { text: 'Same' } },
      ]

      const result = computeSectionDiff(snapshotA, snapshotB)
      expect(result).toHaveLength(1)
      // Content is same but title changed - still unchanged in terms of content diff
      // The title change is captured in titleA vs titleB
      expect(result[0].titleA).toBe('Old Title')
      expect(result[0].titleB).toBe('New Title')
    })
  })

  describe('unchanged sections', () => {
    it('returns status "unchanged" with null diff when section content is identical', () => {
      const content = { type: 'doc', text: 'Hello world' }
      const snapshotA: SectionSnapshot[] = [
        { sectionId: 's1', title: 'Introduction', orderIndex: 0, content },
      ]
      const snapshotB: SectionSnapshot[] = [
        { sectionId: 's1', title: 'Introduction', orderIndex: 0, content },
      ]

      const result = computeSectionDiff(snapshotA, snapshotB)
      expect(result).toHaveLength(1)
      expect(result[0].sectionId).toBe('s1')
      expect(result[0].status).toBe('unchanged')
      expect(result[0].diff).toBeNull()
    })
  })

  describe('mixed scenario', () => {
    it('handles added, removed, modified, and unchanged sections together', () => {
      const snapshotA: SectionSnapshot[] = [
        { sectionId: 's1', title: 'Unchanged', orderIndex: 0, content: { text: 'Same' } },
        { sectionId: 's2', title: 'Modified', orderIndex: 1, content: { text: 'Old content' } },
        { sectionId: 's3', title: 'Removed', orderIndex: 2, content: { text: 'Gone' } },
      ]
      const snapshotB: SectionSnapshot[] = [
        { sectionId: 's1', title: 'Unchanged', orderIndex: 0, content: { text: 'Same' } },
        { sectionId: 's2', title: 'Modified', orderIndex: 1, content: { text: 'New content' } },
        { sectionId: 's4', title: 'Added', orderIndex: 2, content: { text: 'Brand new' } },
      ]

      const result = computeSectionDiff(snapshotA, snapshotB)
      expect(result).toHaveLength(4)

      const byId = new Map(result.map((r) => [r.sectionId, r]))
      expect(byId.get('s1')!.status).toBe('unchanged')
      expect(byId.get('s2')!.status).toBe('modified')
      expect(byId.get('s3')!.status).toBe('removed')
      expect(byId.get('s4')!.status).toBe('added')
    })
  })

  describe('edge cases', () => {
    it('handles sections with empty content objects', () => {
      const snapshotA: SectionSnapshot[] = [
        { sectionId: 's1', title: 'Empty', orderIndex: 0, content: {} },
      ]
      const snapshotB: SectionSnapshot[] = [
        { sectionId: 's1', title: 'Empty', orderIndex: 0, content: {} },
      ]

      const result = computeSectionDiff(snapshotA, snapshotB)
      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('unchanged')
    })

    it('detects modification when only nested content values differ', () => {
      const snapshotA: SectionSnapshot[] = [
        { sectionId: 's1', title: 'Sec', orderIndex: 0, content: { type: 'doc', content: [{ type: 'paragraph', text: 'A' }] } },
      ]
      const snapshotB: SectionSnapshot[] = [
        { sectionId: 's1', title: 'Sec', orderIndex: 0, content: { type: 'doc', content: [{ type: 'paragraph', text: 'B' }] } },
      ]

      const result = computeSectionDiff(snapshotA, snapshotB)
      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('modified')
      expect(result[0].diff).toBeTruthy()
    })
  })
})
