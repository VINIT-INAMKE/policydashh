# Google Calendar Workshop Pivot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cal.com workshop integration with direct Google Calendar API calls (single OAuth account, sync writes), keep Inngest only for genuinely-async work (reminders, feedback fan-out, transcription).

**Architecture:** Single-tenant OAuth refresh-token client (`src/lib/google-calendar.ts`). Sync Google writes from `workshop.create | update | delete` and `POST /api/intake/workshop-register`. Workshops are ONE Google Calendar event with attendees added incrementally via `events.patch`. New `workshopRemindersScheduledFn` Inngest fn handles 24h+1h reminder fan-out via `step.sleepUntil` with re-query on wake. Cal.com files deleted entirely; no dual-mode.

**Tech Stack:** Next.js 16, tRPC v11, Drizzle ORM (neon-http), Zod 4, Inngest v4, Vitest, React Email, Resend, Google Calendar API v3 (hand-rolled fetch client, no `googleapis` dep).

**Spec:** `docs/superpowers/specs/2026-04-28-google-calendar-workshop-pivot-design.md`

---

## File Structure

**New files:**
- `src/lib/google-calendar.ts` — OAuth + Calendar client (5 methods)
- `src/lib/__tests__/google-calendar.test.ts`
- `scripts/google-oauth-bootstrap.mjs` — one-time refresh-token getter
- `scripts/apply-migration-0032.mjs`
- `scripts/apply-migration-0033.mjs`
- `src/db/migrations/0032_workshops_google_calendar.sql`
- `src/db/migrations/0033_drop_processed_webhook_events.sql`
- `src/lib/email-templates/workshop-reminder.tsx`
- `src/inngest/functions/workshop-reminders-scheduled.ts`
- `src/inngest/__tests__/workshop-reminders-scheduled.test.ts`
- `src/server/routers/__tests__/workshop-end.test.ts`
- `src/server/routers/__tests__/workshop-attendance.test.ts`

**Modified files:**
- `src/db/schema/workshops.ts`
- `src/db/schema/index.ts`
- `src/inngest/events.ts`
- `src/inngest/functions/index.ts`
- `src/server/routers/workshop.ts`
- `app/api/intake/workshop-register/route.ts`
- `app/workshop-manage/new/page.tsx`
- `app/workshop-manage/[id]/edit/page.tsx`
- `app/workshop-manage/[id]/page.tsx`
- `app/workshop-manage/[id]/_components/attendee-list.tsx`
- `app/workshops/page.tsx` (or wherever public listing gate lives)
- `src/server/queries/workshops-public.ts`
- `src/lib/email.ts` (drop orphan helper, add reminder helper)
- `tests/phase-20/workshop-register-route.test.ts`
- `.env.example`

**Deleted files:**
- `src/lib/calcom.ts`
- `src/lib/cal-signature.ts`
- `app/api/webhooks/cal/route.ts`
- `src/inngest/functions/workshop-created.ts`
- `src/inngest/functions/workshop-registration-orphan.ts`
- `src/inngest/__tests__/workshop-created.test.ts`
- `src/db/schema/processed-webhook-events.ts`
- `tests/phase-20/cal-webhook-route.test.ts`
- `app/workshop-manage/[id]/_components/missing-meeting-url-alert.tsx`

---

## Phase 1 — Google Calendar Foundation

### Task 1: OAuth bootstrap script

**Files:**
- Create: `scripts/google-oauth-bootstrap.mjs`
- Create: `docs/superpowers/setup/google-calendar-oauth.md`

- [ ] **Step 1: Write the bootstrap script**

```javascript
// scripts/google-oauth-bootstrap.mjs
#!/usr/bin/env node
/**
 * One-time helper: prints consent URL, captures auth code from local
 * redirect, exchanges for a refresh token, prints .env.local snippet.
 *
 * Usage: node scripts/google-oauth-bootstrap.mjs
 * Requires GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET in env or argv.
 */
import http from 'node:http'
import { URL } from 'node:url'
import { createInterface } from 'node:readline'

const REDIRECT_PORT = 3000
const REDIRECT_PATH = '/api/google-oauth-callback'
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}${REDIRECT_PATH}`
const SCOPES = ['https://www.googleapis.com/auth/calendar.events']

const rl = createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise((res) => rl.question(q, res))

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || (await ask('Client ID: '))
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || (await ask('Client Secret: '))

const consentUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
consentUrl.searchParams.set('client_id', clientId)
consentUrl.searchParams.set('redirect_uri', REDIRECT_URI)
consentUrl.searchParams.set('response_type', 'code')
consentUrl.searchParams.set('scope', SCOPES.join(' '))
consentUrl.searchParams.set('access_type', 'offline')
consentUrl.searchParams.set('prompt', 'consent')

console.log('\n1. Open this URL in your browser:\n')
console.log(consentUrl.toString())
console.log(`\n2. After consent, Google will redirect to ${REDIRECT_URI} with ?code=...\n`)
console.log(`3. This script is listening on port ${REDIRECT_PORT}.\n`)

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    if (!req.url?.startsWith(REDIRECT_PATH)) {
      res.writeHead(404).end()
      return
    }
    const u = new URL(req.url, `http://localhost:${REDIRECT_PORT}`)
    const c = u.searchParams.get('code')
    const err = u.searchParams.get('error')
    if (err) {
      res.writeHead(500, { 'content-type': 'text/plain' }).end(`OAuth error: ${err}`)
      server.close()
      reject(new Error(err))
      return
    }
    res.writeHead(200, { 'content-type': 'text/plain' }).end('OK — you can close this tab.')
    server.close()
    resolve(c)
  })
  server.listen(REDIRECT_PORT)
})

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  }),
})

if (!tokenRes.ok) {
  console.error('Token exchange failed:', await tokenRes.text())
  process.exit(1)
}

const json = await tokenRes.json()
console.log('\n✔ Refresh token obtained. Drop this into .env.local:\n')
console.log(`GOOGLE_OAUTH_CLIENT_ID=${clientId}`)
console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${clientSecret}`)
console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${json.refresh_token}`)
console.log(`WORKSHOP_ORGANIZER_EMAIL=vinit@konma.io`)
console.log(`GOOGLE_CALENDAR_ID=primary`)

rl.close()
```

- [ ] **Step 2: Write the OAuth setup doc**

```markdown
# Google Calendar OAuth setup

One-time setup to connect a personal Google account so the platform can
create workshop calendar events and invite attendees.

## Steps

1. Go to https://console.cloud.google.com/ → select or create a project
2. APIs & Services → Library → search "Google Calendar API" → Enable
3. APIs & Services → OAuth consent screen
   - User type: **Internal** (if your konma.io domain is a Workspace)
     OR **External** + add your account as a Test User
   - Scopes: add `.../auth/calendar.events`
4. APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000/api/google-oauth-callback`
   - Copy the Client ID + Client Secret
5. Run the bootstrap script (it will open a consent URL and capture the code):

   ```
   GOOGLE_OAUTH_CLIENT_ID=... GOOGLE_OAUTH_CLIENT_SECRET=... \
     node scripts/google-oauth-bootstrap.mjs
   ```

6. Drop the printed env-var block into `.env.local`. Restart the dev server.

## Token refresh

Refresh tokens don't expire unless explicitly revoked. If `vinit@konma.io`
revokes the app at https://myaccount.google.com/permissions, every Calendar
API call returns 401 — re-run the bootstrap script and replace the
`GOOGLE_OAUTH_REFRESH_TOKEN` env var.
```

- [ ] **Step 3: Commit**

```bash
git add scripts/google-oauth-bootstrap.mjs docs/superpowers/setup/google-calendar-oauth.md
git commit -m "feat(google-calendar): OAuth bootstrap script + setup doc"
```

---

### Task 2: Google Calendar client — auth + getAccessToken (TDD)

**Files:**
- Create: `src/lib/__tests__/google-calendar.test.ts`
- Create: `src/lib/google-calendar.ts`

- [ ] **Step 1: Write failing tests for getAccessToken**

```typescript
// src/lib/__tests__/google-calendar.test.ts
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
    const { _internal_getAccessToken } = await import('../google-calendar')
    const token = await _internal_getAccessToken()
    expect(token).toBe('fresh_token')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    expect(init.method).toBe('POST')
    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('test_refresh_token')
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
})
```

- [ ] **Step 2: Run test — expect FAIL (module missing)**

```bash
npx vitest run src/lib/__tests__/google-calendar.test.ts
```
Expected: `Cannot find module '../google-calendar'`

- [ ] **Step 3: Write the auth module**

```typescript
// src/lib/google-calendar.ts
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/lib/__tests__/google-calendar.test.ts
```
Expected: 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/google-calendar.ts src/lib/__tests__/google-calendar.test.ts
git commit -m "feat(google-calendar): OAuth refresh-token auth + access-token cache"
```

---

### Task 3: Google Calendar client — createWorkshopEvent (TDD)

**Files:**
- Modify: `src/lib/google-calendar.ts` (append)
- Modify: `src/lib/__tests__/google-calendar.test.ts` (append)

- [ ] **Step 1: Write failing tests**

Append to `src/lib/__tests__/google-calendar.test.ts`:

```typescript
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
})
```

- [ ] **Step 2: Run — expect FAIL (`createWorkshopEvent is not exported`)**

```bash
npx vitest run src/lib/__tests__/google-calendar.test.ts
```

- [ ] **Step 3: Implement createWorkshopEvent**

Append to `src/lib/google-calendar.ts`:

```typescript
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
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run src/lib/__tests__/google-calendar.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/google-calendar.ts src/lib/__tests__/google-calendar.test.ts
git commit -m "feat(google-calendar): createWorkshopEvent with auto/manual meet modes"
```

---

### Task 4: Google Calendar client — addAttendee + reschedule + remove (TDD)

**Files:**
- Modify: `src/lib/google-calendar.ts`
- Modify: `src/lib/__tests__/google-calendar.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/lib/__tests__/google-calendar.test.ts`:

```typescript
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

  it('addAttendeeToEvent is idempotent — does not duplicate existing attendee', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'evt1',
        attendees: [{ email: 'bob@x.com', displayName: 'Bob' }],
      }),
    })
    const { addAttendeeToEvent, _internal_resetTokenCache } = await import('../google-calendar')
    _internal_resetTokenCache()
    await addAttendeeToEvent({ eventId: 'evt1', attendeeEmail: 'bob@x.com', attendeeName: 'Bob' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
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
  })

  it('cancelEvent issues DELETE with sendUpdates=all', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
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
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement the four operations**

Append to `src/lib/google-calendar.ts`:

```typescript
type CalendarEventResource = {
  id: string
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>
}

async function getEvent(eventId: string): Promise<CalendarEventResource> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'
  return (await callCalendar(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'GET' },
  )) as CalendarEventResource
}

export async function addAttendeeToEvent(input: {
  eventId: string
  attendeeEmail: string
  attendeeName: string
}): Promise<void> {
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary'
  const event = await getEvent(input.eventId)
  const existing = event.attendees ?? []
  const lower = input.attendeeEmail.toLowerCase()
  if (existing.some((a) => a.email.toLowerCase() === lower)) {
    return
  }
  const next = [...existing, { email: input.attendeeEmail, displayName: input.attendeeName }]
  await callCalendar(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}`,
    {
      method: 'PATCH',
      body: { attendees: next },
      query: { sendUpdates: 'all' },
    },
  )
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
  const event = await getEvent(input.eventId)
  const existing = event.attendees ?? []
  const lower = input.attendeeEmail.toLowerCase()
  const next = existing.filter((a) => a.email.toLowerCase() !== lower)
  if (next.length === existing.length) return
  await callCalendar(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}`,
    {
      method: 'PATCH',
      body: { attendees: next },
      query: { sendUpdates: 'all' },
    },
  )
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npx vitest run src/lib/__tests__/google-calendar.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/google-calendar.ts src/lib/__tests__/google-calendar.test.ts
git commit -m "feat(google-calendar): addAttendee + reschedule + cancel + removeAttendee"
```

