import { eventType } from 'inngest'
import { z } from 'zod'
import { inngest } from './client'

/**
 * Domain event registry.
 *
 * Every Inngest event Civilization Lab emits follows the same three-step shape:
 *
 *   1. A private Zod schema literal - the single source of truth for the
 *      event's payload shape and runtime validation rules.
 *   2. An exported `EventType` instance via `eventType(name, { schema })` -
 *      used as the trigger in `createFunction` and as the `.create()` factory
 *      for send payloads. Zod v4 implements StandardSchemaV1 natively, so a
 *      `z.object(...)` schema can be passed directly.
 *   3. An exported `sendX()` helper whose parameter type is derived from
 *      `z.infer<typeof schema>`. This is the ONLY sanctioned way to emit
 *      events - the client's raw `inngest.send()` is not narrowed by the
 *      event registry (v4 removed `EventSchemas.fromZod()`), so calling it
 *      directly is a type-safety hole.
 *
 * Two rules every future event MUST follow:
 *   A. The helper's parameter type is `z.infer<typeof thisFlowSchema>`, not
 *      a hand-written duplicate. This closes the drift between schema and
 *      helper signature the first time someone adds a field.
 *   B. The helper calls `.validate()` on the created event BEFORE sending.
 *      `EventType.create()` returns an `UnvalidatedCreatedEvent` - the Zod
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
// version-0 all-zeros-ish test fixtures). We use z.guid() here - which
// accepts any 8-4-4-4-12 hex UUID regardless of the version nibble - so the
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
    // P24: dedicated enum value for Cardano anchor failures. Previously
    // milestone/version anchor failures reused 'cr_status_changed' which
    // showed the wrong icon in the notification panel.
    'anchoring_failed',
  ]),
  title: z.string().min(1).max(200),
  body: z.string().max(1000).optional(),
  entityType: z.string().optional(),
  entityId: z.guid().optional(),
  // P23: linkHref must be a deep link (`/path`) or an absolute URL. Relaxing
  // to a catch-all `string()` previously allowed `javascript:` URIs and
  // dangling path fragments. Internal links are the common case so we
  // permit leading-slash paths in addition to fully-qualified URLs. Both
  // shapes are safe for the notification panel renderer (A1 deep-link fix).
  linkHref: z
    .string()
    .refine(
      (v) => v.startsWith('/') || /^https?:\/\//i.test(v),
      { message: 'linkHref must start with "/" or be an http(s) URL' },
    )
    .optional(),
  // NOTIF-06 idempotency key fields - caller supplies these so the
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

// -- workshop.completed ---------------------------------------------------

const workshopCompletedSchema = z.object({
  workshopId:  z.guid(),
  moderatorId: z.guid(),
})

export const workshopCompletedEvent = eventType('workshop.completed', {
  schema: workshopCompletedSchema,
})

export type WorkshopCompletedData = z.infer<typeof workshopCompletedSchema>

export async function sendWorkshopCompleted(
  data: WorkshopCompletedData,
): Promise<void> {
  const event = workshopCompletedEvent.create(data)
  await event.validate()
  await inngest.send(event)
}

// -- workshop.recording_uploaded -----------------------------------------

const workshopRecordingUploadedSchema = z.object({
  workshopId:         z.guid(),
  workshopArtifactId: z.guid(),  // workshopArtifacts.id (the link row PK)
  r2Key:              z.string().min(1),
  moderatorId:        z.guid(),
})

export const workshopRecordingUploadedEvent = eventType(
  'workshop.recording_uploaded',
  { schema: workshopRecordingUploadedSchema },
)

export type WorkshopRecordingUploadedData = z.infer<typeof workshopRecordingUploadedSchema>

export async function sendWorkshopRecordingUploaded(
  data: WorkshopRecordingUploadedData,
): Promise<void> {
  const event = workshopRecordingUploadedEvent.create(data)
  await event.validate()
  await inngest.send(event)
}

// -- evidence.export_requested -------------------------------------------

// Use z.guid() per Phase 16 decision: z.uuid() rejects version-0 test fixtures.
// H1: `sections` lets the requester opt individual artifact categories in/out.
// Each flag is optional; the service treats an absent/true value as "include".
const evidenceExportSectionsSchema = z.object({
  stakeholders: z.boolean().optional(),
  feedback:     z.boolean().optional(),
  versions:     z.boolean().optional(),
  decisions:    z.boolean().optional(),
  workshops:    z.boolean().optional(),
}).optional()

const evidenceExportRequestedSchema = z.object({
  documentId:  z.guid(),
  requestedBy: z.guid(),
  userEmail:   z.string().email().nullable(),
  sections:    evidenceExportSectionsSchema,
})

export type EvidenceExportSections = z.infer<typeof evidenceExportSectionsSchema>

export const evidenceExportRequestedEvent = eventType('evidence.export_requested', {
  schema: evidenceExportRequestedSchema,
})

export type EvidenceExportRequestedData = z.infer<typeof evidenceExportRequestedSchema>

export async function sendEvidenceExportRequested(
  data: EvidenceExportRequestedData,
): Promise<void> {
  const event = evidenceExportRequestedEvent.create(data)
  await event.validate()
  await inngest.send(event)
}

// -- participate.intake ------------------------------------------------

const participateIntakeSchema = z.object({
  // SHA-256 hex of lowercased trimmed email - used as rate-limit key
  emailHash: z.string().regex(/^[0-9a-f]{64}$/, 'emailHash must be SHA-256 hex (64 lowercase chars)'),
  email: z.string().email(),
  name: z.string().min(2).max(120),
  orgType: z.enum(['government', 'industry', 'legal', 'academia', 'civil_society', 'internal']),
  expertise: z.string().min(20).max(1000),
  howHeard: z.string().max(100).optional(),
  // Option C (migration 0028): participate intake now forwards orgName and
  // designation so the Clerk user.created webhook can hydrate the users row
  // directly. `designation` replaces the old `role` free-text field that
  // duplicated orgType's enum; it's a free-text job title like
  // "Partner, Fintech Practice" that the directory + profile surfaces show.
  orgName: z.string().min(2).max(200).optional(),
  designation: z.string().min(2).max(200).optional(),
})

export const participateIntakeEvent = eventType('participate.intake', {
  schema: participateIntakeSchema,
})

export type ParticipateIntakeData = z.infer<typeof participateIntakeSchema>

/**
 * Fire a participate.intake event. Route Handler calls this AFTER verifying
 * Turnstile so rate-limiting and Clerk work happen entirely inside the
 * Inngest worker (INTAKE-03).
 *
 * Rate limiting: `participateIntakeFn` in src/inngest/functions/participate-intake.ts
 * configures `rateLimit: { key: 'event.data.emailHash', limit: 1, period: '15m' }`.
 * This helper does NOT rate-limit - it simply accepts, validates, and hands
 * off to Inngest, which enforces the limit at run-start time.
 */
