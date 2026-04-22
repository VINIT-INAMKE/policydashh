import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

/**
 * Plan 20-06 Task 2 - POST /api/intake/workshop-feedback contract (updated
 * for post-E8/S15/B13/B14 route).
 *
 * Route behaviour (current production):
 *   - validates body via zod, rejects 400 on bad payload
 *   - re-verifies JWT server-side (verifyFeedbackToken), rejects 401 on null
 *   - does NOT invoke Turnstile (JWT is the proof of legitimacy)
 *   - burns a single-use nonce via workshopFeedbackTokenNonces before any
 *     downstream work (S15/B13); on conflict responds 401
 *   - resolves submitterId by JWT email → users lookup; returns 409 with a
 *     clear error if no users row exists (E8: no fallback to workshop.createdBy)
 *   - generates a sequential FB-### readable id via `feedback_id_seq` (B14)
 *   - inserts feedbackItems + workshopFeedbackLinks atomically in a single
 *     db.transaction
 */

// rate-limit.ts imports 'server-only' which throws in tests.
vi.mock('server-only', () => ({}))

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
  hashFeedbackToken: vi.fn((t: string) => `hashed:${t}`),
  selectQueue: [] as unknown[][],
  insertCalls: [] as Array<{ table: string; values: unknown }>,
  // Default: nonce insert returns 1 row (success). Tests can override to []
  // to simulate "token already used".
  nonceInsertReturn: [{ tokenHash: 'hashed:good.jwt.sig' }] as Array<{
    tokenHash: string
  }>,
  transactionInvocations: 0,
  feedbackInsertReturn: [{ id: 'feedback-new-id' }] as Array<{ id: string }>,
  dbExecuteResult: { rows: [{ seq: 1 }] } as { rows: Array<Record<string, unknown>> },
}))

vi.mock('@/src/lib/feedback-token', () => ({
  verifyFeedbackToken: mocks.verifyFeedbackToken,
  hashFeedbackToken: mocks.hashFeedbackToken,
}))

function tableName(arg: unknown): string {
  if (!arg || typeof arg !== 'object') return 'unknown'
  const tagged = arg as { __mockTable?: string }
  return tagged.__mockTable ?? 'unknown'
}

vi.mock('@/src/db/schema/feedback', () => ({
  feedbackItems: { __mockTable: 'feedback' },
  feedbackSourceEnum: { enumValues: ['intake', 'workshop'] },
  workshopFeedbackTokenNonces: {
    __mockTable: 'workshop_feedback_token_nonces',
    tokenHash: 'nonce.tokenHash',
  },
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
  sql: (strings: TemplateStringsArray, ..._values: unknown[]) => ({
    __mockSql: strings.join(''),
  }),
}))

vi.mock('@/src/db', () => ({
  db: {
    select: (..._args: unknown[]) => {
      const next = mocks.selectQueue.shift() ?? []
      return makeChainMock(next)
    },
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        mocks.insertCalls.push({ table: tableName(table), values })
        const chain = {
          onConflictDoNothing: (_target?: unknown) => ({
            returning: (_cols?: unknown) =>
              Promise.resolve(mocks.nonceInsertReturn),
          }),
          returning: (_cols?: unknown) =>
            Promise.resolve(mocks.feedbackInsertReturn),
          then: (onFulfilled: (v: unknown) => unknown) =>
            Promise.resolve(undefined).then(onFulfilled),
        }
        return chain
      },
    }),
    execute: (_sql: unknown) => Promise.resolve(mocks.dbExecuteResult),
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
  mocks.hashFeedbackToken.mockImplementation((t: string) => `hashed:${t}`)
  mocks.selectQueue = []
  mocks.insertCalls = []
  mocks.transactionInvocations = 0
  mocks.feedbackInsertReturn = [{ id: 'feedback-new-id' }]
  mocks.nonceInsertReturn = [{ tokenHash: 'hashed:good.jwt.sig' }]
  mocks.dbExecuteResult = { rows: [{ seq: 1 }] }
})

