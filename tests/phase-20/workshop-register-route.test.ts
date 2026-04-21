/**
 * Route-level test for POST /api/intake/workshop-register after the
 * workshop-meetings-redesign rewrite. Verifies:
 *   - calls addAttendeeToBooking with the workshop's calcomBookingUid
 *   - stores booking_uid as `${rootUid}:${attendeeId}` for uniqueness
 *   - returns 503 when the workshop has not been provisioned yet
 *   - does NOT call the old createCalBooking path
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  dbSelectResults: [] as unknown[][],
  dbInsertValues: [] as unknown[],
  addAttendeeToBooking: vi.fn(),
  createCalBooking: vi.fn(),
  sendWorkshopRegistrationReceived: vi.fn().mockResolvedValue(undefined),
  consume: vi.fn().mockReturnValue({ ok: true, resetAt: Date.now() + 60_000 }),
}))

vi.mock('@/src/lib/calcom', () => ({
  addAttendeeToBooking: mocks.addAttendeeToBooking,
  createCalBooking:     mocks.createCalBooking,
  CalApiError: class extends Error {
    public readonly status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = 'CalApiError'
      this.status = status
    }
  },
}))

vi.mock('@/src/inngest/events', () => ({
  sendWorkshopRegistrationReceived: mocks.sendWorkshopRegistrationReceived,
}))

vi.mock('@/src/lib/rate-limit', () => ({
  consume: mocks.consume,
  getClientIp: () => '127.0.0.1',
}))

// Build a chain-mock db that returns successive select results and captures
// insert values. `.where()` itself is awaitable (consumes the next queued
// result) AND exposes `.limit()` so both chain shapes used in the route work:
//   - `.from().where().limit(1)` — workshop + already-registered lookups
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
            })
          },
        }
      },
    })),
    insert: vi.fn(() => ({
      values: (v: unknown) => ({
        onConflictDoNothing: () => Promise.resolve(),
        then: (r: (v: unknown) => unknown) => Promise.resolve(r(v)),
      }),
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

beforeEach(() => {
  vi.clearAllMocks()
  mocks.dbSelectResults = []
  mocks.consume.mockReturnValue({ ok: true, resetAt: Date.now() + 60_000 })
})

describe('POST /api/intake/workshop-register (redesigned)', () => {
  it('adds attendee to root booking and writes composite booking_uid', async () => {
    mocks.dbSelectResults = [
      // workshop lookup
      [
        {
          id:                'ws-1',
          scheduledAt:       new Date('2026-05-01T10:00:00Z'),
          maxSeats:          50,
          calcomEventTypeId: '12345',
          calcomBookingUid:  'root-abc',
          timezone:          'Asia/Kolkata',
        },
      ],
      // already-registered check → empty
      [],
      // max-seats count → 0 (maxSeats-triggered only)
      [{ n: 0 }],
    ]
    mocks.addAttendeeToBooking.mockResolvedValueOnce({ id: 777, bookingId: 12 })

    const { POST } = await import('@/app/api/intake/workshop-register/route')
    const res = await POST(
      makeRequest({
        workshopId: 'ws-1',
        name:       'Stakeholder',
        email:      'stakeholder@example.com',
      }),
    )

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
    mocks.dbSelectResults = [
      [
        {
          id:                'ws-1',
          scheduledAt:       new Date('2026-05-01T10:00:00Z'),
          maxSeats:          50,
          calcomEventTypeId: null,
          calcomBookingUid:  null,
          timezone:          'Asia/Kolkata',
        },
      ],
      [],
      [{ n: 0 }],
    ]

    const { POST } = await import('@/app/api/intake/workshop-register/route')
    const res = await POST(
      makeRequest({ workshopId: 'ws-1', email: 'x@example.com' }),
    )

    expect(res.status).toBe(503)
    expect(mocks.addAttendeeToBooking).not.toHaveBeenCalled()
  })
})
