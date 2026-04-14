import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

/**
 * Plan 20-06 Task 2 — POST /api/intake/workshop-feedback contract.
 *
 * Route handler shape (D-18, WS-15):
 *   - validates body via zod, rejects 400 on bad payload
 *   - re-verifies JWT server-side (verifyFeedbackToken), rejects 401 on null
 *   - does NOT invoke Turnstile (JWT is the proof of legitimacy)
 *   - inserts feedbackItems (source='workshop') + workshopFeedbackLinks
 *     atomically in a single db.transaction
 *   - resolves submitterId by JWT email → users lookup; falls back to
 *     workshops.createdBy when no users row exists
 *
 * Mock strategy mirrors tests/phase-20/cal-webhook-route.test.ts:
 * drizzle chain via thenable Proxy, each db.select() call consumes the next
 * queued fixture from `dbSelectResults`.
 */

function makeChainMock(resolveValue: unknown) {
  const chain: Record<string, unknown> = {}
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop: string) {
      if (prop === 'then') {
        return (onFulfilled: (v: unknown) => unknown) =>
          Promise.resolve(resolveValue).then(onFulfilled)
      }
      if (prop === 'catch') {
        return (onRejected: (e: unknown) => unknown) =>
          Promise.resolve(resolveValue).catch(onRejected)
      }
      return (..._args: unknown[]) => new Proxy(chain, handler)
    },
  }
  return new Proxy(chain, handler)
}

const mocks = vi.hoisted(() => ({
  verifyFeedbackToken: vi.fn(),
  selectQueue: [] as unknown[][],
  insertCalls: [] as Array<{ table: string; values: unknown }>,
  transactionInvocations: 0,
  feedbackInsertReturn: [{ id: 'feedback-new-id' }] as Array<{ id: string }>,
}))

vi.mock('@/src/lib/feedback-token', () => ({
  verifyFeedbackToken: mocks.verifyFeedbackToken,
}))

// Tag the inserted table so test assertions can distinguish feedback vs
// workshopFeedbackLinks inserts without depending on drizzle internals.
function tableName(arg: unknown): string {
  if (!arg || typeof arg !== 'object') return 'unknown'
  // drizzle exposes the symbol-keyed entity config; we stamp our own _tag via
  // the mock factory below to keep things simple.
  const tagged = arg as { __mockTable?: string }
  return tagged.__mockTable ?? 'unknown'
}

vi.mock('@/src/db/schema/feedback', () => ({
  feedbackItems: { __mockTable: 'feedback' },
  feedbackSourceEnum: { enumValues: ['intake', 'workshop'] },
}))

vi.mock('@/src/db/schema/workshops', () => ({
  workshops: {
    __mockTable: 'workshops',
    id: 'workshops.id',
    createdBy: 'workshops.createdBy',
  },
  workshopFeedbackLinks: {
    __mockTable: 'workshop_feedback_links',
    workshopId: 'wfl.workshopId',
    feedbackId: 'wfl.feedbackId',
  },
  workshopSectionLinks: {
    __mockTable: 'workshop_section_links',
    workshopId: 'wsl.workshopId',
    sectionId: 'wsl.sectionId',
  },
}))

vi.mock('@/src/db/schema/documents', () => ({
  policySections: {
    __mockTable: 'policy_sections',
    id: 'ps.id',
    documentId: 'ps.documentId',
  },
}))

vi.mock('@/src/db/schema/users', () => ({
  users: {
    __mockTable: 'users',
    id: 'users.id',
    email: 'users.email',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: (_a: unknown, _b: unknown) => ({ __mockOp: 'eq' }),
}))

vi.mock('@/src/db', () => ({
  db: {
    select: (..._args: unknown[]) => {
      const next = mocks.selectQueue.shift() ?? []
      return makeChainMock(next)
    },
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      mocks.transactionInvocations += 1
      const tx = {
        insert: (table: unknown) => ({
          values: (values: unknown) => {
            mocks.insertCalls.push({ table: tableName(table), values })
            return {
              returning: (_cols: unknown) =>
                Promise.resolve(mocks.feedbackInsertReturn),
              onConflictDoNothing: () => Promise.resolve(),
              then: (onFulfilled: (v: unknown) => unknown) =>
                Promise.resolve(undefined).then(onFulfilled),
            }
          },
        }),
      }
      return fn(tx)
    },
  },
}))

let POST: ((req: Request) => Promise<Response>) | null = null

beforeAll(async () => {
  const segments = ['@', 'app', 'api', 'intake', 'workshop-feedback', 'route']
  const modPath = segments.join('/')
  try {
    const mod = await import(/* @vite-ignore */ modPath)
    POST = (mod as { POST?: (req: Request) => Promise<Response> }).POST ?? null
  } catch {
    POST = null
  }
})

beforeEach(() => {
  mocks.verifyFeedbackToken.mockReset()
  mocks.selectQueue = []
  mocks.insertCalls = []
  mocks.transactionInvocations = 0
  mocks.feedbackInsertReturn = [{ id: 'feedback-new-id' }]
})

