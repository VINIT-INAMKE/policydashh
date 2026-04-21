/**
 * Unit tests for the cal.com v2 client helpers. Mocks global fetch so tests
 * never hit the real API.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// src/lib/calcom.ts imports 'server-only' which throws in tests.
vi.mock('server-only', () => ({}))

const originalFetch = globalThis.fetch

beforeEach(() => {
  vi.stubEnv('CAL_API_KEY', 'test-key')
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

function mockFetchOnce(response: {
  ok: boolean
  status?: number
  body: unknown
}) {
  globalThis.fetch = vi.fn(async () => ({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: async () => response.body,
    text: async () => JSON.stringify(response.body),
  })) as unknown as typeof fetch
}

describe('createCalEventType', () => {
  it('sends Google Meet as the event-type location', async () => {
    const { createCalEventType } = await import('@/src/lib/calcom')
    mockFetchOnce({ ok: true, body: { data: { id: 99 } } })

    await createCalEventType({
      title: 'Test Workshop',
      slug: 'workshop-1',
      durationMinutes: 60,
      seatsPerTimeSlot: 50,
    })

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string) as { locations: unknown[] }

    // Accept either the explicit "integrations:google:meet" single-type shape
    // or the {type:'integration', integration:'google-meet'} two-field shape —
    // cal.com's docs contradict themselves; both are valid. We just must not
    // be sending 'cal-video' any more.
    const serialized = JSON.stringify(body.locations)
    expect(serialized).toMatch(/google[-_:]?meet/i)
    expect(serialized).not.toMatch(/cal-video/)
  })
})

describe('createCalBooking', () => {
  it('captures the Google Meet URL from data.meetingUrl', async () => {
    const { createCalBooking } = await import('@/src/lib/calcom')
    mockFetchOnce({
      ok: true,
      body: {
        data: {
          uid: 'root-abc',
          meetingUrl: 'https://meet.google.com/abc-defg-hij',
        },
      },
    })

    const result = await createCalBooking({
      eventTypeId: 42,
      name: 'Vinay',
      email: 'vinay@konma.io',
      startTime: '2026-05-01T10:00:00.000Z',
      timeZone: 'Asia/Kolkata',
    })

    expect(result).toEqual({
      uid: 'root-abc',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
    })
  })

  it('falls back to data.location when meetingUrl is absent', async () => {
    const { createCalBooking } = await import('@/src/lib/calcom')
    mockFetchOnce({
      ok: true,
      body: {
        data: {
          uid: 'root-xyz',
          location: 'https://meet.google.com/xyz-1234-kl',
        },
      },
    })

    const result = await createCalBooking({
      eventTypeId: 42,
      name: 'Vinay',
      email: 'vinay@konma.io',
      startTime: '2026-05-01T10:00:00.000Z',
    })

    expect(result.uid).toBe('root-xyz')
    expect(result.meetingUrl).toBe('https://meet.google.com/xyz-1234-kl')
  })

  it('returns null meetingUrl when neither field is present', async () => {
    const { createCalBooking } = await import('@/src/lib/calcom')
    mockFetchOnce({
      ok: true,
      body: { data: { uid: 'root-no-meet' } },
    })

    const result = await createCalBooking({
      eventTypeId: 42,
      name: 'Vinay',
      email: 'vinay@konma.io',
      startTime: '2026-05-01T10:00:00.000Z',
    })

    expect(result.uid).toBe('root-no-meet')
    expect(result.meetingUrl).toBeNull()
  })

  it('prefers data.meetingUrl over data.location when both are present', async () => {
    // Locks in the precedence contract workshopCreatedFn depends on — if a
    // future refactor flips the ternary, this catches it.
    const { createCalBooking } = await import('@/src/lib/calcom')
    mockFetchOnce({
      ok: true,
      body: {
        data: {
          uid: 'root-both',
          meetingUrl: 'https://meet.google.com/new-xxxx-yyy',
          location:   'https://meet.google.com/old-xxxx-yyy',
        },
      },
    })

    const result = await createCalBooking({
      eventTypeId: 42,
      name: 'Vinay',
      email: 'vinay@konma.io',
      startTime: '2026-05-01T10:00:00.000Z',
    })

    expect(result.meetingUrl).toBe('https://meet.google.com/new-xxxx-yyy')
  })
})

describe('addAttendeeToBooking', () => {
  it('POSTs to /v2/bookings/{uid}/attendees with cal-api-version 2024-08-13', async () => {
    const { addAttendeeToBooking } = await import('@/src/lib/calcom')
    mockFetchOnce({
      ok: true,
      body: {
        data: {
          id: 777,
          bookingId: 12,
          email: 'stakeholder@example.com',
          name: 'Stakeholder',
        },
      },
    })

    const result = await addAttendeeToBooking('root-abc', {
      name: 'Stakeholder',
      email: 'stakeholder@example.com',
      timeZone: 'Asia/Kolkata',
    })

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.cal.com/v2/bookings/root-abc/attendees')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['cal-api-version']).toBe('2024-08-13')
    expect(headers['Authorization']).toBe('Bearer test-key')
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Stakeholder',
      email: 'stakeholder@example.com',
      timeZone: 'Asia/Kolkata',
    })
    expect(result).toEqual({ id: 777, bookingId: 12 })
  })

  it('throws CalApiError with status >= 500 on cal.com 5xx', async () => {
    const { addAttendeeToBooking, CalApiError } = await import('@/src/lib/calcom')
    mockFetchOnce({ ok: false, status: 503, body: { error: 'boom' } })

    const err = await addAttendeeToBooking('root-abc', {
      name: 'X',
      email: 'x@example.com',
      timeZone: 'UTC',
    }).catch((e) => e)

    expect(err).toBeInstanceOf(CalApiError)
    expect(err.status).toBe(503)
  })

  it('throws CalApiError with status < 500 on cal.com 4xx', async () => {
    const { addAttendeeToBooking } = await import('@/src/lib/calcom')
    mockFetchOnce({ ok: false, status: 409, body: { error: 'full' } })

    await expect(
      addAttendeeToBooking('root-abc', {
        name: 'X',
        email: 'x@example.com',
        timeZone: 'UTC',
      }),
    ).rejects.toMatchObject({ name: 'CalApiError', status: 409 })
  })

  it('throws CalApiError(400) when CAL_API_KEY is missing', async () => {
    vi.stubEnv('CAL_API_KEY', '')
    const { addAttendeeToBooking } = await import('@/src/lib/calcom')

    await expect(
      addAttendeeToBooking('root-abc', {
        name: 'X',
        email: 'x@example.com',
        timeZone: 'UTC',
      }),
    ).rejects.toMatchObject({ name: 'CalApiError', status: 400 })
  })

  it('wraps network failure as CalApiError(500) so Inngest retries', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNRESET')
    }) as unknown as typeof fetch
    const { addAttendeeToBooking } = await import('@/src/lib/calcom')

    await expect(
      addAttendeeToBooking('root-abc', {
        name: 'X',
        email: 'x@example.com',
        timeZone: 'UTC',
      }),
    ).rejects.toMatchObject({ name: 'CalApiError', status: 500 })
  })

  it('throws CalApiError(500) when response is missing data.id', async () => {
    const { addAttendeeToBooking } = await import('@/src/lib/calcom')
    mockFetchOnce({ ok: true, body: { data: {} } })

    await expect(
      addAttendeeToBooking('root-abc', {
        name: 'X',
        email: 'x@example.com',
        timeZone: 'UTC',
      }),
    ).rejects.toMatchObject({ name: 'CalApiError', status: 500 })
  })
})
