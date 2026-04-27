import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('google-calendar — auth', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', 'test_client_id')
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', 'test_client_secret')
    vi.stubEnv('GOOGLE_OAUTH_REFRESH_TOKEN', 'test_refresh_token')
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('exchanges refresh token for access token via oauth2 endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'fresh_token', expires_in: 3600 }),
    })
    const { _internal_getAccessToken, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    const token = await _internal_getAccessToken()
    expect(token).toBe('fresh_token')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    expect(init.method).toBe('POST')
    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('test_refresh_token')
    expect(body.get('client_id')).toBe('test_client_id')
    expect(body.get('client_secret')).toBe('test_client_secret')
  })

  it('caches access token in-memory and reuses on subsequent calls', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'cached', expires_in: 3600 }),
    })
    const { _internal_getAccessToken, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    await _internal_getAccessToken()
    await _internal_getAccessToken()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws GoogleCalendarError on token exchange failure', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'invalid_grant',
    })
    const { _internal_getAccessToken, _internal_resetTokenCache, GoogleCalendarError } = await import('../google-calendar')
    _internal_resetTokenCache()
    await expect(_internal_getAccessToken()).rejects.toBeInstanceOf(GoogleCalendarError)
  })

  it('throws GoogleCalendarError when env vars are missing', async () => {
    vi.stubEnv('GOOGLE_OAUTH_REFRESH_TOKEN', '')
    const { _internal_getAccessToken, _internal_resetTokenCache, GoogleCalendarError } = await import('../google-calendar')
    _internal_resetTokenCache()
    await expect(_internal_getAccessToken()).rejects.toBeInstanceOf(GoogleCalendarError)
  })
})