export async function sendParticipateIntake(data: ParticipateIntakeData): Promise<void> {
  const event = participateIntakeEvent.create(data)
  await event.validate()
  await inngest.send(event)
}

// -- workshop.created ----------------------------------------------------
// Phase 20 D-01 - admin creates a workshop; async cal.com event-type
// provisioning runs in Inngest so the tRPC mutation stays fast.

const workshopCreatedSchema = z.object({
  workshopId: z.guid(),
  moderatorId: z.guid(),
})

export const workshopCreatedEvent = eventType('workshop.created', {
  schema: workshopCreatedSchema,
})

export type WorkshopCreatedData = z.infer<typeof workshopCreatedSchema>

export async function sendWorkshopCreated(data: WorkshopCreatedData): Promise<void> {
  const event = workshopCreatedEvent.create(data)
  await event.validate()
  await inngest.send(event)
}

// -- workshop.registration.received --------------------------------------
// Phase 20 D-11 - cal.com webhook INSERTs a workshop_registrations row,
// then emits this event so Clerk invite + confirmation email run async.
// Reused by D-12 walk-in synthetic rows.

const workshopRegistrationReceivedSchema = z.object({
  workshopId: z.guid(),
  email: z.string().email(),
  // SHA-256 hex (64 lowercase chars) - same rate-limit key shape as
  // participate.intake; used by workshopRegistrationReceivedFn rateLimit.
  emailHash: z.string().regex(/^[0-9a-f]{64}$/, 'emailHash must be SHA-256 hex (64 lowercase chars)'),
  name: z.string(),
  /**
   * B3-9: `bookingUid` is one of three shapes depending on `source`:
   *   - `direct_register` → composite `${rootBookingUid}:${attendeeId}` —
   *     the cal.com root booking uid joined to the seat attendee id via
   *     COMPOSITE_BOOKING_UID_DELIMITER (`:`). Downstream consumers that
   *     need to trace back to the root booking should split on the first
   *     `:` or use `buildCompositeBookingUid()` in `src/lib/calcom.ts`.
   *   - `walk_in` → `walkin:${workshopId}:${sha256(email)}` synthesized by
   *     the MEETING_ENDED handler for attendees with no prior registration.
   *   - `cal_booking` → legacy shape (single cal.com uid), only used by
   *     code paths that predate the 2026-04-21 seated-booking redesign.
   */
  bookingUid: z.string().min(1),
  source: z.enum(['cal_booking', 'walk_in', 'direct_register']),
})

