import { NonRetriableError } from 'inngest'
import { clerkClient } from '@clerk/nextjs/server'
import { isClerkAPIResponseError } from '@clerk/shared/error'
import { inngest } from '../client'
// NOTE: `sendWelcomeEmail` is shipped by Plan 19-03 (parallel wave). Until
// that plan merges, this import will surface a TypeScript "missing export"
// diagnostic. The Wave 0 test file mocks `@/src/lib/email` at module level
// so runtime tests pass. This is the expected Wave 2 cross-plan seam.
import { sendWelcomeEmail } from '@/src/lib/email'

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
 *      (INTAKE-04 + INTAKE-06). Clerk dedups atomically: new user → new
 *      invitation, existing user → silent no-op with the same response
 *      shape. Either way we do not leak existence of an account.
 *   3. `sendWelcomeEmail` (INTAKE-05). Always runs, even when Clerk ignored a
 *      duplicate - same success response for new and existing users, no
 *      info leak. Role-tailored copy is selected from `orgType` inside the
 *      helper (shipped in Plan 19-03).
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
    const { email, name, orgType } = event.data as {
      email: string
      name: string
      orgType: string
      emailHash: string
      expertise?: string
    }

    // Step 1: Clerk invitation (INTAKE-04 + INTAKE-06).
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
        // Clerk 5xx → retry. Clerk 4xx → permanent.
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

    // Step 2: Welcome email (INTAKE-05). Fires for both new and existing
    // users - same success shape, no info leak. No try/catch: failures
    // should retry via Inngest.
    await step.run('send-welcome-email', async () => {
      await sendWelcomeEmail(email, { name, orgType, email })
    })

    return { email, orgType, ok: true }
  },
)
