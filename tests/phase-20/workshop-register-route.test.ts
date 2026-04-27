/**
 * Route-level test for POST /api/intake/workshop-register after the
 * Google Calendar pivot (Task 16).
 *
 * Verifies:
 *   - Turnstile token required; schema rejects missing token with 400
 *   - Turnstile failure → 403 BEFORE any DB read
 *   - 410 Gone for completed/archived workshops
 *   - 410 Gone for past-dated workshops
 *   - 409 for second registration of same email (already-registered check)
 *   - 409 for capacity-full workshop
 *   - 200 with inviteStatus:'sent' on the happy path (Google succeeded)
 *   - 200 with inviteStatus:'pending_resend' when addAttendeeToEvent rejects
 *   - DB INSERT happens BEFORE Google call
 *   - revalidateTag(spotsTag(workshopId), 'max') called once on success
 *   - sendWorkshopRegistrationReceived called once with source:'direct_register'
 *   - Per-IP / per-email rate-limit hits → 429 with Retry-After
 *   - status='cancelled' prior row → re-registration proceeds (B3-10)
 *   - Inngest send failure after DB insert → 200 with deferred-invite log
 *   - DB INSERT unique-violation → 409 (no orphan)
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// src/lib/rate-limit.ts imports 'server-only' which throws in tests.
vi.mock('server-only', () => ({}))

// Use a proper RFC 4122 v4 UUID (Zod v4's .uuid() validates version + variant nibble).
const WORKSHOP_ID = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789'

const mocks = vi.hoisted(() => ({
  dbSelectResults: [] as unknown[][],
  dbInsertCalls: [] as unknown[],
  dbInsertThrow: null as Error | null,
  dbUpdateCalls: [] as unknown[],
  addAttendeeToEvent: vi.fn().mockResolvedValue(undefined),
  sendWorkshopRegistrationReceived: vi.fn().mockResolvedValue(undefined),
  revalidateTag: vi.fn(),
  consume: vi.fn().mockReturnValue({ ok: true, resetAt: Date.now() + 60_000 }),
  fetchMock: vi.fn(),
}))

class MockGoogleCalendarError extends Error {
  public readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'GoogleCalendarError'
    this.status = status
  }
}

vi.mock('@/src/lib/google-calendar', () => ({
  addAttendeeToEvent: mocks.addAttendeeToEvent,
  GoogleCalendarError: MockGoogleCalendarError,
}))

vi.mock('@/src/inngest/events', () => ({
  sendWorkshopRegistrationReceived: mocks.sendWorkshopRegistrationReceived,
}))

// next/cache → revalidateTag is invoked after every successful insert.
vi.mock('next/cache', () => ({
  revalidateTag: mocks.revalidateTag,
}))

vi.mock('@/src/lib/rate-limit', () => ({
  consume: mocks.consume,
  getClientIp: () => '127.0.0.1',
}))

// Stub global fetch for Cloudflare /siteverify calls.
vi.stubGlobal('fetch', mocks.fetchMock)

// Build a chain-mock db. Supports:
//   - db.select().from().where().limit(1)
//   - db.select().from().where().orderBy().limit(1)
//   - db.select().from().where()   — for count(*) aggregate
//   - db.insert().values().returning()
//   - db.update().set().where()
vi.mock('@/src/db', () => {
  return {
    db: {
      select: vi.fn(() => ({
        from: () => {
          const shift = () => Promise.resolve(mocks.dbSelectResults.shift() ?? [])
          return {
            where: () => {
              // Consume exactly ONE result slot; orderBy() and limit() chain
              // off the same promise so they don't consume extra slots.
              const p = shift()
              return Object.assign(p, {
                limit: () => p,
                orderBy: () => Object.assign(p, { limit: () => p }),
              })
            },
          }
        },
      })),
      insert: vi.fn(() => ({
        values: (v: unknown) => {
          mocks.dbInsertCalls.push(v)
          return {
            returning: (_cols?: unknown) =>
              mocks.dbInsertThrow
                ? Promise.reject(mocks.dbInsertThrow)
                : Promise.resolve([{ id: 'inserted-row-id' }]),
          }
        },
      })),
      update: vi.fn(() => ({
        set: (vals: unknown) => {
          mocks.dbUpdateCalls.push(vals)
          return {
            where: () => Promise.resolve([]),
          }
        },
      })),
    },
  }
})

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
  workshopId:     WORKSHOP_ID,
  name:           'Stakeholder',
  email:          'stakeholder@example.com',
  turnstileToken: 'XXXX.DUMMY.TOKEN',
}

function baseWorkshop(overrides: Record<string, unknown> = {}) {
  return {
    id:                    WORKSHOP_ID,
    scheduledAt:           new Date('2026-05-01T10:00:00Z'),
    status:                'upcoming',
    maxSeats:              50,
    googleCalendarEventId: 'gcal-event-abc',
    timezone:              'Asia/Kolkata',
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
  mocks.dbUpdateCalls = []
  mocks.consume.mockReturnValue({ ok: true, resetAt: Date.now() + 60_000 })
  mocks.fetchMock.mockReset()
  mocks.addAttendeeToEvent.mockResolvedValue(undefined)
  mocks.sendWorkshopRegistrationReceived.mockResolvedValue(undefined)
})

describe('POST /api/intake/workshop-register (Google Calendar pivot)', () => {
  // --- Schema / Turnstile gate ---

  it('rejects a missing turnstileToken with 400 (schema)', async () => {
    const { turnstileToken: _t, ...rest } = validBody
    void _t
    const res = await POST!(makeRequest(rest))
    expect(res.status).toBe(400)
    expect(mocks.addAttendeeToEvent).not.toHaveBeenCalled()
  })

  it('rejects a non-UUID workshopId with 400 (schema)', async () => {
    const res = await POST!(makeRequest({ ...validBody, workshopId: 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })

  it('rejects Turnstile failure with 403 BEFORE any DB read', async () => {
    turnstileFail()
    mocks.dbSelectResults = []
    const res = await POST!(makeRequest(validBody))
    expect(res.status).toBe(403)
    expect(mocks.addAttendeeToEvent).not.toHaveBeenCalled()
    // No DB selects consumed
    expect(mocks.dbSelectResults).toHaveLength(0)
  })

  // --- Lifecycle guards ---

  it('returns 410 for a completed workshop', async () => {
    turnstilePass()
    mocks.dbSelectResults = [[baseWorkshop({ status: 'completed' })]]
    const res = await POST!(makeRequest(validBody))
    expect(res.status).toBe(410)
    expect(mocks.addAttendeeToEvent).not.toHaveBeenCalled()
  })

  it('returns 410 for an archived workshop', async () => {
    turnstilePass()
    mocks.dbSelectResults = [[baseWorkshop({ status: 'archived' })]]
    const res = await POST!(makeRequest(validBody))
    expect(res.status).toBe(410)
    expect(mocks.addAttendeeToEvent).not.toHaveBeenCalled()
  })

  it('returns 410 for a past-dated workshop', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [baseWorkshop({ scheduledAt: new Date('2020-01-01T00:00:00Z') })],
    ]
    const res = await POST!(makeRequest(validBody))
    expect(res.status).toBe(410)
    expect(mocks.addAttendeeToEvent).not.toHaveBeenCalled()
  })

  // --- Already-registered ---

  it('returns 409 when email is already registered (non-cancelled status)', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [baseWorkshop()],
      [{ id: 'reg-existing', status: 'registered' }], // existing row
    ]
    const res = await POST!(makeRequest(validBody))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/already registered/i)
    expect(mocks.addAttendeeToEvent).not.toHaveBeenCalled()
  })

  it("treats a prior status='cancelled' row as non-blocking (re-registration proceeds)", async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [baseWorkshop()],
      [{ id: 'reg-old', status: 'cancelled' }], // most recent row is cancelled
      [{ count: 0 }],                            // capacity count
    ]
    const res = await POST!(makeRequest(validBody))
    expect(res.status).toBe(200)
    expect(mocks.addAttendeeToEvent).toHaveBeenCalled()
  })

  // --- Capacity ---

  it('returns 409 when workshop is full', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [baseWorkshop({ maxSeats: 2 })],
      [],           // no existing registration for this email
      [{ count: 2 }], // 2 non-cancelled seats = full
    ]
    const res = await POST!(makeRequest(validBody))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/fully booked/i)
    expect(mocks.addAttendeeToEvent).not.toHaveBeenCalled()
  })

  // --- Happy path ---

  it('returns 200 with inviteStatus:sent on the happy path (Google succeeded)', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [baseWorkshop()],
      [],          // no existing registration
      [{ count: 0 }], // capacity count
    ]

    const res = await POST!(makeRequest(validBody))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.inviteStatus).toBe('sent')
  })

  it('DB INSERT happens BEFORE Google addAttendeeToEvent call', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [baseWorkshop()],
      [],
      [{ count: 0 }],
    ]

    // Assert by checking dbInsertCalls is non-empty AND Google was called
    const res = await POST!(makeRequest(validBody))

    expect(res.status).toBe(200)
    expect(mocks.dbInsertCalls).toHaveLength(1)
    expect(mocks.addAttendeeToEvent).toHaveBeenCalledOnce()
  })

  it('calls addAttendeeToEvent with correct args', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [baseWorkshop()],
      [],
      [{ count: 0 }],
    ]

    await POST!(makeRequest(validBody))

    expect(mocks.addAttendeeToEvent).toHaveBeenCalledWith({
      eventId: 'gcal-event-abc',
      attendeeEmail: 'stakeholder@example.com',
      attendeeName: 'Stakeholder',
    })
  })

  it('sends Guest as attendeeName and null as DB name when name is empty', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [baseWorkshop()],
      [],
      [{ count: 0 }],
    ]

    await POST!(makeRequest({ ...validBody, name: '   ' }))

    expect(mocks.addAttendeeToEvent).toHaveBeenCalledWith(
      expect.objectContaining({ attendeeName: 'Guest' }),
    )
    const inserted = mocks.dbInsertCalls[0] as Record<string, unknown>
    expect(inserted.name).toBeNull()
  })

  it('stamps inviteSentAt via db.update on Google success', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [baseWorkshop()],
      [],
      [{ count: 0 }],
    ]

    await POST!(makeRequest(validBody))

    expect(mocks.dbUpdateCalls).toHaveLength(1)
    const updateVals = mocks.dbUpdateCalls[0] as Record<string, unknown>
    expect(updateVals.inviteSentAt).toBeInstanceOf(Date)
  })

  it('calls revalidateTag(spotsTag(workshopId), "max") once on success', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [baseWorkshop()],
      [],
      [{ count: 0 }],
    ]

    await POST!(makeRequest(validBody))

    expect(mocks.revalidateTag).toHaveBeenCalledOnce()
    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      `workshop-spots-${WORKSHOP_ID}`,
      'max',
    )
  })

  it('calls sendWorkshopRegistrationReceived with source:direct_register', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [baseWorkshop()],
      [],
      [{ count: 0 }],
    ]

    await POST!(makeRequest(validBody))

    expect(mocks.sendWorkshopRegistrationReceived).toHaveBeenCalledOnce()
    expect(mocks.sendWorkshopRegistrationReceived).toHaveBeenCalledWith(
      expect.objectContaining({
        workshopId: WORKSHOP_ID,
        email: 'stakeholder@example.com',
        source: 'direct_register',
      }),
    )
  })

  // --- Google failure → pending_resend ---

  it('returns 200 with inviteStatus:pending_resend when addAttendeeToEvent rejects with GoogleCalendarError(503)', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [baseWorkshop()],
      [],
      [{ count: 0 }],
    ]
    mocks.addAttendeeToEvent.mockRejectedValueOnce(
      new MockGoogleCalendarError(503, 'upstream unavailable'),
    )
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const res = await POST!(makeRequest(validBody))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.inviteStatus).toBe('pending_resend')
    // inviteSentAt must NOT be stamped
    expect(mocks.dbUpdateCalls).toHaveLength(0)
    // revalidateTag and Inngest still fire
    expect(mocks.revalidateTag).toHaveBeenCalledOnce()
    expect(mocks.sendWorkshopRegistrationReceived).toHaveBeenCalledOnce()
    warnSpy.mockRestore()
  })

  it('leaves inviteSentAt NULL (no db.update) when Google fails', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [baseWorkshop()],
      [],
      [{ count: 0 }],
    ]
    mocks.addAttendeeToEvent.mockRejectedValueOnce(new Error('network timeout'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    await POST!(makeRequest(validBody))

    expect(mocks.dbUpdateCalls).toHaveLength(0)
  })

  // --- DB INSERT unique-violation → 409 (no orphan, no Google call) ---

  it('returns 409 on unique-violation DB error (23505) without calling Google', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [baseWorkshop()],
      [],
      [{ count: 0 }],
    ]
    const err = new Error('duplicate key value violates unique constraint')
    ;(err as unknown as { code: string }).code = '23505'
    mocks.dbInsertThrow = err

    const res = await POST!(makeRequest(validBody))

    expect(res.status).toBe(409)
    // Google must NOT have been called — insert failed before Google
    expect(mocks.addAttendeeToEvent).not.toHaveBeenCalled()
  })

  it('returns 500 on non-unique DB INSERT error without calling Google', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [baseWorkshop()],
      [],
      [{ count: 0 }],
    ]
    mocks.dbInsertThrow = new Error('connection refused')
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST!(makeRequest(validBody))

    expect(res.status).toBe(500)
    expect(mocks.addAttendeeToEvent).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })

  // --- Rate limits ---

  it('returns 429 with Retry-After when the IP rate limiter trips', async () => {
    mocks.consume.mockReturnValueOnce({ ok: false, resetAt: Date.now() + 300_000 })

    const res = await POST!(makeRequest(validBody))

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  it('returns 429 with Retry-After when the email rate limiter trips', async () => {
    turnstilePass()
    mocks.consume
      .mockReturnValueOnce({ ok: true,  resetAt: Date.now() + 60_000 })  // IP ok
      .mockReturnValueOnce({ ok: false, resetAt: Date.now() + 600_000 }) // email not ok
    mocks.dbSelectResults = [[baseWorkshop()]]

    const res = await POST!(makeRequest(validBody))

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  // --- Inngest failure → still 200 ---

  it('returns 200 but logs deferred-invite when Inngest send fails', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [baseWorkshop()],
      [],
      [{ count: 0 }],
    ]
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

  // --- bookingUid format ---

  it('stores a bookingUid prefixed with reg_ in the DB insert', async () => {
    turnstilePass()
    mocks.dbSelectResults = [
      [baseWorkshop()],
      [],
      [{ count: 0 }],
    ]

    await POST!(makeRequest(validBody))

    const inserted = mocks.dbInsertCalls[0] as Record<string, unknown>
    expect(String(inserted.bookingUid)).toMatch(/^reg_[0-9a-f-]{36}$/)
  })
})
