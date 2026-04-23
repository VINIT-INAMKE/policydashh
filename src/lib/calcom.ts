import 'server-only'

/**
 * cal.com API v2 client — minimal surface used by the workshop-provisioning
 * pipeline and the public registration route.
 *
 * Architectural notes:
 *   - Workshop create is async via Inngest. This module is called from
 *     `workshopCreatedFn` inside a `step.run` boundary so Inngest captures
 *     the network hop for retries.
 *   - Default event-type location is Google Meet (switched from Cal Video
 *     during the 2026-04-21 workshop meetings redesign). The Meet link is
 *     provisioned through the shared cal.com account's connected Google
 *     Calendar OAuth. There is no per-workshop location selector.
 *   - One shared cal.com org account under `CAL_API_KEY`. Per-admin OAuth
 *     is explicitly out of scope.
 *
 * Error contract (drives the retry policy in `workshopCreatedFn`):
 *   - 5xx response              → CalApiError with status >= 500 → caller
 *                                 rethrows as plain Error so Inngest retries.
 *   - 4xx response              → CalApiError with status < 500 → caller
 *                                 wraps in NonRetriableError.
 *   - Missing CAL_API_KEY       → CalApiError(400, …) → NonRetriableError.
 *   - Malformed response body   → CalApiError(500, …) → retried. This is
 *                                 intentionally conservative — a transient
 *                                 parse glitch is worth one retry before we
 *                                 give up.
 *
 * API version headers (cal.com stabilises each endpoint independently):
 *
 *   | Endpoint                              | `cal-api-version` |
 *   |---------------------------------------|-------------------|
 *   | POST   /v2/event-types                | 2024-06-14        |
 *   | PATCH  /v2/event-types/{id}           | 2024-06-14        |
 *   | POST   /v2/bookings                   | 2024-08-13        |
 *   | POST   /v2/bookings/{uid}/attendees   | 2024-08-13        |
 *
 * Downgrading the bookings endpoint to 2024-06-14 surfaces a legacy DTO
 * that rejects the attendee shape with misleading "timeZone/language/
 * metadata must be…" validation errors. Do not change the table without
 * re-verifying against cal.com's live API.
 *
 * Event-type creation body shape:
 *   - Base URL:    https://api.cal.com/v2
 *   - Endpoint:    POST /v2/event-types
 *   - Auth header: Authorization: Bearer ${CAL_API_KEY}
 *   - Body:        { title, slug, lengthInMinutes, length, locations,
 *                    seats: { seatsPerTimeSlot, showAttendeeInfo,
 *                             showAvailabilityCount } }
 *     - We pass BOTH `lengthInMinutes` and `length` in the same request —
 *       cal.com's docs disagree on field name; one is accepted and the
 *       other ignored, neither causes a 400 when both are valid.
 *     - `seats.seatsPerTimeSlot` is required for multi-attendee broadcasts;
 *       without it the event type is 1-on-1 and every booking after the
 *       first on the same slot is rejected.
 *   - Response:    { data: { id: number } }
 */

// ---------------------------------------------------------------------------
// Shared cal.com constants + helpers (extracted 2026-04-23, Batch 1 of the
// post-redesign punchlist). Kept in this module so every cal.com caller
// imports the same literals — the prior duplication of UID_SAFE,
// hardcoded `:` delimiters, magic `?? 100`, and the `workshop.created`
// event-name string literal was a consistent source of drift.
// ---------------------------------------------------------------------------

/**
 * Authoritative format assertion for a cal.com booking uid. Used before
 * interpolating into a SQL LIKE pattern to prevent `%` / `_` / `\`
 * wildcard injection if cal.com's uid format ever widens beyond
 * alphanumerics, `_`, and `-`.
 *
 * Aligned with the UID format cal.com currently ships
 * (see `src/lib/calcom.ts` `createCalBooking` write-time guard and the
 * webhook handler cascade branches).
 */
export const UID_SAFE = /^[A-Za-z0-9_-]+$/

/**
 * Delimiter joining a cal.com root booking uid to a seat's attendee id in
 * our composite `workshop_registrations.booking_uid` scheme. Changing this
 * value requires a data migration across every stored booking_uid.
 */
export const COMPOSITE_BOOKING_UID_DELIMITER = ':'

/**
 * Default seats-per-time-slot when an admin creates a workshop without
 * an explicit `maxSeats`. Workshops are multi-attendee broadcasts — without
 * `seats.seatsPerTimeSlot > 1`, cal.com treats the event type as 1-on-1
 * and rejects every booking after the first on the same slot.
 */
export const DEFAULT_SEATS_PER_TIME_SLOT = 100