---

## Phase 2 — Schema, Migration, Cleanup foundation

### Task 5: Migration 0032 — Google Calendar schema

**Files:**
- Create: `src/db/migrations/0032_workshops_google_calendar.sql`
- Create: `scripts/apply-migration-0032.mjs`
- Modify: `src/db/schema/workshops.ts`

- [ ] **Step 1: Write the migration SQL**

```sql
-- src/db/migrations/0032_workshops_google_calendar.sql
-- Google Calendar pivot. Drops cal.com columns, adds Google event id +
-- meeting provisioning columns, promotes meetingUrl to NOT NULL, adds
-- inviteSentAt to workshop_registrations.
--
-- Pre-condition (verified on preview-net 2026-04-28): zero workshop rows
-- exist. Migration is destructive on calcom_event_type_id / calcom_booking_uid
-- columns; safe because no production data depends on them.

-- 1. Drop cal.com columns + their partial index from migration 0027
DROP INDEX IF EXISTS workshops_calcom_booking_uid_idx;
ALTER TABLE workshops DROP COLUMN IF EXISTS calcom_event_type_id;
ALTER TABLE workshops DROP COLUMN IF EXISTS calcom_booking_uid;

-- 2. Add Google Calendar columns (NOT NULL with provisional default for any
--    existing rows; default dropped at end so future inserts must supply value)
ALTER TABLE workshops
  ADD COLUMN google_calendar_event_id text NOT NULL DEFAULT '',
  ADD COLUMN meeting_provisioned_by text NOT NULL DEFAULT 'manual';

-- 3. Promote meeting_url to NOT NULL with provisional empty default
UPDATE workshops SET meeting_url = '' WHERE meeting_url IS NULL;
ALTER TABLE workshops ALTER COLUMN meeting_url SET NOT NULL;
ALTER TABLE workshops ALTER COLUMN meeting_url SET DEFAULT '';

-- 4. Drop the provisional defaults (next inserts must supply real values)
ALTER TABLE workshops ALTER COLUMN google_calendar_event_id DROP DEFAULT;
ALTER TABLE workshops ALTER COLUMN meeting_provisioned_by DROP DEFAULT;
ALTER TABLE workshops ALTER COLUMN meeting_url DROP DEFAULT;

-- 5. Add CHECK to constrain meeting_provisioned_by enum-like
ALTER TABLE workshops ADD CONSTRAINT workshops_meeting_provisioned_by_check
  CHECK (meeting_provisioned_by IN ('google_meet', 'manual'));

-- 6. workshop_registrations.invite_sent_at — NULL means invite send failed
ALTER TABLE workshop_registrations ADD COLUMN invite_sent_at timestamptz;
```

- [ ] **Step 2: Write apply script**

```javascript
// scripts/apply-migration-0032.mjs
#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { config as dotenvConfig } from 'dotenv'
import { neon } from '@neondatabase/serverless'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenvConfig({ path: path.join(__dirname, '..', '.env.local') })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const sql = neon(connectionString)
const migrationPath = path.join(__dirname, '..', 'src', 'db', 'migrations', '0032_workshops_google_calendar.sql')
const raw = readFileSync(migrationPath, 'utf8')

const stmts = raw
  .split(/;\s*\n/)
  .map((s) => s.replace(/\/\*[\s\S]*?\*\//g, ''))
  .map((s) => s.replace(/^(?:[ \t]*--[^\n]*\n)+/, ''))
  .map((s) => s.trim())
  .filter((s) => s.length > 0)

for (const stmt of stmts) {
  const preview = stmt.slice(0, 80).replace(/\s+/g, ' ')
  console.log(`→ ${preview}${stmt.length > 80 ? '…' : ''}`)
  await sql.query(stmt)
}

console.log('✔ 0032_workshops_google_calendar applied')
```

- [ ] **Step 3: Update Drizzle schema mirror**

Edit `src/db/schema/workshops.ts`:

Replace the workshops table definition (lines 36-79 of the current file) with:

```typescript
export const workshops = pgTable('workshops', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  title:               text('title').notNull(),
  description:         text('description'),
  scheduledAt:         timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMinutes:     integer('duration_minutes'),
  registrationLink:    text('registration_link'),
  status:              workshopStatusEnum('status').notNull().default('upcoming'),
  // Google Calendar event id, populated by sync workshop.create. NOT NULL —
  // every workshop has a backing calendar event from creation onward.
  googleCalendarEventId: text('google_calendar_event_id').notNull(),
  // 'google_meet' (auto-provisioned) or 'manual' (admin-pasted URL).
  // CHECK constraint defined in 0032 migration.
  meetingProvisionedBy: text('meeting_provisioned_by').notNull(),
  // NOT NULL since 0032 — auto-Meet path stores hangoutLink, manual path
  // stores admin-pasted URL.
  meetingUrl:          text('meeting_url').notNull(),
  maxSeats:            integer('max_seats'),
  timezone:            text('timezone').notNull().default('Asia/Kolkata'),
  // Stamped by workshop.endWorkshop the first time fan-out fires. Re-runs
  // are no-ops via the existing guard.
  completionPipelineSentAt: timestamp('completion_pipeline_sent_at', { withTimezone: true }),
  createdBy:           uuid('created_by').notNull().references(() => users.id),
  createdAt:           timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  milestoneId:         uuid('milestone_id'),
})
```

Replace the workshopRegistrations table definition (lines 119-144) by adding `inviteSentAt`:

```typescript
export const workshopRegistrations = pgTable('workshop_registrations', {
  id:               uuid('id').primaryKey().defaultRandom(),
  workshopId:       uuid('workshop_id').notNull().references(() => workshops.id, { onDelete: 'cascade' }),
  bookingUid:       text('booking_uid').notNull(),
  email:            text('email').notNull(),
  emailHash:        text('email_hash').notNull(),
  name:             text('name'),
  userId:           uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  status:           registrationStatusEnum('status').notNull().default('registered'),
  cancelledAt:      timestamp('cancelled_at', { withTimezone: true }),
  attendedAt:       timestamp('attended_at', { withTimezone: true }),
  attendanceSource: attendanceSourceEnum('attendance_source'),
  bookingStartTime: timestamp('booking_start_time', { withTimezone: true }).notNull(),
  // NULL = Google `addAttendeeToEvent` failed at registration time. Admin
  // can click "Resend invite" in the Attendees tab to retry; success stamps
  // this column.
  inviteSentAt:     timestamp('invite_sent_at', { withTimezone: true }),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('workshop_registrations_booking_uid_uniq').on(t.bookingUid),
  uniqueIndex('workshop_registrations_unique_email_per_workshop')
    .on(t.workshopId, t.emailHash)
    .where(sql`status != 'cancelled'`),
])
```

- [ ] **Step 4: Apply migration to preview-net**

```bash
node scripts/apply-migration-0032.mjs
```
Expected: each statement logged, ends with `✔ 0032_workshops_google_calendar applied`.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```
Expected: clean (or only related errors that subsequent tasks resolve).

- [ ] **Step 6: Commit**

```bash
git add src/db/migrations/0032_workshops_google_calendar.sql scripts/apply-migration-0032.mjs src/db/schema/workshops.ts
git commit -m "feat(db): migration 0032 — Google Calendar columns, drop cal.com columns"
```

---

### Task 6: Migration 0033 — drop processed_webhook_events

**Files:**
- Create: `src/db/migrations/0033_drop_processed_webhook_events.sql`
- Create: `scripts/apply-migration-0033.mjs`
- Delete: `src/db/schema/processed-webhook-events.ts`
- Modify: `src/db/schema/index.ts`

- [ ] **Step 1: Write migration SQL**

```sql
-- src/db/migrations/0033_drop_processed_webhook_events.sql
-- The cal.com webhook handler is being deleted in this pivot, taking the
-- replay-protection table with it.
DROP TABLE IF EXISTS processed_webhook_events;
```

- [ ] **Step 2: Write apply script (clone of 0032)**

```javascript
// scripts/apply-migration-0033.mjs — same pattern as 0032 but pointing to
// 0033_drop_processed_webhook_events.sql. Copy the 0032 script verbatim and
// change the migration filename and the success log line.
```

(Implement: copy `scripts/apply-migration-0032.mjs`, change `0032_workshops_google_calendar.sql` → `0033_drop_processed_webhook_events.sql` and the success-log message accordingly.)

- [ ] **Step 3: Delete schema file + drop from index**

```bash
rm src/db/schema/processed-webhook-events.ts
```

Edit `src/db/schema/index.ts` and remove the line that re-exports processed-webhook-events (find via Grep before editing).

- [ ] **Step 4: Apply migration**

```bash
node scripts/apply-migration-0033.mjs
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/db/migrations/0033_drop_processed_webhook_events.sql scripts/apply-migration-0033.mjs src/db/schema/index.ts
git rm src/db/schema/processed-webhook-events.ts
git commit -m "feat(db): migration 0033 — drop processed_webhook_events (cal.com webhook gone)"
```

---

## Phase 3 — Email Template

### Task 7: Workshop reminder email template + helper (TDD)

**Files:**
- Create: `src/lib/email-templates/workshop-reminder.tsx`
- Modify: `src/lib/email.ts`

- [ ] **Step 1: Read existing `src/lib/email.ts` to understand the helper pattern**

```bash
# Read the existing file to learn the helper pattern (sendWorkshopFeedbackInviteEmail).
```

(Use Read tool on `D:/aditee/policydash/src/lib/email.ts`. The new helper will follow the same import + render + Resend call pattern.)

- [ ] **Step 2: Write reminder email template**

Create `src/lib/email-templates/workshop-reminder.tsx`:

```tsx
import * as React from 'react'
import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Button,
  Hr,
  Preview,
  render,
} from '@react-email/components'

export interface WorkshopReminderEmailProps {
  name?: string | null
  workshopTitle: string
  meetingUrl: string
  /** Pre-formatted "Friday, May 1, 2026, 2:00 PM IST". */
  scheduledAtLabel: string
  /** "in 24 hours" or "in 1 hour" — used in subject + first paragraph. */
  windowLabel: string
}

