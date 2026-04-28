import { NonRetriableError } from 'inngest'
import { clerkClient } from '@clerk/nextjs/server'
import { isClerkAPIResponseError } from '@clerk/shared/error'
import { eq } from 'drizzle-orm'
import { inngest } from '../client'
import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'

/**
 * workshopRegistrationReceivedFn - Clerk invitation for workshop registrants.
 *
 * Triggered by `workshop.registration.received` events emitted by
 * `app/api/intake/workshop-register/route.ts` (post-pivot 2026-04-28). Walk-in
 * additions via `workshop.addWalkIn` do NOT fire this event — admins enter
 * walk-ins after-the-fact and don't need a platform invite chain.
 *
 * Existing-user guard: if the registrant already has a row in our `users`
 * table (either created via Clerk webhook or seeded manually), skip the
 * Clerk invite entirely. They already have platform access. Without this
 * guard, every workshop registration spams returning users with a "join
 * PolicyDash" invitation email, which is exactly the duplication this fn
 * was meant to avoid.
 *
 * Only sends the Clerk invitation when the email is genuinely new to the
 * platform. The Google Calendar invite covers booking confirmation — we
 * deliberately do NOT send a separate Resend confirmation email.
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
    // F28: label no longer mentions the dropped confirmation email - this
    // function now only sends the Clerk invitation; the cal.com calendar
    // invite is the sole booking-confirmation channel.
    name: 'Workshop registration received - send Clerk invite',
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
      source: 'walk_in' | 'direct_register'
    }

    const emailNorm = email.toLowerCase().trim()

    // Skip the invite if this email is already a platform user. Without this
    // guard, returning users get a "join PolicyDash" invitation every time
    // they register for a workshop.
    const userAlreadyOnPlatform = await step.run('check-platform-user', async () => {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, emailNorm))
        .limit(1)
      return !!existing
    })

    if (userAlreadyOnPlatform) {
      return { email, workshopId, ok: true, skipped: 'already-on-platform' as const }
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
