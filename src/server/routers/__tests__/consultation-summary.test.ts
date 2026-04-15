import { describe, it, expect, vi } from 'vitest'

vi.mock('@/src/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ consultationSummary: null }]),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve([]),
      }),
    }),
    insert: () => ({ values: () => Promise.resolve([]) }),
  },
}))

vi.mock('@/src/lib/audit', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

async function loadRouter() {
  const segs = ['@', 'src', 'server', 'routers', 'consultation-summary']
  const path = segs.join('/')
  return await import(/* @vite-ignore */ path)
}

describe('consultationSummaryRouter (LLM-07)', () => {
  it('exports consultationSummaryRouter', async () => {
    const mod = await loadRouter()
    expect(mod.consultationSummaryRouter).toBeDefined()
  })

  it('defines getByVersionId query procedure', async () => {
    const mod = await loadRouter()
    const procs = mod.consultationSummaryRouter._def.procedures
    expect(procs.getByVersionId).toBeDefined()
  })

  it('defines approveSection mutation procedure', async () => {
    const mod = await loadRouter()
    const procs = mod.consultationSummaryRouter._def.procedures
    expect(procs.approveSection).toBeDefined()
  })

  it('defines editSection mutation procedure', async () => {
    const mod = await loadRouter()
    const procs = mod.consultationSummaryRouter._def.procedures
    expect(procs.editSection).toBeDefined()
  })

  it('defines regenerateSection mutation procedure', async () => {
    const mod = await loadRouter()
    const procs = mod.consultationSummaryRouter._def.procedures
    expect(procs.regenerateSection).toBeDefined()
  })

  it('defines getSectionFeedback query procedure', async () => {
    const mod = await loadRouter()
    const procs = mod.consultationSummaryRouter._def.procedures
    expect(procs.getSectionFeedback).toBeDefined()
  })
})