export const workshopRegistrationReceivedEvent = eventType(
  'workshop.registration.received',
  { schema: workshopRegistrationReceivedSchema },
)

export type WorkshopRegistrationReceivedData = z.infer<typeof workshopRegistrationReceivedSchema>

export async function sendWorkshopRegistrationReceived(
  data: WorkshopRegistrationReceivedData,
): Promise<void> {
  const event = workshopRegistrationReceivedEvent.create(data)
  await event.validate()
  await inngest.send(event)
}

// -- workshop.registration.orphan ----------------------------------------
// H1 (audit 2026-04-27): cal.com seat creation succeeded but our DB write
// or post-Cal.com capacity recheck failed — the attendee is seated on
// cal.com (with the Meet link in their inbox) but our system has no row.
// This event fan-outs an admin alert email so a human can manually un-seat
// the orphan attendee on cal.com. Auto-removal is intentionally NOT done
// because deleting an attendee who legitimately paid is worse than
// reconciliation by hand.

const workshopRegistrationOrphanSchema = z.object({
  workshopId:     z.guid(),
  rootBookingUid: z.string().min(1),
  attendeeId:     z.number().int().positive(),
  bookingId:      z.number().int().positive(),
  email:          z.string().email(),
  // Why the orphan happened. `db_insert_failed` = unique-constraint
  // collision or DB write error after the cal.com seat was created;
  // `capacity_recheck_failed` = cal.com seat was assigned, but our
  // post-Cal.com locked recheck saw a now-full workshop and rolled back
  // the INSERT; `unique_collision` = double-click race lost to the
  // partial unique index.
  reason: z.enum([
    'db_insert_failed',
    'capacity_recheck_failed',
    'unique_collision',
  ]),
})

export const workshopRegistrationOrphanEvent = eventType(
  'workshop.registration.orphan',
  { schema: workshopRegistrationOrphanSchema },
)

export type WorkshopRegistrationOrphanData = z.infer<typeof workshopRegistrationOrphanSchema>

export async function sendWorkshopRegistrationOrphan(
  data: WorkshopRegistrationOrphanData,
): Promise<void> {
  const event = workshopRegistrationOrphanEvent.create(data)
  await event.validate()
  await inngest.send(event)
}

// -- workshop.feedback.invite --------------------------------------------
// Phase 20 D-16 - MEETING_ENDED handler emits one event per attendee;
// workshopFeedbackInviteFn sends the Resend email with the signed JWT
// deep-link (D-17) to the /participate?workshopId=...&token=... route.

const workshopFeedbackInviteSchema = z.object({
  workshopId: z.guid(),
  email: z.string().email(),
  name: z.string(),
  attendeeUserId: z.guid().nullable(),
})

export const workshopFeedbackInviteEvent = eventType(
  'workshop.feedback.invite',
  { schema: workshopFeedbackInviteSchema },
)

export type WorkshopFeedbackInviteData = z.infer<typeof workshopFeedbackInviteSchema>

export async function sendWorkshopFeedbackInvite(
  data: WorkshopFeedbackInviteData,
): Promise<void> {
  const event = workshopFeedbackInviteEvent.create(data)
  await event.validate()
  await inngest.send(event)
}

/**
 * P3: batch helper used by the cal.com MEETING_ENDED handler. A 50-person
 * workshop previously fired 50 sequential `inngest.send()` calls inside the
 * webhook body, saturating cal.com's retry window. We now collect all
 * attendees and submit one Inngest batch.
 *
 * Each entry is validated against the same Zod schema as the single
 * helper. Empty array short-circuits with no network call.
 */
export async function sendWorkshopFeedbackInvitesBatch(
  items: WorkshopFeedbackInviteData[],
): Promise<void> {
  if (items.length === 0) return
  const events = await Promise.all(
    items.map(async (data) => {
      const event = workshopFeedbackInviteEvent.create(data)
      await event.validate()
      return event
    }),
  )
  await inngest.send(events)
}

