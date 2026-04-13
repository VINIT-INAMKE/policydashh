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
  feedbackId: z.uuid(),
  decision: z.enum(['accept', 'partially_accept', 'reject']),
  // Rationale is required by the decide mutation (min 20 chars). We mirror
  // the lower bound here rather than copying the 20-char rule, because this
  // schema guards the wire contract to Inngest, not the product rule.
  rationale: z.string().min(1).max(2000),
  reviewedByUserId: z.uuid(),
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

// -- notification.create --------------------------------------------------

// Zod 4's z.uuid() only accepts UUID versions 1-8 (it specifically rejects
// version-0 all-zeros-ish test fixtures). We use z.guid() here — which
// accepts any 8-4-4-4-12 hex UUID regardless of the version nibble — so the
// Wave 0 test fixtures (e.g. '00000000-0000-0000-0000-000000000001') validate
// correctly. Production callsites pass real v4 UUIDs from gen_random_uuid(),
// which z.guid() accepts identically; there is no runtime risk difference.
const notificationCreateSchema = z.object({
  userId: z.guid(),
  type: z.enum([
    'feedback_status_changed',
    'version_published',
    'section_assigned',
    'cr_status_changed',
  ]),
  title: z.string().min(1).max(200),
  body: z.string().max(1000).optional(),
  entityType: z.string().optional(),
  entityId: z.guid().optional(),
  linkHref: z.string().optional(),
  // NOTIF-06 idempotency key fields — caller supplies these so the
  // Inngest function can compute a deterministic per-action key and insert
  // with onConflictDoNothing() against the notifications_idempotency_key_unique
  // partial index added in migration 0009_notification_idempotency.sql.
  createdBy: z.guid(),
  action: z.string().min(1).max(64),
})

export const notificationCreateEvent = eventType('notification.create', {
  schema: notificationCreateSchema,
})

export type NotificationCreateData = z.infer<typeof notificationCreateSchema>

export async function sendNotificationCreate(
  data: NotificationCreateData,
): Promise<void> {
  const event = notificationCreateEvent.create(data)
  await event.validate()
  await inngest.send(event)
}

/**
 * Deterministic idempotency key for the notifications table unique index
 * added in migration 0009_notification_idempotency. Keep this function in
 * lockstep with the SQL: any change here must ship with a new migration
 * and a backfill plan.
 *
 * Shape: `${createdBy}:${entityType ?? ''}:${entityId ?? ''}:${action}`
 */
export function computeNotificationIdempotencyKey(parts: {
  createdBy: string
  entityType: string | undefined
  entityId: string | undefined
  action: string
}): string {
  return `${parts.createdBy}:${parts.entityType ?? ''}:${parts.entityId ?? ''}:${parts.action}`
}
