/**
 * Hand-rolled Google Calendar API v3 client.
 *
 * Single-tenant OAuth refresh-token model: one personal Google account
 * (env: WORKSHOP_ORGANIZER_EMAIL) owns every workshop calendar event.
 * Refresh token is loaded from GOOGLE_OAUTH_REFRESH_TOKEN; access tokens
 * are cached in-memory for ~55 minutes.
 *
 * Why hand-rolled (no `googleapis` npm): we use 5 endpoints
 * (events.insert, events.patch x3, events.delete). The googleapis package
 * is ~30MB of generated code we don't need.
 *
 * This file is the auth foundation; the 5 public client methods are
 * appended in tasks 3 and 4 of the pivot plan.
 */

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const ACCESS_TOKEN_LEEWAY_MS = 5 * 60 * 1000  // refresh 5 min before expiry

export class GoogleCalendarError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'GoogleCalendarError'
  }
}

let _cachedToken: { value: string; expiresAt: number } | null = null

export function _internal_resetTokenCache() {
  _cachedToken = null
}

export async function _internal_getAccessToken(): Promise<string> {
  const now = Date.now()
  if (_cachedToken && _cachedToken.expiresAt > now + ACCESS_TOKEN_LEEWAY_MS) {
    return _cachedToken.value
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) {
    throw new GoogleCalendarError(
      500,
      'Google OAuth env vars missing (GOOGLE_OAUTH_CLIENT_ID / _SECRET / _REFRESH_TOKEN)',
    )
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new GoogleCalendarError(
      res.status,
      `OAuth token refresh failed (${res.status}): ${body}`,
    )
  }

  const json = (await res.json()) as { access_token: string; expires_in: number }
  _cachedToken = {
    value: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  }
  return _cachedToken.value
}

async function callCalendar(
  path: string,
  init: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    body?: unknown
    query?: Record<string, string>
    headers?: Record<string, string>
  },
): Promise<unknown> {
  const url = new URL(`${CALENDAR_API}${path}`)
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v)
  }

  const doFetch = async (token: string) =>
    fetch(url.toString(), {
      method: init.method,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...(init.headers || {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })

  let token = await _internal_getAccessToken()
  let res = await doFetch(token)

  if (res.status === 401) {
    _internal_resetTokenCache()
    try {
      token = await _internal_getAccessToken()
    } catch (err) {
      if (err instanceof GoogleCalendarError) {
        throw new GoogleCalendarError(401, 'OAuth refresh failed — admin must re-authenticate')
      }
      throw err
    }
    res = await doFetch(token)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new GoogleCalendarError(
      res.status,
      `Calendar API ${init.method} ${path} failed (${res.status}): ${body}`,
    )
  }

  if (res.status === 204) return null
  return res.json()
}

type CreateWorkshopEventInput = {
  title: string
  description: string | null
  startUtc: Date
  endUtc: Date
  timezone: string
  organizerEmail: string
  meetingMode: 'auto_meet' | 'manual'
  manualMeetingUrl?: string
  reminderMinutesBefore: number[]
}

type CreateWorkshopEventResult = {
  eventId: string
  meetingUrl: string
  htmlLink: string
}

export async function createWorkshopEvent(
  input: CreateWorkshopEventInput,
): Promise<CreateWorkshopEventResult> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'

  if (input.meetingMode === 'manual') {
    if (!input.manualMeetingUrl) {
      throw new GoogleCalendarError(400, 'meetingMode=manual requires manualMeetingUrl')
    }
    try {
      const u = new URL(input.manualMeetingUrl)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') {
        throw new Error()
      }
    } catch {
      throw new GoogleCalendarError(400, 'manualMeetingUrl must be a valid http(s) URL')
    }
  }

  const body: Record<string, unknown> = {
    summary: input.title,
    description: input.description ?? undefined,
    start: { dateTime: input.startUtc.toISOString(), timeZone: input.timezone },
    end: { dateTime: input.endUtc.toISOString(), timeZone: input.timezone },
    organizer: { email: input.organizerEmail },
    guestsCanInviteOthers: false,
    guestsCanModify: false,
    reminders: {
      useDefault: false,
      overrides: input.reminderMinutesBefore.map((minutes) => ({ method: 'email', minutes })),
    },
  }

  if (input.meetingMode === 'auto_meet') {
    body.conferenceData = {
      createRequest: {
        requestId: `policydash-${crypto.randomUUID()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  } else {
    body.location = input.manualMeetingUrl
  }

  const res = (await callCalendar(`/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body,
    query: { conferenceDataVersion: '1', sendUpdates: 'all' },
  })) as {
    id: string
    htmlLink: string
    hangoutLink?: string
    conferenceData?: { entryPoints?: Array<{ entryPointType: string; uri: string }> }
  }

  let meetingUrl: string
  if (input.meetingMode === 'auto_meet') {
    meetingUrl =
      res.hangoutLink ||
      res.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
      ''
    if (!meetingUrl) {
      throw new GoogleCalendarError(
        500,
        `Auto-provisioned Meet link missing in Calendar response (eventId=${res.id})`,
      )
    }
  } else {
    meetingUrl = input.manualMeetingUrl!
  }

  return { eventId: res.id, meetingUrl, htmlLink: res.htmlLink }
}

