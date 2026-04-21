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
