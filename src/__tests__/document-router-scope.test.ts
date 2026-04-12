import { describe, it, expect, vi, beforeEach } from 'vitest'

// The chain mock records every where-clause the router builds so the
// assertions below can look at its shape without needing a real Postgres.
type WhereSnapshot = unknown

let __recordedWheres: WhereSnapshot[] = []
let __selectResult: unknown[] = []

function makeChain() {
  const chain: any = {
    select: () => chain,
    selectDistinct: () => chain,
    from: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    where: (cond: WhereSnapshot) => {
      __recordedWheres.push(cond)
      return chain
    },
    groupBy: () => chain,
    orderBy: () => Promise.resolve(__selectResult),
    limit: () => Promise.resolve(__selectResult),
  }
  return chain
}

vi.mock('@/src/db', () => ({ db: makeChain() }))

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: (col: any, val: any) => ({ __type: 'eq', col, val }),
    and: (...conds: any[]) => ({ __type: 'and', conds: conds.filter(Boolean) }),
    asc: (col: any) => ({ __type: 'asc', col }),
    desc: (col: any) => ({ __type: 'desc', col }),
    inArray: (col: any, values: any) => ({ __type: 'inArray', col, values }),
    exists: (sub: any) => ({ __type: 'exists', sub }),
    sql: actual.sql,
  }
})

vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: null }) }))
vi.mock('@/src/lib/audit', () => ({ writeAuditLog: vi.fn(async () => {}) }))

import { documentRouter } from '@/src/server/routers/document'
import { createCallerFactory } from '@/src/trpc/init'

const createCaller = createCallerFactory(documentRouter)

function mkCtx(role: string, userId = 'user-1') {
  return {
    headers: new Headers(),
    userId: 'clerk-' + userId,
    user: { id: userId, role, clerkId: 'clerk-' + userId },
  } as any
}

function containsType(node: any, type: string, seen: WeakSet<object> = new WeakSet()): boolean {
  if (!node || typeof node !== 'object') return false
  if (seen.has(node)) return false
  seen.add(node)
  if (node.__type === type) return true
  if (Array.isArray(node)) return node.some((n) => containsType(n, type, seen))
  for (const key of Object.keys(node)) {
    if (containsType(node[key], type, seen)) return true
  }
  return false
}

beforeEach(() => {
  __recordedWheres = []
  __selectResult = []
})

describe('documentRouter.list scoping', () => {
  it('admin call does not add an "exists(published version)" guard', async () => {
    const caller = createCaller(mkCtx('admin'))
    await caller.list()
    // At least one where call should have fired (the main select).
    // For admins the scopeWhere is undefined, so no "exists" appears in
    // the recorded wheres.
    const anyExists = __recordedWheres.some((w) => containsType(w, 'exists'))
    expect(anyExists).toBe(false)
  })

  it('stakeholder call adds an exists-based published-version guard', async () => {
    const caller = createCaller(mkCtx('stakeholder'))
    await caller.list()
    const anyExists = __recordedWheres.some((w) => containsType(w, 'exists'))
    expect(anyExists).toBe(true)
  })

  it('observer call adds an exists-based published-version guard', async () => {
    const caller = createCaller(mkCtx('observer'))
    await caller.list()
    const anyExists = __recordedWheres.some((w) => containsType(w, 'exists'))
    expect(anyExists).toBe(true)
  })
})

describe('documentRouter.getById scoping', () => {
  it('admin call uses only the id match, no exists', async () => {
    __selectResult = [{ id: 'doc-1', title: 'Draft policy' }]
    const caller = createCaller(mkCtx('admin'))
    await caller.getById({ id: '11111111-1111-4111-8111-111111111111' })
    const anyExists = __recordedWheres.some((w) => containsType(w, 'exists'))
    expect(anyExists).toBe(false)
  })

  it('stakeholder call wraps the id match in an exists guard', async () => {
    __selectResult = [{ id: 'doc-1', title: 'Published policy' }]
    const caller = createCaller(mkCtx('stakeholder'))
    await caller.getById({ id: '11111111-1111-4111-8111-111111111111' })
    const anyExists = __recordedWheres.some((w) => containsType(w, 'exists'))
    expect(anyExists).toBe(true)
  })

  it('stakeholder call on a missing doc throws NOT_FOUND (not FORBIDDEN)', async () => {
    __selectResult = []
    const caller = createCaller(mkCtx('stakeholder'))
    await expect(
      caller.getById({ id: '11111111-1111-4111-8111-111111111111' }),
    ).rejects.toThrow(/not found/i)
  })
})

describe('documentRouter.getSections scoping', () => {
  it('admin call does not add an inArray assignment guard', async () => {
    const caller = createCaller(mkCtx('admin'))
    await caller.getSections({ documentId: '11111111-1111-4111-8111-111111111111' })
    const anyInArray = __recordedWheres.some((w) => containsType(w, 'inArray'))
    expect(anyInArray).toBe(false)
  })

  it('stakeholder call adds an inArray assignment guard', async () => {
    const caller = createCaller(mkCtx('stakeholder'))
    await caller.getSections({ documentId: '11111111-1111-4111-8111-111111111111' })
    const anyInArray = __recordedWheres.some((w) => containsType(w, 'inArray'))
    expect(anyInArray).toBe(true)
  })

  it('research_lead call adds an inArray assignment guard', async () => {
    const caller = createCaller(mkCtx('research_lead'))
    await caller.getSections({ documentId: '11111111-1111-4111-8111-111111111111' })
    const anyInArray = __recordedWheres.some((w) => containsType(w, 'inArray'))
    expect(anyInArray).toBe(true)
  })
})
