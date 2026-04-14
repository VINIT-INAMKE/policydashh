import { NonRetriableError } from 'inngest'
import { eq } from 'drizzle-orm'
import { inngest } from '../client'
import { db } from '@/src/db'
import { workshops } from '@/src/db/schema/workshops'
import { signFeedbackToken } from '@/src/lib/feedback-token'
import { sendWorkshopFeedbackInviteEmail } from '@/src/lib/email'

/**
 * workshopFeedbackInviteFn — post-workshop feedback deep-link email.
 *
 * Triggered by `workshop.feedback.invite` events emitted by the cal.com
 * webhook handler (Plan 20-03) on MEETING_ENDED — one event per attendee.
 *
 * Steps:
 *   1. `load-workshop` — resolve workshop.title + scheduledAt. Missing row
 *      → NonRetriableError (the cal.com meeting pointed at a workshop that
 *      no longer exists — unrecoverable).
 *   2. `sign-feedback-token` — signFeedbackToken(workshopId, email) → HS256
 *      JWT with 14d expiry (D-17). Build the /participate deep-link URL
 *      from NEXT_PUBLIC_APP_URL (fallback APP_BASE_URL, then localhost).
 *   3. `send-feedback-invite-email` — sendWorkshopFeedbackInviteEmail with
 *      the resolved title + fully-qualified feedbackUrl.
 *
 * No rateLimit: one event per attendee per MEETING_ENDED is desired (the
 * producer already dedups at the workshop level by transitioning status to
 * 'completed' only once).
 *
 * Pitfall 4 (Inngest v4): `triggers` MUST be inlined in createFunction
 * options. Do not refactor into a const.
 *
 * Implements WS-15 (email-delivery half). D-16, D-17. The /participate
 * receiving half lands in Plan 20-06.
 */

export const workshopFeedbackInviteFn = inngest.createFunction(
  {
    id: 'workshop-feedback-invite',
    name: 'Workshop feedback invite — signed JWT deep-link email',
    retries: 3,
    // INLINE triggers — Pitfall 4.
    triggers: [{ event: 'workshop.feedback.invite' }],
  },
  async ({ event, step }) => {
    const { workshopId, email, name } = event.data as {
      workshopId: string
      email: string
      name: string
      attendeeUserId: string | null
    }

    // Step 1: load workshop for title (email subject + body). Pre-serialize
    // scheduledAt: step.run JSON-round-trips its return value, so Date
    // becomes string at the handler boundary either way.
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
        scheduledAt: row.scheduledAt.toISOString(),
      }
    })

    if (!workshop) {
      throw new NonRetriableError(`workshop ${workshopId} not found`)
    }

    // Step 2: sign the per-attendee JWT and construct the deep-link.
    const feedbackUrl = await step.run('sign-feedback-token', async () => {
      const token = signFeedbackToken(workshopId, email)
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        process.env.APP_BASE_URL ??
        'http://localhost:3000'
      // D-17: /participate mode-switch URL. workshopId is the plain UUID;
      // token is URL-encoded defensively even though HS256 JWT base64url
      // alphabet is URL-safe.
      return `${baseUrl}/participate?workshopId=${workshopId}&token=${encodeURIComponent(token)}`
    })

    // Step 3: email delivery. Errors bubble to Inngest retry budget.
    await step.run('send-feedback-invite-email', async () => {
      await sendWorkshopFeedbackInviteEmail(email, {
        name,
        workshopTitle: workshop.title,
        feedbackUrl,
      })
    })

    return { email, workshopId, ok: true }
  },
)
