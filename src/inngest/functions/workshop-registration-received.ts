import { NonRetriableError } from 'inngest'
import { clerkClient } from '@clerk/nextjs/server'
import { isClerkAPIResponseError } from '@clerk/shared/error'
import { inngest } from '../client'

/**
 * workshopRegistrationReceivedFn - Clerk invitation for workshop registrants.
 *
 * Triggered by `workshop.registration.received` events emitted by:
 *   - app/api/webhooks/cal/route.ts (Plan 20-03) on BOOKING_CREATED and
 *     MEETING_ENDED walk-in synthesis paths.
 *   - app/api/intake/workshop-register/route.ts for direct registrations.
 *
 * Only sends the Clerk invitation. The cal.com calendar invite covers the
 * booking confirmation - we deliberately do NOT send a separate Resend
 * confirmation email to avoid the multi-email confusion the user reported.
 *
 * Error policy:
 *   - Clerk 5xx → plain Error → Inngest retries (up to `retries: 3`).
 *   - Clerk 4xx → NonRetriableError → permanent failure.
 *   - Non-Clerk errors → NonRetriableError.
 *
 * Pitfall 4 (Inngest v4): `triggers` MUST be inlined in createFunction
 * options. Extracting to a const collapses `event.data` to `any` inside the
 * handler. Do not refactor.
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
    const { email, workshopId } = event.data as {
      workshopId: string
      email: string
      emailHash: string
      name: string
      bookingUid: string
      source: 'cal_booking' | 'walk_in' | 'direct_register'
    }

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
          throw err instanceof Error ? err : new Error(String(err))
        }
        throw new NonRetriableError(
          `Clerk invitation failed: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    })

    return { email, workshopId, ok: true }
  },
)
