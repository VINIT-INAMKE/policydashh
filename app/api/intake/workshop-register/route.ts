import { createHash } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { db } from '@/src/db'
import { workshops, workshopRegistrations } from '@/src/db/schema/workshops'
import { and, desc, eq, ne, count } from 'drizzle-orm'
import {
  sendWorkshopRegistrationReceived,
  sendWorkshopRegistrationOrphan,
} from '@/src/inngest/events'
import {
  addAttendeeToBooking,
  buildCompositeBookingUid,
  CalApiError,
} from '@/src/lib/calcom'
import { sendWorkshopOrphanSeatAlert } from '@/src/lib/email'
import { consume, getClientIp } from '@/src/lib/rate-limit'
import { verifyTurnstile } from '@/src/lib/turnstile'

// Tag must match `src/server/queries/workshops-public.ts` and the cal.com
// webhook handler — keep all three in lockstep.
function spotsTag(workshopId: string): string {
  return `workshop-spots-${workshopId}`
}

// C2: parse cal.com 429 Retry-After (seconds OR HTTP-date) so we don't
// hardcode 5s when cal.com tells us how long to back off.
function parseRetryAfter(err: CalApiError, fallbackSeconds: number): string {
  const m = /Retry-After:\s*([^\r\n]+)/i.exec(err.message)
  if (!m) return String(fallbackSeconds)
  const raw = m[1].trim()
  // Numeric form: integer seconds.
  if (/^\d+$/.test(raw)) return raw
  // HTTP-date form: difference from now in seconds, clamped to >= 1.
  const epoch = Date.parse(raw)
  if (!Number.isNaN(epoch)) {
    return String(Math.max(1, Math.ceil((epoch - Date.now()) / 1000)))
  }
  return String(fallbackSeconds)
}

// B10: body-size cap on public intake. Anything beyond this is a fat-finger
// or an abuser; short-circuit with 413 before JSON parse.
const MAX_BODY_BYTES = 16 * 1024 // 16KB - three short text fields