const validBody = {
  workshopId: '11111111-1111-1111-1111-111111111111',
  token: 'good.jwt.sig',
  rating: 5,
  comment: 'Extremely valuable session — the section on data retention was sharp.',
  sectionId: '22222222-2222-2222-2222-222222222222',
}

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://test/api/intake/workshop-feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/intake/workshop-feedback (Plan 20-06)', () => {
  it('RED: module is importable', () => {
    expect(POST).not.toBeNull()
  })

  it('T1: missing token → 400', async () => {
    expect(POST).not.toBeNull()
    const { token: _t, ...rest } = validBody
    void _t
    const res = await POST!(makeRequest(rest))
    expect(res.status).toBe(400)
    expect(mocks.verifyFeedbackToken).not.toHaveBeenCalled()
  })

  it('T2: invalid / expired token → 401', async () => {
    expect(POST).not.toBeNull()
    mocks.verifyFeedbackToken.mockReturnValue(null)
    const res = await POST!(makeRequest(validBody))
    expect(res.status).toBe(401)
    expect(mocks.verifyFeedbackToken).toHaveBeenCalledWith(
      validBody.token,
      validBody.workshopId,
    )
  })

  it('T3: missing comment → 400', async () => {
    expect(POST).not.toBeNull()
    const { comment: _c, ...rest } = validBody
    void _c
    const res = await POST!(makeRequest(rest))
    expect(res.status).toBe(400)
  })

  it('T4: comment > 4000 chars → 400', async () => {
    expect(POST).not.toBeNull()
    const res = await POST!(
      makeRequest({ ...validBody, comment: 'x'.repeat(4001) }),
    )
    expect(res.status).toBe(400)
  })

  it('T5: rating not in 1-5 → 400', async () => {
    expect(POST).not.toBeNull()
    const res = await POST!(makeRequest({ ...validBody, rating: 7 }))
    expect(res.status).toBe(400)
  })

  it('T6: valid payload inserts feedback + link in single transaction, returns 200', async () => {
    expect(POST).not.toBeNull()
    mocks.verifyFeedbackToken.mockReturnValue({
      workshopId: validBody.workshopId,
      email: 'alice@example.com',
      exp: Math.floor(Date.now() / 1000) + 1000,
      iat: Math.floor(Date.now() / 1000),
    })
    // select() calls in route order: workshop, policy section (sectionId
    // provided → skip workshopSectionLinks fallback), users lookup.
    mocks.selectQueue = [
      [{ id: validBody.workshopId, createdBy: 'moderator-uuid' }], // workshops
      [{ id: validBody.sectionId, documentId: 'doc-1' }], // policy_sections
      [{ id: 'alice-user-id' }], // users
    ]

    const res = await POST!(makeRequest(validBody))
    expect(res.status).toBe(200)
    const json = (await res.json()) as { ok?: boolean; feedbackId?: string }
    expect(json.ok).toBe(true)
    expect(json.feedbackId).toBe('feedback-new-id')

    expect(mocks.transactionInvocations).toBe(1)
    const tables = mocks.insertCalls.map((c) => c.table)
    expect(tables).toContain('feedback')
    expect(tables).toContain('workshop_feedback_links')

    // submitterId should be the users.id (alice-user-id), NOT the moderator
    const feedbackInsert = mocks.insertCalls.find((c) => c.table === 'feedback')!
    const values = feedbackInsert.values as Record<string, unknown>
    expect(values.submitterId).toBe('alice-user-id')
    expect(values.source).toBe('workshop')
    expect(values.isAnonymous).toBe(true)
    expect(values.body).toBe(validBody.comment)
  })

  it('T7: unknown email → submitterId falls back to workshops.createdBy', async () => {
    expect(POST).not.toBeNull()
    mocks.verifyFeedbackToken.mockReturnValue({
      workshopId: validBody.workshopId,
      email: 'ghost@nowhere.example',
      exp: Math.floor(Date.now() / 1000) + 1000,
      iat: Math.floor(Date.now() / 1000),
    })
    mocks.selectQueue = [
      [{ id: validBody.workshopId, createdBy: 'moderator-uuid' }],
      [{ id: validBody.sectionId, documentId: 'doc-1' }],
      [], // users lookup returns empty — triggers fallback
    ]

    const res = await POST!(makeRequest(validBody))
    expect(res.status).toBe(200)

    const feedbackInsert = mocks.insertCalls.find((c) => c.table === 'feedback')!
    const values = feedbackInsert.values as Record<string, unknown>
    expect(values.submitterId).toBe('moderator-uuid')
  })

  it('T8: missing sectionId → falls back to first linked section', async () => {
    expect(POST).not.toBeNull()
    mocks.verifyFeedbackToken.mockReturnValue({
      workshopId: validBody.workshopId,
      email: 'alice@example.com',
      exp: Math.floor(Date.now() / 1000) + 1000,
      iat: Math.floor(Date.now() / 1000),
    })
    const { sectionId: _s, ...bodyWithoutSection } = validBody
    void _s
    mocks.selectQueue = [
      [{ id: validBody.workshopId, createdBy: 'moderator-uuid' }], // workshops
      [{ sectionId: 'linked-section-uuid' }], // workshop_section_links (fallback)
      [{ id: 'linked-section-uuid', documentId: 'doc-1' }], // policy_sections
      [{ id: 'alice-user-id' }], // users
    ]

    const res = await POST!(makeRequest(bodyWithoutSection))
    expect(res.status).toBe(200)
    expect(mocks.insertCalls.find((c) => c.table === 'feedback')).toBeTruthy()
  })

  it('T9: no Turnstile reference in route handler source', async () => {
    // Static source check — JWT is the legitimacy proof, Turnstile MUST NOT
    // appear anywhere in the workshop-feedback route.
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const source = readFileSync(
      join(process.cwd(), 'app/api/intake/workshop-feedback/route.ts'),
      'utf8',
    )
    expect(source.toLowerCase()).not.toContain('turnstile')
  })
})
