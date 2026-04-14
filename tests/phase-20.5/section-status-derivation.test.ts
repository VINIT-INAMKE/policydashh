import { describe, it, expect, vi, beforeAll } from 'vitest'

/**
 * Phase 20.5 Wave 0 — RED contract for PUB-07 section status derivation.
 *
 * Locks the three-state precedence rule that Plan 20.5-01 must satisfy:
 *   Validated (in published changelog) > Under Review (open CR row) > Draft.
 *
 * Uses the canonical variable-path dynamic import pattern (array.join + vite-ignore)
 * so vitest collection does not static-resolve the not-yet-created service module.
 */

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    select: vi.fn(),
  },
}))
vi.mock('@/src/db', () => ({ db: dbMock }))

let getSectionPublicStatuses: any
beforeAll(async () => {
  const segs = ['@', 'src', 'server', 'services', 'framework-log.service']
  const mod = await import(/* @vite-ignore */ segs.join('/'))
  getSectionPublicStatuses = mod.getSectionPublicStatuses
})

function mockOpenCRs(rows: Array<{ sectionId: string }>) {
  dbMock.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

describe('getSectionPublicStatuses — PUB-07 derivation rules', () => {
  it('returns validated for sections in published changelog', async () => {
    mockOpenCRs([])
    const versions = [
      {
        id: 'v1',
        documentId: 'doc-1',
        isPublished: true,
        changelog: [
          {
            crId: 'x',
            crReadableId: 'CR-1',
            crTitle: 't',
            summary: 's',
            affectedSectionIds: ['sec-A'],
            feedbackIds: [],
          },
        ],
        sectionsSnapshot: [],
        publishedAt: new Date(),
        createdAt: new Date(),
      },
    ] as any
    const m = await getSectionPublicStatuses('doc-1', versions)
    expect(m.get('sec-A')).toBe('validated')
  })

  it('returns under_review for sections with open in_review CR', async () => {
    mockOpenCRs([{ sectionId: 'sec-B' }])
    const m = await getSectionPublicStatuses('doc-1', [])
    expect(m.get('sec-B')).toBe('under_review')
  })

  it('prefers validated over under_review when both hold', async () => {
    mockOpenCRs([{ sectionId: 'sec-C' }])
    const versions = [
      {
        id: 'v1',
        documentId: 'doc-1',
        isPublished: true,
        changelog: [
          {
            crId: 'x',
            crReadableId: 'CR-1',
            crTitle: 't',
            summary: 's',
            affectedSectionIds: ['sec-C'],
            feedbackIds: [],
          },
        ],
        sectionsSnapshot: [],
        publishedAt: new Date(),
        createdAt: new Date(),
      },
    ] as any
    const m = await getSectionPublicStatuses('doc-1', versions)
    expect(m.get('sec-C')).toBe('validated')
  })

  it('returns draft for unknown section id', async () => {
    mockOpenCRs([])
    const m = await getSectionPublicStatuses('doc-1', [])
    expect(m.get('sec-X')).toBe('draft')
  })
})
