import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- DB mock ---------------------------------------------------------------
// Mocks drizzle's chainable query builder. Tests set __rows per case.
let __rows: any[] = []
const __dbCalls: any = { lastWhereConditionCount: 0 }

function makeChain() {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    leftJoin: () => chain,
    where: (cond: any) => {
      // If called with and(...conds), length is approximated via cond?._conds
      __dbCalls.lastWhereConditionCount = cond?.__count ?? (cond === undefined ? 0 : 1)
      return chain
    },
    orderBy: () => Promise.resolve(__rows),
  }
  return chain
}

vi.mock('@/src/db', () => ({
  db: makeChain(),
}))

// --- drizzle-orm helpers mock ----------------------------------------------
// Provide fake eq/and/desc/asc/sql that record conditions for assertions
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    eq: (col: any, val: any) => ({ __type: 'eq', col, val }),
    and: (...conds: any[]) => ({ __type: 'and', __count: conds.length, conds }),
    desc: (col: any) => ({ __type: 'desc', col }),
    asc: (col: any) => ({ __type: 'asc', col }),
    sql: actual.sql,
  }
})

// --- Clerk mock ------------------------------------------------------------
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: null }),
}))

// --- Services + audit mocks (to avoid DB usage in import chain) ------------
vi.mock('@/src/lib/audit', () => ({ writeAuditLog: vi.fn(async () => {}) }))
vi.mock('@/src/lib/notifications', () => ({ createNotification: vi.fn(async () => {}) }))
vi.mock('@/src/lib/email', () => ({ sendFeedbackReviewedEmail: vi.fn(async () => {}) }))
vi.mock('@/src/server/services/feedback.service', () => ({
  transitionFeedback: vi.fn(async () => ({})),
}))
vi.mock('@/src/server/rbac/section-access', () => ({
  requireSectionAccess: () => (opts: any) => opts.next(),
}))

// --- Import AFTER mocks ----------------------------------------------------
import { feedbackRouter } from '@/src/server/routers/feedback'
import { createCallerFactory } from '@/src/trpc/init'

const createCaller = createCallerFactory(feedbackRouter)

function mkCtx(role: string, userId = 'user-1') {
  return {
    headers: new Headers(),
    userId: 'clerk-' + userId,
    user: { id: userId, role, clerkId: 'clerk-' + userId },
  } as any
}

const ROW_A = {
  id: 'fb-1',
  readableId: 'FB-001',
  sectionId: 'sec-1',
  documentId: 'doc-1',
  submitterId: 'user-1',
  submitterName: 'Alice',
  submitterOrgType: 'government',
  feedbackType: 'issue',
  priority: 'high',
  impactCategory: 'legal',
  title: 'Row A',
  body: 'body',
  status: 'submitted',
  isAnonymous: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}
const ROW_B_ANON = {
  id: 'fb-2',
  readableId: 'FB-002',
  sectionId: 'sec-2',
  documentId: 'doc-2',
  submitterId: 'user-2',
  submitterName: 'Bob',
  submitterOrgType: 'industry',
  feedbackType: 'suggestion',
  priority: 'medium',
  impactCategory: 'clarity',
  title: 'Row B anon',
  body: 'body',
  status: 'submitted',
  isAnonymous: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

beforeEach(() => {
  __rows = []
  __dbCalls.lastWhereConditionCount = 0
})

describe('feedback.listCrossPolicy', () => {
  it('returns all feedback for caller with feedback:read_all (admin)', async () => {
    __rows = [ROW_A, ROW_B_ANON]
    const caller = createCaller(mkCtx('admin'))
    const result = await caller.listCrossPolicy({})
    expect(result).toHaveLength(2)
    // Admin can see anonymous identity
    expect(result.find((r: any) => r.id === 'fb-2')?.submitterName).toBe('Bob')
  })

  it('returns only own submissions for caller with feedback:read_own (stakeholder)', async () => {
    __rows = [ROW_A] // Simulates db filter — caller is user-1 and ROW_A.submitterId = user-1
    const caller = createCaller(mkCtx('stakeholder', 'user-1'))
    const result = await caller.listCrossPolicy({})
    // Ensured by assertion on lastWhereConditionCount: submitter filter applied
    expect(__dbCalls.lastWhereConditionCount).toBeGreaterThanOrEqual(1)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('fb-1')
  })

  it('filters by policyId when read_all caller passes it', async () => {
    __rows = [ROW_A]
    const caller = createCaller(mkCtx('admin'))
    await caller.listCrossPolicy({ policyId: '11111111-1111-4111-8111-111111111111' })
    // admin has read_all → no submitter filter, but policyId adds 1 condition
    expect(__dbCalls.lastWhereConditionCount).toBe(1)
  })

  it('filters by status when read_all caller passes it', async () => {
    __rows = [ROW_A]
    const caller = createCaller(mkCtx('admin'))
    await caller.listCrossPolicy({ status: 'submitted' })
    expect(__dbCalls.lastWhereConditionCount).toBe(1)
  })

  it('nulls anonymous submitter identity for non admin/policy_lead callers', async () => {
    // Auditor has read_all but NOT admin/policy_lead → should null anonymous identity
    __rows = [ROW_B_ANON]
    const caller = createCaller(mkCtx('auditor'))
    const result = await caller.listCrossPolicy({})
    expect(result).toHaveLength(1)
    expect(result[0].submitterId).toBeNull()
    expect(result[0].submitterName).toBeNull()
    expect(result[0].submitterOrgType).toBeNull()
  })
})
