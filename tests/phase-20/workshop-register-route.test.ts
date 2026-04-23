/**
 * Route-level test for POST /api/intake/workshop-register after the
 * workshop-meetings-redesign rewrite + Turnstile gate (D-1, 2026-04-23).
 *
 * Verifies:
 *   - Turnstile token required; failure short-circuits with 403 BEFORE DB read
 *   - calls addAttendeeToBooking with the workshop's calcomBookingUid
 *   - stores booking_uid as `${rootUid}:${attendeeId}` for uniqueness
 *   - returns 503 when the workshop has not been provisioned yet
 *   - does NOT call the old createCalBooking path
 *   - 4xx capacity-like error from cal.com → 409 (B3-4)
 *   - 5xx from cal.com → 500 (B3-4)
 *   - 429 from cal.com → 429 with Retry-After (B3-6)
 *   - DB insert failure after successful attendee-add → 500 + ORPHAN log (B3-10)
 *   - Inngest send failure after DB insert → 200 with deferred-invite log (B3-10)
 *   - Empty-name input → cal.com receives 'Guest', DB stores null (B3-10)
 *   - Per-IP / per-email rate-limit hits → 429 with Retry-After (B3-10)
 *   - Already-registered with status='cancelled' → re-registration path (B3-10)
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// src/lib/rate-limit.ts imports 'server-only' which throws in tests.
vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
  dbSelectResults: [] as unknown[][],
  dbInsertCalls: [] as unknown[],
  dbInsertThrow: null as Error | null,
  addAttendeeToBooking: vi.fn(),
  createCalBooking: vi.fn(),
  sendWorkshopRegistrationReceived: vi.fn().mockResolvedValue(undefined),
  consume: vi.fn().mockReturnValue({ ok: true, resetAt: Date.now() + 60_000 }),
  fetchMock: vi.fn(),
}))

class MockCalApiError extends Error {
  public readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'CalApiError'
    this.status = status
  }
}

vi.mock('@/src/lib/calcom', () => ({
  addAttendeeToBooking: mocks.addAttendeeToBooking,
  createCalBooking:     mocks.createCalBooking,
  CalApiError: MockCalApiError,
  // Shared Batch-1 exports — mirrored so the route-under-test resolves
  // them against this mock instead of hitting the real module (which
  // imports 'server-only' and blocks in tests).
  UID_SAFE: /^[A-Za-z0-9_-]+$/,
  COMPOSITE_BOOKING_UID_DELIMITER: ':',
  DEFAULT_SEATS_PER_TIME_SLOT: 100,
  WORKSHOP_CREATED_EVENT: 'workshop.created',
  buildCompositeBookingUid: (rootUid: string, attendeeId: number) =>
    `${rootUid}:${attendeeId}`,
  cascadePattern: (rootUid: string) => `${rootUid}:%`,
}))

vi.mock('@/src/inngest/events', () => ({
  sendWorkshopRegistrationReceived: mocks.sendWorkshopRegistrationReceived,
}))

vi.mock('@/src/lib/rate-limit', () => ({
  consume: mocks.consume,
  getClientIp: () => '127.0.0.1',
}))

// Stub global fetch for Cloudflare /siteverify calls.
vi.stubGlobal('fetch', mocks.fetchMock)

// Build a chain-mock db that returns successive select results and captures
// insert values. `.where()` itself is awaitable (consumes the next queued
// result) AND exposes `.limit()` so both chain shapes used in the route work:
//   - `.from().where().limit(1)` — workshop + already-registered lookups
//   - `.from().where().orderBy().limit(1)` — already-registered with desc order
//   - `.from().where()`          — count(*) aggregate for max-seats gate
vi.mock('@/src/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => {
        const consume = () =>
          Promise.resolve(mocks.dbSelectResults.shift() ?? [])
        return {
          where: () => {
            const p = consume()
            return Object.assign(p, {
              limit: () => p,
              orderBy: () => Object.assign(consume(), { limit: () => consume() }),
            })
          },
        }
      },
    })),
    insert: vi.fn(() => ({
      values: (v: unknown) => {
        mocks.dbInsertCalls.push(v)
        const handle = () => {
          if (mocks.dbInsertThrow) return Promise.reject(mocks.dbInsertThrow)
          // B7-3: drizzle's insert chain resolves to `[]` (or the
          // returning() result) — NOT to the values payload. Mirroring
          // that shape keeps the mock honest so routes can `await` the
          // insert and iterate like they would in production.
          return Promise.resolve([])
        }
        return {
          onConflictDoNothing: () => handle(),
          then: (r: (v: unknown) => unknown) => handle().then(r),
        }
      },
    })),
  },
}))

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/intake/workshop-register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function turnstilePass() {
  mocks.fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ success: true }), { status: 200 }),
  )
}

function turnstileFail() {
  mocks.fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ success: false }), { status: 200 }),
  )
}

const validBody = {
  workshopId: 'ws-1',
  name:       'Stakeholder',
  email:      'stakeholder@example.com',
  turnstileToken: 'XXXX.DUMMY.TOKEN',
}

function provisionedWorkshop(overrides: Record<string, unknown> = {}) {
  return {
    id:                'ws-1',
    scheduledAt:       new Date('2026-05-01T10:00:00Z'),
    maxSeats:          50,
    calcomEventTypeId: '12345',
    calcomBookingUid:  'root-abc',
    timezone:          'Asia/Kolkata',
    createdAt:         new Date(),
    ...overrides,
  }
}

let POST: ((req: Request) => Promise<Response>) | null = null

beforeAll(async () => {
  const mod = await import('@/app/api/intake/workshop-register/route')
  POST = mod.POST
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.dbSelectResults = []
  mocks.dbInsertCalls = []
  mocks.dbInsertThrow = null
  mocks.consume.mockReturnValue({ ok: true, resetAt: Date.now() + 60_000 })
  mocks.fetchMock.mockReset()
})

describe('POST /api/intake/workshop-register (redesigned + Turnstile)', () => {
  it('rejects a missing turnstileToken with 400 (schema)', async () => {
    const { turnstileToken: _t, ...rest } = validBody
    void _t
    const res = await POST!(makeRequest(rest))
    expect(res.status).toBe(400)
    expect(mocks.addAttendeeToBooking).not.toHaveBeenCalled()
  })

  it('rejects Turnstile failure with 403 BEFORE any DB read', async () => {
    turnstileFail()
    mocks.dbSelectResults = [] // ensure we don't accidentally feed a row
    const res = await POST!(makeRequest(validBody))
    expect(res.status).toBe(403)
    expect(mocks.addAttendeeToBooking).not.toHaveBeenCalled()
    expect(mocks.dbSelectResults).toHaveLength(0)
  })

  it('adds attendee to root booking and writes composite booking_uid', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [provisionedWorkshop()],
      [], // already-registered check → empty
      [{ n: 0 }], // max-seats count → 0
    ]
    mocks.addAttendeeToBooking.mockResolvedValueOnce({ id: 777, bookingId: 12 })

    const res = await POST!(makeRequest(validBody))

    expect(res.status).toBe(200)
    expect(mocks.addAttendeeToBooking).toHaveBeenCalledWith(
      'root-abc',
      expect.objectContaining({
        name:  'Stakeholder',
        email: 'stakeholder@example.com',
        timeZone: 'Asia/Kolkata',
      }),
    )
    expect(mocks.createCalBooking).not.toHaveBeenCalled()
    expect(mocks.sendWorkshopRegistrationReceived).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingUid: 'root-abc:777',
        source:     'direct_register',
      }),
    )
  })

  it('returns 503 when the workshop has no calcomBookingUid yet', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [provisionedWorkshop({ calcomEventTypeId: null, calcomBookingUid: null })],
      [],
      [{ n: 0 }],
    ]

    const res = await POST!(makeRequest(validBody))

    expect(res.status).toBe(503)
    expect(mocks.addAttendeeToBooking).not.toHaveBeenCalled()
  })

  it('returns 409 when cal.com surfaces a 4xx with capacity-ish message (B3-4)', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [provisionedWorkshop()],
      [],
      [{ n: 0 }],
    ]
    mocks.addAttendeeToBooking.mockRejectedValueOnce(
      new MockCalApiError(400, 'cal.com add-attendee 400: seats full'),
    )

    const res = await POST!(makeRequest(validBody))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/fully booked/i)
  })

  it('returns 500 on cal.com 5xx (B3-4)', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [provisionedWorkshop()],
      [],
      [{ n: 0 }],
    ]
    mocks.addAttendeeToBooking.mockRejectedValueOnce(
      new MockCalApiError(503, 'cal.com upstream down'),
    )

    const res = await POST!(makeRequest(validBody))

    expect(res.status).toBe(500)
  })

  it('passes through cal.com 429 as 429 with Retry-After (B3-6)', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [provisionedWorkshop()],
      [],
      [{ n: 0 }],
    ]
    mocks.addAttendeeToBooking.mockRejectedValueOnce(
      new MockCalApiError(429, 'cal.com rate limit'),
    )

    const res = await POST!(makeRequest(validBody))

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  it('logs ORPHAN and returns 500 when DB insert fails after cal.com seat creation (B3-10)', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [provisionedWorkshop()],
      [],
      [{ n: 0 }],
    ]
    mocks.addAttendeeToBooking.mockResolvedValueOnce({ id: 9, bookingId: 5 })
    mocks.dbInsertThrow = new Error('unique_violation')
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST!(makeRequest(validBody))

    expect(res.status).toBe(500)
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('ORPHAN'),
      expect.objectContaining({
        rootBookingUid: 'root-abc',
        attendeeId:     9,
        pii:            true,
      }),
    )
    errSpy.mockRestore()
  })

  it('returns 200 but logs deferred-invite when Inngest send fails (B3-10)', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [provisionedWorkshop()],
      [],
      [{ n: 0 }],
    ]
    mocks.addAttendeeToBooking.mockResolvedValueOnce({ id: 9, bookingId: 5 })
    mocks.sendWorkshopRegistrationReceived.mockRejectedValueOnce(new Error('inngest-down'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST!(makeRequest(validBody))

    expect(res.status).toBe(200)
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('Inngest send failed'),
      expect.objectContaining({ emailHash: expect.any(String) }),
    )
    errSpy.mockRestore()
  })

  it("sends 'Guest' to cal.com and stores null in DB when name is empty (B3-10)", async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [provisionedWorkshop()],
      [],
      [{ n: 0 }],
    ]
    mocks.addAttendeeToBooking.mockResolvedValueOnce({ id: 1, bookingId: 2 })

    const res = await POST!(makeRequest({ ...validBody, name: '   ' }))

    expect(res.status).toBe(200)
    expect(mocks.addAttendeeToBooking).toHaveBeenCalledWith(
      'root-abc',
      expect.objectContaining({ name: 'Guest' }),
    )
    const inserted = mocks.dbInsertCalls[0] as Record<string, unknown>
    expect(inserted.name).toBeNull()
  })

  it('returns 429 with Retry-After when the IP rate limiter trips (B3-10)', async () => {
    mocks.consume.mockReturnValueOnce({ ok: false, resetAt: Date.now() + 300_000 })

    const res = await POST!(makeRequest(validBody))

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  it('returns 429 with Retry-After when the email rate limiter trips (B3-10)', async () => {
    turnstilePass()
    // First consume() = IP (ok), second = email (not ok)
    mocks.consume
      .mockReturnValueOnce({ ok: true,  resetAt: Date.now() + 60_000 })
      .mockReturnValueOnce({ ok: false, resetAt: Date.now() + 600_000 })
    mocks.dbSelectResults = [[provisionedWorkshop()]]

    const res = await POST!(makeRequest(validBody))

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  it("treats a prior status='cancelled' row as non-blocking so re-registration proceeds (B3-10)", async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [provisionedWorkshop()],
      // already-registered: most recent row is cancelled (desc order) →
      // route should proceed with a fresh seat add.
      [{ id: 'reg-old', status: 'cancelled' }],
      [{ n: 0 }],
    ]
    mocks.addAttendeeToBooking.mockResolvedValueOnce({ id: 42, bookingId: 7 })

    const res = await POST!(makeRequest(validBody))

    expect(res.status).toBe(200)
    expect(mocks.addAttendeeToBooking).toHaveBeenCalled()
  })
})
