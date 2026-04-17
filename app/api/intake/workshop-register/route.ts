import { createHash } from 'node:crypto'
import { db } from '@/src/db'
import { workshops, workshopRegistrations } from '@/src/db/schema/workshops'
import { and, eq } from 'drizzle-orm'
import { sendWorkshopRegistrationReceived } from '@/src/inngest/events'
import { createCalBooking, CalApiError } from '@/src/lib/calcom'

function emailHashOf(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex')
}

export async function POST(req: Request): Promise<Response> {
  let body: { workshopId?: string; name?: string; email?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { workshopId, name, email } = body
  if (!workshopId || !email) {
    return Response.json({ error: 'workshopId and email are required' }, { status: 400 })
  }

  const [workshop] = await db
    .select({
      id: workshops.id,
      scheduledAt: workshops.scheduledAt,
      maxSeats: workshops.maxSeats,
      calcomEventTypeId: workshops.calcomEventTypeId,
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

  // Check if already registered for this workshop
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

  if (existing && existing.status === 'registered') {
    return Response.json(
      { error: 'You are already registered for this workshop.' },
      { status: 409 },
    )
  }

  try {
    let bookingUid = `direct:${workshopId}:${emailHash}`

    // Cal.com booking is best-effort. Only attempt it when the stored
    // calcomEventTypeId is a pure numeric string — older workshops (created
    // before commit 569d3e5) stored a slug, which parseInt turns into NaN → 0
    // and cal.com rejects with a confusing class-validator error.
    const calEventTypeId = workshop.calcomEventTypeId
    const numericEventTypeId =
      calEventTypeId && /^\d+$/.test(calEventTypeId) ? parseInt(calEventTypeId, 10) : null

    if (numericEventTypeId !== null && process.env.CAL_API_KEY) {
      try {
        const result = await createCalBooking({
          eventTypeId: numericEventTypeId,
          name: cleanName || 'Guest',
          email: cleanEmail,
          startTime: workshop.scheduledAt.toISOString(),
          timeZone: 'Asia/Kolkata',
        })
        bookingUid = result.uid
      } catch (err) {
        console.error('[workshop-register] cal.com booking failed, falling back to direct:', err)
      }
    } else if (calEventTypeId) {
      console.warn('[workshop-register] skipping cal.com — non-numeric eventTypeId stored:', calEventTypeId)
    }

    await db
      .insert(workshopRegistrations)
      .values({
        workshopId,
        bookingUid,
        email: cleanEmail,
        emailHash,
        name: cleanName || null,
        bookingStartTime: workshop.scheduledAt,
        status: 'registered',
      })
      .onConflictDoNothing()

    await sendWorkshopRegistrationReceived({
      workshopId,
      email: cleanEmail,
      emailHash,
      name: cleanName,
      bookingUid,
      source: 'direct_register',
    })
    console.log('[workshop-register] sent inngest event workshop.registration.received', { workshopId, emailHash: emailHash.slice(0, 8) })
  } catch (err) {
    console.error('[workshop-register] error:', err)
    return Response.json({ error: 'Registration failed' }, { status: 500 })
  }

  return Response.json({ success: true })
}
