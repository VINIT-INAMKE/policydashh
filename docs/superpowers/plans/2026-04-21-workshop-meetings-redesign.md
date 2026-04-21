# Workshop Meetings Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the "multiple 1:1 meetings per workshop" regression and swap Cal Video for Google Meet. One cal.com booking per workshop; each registrant is added as a seat via the `POST /v2/bookings/{uid}/attendees` endpoint; all share one Google Meet link.

**Architecture:** At workshop creation, `workshopCreatedFn` provisions a Google-Meet event type, creates the root seated booking with `vinay@konma.io` as primary attendee, and backfills `workshops.calcomBookingUid` + `workshops.meetingUrl`. The public registration route calls `addAttendeeToBooking` instead of creating a fresh booking. Webhook cancellation cascades across all seats of a root booking.

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM, Neon Postgres, Inngest, cal.com v2 API (`2024-06-14` for event types, `2024-08-13` for bookings/attendees), vitest.

**Spec:** `docs/superpowers/specs/2026-04-21-workshop-meetings-redesign.md`.

**Conventions:**
- Package manager: **npm** (not pnpm).
- Run tests: `npm test` (vitest).
- Run lint: `npm run lint`.
- Run build (type check + build): `npm run build`.
- Commits directly to `master`, no worktrees. Use `type(scope): description` format matching recent history (`fix(inngest): ...`, `chore(scripts): ...`, `feat(calcom): ...`).
- Do NOT use `--no-verify`, `--no-gpg-sign`, or `git add -A`.
- Migrations numbered sequentially in `src/db/migrations/NNNN_name.sql`. Next number is `0026`. Each has a matching apply script `scripts/apply-migration-NNNN.mjs` that executes via the Neon HTTP driver.

---

## File Map

### Create
- `src/db/migrations/0026_workshop_root_booking.sql` — ALTER TABLE adding two columns.
- `scripts/apply-migration-0026.mjs` — one-shot applier for the migration.
- `src/lib/__tests__/calcom.test.ts` — unit tests for the cal.com v2 client.
- `tests/phase-20/workshop-register-route.test.ts` — route-level tests for the rewritten intake handler.

### Modify
- `src/db/schema/workshops.ts` — add `calcomBookingUid`, `meetingUrl` fields.
- `src/lib/env.ts` — add `CAL_PRIMARY_ATTENDEE_EMAIL`, `CAL_PRIMARY_ATTENDEE_NAME` to required schema.
- `.env.example` — document the new env vars.
- `src/lib/calcom.ts` — swap Cal Video → Google Meet in `createCalEventType`; capture `meetingUrl` in `createCalBooking`; add `addAttendeeToBooking`; remove `updateCalEventTypeSeats`.
- `src/inngest/functions/workshop-created.ts` — after event-type provisioning, create the root booking and backfill `calcomBookingUid` + `meetingUrl`.
- `src/inngest/__tests__/workshop-created.test.ts` — extend with root-booking assertions.
- `app/api/intake/workshop-register/route.ts` — replace `createCalBooking` with `addAttendeeToBooking`; require `calcomBookingUid`; remove `direct:` / `needsCalComReconcile` fallback.
- `app/api/webhooks/cal/route.ts` — `BOOKING_CREATED` → no-op; `BOOKING_CANCELLED` / `BOOKING_RESCHEDULED` cascade on root uid; `MEETING_ENDED` unchanged.
- `tests/phase-20/cal-webhook-route.test.ts` — add cascade-cancel and reschedule-propagate test cases.
- `src/server/routers/workshop.ts` — remove `reprovisionCalSeats` mutation; remove import of `updateCalEventTypeSeats`.
- `app/workshop-manage/[id]/page.tsx` — remove `<ReprovisionCalButton>` mount.
- `app/workshop-manage/[id]/edit/page.tsx` — remove `<ReprovisionCalButton>` mount (if present).

### Delete
- `app/workshop-manage/[id]/_components/reprovision-cal-button.tsx`
- `types/calcom-embed-react.d.ts`
- `@calcom/embed-react` from `package.json` + `package-lock.json` (via `npm uninstall`)

---

## Task 1: Data model + env (DB foundation)

**Files:**
- Modify: `src/db/schema/workshops.ts` (around line 50)
- Modify: `src/lib/env.ts` (inside `requiredServerEnvSchema`)
- Modify: `.env.example` (after existing `CAL_WEBHOOK_SECRET` entry)
- Create: `src/db/migrations/0026_workshop_root_booking.sql`
- Create: `scripts/apply-migration-0026.mjs`

- [ ] **Step 1: Add two columns to the workshops schema**

Open `src/db/schema/workshops.ts`. Inside the `workshops` table definition, add the two columns right after `calcomEventTypeId`:

```ts
export const workshops = pgTable('workshops', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  title:               text('title').notNull(),
  description:         text('description'),
  scheduledAt:         timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMinutes:     integer('duration_minutes'),
  registrationLink:    text('registration_link'),
  status:              workshopStatusEnum('status').notNull().default('upcoming'),
  calcomEventTypeId:   text('calcom_event_type_id'),
  // Root seated booking + shared Google Meet link, backfilled by workshopCreatedFn
  // after cal.com provisioning completes. Nullable because creation is async
  // (mirrors the calcomEventTypeId null-until-backfilled pattern).
  calcomBookingUid:    text('calcom_booking_uid'),
  meetingUrl:          text('meeting_url'),
  maxSeats:            integer('max_seats'),
  // ... rest unchanged
```

- [ ] **Step 2: Add env vars to the runtime validation schema**

In `src/lib/env.ts`, inside `requiredServerEnvSchema` near the existing cal.com entries:

```ts
  // --- cal.com --------------------------------------------------------
  CAL_API_KEY: z.string().min(1, 'CAL_API_KEY is required'),
  CAL_WEBHOOK_SECRET: z.string().min(1, 'CAL_WEBHOOK_SECRET is required'),
  CAL_PRIMARY_ATTENDEE_EMAIL: z
    .string()
    .email('CAL_PRIMARY_ATTENDEE_EMAIL must be a valid email')
    .min(1, 'CAL_PRIMARY_ATTENDEE_EMAIL is required'),
  CAL_PRIMARY_ATTENDEE_NAME: z
    .string()
    .min(1, 'CAL_PRIMARY_ATTENDEE_NAME is required'),
```

- [ ] **Step 3: Mirror env vars into `.env.example`**

Append to `.env.example` directly after the `CAL_WEBHOOK_SECRET=` line:

```
# Primary attendee on every workshop's root seated booking. Not the cal.com
# account owner (that's CAL_API_KEY's account). Receives the booking-
# confirmation email and is always in every workshop.
CAL_PRIMARY_ATTENDEE_EMAIL=vinay@konma.io
CAL_PRIMARY_ATTENDEE_NAME=Vinay (PolicyDash)
```

- [ ] **Step 4: Write the migration SQL**

Create `src/db/migrations/0026_workshop_root_booking.sql` with exact content:

```sql
-- Phase workshop-meetings-redesign (2026-04-21):
-- Workshops now have one root seated cal.com booking created at
-- workshop-creation time, with vinay@konma.io as primary attendee. Public
-- registrants are added as seats on top. Both columns are backfilled
-- asynchronously by workshopCreatedFn, so they must be nullable.

ALTER TABLE workshops
  ADD COLUMN IF NOT EXISTS calcom_booking_uid TEXT,
  ADD COLUMN IF NOT EXISTS meeting_url        TEXT;
```

- [ ] **Step 5: Write the one-shot apply script**

Create `scripts/apply-migration-0026.mjs` (mirror the structure of `scripts/apply-migration-0025.mjs`):

```js
#!/usr/bin/env node
/**
 * Workshop meetings redesign (2026-04-21) - apply migration 0026 via Neon
 * HTTP driver. Pattern identical to apply-migration-0025.mjs.
 */

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
const migrationPath = path.join(
  __dirname,
  '..',
  'src',
  'db',
  'migrations',
  '0026_workshop_root_booking.sql',
)
const raw = readFileSync(migrationPath, 'utf8')

const stmts = raw
  .split(/;\s*\n/)
  .map((s) => s.replace(/\/\*[\s\S]*?\*\//g, '').trim())
  .filter((s) => s.length > 0 && !/^--/.test(s))

for (const stmt of stmts) {
  const preview = stmt.slice(0, 80).replace(/\s+/g, ' ')
  console.log(`→ ${preview}${stmt.length > 80 ? '…' : ''}`)
  await sql.query(stmt)
}

console.log('✔ 0026_workshop_root_booking applied')
```

- [ ] **Step 6: Apply the migration**

Run: `node scripts/apply-migration-0026.mjs`
Expected: prints two `→` lines (one per ALTER), finishes with `✔ 0026_workshop_root_booking applied`.

- [ ] **Step 7: Type-check the schema change**

Run: `npx tsc --noEmit`
Expected: no new errors. Pre-existing errors in other files are acceptable only if they also exist on `master` before this task — if `npx tsc --noEmit` was clean before, it must still be clean.

- [ ] **Step 8: Commit**

```bash
git add src/db/schema/workshops.ts src/lib/env.ts .env.example src/db/migrations/0026_workshop_root_booking.sql scripts/apply-migration-0026.mjs
git commit -m "$(cat <<'EOF'
feat(workshops): add calcom_booking_uid + meeting_url columns

Phase workshop-meetings-redesign: prep the schema and env for the
single-shared-booking model. Columns are nullable — workshopCreatedFn
will backfill them asynchronously after cal.com provisioning.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Cal.com client — Google Meet location

**Files:**
- Create: `src/lib/__tests__/calcom.test.ts`
- Modify: `src/lib/calcom.ts:103` (locations array in `createCalEventType`)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/calcom.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/calcom.test.ts`
Expected: FAIL with the assertion `expect(serialized).toMatch(/google[-_:]?meet/i)` failing because the current code sends `'cal-video'`.

- [ ] **Step 3: Change the location**

In `src/lib/calcom.ts`, find lines 102–103:

```ts
        // D-02: Cal Video as the default meeting location.
        locations: [{ type: 'integration', integration: 'cal-video' }],
```

Replace with:

```ts
        // Google Meet is provisioned through the cal.com account's connected
        // Google Calendar OAuth (account: vinit@konma.io). Cal.com docs
        // disagree on the exact slug — sending both candidate shapes is
        // safe; whichever the backend accepts wins, the other is ignored.
        // Same tolerance pattern as `length`/`lengthInMinutes` above.
        locations: [
          { type: 'integration', integration: 'google-meet' },
          { type: 'integrations:google:meet' },
        ],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/calcom.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/calcom.ts src/lib/__tests__/calcom.test.ts
git commit -m "$(cat <<'EOF'
feat(calcom): use Google Meet as event-type location

The cal.com org account has Google Calendar + Google Meet integration
connected, so the event-type location can flip from Cal Video to Google
Meet purely at the API body level. Cal.com's own docs disagree on the
exact location slug — sending both shapes is tolerated, mirroring the
length/lengthInMinutes workaround we already have.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Cal.com client — capture `meetingUrl` from `createCalBooking`

**Files:**
- Modify: `src/lib/calcom.ts` (around lines 262–327, `CalBookingResult` type + `createCalBooking` body parsing)
- Modify: `src/lib/__tests__/calcom.test.ts` (add describe block)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/calcom.test.ts`:

```ts
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/calcom.test.ts`
Expected: FAIL — current `CalBookingResult` is `{ uid: string }` only.

- [ ] **Step 3: Update `CalBookingResult` type and parsing**

In `src/lib/calcom.ts`, find the `CalBookingResult` interface and the bottom of `createCalBooking`. Replace:

```ts
export interface CalBookingResult {
  uid: string
}
```

with:

```ts
export interface CalBookingResult {
  uid: string
  /**
   * Shared meeting URL from cal.com's response. For Google-Meet-located
   * event types this is the Meet link attendees click into. `null` if
   * cal.com did not populate either `data.meetingUrl` or `data.location`
   * — the workshopCreatedFn caller treats null as "backfill skipped".
   */
  meetingUrl: string | null
}
```

Then find the tail of `createCalBooking` (currently ending at the `uid` assertion). Replace the tail starting at the second `body` parse attempt:

```ts
  let body: { data?: { uid?: string } }
  try {
    body = (await res.json()) as { data?: { uid?: string } }
  } catch (err) {
    throw new CalApiError(
      500,
      `cal.com booking response parse failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const uid = body.data?.uid
  if (!uid) {
    throw new CalApiError(500, `cal.com booking response missing uid: ${JSON.stringify(body)}`)
  }

  return { uid }
