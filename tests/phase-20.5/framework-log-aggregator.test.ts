import { describe, it, expect, beforeAll } from 'vitest'

/**
 * Phase 20.5 Wave 0 — RED contract for PUB-08 framework log aggregation.
 *
 * Locks the four rules Plan 20.5-01 must satisfy:
 *   1. Cap total entries at 20.
 *   2. Descending merge date order.
 *   3. PUB-05 privacy — only { sectionTitle, mergeDate, summary } keys exposed;
 *      no cr/crReadableId/feedbackIds ever leak through JSON.stringify.
 *   4. Entries for sectionIds not present in sectionsSnapshot are skipped.
 *
 * `buildFrameworkLog` is pure — we pass fixture arrays directly, no DB mocks.
 */

let buildFrameworkLog: any
beforeAll(async () => {
  const segs = ['@', 'src', 'server', 'services', 'framework-log.service']
  const mod = await import(/* @vite-ignore */ segs.join('/'))
  buildFrameworkLog = mod.buildFrameworkLog
})

function makeVersion(opts: {
  publishedAt: Date
  entries: number
  prefix: string
  sectionIds: string[]
  sectionTitles: Record<string, string>
}) {
  return {
    id: `v-${opts.prefix}`,
    documentId: 'doc-1',
    isPublished: true,
    publishedAt: opts.publishedAt,
    createdAt: opts.publishedAt,
    sectionsSnapshot: Object.entries(opts.sectionTitles).map(
      ([sectionId, title], i) => ({
        sectionId,
        title,
        orderIndex: i,
        content: {},
      }),
    ),
    changelog: Array.from({ length: opts.entries }).map((_, i) => ({
      crId: `cr-${opts.prefix}-${i}`,
      crReadableId: `CR-${opts.prefix}-${i}`,
      crTitle: `title-${i}`,
      summary: `${opts.prefix} summary ${i}`,
      affectedSectionIds: opts.sectionIds,
      feedbackIds: [`fb-${opts.prefix}-${i}`],
    })),
  } as any
}

describe('buildFrameworkLog — PUB-08 aggregation rules', () => {
  it('caps total entries at 20', () => {
    const v = makeVersion({
      publishedAt: new Date('2026-03-01'),
      entries: 25,
      prefix: 'a',
      sectionIds: ['sec-A'],
      sectionTitles: { 'sec-A': 'Section A' },
    })
    const out = buildFrameworkLog([v])
    expect(out.length).toBe(20)
  })

  it('orders entries newest first by merge date', () => {
    const vOld = makeVersion({
      publishedAt: new Date('2026-01-01'),
      entries: 1,
      prefix: 'old',
      sectionIds: ['sec-A'],
      sectionTitles: { 'sec-A': 'A' },
    })
    const vNew = makeVersion({
      publishedAt: new Date('2026-03-01'),
      entries: 1,
      prefix: 'new',
      sectionIds: ['sec-A'],
      sectionTitles: { 'sec-A': 'A' },
    })
    const out = buildFrameworkLog([vOld, vNew])
    expect(new Date(out[0].mergeDate).getTime()).toBe(
      new Date('2026-03-01').getTime(),
    )
    expect(new Date(out[out.length - 1].mergeDate).getTime()).toBe(
      new Date('2026-01-01').getTime(),
    )
  })

  it('excludes CR/feedback identifiers from output shape (PUB-05)', () => {
    const v = makeVersion({
      publishedAt: new Date('2026-03-01'),
      entries: 1,
      prefix: 'p',
      sectionIds: ['sec-A'],
      sectionTitles: { 'sec-A': 'A' },
    })
    const out = buildFrameworkLog([v])
    expect(Object.keys(out[0]).sort()).toEqual([
      'mergeDate',
      'sectionTitle',
      'summary',
    ])
    const json = JSON.stringify(out)
    expect(json.includes('cr-p-0')).toBe(false)
    expect(json.includes('CR-p-0')).toBe(false)
    expect(json.includes('fb-p-0')).toBe(false)
  })

  it('skips entries whose sectionId is not in sectionsSnapshot', () => {
    const v = makeVersion({
      publishedAt: new Date('2026-03-01'),
      entries: 1,
      prefix: 'orphan',
      sectionIds: ['orphan-sid'],
      sectionTitles: { 'sec-A': 'A' },
    })
    const out = buildFrameworkLog([v])
    expect(out.length).toBe(0)
  })
})