export function WorkshopReminderEmail({
  name,
  workshopTitle,
  meetingUrl,
  scheduledAtLabel,
  windowLabel,
}: WorkshopReminderEmailProps) {
  const greetingName = (name?.trim() || 'there').split(' ')[0] ?? 'there'

  return (
    <Html>
      <Head />
      <Preview>{`Reminder: ${workshopTitle} starts ${windowLabel}`}</Preview>
      <Body
        style={{
          fontFamily: 'Inter, -apple-system, sans-serif',
          color: '#181c1e',
          backgroundColor: '#f7fafc',
          margin: 0,
          padding: '32px 0',
        }}
      >
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '0 24px' }}>
          <Text
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: '#000a1e',
              marginBottom: '24px',
            }}
          >
            CIVILIZATION LAB
          </Text>
          <Text
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: '#000a1e',
              lineHeight: 1.2,
              marginBottom: '16px',
            }}
          >
            {`${workshopTitle} starts ${windowLabel}`}
          </Text>
          <Text style={{ fontSize: '16px', lineHeight: 1.6, marginBottom: '16px' }}>
            {`Hi ${greetingName}, this is a reminder that your registered workshop is starting ${windowLabel}.`}
          </Text>
          <Text
            style={{
              fontSize: '14px',
              lineHeight: 1.6,
              marginBottom: '24px',
              color: '#44474e',
            }}
          >
            {scheduledAtLabel}
          </Text>
          <Button
            href={meetingUrl}
            style={{
              backgroundColor: '#000a1e',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              padding: '14px 28px',
              borderRadius: '12px',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Join meeting
          </Button>
          <Hr style={{ borderColor: '#ebeef0', margin: '32px 0' }} />
          <Text style={{ fontSize: '12px', color: '#44474e', lineHeight: 1.5 }}>
            {'You’re receiving this because you registered for this workshop. The link above is your meeting room.'}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export async function renderWorkshopReminderEmail(
  props: WorkshopReminderEmailProps,
): Promise<string> {
  return await render(<WorkshopReminderEmail {...props} />)
}
```

- [ ] **Step 3: Add email helper to `src/lib/email.ts`**

Append (mirror the shape of `sendWorkshopFeedbackInviteEmail`):

```typescript
import {
  renderWorkshopReminderEmail,
  type WorkshopReminderEmailProps,
} from './email-templates/workshop-reminder'

export async function sendWorkshopReminderEmail(
  to: string,
  props: WorkshopReminderEmailProps,
): Promise<void> {
  const html = await renderWorkshopReminderEmail(props)
  const subject = `Reminder: ${props.workshopTitle} starts ${props.windowLabel}`
  await resendSend({ to, subject, html })
  // resendSend is the existing internal helper used by sendWorkshopFeedbackInviteEmail
  // and friends. Match its signature exactly. Read src/lib/email.ts before editing.
}
```

(Note: when implementing, look up the actual internal Resend helper name in `src/lib/email.ts` — it may be called `sendEmail` or similar. Match exactly.)

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/email-templates/workshop-reminder.tsx src/lib/email.ts
git commit -m "feat(email): workshop reminder email template + helper"
```

---

## Phase 4 — Inngest events + functions

### Task 8: Update `src/inngest/events.ts`

**Files:**
- Modify: `src/inngest/events.ts`

- [ ] **Step 1: Edit the event registry**

In `src/inngest/events.ts`:

a. **Repurpose `workshop.created` event payload** — keep the same name + schema (workshopId + moderatorId), but the JSDoc above the schema must be updated. Replace the comment block above `workshopCreatedSchema` with:

```typescript
// -- workshop.created ----------------------------------------------------
// Emitted by workshop.create after the synchronous Google Calendar event
// creation succeeds. Triggers workshopRemindersScheduledFn (24h+1h
// reminder fan-out).
//
// Pivot 2026-04-28: previously triggered cal.com event-type provisioning;
// the Google Calendar pivot moves all provisioning into the synchronous
// path of workshop.create, so this event now only schedules reminders.
```

b. **Add `workshop.reminders_rescheduled` event** — append after the `workshop.created` block:

```typescript
// -- workshop.reminders_rescheduled --------------------------------------
// Emitted by workshop.update after a successful Google Calendar reschedule.
// Triggers workshopRemindersScheduledFn with the NEW scheduledAt; the old
// reminder run wakes at the OLD time and self-exits because its captured
// scheduledAtAtSchedule no longer matches the DB row.

const workshopRemindersRescheduledSchema = z.object({
  workshopId: z.guid(),
})

export const workshopRemindersRescheduledEvent = eventType(
  'workshop.reminders_rescheduled',
  { schema: workshopRemindersRescheduledSchema },
)

export type WorkshopRemindersRescheduledData = z.infer<
  typeof workshopRemindersRescheduledSchema
>

export async function sendWorkshopRemindersRescheduled(
  data: WorkshopRemindersRescheduledData,
): Promise<void> {
  const event = workshopRemindersRescheduledEvent.create(data)
  await event.validate()
  await inngest.send(event)
}
```

c. **Update `workshop.registration.received` schema** — replace the `source` enum and `bookingUid` JSDoc:

```typescript
const workshopRegistrationReceivedSchema = z.object({
  workshopId: z.guid(),
  email: z.string().email(),
  emailHash: z.string().regex(/^[0-9a-f]{64}$/, 'emailHash must be SHA-256 hex (64 lowercase chars)'),
  name: z.string(),
  /**
   * Always `reg_${uuid()}` (public registration) or `walkin_${uuid()}`
   * (admin walk-in). Cal.com composite UIDs are gone in the Google Calendar
   * pivot; the legacy `cal_booking` source is no longer emitted.
   */
  bookingUid: z.string().min(1),
  source: z.enum(['walk_in', 'direct_register']),
})
```

d. **Delete the `workshop.registration.orphan` block entirely** — remove lines defining `workshopRegistrationOrphanSchema`, `workshopRegistrationOrphanEvent`, `WorkshopRegistrationOrphanData`, `sendWorkshopRegistrationOrphan`. The orphan path is replaced by the admin "Resend invite" UI button.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: type errors at every callsite of `sendWorkshopRegistrationOrphan` (those will be removed in subsequent tasks). Other errors should be limited to events.ts changes propagating.

- [ ] **Step 3: Commit**

```bash
git add src/inngest/events.ts
git commit -m "feat(inngest): events.ts — add workshop.reminders_rescheduled, drop registration.orphan"
```

---

### Task 9: workshopRemindersScheduledFn (TDD)

**Files:**
- Create: `src/inngest/functions/workshop-reminders-scheduled.ts`
- Create: `src/inngest/__tests__/workshop-reminders-scheduled.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/inngest/__tests__/workshop-reminders-scheduled.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/db', () => ({ db: {} }))
vi.mock('@/src/lib/email', () => ({
  sendWorkshopReminderEmail: vi.fn().mockResolvedValue(undefined),
}))

describe('workshopRemindersScheduledFn', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('schedules sleepUntil at scheduledAt-24h and scheduledAt-1h', async () => {
    const mockStep = {
      run: vi.fn(async (_id: string, fn: () => unknown) => fn()),
      sleepUntil: vi.fn().mockResolvedValue(undefined),
    }

    const startsAt = new Date('2026-05-10T10:00:00Z')
    const dbModule = await import('@/src/db')
    ;(dbModule.db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [
            { id: 'wks1', title: 'Test', scheduledAt: startsAt, timezone: 'Asia/Kolkata', meetingUrl: 'https://meet.google.com/x', status: 'upcoming' },
          ]),
        })),
      })),
    }))

    const { _internal_handler } = await import('../functions/workshop-reminders-scheduled')
    await _internal_handler({ event: { data: { workshopId: 'wks1' } }, step: mockStep as any })

    const sleepCalls = mockStep.sleepUntil.mock.calls
    expect(sleepCalls).toHaveLength(2)
    expect((sleepCalls[0][1] as Date).toISOString()).toBe('2026-05-09T10:00:00.000Z')  // 24h before
    expect((sleepCalls[1][1] as Date).toISOString()).toBe('2026-05-10T09:00:00.000Z')  // 1h before
  })

  it('exits early if workshop was rescheduled (scheduledAt changed)', async () => {
    const originalAt = new Date('2026-05-10T10:00:00Z')
    const newAt = new Date('2026-05-12T10:00:00Z')
    let firstCall = true
    const dbModule = await import('@/src/db')
    ;(dbModule.db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            if (firstCall) {
              firstCall = false
              return [{ id: 'wks1', title: 'Test', scheduledAt: originalAt, timezone: 'Asia/Kolkata', meetingUrl: 'https://meet.google.com/x', status: 'upcoming' }]
            }
            return [{ id: 'wks1', title: 'Test', scheduledAt: newAt, timezone: 'Asia/Kolkata', meetingUrl: 'https://meet.google.com/x', status: 'upcoming' }]
          }),
        })),
      })),
    }))
    const emailModule = await import('@/src/lib/email')
    const mockStep = {
      run: vi.fn(async (_id: string, fn: () => unknown) => fn()),
      sleepUntil: vi.fn().mockResolvedValue(undefined),
    }
    const { _internal_handler } = await import('../functions/workshop-reminders-scheduled')
    await _internal_handler({ event: { data: { workshopId: 'wks1' } }, step: mockStep as any })
    expect(emailModule.sendWorkshopReminderEmail).not.toHaveBeenCalled()
  })

  it('exits early if workshop was deleted (no row)', async () => {
    const dbModule = await import('@/src/db')
    ;(dbModule.db as any).select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    }))
    const mockStep = {
      run: vi.fn(async (_id: string, fn: () => unknown) => fn()),
      sleepUntil: vi.fn(),
    }
    const { _internal_handler } = await import('../functions/workshop-reminders-scheduled')
    await _internal_handler({ event: { data: { workshopId: 'wks1' } }, step: mockStep as any })
    expect(mockStep.sleepUntil).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement the function**

Create `src/inngest/functions/workshop-reminders-scheduled.ts`:

```typescript
import { eq, and, ne } from 'drizzle-orm'
import { inngest } from '../client'
import { db } from '@/src/db'
import { workshops, workshopRegistrations } from '@/src/db/schema/workshops'
import { sendWorkshopReminderEmail } from '@/src/lib/email'
import { formatWorkshopTime } from '@/src/lib/format-workshop-time'

/**
 * workshopRemindersScheduledFn — 24h + 1h reminder fan-out.
 *
 * Triggered by `workshop.created` (initial) and `workshop.reminders_rescheduled`
 * (after `workshop.update` propagates a time change to Google Calendar).
 *
 * Cancellation pattern: each run captures `scheduledAt` at schedule time as
 * `scheduledAtAtSchedule`. After every `sleepUntil` it re-queries the DB
 * and exits silently if (a) the workshop was deleted, (b) status='archived',
 * or (c) `scheduledAt !== scheduledAtAtSchedule` (a newer reschedule run
 * is now responsible). The old `sleepUntil` slot wastes Inngest sleep but
 * Inngest pricing isn't sleep-bound — this beats wiring up the
 * invocation-cancel API.
 */

type ReminderHandlerArgs = {
  event: { data: { workshopId: string } }
  step: {
    run: <T>(id: string, fn: () => Promise<T>) => Promise<T>
    sleepUntil: (id: string, time: Date) => Promise<void>
  }
}

async function loadWorkshop(workshopId: string) {
  const [row] = await db
    .select({
      id: workshops.id,
      title: workshops.title,
      scheduledAt: workshops.scheduledAt,
      timezone: workshops.timezone,
      meetingUrl: workshops.meetingUrl,
      status: workshops.status,
    })
    .from(workshops)
    .where(eq(workshops.id, workshopId))
    .limit(1)
  return row ?? null
}

async function loadActiveRegistrations(workshopId: string) {
  return db
    .select({
      email: workshopRegistrations.email,
      name: workshopRegistrations.name,
    })
    .from(workshopRegistrations)
    .where(
      and(
        eq(workshopRegistrations.workshopId, workshopId),
        ne(workshopRegistrations.status, 'cancelled'),
      ),
    )
}

async function sendBatch(args: {
  workshopId: string
  windowLabel: string
}, snap: { title: string; scheduledAt: Date; timezone: string; meetingUrl: string }) {
  const recipients = await loadActiveRegistrations(args.workshopId)
  for (const r of recipients) {
    try {
      await sendWorkshopReminderEmail(r.email, {
        name: r.name,
        workshopTitle: snap.title,
        meetingUrl: snap.meetingUrl,
        scheduledAtLabel: formatWorkshopTime(snap.scheduledAt, snap.timezone),
        windowLabel: args.windowLabel,
      })
    } catch (err) {
      console.error('[reminders] send failed', { email: r.email, err })
    }
  }
}

export async function _internal_handler(args: ReminderHandlerArgs) {
  const { workshopId } = args.event.data

  const initial = await args.step.run('load-workshop-initial', async () => loadWorkshop(workshopId))
  if (!initial || initial.status === 'archived') return
  const scheduledAtAtSchedule = initial.scheduledAt.toISOString()

  const t24 = new Date(initial.scheduledAt.getTime() - 24 * 60 * 60 * 1000)
  await args.step.sleepUntil('sleep-24h', t24)

  const at24h = await args.step.run('check-and-send-24h', async () => {
    const fresh = await loadWorkshop(workshopId)
    if (!fresh || fresh.status === 'archived') return null
    if (fresh.scheduledAt.toISOString() !== scheduledAtAtSchedule) return null
    return fresh
  })
  if (at24h) {
    await args.step.run('send-24h-batch', async () => {
      await sendBatch({ workshopId, windowLabel: 'in 24 hours' }, at24h)
    })
  }

  const t1 = new Date(initial.scheduledAt.getTime() - 60 * 60 * 1000)
  await args.step.sleepUntil('sleep-1h', t1)

  const at1h = await args.step.run('check-and-send-1h', async () => {
    const fresh = await loadWorkshop(workshopId)
    if (!fresh || fresh.status === 'archived') return null
    if (fresh.scheduledAt.toISOString() !== scheduledAtAtSchedule) return null
    return fresh
  })
  if (at1h) {
    await args.step.run('send-1h-batch', async () => {
      await sendBatch({ workshopId, windowLabel: 'in 1 hour' }, at1h)
    })
  }
}

export const workshopRemindersScheduledFn = inngest.createFunction(
  {
    id: 'workshop-reminders-scheduled',
    name: 'Workshop reminders — 24h + 1h fan-out via sleepUntil',
    retries: 3,
    triggers: [
      { event: 'workshop.created' },
      { event: 'workshop.reminders_rescheduled' },
    ],
  },
  _internal_handler as any,
)
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/inngest/__tests__/workshop-reminders-scheduled.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/inngest/functions/workshop-reminders-scheduled.ts src/inngest/__tests__/workshop-reminders-scheduled.test.ts
git commit -m "feat(inngest): workshopRemindersScheduledFn — 24h+1h reminder fan-out"
```

---

### Task 10: Delete obsolete Inngest functions + register new

**Files:**
- Delete: `src/inngest/functions/workshop-created.ts`
- Delete: `src/inngest/functions/workshop-registration-orphan.ts`
- Delete: `src/inngest/__tests__/workshop-created.test.ts`
- Modify: `src/inngest/functions/index.ts`

- [ ] **Step 1: Delete the legacy function files + their tests**

```bash
rm src/inngest/functions/workshop-created.ts
rm src/inngest/functions/workshop-registration-orphan.ts
rm src/inngest/__tests__/workshop-created.test.ts
# If a workshop-registration-orphan test exists, delete it too:
ls src/inngest/__tests__/workshop-registration-orphan.test.ts 2>/dev/null && rm src/inngest/__tests__/workshop-registration-orphan.test.ts
```

- [ ] **Step 2: Update functions/index.ts**

Edit `src/inngest/functions/index.ts`:

Remove the imports for `workshopCreatedFn` and `workshopRegistrationOrphanFn`. Add an import for `workshopRemindersScheduledFn`. Replace the `functions` array with:

```typescript
import { helloFn } from './hello'
import { feedbackReviewedFn } from './feedback-reviewed'
import { notificationDispatchFn } from './notification-dispatch'
import { workshopCompletedFn } from './workshop-completed'
import { workshopRecordingProcessedFn } from './workshop-recording-processed'
import { evidencePackExportFn } from './evidence-pack-export'
import { participateIntakeFn } from './participate-intake'
import { workshopRegistrationReceivedFn } from './workshop-registration-received'
import { workshopFeedbackInviteFn } from './workshop-feedback-invite'
import { workshopRemindersScheduledFn } from './workshop-reminders-scheduled'
import { consultationSummaryGenerateFn } from './consultation-summary-generate'
import { milestoneReadyFn } from './milestone-ready'
import { versionAnchorFn } from './version-anchor'
import { userUpsertedFn } from './user-upserted'

export const functions = [
  ...(process.env.NODE_ENV !== 'production' ? [helloFn] : []),
  feedbackReviewedFn,
  notificationDispatchFn,
  workshopCompletedFn,
  workshopRecordingProcessedFn,
  evidencePackExportFn,
  participateIntakeFn,
  workshopRegistrationReceivedFn,
  workshopFeedbackInviteFn,
  workshopRemindersScheduledFn,  // pivot 2026-04-28 — replaces workshopCreatedFn
  consultationSummaryGenerateFn,
  milestoneReadyFn,
  versionAnchorFn,
  userUpsertedFn,
]
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: errors only at callsites of `sendWorkshopRegistrationOrphan` and at imports of deleted Inngest fns. These are resolved in later tasks.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(inngest): remove workshopCreated + workshopRegistrationOrphan; register reminders fn"
```

---

## Phase 5 — tRPC router rewrites

### Task 11: workshop.create — sync Google integration (TDD)

**Files:**
- Modify: `src/server/routers/workshop.ts`
- Create or extend: `src/server/routers/__tests__/workshop-create-update.test.ts`

- [ ] **Step 1: Read the current workshop.create implementation**

(Use Read on `D:/aditee/policydash/src/server/routers/workshop.ts`. Locate the `create:` mutation. Its current shape after wall-time work: accepts `scheduledAt` as wall-time string, converts via `wallTimeToUtc`, INSERTs the row, fires `sendWorkshopCreated`. Cal.com path goes through `workshopCreatedFn` which is being deleted.)

- [ ] **Step 2: Write failing tests for the new sync flow**

Add tests in `src/server/routers/__tests__/workshop-create-update.test.ts` covering:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/db', () => ({ db: {} }))
vi.mock('@/src/lib/google-calendar', () => ({
  createWorkshopEvent: vi.fn(),
  cancelEvent: vi.fn(),
  rescheduleEvent: vi.fn(),
}))
vi.mock('@/src/inngest/events', () => ({
  sendWorkshopCreated: vi.fn(),
  sendWorkshopRemindersRescheduled: vi.fn(),
}))

describe('workshop.create — sync Google flow', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.WORKSHOP_ORGANIZER_EMAIL = 'vinit@konma.io'
  })

  it('calls createWorkshopEvent then INSERTs row with returned eventId + meetingUrl', async () => {
    const gc = await import('@/src/lib/google-calendar')
    ;(gc.createWorkshopEvent as any).mockResolvedValue({
      eventId: 'evt_new',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      htmlLink: 'https://calendar.google.com/event?eid=evt_new',
    })
    // Stand up an in-memory db.insert/db.select shim, call the procedure
    // through the router directly (createCaller pattern). Assert:
    //  - createWorkshopEvent called with title, startUtc, endUtc, timezone,
    //    organizerEmail = WORKSHOP_ORGANIZER_EMAIL, meetingMode='auto_meet'
    //  - INSERT row contains googleCalendarEventId='evt_new',
    //    meetingUrl='https://meet.google.com/abc-defg-hij',
    //    meetingProvisionedBy='google_meet'
    //  - sendWorkshopCreated fired exactly once
  })

  it('writes manualMeetingUrl when meetingMode=manual', async () => {
    // Same shape, but meetingMode='manual', manualMeetingUrl='https://zoom.us/j/x'
    // Assert meetingProvisionedBy='manual', meetingUrl=manualMeetingUrl.
  })

  it('rolls back Google event when DB INSERT fails', async () => {
    const gc = await import('@/src/lib/google-calendar')
    ;(gc.createWorkshopEvent as any).mockResolvedValue({
      eventId: 'evt_new',
      meetingUrl: 'https://meet.google.com/x',
      htmlLink: 'https://calendar.google.com/x',
    })
    // Configure db.insert mock to throw. Call the procedure, expect TRPCError.
    // Assert gc.cancelEvent called with eventId 'evt_new'.
  })

  it('throws TRPCError if Google creation fails (no DB row created)', async () => {
    const gc = await import('@/src/lib/google-calendar')
    const { GoogleCalendarError } = await import('@/src/lib/google-calendar')
    ;(gc.createWorkshopEvent as any).mockRejectedValue(new GoogleCalendarError(503, 'down'))
    // Call procedure, expect TRPCError with code 'BAD_GATEWAY'. Assert no
    // db.insert call happened.
  })
})
```

(This is shape-level — implement the actual createCaller wiring matching the existing test patterns in this directory. Read one neighboring test for the boilerplate.)

- [ ] **Step 3: Update Zod input schema for workshop.create**

In `src/server/routers/workshop.ts`, replace the create-input schema with:

```typescript
const createWorkshopInput = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  scheduledAt: z.string().min(1),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  registrationLink: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.url().or(z.literal('')).optional(),
  ),
  maxSeats: z.number().int().positive().optional(),
  timezone: z.string().optional(),
  meetingMode: z.enum(['auto_meet', 'manual']).default('auto_meet'),
  manualMeetingUrl: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.url().optional(),
  ),
}).refine(
  (input) => input.meetingMode !== 'manual' || (input.manualMeetingUrl && input.manualMeetingUrl.length > 0),
  { message: 'manualMeetingUrl is required when meetingMode is manual', path: ['manualMeetingUrl'] },
)
```

- [ ] **Step 4: Replace the create mutation body**

Replace the body of the `create:` mutation with:

```typescript
.mutation(async ({ ctx, input }) => {
  const userId = ctx.userId
  const tz = input.timezone || DEFAULT_WORKSHOP_TIMEZONE
  if (!isValidTimezone(tz)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `Invalid IANA timezone: ${tz}` })
  }
  const startUtc = wallTimeToUtc(input.scheduledAt, tz)
  const durationMinutes = input.durationMinutes ?? DEFAULT_WORKSHOP_DURATION_MINUTES
  const endUtc = new Date(startUtc.getTime() + durationMinutes * 60_000)

  const organizerEmail = process.env.WORKSHOP_ORGANIZER_EMAIL
  if (!organizerEmail) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'WORKSHOP_ORGANIZER_EMAIL not configured',
    })
  }

  // 1) Create Google Calendar event synchronously
  let gcResult: { eventId: string; meetingUrl: string; htmlLink: string }
  try {
    gcResult = await createWorkshopEvent({
      title: input.title,
      description: input.description ?? null,
      startUtc,
      endUtc,
      timezone: tz,
      organizerEmail,
      meetingMode: input.meetingMode,
      manualMeetingUrl: input.meetingMode === 'manual' ? input.manualMeetingUrl : undefined,
      reminderMinutesBefore: [1440, 60],
    })
  } catch (err) {
    if (err instanceof GoogleCalendarError) {
      const code: TRPCError['code'] = err.status >= 500 ? 'BAD_GATEWAY' : 'BAD_REQUEST'
      throw new TRPCError({ code, message: `Google Calendar: ${err.message}` })
    }
    throw err
  }

  // 2) Insert workshop row
  let workshopId: string
  try {
    const [row] = await db.insert(workshops).values({
      title: input.title,
      description: input.description ?? null,
      scheduledAt: startUtc,
      durationMinutes,
      registrationLink: input.registrationLink || null,
      maxSeats: input.maxSeats ?? null,
      timezone: tz,
      googleCalendarEventId: gcResult.eventId,
      meetingProvisionedBy: input.meetingMode === 'auto_meet' ? 'google_meet' : 'manual',
      meetingUrl: gcResult.meetingUrl,
      createdBy: userId,
    }).returning({ id: workshops.id })
    workshopId = row.id
  } catch (dbErr) {
    // 3) Best-effort Google undo
    try {
      await cancelEvent({ eventId: gcResult.eventId })
    } catch (undoErr) {
      console.error('[workshop.create] DB INSERT failed AND Google cancel failed — orphan calendar event', {
        eventId: gcResult.eventId,
        dbErr,
        undoErr,
      })
    }
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to persist workshop' })
  }

  // 4) Audit + Inngest reminder fan-out
  await audit.write({ ... })  // match existing audit shape
  await sendWorkshopCreated({ workshopId, moderatorId: userId })

  return { id: workshopId, meetingUrl: gcResult.meetingUrl, htmlLink: gcResult.htmlLink }
})
```

(Imports needed at top of file: `createWorkshopEvent, cancelEvent, GoogleCalendarError` from `@/src/lib/google-calendar`.)

- [ ] **Step 5: Run new tests — expect PASS**

```bash
npx vitest run src/server/routers/__tests__/workshop-create-update.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/server/routers/workshop.ts src/server/routers/__tests__/workshop-create-update.test.ts
git commit -m "feat(workshop): create — sync Google Calendar integration with DB-fail rollback"
```

---

### Task 12: workshop.update — propagate to Google + reminder reschedule (TDD)

**Files:**
- Modify: `src/server/routers/workshop.ts`
- Modify: `src/server/routers/__tests__/workshop-create-update.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/server/routers/__tests__/workshop-create-update.test.ts`:

```typescript
describe('workshop.update — propagate scheduledAt to Google', () => {
  it('calls rescheduleEvent before DB UPDATE when scheduledAt changes', async () => {
    // Mock existing row: scheduledAt = 2026-05-10T10:00Z, eventId='evt1'
    // Call with new scheduledAt = 2026-05-12T10:00 wall-time IST
    // Assert order: rescheduleEvent called THEN db.update
    // Assert rescheduleEvent newStartUtc = wallTimeToUtc('2026-05-12T10:00', 'Asia/Kolkata')
    // Assert sendWorkshopRemindersRescheduled fired with workshopId
  })
  it('does NOT call rescheduleEvent when only maxSeats changes', async () => {
    // assert gc not called, db.update called
  })
  it('does NOT fire sendWorkshopRemindersRescheduled when only title changes', async () => {
    // (title → reschedule but not reminders since timing didn't change)
    // Actually we DO want title changes propagated — but reminders only fire
    // when scheduledAt or timezone change. Adjust test accordingly.
  })
  it('throws BAD_GATEWAY without touching DB if Google reschedule fails', async () => {
    const gc = await import('@/src/lib/google-calendar')
    ;(gc.rescheduleEvent as any).mockRejectedValue(new (await import('@/src/lib/google-calendar')).GoogleCalendarError(503, 'down'))
    // call procedure, expect TRPCError BAD_GATEWAY, assert db.update NOT called
  })
  it('clears registrationLink when input is empty string', async () => {
    // call with registrationLink=''
    // assert db.update sets registrationLink=null
  })
})
```

- [ ] **Step 2: Replace `workshop.update` body**

In `src/server/routers/workshop.ts`, replace the update mutation. Keep the existing input schema (which already preprocesses registrationLink). Add `meetingMode` and `manualMeetingUrl` as input fields with the same Zod shape as create (optional in update). Body:

```typescript
.mutation(async ({ ctx, input }) => {
  const [existing] = await db.select().from(workshops).where(eq(workshops.id, input.id)).limit(1)
  if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Workshop not found' })

  const tz = input.timezone || existing.timezone
  if (input.timezone && !isValidTimezone(tz)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `Invalid IANA timezone: ${tz}` })
  }

  const newScheduledAt = input.scheduledAt
    ? wallTimeToUtc(input.scheduledAt, tz)
    : existing.scheduledAt
  const newDuration = input.durationMinutes ?? existing.durationMinutes
  const newEndUtc = newDuration
    ? new Date(newScheduledAt.getTime() + newDuration * 60_000)
    : null

  const titleChanged = input.title !== undefined && input.title !== existing.title
  const descriptionChanged = input.description !== undefined && input.description !== existing.description
  const scheduledAtChanged = newScheduledAt.getTime() !== existing.scheduledAt.getTime()
  const timezoneChanged = tz !== existing.timezone

  // Switching meeting mode mid-workshop is not supported — registrants would
  // get conflicting calendar invites. Force admin to delete + recreate.
  if (input.meetingMode && input.meetingMode !== existing.meetingProvisionedBy) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(workshopRegistrations)
      .where(
        and(
          eq(workshopRegistrations.workshopId, input.id),
          ne(workshopRegistrations.status, 'cancelled'),
        ),
      )
    if (count > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot switch meeting mode after registrations exist — delete and recreate the workshop',
      })
    }
  }

  // Propagate to Google FIRST so a failure aborts before DB drift
  if (titleChanged || descriptionChanged || scheduledAtChanged || timezoneChanged) {
    if (!existing.googleCalendarEventId) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Workshop has no Google Calendar event' })
    }
    if (newEndUtc === null) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'durationMinutes required for Google reschedule' })
    }
    try {
      await rescheduleEvent({
        eventId: existing.googleCalendarEventId,
        newStartUtc: scheduledAtChanged ? newScheduledAt : undefined,
        newEndUtc: scheduledAtChanged ? newEndUtc : undefined,
        newTitle: titleChanged ? input.title : undefined,
        newDescription: descriptionChanged ? (input.description ?? null) : undefined,
        newTimezone: timezoneChanged ? tz : undefined,
      })
    } catch (err) {
      if (err instanceof GoogleCalendarError) {
        throw new TRPCError({
          code: err.status >= 500 ? 'BAD_GATEWAY' : 'BAD_REQUEST',
          message: `Google Calendar reschedule failed: ${err.message}`,
        })
      }
      throw err
    }
  }

  // DB update
  await db.update(workshops).set({
    title: input.title ?? existing.title,
    description: input.description !== undefined ? input.description : existing.description,
    scheduledAt: newScheduledAt,
    durationMinutes: newDuration,
    registrationLink: input.registrationLink !== undefined
      ? (input.registrationLink || null)
      : existing.registrationLink,
    maxSeats: input.maxSeats !== undefined ? input.maxSeats : existing.maxSeats,
    timezone: tz,
    updatedAt: new Date(),
  }).where(eq(workshops.id, input.id))

  // Reminders re-schedule fan-out — only when timing changed
  if (scheduledAtChanged || timezoneChanged) {
    await sendWorkshopRemindersRescheduled({ workshopId: input.id })
  }

  // Spots-left tag invalidation if maxSeats changed
  if (input.maxSeats !== undefined) {
    revalidateTag(spotsTag(input.id), 'max')
  }

  return { id: input.id }
})
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
npx vitest run src/server/routers/__tests__/workshop-create-update.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/workshop.ts src/server/routers/__tests__/workshop-create-update.test.ts
git commit -m "feat(workshop): update — propagate to Google + fire reminders_rescheduled"
```

---

### Task 13: workshop.delete — cancel Google event before DB delete

**Files:**
- Modify: `src/server/routers/workshop.ts`

- [ ] **Step 1: Replace the delete mutation body**

In `src/server/routers/workshop.ts`:

```typescript
.mutation(async ({ ctx, input }) => {
  const [existing] = await db.select().from(workshops).where(eq(workshops.id, input.id)).limit(1)
  if (!existing) throw new TRPCError({ code: 'NOT_FOUND' })

  if (existing.googleCalendarEventId) {
    try {
      await cancelEvent({ eventId: existing.googleCalendarEventId })
    } catch (err) {
      if (err instanceof GoogleCalendarError) {
        throw new TRPCError({
          code: err.status >= 500 ? 'BAD_GATEWAY' : 'BAD_REQUEST',
          message: `Google Calendar cancel failed: ${err.message}`,
        })
      }
      throw err
    }
  }

  await db.delete(workshops).where(eq(workshops.id, input.id))
  // ON DELETE CASCADE handles workshop_registrations rows.
  return { id: input.id }
})
```

- [ ] **Step 2: Update neighboring tests if any reference workshop.delete**

(Search for `workshop.delete` test usage; update mocks to include `cancelEvent`.)

- [ ] **Step 3: Run all router tests**

```bash
npx vitest run src/server/routers/
```

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/workshop.ts
git commit -m "feat(workshop): delete — cancel Google event before DB delete"
```

---

### Task 14: workshop.endWorkshop new mutation (TDD)

**Files:**
- Modify: `src/server/routers/workshop.ts`
- Create: `src/server/routers/__tests__/workshop-end.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/server/routers/__tests__/workshop-end.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/db', () => ({ db: {} }))
vi.mock('@/src/inngest/events', () => ({
  sendWorkshopCompleted: vi.fn(),
  sendWorkshopFeedbackInvitesBatch: vi.fn(),
}))

describe('workshop.endWorkshop', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('flips status to completed, stamps completionPipelineSentAt, fires both events', async () => {
    // Mock existing row: status='upcoming'. Mock registrations: 3 rows
    // status='registered'. Call procedure. Assert:
    //  - db.update set status='completed' AND completionPipelineSentAt = recent
    //  - workflow_transitions row inserted (sentinel actor = creator)
    //  - sendWorkshopCompleted called once with workshopId+moderatorId
    //  - sendWorkshopFeedbackInvitesBatch called with 3 items
  })

  it('is a no-op when status is already completed', async () => {
    // Mock existing row: status='completed', completionPipelineSentAt=non-null
    // Assert: db.update NOT called, no events fired, returns {alreadyCompleted: true}
  })

  it('rejects when status is archived', async () => {
    // Expect TRPCError code 'BAD_REQUEST'
  })
})
```

- [ ] **Step 2: Add the mutation to the router**

```typescript
endWorkshop: workshopManageProcedure
  .input(z.object({ workshopId: z.guid() }))
  .mutation(async ({ ctx, input }) => {
    const [existing] = await db
      .select()
      .from(workshops)
      .where(eq(workshops.id, input.workshopId))
      .limit(1)
    if (!existing) throw new TRPCError({ code: 'NOT_FOUND' })

    if (existing.status === 'completed' && existing.completionPipelineSentAt) {
      return { alreadyCompleted: true }
    }
    if (existing.status === 'archived') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot end an archived workshop' })
    }

    const now = new Date()
    await db.update(workshops).set({
      status: 'completed',
      completionPipelineSentAt: now,
      updatedAt: now,
    }).where(eq(workshops.id, input.workshopId))

    await db.insert(workflowTransitions).values({
      entityType: 'workshop',
      entityId: input.workshopId,
      fromStatus: existing.status,
      toStatus: 'completed',
      actorId: ctx.userId,
      transitionedAt: now,
    })

    const registrants = await db
      .select({
        email: workshopRegistrations.email,
        name: workshopRegistrations.name,
        userId: workshopRegistrations.userId,
      })
      .from(workshopRegistrations)
      .where(
        and(
          eq(workshopRegistrations.workshopId, input.workshopId),
          ne(workshopRegistrations.status, 'cancelled'),
        ),
      )

    await sendWorkshopCompleted({ workshopId: input.workshopId, moderatorId: ctx.userId })
    await sendWorkshopFeedbackInvitesBatch(
      registrants.map((r) => ({
        workshopId: input.workshopId,
        email: r.email,
        name: r.name ?? '',
        attendeeUserId: r.userId,
      })),
    )

    return { alreadyCompleted: false, registrantsNotified: registrants.length }
  }),
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
npx vitest run src/server/routers/__tests__/workshop-end.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/workshop.ts src/server/routers/__tests__/workshop-end.test.ts
git commit -m "feat(workshop): endWorkshop mutation — manual completion trigger"
```

---

### Task 15: Attendance + walk-in + resend invite + cancelRegistration mutations (TDD)

**Files:**
- Modify: `src/server/routers/workshop.ts`
- Create: `src/server/routers/__tests__/workshop-attendance.test.ts`

- [ ] **Step 1: Write failing tests for all five mutations**

```typescript
// src/server/routers/__tests__/workshop-attendance.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/db', () => ({ db: {} }))
vi.mock('@/src/lib/google-calendar', () => ({
  addAttendeeToEvent: vi.fn(),
  removeAttendeeFromEvent: vi.fn(),
}))