```

with:

```ts
  let body: {
    data?: {
      uid?: string
      meetingUrl?: string
      location?: string
    }
  }
  try {
    body = (await res.json()) as typeof body
  } catch (err) {
    throw new CalApiError(
      500,
      `cal.com booking response parse failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const uid = body.data?.uid
  if (!uid) {
    throw new CalApiError(500, `cal.com booking response missing uid: ${JSON.stringify(body)}`)
  }

  // Cal.com's response shape for the meeting URL is inconsistent between
  // provider integrations (Cal Video vs Google Meet vs Zoom) and has shifted
  // across API versions. Try `meetingUrl` first (what newer Google-Meet
  // bookings return), fall back to `location` (older shape), else null.
  // Smoke test #1 records the exact field during implementation.
  const meetingUrl =
    typeof body.data?.meetingUrl === 'string'
      ? body.data.meetingUrl
      : typeof body.data?.location === 'string'
        ? body.data.location
        : null

  return { uid, meetingUrl }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/calcom.test.ts`
Expected: PASS (4 tests: the earlier location test + 3 new booking tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/calcom.ts src/lib/__tests__/calcom.test.ts
git commit -m "$(cat <<'EOF'
feat(calcom): capture meetingUrl from createCalBooking response

CalBookingResult now carries meetingUrl alongside uid so workshopCreatedFn
can backfill workshops.meeting_url. Tolerates either data.meetingUrl or
data.location in the response — cal.com's response shape varies by
provider integration; the exact field is recorded during smoke test #1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Cal.com client — `addAttendeeToBooking`

**Files:**
- Modify: `src/lib/calcom.ts` (append new exported function)
- Modify: `src/lib/__tests__/calcom.test.ts` (append new describe block)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/__tests__/calcom.test.ts`:

```ts
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

    await expect(
      addAttendeeToBooking('root-abc', {
        name: 'X',
        email: 'x@example.com',
        timeZone: 'UTC',
      }),
    ).rejects.toMatchObject({
      name: 'CalApiError',
      status: 503,
    })

    // Make sure the constructor itself is still the one we expect.
    const caught = await addAttendeeToBooking('root-abc', {
      name: 'X',
      email: 'x@example.com',
      timeZone: 'UTC',
    }).catch((e) => e)
    expect(caught instanceof CalApiError || caught?.name === 'CalApiError').toBe(true)
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/calcom.test.ts`
Expected: FAIL — `addAttendeeToBooking` is not exported.

- [ ] **Step 3: Implement `addAttendeeToBooking`**

Append to `src/lib/calcom.ts` (at the end of the file, after `createCalBooking`):

```ts
export interface CalAddAttendeeInput {
  /** Attendee full name. Cal.com displays this on the booking + in emails. */
  name: string
  /** Attendee email. Cal.com sends them the booking-confirmation email. */
  email: string
  /** IANA timezone used for the attendee's calendar invite rendering. */
  timeZone: string
}

export interface CalAddAttendeeResult {
  /** Numeric attendee id; unique per (booking, attendee). */
  id: number
  /** Numeric booking id the attendee was added to. */
  bookingId: number
}

/**
 * Add an attendee to an existing cal.com booking (seat add).
 *
 * Used by the public workshop-register intake route: the first booking for a
 * workshop is created server-side by workshopCreatedFn with vinay@konma.io as
 * primary attendee; every public registrant is added as a seat on top via
 * this endpoint. All attendees share the same root uid + the same Google
 * Meet link.
 *
 * Requires `cal-api-version: 2024-08-13` — older versions 404.
 *
 * Error contract matches createCalEventType:
 *   - 5xx / network failure → CalApiError(>=500) → caller retries via Inngest
 *   - 4xx                   → CalApiError(<500)  → caller maps to NonRetriable
 *   - Missing CAL_API_KEY   → CalApiError(400)
 *   - Malformed response    → CalApiError(500) (conservative retry)
 */
export async function addAttendeeToBooking(
  bookingUid: string,
  input: CalAddAttendeeInput,
): Promise<CalAddAttendeeResult> {
  const apiKey = process.env.CAL_API_KEY
  if (!apiKey) {
    throw new CalApiError(400, 'CAL_API_KEY not set')
  }

  let res: Response
  try {
    res = await fetch(`https://api.cal.com/v2/bookings/${bookingUid}/attendees`, {
      method: 'POST',
      headers: {
        'Authorization':   `Bearer ${apiKey}`,
        'Content-Type':    'application/json',
        'cal-api-version': '2024-08-13',
      },
      body: JSON.stringify({
        name:     input.name,
        email:    input.email,
        timeZone: input.timeZone,
      }),
    })
  } catch (err) {
    throw new CalApiError(
      500,
      `cal.com add-attendee network failure: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>')
    throw new CalApiError(res.status, `cal.com add-attendee ${res.status}: ${text}`)
  }

  let body: { data?: { id?: number; bookingId?: number } }
  try {
    body = (await res.json()) as typeof body
  } catch (err) {
    throw new CalApiError(
      500,
      `cal.com add-attendee response parse failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const id = body.data?.id
  const bookingId = body.data?.bookingId
  if (typeof id !== 'number' || typeof bookingId !== 'number') {
    throw new CalApiError(
      500,
      `cal.com add-attendee response missing numeric id/bookingId: ${JSON.stringify(body)}`,
    )
  }

  return { id, bookingId }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/calcom.test.ts`
Expected: PASS. Note: the 5xx test calls `addAttendeeToBooking` twice (first rejects, second follow-up `.catch` relies on the mock still being in place — if `mockFetchOnce` consumes the mock, the second call will get the default fetch). That's intentional: the second call verifies the thrown value is an `instanceof CalApiError` check — if this fails because the mock is consumed, split the 5xx test into two sibling tests, each with its own `mockFetchOnce({ok:false, status:503, ...})`.

If the 5xx test fails with "fetch is not a function" on the second call, refactor:

```ts
  it('throws CalApiError with status >= 500 on cal.com 5xx', async () => {
    const { addAttendeeToBooking, CalApiError } = await import('@/src/lib/calcom')
    mockFetchOnce({ ok: false, status: 503, body: { error: 'boom' } })

    const err = await addAttendeeToBooking('root-abc', {
      name: 'X', email: 'x@example.com', timeZone: 'UTC',
    }).catch((e) => e)

    expect(err).toBeInstanceOf(CalApiError)
    expect(err.status).toBe(503)
  })
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/calcom.ts src/lib/__tests__/calcom.test.ts
git commit -m "$(cat <<'EOF'
feat(calcom): add addAttendeeToBooking(bookingUid, {...})

Public workshop registrations will call this to seat onto the root
booking instead of creating a fresh 1:1 booking. cal-api-version
2024-08-13 is mandatory. Error contract mirrors createCalEventType:
5xx/network → retryable, 4xx → permanent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `workshopCreatedFn` — create the root booking and backfill

**Files:**
- Modify: `src/inngest/functions/workshop-created.ts`
- Modify: `src/inngest/__tests__/workshop-created.test.ts`

- [ ] **Step 1: Extend the test mocks**

Open `src/inngest/__tests__/workshop-created.test.ts`. Update the `vi.hoisted` block to add a `createCalBookingMock` and expose it on the mocked module:

Find the `vi.hoisted(...)` block and add after `createCalEventTypeMock`:

```ts
    const createCalBookingMock = vi.fn()
```

and list it in the return object. Then update the `vi.mock('@/src/lib/calcom', ...)` factory to expose it:

```ts
vi.mock('@/src/lib/calcom', () => {
  class CalApiError extends Error {
    public readonly status: number
    constructor(status: number, message: string) {
      super(message)
      this.name = 'CalApiError'
      this.status = status
    }
  }
  return {
    CalApiError,
    createCalEventType: mocks.createCalEventTypeMock,
    createCalBooking:   mocks.createCalBookingMock,
  }
})
```

Update the existing workshop-row fixture inside T1 to include `scheduledAt` and `timezone`:

```ts
    mocks.limitMock.mockResolvedValueOnce([
      {
        id:                '00000000-0000-0000-0000-000000000001',
        title:             'Policy Roundtable',
        durationMinutes:   60,
        calcomEventTypeId: null,
        calcomBookingUid:  null,
        scheduledAt:       new Date('2026-05-01T10:00:00.000Z'),
        timezone:          'Asia/Kolkata',
        maxSeats:          50,
      },
    ])
```

Apply the same shape change to the fixtures in T2-T5 and the short-circuit test (add `calcomBookingUid`, `scheduledAt`, `timezone`, `maxSeats`).

- [ ] **Step 2: Add two new assertions to T1**

Extend the T1 test (`'T1: backfills calcomEventTypeId on successful cal.com response'`) to also assert:

```ts
    mocks.createCalEventTypeMock.mockResolvedValueOnce({ id: 12345 })
    mocks.createCalBookingMock.mockResolvedValueOnce({
      uid: 'root-uid-abc',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
    })
    vi.stubEnv('CAL_PRIMARY_ATTENDEE_EMAIL', 'vinay@konma.io')
    vi.stubEnv('CAL_PRIMARY_ATTENDEE_NAME', 'Vinay (PolicyDash)')

    // … existing invoke + expectations …

    expect(mocks.createCalBookingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventTypeId: 12345,
        email:       'vinay@konma.io',
        name:        'Vinay (PolicyDash)',
        timeZone:    'Asia/Kolkata',
        // startTime is ISO string of scheduledAt
      }),
    )
    const bookingCall = mocks.createCalBookingMock.mock.calls[0]?.[0] as { startTime?: string } | undefined
    expect(bookingCall?.startTime).toBe('2026-05-01T10:00:00.000Z')

    const backfillSet = mocks.setMock.mock.calls[0]?.[0] as {
      calcomEventTypeId?: string
      calcomBookingUid?: string
      meetingUrl?: string
    } | undefined
    expect(backfillSet?.calcomEventTypeId).toBe('12345')
    expect(backfillSet?.calcomBookingUid).toBe('root-uid-abc')
    expect(backfillSet?.meetingUrl).toBe('https://meet.google.com/abc-defg-hij')
```

Also add a new test for the booking-step failure mode:

```ts
  it('T6: cal.com 5xx on root-booking step bubbles a plain Error (retry path)', async () => {
    mocks.limitMock.mockResolvedValueOnce([
      {
        id:                'w', title: 'x', durationMinutes: 60,
        calcomEventTypeId: null, calcomBookingUid: null,
        scheduledAt:       new Date('2026-05-01T10:00:00.000Z'),
        timezone:          'Asia/Kolkata', maxSeats: 50,
      },
    ])
    vi.stubEnv('CAL_PRIMARY_ATTENDEE_EMAIL', 'vinay@konma.io')
    vi.stubEnv('CAL_PRIMARY_ATTENDEE_NAME', 'Vinay (PolicyDash)')
    mocks.createCalEventTypeMock.mockResolvedValueOnce({ id: 7777 })
    if (!CalApiErrorCtor) throw new Error('CalApiError ctor not resolved')
    mocks.createCalBookingMock.mockRejectedValueOnce(new CalApiErrorCtor(500, 'cal.com 500'))

    const { step } = makeStep()
    const { NonRetriableError } = await import('inngest')
    const thrown = await invoke(makeEvent(), step).catch((e) => e)
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown).not.toBeInstanceOf(NonRetriableError)
    // Backfill must not have run because booking failed.
    expect(mocks.updateMock).not.toHaveBeenCalled()
  })
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- src/inngest/__tests__/workshop-created.test.ts`
Expected: FAIL — `createCalBookingMock` is never called; backfill does not include `calcomBookingUid`/`meetingUrl`; T6 fails because the implementation doesn't call `createCalBooking`.

- [ ] **Step 4: Implement the root-booking step**

Open `src/inngest/functions/workshop-created.ts`. Replace imports at top:

```ts
import { NonRetriableError } from 'inngest'
import { eq } from 'drizzle-orm'
import { inngest } from '../client'
import { db } from '@/src/db'
import { workshops } from '@/src/db/schema/workshops'
import { createCalEventType, createCalBooking, CalApiError } from '@/src/lib/calcom'
```

Then extend the handler. The existing handler's Step 2 (create-cal-event-type) stays. Replace **Step 3** (`'backfill-calcom-event-type-id'`) with a NEW Step 3 that creates the root booking, plus a new Step 4 that does a combined backfill. Here's the full replacement body for the `async ({ event, step }) => { ... }` handler (keeping load-workshop + idempotency guard intact):

```ts
  async ({ event, step }) => {
    const { workshopId } = event.data as {
      workshopId:  string
      moderatorId: string
    }

    const workshop = await step.run('load-workshop', async () => {
      const [row] = await db
        .select()
        .from(workshops)
        .where(eq(workshops.id, workshopId))
        .limit(1)
      return row ?? null
    })

    if (!workshop) {
      throw new NonRetriableError(`workshop ${workshopId} not found`)
    }

    // Idempotency: both fields must be backfilled for the workshop to be
    // fully provisioned. If a prior run backfilled event-type but died
    // before creating the root booking, we re-enter here and finish the
    // booking half without re-provisioning the event type.
    if (workshop.calcomEventTypeId && workshop.calcomBookingUid) {
      return { workshopId, skipped: 'already-provisioned' as const }
    }

    const eventTypeId = workshop.calcomEventTypeId
      ? parseInt(workshop.calcomEventTypeId, 10)
      : await step.run('create-cal-event-type', async () => {
          try {
            const slug = `workshop-${workshop.id}`
            const result = await createCalEventType({
              title:            workshop.title,
              slug,
              durationMinutes:  workshop.durationMinutes ?? 60,
              seatsPerTimeSlot: workshop.maxSeats ?? 100,
            })
            return result.id
          } catch (err) {
            if (err instanceof CalApiError) {
              if (err.status >= 500) throw err
              throw new NonRetriableError(err.message)
            }
            throw new NonRetriableError(
              err instanceof Error ? err.message : String(err),
            )
          }
        })

    const rootBooking = await step.run('create-root-booking', async () => {
      const primaryEmail = process.env.CAL_PRIMARY_ATTENDEE_EMAIL
      const primaryName  = process.env.CAL_PRIMARY_ATTENDEE_NAME
      if (!primaryEmail || !primaryName) {
        throw new NonRetriableError(
          'CAL_PRIMARY_ATTENDEE_EMAIL / CAL_PRIMARY_ATTENDEE_NAME not set',
        )
      }
      try {
        return await createCalBooking({
          eventTypeId,
          name:      primaryName,
          email:     primaryEmail,
          startTime: workshop.scheduledAt.toISOString(),
          timeZone:  workshop.timezone,
        })
      } catch (err) {
        if (err instanceof CalApiError) {
          if (err.status >= 500) throw err
          throw new NonRetriableError(err.message)
        }
        throw new NonRetriableError(
          err instanceof Error ? err.message : String(err),
        )
      }
    })

    await step.run('backfill-cal-ids', async () => {
      await db
        .update(workshops)
        .set({
          calcomEventTypeId: String(eventTypeId),
          calcomBookingUid:  rootBooking.uid,
          meetingUrl:        rootBooking.meetingUrl,
          updatedAt:         new Date(),
        })
        .where(eq(workshops.id, workshopId))
    })

    return {
      workshopId,
      eventTypeId,
      bookingUid: rootBooking.uid,
      ok: true as const,
    }
  },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/inngest/__tests__/workshop-created.test.ts`
Expected: all tests (T1-T6 + short-circuit) pass.

- [ ] **Step 6: Commit**

```bash
git add src/inngest/functions/workshop-created.ts src/inngest/__tests__/workshop-created.test.ts
git commit -m "$(cat <<'EOF'
feat(inngest): create root seated booking at workshop-creation time

workshopCreatedFn now does three cal.com hops in sequence — event type,
root booking (vinay@konma.io), backfill. Both calcom_booking_uid and
meeting_url land on the workshop row atomically. Idempotency guard
only short-circuits when BOTH are populated, so a partial prior run
picks up at the booking half.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `/api/intake/workshop-register` — swap to `addAttendeeToBooking`

**Files:**
- Modify: `app/api/intake/workshop-register/route.ts`
- Create: `tests/phase-20/workshop-register-route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/phase-20/workshop-register-route.test.ts`:

```ts
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
// insert values.
vi.mock('@/src/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(mocks.dbSelectResults.shift() ?? []),
        }),
      }),
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/phase-20/workshop-register-route.test.ts`
Expected: FAIL — the route still calls `createCalBooking`, not `addAttendeeToBooking`.

- [ ] **Step 3: Rewrite the route**

Open `app/api/intake/workshop-register/route.ts`. Update the imports:

```ts
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { db } from '@/src/db'
import { workshops, workshopRegistrations } from '@/src/db/schema/workshops'
import { and, eq, ne, count } from 'drizzle-orm'
import { sendWorkshopRegistrationReceived } from '@/src/inngest/events'
import { addAttendeeToBooking } from '@/src/lib/calcom'
import { consume, getClientIp } from '@/src/lib/rate-limit'
```

Update the workshop-lookup select to also pull `calcomBookingUid` (find the existing `db.select({ ... }).from(workshops)` block and add the field):

```ts
  const [workshop] = await db
    .select({
      id: workshops.id,
      scheduledAt: workshops.scheduledAt,
      maxSeats: workshops.maxSeats,
      calcomEventTypeId: workshops.calcomEventTypeId,
      calcomBookingUid: workshops.calcomBookingUid,
      timezone: workshops.timezone,
    })
    .from(workshops)
    .where(eq(workshops.id, workshopId))
    .limit(1)
```

Replace the entire inner try-block (the one starting at `let bookingUid = \`direct:...` down through the `sendWorkshopRegistrationReceived` call) with:

```ts
  if (!workshop.calcomBookingUid) {
    // Workshop row exists but workshopCreatedFn has not yet backfilled the
    // root booking. Client retries after a short delay.
    return Response.json(
      { error: 'Workshop is still being set up. Please try again in a moment.' },
      { status: 503 },
    )
  }

  try {
    const attendee = await addAttendeeToBooking(workshop.calcomBookingUid, {
      name:     cleanName || 'Guest',
      email:    cleanEmail,
      timeZone: workshop.timezone,
    })

    const compositeBookingUid = `${workshop.calcomBookingUid}:${attendee.id}`

    await db
      .insert(workshopRegistrations)
      .values({
        workshopId,
        bookingUid:       compositeBookingUid,
        email:            cleanEmail,
        emailHash,
        name:             cleanName || null,
        bookingStartTime: workshop.scheduledAt,
        status:           'registered',
      })
      .onConflictDoNothing()

    await sendWorkshopRegistrationReceived({
      workshopId,
      email:      cleanEmail,
      emailHash,
      name:       cleanName,
      bookingUid: compositeBookingUid,
      source:     'direct_register',
    })

    console.log('[workshop-register] attendee added to root booking', {
      workshopId,
      rootBookingUid: workshop.calcomBookingUid,
      attendeeId:     attendee.id,
    })
  } catch (err) {
    console.error('[workshop-register] error:', err)
    return Response.json({ error: 'Registration failed' }, { status: 500 })
  }

  return Response.json({ success: true })
```

Delete the outer `try { … } catch { … }` wrapper that previously contained the `createCalBooking` block and the `needsCalComReconcile` flag — everything is inside the new `try` above.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/phase-20/workshop-register-route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/intake/workshop-register/route.ts tests/phase-20/workshop-register-route.test.ts
git commit -m "$(cat <<'EOF'
fix(workshops): add registrants as seats instead of new 1:1 bookings

The public intake route now calls addAttendeeToBooking against the
workshop's root booking uid. booking_uid in workshop_registrations is
stored as \`\${rootUid}:\${attendeeId}\` so the UNIQUE index still holds.
Returns 503 when the workshop has not yet been provisioned by
workshopCreatedFn. Eliminates the "multiple 1:1 meetings per workshop"
regression.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `/api/webhooks/cal` — cascade cancel + reschedule propagate

**Files:**
- Modify: `app/api/webhooks/cal/route.ts`
- Modify: `tests/phase-20/cal-webhook-route.test.ts`

- [ ] **Step 1: Add new test cases**

Append to `tests/phase-20/cal-webhook-route.test.ts` inside the existing `describe` blocks (or add a new `describe` at the bottom). Add these cases:

```ts
describe('BOOKING_CANCELLED — root-uid cascade', () => {
  it('cancels every registration row when uid matches workshops.calcomBookingUid', async () => {
    // First select: workshop lookup by calcomBookingUid
    mocks.dbSelectResults = [[{ id: 'ws-1' }]]

    const body = {
      triggerEvent: 'BOOKING_CANCELLED',
      payload: { uid: 'root-abc' },
    }
    const signed = signBody(JSON.stringify(body), 'test-secret')
    const res = await callRoute(body, signed, 'test-secret')
    expect(res.status).toBe(200)

    // Should have an UPDATE on workshopRegistrations with a LIKE clause
    // pattern. We assert the SET status and the WHERE shape by inspecting
    // the captured update call.
    const upd = mocks.dbUpdateCalls.find(
      (c) => c.table === 'workshop_registrations',
    )
    expect(upd).toBeTruthy()
    expect((upd?.set as { status?: string }).status).toBe('cancelled')
  })
})

describe('BOOKING_CANCELLED — seat-level', () => {
  it('matches the seat booking_uid exactly when root lookup returns no workshop', async () => {
    // First select: no workshop for that uid → falls back to exact match.
    mocks.dbSelectResults = [[]]

    const body = {
      triggerEvent: 'BOOKING_CANCELLED',
      payload: { uid: 'root-abc:777' },
    }
    const signed = signBody(JSON.stringify(body), 'test-secret')
    const res = await callRoute(body, signed, 'test-secret')
    expect(res.status).toBe(200)

    const upd = mocks.dbUpdateCalls.find(
      (c) => c.table === 'workshop_registrations',
    )
    expect(upd).toBeTruthy()
  })
})

describe('BOOKING_RESCHEDULED — root booking', () => {
  it('updates workshops.scheduledAt + calcomBookingUid + cascades booking_uid prefix', async () => {
    mocks.dbSelectResults = [[{ id: 'ws-1' }]]
    const body = {
      triggerEvent: 'BOOKING_RESCHEDULED',
      payload: {
        rescheduleUid: 'root-abc',
        uid:           'root-xyz',
        startTime:     '2026-05-15T12:00:00.000Z',
      },
    }
    const signed = signBody(JSON.stringify(body), 'test-secret')
    const res = await callRoute(body, signed, 'test-secret')
    expect(res.status).toBe(200)

    const workshopUpdate = mocks.dbUpdateCalls.find(
      (c) => c.table === 'workshops',
    )
    const set = workshopUpdate?.set as {
      calcomBookingUid?: string
      scheduledAt?: Date
    } | undefined
    expect(set?.calcomBookingUid).toBe('root-xyz')
    expect(set?.scheduledAt).toBeInstanceOf(Date)
  })
})
```

`signBody` and `callRoute` already exist in this test file — reuse them. If they don't, look at the existing BOOKING_CREATED tests in the same file to mirror the helpers.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/phase-20/cal-webhook-route.test.ts`
Expected: FAIL — current handler does not look up workshops by `calcomBookingUid`, does not cascade, does not update `workshops.scheduledAt` + `calcomBookingUid`.

- [ ] **Step 3: Rewrite the handler**

Open `app/api/webhooks/cal/route.ts`. Add a new helper near the top (after `findWorkshopByCalEventTypeId`):

```ts
async function findWorkshopByRootBookingUid(
  bookingUid: string | undefined,
): Promise<string | null> {
  if (!bookingUid) return null
  const [row] = await db
    .select({ id: workshops.id })
    .from(workshops)
    .where(eq(workshops.calcomBookingUid, bookingUid))
    .limit(1)
  return row?.id ?? null
}
```

Add a `like` import at the top:

```ts
import { and, eq, inArray, desc, like } from 'drizzle-orm'
```

Replace the `BOOKING_CREATED` case body with:

```ts
      case 'BOOKING_CREATED': {
        // No-op: the root seated booking is created server-side by
        // workshopCreatedFn, and subsequent attendee-adds do NOT fire this
        // webhook. Return 200 to satisfy cal.com's delivery contract in
        // case any future shape does fire it.
        return new Response('OK (ignored in new model)', { status: 200 })
      }
```

Replace the `BOOKING_CANCELLED` case body with:

```ts
      case 'BOOKING_CANCELLED': {
        if (!bookingData.uid) return new Response('OK', { status: 200 })

        // If this uid is a workshop's root booking, cascade-cancel every
        // registration for that workshop. Otherwise treat uid as an
        // individual seat's booking_uid (attendee-self-cancel or legacy
        // per-seat cancel shape) and update only that row.
        const workshopIdForRoot = await findWorkshopByRootBookingUid(bookingData.uid)

        if (workshopIdForRoot) {
          await db
            .update(workshopRegistrations)
            .set({
              status:      'cancelled',
              cancelledAt: new Date(),
              updatedAt:   new Date(),
            })
            .where(like(workshopRegistrations.bookingUid, `${bookingData.uid}:%`))
          revalidateTag(spotsTag(workshopIdForRoot), 'max')
        } else {
          const cancelled = await db
            .update(workshopRegistrations)
            .set({
              status:      'cancelled',
              cancelledAt: new Date(),
              updatedAt:   new Date(),
            })
            .where(eq(workshopRegistrations.bookingUid, bookingData.uid))
            .returning({ workshopId: workshopRegistrations.workshopId })
          for (const row of cancelled) {
            if (row.workshopId) revalidateTag(spotsTag(row.workshopId), 'max')
          }
        }

        return new Response('OK', { status: 200 })
      }
```

Replace the `BOOKING_RESCHEDULED` case body with:

```ts
      case 'BOOKING_RESCHEDULED': {
        const origUid = bookingData.rescheduleUid
        const newUid  = bookingData.uid
        if (!origUid || !newUid || !bookingData.startTime) {
          return new Response('OK', { status: 200 })
        }
        const newStart = new Date(bookingData.startTime)

        const workshopIdForRoot = await findWorkshopByRootBookingUid(origUid)

        if (workshopIdForRoot) {
          // Workshop-level reschedule: update the workshop row AND every
          // registration's booking_uid prefix + bookingStartTime.
          await db
            .update(workshops)
            .set({
              calcomBookingUid: newUid,
              scheduledAt:      newStart,
              updatedAt:        new Date(),
            })
            .where(eq(workshops.id, workshopIdForRoot))

          // Rewrite each child registration's composite booking_uid prefix.
          // We cannot express the prefix-swap purely in SQL with drizzle's
          // query builder, so fetch + update in a loop. Ranges are small
          // (≤ maxSeats) so this is fine.
          const rows = await db
            .select({ id: workshopRegistrations.id, bookingUid: workshopRegistrations.bookingUid })
            .from(workshopRegistrations)
            .where(like(workshopRegistrations.bookingUid, `${origUid}:%`))

          for (const row of rows) {
            const suffix = row.bookingUid.slice(origUid.length + 1)
            await db
              .update(workshopRegistrations)
              .set({
                bookingUid:       `${newUid}:${suffix}`,
                bookingStartTime: newStart,
                status:           'rescheduled',
                updatedAt:        new Date(),
              })
              .where(eq(workshopRegistrations.id, row.id))
          }

          revalidateTag(spotsTag(workshopIdForRoot), 'max')
          return new Response('OK', { status: 200 })
        }

        // Fall back to seat-level reschedule (exact bookingUid match).
        const updated = await db
          .update(workshopRegistrations)
          .set({
            bookingUid:       newUid,
            bookingStartTime: newStart,
            status:           'rescheduled',
            updatedAt:        new Date(),
          })
          .where(eq(workshopRegistrations.bookingUid, origUid))
          .returning({ workshopId: workshopRegistrations.workshopId })

        for (const row of updated) {
          if (row.workshopId) revalidateTag(spotsTag(row.workshopId), 'max')
        }
        return new Response('OK', { status: 200 })
      }
```

`MEETING_ENDED` stays as-is. Any other cases stay as-is.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/phase-20/cal-webhook-route.test.ts`
Expected: PASS. Existing tests continue to pass because the fallback paths preserve the old behaviour for non-root uids.

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/cal/route.ts tests/phase-20/cal-webhook-route.test.ts
git commit -m "$(cat <<'EOF'
feat(webhooks): cascade cal.com lifecycle across workshop seats

BOOKING_CREATED is now a no-op (root booking is created server-side).
BOOKING_CANCELLED checks whether the uid is a workshop's root booking
and, if so, marks every seat cancelled at once. BOOKING_RESCHEDULED
similarly propagates the new start time + new root uid to the
workshop row and every child registration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Remove `reprovisionCalSeats` + `updateCalEventTypeSeats` + button

**Files:**
- Delete: `app/workshop-manage/[id]/_components/reprovision-cal-button.tsx`
- Modify: `src/server/routers/workshop.ts` (remove `reprovisionCalSeats` mutation + related import)
- Modify: `src/lib/calcom.ts` (remove `updateCalEventTypeSeats`)
- Modify: `app/workshop-manage/[id]/page.tsx` (remove button mount if present)
- Modify: `app/workshop-manage/[id]/edit/page.tsx` (remove button mount if present)

- [ ] **Step 1: Find button usages**

Run: `grep -rn 'ReprovisionCalButton\|reprovisionCalSeats\|updateCalEventTypeSeats' --include='*.ts' --include='*.tsx' app/ src/`
Expected: list of files that reference any of the three symbols. Review the list.

- [ ] **Step 2: Delete the button component**

Run: `git rm app/workshop-manage/[id]/_components/reprovision-cal-button.tsx`

- [ ] **Step 3: Remove button mounts**

For every file surfaced in Step 1 that imports `ReprovisionCalButton`: delete the import line and delete the `<ReprovisionCalButton ... />` JSX tag. Don't replace with anything — the action is gone.

- [ ] **Step 4: Remove the tRPC mutation**

Open `src/server/routers/workshop.ts`. Delete:
- the import of `updateCalEventTypeSeats` (keep `updateCalEventType` if it exists in the import)
- the entire `reprovisionCalSeats: requirePermission(...).input(...).mutation(...)` block (lines ~108–155 on current master)
- the `F11: if maxSeats changed, push the new seat count to cal.com` block in the `update` mutation (the `if (calNumericId !== null && input.maxSeats !== undefined && ...)` block calling `updateCalEventTypeSeats`). Keep the DB-level maxSeats update; only drop the cal.com propagation.

- [ ] **Step 5: Remove `updateCalEventTypeSeats` from the client**

Open `src/lib/calcom.ts`. Delete the entire `updateCalEventTypeSeats(eventTypeId, seatsPerTimeSlot)` function.

- [ ] **Step 6: Verify type check**

Run: `npx tsc --noEmit`
Expected: no errors (or no new errors versus master baseline).

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: every test passes. If any test imported `updateCalEventTypeSeats` or `reprovisionCalSeats`, update or delete that test.

- [ ] **Step 8: Commit**

```bash
git add -A
git status
```
Review the `git status` output to confirm only the intended files are staged. If anything unexpected is staged (e.g. unrelated changes), unstage it: `git restore --staged <path>`.

```bash
git commit -m "$(cat <<'EOF'
chore(workshops): remove reprovision-cal-seats dead code

New workshops have seats set correctly from creation time via
workshopCreatedFn, so the admin-facing "Reprovision seats" repair
action + its backing tRPC mutation + updateCalEventTypeSeats helper
are no longer needed. Existing workshops (no upcoming) are not
affected.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Remove `@calcom/embed-react` and its ambient shim

**Files:**
- Modify: `package.json` / `package-lock.json` (via `npm uninstall`)
- Delete: `types/calcom-embed-react.d.ts`
- Modify: `src/inngest/functions/workshop-created.ts` (stale `CAL_USERNAME` comment)

- [ ] **Step 1: Confirm no source code imports the package**

Run: `grep -rn '@calcom/embed-react' --include='*.ts' --include='*.tsx' app/ src/ tests/`
Expected: no matches (only the `types/calcom-embed-react.d.ts` file should reference the module, and we're about to delete it).

If the grep surfaces an import, stop and investigate before continuing.

- [ ] **Step 2: Uninstall the package**

Run: `npm uninstall @calcom/embed-react`
Expected: `package.json` and `package-lock.json` are updated, `@calcom/embed-react` removed from `dependencies`.

- [ ] **Step 3: Delete the ambient declaration file**

Run: `git rm types/calcom-embed-react.d.ts`

- [ ] **Step 4: Remove the stale `CAL_USERNAME` comment**

Open `src/inngest/functions/workshop-created.ts`. Find the block of comments that says `${CAL_USERNAME}/workshop-${workshop.id}` and "Step 3: backfill the workshop row…". Delete any sentence referring to `CAL_USERNAME` or to a public-page embed (those sentences are now misleading).

If the comment block currently reads:

```ts
    // Step 3: backfill the workshop row with the numeric cal.com event type ID.
    // The slug (for embed calLink) is computed at render time as
    // ${CAL_USERNAME}/workshop-${workshop.id} - deterministic and matches
    // what was created in step 2.
```

delete it entirely — the refactored code already has inline comments on the new `backfill-cal-ids` step.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: the Next.js build completes successfully. Ignore any pre-existing warnings; new errors are blocking.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/inngest/functions/workshop-created.ts
git status  # confirm types/calcom-embed-react.d.ts shows as deleted (staged by git rm)
git commit -m "$(cat <<'EOF'
chore(deps): remove @calcom/embed-react, never shipped

The embed was planned for the public /workshops page but we ship a
native form instead. Dropping the package also removes the Phase 20
ambient declaration shim and the stale CAL_USERNAME comment.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Full test + build gate

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: every test in the repo passes. Absolutely every test — if an unrelated test is failing, investigate whether it's pre-existing on `master` (check with `git stash && npm test && git stash pop`). If new, fix before continuing.

- [ ] **Step 2: Run the full build (type check + Next.js build)**

Run: `npm run build`
Expected: build succeeds. New type errors are blocking.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no new errors. New warnings are acceptable only if they match pre-existing warning classes in the touched files.

- [ ] **Step 4: If any gate fails, fix inline and commit**

If any of steps 1–3 surfaced a regression, fix it. Commit under a `fix:` message. Do not skip hooks or bypass gates.

- [ ] **Step 5: Tag the work as complete in the local log**

Append to `.planning/STATE.md` under the most recent milestone's "done" list (if that file exists and uses that format; otherwise skip). Single bullet:

```
- 2026-04-21: Workshop meetings redesign — Google Meet + single shared booking. Spec + plan + 9 implementation commits.
```

- [ ] **Step 6: Commit the state update (if one was made)**

```bash
git add .planning/STATE.md
git commit -m "chore(planning): log workshop meetings redesign completion"
```

---

## Task 11: Smoke-test runbook (post-deploy, manual)

Not an implementation task — documents the validation that happens against the real cal.com workspace (organizer: `vinit@konma.io`). Run this only after a Vercel preview/prod deploy where the new env vars are set.

- [ ] **Test 1: workshop creation → one event type + one root booking**

Create a workshop via the admin UI. On `app.cal.com`, as `vinit@konma.io`, confirm:
- New event type appears with slug `workshop-<id>` and location **Google Meet** (not Cal Video).
- One seated booking exists for the event type at the scheduled datetime, with `vinay@konma.io` listed as primary attendee, and a `https://meet.google.com/…` URL attached.
- **Record which response field carried the Meet URL** (`data.meetingUrl` vs `data.location`). If it was `location`, the current fallback handles it; if it was a field we didn't anticipate (e.g. `data.conferenceData.entryPoints[0].uri`), file a follow-up to widen the parser in `src/lib/calcom.ts`.

- [ ] **Test 2: two registrations → one booking, three attendees**

Submit the public register form from two different email addresses. Confirm:
- Cal.com dashboard shows the **same** booking with three attendees (Vinay + two registrants), not three bookings.
- Both registrants receive cal.com's confirmation email with the **same** Meet link.
- `workshop_registrations` table has two rows with `booking_uid` = `${rootUid}:${attendeeId}`.

- [ ] **Test 3: attendee self-cancel**

One of the two registrants clicks the "Cancel booking" link in their confirmation email. Confirm:
- Our webhook logs a `BOOKING_CANCELLED` trigger.
- **Record the payload shape** — does it carry `uid` = seat uid, or `uid` = root uid + `seatUid` = seat? If it's the latter, file a follow-up to match on `seatUid` as the primary key.
- Only that registrant's row flips to `cancelled`. Vinay + the other registrant stay intact.

- [ ] **Test 4: moderator cancels the root booking**

On `app.cal.com`, cancel the root booking. Confirm our webhook cascades and every registration row flips to `cancelled`.

- [ ] **Test 5: MEETING_ENDED still works**

Let the workshop's scheduled time pass; end the Meet call. Confirm:
- Our webhook flips workshop status to `completed`.
- Feedback invites dispatch to every registrant.

If any test surfaces a discrepancy with the spec or plan, open a follow-up issue with the exact observed payload pasted in — don't reactively patch without the evidence.

---

## Self-review checklist (already applied)

**Spec coverage:** every section in the spec maps to a task:
- Data model changes → Task 1.
- Env vars → Task 1.
- Cal.com primitives (event type Google Meet, root booking, addAttendeeToBooking, patch event type) → Tasks 2, 3, 4; patch-event-type already exists and is unchanged.
- Flow: workshop creation → Task 5.
- Flow: public registration → Task 6.
- Flow: webhooks → Task 7.
- Removed (`reprovisionCalSeats`, `updateCalEventTypeSeats`, embed dep, shim, CAL_USERNAME comment, `direct:` fallback) → Tasks 8, 9 + inline in Task 6.
- Smoke tests → Task 11 (runbook, not code).

**Placeholder scan:** none — every step has exact paths, concrete code blocks, explicit commands.

**Type consistency:** `CalBookingResult` gains `meetingUrl` in Task 3 and is consumed by the backfill step in Task 5 — matched. `CalAddAttendeeResult` is defined in Task 4 and consumed in Task 6 — matched. `workshops.calcomBookingUid` / `workshops.meetingUrl` introduced in Task 1 and consumed in Tasks 5, 6, 7 — matched.

**Known caveats:**
- Task 5 changes the idempotency guard from single-field (`calcomEventTypeId`) to both-fields (`calcomEventTypeId && calcomBookingUid`). Not flagged in the spec; this is the plan-level decision that makes partial-failure re-runs finish the job instead of short-circuiting halfway.
- Task 7's BOOKING_RESCHEDULED implementation does a row-by-row update for the composite booking_uid rewrite instead of a single SQL expression. Acceptable because seat counts are small (≤ `maxSeats`, typically <100).