type CalendarEventResource = {
  id: string
  etag?: string
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>
}

async function getEvent(eventId: string): Promise<CalendarEventResource> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'
  return (await callCalendar(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'GET' },
  )) as CalendarEventResource
}

const ETAG_RETRY_LIMIT = 3

export async function addAttendeeToEvent(input: {
  eventId: string
  attendeeEmail: string
  attendeeName: string
}): Promise<void> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'
  for (let attempt = 0; attempt < ETAG_RETRY_LIMIT; attempt++) {
    const event = await getEvent(input.eventId)
    const existing = event.attendees ?? []
    const lower = input.attendeeEmail.toLowerCase()
    if (existing.some((a) => a.email.toLowerCase() === lower)) {
      return
    }
    const next = [...existing, { email: input.attendeeEmail, displayName: input.attendeeName }]
    try {
      await callCalendar(
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}`,
        {
          method: 'PATCH',
          body: { attendees: next },
          query: { sendUpdates: 'all' },
          headers: event.etag ? { 'If-Match': event.etag } : {},
        },
      )
      return
    } catch (err) {
      if (err instanceof GoogleCalendarError && err.status === 412 && attempt < ETAG_RETRY_LIMIT - 1) {
        continue
      }
      throw err
    }
  }
}

export async function rescheduleEvent(input: {
  eventId: string
  newStartUtc?: Date
  newEndUtc?: Date
  newTitle?: string
  newDescription?: string | null
  newTimezone?: string
}): Promise<void> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'
  const body: Record<string, unknown> = {}
  const tz = input.newTimezone
  if (input.newTitle !== undefined) body.summary = input.newTitle
  if (input.newDescription !== undefined) body.description = input.newDescription ?? ''
  if (input.newStartUtc) {
    body.start = { dateTime: input.newStartUtc.toISOString(), timeZone: tz }
  }
  if (input.newEndUtc) {
    body.end = { dateTime: input.newEndUtc.toISOString(), timeZone: tz }
  }

  await callCalendar(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}`,
    {
      method: 'PATCH',
      body,
      query: { sendUpdates: 'all' },
    },
  )
}

export async function cancelEvent(input: { eventId: string }): Promise<void> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'
  try {
    await callCalendar(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}`,
      {
        method: 'DELETE',
        query: { sendUpdates: 'all' },
      },
    )
  } catch (err) {
    if (err instanceof GoogleCalendarError && err.status === 404) {
      return
    }
    throw err
  }
}

export async function removeAttendeeFromEvent(input: {
  eventId: string
  attendeeEmail: string
}): Promise<void> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'
  for (let attempt = 0; attempt < ETAG_RETRY_LIMIT; attempt++) {
    const event = await getEvent(input.eventId)
    const existing = event.attendees ?? []
    const lower = input.attendeeEmail.toLowerCase()
    const next = existing.filter((a) => a.email.toLowerCase() !== lower)
    if (next.length === existing.length) return
    try {
      await callCalendar(
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}`,
        {
          method: 'PATCH',
          body: { attendees: next },
          query: { sendUpdates: 'all' },
          headers: event.etag ? { 'If-Match': event.etag } : {},
        },
      )
      return
    } catch (err) {
      if (err instanceof GoogleCalendarError && err.status === 412 && attempt < ETAG_RETRY_LIMIT - 1) {
        continue
      }
      throw err
    }
  }
}
