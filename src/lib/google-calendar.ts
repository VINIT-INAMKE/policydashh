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
  init: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; query?: Record<string, string> },
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
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })

  let token = await _internal_getAccessToken()
  let res = await doFetch(token)

  if (res.status === 401) {
    _internal_resetTokenCache()
    token = await _internal_getAccessToken()
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

export const _internal_callCalendar = callCalendar

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

  if (input.meetingMode === 'manual' && !input.manualMeetingUrl) {
    throw new GoogleCalendarError(400, 'meetingMode=manual requires manualMeetingUrl')
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
        requestId: `policydash-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