describe('markAttendance', () => {
  it('stamps attendedAt=now AND attendanceSource=manual when attended=true', async () => { /* ... */ })
  it('clears attendedAt when attended=false', async () => { /* ... */ })
})

describe('markAllPresent', () => {
  it('UPDATEs all non-cancelled rows where attendedAt IS NULL', async () => { /* ... */ })
})

describe('addWalkIn', () => {
  it('inserts new registration with attendedAt=now, no Google call, no inviteSentAt', async () => { /* ... */ })
  it('on email collision (existing non-cancelled): UPDATEs existing row instead of inserting', async () => {
    // Mock select returns existing row. Assert db.insert NOT called, db.update IS called
    // setting attendedAt + attendanceSource. Returns { added:false, attendanceMarked:true, registrationId }
  })
})

describe('resendInvite', () => {
  it('calls addAttendeeToEvent and stamps inviteSentAt on success', async () => { /* ... */ })
  it('refuses when inviteSentAt is already set', async () => {
    // Expect TRPCError BAD_REQUEST
  })
})

describe('cancelRegistration', () => {
  it('with notify=true: sets status=cancelled, calls removeAttendeeFromEvent', async () => { /* ... */ })
  it('with notify=false: sets status=cancelled, does NOT call removeAttendeeFromEvent', async () => { /* ... */ })
})
```

- [ ] **Step 2: Add the mutations to the router**

```typescript
markAttendance: workshopManageProcedure
  .input(z.object({
    workshopId: z.guid(),
    registrationId: z.guid(),
    attended: z.boolean(),
  }))
  .mutation(async ({ input }) => {
    await db.update(workshopRegistrations).set({
      attendedAt: input.attended ? new Date() : null,
      attendanceSource: input.attended ? 'manual' : null,
      updatedAt: new Date(),
    }).where(eq(workshopRegistrations.id, input.registrationId))
    return { ok: true }
  }),