const validBody = {
  workshopId: '11111111-1111-1111-1111-111111111111',
  token: 'good.jwt.sig',
  rating: 5,
  comment: 'Extremely valuable session - the section on data retention was sharp.',
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
    // Post-nonce-burn select sequence: workshops, policy_sections (sectionId
    // provided → skip workshopSectionLinks fallback), users lookup.
    mocks.selectQueue = [
      [{ id: validBody.workshopId }], // workshops (route no longer selects createdBy — E8)
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
    // Nonce burn happens BEFORE the transaction (S15/B13 race fix).
    expect(tables).toContain('workshop_feedback_token_nonces')
    expect(tables).toContain('feedback')
    expect(tables).toContain('workshop_feedback_links')

    const feedbackInsert = mocks.insertCalls.find((c) => c.table === 'feedback')!
    const values = feedbackInsert.values as Record<string, unknown>
    expect(values.submitterId).toBe('alice-user-id')
    expect(values.source).toBe('workshop')
    expect(values.isAnonymous).toBe(true)
    expect(values.body).toBe(validBody.comment)
  })

  it('T7: unknown email → 409 (E8: no fallback to workshops.createdBy)', async () => {
    expect(POST).not.toBeNull()
    mocks.verifyFeedbackToken.mockReturnValue({
      workshopId: validBody.workshopId,
      email: 'ghost@nowhere.example',
      exp: Math.floor(Date.now() / 1000) + 1000,
      iat: Math.floor(Date.now() / 1000),
    })
    mocks.selectQueue = [
      [{ id: validBody.workshopId }], // workshops
      [{ id: validBody.sectionId, documentId: 'doc-1' }], // policy_sections
      [], // users lookup returns empty - should now 409
    ]

    const res = await POST!(makeRequest(validBody))
    expect(res.status).toBe(409)
    // No feedback row should be inserted when the submitter can't be resolved.
    const feedbackInsert = mocks.insertCalls.find((c) => c.table === 'feedback')
    expect(feedbackInsert).toBeUndefined()
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
      [{ id: validBody.workshopId }], // workshops
      [{ sectionId: 'linked-section-uuid' }], // workshop_section_links (fallback)
      [{ id: 'linked-section-uuid', documentId: 'doc-1' }], // policy_sections
      [{ id: 'alice-user-id' }], // users
    ]

    const res = await POST!(makeRequest(bodyWithoutSection))
    expect(res.status).toBe(200)
    expect(mocks.insertCalls.find((c) => c.table === 'feedback')).toBeTruthy()
  })

  it('T9: no Turnstile reference in route handler source', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const source = readFileSync(
      join(process.cwd(), 'app/api/intake/workshop-feedback/route.ts'),
      'utf8',
    )
    expect(source.toLowerCase()).not.toContain('turnstile')
  })

  it('T10: nonce conflict (token already used) → 401', async () => {
    // S15/B13: concurrent double-submit is caught by the unique constraint on
    // workshopFeedbackTokenNonces.tokenHash. When the INSERT ... ON CONFLICT
    // DO NOTHING RETURNING returns an empty array, the route short-circuits.
    expect(POST).not.toBeNull()
    mocks.verifyFeedbackToken.mockReturnValue({
      workshopId: validBody.workshopId,
      email: 'alice@example.com',
      exp: Math.floor(Date.now() / 1000) + 1000,
      iat: Math.floor(Date.now() / 1000),
    })
    mocks.nonceInsertReturn = [] // simulate conflict
    const res = await POST!(makeRequest(validBody))
    expect(res.status).toBe(401)
    // Downstream work must not have fired.
    const feedbackInsert = mocks.insertCalls.find((c) => c.table === 'feedback')
    expect(feedbackInsert).toBeUndefined()
  })
})
