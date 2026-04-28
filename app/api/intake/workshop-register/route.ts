import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import crypto from 'node:crypto'
import { and, desc, eq, ne, sql } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/src/db'
import { workshops, workshopRegistrations } from '@/src/db/schema/workshops'
import { users } from '@/src/db/schema/users'
import { addAttendeeToEvent, GoogleCalendarError } from '@/src/lib/google-calendar'
import { sendWorkshopRegistrationReceived } from '@/src/inngest/events'
import { sha256Hex } from '@/src/lib/hashing'
import { consume, getClientIp } from '@/src/lib/rate-limit'
import { verifyTurnstile } from '@/src/lib/turnstile'

// Tag must match `src/server/queries/workshops-public.ts` — keep in lockstep.
function spotsTag(workshopId: string): string {
  return `workshop-spots-${workshopId}`
}

// Tag must match `workshopDetailTag` in `src/server/queries/workshops-public.ts`.
function workshopDetailTag(workshopId: string): string {
  return `workshop:${workshopId}`
}

// B10: body-size cap on public intake. Anything beyond this is a fat-finger
// or an abuser; short-circuit with 413 before JSON parse.
const MAX_BODY_BYTES = 16 * 1024 // 16 KB

// F2: real email validation. F11/B10: bounded lengths so a malformed body
// cannot wedge the DB write.
const bodySchema = z.object({
  workshopId: z.string().uuid(),
  name: z.string().max(120).optional(),
  email: z.string().email().max(254),
  // Cloudflare Turnstile token — verifyTurnstile() answers success:false for
  // an absent / spent / forged token.
  turnstileToken: z.string().min(1),
})

