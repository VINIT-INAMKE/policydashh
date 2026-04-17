import { NonRetriableError } from 'inngest'
import { clerkClient } from '@clerk/nextjs/server'
import { isClerkAPIResponseError } from '@clerk/shared/error'
import { inngest } from '../client'

/**
 * participateIntakeFn - async worker for the public /participate intake form.
 *
 * Triggered by `participate.intake` events sent from
 * app/api/intake/participate/route.ts (Plan 19-01) AFTER the Route Handler
 * has verified the Cloudflare Turnstile token and run basic validation.
 *
 * Steps:
 *   1. Rate limit at run-start: 1 run per emailHash per 15 minutes (INTAKE-03).
 *      Excess events are silently dropped by Inngest (public-form abuse
 *      prevention; email hash rather than raw email is the stable,
 *      privacy-preserving key).
 *   2. `clerkClient().invitations.createInvitation` with `ignoreExisting: true`
 *      (INTAKE-04 + INTAKE-06). Clerk sends ONE email (the invitation) - we
 *      do not follow up with a separate welcome email to avoid the two-email
 *      confusion the user reported. Welcome copy lives in the Clerk
 *      invitation template in the Clerk dashboard.
 *
 * Error policy (19-RESEARCH.md Pattern 3, mirrors Phase 17 workshopCompletedFn):
 *   - Clerk 5xx → plain Error → Inngest retries up to `retries: 3`.
 *   - Clerk 4xx → NonRetriableError → no retry, permanent failure.
 *   - Non-Clerk errors → NonRetriableError (unknown failure surface,
 *     safest default until observed in production).
 *
 * Pitfall 4 (Inngest v4 type-widening footgun): `triggers` MUST be inlined in
 * the createFunction options object. Extracting to a `const triggers = [...]`
 * collapses `event.data` to `any` inside the handler. Do not refactor.
 */

export const participateIntakeFn = inngest.createFunction(
  {
    id: 'participate-intake',
    name: 'Participate intake - Clerk invite + welcome email',
    retries: 3,
    // INTAKE-03: hard drop after 1 run per emailHash per 15m window.
    rateLimit: {
      key: 'event.data.emailHash',
      limit: 1,
      period: '15m',
    },
    // INLINE triggers - Pitfall 4. Using a string-literal event name keeps
    // this function independent of Plan 19-01's `participateIntakeEvent`
    // registration (Wave 2 parallel plans must not import each other).
    triggers: [{ event: 'participate.intake' }],
  },
  async ({ event, step }) => {
    const { email, orgType } = event.data as {
      email: string
      name: string
      orgType: string
      emailHash: string
      expertise?: string
    }

    await step.run('create-clerk-invitation', async () => {
      try {
        const client = await clerkClient()
        await client.invitations.createInvitation({
          emailAddress: email,
          ignoreExisting: true,
          publicMetadata: {
            role: 'stakeholder',
            orgType,
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

    return { email, orgType, ok: true }
  },
)