describe('google-calendar — createWorkshopEvent', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', 'cid')
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', 'cs')
    vi.stubEnv('GOOGLE_OAUTH_REFRESH_TOKEN', 'rt')
    vi.stubEnv('GOOGLE_CALENDAR_ID', 'primary')
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 't', expires_in: 3600 }),
    })
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('inserts an event with auto-provisioned Meet conference', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'evt_abc',
        htmlLink: 'https://calendar.google.com/event?eid=evt_abc',
        hangoutLink: 'https://meet.google.com/aaa-bbbb-ccc',
        conferenceData: { entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/aaa-bbbb-ccc' }] },
      }),
    })
    const { createWorkshopEvent, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    const out = await createWorkshopEvent({
      title: 'Privacy Policy Workshop',
      description: 'Discuss draft v1',
      startUtc: new Date('2026-05-01T10:30:00Z'),
      endUtc: new Date('2026-05-01T11:30:00Z'),
      timezone: 'Asia/Kolkata',
      organizerEmail: 'vinit@konma.io',
      meetingMode: 'auto_meet',
      reminderMinutesBefore: [1440, 60],
    })
    expect(out.eventId).toBe('evt_abc')
    expect(out.meetingUrl).toBe('https://meet.google.com/aaa-bbbb-ccc')
    expect(out.htmlLink).toBe('https://calendar.google.com/event?eid=evt_abc')

    const insertCall = fetchMock.mock.calls[1]
    expect(insertCall[0]).toContain('/calendar/v3/calendars/primary/events')
    expect(insertCall[0]).toContain('conferenceDataVersion=1')
    expect(insertCall[0]).toContain('sendUpdates=all')
    const body = JSON.parse(insertCall[1].body)
    expect(body.summary).toBe('Privacy Policy Workshop')
    expect(body.start).toEqual({ dateTime: '2026-05-01T10:30:00.000Z', timeZone: 'Asia/Kolkata' })
    expect(body.conferenceData.createRequest.conferenceSolutionKey.type).toBe('hangoutsMeet')
    expect(body.reminders.overrides).toEqual([
      { method: 'email', minutes: 1440 },
      { method: 'email', minutes: 60 },
    ])
  })

  it('inserts an event with manual meeting link as location', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'evt_xyz',
        htmlLink: 'https://calendar.google.com/event?eid=evt_xyz',
      }),
    })
    const { createWorkshopEvent, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    const out = await createWorkshopEvent({
      title: 'Zoom Workshop',
      description: null,
      startUtc: new Date('2026-05-01T10:30:00Z'),
      endUtc: new Date('2026-05-01T11:30:00Z'),
      timezone: 'Asia/Kolkata',
      organizerEmail: 'vinit@konma.io',
      meetingMode: 'manual',
      manualMeetingUrl: 'https://zoom.us/j/123456789',
      reminderMinutesBefore: [60],
    })
    expect(out.eventId).toBe('evt_xyz')
    expect(out.meetingUrl).toBe('https://zoom.us/j/123456789')

    const body = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(body.location).toBe('https://zoom.us/j/123456789')
    expect(body.conferenceData).toBeUndefined()
  })

  it('throws GoogleCalendarError(400) when meetingMode=manual but manualMeetingUrl is missing', async () => {
    const { createWorkshopEvent, GoogleCalendarError, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    await expect(
      createWorkshopEvent({
        title: 't',
        description: null,
        startUtc: new Date('2026-05-01T10:30:00Z'),
        endUtc: new Date('2026-05-01T11:30:00Z'),
        timezone: 'Asia/Kolkata',
        organizerEmail: 'a@b.c',
        meetingMode: 'manual',
        reminderMinutesBefore: [],
      }),
    ).rejects.toBeInstanceOf(GoogleCalendarError)
  })

  it('throws GoogleCalendarError on 4xx insert', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'bad request',
    })
    const { createWorkshopEvent, GoogleCalendarError, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    await expect(
      createWorkshopEvent({
        title: 't',
        description: null,
        startUtc: new Date(),
        endUtc: new Date(Date.now() + 60_000),
        timezone: 'Asia/Kolkata',
        organizerEmail: 'a@b.c',
        meetingMode: 'auto_meet',
        reminderMinutesBefore: [],
      }),
    ).rejects.toBeInstanceOf(GoogleCalendarError)
  })

  it('throws when auto_meet response is missing hangoutLink and entryPoints', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'evt_no_meet',
        htmlLink: 'https://calendar.google.com/event?eid=evt_no_meet',
      }),
    })
    const { createWorkshopEvent, GoogleCalendarError, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    await expect(
      createWorkshopEvent({
        title: 't',
        description: null,
        startUtc: new Date('2026-05-01T10:30:00Z'),
        endUtc: new Date('2026-05-01T11:30:00Z'),
        timezone: 'Asia/Kolkata',
        organizerEmail: 'a@b.c',
        meetingMode: 'auto_meet',
        reminderMinutesBefore: [],
      }),
    ).rejects.toBeInstanceOf(GoogleCalendarError)
  })
})