// -- version.published ----------------------------------------------
// Phase 21 LLM-05 - emitted by version.publish tRPC mutation after the
// notification fan-out. Triggers consultationSummaryGenerateFn which
// caches per-section summaries into documentVersions.consultationSummary.
//
// `overrideOnly` is an optional array of sectionIds used by manual
// "Regenerate Section" actions (D-13) - when present, the Inngest fn
// leaves all other sections untouched in the JSONB so already-approved
// sections are not clobbered by a single-section regen.

const versionPublishedSchema = z.object({
  versionId:    z.guid(),
  documentId:   z.guid(),
  overrideOnly: z.array(z.guid()).optional(),
})

export const versionPublishedEvent = eventType('version.published', {
  schema: versionPublishedSchema,
})

export type VersionPublishedData = z.infer<typeof versionPublishedSchema>

export async function sendVersionPublished(
  data: VersionPublishedData,
): Promise<void> {
  const event = versionPublishedEvent.create(data)
  await event.validate()
  await inngest.send(event)
}

// -- consultation-summary.regen -----------------------------------------
// I3: dedicated event for manual single-section regen from the moderator
// UI. Re-using `version.published` re-fires versionAnchorFn which then
// throws NonRetriableError ('Already anchored') for every regen and
// pollutes the Inngest run history. This event ONLY triggers
// consultationSummaryGenerateFn, with `overrideOnly` scoping the regen
// to the one section the moderator clicked.

const consultationSummaryRegenSchema = z.object({
  versionId:    z.guid(),
  documentId:   z.guid(),
  overrideOnly: z.array(z.guid()).min(1),
})

export const consultationSummaryRegenEvent = eventType(
  'consultation-summary.regen',
  { schema: consultationSummaryRegenSchema },
)

export type ConsultationSummaryRegenData = z.infer<typeof consultationSummaryRegenSchema>

export async function sendConsultationSummaryRegen(
  data: ConsultationSummaryRegenData,
): Promise<void> {
  const event = consultationSummaryRegenEvent.create(data)
  await event.validate()
  await inngest.send(event)
}

// -- user.upserted -------------------------------------------------------
// P2: Clerk webhook fan-out. The webhook handler does a fast Clerk-side
// upsert and then fires this event so the heavy work (audit write +
// workshop_registrations backfill) runs inside an Inngest function
// without blocking the 200 response. Svix retries if the webhook takes
// too long, so splitting the work here avoids double-firing side effects
// under DB load.

const userUpsertedSchema = z.object({
  userId: z.guid(),
  clerkEvent: z.enum(['user.created', 'user.updated']),
  // Email, if any; nullable for phone-only users. Used to scope the
  // workshop_registrations backfill.
  email: z.string().email().nullable(),
  // Role-delta audit payload — present when the prior role differed from
  // the new role and the webhook carried a valid enum value. Caller is
  // responsible for only setting this when an audit write is warranted.
  roleDelta: z
    .object({
      priorRole: z.string(),
      newRole: z.string(),
    })
    .nullable(),
})

export const userUpsertedEvent = eventType('user.upserted', {
  schema: userUpsertedSchema,
})

export type UserUpsertedData = z.infer<typeof userUpsertedSchema>

export async function sendUserUpserted(data: UserUpsertedData): Promise<void> {
  const event = userUpsertedEvent.create(data)
  await event.validate()
  await inngest.send(event)
}

// -- milestone.ready ------------------------------------------------------
// Phase 23 VERIFY-06 -- emitted by markReady tRPC mutation after status
// transition defining -> ready. Triggers milestoneReadyFn which runs the
// 5-step Cardano anchor pipeline: compute-hash -> persist-hash ->
// check-existing-tx -> submit-tx -> confirm-loop.

const milestoneReadySchema = z.object({
  milestoneId: z.guid(),
  triggeredBy: z.guid(),  // admin userId who called markReady
  documentId:  z.guid(),
})

export const milestoneReadyEvent = eventType('milestone.ready', {
  schema: milestoneReadySchema,
})

export type MilestoneReadyData = z.infer<typeof milestoneReadySchema>

export async function sendMilestoneReady(
  data: MilestoneReadyData,
): Promise<void> {
  const event = milestoneReadyEvent.create(data)
  await event.validate()
  await inngest.send(event)
}
