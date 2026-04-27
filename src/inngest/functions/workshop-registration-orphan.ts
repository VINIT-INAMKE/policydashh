import { NonRetriableError } from 'inngest'
import { eq } from 'drizzle-orm'
import { inngest } from '../client'
import { db } from '@/src/db'
import { workshops } from '@/src/db/schema/workshops'
import { sendWorkshopOrphanSeatAlert } from '@/src/lib/email'

/**
 * workshopRegistrationOrphanFn — admin alert for orphan cal.com seats.
 *
 * Triggered by `workshop.registration.orphan` events emitted from the
 * public registration intake (`/api/intake/workshop-register`) when
 * cal.com's `addAttendeeToBooking` succeeded but our follow-up DB write
 * (or post-Cal.com locked capacity recheck, or partial unique index)
 * failed. The attendee is seated on cal.com — we can't undo that without
 * an API call cal.com does not currently expose — so the right action is
 * to surface the orphan to a human who can:
 *
 *   1. Open cal.com's booking detail and remove the attendee, OR
 *   2. Insert a workshop_registrations row by hand to keep our books true
 *      and let the existing webhook flow take care of attendance.
 *
 * Pitfall 4 (Inngest v4): `triggers` MUST be inlined in createFunction
 * options. Do not refactor into a const.
 */

export const workshopRegistrationOrphanFn = inngest.createFunction(
  {
    id: 'workshop-registration-orphan',
    name: 'Workshop registration orphan - alert admin',
    retries: 3,
    triggers: [{ event: 'workshop.registration.orphan' }],
  },
  async ({ event, step }) => {
    const { workshopId, rootBookingUid, attendeeId, bookingId, email, reason } =
      event.data as {
        workshopId:     string
        rootBookingUid: string
        attendeeId:     number
        bookingId:      number
        email:          string
        reason:         'db_insert_failed' | 'capacity_recheck_failed' | 'unique_collision'
      }

    const workshop = await step.run('load-workshop', async () => {
      const [row] = await db
        .select({ title: workshops.title })
        .from(workshops)
        .where(eq(workshops.id, workshopId))
        .limit(1)
      return row ?? null
    })

    if (!workshop) {
      // Cal.com seat exists for a workshop our DB no longer knows about.
      // Without the title we can't render a useful alert; bail loudly so
      // operators see the gap in the Inngest dashboard.
      throw new NonRetriableError(
        `orphan event for unknown workshop ${workshopId} — cal.com root uid ${rootBookingUid}, attendee ${attendeeId}`,
      )
    }

    await step.run('send-orphan-alert', async () => {
      await sendWorkshopOrphanSeatAlert({
        workshopId,
        workshopTitle: workshop.title,
        rootBookingUid,
        attendeeId,
        bookingId,
        email,
        reason,
      })
    })

    return { workshopId, attendeeId, alertSent: true as const }
  },
)