describe('google-calendar — patch operations', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', 'cid')
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', 'cs')
    vi.stubEnv('GOOGLE_OAUTH_REFRESH_TOKEN', 'rt')
    vi.stubEnv('GOOGLE_CALENDAR_ID', 'primary')
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 't', expires_in: 3600 }),
    })
    vi.resetModules()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('addAttendeeToEvent fetches existing event and patches with appended attendee', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'evt1',
        attendees: [{ email: 'alice@x.com', displayName: 'Alice' }],
      }),
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'evt1' }),
    })
    const { addAttendeeToEvent, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    await addAttendeeToEvent({ eventId: 'evt1', attendeeEmail: 'bob@x.com', attendeeName: 'Bob' })
    const patchCall = fetchMock.mock.calls[2]
    expect(patchCall[1].method).toBe('PATCH')
    expect(patchCall[0]).toContain('sendUpdates=all')
    const body = JSON.parse(patchCall[1].body)
    expect(body.attendees).toEqual([
      { email: 'alice@x.com', displayName: 'Alice' },
      { email: 'bob@x.com', displayName: 'Bob' },
    ])
  })

  it('addAttendeeToEvent is idempotent — does not duplicate existing attendee (case-insensitive)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'evt1',
        attendees: [{ email: 'Bob@X.com', displayName: 'Bob' }],
      }),
    })
    const { addAttendeeToEvent, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    await addAttendeeToEvent({ eventId: 'evt1', attendeeEmail: 'bob@x.com', attendeeName: 'Bob' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('addAttendeeToEvent works when existing event has no attendees array', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'evt1' }),
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'evt1' }),
    })
    const { addAttendeeToEvent, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    await addAttendeeToEvent({ eventId: 'evt1', attendeeEmail: 'first@x.com', attendeeName: 'First' })
    const body = JSON.parse(fetchMock.mock.calls[2][1].body)
    expect(body.attendees).toEqual([{ email: 'first@x.com', displayName: 'First' }])
  })

  it('rescheduleEvent patches scheduledAt + title with sendUpdates=all', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'evt1' }),
    })
    const { rescheduleEvent, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    await rescheduleEvent({
      eventId: 'evt1',
      newStartUtc: new Date('2026-05-02T10:00:00Z'),
      newEndUtc: new Date('2026-05-02T11:00:00Z'),
      newTitle: 'Updated title',
      newTimezone: 'Asia/Kolkata',
    })
    const call = fetchMock.mock.calls[1]
    expect(call[1].method).toBe('PATCH')
    expect(call[0]).toContain('sendUpdates=all')
    const body = JSON.parse(call[1].body)
    expect(body.summary).toBe('Updated title')
    expect(body.start).toEqual({ dateTime: '2026-05-02T10:00:00.000Z', timeZone: 'Asia/Kolkata' })
    expect(body.end).toEqual({ dateTime: '2026-05-02T11:00:00.000Z', timeZone: 'Asia/Kolkata' })
  })

  it('rescheduleEvent omits unchanged fields from PATCH body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'evt1' }),
    })
    const { rescheduleEvent, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    await rescheduleEvent({
      eventId: 'evt1',
      newTitle: 'Just title',
    })
    const body = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(body.summary).toBe('Just title')
    expect(body.start).toBeUndefined()
    expect(body.end).toBeUndefined()
  })

  it('cancelEvent issues DELETE with sendUpdates=all', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      text: async () => '',
      json: async () => null,
    })
    const { cancelEvent, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    await cancelEvent({ eventId: 'evt1' })
    const call = fetchMock.mock.calls[1]
    expect(call[1].method).toBe('DELETE')
    expect(call[0]).toContain('sendUpdates=all')
  })

  it('cancelEvent treats 404 as already-cancelled (no throw)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'not found',
    })
    const { cancelEvent, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    await expect(cancelEvent({ eventId: 'evt_gone' })).resolves.toBeUndefined()
  })

  it('cancelEvent propagates non-404 errors', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'server error',
    })
    const { cancelEvent, _internal_resetTokenCache, GoogleCalendarError } = await import('../google-calendar')
    _internal_resetTokenCache()
    await expect(cancelEvent({ eventId: 'evt1' })).rejects.toBeInstanceOf(GoogleCalendarError)
  })

  it('removeAttendeeFromEvent fetches + patches with attendee removed', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'evt1',
        attendees: [
          { email: 'alice@x.com' },
          { email: 'bob@x.com' },
        ],
      }),
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'evt1' }),
    })
    const { removeAttendeeFromEvent, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    await removeAttendeeFromEvent({ eventId: 'evt1', attendeeEmail: 'bob@x.com' })
    const patchBody = JSON.parse(fetchMock.mock.calls[2][1].body)
    expect(patchBody.attendees).toEqual([{ email: 'alice@x.com' }])
  })

  it('removeAttendeeFromEvent is a no-op when attendee not in list', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'evt1',
        attendees: [{ email: 'alice@x.com' }],
      }),
    })
    const { removeAttendeeFromEvent, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    await removeAttendeeFromEvent({ eventId: 'evt1', attendeeEmail: 'bob@x.com' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