export async function POST(req: Request): Promise<Response> {
  // B10: body-size guard. Reject big payloads before JSON parse.
  const contentLength = req.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return Response.json({ error: 'Payload too large' }, { status: 413 })
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
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { workshopId, name, email, turnstileToken } = parsed.data

  // F3/B11: per-IP rate limit (20 req / 5 min).
  const ip = getClientIp(req)
  const ipLimit = consume(`workshop-register:ip:${ip}`, { max: 20, windowMs: 5 * 60_000 })
  if (!ipLimit.ok) {
    const retryAfter = Math.max(1, Math.ceil((ipLimit.resetAt - Date.now()) / 1000))
    return Response.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  // D-1: Cloudflare Turnstile gate.
  const turnstileOk = await verifyTurnstile(turnstileToken, req)
  if (!turnstileOk.success) {
    return Response.json({ error: 'Security check failed' }, { status: 403 })
  }

  const cleanEmail = email.toLowerCase().trim()
  const cleanName = name?.trim() || ''
  const emailHash = sha256Hex(cleanEmail)

  // F3/B11: per-email rate limit (5 req / 10 min) — key shared across IPs.
  const emailLimit = consume(`workshop-register:email:${emailHash}`, {
    max: 5,
    windowMs: 10 * 60_000,
  })
  if (!emailLimit.ok) {
    const retryAfter = Math.max(1, Math.ceil((emailLimit.resetAt - Date.now()) / 1000))
    return Response.json(
      { error: 'Too many attempts for this email. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  // Load workshop
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

  if (!workshop) {
    return Response.json({ error: 'Workshop not found' }, { status: 404 })
  }

  // H3: refuse registration on workshops no longer accepting it.
  if (workshop.status === 'completed' || workshop.status === 'archived') {
    return Response.json(
      { error: 'This workshop is no longer accepting registrations.' },
      { status: 410 },
    )
  }

  // H2: refuse registration on past-dated workshops.
  if (workshop.scheduledAt.getTime() < Date.now()) {
    return Response.json(
      { error: 'This workshop has already started or finished.' },
      { status: 410 },
    )
  }

  // F4: already-registered check (most recent row by createdAt DESC).
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

  // C5: look up internal userId for logged-in stakeholders so isViewerRegistered
  // can match on userId (not just emailHash) and the meeting URL is shown after
  // registration. Anonymous callers get userId=null — that's fine.
  let viewerInternalUserId: string | null = null
  const { userId: clerkUserId } = await auth()
  if (clerkUserId) {
    const [u] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1)
    viewerInternalUserId = u?.id ?? null
  }

  // C1: atomic capacity-gated INSERT. The SELECT subquery counts non-cancelled
  // rows; the entire row materializes only when count < maxSeats (or maxSeats
  // is null, meaning open registration). This replaces the racy count+INSERT
  // two-step — concurrent requests can no longer both see "1 spot left" and
  // both succeed. The existing partial unique index handles double-click defense.
  const bookingUid = `reg_${crypto.randomUUID()}`
  let registrationId: string
  try {
    const inserted = await db.execute(sql`
      INSERT INTO workshop_registrations
        (workshop_id, booking_uid, email, email_hash, name, user_id, status, booking_start_time, invite_sent_at)
      SELECT
        ${workshopId}::uuid,
        ${bookingUid},
        ${cleanEmail},
        ${emailHash},
        ${cleanName || null},
        ${viewerInternalUserId}::uuid,
        'registered',
        ${workshop.scheduledAt.toISOString()}::timestamptz,
        NULL
      WHERE
        ${workshop.maxSeats === null ? sql`TRUE` : sql`(
          SELECT COUNT(*)::int FROM workshop_registrations
          WHERE workshop_id = ${workshopId}::uuid AND status != 'cancelled'
        ) < ${workshop.maxSeats}`}
      RETURNING id
    `)
    // neon-http driver returns rows on `inserted.rows`; guard both shapes.
    // Cast through unknown first so TS doesn't complain about the NeonHttpQueryResult
    // type not overlapping with our narrower expected shapes.
    const insertedAny = inserted as unknown
    const rows =
      (insertedAny as { rows?: Array<{ id: string }> }).rows ??
      (insertedAny as Array<{ id: string }>)
    if (!Array.isArray(rows) || rows.length === 0) {
      return Response.json({ error: 'This workshop is fully booked.' }, { status: 409 })
    }
    registrationId = rows[0].id
  } catch (err: unknown) {
    const errAny = err as { code?: string; message?: string }
    if (errAny?.code === '23505' || /duplicate key/i.test(String(errAny?.message))) {
      return Response.json(
        { error: 'You are already registered for this workshop.' },
        { status: 409 },
      )
    }
    console.error('[workshop-register] DB INSERT failed', { workshopId, emailHash, err: String(err) })
    return Response.json({ error: 'Registration failed' }, { status: 500 })
  }

  // Google addAttendeeToEvent — inviteSentAt stays NULL on failure;
  // admin Resend in the Attendees tab recovers the invite.
  let inviteStatus: 'sent' | 'pending_resend' = 'pending_resend'
  try {
    await addAttendeeToEvent({
      eventId: workshop.googleCalendarEventId,
      attendeeEmail: cleanEmail,
      attendeeName: cleanName || 'Guest',
    })
    await db
      .update(workshopRegistrations)
      .set({ inviteSentAt: new Date(), updatedAt: new Date() })
      .where(eq(workshopRegistrations.id, registrationId))
    inviteStatus = 'sent'
  } catch (err) {
    console.warn('[workshop-register] Google addAttendee failed; admin can Resend', {
      registrationId,
      eventId: workshop.googleCalendarEventId,
      err: err instanceof GoogleCalendarError
        ? `${err.status}: ${err.message}`
        : String(err),
    })
  }

  // C1: bust the public spots-left cache and the detail page cache.
  revalidateTag(spotsTag(workshopId), 'max')
  revalidateTag(workshopDetailTag(workshopId), 'max')

  try {
    await sendWorkshopRegistrationReceived({
      workshopId,
      email: cleanEmail,
      emailHash,
      name: cleanName,
      bookingUid,
      source: 'direct_register',
    })
  } catch (err) {
    // Registration row is persisted; Clerk invite enqueuing is best-effort.
    console.error('[workshop-register] Inngest send failed, Clerk invite deferred', {
      workshopId,
      bookingUid,
      emailHash,
      err: err instanceof Error ? err.message : String(err),
    })
  }

  return Response.json({ success: true, inviteStatus }, { status: 200 })
}
