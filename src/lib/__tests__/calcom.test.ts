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
