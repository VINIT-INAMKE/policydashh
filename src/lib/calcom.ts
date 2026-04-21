import 'server-only'

/**
 * cal.com API v2 client - minimal surface for Phase 20 WS-07.
 *
 * Decisions:
 *   - D-01: workshop create is async via Inngest; this module is called from
 *           `workshopCreatedFn` inside a `step.run` boundary so Inngest
 *           captures the network hop for retries.
 *   - D-02 (SUPERSEDED 2026-04-21): default event-type location was originally
 *           Cal Video; switched to Google Meet as part of the workshop
 *           meetings redesign (docs/superpowers/specs/2026-04-21-...). Meet
 *           link is provisioned through the shared org account's connected
 *           Google Calendar OAuth. No per-workshop location selector.
 *   - D-04: single shared cal.com org account. One API key in env
 *           `CAL_API_KEY`. Per-admin OAuth is explicitly out of scope.
 *
 * Error contract (drives D-03 retry policy in workshopCreatedFn):
 *   - 5xx response              → CalApiError with status >= 500 → caller
 *                                 rethrows as plain Error so Inngest retries.
 *   - 4xx response              → CalApiError with status < 500 → caller
 *                                 wraps in NonRetriableError.
 *   - Missing CAL_API_KEY       → CalApiError(400, …) → NonRetriableError.
 *   - Malformed response body   → CalApiError(500, …) → retried. This is
 *                                 intentionally conservative - a transient
 *                                 parse glitch is worth one retry before we
 *                                 give up.
 *
 * Per 20-RESEARCH.md "Verified: Cal.com Event Type Creation":
 *   - Base URL:    https://api.cal.com/v2
 *   - Endpoint:    POST /v2/event-types
 *   - Auth header: Authorization: Bearer ${CAL_API_KEY}
 *   - Version hdr: cal-api-version: 2024-06-14  (required)
 *   - Body:        { title, slug, lengthInMinutes, locations: [...] }
 *   - Research OQ2: docs disagree on `lengthInMinutes` vs `length` - we pass
 *     BOTH field names in the same request body. One will be accepted and the
 *     other ignored; neither causes a 400 when both are valid.
 *   - Response:    { data: { id: number } }
 */

export interface CalEventTypeInput {
  /** Human-visible title shown on the cal.com booking page. */
  title: string
  /** URL slug segment for the event type. Must be unique inside the cal.com org. */
  slug: string
  /** Meeting length in minutes. Must be a positive integer. */
  durationMinutes: number
  /**
   * Seats per time slot - workshops are multi-attendee broadcasts, so this
   * must be > 1. Without it cal.com rejects the 2nd booking with "User
   * already has booking at this time". Defaults to 100 when not provided.
   */
  seatsPerTimeSlot?: number
}

export interface CalEventTypeCreateResult {
  /** Numeric event type id returned by cal.com. */
  id: number
}

/**
 * Thrown by createCalEventType whenever the API call fails or returns an
 * unusable response. `status` mirrors the HTTP status code when available,
 * or 400 / 500 for client-side / parsing failures (see module JSDoc).
 */
export class CalApiError extends Error {
  public readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'CalApiError'
    this.status = status
  }
}

/**
 * Create a cal.com event type under the shared org account.
 *
 * Throws CalApiError on any failure - the Inngest function layer inspects
 * `err.status` to decide between retry (>= 500) and NonRetriableError (< 500).
 */
