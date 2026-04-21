import { createHash } from 'node:crypto'
import { z } from 'zod'
import { db } from '@/src/db'
import { workshops, workshopRegistrations } from '@/src/db/schema/workshops'
import { and, eq, ne, count } from 'drizzle-orm'
import { sendWorkshopRegistrationReceived } from '@/src/inngest/events'
import { addAttendeeToBooking } from '@/src/lib/calcom'
import { consume, getClientIp } from '@/src/lib/rate-limit'

// B10: body-size cap on public intake. Anything beyond this is a fat-finger
// or an abuser; short-circuit with 413 before JSON parse.
const MAX_BODY_BYTES = 16 * 1024 // 16KB - three short text fields

// F2: real email validation. z.string().email() rejects obvious garbage.
// F11/B10: bounded lengths so a malformed body cannot wedge the db write.
const bodySchema = z.object({
  workshopId: z.string().min(1),
  name: z.string().max(200).optional(),
  email: z.string().email().max(320), // RFC 5321 practical max
})

function emailHashOf(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex')
}

export async function POST(req: Request): Promise<Response> {
  // B10: body-size guard. Reject big payloads before JSON parse.
  const contentLength = req.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return Response.json({ error: 'Payload too large' }, { status: 413 })
  }

  // F3/B11: per-IP rate limit (20 req / 5 min). Defuses burst registration
  // abuse at the transport layer before any DB read. Per-email check runs
  // after body validation so we have the email to key on.
  const ip = getClientIp(req)
  const ipLimit = consume(`workshop-register:ip:${ip}`, { max: 20, windowMs: 5 * 60_000 })
  if (!ipLimit.ok) {
    // P4: surface Retry-After so clients back off precisely until the
    // current window resets instead of hammering immediately.
    const retryAfter = Math.max(1, Math.ceil((ipLimit.resetAt - Date.now()) / 1000))
    return Response.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const { workshopId, name, email } = parsed.data

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

  if (!workshop) {
    return Response.json({ error: 'Workshop not found' }, { status: 404 })
  }

  const cleanEmail = email.toLowerCase().trim()
  const cleanName = name?.trim() || ''
  const emailHash = emailHashOf(cleanEmail)

  // F3/B11: per-email rate limit (5 req / 10 min) - key shared across IPs so
  // an attacker can't rotate IPs to spam the same inbox.
  const emailLimit = consume(`workshop-register:email:${emailHash}`, {
    max: 5,
    windowMs: 10 * 60_000,
  })
  if (!emailLimit.ok) {
    // P4: Retry-After from the consumed window's resetAt.
    const retryAfter = Math.max(1, Math.ceil((emailLimit.resetAt - Date.now()) / 1000))
    return Response.json(
      { error: 'Too many attempts for this email. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  // F4: already-registered check must treat ANY non-cancelled status as
  // booked (includes 'registered' AND 'rescheduled'). Previous logic only
  // rejected 'registered' so a rescheduled attendee could double-book.
  const [existing] = await db
    .select({ id: workshopRegistrations.id, status: workshopRegistrations.status })
    .from(workshopRegistrations)
    .where(
      and(
        eq(workshopRegistrations.workshopId, workshopId),
        eq(workshopRegistrations.emailHash, emailHash),
      ),
    )
    .limit(1)

  if (existing && existing.status !== 'cancelled') {
    return Response.json(
      { error: 'You are already registered for this workshop.' },
      { status: 409 },
    )
  }

  // F1: max-seats enforcement. Count non-cancelled registrations and reject
  // if the cap is hit. Race is acceptable (two requests arriving together
  // could both pass, and we'd over-book by 1) because cal.com also enforces
  // seatsPerTimeSlot at the booking layer. This is a courtesy gate.
  if (workshop.maxSeats !== null) {
    const [countRow] = await db
      .select({ n: count() })
      .from(workshopRegistrations)
      .where(
        and(
          eq(workshopRegistrations.workshopId, workshopId),
          ne(workshopRegistrations.status, 'cancelled'),
        ),
      )
    const registered = Number(countRow?.n ?? 0)
    if (registered >= workshop.maxSeats) {
      return Response.json(
        { error: 'This workshop is fully booked.' },
        { status: 409 },
      )
    }
  }

  if (!workshop.calcomBookingUid) {
    // Workshop row exists but workshopCreatedFn has not yet backfilled the
    // root booking. Client retries after a short delay — Retry-After hints
    // 5s which covers the p50 of the two-step Inngest provisioning function.
    return Response.json(
      { error: 'Workshop is still being set up. Please try again in a moment.' },
      { status: 503, headers: { 'Retry-After': '5' } },
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
}
