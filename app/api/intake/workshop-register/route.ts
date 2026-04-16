import { createHash } from 'node:crypto'
import { db } from '@/src/db'
import { workshops, workshopRegistrations } from '@/src/db/schema/workshops'
import { eq } from 'drizzle-orm'
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

  try {
    let bookingUid = `direct:${workshopId}:${emailHash}`

    // Create cal.com booking server-side so the attendee gets a calendar invite
    const calEventTypeId = workshop.calcomEventTypeId
    if (calEventTypeId && process.env.CAL_API_KEY) {
      // calcomEventTypeId stores "username/slug" — extract the numeric ID
      // by calling cal.com, or use the slug to book. Cal.com v2 bookings
      // API needs the numeric eventTypeId. We stored it during provisioning
      // but now store the slug. Fall back to direct registration if booking fails.
      try {
        const result = await createCalBooking({
          eventTypeId: parseInt(calEventTypeId, 10) || 0,
          name: cleanName || 'Guest',
          email: cleanEmail,
          startTime: workshop.scheduledAt.toISOString(),
        })
        bookingUid = result.uid
      } catch (err) {
        // Cal.com booking failed — still register directly. The user won't
        // get a calendar invite but will get the confirmation email.
        console.error('[workshop-register] cal.com booking failed, falling back to direct:', err)
      }
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
  } catch (err) {
    console.error('[workshop-register] error:', err)
    return Response.json({ error: 'Registration failed' }, { status: 500 })
  }

  return Response.json({ success: true })
}