markAllPresent: workshopManageProcedure
  .input(z.object({ workshopId: z.guid() }))
  .mutation(async ({ input }) => {
    const result = await db.update(workshopRegistrations).set({
      attendedAt: new Date(),
      attendanceSource: 'manual',
      updatedAt: new Date(),
    }).where(
      and(
        eq(workshopRegistrations.workshopId, input.workshopId),
        ne(workshopRegistrations.status, 'cancelled'),
        sql`${workshopRegistrations.attendedAt} IS NULL`,
      ),
    ).returning({ id: workshopRegistrations.id })
    return { affected: result.length }
  }),

addWalkIn: workshopManageProcedure
  .input(z.object({
    workshopId: z.guid(),
    email: z.string().email(),
    name: z.string().min(1).max(120),
  }))
  .mutation(async ({ input }) => {
    const emailHash = sha256Hex(input.email.toLowerCase().trim())

    const [existing] = await db
      .select()
      .from(workshopRegistrations)
      .where(
        and(
          eq(workshopRegistrations.workshopId, input.workshopId),
          eq(workshopRegistrations.emailHash, emailHash),
          ne(workshopRegistrations.status, 'cancelled'),
        ),
      )
      .limit(1)

    if (existing) {
      await db.update(workshopRegistrations).set({
        attendedAt: new Date(),
        attendanceSource: 'manual',
        updatedAt: new Date(),
      }).where(eq(workshopRegistrations.id, existing.id))
      return { added: false, attendanceMarked: true, registrationId: existing.id }
    }

    const [workshop] = await db
      .select({ scheduledAt: workshops.scheduledAt })
      .from(workshops)
      .where(eq(workshops.id, input.workshopId))
      .limit(1)
    if (!workshop) throw new TRPCError({ code: 'NOT_FOUND' })

    const [inserted] = await db.insert(workshopRegistrations).values({
      workshopId: input.workshopId,
      bookingUid: `walkin_${crypto.randomUUID()}`,
      email: input.email,
      emailHash,
      name: input.name,
      status: 'registered',
      attendedAt: new Date(),
      attendanceSource: 'manual',
      bookingStartTime: workshop.scheduledAt,
      inviteSentAt: null,
    }).returning({ id: workshopRegistrations.id })

    return { added: true, registrationId: inserted.id }
  }),

