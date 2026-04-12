import { eventType } from 'inngest'
import { z } from 'zod'
import { inngest } from './client'

/**
 * Domain event registry.
 *
 * Every Inngest event PolicyDash emits gets two exports here:
 *   1. An `EventType` instance (via `eventType(name, { schema })`) — this is
 *      the reference passed to `createFunction`'s trigger, and also the
 *      factory for building send payloads via its `.create()` method.
 *   2. A `sendX()` helper that wraps `inngest.send(event.create(data))` so
 *      callers get a typed, one-argument API at the emission site.
 *
 * Zod v4 implements StandardSchemaV1 natively, so a `z.object(...)` schema
 * can be passed directly to `eventType`'s `schema` option — no `staticSchema`
 * or wrapper needed.
 *
 * To add a new event:
 *   export const myEvent = eventType('my.event', {
 *     schema: z.object({ foo: z.string() }),
 *   })
 *   export async function sendMyEvent(data: { foo: string }) {
 *     await inngest.send(myEvent.create(data))
 *   }
 */

// -- sample.hello --------------------------------------------------------

export const sampleHelloEvent = eventType('sample.hello', {
  schema: z.object({
    recipientName: z.string().min(1),
  }),
})

export async function sendSampleHello(data: { recipientName: string }): Promise<void> {
  await inngest.send(sampleHelloEvent.create(data))
}
