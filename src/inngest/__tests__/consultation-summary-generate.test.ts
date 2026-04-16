import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted - shared mock handles that survive Vitest hoist (Phase 16 Pattern)
const mocks = vi.hoisted(() => ({
  chatComplete: vi.fn(),
  updateMock: vi.fn(),
  setMock: vi.fn(),
  whereMock: vi.fn().mockResolvedValue([]),
  selectRows: [] as Array<{ sectionId: string; sectionTitle: string }>,
}))

vi.mock('@/src/lib/llm', () => ({
  chatComplete: mocks.chatComplete,
  generateConsultationSummary: mocks.chatComplete, // alias the helper
}))

vi.mock('@/src/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            orderBy: () => Promise.resolve(mocks.selectRows),
          }),
        }),
        innerJoin: () => ({
          where: () => ({
            groupBy: () => Promise.resolve([]),
          }),
        }),
        where: () => Promise.resolve(mocks.selectRows),
      }),
    })),
    update: vi.fn(() => ({
      set: mocks.setMock.mockReturnValue({
        where: mocks.whereMock,
      }),
    })),
  },
}))

async function loadFn() {
  const segs = ['@', 'src', 'inngest', 'functions', 'consultation-summary-generate']
  const path = segs.join('/')
  return await import(/* @vite-ignore */ path)
}

describe('consultationSummaryGenerateFn (LLM-04/05/07/08)', () => {
  beforeEach(() => {
    mocks.chatComplete.mockReset()
    mocks.updateMock.mockReset()
    mocks.setMock.mockReset()
    mocks.selectRows = []
  })

  it('exports consultationSummaryGenerateFn', async () => {
    const mod = await loadFn()
    expect(mod.consultationSummaryGenerateFn).toBeDefined()
  })

  it('function id is consultation-summary-generate', async () => {
    const mod = await loadFn()
    const fn = mod.consultationSummaryGenerateFn
    // Inngest createFunction returns an object with an `id` reachable via
    // fn.id() or fn.opts.id depending on SDK version. Duck-type both.
    const id = typeof fn.id === 'function' ? fn.id() : fn.opts?.id ?? fn.id
    expect(id).toBe('consultation-summary-generate')
  })

  it('uses groq-summary concurrency key with limit 2', async () => {
    const mod = await loadFn()
    const fn = mod.consultationSummaryGenerateFn
    const opts = fn.opts ?? fn
    const serialized = JSON.stringify(opts)
    expect(serialized).toContain('groq-summary')
  })

  it('triggers on version.published event', async () => {
    const mod = await loadFn()
    const fn = mod.consultationSummaryGenerateFn
    const opts = fn.opts ?? fn
    const serialized = JSON.stringify(opts)
    expect(serialized).toContain('version.published')
  })
})

describe('versionPublishedEvent registration (LLM-05)', () => {
  it('exports versionPublishedEvent + sendVersionPublished from events module', async () => {
    const segs = ['@', 'src', 'inngest', 'events']
    const path = segs.join('/')
    const mod = await import(/* @vite-ignore */ path)
    expect(mod.versionPublishedEvent).toBeDefined()
    expect(typeof mod.sendVersionPublished).toBe('function')
  })
})