resendInvite: workshopManageProcedure
  .input(z.object({
    workshopId: z.guid(),
    registrationId: z.guid(),
  }))
  .mutation(async ({ input }) => {
    const [reg] = await db
      .select()
      .from(workshopRegistrations)
      .where(eq(workshopRegistrations.id, input.registrationId))
      .limit(1)
    if (!reg) throw new TRPCError({ code: 'NOT_FOUND' })
    if (reg.inviteSentAt) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invite already sent' })
    }

    const [w] = await db
      .select({ googleCalendarEventId: workshops.googleCalendarEventId })
      .from(workshops)
      .where(eq(workshops.id, input.workshopId))
      .limit(1)
    if (!w) throw new TRPCError({ code: 'NOT_FOUND' })

    try {
      await addAttendeeToEvent({
        eventId: w.googleCalendarEventId,
        attendeeEmail: reg.email,
        attendeeName: reg.name ?? '',
      })
    } catch (err) {
      if (err instanceof GoogleCalendarError) {
        throw new TRPCError({
          code: err.status >= 500 ? 'BAD_GATEWAY' : 'BAD_REQUEST',
          message: `Resend failed: ${err.message}`,
        })
      }
      throw err
    }

    await db.update(workshopRegistrations).set({
      inviteSentAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(workshopRegistrations.id, input.registrationId))

    return { ok: true }
  }),