export async function createCalEventType(
  input: CalEventTypeInput,
): Promise<CalEventTypeCreateResult> {
  const apiKey = process.env.CAL_API_KEY
  if (!apiKey) {
    throw new CalApiError(400, 'CAL_API_KEY not set')
  }

  let res: Response
  try {
    res = await fetch('https://api.cal.com/v2/event-types', {
      method: 'POST',
      headers: {
        'Authorization':    `Bearer ${apiKey}`,
        'Content-Type':     'application/json',
        'cal-api-version':  '2024-06-14',
      },
      body: JSON.stringify({
        title: input.title,
        slug:  input.slug,
        // Research OQ2 - pass both field names to cover the doc discrepancy.
        lengthInMinutes: input.durationMinutes,
        length:          input.durationMinutes,
        // Google Meet is provisioned through the cal.com account's connected
        // Google Calendar OAuth (account: vinit@konma.io). Cal.com docs
        // disagree on the exact slug — sending both candidate shapes is
        // safe; whichever the backend accepts wins, the other is ignored.
        // Same tolerance pattern as `length`/`lengthInMinutes` above.
        locations: [
          { type: 'integration', integration: 'google-meet' },
          { type: 'integrations:google:meet' },
        ],
        // Workshops are multi-attendee. Without seats, cal.com treats the
        // event type as 1-on-1 and rejects every booking after the first on
        // the same slot. See commit adding this for context.
        seats: {
          seatsPerTimeSlot: input.seatsPerTimeSlot ?? 100,
          showAttendeeInfo: false,
          showAvailabilityCount: true,
        },
      }),
    })
  } catch (err) {
    // Network-level failure (DNS, TLS, connection reset). Treat as 5xx so the
    // Inngest function retries - transient infra blips shouldn't kill the
    // workshop row forever.
    throw new CalApiError(
      500,
      `cal.com network failure: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>')
    throw new CalApiError(res.status, `cal.com API ${res.status}: ${text}`)
  }

  let body: { data?: { id?: number } }
  try {
    body = (await res.json()) as { data?: { id?: number } }
  } catch (err) {
    throw new CalApiError(
      500,
      `cal.com response JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  const id = body.data?.id
  if (typeof id !== 'number') {
    throw new CalApiError(
      500,
      `cal.com response missing numeric data.id: ${JSON.stringify(body)}`,
    )
  }

  return { id }
}

/**
 * Patch an existing cal.com event type to enable multi-attendee seats.
 *
 * Use when a workshop's event type was provisioned before the seats config
 * was added to createCalEventType. Without this, only the first attendee
 * can book; subsequent bookings fail with "User already has booking at this
 * time or is not available" (400).
 */
export async function updateCalEventTypeSeats(
  eventTypeId: number,
  seatsPerTimeSlot: number,
): Promise<void> {
  const apiKey = process.env.CAL_API_KEY
  if (!apiKey) {
    throw new CalApiError(400, 'CAL_API_KEY not set')
  }

  let res: Response
  try {
    res = await fetch(`https://api.cal.com/v2/event-types/${eventTypeId}`, {
      method: 'PATCH',
      headers: {
        'Authorization':    `Bearer ${apiKey}`,
        'Content-Type':     'application/json',
        'cal-api-version':  '2024-06-14',
      },
      body: JSON.stringify({
        seats: {
          seatsPerTimeSlot,
          showAttendeeInfo: false,
          showAvailabilityCount: true,
        },
      }),
    })
  } catch (err) {
    throw new CalApiError(
      500,
      `cal.com PATCH network failure: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>')
    throw new CalApiError(res.status, `cal.com PATCH ${res.status}: ${text}`)
  }
}

/**
 * Generic PATCH for cal.com event-types used by F10 workshop-edit propagation.
 *
 * Only the fields actually provided on the input are sent in the PATCH body -
 * cal.com merges the partial update so we do not clobber unrelated settings.
 * Any failure (network, 4xx, 5xx) surfaces as CalApiError; the caller decides
 * whether to surface a user-facing warning or silently swallow.
 */
export interface CalEventTypePatch {
  title?: string
  lengthInMinutes?: number
}

export async function updateCalEventType(
  eventTypeId: number,
  patch: CalEventTypePatch,
): Promise<void> {
  const apiKey = process.env.CAL_API_KEY
  if (!apiKey) {
    throw new CalApiError(400, 'CAL_API_KEY not set')
  }

  const body: Record<string, unknown> = {}
  if (patch.title !== undefined) body.title = patch.title
  if (patch.lengthInMinutes !== undefined) {
    // Mirror createCalEventType's doc-discrepancy workaround - cal.com docs
    // disagree on field name; sending both is safe.
    body.lengthInMinutes = patch.lengthInMinutes
    body.length = patch.lengthInMinutes
  }

  if (Object.keys(body).length === 0) return

  let res: Response
  try {
    res = await fetch(`https://api.cal.com/v2/event-types/${eventTypeId}`, {
      method: 'PATCH',
      headers: {
        'Authorization':    `Bearer ${apiKey}`,
        'Content-Type':     'application/json',
        'cal-api-version':  '2024-06-14',
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new CalApiError(
      500,
      `cal.com PATCH network failure: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>')
    throw new CalApiError(res.status, `cal.com PATCH ${res.status}: ${text}`)
  }
}

export interface CalBookingInput {
  eventTypeId: number
  name: string
  email: string
  startTime: string
  timeZone?: string
}

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

export async function createCalBooking(
  input: CalBookingInput,
): Promise<CalBookingResult> {
  const apiKey = process.env.CAL_API_KEY
  if (!apiKey) {
    throw new CalApiError(400, 'CAL_API_KEY not set')
  }

  let res: Response
  try {
    res = await fetch('https://api.cal.com/v2/bookings', {
      method: 'POST',
      headers: {
        'Authorization':    `Bearer ${apiKey}`,
        'Content-Type':     'application/json',
        // Bookings endpoint requires the 2024-08-13 API version; the older
        // 2024-06-14 header triggers a legacy DTO that rejects the attendee
        // shape and surfaces misleading "timeZone/language/metadata must be..."
        // validation errors. Do not downgrade.
        'cal-api-version':  '2024-08-13',
      },
      body: JSON.stringify({
        start: input.startTime,
        eventTypeId: input.eventTypeId,
        attendee: {
          name: input.name || 'Guest',
          email: input.email,
          timeZone: input.timeZone || 'Asia/Kolkata',
          language: 'en',
        },
        metadata: {},
      }),
    })
  } catch (err) {
    throw new CalApiError(
      500,
      `cal.com booking network failure: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>')
    throw new CalApiError(res.status, `cal.com booking API ${res.status}: ${text}`)
  }

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
}