/**
 * Inngest event name emitted by the admin workshop-create mutation that
 * triggers async cal.com provisioning. Keep the string in lockstep with
 * the schema/trigger in `src/inngest/events.ts` and
 * `src/inngest/functions/workshop-created.ts`.
 */
export const WORKSHOP_CREATED_EVENT = 'workshop.created'

/**
 * Shape the composite booking uid stored on `workshop_registrations.booking_uid`.
 * Callers should never concatenate the delimiter by hand — use this helper
 * so one day we can change the format in a single place.
 */
export function buildCompositeBookingUid(
  rootUid: string,
  attendeeId: number,
): string {
  return `${rootUid}${COMPOSITE_BOOKING_UID_DELIMITER}${attendeeId}`
}

/**
 * SQL LIKE pattern that matches every seat belonging to a given root
 * booking uid. Used by the webhook cascade branches (BOOKING_CANCELLED
 * and BOOKING_RESCHEDULED) to address all children of a workshop in one
 * statement.
 */
export function cascadePattern(rootUid: string): string {
  return `${rootUid}${COMPOSITE_BOOKING_UID_DELIMITER}%`
}

/**
 * Seats-per-time-slot config shared by the create + patch shapes so the
 * field name can only drift in one place.
 */
export interface CalSeatsConfig {
  seatsPerTimeSlot: number
}

export interface CalEventTypeInput {
  /** Human-visible title shown on the cal.com booking page. */
  title: string
  /**
   * URL slug segment for the event type. Must be unique inside the cal.com
   * org or create will fail with HTTP 409 ("slug already exists"). The
   * workshop-created Inngest function derives slugs as `workshop-${id}`,
   * which guarantees uniqueness and makes reprovisioning deterministic.
   */
  slug: string
  /** Meeting length in minutes. Must be a positive integer. */
  durationMinutes: number
  /**
   * Seats per time slot - workshops are multi-attendee broadcasts, so this
   * must be > 1. Without it cal.com rejects the 2nd booking with "User
   * already has booking at this time". Defaults to
   * {@link DEFAULT_SEATS_PER_TIME_SLOT} when not provided.
   */
  seatsPerTimeSlot?: CalSeatsConfig['seatsPerTimeSlot']
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
          seatsPerTimeSlot: input.seatsPerTimeSlot ?? DEFAULT_SEATS_PER_TIME_SLOT,
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
 * Generic PATCH for cal.com event-types used by the workshop-update
 * procedure in `src/server/routers/workshop.ts`.
 *
 * Only the fields actually provided on the input are sent in the PATCH body —
 * cal.com merges the partial update so we do not clobber unrelated settings.
 * Any failure (network, 4xx, 5xx) surfaces as CalApiError; the caller decides
 * whether to surface a user-facing warning or silently swallow.
 */
export interface CalEventTypePatch {
  title?: string
  lengthInMinutes?: number
  /**
   * Push a new seats-per-timeslot cap to an already-provisioned event
   * type. Admins can raise `maxSeats` after creation; without this
   * propagation, cal.com's event type would still enforce the original
   * cap and `addAttendeeToBooking` for seat N+1 would 4xx.
   */
  seatsPerTimeSlot?: CalSeatsConfig['seatsPerTimeSlot']
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
  if (patch.seatsPerTimeSlot !== undefined) {
    // Seats config is an object on cal.com's side. The other two fields
    // repeat the defaults from createCalEventType so cal.com doesn't
    // reset them to server-side defaults on the PATCH merge.
    body.seats = {
      seatsPerTimeSlot: patch.seatsPerTimeSlot,
      showAttendeeInfo: false,
      showAvailabilityCount: true,
    }
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

  // Fail-fast if cal.com ships a uid that would break our composite booking_uid
  // scheme (`${rootUid}:${attendeeId}`) or confuse the webhook handler's LIKE
  // cascade. Shared UID_SAFE constant keeps this in lockstep with the webhook.
  // Throwing here (conservative 500) is strictly better than persisting a
  // poisoned root uid that corrupts every downstream cascade query.
  if (!UID_SAFE.test(uid)) {
    throw new CalApiError(
      500,
      `cal.com booking uid contains unsafe characters for our composite booking_uid scheme: ${JSON.stringify(uid)}`,
    )
  }

  // Cal.com's response shape for the meeting URL is inconsistent across API
  // versions. Try `meetingUrl` first (what newer Google-Meet bookings
  // return), fall back to `location` (older shape), else null.
  const meetingUrl =
    typeof body.data?.meetingUrl === 'string'
      ? body.data.meetingUrl
      : typeof body.data?.location === 'string'
        ? body.data.location
        : null

  return { uid, meetingUrl }
}

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
        'Authorization':    `Bearer ${apiKey}`,
        'Content-Type':     'application/json',
        'cal-api-version':  '2024-08-13',
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
