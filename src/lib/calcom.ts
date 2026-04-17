import 'server-only'

/**
 * cal.com API v2 client - minimal surface for Phase 20 WS-07.
 *
 * Decisions:
 *   - D-01: workshop create is async via Inngest; this module is called from
 *           `workshopCreatedFn` inside a `step.run` boundary so Inngest
 *           captures the network hop for retries.
 *   - D-02: default event-type location is Cal Video (built-in, zero ops
 *           dependency, MEETING_ENDED webhook fires reliably). No per-workshop
 *           location selector in Phase 20.
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
        // D-02: Cal Video as the default meeting location.
        locations: [{ type: 'integration', integration: 'cal-video' }],
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

export interface CalBookingInput {
  eventTypeId: number
  name: string
  email: string
  startTime: string
  timeZone?: string
}

export interface CalBookingResult {
  uid: string
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
}