cancelRegistration: workshopManageProcedure
  .input(z.object({
    workshopId: z.guid(),
    registrationId: z.guid(),
    notify: z.boolean(),
  }))
  .mutation(async ({ input }) => {
    const [reg] = await db
      .select()
      .from(workshopRegistrations)
      .where(eq(workshopRegistrations.id, input.registrationId))
      .limit(1)
    if (!reg) throw new TRPCError({ code: 'NOT_FOUND' })

    if (input.notify) {
      const [w] = await db
        .select({ googleCalendarEventId: workshops.googleCalendarEventId })
        .from(workshops)
        .where(eq(workshops.id, input.workshopId))
        .limit(1)
      if (w?.googleCalendarEventId) {
        try {
          await removeAttendeeFromEvent({
            eventId: w.googleCalendarEventId,
            attendeeEmail: reg.email,
          })
        } catch (err) {
          console.error('[cancelRegistration] Google removeAttendee failed', err)
        }
      }
    }

    await db.update(workshopRegistrations).set({
      status: 'cancelled',
      cancelledAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(workshopRegistrations.id, input.registrationId))

    revalidateTag(spotsTag(input.workshopId), 'max')
    return { ok: true }
  }),
```

- [ ] **Step 3: Delete the obsolete `setMeetingUrl` mutation**

Search for `setMeetingUrl:` in `src/server/routers/workshop.ts` and remove the entire mutation block. (It's superseded by `update` accepting `manualMeetingUrl`.)

- [ ] **Step 4: Run all attendance tests — expect PASS**

```bash
npx vitest run src/server/routers/__tests__/workshop-attendance.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/server/routers/workshop.ts src/server/routers/__tests__/workshop-attendance.test.ts
git commit -m "feat(workshop): markAttendance, markAllPresent, addWalkIn, resendInvite, cancelRegistration"
```

---

## Phase 6 — Public registration intake

### Task 16: Rewrite `app/api/intake/workshop-register/route.ts` (TDD)

**Files:**
- Modify: `app/api/intake/workshop-register/route.ts`
- Modify: `tests/phase-20/workshop-register-route.test.ts`

- [ ] **Step 1: Read the current route handler**

(Use Read on the file. The current shape: pre-flight validation → cal.com `addAttendeeToBooking` → DB insert under advisory lock → orphan event on failure. We're replacing cal.com with Google.)

- [ ] **Step 2: Update test file**

In `tests/phase-20/workshop-register-route.test.ts`:
- Replace all `vi.mock('@/src/lib/calcom', ...)` with `vi.mock('@/src/lib/google-calendar', ...)`
- Drop assertions about `addAttendeeToBooking` / `removeAttendee` / `cal.com 503`
- Drop assertions about `sendWorkshopRegistrationOrphan`
- Add assertions:
  - 410 Gone when status='completed' or 'archived'
  - 410 Gone when scheduledAt < now
  - 409 when partial unique catches duplicate
  - 200 with `inviteStatus: 'pending_resend'` when Google `addAttendeeToEvent` fails after DB INSERT
  - 200 normal path: row inserted with `bookingUid='reg_<uuid>'`, `inviteSentAt` set, Google `addAttendeeToEvent` called once
  - `revalidateTag(spotsTag(workshopId), 'max')` called once on success

- [ ] **Step 3: Replace the route handler body**

```typescript
// app/api/intake/workshop-register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import crypto from 'node:crypto'
import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/src/db'
import { workshops, workshopRegistrations } from '@/src/db/schema/workshops'
import { addAttendeeToEvent, GoogleCalendarError } from '@/src/lib/google-calendar'
import { sendWorkshopRegistrationReceived } from '@/src/inngest/events'
import { sha256Hex } from '@/src/lib/hash'
import { spotsTag } from '@/src/lib/cache-tags'
import { verifyTurnstile } from '@/src/lib/turnstile'
import { rateLimit } from '@/src/lib/rate-limit'

const bodySchema = z.object({
  workshopId: z.guid(),
  name: z.string().max(120).optional(),
  email: z.string().email().max(254),
  turnstileToken: z.string().min(1),
})

const MAX_BODY_BYTES = 16 * 1024

export async function POST(req: NextRequest) {
  // 1. Body size guard
  const lenHeader = req.headers.get('content-length')
  if (lenHeader && Number(lenHeader) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }
  const { workshopId, name, email, turnstileToken } = parsed.data

  // 2. Per-IP rate limit
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const ipOk = await rateLimit({ key: `workshop-reg:ip:${ip}`, limit: 20, windowMs: 5 * 60_000 })
  if (!ipOk) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  // 3. Turnstile
  const tsOk = await verifyTurnstile(turnstileToken, ip)
  if (!tsOk) return NextResponse.json({ error: 'Verification failed' }, { status: 403 })

  // 4. Per-email rate limit
  const emailNorm = email.toLowerCase().trim()
  const emailHash = sha256Hex(emailNorm)
  const emailOk = await rateLimit({ key: `workshop-reg:email:${emailHash}`, limit: 5, windowMs: 10 * 60_000 })
  if (!emailOk) return NextResponse.json({ error: 'Too many attempts for this email' }, { status: 429 })

  // 5. Load workshop
  const [workshop] = await db
    .select({
      id: workshops.id,
      scheduledAt: workshops.scheduledAt,
      status: workshops.status,
      maxSeats: workshops.maxSeats,
      googleCalendarEventId: workshops.googleCalendarEventId,
      timezone: workshops.timezone,
    })
    .from(workshops)
    .where(eq(workshops.id, workshopId))
    .limit(1)

  if (!workshop) return NextResponse.json({ error: 'Workshop not found' }, { status: 404 })
  if (workshop.status === 'completed' || workshop.status === 'archived') {
    return NextResponse.json({ error: 'Workshop is no longer accepting registrations' }, { status: 410 })
  }
  if (workshop.scheduledAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Workshop has already started' }, { status: 410 })
  }

  // 6. Already-registered check
  const [existing] = await db
    .select({ id: workshopRegistrations.id, status: workshopRegistrations.status })
    .from(workshopRegistrations)
    .where(
      and(
        eq(workshopRegistrations.workshopId, workshopId),
        eq(workshopRegistrations.emailHash, emailHash),
      ),
    )
    .orderBy(workshopRegistrations.createdAt)
    .limit(1)

  if (existing && existing.status !== 'cancelled') {
    return NextResponse.json({ error: 'Already registered' }, { status: 409 })
  }

  // 7. Capacity courtesy pre-flight (the partial unique handles double-clicks)
  if (workshop.maxSeats != null) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(workshopRegistrations)
      .where(
        and(
          eq(workshopRegistrations.workshopId, workshopId),
          ne(workshopRegistrations.status, 'cancelled'),
        ),
      )
    if (count >= workshop.maxSeats) {
      return NextResponse.json({ error: 'Workshop is full' }, { status: 409 })
    }
  }

  // 8. INSERT registration row
  const bookingUid = `reg_${crypto.randomUUID()}`
  let registrationId: string
  try {
    const [row] = await db.insert(workshopRegistrations).values({
      workshopId,
      bookingUid,
      email: emailNorm,
      emailHash,
      name: name ?? null,
      status: 'registered',
      bookingStartTime: workshop.scheduledAt,
      inviteSentAt: null,
    }).returning({ id: workshopRegistrations.id })
    registrationId = row.id
  } catch (err: any) {
    // 23505 = unique violation (partial unique on (workshop_id, email_hash))
    if (err?.code === '23505' || /duplicate key/i.test(String(err?.message))) {
      return NextResponse.json({ error: 'Already registered' }, { status: 409 })
    }
    console.error('[workshop-register] DB INSERT failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  // 9. Google addAttendee — inviteSentAt stays NULL on failure (admin Resend recovery)
  let inviteStatus: 'sent' | 'pending_resend' = 'pending_resend'
  try {
    await addAttendeeToEvent({
      eventId: workshop.googleCalendarEventId,
      attendeeEmail: emailNorm,
      attendeeName: name ?? '',
    })
    await db.update(workshopRegistrations).set({
      inviteSentAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(workshopRegistrations.id, registrationId))
    inviteStatus = 'sent'
  } catch (err) {
    console.warn('[workshop-register] Google addAttendee failed; admin can Resend', {
      registrationId,
      eventId: workshop.googleCalendarEventId,
      err: err instanceof GoogleCalendarError ? `${err.status}: ${err.message}` : String(err),
    })
  }

  // 10. Spots-left invalidation
  revalidateTag(spotsTag(workshopId), 'max')

  // 11. Clerk invite (existing pattern)
  await sendWorkshopRegistrationReceived({
    workshopId,
    email: emailNorm,
    emailHash,
    name: name ?? '',
    bookingUid,
    source: 'direct_register',
  })

  return NextResponse.json({ success: true, inviteStatus }, { status: 200 })
}
```

- [ ] **Step 4: Run route tests — expect PASS**

```bash
npx vitest run tests/phase-20/workshop-register-route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/api/intake/workshop-register/route.ts tests/phase-20/workshop-register-route.test.ts
git commit -m "feat(workshop-register): sync Google addAttendee + admin-resend fallback on failure"
```

---

## Phase 7 — UI changes

### Task 17: Workshop create form — meeting source radio

**Files:**
- Modify: `app/workshop-manage/new/page.tsx`

- [ ] **Step 1: Read the current form to understand the existing react-hook-form setup**

(Use Read on `app/workshop-manage/new/page.tsx`.)

- [ ] **Step 2: Add meeting source radio + conditional URL input**

Inside the form, between the description field and durationMinutes (or wherever it fits the existing layout), add:

```tsx
<div className="space-y-2">
  <Label>Meeting source</Label>
  <RadioGroup
    value={meetingMode}
    onValueChange={(v) => setMeetingMode(v as 'auto_meet' | 'manual')}
    className="flex flex-col gap-2"
  >
    <div className="flex items-center gap-2">
      <RadioGroupItem value="auto_meet" id="mode-auto" />
      <Label htmlFor="mode-auto" className="font-normal cursor-pointer">
        Auto-provision Google Meet
      </Label>
    </div>
    <div className="flex items-center gap-2">
      <RadioGroupItem value="manual" id="mode-manual" />
      <Label htmlFor="mode-manual" className="font-normal cursor-pointer">
        Use my own meeting link
      </Label>
    </div>
  </RadioGroup>
</div>

{meetingMode === 'manual' && (
  <div className="space-y-2">
    <Label htmlFor="manualMeetingUrl">Meeting URL</Label>
    <Input
      id="manualMeetingUrl"
      type="url"
      placeholder="https://zoom.us/j/123456789"
      {...register('manualMeetingUrl', {
        required: meetingMode === 'manual',
      })}
    />
    {errors.manualMeetingUrl && (
      <p className="text-sm text-destructive">Required for custom meeting link</p>
    )}
  </div>
)}
```

Wire `meetingMode` as form state with default `'auto_meet'`. Update the submit handler to pass `meetingMode` and `manualMeetingUrl` to the tRPC mutation.

Drop the `registrationLink` field entirely from the form — the spec marks it as soft-deprecated.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/workshop-manage/new/page.tsx
git commit -m "feat(ui): workshop create form — meeting source radio + conditional URL input"
```

---

### Task 18: Workshop edit form — same UX + unlock scheduledAt edits

**Files:**
- Modify: `app/workshop-manage/[id]/edit/page.tsx`

- [ ] **Step 1: Mirror the create-form changes**

Same `meetingMode` + conditional URL field as Task 17. Initial value comes from `workshop.meetingProvisionedBy`.

- [ ] **Step 2: Remove the scheduledAt-locked-after-registrants guard**

Find any block that disables scheduledAt input when registrants exist (search for `disabled` near `scheduledAt`) and remove. Add an info note: "Editing the time will update Google Calendar and notify all registered attendees."

- [ ] **Step 3: Add a guard for switching meetingMode when registrants exist**

Disable the radio group with a tooltip ("Cannot switch meeting mode after registrations exist — delete and recreate the workshop") when `registrationsCount > 0`.

- [ ] **Step 4: Commit**

```bash
git add app/workshop-manage/[id]/edit/page.tsx
git commit -m "feat(ui): workshop edit form — meeting source UX + unlock scheduledAt"
```

---

### Task 19: Workshop detail page — badges, Open in Google, End Workshop button

**Files:**
- Modify: `app/workshop-manage/[id]/page.tsx`
- Delete: `app/workshop-manage/[id]/_components/missing-meeting-url-alert.tsx`

- [ ] **Step 1: Delete `missing-meeting-url-alert.tsx`**

```bash
rm app/workshop-manage/[id]/_components/missing-meeting-url-alert.tsx
```

Find imports of it in `page.tsx` and remove (search for `MissingMeetingUrlAlert`). Also remove any `setMeetingUrl` form widget — that mutation no longer exists.

- [ ] **Step 2: Add the meeting-source badge**

Near the workshop title in the header:

```tsx
<Badge variant={workshop.meetingProvisionedBy === 'google_meet' ? 'default' : 'secondary'}>
  {workshop.meetingProvisionedBy === 'google_meet' ? 'Google Meet' : 'Custom link'}
</Badge>
```

- [ ] **Step 3: Add "Open in Google Calendar" button**

The `htmlLink` returned by `createWorkshopEvent` should be persisted somewhere — it's deterministic from `eventId`, so we can construct it on demand: `https://calendar.google.com/calendar/event?eid=<base64-encoded eventId>` is unreliable. Simpler: store `htmlLink` on the workshop row.

**Add a column in this task** (revise migration 0032 to include `google_calendar_html_link text`, and update schema mirror). Or, simpler, store it inside the workshop somehow.

Actually — Google's deep-link format is `https://calendar.google.com/calendar/u/0/r/eventedit/<eventId>`. That's deterministic. Use:

```tsx
<Button asChild variant="outline">
  <a
    href={`https://calendar.google.com/calendar/u/0/r/eventedit/${workshop.googleCalendarEventId}`}
    target="_blank"
    rel="noopener noreferrer"
  >
    Open in Google Calendar
  </a>
</Button>
```

- [ ] **Step 4: Add "End Workshop" button**

Conditional rendering: shown when `status` is `'upcoming'` or `'in_progress'` AND `scheduledAt < now() + 30min`. Click handler calls `workshop.endWorkshop` mutation, with confirmation dialog ("End workshop now? This will send feedback emails to all registered attendees.").

```tsx
{(workshop.status === 'upcoming' || workshop.status === 'in_progress') &&
  Date.now() > workshop.scheduledAt.getTime() - 30 * 60_000 && (
  <Button variant="default" onClick={() => endWorkshopMutation.mutate({ workshopId: workshop.id })}>
    End Workshop
  </Button>
)}
```

- [ ] **Step 5: Type-check + commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat(ui): workshop detail — meeting source badge, Open in Google, End Workshop"
```

---

### Task 20: Attendees tab — full admin actions

**Files:**
- Modify: `app/workshop-manage/[id]/_components/attendee-list.tsx`

- [ ] **Step 1: Read the current attendee-list component**

(Use Read on the file.)

- [ ] **Step 2: Add per-row attendance checkbox**

```tsx
<Checkbox
  checked={!!registration.attendedAt}
  onCheckedChange={(checked) =>
    markAttendanceMutation.mutate({
      workshopId,
      registrationId: registration.id,
      attended: !!checked,
    })
  }
/>
```

- [ ] **Step 3: Add "Mark all present" button at top of list**

```tsx
<Button variant="outline" onClick={() => markAllPresentMutation.mutate({ workshopId })}>
  Mark all present
</Button>
```

- [ ] **Step 4: Add "Add walk-in" button + modal**

Modal with email + name inputs; on submit, call `workshop.addWalkIn`.

- [ ] **Step 5: Add invite-pending badge per row**

```tsx
{!registration.inviteSentAt && (
  <span className="inline-flex items-center gap-1">
    <Badge variant="warning">⚠ Invite pending</Badge>
    <Button
      size="sm"
      variant="ghost"
      onClick={() => resendInviteMutation.mutate({ workshopId, registrationId: registration.id })}
      disabled={resendInviteMutation.isPending}
    >
      Resend
    </Button>
  </span>
)}
```

- [ ] **Step 6: Add "Cancel registration" per-row action**

Confirmation modal asks "Notify the attendee that their registration was cancelled?" with checkbox; on confirm, call `workshop.cancelRegistration` with `notify: <checked>`.

- [ ] **Step 7: Update the tRPC query that powers this list to include `inviteSentAt`**

Find the registrations list query (likely in `src/server/routers/workshop.ts` `listRegistrations`) and add `inviteSentAt` to the SELECT shape if it's not already there.

- [ ] **Step 8: Type-check + commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat(ui): attendees tab — checkbox attendance, walk-in modal, resend, cancel"
```

---

### Task 21: Public listing gate — googleCalendarEventId

**Files:**
- Modify: `src/server/queries/workshops-public.ts`
- Possibly: `app/workshops/page.tsx`

- [ ] **Step 1: Find every reference to `calcomEventTypeId IS NOT NULL`**

```bash
# Use Grep:
# Pattern: calcomEventTypeId
```

- [ ] **Step 2: Replace with `googleCalendarEventId IS NOT NULL`**

(Trivial sed-style edit, but use Edit tool for each occurrence to keep change visible in diff.)

- [ ] **Step 3: Update PublicWorkshop type to drop `calcomEventTypeId` from select shape**

- [ ] **Step 4: Type-check + commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat(public): gate workshops listing on googleCalendarEventId not calcomEventTypeId"
```

---

## Phase 8 — Cleanup

### Task 22: Delete cal.com files + tests + env vars

**Files:**
- Delete: `src/lib/calcom.ts`
- Delete: `src/lib/cal-signature.ts`
- Delete: `app/api/webhooks/cal/route.ts`
- Delete: `tests/phase-20/cal-webhook-route.test.ts`
- Modify: `.env.example`
- Modify: `src/lib/email.ts` (drop `sendWorkshopOrphanSeatAlert`)

- [ ] **Step 1: Identify every importer of these files**

```bash
# Grep for:
#   from '@/src/lib/calcom'
#   from '@/src/lib/cal-signature'
#   sendWorkshopOrphanSeatAlert
```

There should be zero remaining importers since previous tasks rewrote the consumers. If any are found, fix them first — usually a leftover test mock or unused import.

- [ ] **Step 2: Delete the files**

```bash
git rm src/lib/calcom.ts
git rm src/lib/cal-signature.ts
git rm app/api/webhooks/cal/route.ts
git rm tests/phase-20/cal-webhook-route.test.ts
```

- [ ] **Step 3: Delete `sendWorkshopOrphanSeatAlert` from `src/lib/email.ts`**

Find and remove the function + any `import` it had for an email template. (Read the file first to find the function.)

- [ ] **Step 4: Drop CAL_* env vars from `.env.example`**

```bash
# Read .env.example, remove lines with:
# CAL_API_KEY=
# CAL_WEBHOOK_SECRET=
# CAL_PRIMARY_ATTENDEE_EMAIL=
# CAL_PRIMARY_ATTENDEE_NAME=
```

Add (or confirm presence of):

```
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REFRESH_TOKEN=
WORKSHOP_ORGANIZER_EMAIL=
GOOGLE_CALENDAR_ID=primary
```

- [ ] **Step 5: Type-check + run all tests**

```bash
npx tsc --noEmit
npx vitest run
```

If any tsc errors remain, they point to files that still reference deleted modules — fix until clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(cleanup): remove all cal.com files, tests, env vars, and orphan email helper"
```

---

## Phase 9 — Verification

### Task 23: Final type-check, tests, build

**Files:** none modified.

- [ ] **Step 1: Type-check**

```bash
npx tsc --noEmit
```
Expected: clean (zero errors).

- [ ] **Step 2: Run vitest**

```bash
npx vitest run
```
Expected: all tests pass. New: google-calendar.test.ts, workshop-reminders-scheduled.test.ts, workshop-end.test.ts, workshop-attendance.test.ts. Rewritten: workshop-register-route.test.ts. Deleted: cal-webhook-route.test.ts, workshop-created.test.ts.

- [ ] **Step 3: Production build**

```bash
npx next build
```
Expected: clean build, no missing-import warnings.

- [ ] **Step 4: Final commit if any cleanup needed**

If steps 1-3 surface stragglers (forgotten imports, dead code), fix and commit:

```bash
git add -A
git commit -m "chore: final tsc/vitest/build cleanup after Google Calendar pivot"
```

---

## Smoke walk (deferred to milestone end)

Per project convention (`feedback_defer_smoke_walks.md`), these are NOT executed per-task — bundle them when the milestone closes:

1. Run `node scripts/google-oauth-bootstrap.mjs`, verify .env.local snippet is printed
2. `npm run dev`, create a workshop with auto-Meet → verify Google Calendar event created with Meet link
3. Create a workshop with manual Zoom link → verify event location set
4. Register a stakeholder via `/workshops/[id]` → verify Google sends invite + spots-left badge updates within 1s
5. Reschedule the workshop → verify Google emails attendee about time change
6. Click End Workshop → verify status flip + feedback-invite emails
7. Toggle attendance checkboxes → verify DB updates
8. Add a walk-in via the modal → verify row created with attendedAt set
9. (OAuth recovery) Revoke app access at https://myaccount.google.com/permissions → verify graceful 401 → re-run bootstrap → verify recovery

---

## Self-Review Notes

**Spec coverage:**
- ✅ Schema changes (Task 5, 6) — googleCalendarEventId, meetingProvisionedBy, meetingUrl NOT NULL, drop calcom* + processed_webhook_events, add inviteSentAt
- ✅ Google client (Task 2-4) — all 5 methods + auth + 401 retry + 404-tolerant cancel
- ✅ Routers (Tasks 11-15) — create, update, delete, endWorkshop, markAttendance, markAllPresent, addWalkIn, resendInvite, cancelRegistration; setMeetingUrl deleted
- ✅ Public route (Task 16) — sync Google + invite-pending fallback
- ✅ Inngest (Tasks 8-10) — repurpose workshop.created event, add reminders_rescheduled, drop orphan; add workshopRemindersScheduledFn; delete workshopCreatedFn + workshopRegistrationOrphanFn
- ✅ UI (Tasks 17-21) — meeting source radios, Open in Google, End Workshop button, attendance checkboxes, walk-in modal, resend invite, cancel registration; missing-meeting-url-alert deleted
- ✅ Email (Task 7) — workshop reminder template + helper; sendWorkshopOrphanSeatAlert removed in Task 22
- ✅ OAuth setup (Task 1) — bootstrap script + setup doc
- ✅ Cleanup (Task 22) — every cal.com file, test, env var

**Type-consistency:** All cross-task references align: `googleCalendarEventId` (used everywhere), `meetingProvisionedBy` ('google_meet'|'manual'), `inviteSentAt` (workshop_registrations column + tRPC select shape + UI badge gate), event names (`workshop.created`, `workshop.reminders_rescheduled`, `workshop.feedback.invite`, `workshop.completed`).

**Outstanding judgment calls (flagged for executor):**
1. The exact internal helper name in `src/lib/email.ts` (Task 7 step 3) needs to match what the file currently exports — verify before adding `sendWorkshopReminderEmail`.
2. The `audit.write` call in workshop.create (Task 11 step 4) should match the existing audit-log helper signature in this codebase — read a neighboring mutation for the shape.
3. The `htmlLink` deep-link in Task 19 — if `https://calendar.google.com/calendar/u/0/r/eventedit/<eventId>` doesn't work for the user's account (Workspace vs personal sometimes differ), fall back to storing `htmlLink` on the workshop row by extending migration 0032.

**Total estimated time:** ~12-18 hours across 23 tasks.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-28-google-calendar-workshop-pivot.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