// F2: real email validation. z.string().email() rejects obvious garbage.
// F11/B10: bounded lengths so a malformed body cannot wedge the db write.
const bodySchema = z.object({
  workshopId: z.string().min(1),
  name: z.string().max(200).optional(),
  email: z.string().email().max(320), // RFC 5321 practical max
  // Cloudflare Turnstile token (D-1): matches `/api/intake/participate`'s
  // gate. Required on every submission; verifyTurnstile() answers
  // success:false for an absent / spent / forged token.
  turnstileToken: z.string().min(1),
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

  const { workshopId, name, email, turnstileToken } = parsed.data

  // D-1: Cloudflare Turnstile gate. Matches the `/api/intake/participate`
  // pattern — verifyTurnstile() hits Cloudflare /siteverify. A missing /
  // spent / forged token closes the gate with 403 BEFORE any DB read or
  // cal.com call so bots cannot enumerate workshops or exhaust quota.
  const turnstileOk = await verifyTurnstile(turnstileToken, req)
  if (!turnstileOk.success) {
    return Response.json({ error: 'Security check failed' }, { status: 403 })
  }

  const [workshop] = await db
    .select({
      id: workshops.id,
      scheduledAt: workshops.scheduledAt,
      maxSeats: workshops.maxSeats,
      calcomEventTypeId: workshops.calcomEventTypeId,
      calcomBookingUid: workshops.calcomBookingUid,
      timezone: workshops.timezone,
      status: workshops.status,
      createdAt: workshops.createdAt,
    })
    .from(workshops)
    .where(eq(workshops.id, workshopId))
    .limit(1)

  if (!workshop) {
    return Response.json({ error: 'Workshop not found' }, { status: 404 })
  }

  // H3: refuse registration on workshops that are no longer accepting it.
  // `completed`/`archived` would otherwise accept seats while the cal.com
  // event-type is still live — confusing the registrant and creating
  // attendance noise on a workshop that's already past its lifecycle.
  if (workshop.status === 'completed' || workshop.status === 'archived') {
    return Response.json(
      { error: 'This workshop is no longer accepting registrations.' },
      { status: 410 },
    )
  }

  // H2: refuse registration on past-dated workshops. Cal.com itself MAY
  // accept the seat-add (semantics for seated bookings on past slots are
  // not documented), so we hard-block at our layer to avoid emailing a
  // confirmation for an event that already happened.
  if (workshop.scheduledAt.getTime() < Date.now()) {
    return Response.json(
      { error: 'This workshop has already started or finished.' },
      { status: 410 },
    )
  }

  const cleanEmail = email.toLowerCase().trim()
  // `cleanName` is the trimmed caller-supplied value, possibly empty. We
  // deliberately fan out two different empty-name substitutions downstream
  // because the contracts differ: cal.com rejects an empty `name`, while
  // `workshop_registrations.name` is nullable and a NULL is the truthful
  // "no name given" signal (used by the manage Attendees tab to render
  // "anonymous"). Don't try to unify — pick per consumer.
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
  //
  // B3-3: order by createdAt DESC so a re-registration after a prior
  // cancellation sees the MOST RECENT row (status='cancelled') rather than
  // an arbitrary older 'registered' row that was later cancelled. Without
  // this ORDER BY the implementation-defined row ordering was picking up
  // stale rows and blocking legitimate re-registrations.
  const [existing] = await db
    .select({ id: workshopRegistrations.id, status: workshopRegistrations.status })
    .from(workshopRegistrations)
    .where(
      and(
        eq(workshopRegistrations.workshopId, workshopId),
        eq(workshopRegistrations.emailHash, emailHash),
      ),
    )
    .orderBy(desc(workshopRegistrations.createdAt))
    .limit(1)

  if (existing && existing.status !== 'cancelled') {
    return Response.json(
      { error: 'You are already registered for this workshop.' },
      { status: 409 },
    )
  }

  // F1: max-seats courtesy pre-flight. The authoritative gate is the
  // post-Cal.com transaction below (advisory_xact_lock + recount + insert).
  // We still check here so we can fail fast without burning a cal.com call
  // on workshops we already know are full. The race window between this
  // pre-check and the locked recheck is covered by the orphan-event flow.
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
    // root booking. Client retries after a short delay.
    //
    // B3-5: Retry-After scales with workshop age so stakeholders aren't
    // stuck polling a stuck provisioning job:
    //   - <60s old  → 5s  (matches the p50 of the two-step Inngest fn).
    //   - <300s old → 15s (Inngest likely in retry-backoff territory).
    //   - otherwise → 60s (provisioning is degraded — admin intervention
    //                      expected; hint a longer back-off so we don't
    //                      amplify the failure with retries).
    // Plus a WARN log whenever the 503 fires on a workshop >60s old so
    // the observability dashboard catches stuck workshops.
    const ageMs = Date.now() - new Date(workshop.createdAt).getTime()
    const retryAfter = ageMs < 60_000 ? 5 : ageMs < 300_000 ? 15 : 60
    if (ageMs > 60_000) {
      console.warn(
        '[workshop-register] 503 on workshop unprovisioned >60s — cal.com provisioning may be stuck',
        { workshopId, ageSeconds: Math.round(ageMs / 1000), retryAfter },
      )
    }
    return Response.json(
      { error: 'Workshop is still being set up. Please try again in a moment.' },
      { status: 503, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  // Partial-failure ordering (revised 2026-04-23): cal.com is the outermost
  // side effect because we cannot un-seat an attendee without an extra
  // API call. Two distinct failure modes follow:
  //
  //   (a) cal.com add-attendee failed → no seat created → no DB row → safe
  //       for the client to retry without creating a duplicate.
  //   (b) cal.com succeeded but the DB insert or Inngest send that runs
  //       afterwards failed → attendee IS seated on cal.com (and has the
  //       Meet link in their inbox) but we have no local row. We log the
  //       orphaned seat at ERROR level with enough identifiers
  //       (rootBookingUid, attendeeId, email, bookingId) for out-of-band
  //       reconciliation, and still return 500 so the client doesn't
  //       retry (which would create a second seat on cal.com).
  let attendee: { id: number; bookingId: number } | null = null
  try {
    attendee = await addAttendeeToBooking(workshop.calcomBookingUid, {
      name:     cleanName || 'Guest',
      email:    cleanEmail,
      timeZone: workshop.timezone,
    })
  } catch (err) {
    // (a) Cal.com attendee-add failed. No seat was created, no DB row
    // written, user gets a status-appropriate response and can safely retry.
    //
    // B3-4 / B3-6: surface cal.com's shape back to the client:
    //   - 429 → passthrough 429 with Retry-After so the form can back off.
    //   - 4xx with capacity-ish body → 409 "fully booked" (cal.com's
    //     seatsPerTimeSlot gate tripped between our courtesy check and the
    //     attendee-add).
    //   - everything else → 500 (transient server error).
    console.error('[workshop-register] addAttendeeToBooking failed', {
      workshopId,
      emailHash,
      err: err instanceof Error ? err.message : String(err),
    })
    if (err instanceof CalApiError) {
      if (err.status === 429) {
        // L2: respect cal.com's actual Retry-After when present, fall
        // back to 5s. Hardcoded 5s ignored cal.com's real cooldown signal.
        return Response.json(
          { error: 'Too many requests. Try again in a moment.' },
          { status: 429, headers: { 'Retry-After': parseRetryAfter(err, 5) } },
        )
      }
      if (err.status >= 400 && err.status < 500 && /seat|full|capacity/i.test(err.message)) {
        return Response.json(
          { error: 'This workshop is fully booked.' },
          { status: 409 },
        )
      }
    }
    return Response.json({ error: 'Registration failed' }, { status: 500 })
  }

  const compositeBookingUid = buildCompositeBookingUid(
    workshop.calcomBookingUid,
    attendee.id,
  )

  // C2 (audit 2026-04-27, revised after wide-review found `db.transaction`
  // throws unconditionally on neon-http — `node_modules/drizzle-orm/neon-http/
  // session.js:151-158`). The atomic gate has to be sequential statements,
  // not a real Postgres transaction. The race-window guarantees we keep:
  //
  //   1. The partial unique index `(workshop_id, email_hash) WHERE status
  //      != 'cancelled'` (migration 0030) eliminates the same-email
  //      double-click race entirely — the second INSERT 23505s.
  //   2. The post-Cal.com recount catches the "different-email last-seat"
  //      race for `maxSeats !== null` workshops. Two concurrent registrants
  //      can both pass the recount under READ COMMITTED, but the window is
  //      now narrowed to a single SELECT-then-INSERT (~milliseconds) instead
  //      of the prior pre-flight-then-Cal.com-then-insert (~seconds). Any
  //      residual oversell-by-one is mopped up by cal.com's own
  //      `seatsPerTimeSlot` enforcement at addAttendeeToBooking time
  //      (which has already happened by the time we reach this block — so
  //      if cal.com seated the attendee, capacity was free at that moment).
  //
  // Three failure modes route to the orphan handler — cal.com seated the
  // attendee but our row never landed:
  //   - capacity recheck fails (workshop filled between pre-flight + here)
  //   - partial unique on (workshop_id, email_hash) fires 23505
  //   - INSERT throws any other error (DB outage)
  // In all three the cal.com seat is real; an admin alert email goes out
  // via `workshopRegistrationOrphanFn` so a human can manually clean up.
  type OrphanReason = 'db_insert_failed' | 'capacity_recheck_failed' | 'unique_collision'
  let inserted = false
  let orphanReason: OrphanReason | null = null

  try {
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
        orphanReason = 'capacity_recheck_failed'
        throw new Error('CAPACITY_RECHECK_FAILED')
      }
    }

    // INSERT. The partial unique index `(workshop_id, email_hash) WHERE
    // status != 'cancelled'` (migration 0030) raises 23505 on double-click,
    // which neon-http surfaces as a thrown error caught below. The
    // bookingUid unique index handles webhook replays via onConflictDoNothing.
    const result = await db
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
      .onConflictDoNothing({ target: workshopRegistrations.bookingUid })
      .returning({ id: workshopRegistrations.id })

    if (result.length === 0) {
      // bookingUid already existed (replay) — uncommon but safe to treat
      // as a collision. cal.com seat is still real, fire the orphan alert.
      orphanReason = 'unique_collision'
      throw new Error('UNIQUE_COLLISION')
    }
    inserted = true
  } catch (err) {
    // Distinguish:
    //   - the synthetic throws above (capacity_recheck_failed / unique_collision)
    //   - Postgres 23505 from the partial unique index on (workshop_id, email_hash)
    //   - any other DB error
    const errMsg = err instanceof Error ? err.message : String(err)
    let finalReason: OrphanReason
    if (orphanReason !== null) {
      finalReason = orphanReason
    } else if (/23505|duplicate key|unique_email_per_workshop/i.test(errMsg)) {
      finalReason = 'unique_collision'
    } else {
      finalReason = 'db_insert_failed'
    }
    console.error('[workshop-register] ORPHAN: post-Cal.com DB step failed', {
      workshopId,
      rootBookingUid: workshop.calcomBookingUid,
      attendeeId:     attendee.id,
      bookingId:      attendee.bookingId,
      email:          cleanEmail,
      pii:            true,
      reason:         finalReason,
      err:            err instanceof Error ? err.message : String(err),
    })
    // Fire the admin-alert event. M-1 (audit 2026-04-27 wide review): if
    // Inngest is also down, fall back to a direct Resend call so the
    // operator still gets the alert. The orphan log above remains the
    // last-resort observability surface.
    try {
      await sendWorkshopRegistrationOrphan({
        workshopId,
        rootBookingUid: workshop.calcomBookingUid,
        attendeeId:     attendee.id,
        bookingId:      attendee.bookingId,
        email:          cleanEmail,
        reason:         finalReason,
      })
    } catch (orphanErr) {
      console.error(
        '[workshop-register] Inngest orphan-alert send failed — falling back to direct email',
        { workshopId, err: orphanErr instanceof Error ? orphanErr.message : String(orphanErr) },
      )
      try {
        await sendWorkshopOrphanSeatAlert({
          workshopId,
          workshopTitle: 'unknown (Inngest down — fallback path)',
          rootBookingUid: workshop.calcomBookingUid,
          attendeeId:     attendee.id,
          bookingId:      attendee.bookingId,
          email:          cleanEmail,
          reason:         finalReason,
        })
      } catch (mailErr) {
        console.error(
          '[workshop-register] Direct orphan-alert email also failed (orphan still logged)',
          { workshopId, err: mailErr instanceof Error ? mailErr.message : String(mailErr) },
        )
      }
    }
    // Map the user-facing response based on reason.
    if (finalReason === 'capacity_recheck_failed') {
      return Response.json(
        { error: 'This workshop just filled up. Please try a different session.' },
        { status: 409 },
      )
    }
    if (finalReason === 'unique_collision') {
      // Same-email double-click. The first request wins; this one races.
      // 409 lets the form recover — the user is effectively registered
      // (their first request seated them on cal.com).
      return Response.json(
        { error: 'You are already registered for this workshop.' },
        { status: 409 },
      )
    }
    return Response.json({ error: 'Registration failed' }, { status: 500 })
  }

  if (!inserted) {
    // Defensive: should be unreachable since the inner throw bubbles to
    // the catch above, but if neon-http ever returns silently we don't
    // want to claim success.
    return Response.json({ error: 'Registration failed' }, { status: 500 })
  }

  // C1: bust the public spots-left cache so the badge reflects the new
  // seat within the next request, not 60s later. Crucial for back-to-back
  // registrants who would otherwise all see "X spots left" until the cache
  // TTL expires.
  revalidateTag(spotsTag(workshopId), 'max')

  try {
    await sendWorkshopRegistrationReceived({
      workshopId,
      email:      cleanEmail,
      emailHash,
      name:       cleanName,
      bookingUid: compositeBookingUid,
      source:     'direct_register',
    })
  } catch (err) {
    // Registration row is persisted; Clerk invite enqueueing is best-effort.
    // Log the gap so the invite-dispatcher backfill job can pick it up.
    // Do NOT return 500 here — the user is already registered; the invite
    // will eventually fire when Inngest recovers. B3-8: log emailHash,
    // not the raw email — the invite-dispatcher keys on emailHash anyway.
    console.error('[workshop-register] Inngest send failed, Clerk invite deferred', {
      workshopId,
      bookingUid: compositeBookingUid,
      emailHash,
      err:        err instanceof Error ? err.message : String(err),
    })
  }

  console.log('[workshop-register] attendee added to root booking', {
    workshopId,
    rootBookingUid: workshop.calcomBookingUid,
    attendeeId:     attendee.id,
    bookingId:      attendee.bookingId,
  })

  return Response.json({ success: true })
}
