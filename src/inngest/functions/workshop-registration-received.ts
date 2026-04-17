import { NonRetriableError } from 'inngest'
import { eq } from 'drizzle-orm'
import { clerkClient } from '@clerk/nextjs/server'
import { isClerkAPIResponseError } from '@clerk/shared/error'
import { inngest } from '../client'
import { db } from '@/src/db'
import { workshops } from '@/src/db/schema/workshops'
import { sendWorkshopRegistrationEmail } from '@/src/lib/email'

/**
 * workshopRegistrationReceivedFn - async worker for cal.com workshop bookings.
 *
 * Triggered by `workshop.registration.received` events emitted by:
 *   - app/api/webhooks/cal/route.ts (Plan 20-03) on BOOKING_CREATED and
 *     MEETING_ENDED walk-in synthesis paths.
 *
 * Steps:
 *   1. Rate limit at run-start: 1 run per emailHash per 15 minutes (mirrors
 *      participateIntakeFn - absorbs cal.com webhook retry bursts without
 *      double-inviting the same email).
 *   2. `load-workshop` - resolve workshop.title + workshop.scheduledAt by
 *      event.data.workshopId. Missing row → NonRetriableError (the cal.com
 *      booking pointed at a workshop that no longer exists - unrecoverable).
 *   3. `create-clerk-invitation` - `clerkClient().invitations.createInvitation`
 *      with `ignoreExisting: true` and `publicMetadata: {role:'stakeholder',
 *      orgType: null}`. Workshop invitees have no declared orgType; Phase 24
 *      engagement scoring can backfill later.
 *   4. `send-registration-email` - sendWorkshopRegistrationEmail with the
 *      resolved workshop title + scheduledAt ISO.
 *
 * Error policy (mirrors participateIntakeFn):
 *   - Clerk 5xx → plain Error → Inngest retries (up to `retries: 3`).
 *   - Clerk 4xx → NonRetriableError → permanent failure.
 *   - Non-Clerk errors → NonRetriableError (unknown failure surface; safest
 *     default until observed in production).
 *
 * Pitfall 4 (Inngest v4): `triggers` MUST be inlined in createFunction
 * options. Extracting to a const collapses `event.data` to `any` inside the
 * handler. Do not refactor.
 *
 * Implements WS-10. D-11.
 */

export const workshopRegistrationReceivedFn = inngest.createFunction(
  {
    id: 'workshop-registration-received',
    name: 'Workshop registration received - Clerk invite + confirmation email',
    retries: 3,
    // D-11: absorb cal.com webhook retry bursts for the same registration.
    rateLimit: {
      key: 'event.data.emailHash',
      limit: 1,
      period: '15m',
    },
    // INLINE triggers - Pitfall 4.
    triggers: [{ event: 'workshop.registration.received' }],
  },
  async ({ event, step }) => {
    const { email, name, workshopId } = event.data as {
      workshopId: string
      email: string
      emailHash: string
      name: string
      bookingUid: string
      source: 'cal_booking' | 'walk_in'
    }

    // Step 1: load workshop row for the email's title + scheduledAt.
    // Note: step.run serializes the return value through JSON - Date round-trips
    // as ISO string on the far side, so we pre-serialize here to keep the
    // handler-level type honest.
    const workshop = await step.run('load-workshop', async () => {
      const [row] = await db
        .select({
          title: workshops.title,
          scheduledAt: workshops.scheduledAt,
        })
        .from(workshops)
        .where(eq(workshops.id, workshopId))
        .limit(1)
      if (!row) return null
      return {
        title: row.title,
        scheduledAt: row.scheduledAt.toLocaleString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'Asia/Kolkata',
          timeZoneName: 'short',
        }),
      }
    })

    if (!workshop) {
      throw new NonRetriableError(`workshop ${workshopId} not found`)
    }

    // Step 2: Clerk invitation (D-11 mirror of INTAKE-04 / INTAKE-06).
    await step.run('create-clerk-invitation', async () => {
      try {
        const client = await clerkClient()
        await client.invitations.createInvitation({
          emailAddress: email,
          ignoreExisting: true,
          publicMetadata: {
            role: 'stakeholder',
            orgType: null,
          },
        })
      } catch (err) {
        const status =
          isClerkAPIResponseError(err) &&
          typeof (err as { status?: number }).status === 'number'
            ? (err as { status: number }).status
            : undefined
        if (status !== undefined && status >= 500) {
          // Transient - bubble so Inngest consumes retry budget.
          throw err instanceof Error ? err : new Error(String(err))
        }
        throw new NonRetriableError(
          `Clerk invitation failed: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    })

    // Step 3: confirmation email. No try/catch - failures retry via Inngest.
    await step.run('send-registration-email', async () => {
      await sendWorkshopRegistrationEmail(email, {
        name,
        workshopTitle: workshop.title,
        scheduledAt: workshop.scheduledAt,
      })
    })

    return { email, workshopId, ok: true }
  },
)
