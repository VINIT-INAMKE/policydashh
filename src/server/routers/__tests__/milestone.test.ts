import { describe, it, expect, vi } from 'vitest'

vi.mock('@/src/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve([]),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([]),
      }),
    }),
  },
}))

vi.mock('@/src/lib/audit', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

async function loadRouter() {
  const segs = ['@', 'src', 'server', 'routers', 'milestone']
  const path = segs.join('/')
  return await import(/* @vite-ignore */ path)
}

describe('milestoneRouter (VERIFY-03)', () => {
  it('exports milestoneRouter', async () => {
    const mod = await loadRouter()
    expect(mod.milestoneRouter).toBeDefined()
  })

  it('defines create mutation procedure', async () => {
    const mod = await loadRouter()
    const procs = mod.milestoneRouter._def.procedures
    expect(procs.create).toBeDefined()
  })

  it('defines list query procedure', async () => {
    const mod = await loadRouter()
    const procs = mod.milestoneRouter._def.procedures
    expect(procs.list).toBeDefined()
  })

  it('defines getById query procedure', async () => {
    const mod = await loadRouter()
    const procs = mod.milestoneRouter._def.procedures
    expect(procs.getById).toBeDefined()
  })

  it('defines attachEntity mutation procedure', async () => {
    const mod = await loadRouter()
    const procs = mod.milestoneRouter._def.procedures
    expect(procs.attachEntity).toBeDefined()
  })

  it('defines detachEntity mutation procedure', async () => {
    const mod = await loadRouter()
    const procs = mod.milestoneRouter._def.procedures
    expect(procs.detachEntity).toBeDefined()
  })

  it('defines markReady mutation procedure', async () => {
    const mod = await loadRouter()
    const procs = mod.milestoneRouter._def.procedures
    expect(procs.markReady).toBeDefined()
  })
})
