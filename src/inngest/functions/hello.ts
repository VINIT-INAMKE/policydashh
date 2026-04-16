import { inngest } from '../client'
import { sampleHelloEvent } from '../events'
import { buildGreeting } from '../lib/greeting'

/**
 * Sample Inngest function - the bootstrap smoke test.
 *
 * Listens for `sample.hello`, builds a greeting inside a step.run so the
 * computation is idempotent and observable, sleeps 5 seconds to prove the
 * delayed-execution primitive works, then returns the greeting as the run
 * output (visible in the Inngest dashboard).
 *
 * Keep this function in the codebase as a permanent smoke test. When the
 * real Domain 9 flows land, they follow the same structure: extract pure
 * logic into src/inngest/lib/, declare the event in src/inngest/events.ts,
 * wire the function here with step.run / step.sleep / step.sleepUntil as
 * needed, and append to the functions barrel.
 *
 * v4 note: the trigger is the `sampleHelloEvent` EventType instance, not
 * a string. That is what drives type inference of `event.data` in the
 * handler body.
 */
export const helloFn = inngest.createFunction(
  {
    id: 'sample-hello',
    name: 'Sample hello',
    // retries counts attempts AFTER the initial try. retries: 3 means up to
    // 4 total attempts before Inngest marks the run as failed.
    retries: 3,
    triggers: [{ event: sampleHelloEvent }],
  },
  async ({ event, step }) => {
    const greeting = await step.run('build-greeting', () => {
      return buildGreeting({
        recipientName: event.data.recipientName,
        deliveredAt: new Date(),
      })
    })

    await step.sleep('brief-delay', '5s')

    return { greeting }
  },
)
