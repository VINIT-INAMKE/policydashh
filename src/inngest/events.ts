import { eventType } from 'inngest'
import { z } from 'zod'
import { inngest } from './client'

/**
 * Domain event registry.
 *
 * Every Inngest event PolicyDash emits follows the same three-step shape:
 *
 *   1. A private Zod schema literal — the single source of truth for the
 *      event's payload shape and runtime validation rules.
 *   2. An exported `EventType` instance via `eventType(name, { schema })` —
 *      used as the trigger in `createFunction` and as the `.create()` factory
 *      for send payloads. Zod v4 implements StandardSchemaV1 natively, so a
 *      `z.object(...)` schema can be passed directly.
 *   3. An exported `sendX()` helper whose parameter type is derived from
 *      `z.infer<typeof schema>`. This is the ONLY sanctioned way to emit
 *      events — the client's raw `inngest.send()` is not narrowed by the
 *      event registry (v4 removed `EventSchemas.fromZod()`), so calling it
 *      directly is a type-safety hole.
 *
 * Two rules every future event MUST follow:
 *   A. The helper's parameter type is `z.infer<typeof thisFlowSchema>`, not
 *      a hand-written duplicate. This closes the drift between schema and
 *      helper signature the first time someone adds a field.
 *   B. The helper calls `.validate()` on the created event BEFORE sending.
 *      `EventType.create()` returns an `UnvalidatedCreatedEvent` — the Zod
 *      schema is decorative at send time unless `.validate()` is explicitly
 *      called. See `node_modules/inngest/components/triggers/triggers.d.ts`
 *      lines 79-89.
 *
 * Template for a new event:
 *
 *   const myEventSchema = z.object({ foo: z.string() })
 *   export const myEvent = eventType('my.event', { schema: myEventSchema })
 *   export type MyEventData = z.infer<typeof myEventSchema>
 *   export async function sendMyEvent(data: MyEventData): Promise<void> {
 *     const event = myEvent.create(data)
 *     await event.validate()
 *     await inngest.send(event)
 *   }
 */

// -- sample.hello --------------------------------------------------------

const sampleHelloSchema = z.object({
  // min(1) rejects empty strings; refine rejects whitespace-only strings.
  // This mirrors the guard in src/inngest/lib/greeting.ts so boundary and lib
  // enforce the same rule. `.refine()` does not transform the value, so the
  // schema still passes Inngest v4's AssertNoTransform check (input type
  // matches output type).
  recipientName: z
    .string()
    .min(1)
    .refine((s) => s.trim().length > 0, {
      message: 'recipientName must not be whitespace-only',
    }),
})

export const sampleHelloEvent = eventType('sample.hello', {
  schema: sampleHelloSchema,
})

export type SampleHelloData = z.infer<typeof sampleHelloSchema>

export async function sendSampleHello(data: SampleHelloData): Promise<void> {
  const event = sampleHelloEvent.create(data)
  await event.validate()
  await inngest.send(event)
}

// -- feedback.reviewed ----------------------------------------------------

const feedbackReviewedSchema = z.object({
  feedbackId: z.string().uuid(),
  decision: z.enum(['accept', 'partially_accept', 'reject']),
  // Rationale is required by the decide mutation (min 20 chars). We mirror
  // the lower bound here rather than copying the 20-char rule, because this
  // schema guards the wire contract to Inngest, not the product rule.
  rationale: z.string().min(1).max(2000),
  reviewedByUserId: z.string().uuid(),
})

export const feedbackReviewedEvent = eventType('feedback.reviewed', {
  schema: feedbackReviewedSchema,
})

export type FeedbackReviewedData = z.infer<typeof feedbackReviewedSchema>

export async function sendFeedbackReviewed(
  data: FeedbackReviewedData,
): Promise<void> {
  const event = feedbackReviewedEvent.create(data)
  await event.validate()
  await inngest.send(event)
}
