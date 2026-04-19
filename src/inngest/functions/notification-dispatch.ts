import { NonRetriableError } from 'inngest'
import { and, eq, isNull } from 'drizzle-orm'
import { inngest } from '../client'
import {
  notificationCreateEvent,
  computeNotificationIdempotencyKey,
} from '../events'
import { db } from '@/src/db'
import { notifications } from '@/src/db/schema/notifications'
import { users } from '@/src/db/schema/users'
// R3: `sendFeedbackReviewedEmail` is no longer imported here. The dispatcher
// used to call it in a default branch for `feedback_status_changed`, but
// that type is now skipped (SKIP_EMAIL_TYPES) and Flow 5's own
// feedbackReviewedFn remains the single sender for review-decision emails.
import {
  sendVersionPublishedEmail,
  sendSectionAssignedEmail,
} from '@/src/lib/email'

/**
 * notification-dispatch - off-critical-path notification + email dispatcher.
 *
 * Triggered by `notification.create` events emitted from tRPC mutations in
 * feedback.ts, changeRequest.ts, version.ts, sectionAssignment.ts. Handles
 * the DB insert (with NOTIF-06 idempotency guard via partial unique index)
 * and dispatches an email through the existing `sendFeedbackReviewedEmail`
 * helper for any notification type that has an email-capable user.
 *
 *   - NOTIF-05: replaces inline `createNotification(...).catch(console.error)`
 *     fire-and-forget paths with durable, retryable Inngest steps.
 *   - NOTIF-06: `onConflictDoNothing()` on the partial unique index makes the
 *     dual-write transition window (Plan 03 migrates callsites one file at a
 *     time) safe - a duplicate dispatch silently no-ops at the DB level.
 *
 * Phase 16 email scope (per RESEARCH §3.2 Open Question 2):
 *
 *   - `feedback_status_changed` is IN-APP ONLY here. Flow 5's
 *     `feedbackReviewedFn` sends the decision email with a properly built
 *     payload (see buildFeedbackReviewedCopy). The old default-branch path
 *     that piped start-review/close events through sendFeedbackReviewedEmail
 *     produced broken subjects (R3/R14) and has been removed.
 *   - `version_published` routes through `sendVersionPublishedEmail`.
 *   - `section_assigned` routes through `sendSectionAssignedEmail`.
 *   - `cr_status_changed` is in-app only; the send-email step is skipped
 *     unconditionally - no CR-status email template exists.
 *
 * Flow 5's own `feedback.reviewed` path continues to use `feedbackReviewedFn`
 * (which has a properly structured email payload built from `buildFeedback
 * ReviewedCopy`). This new function only handles the NEW `notification.create`
 * events, not the existing `feedback.reviewed` chain. Plan 04 verifies the
 * Flow 5 smoke stays green.
 */

// R3: `feedback_status_changed` was previously routed through the default
// `sendFeedbackReviewedEmail` branch, which resulted in grotesque subject
// lines like "Your feedback has been reviewed" for start-review/close
// transitions, with the literal string "feedback_status_changed" as the
// decision word in the body and the human-readable notification title
// ("Feedback under review") injected as the feedback readable ID. No
// email template exists for start-review or close; the in-app notification
// alone is sufficient. Flow 5 (accept / partially_accept / reject) emits
// its own well-formed email via feedbackReviewedFn, not this dispatcher.
const SKIP_EMAIL_TYPES = new Set<string>([
  'cr_status_changed',
  'feedback_status_changed',
])

/**
 * P10: parse the `version_published` notification title into clean
 * `policyName` + `versionLabel` pieces so `sendVersionPublishedEmail`
 * doesn't double-prefix the subject ("New version published: New
 * version published: Policy X v1.0").
 *
 * Input heuristics, in priority order:
 *   1. Title contains `<name>|<label>` — split on the pipe (preferred
 *      forward-compatible format; event emitters should adopt it).
 *   2. Title starts with "New version published: " — strip the prefix
 *      and take the remainder as the policyName, pull the trailing
 *      token as the versionLabel if it looks like a version ("v\d+" or
 *      "\d+\.\d+").
 *   3. Otherwise, take the full title as `policyName` and use `body`
 *      (if present) as `versionLabel`.
 */
function parseVersionPublishedTitle(
  title: string,
  body: string | undefined,
): { policyName: string; versionLabel: string } {
  const pipeIdx = title.indexOf('|')
  if (pipeIdx > 0) {
    return {
      policyName: title.slice(0, pipeIdx).trim(),
      versionLabel: title.slice(pipeIdx + 1).trim(),
    }
  }

  const PREFIX = 'New version published: '
  if (title.startsWith(PREFIX)) {
    const remainder = title.slice(PREFIX.length).trim()
    const versionMatch = remainder.match(/\s+(v?\d+(?:\.\d+)*)\s*$/i)
    if (versionMatch && versionMatch.index !== undefined) {
      return {
        policyName: remainder.slice(0, versionMatch.index).trim(),
        versionLabel: versionMatch[1].trim(),
      }
    }
    return { policyName: remainder, versionLabel: body?.trim() ?? '' }
  }

  return { policyName: title, versionLabel: body?.trim() ?? '' }
}

export const notificationDispatchFn = inngest.createFunction(
  {
    id: 'notification-dispatch',
    name: 'Notification dispatch - DB insert + email',
    retries: 3,
    // P30: bound concurrency so a large fan-out (e.g. `version.published`
    // emitting one event per subscriber) doesn't flood Resend with parallel
    // sends. 10 parallel runs keeps throughput high while giving Resend room
    // to rate-limit cleanly.
    concurrency: { key: 'notification-dispatch:email', limit: 10 },
    // Inlined trigger array per src/inngest/README.md §90-94: extracting to a
    // `const triggers = [...]` widens the type and collapses `event.data` to
    // `any` inside the handler. Inngest v4 type-inference footgun.
    triggers: [{ event: notificationCreateEvent }],
  },
  async ({ event, step }) => {
    const data = event.data

    // Step 1: insert the notification row with an idempotency guard.
    //
    // `computeNotificationIdempotencyKey` builds a deterministic key from
    // (createdBy, entityType, entityId, action). `.onConflictDoNothing()`
    // against the partial unique index `notifications_idempotency_key_unique`
    // (migration 0009_notification_idempotency.sql) silently no-ops on a
    // duplicate dispatch - Inngest retry after a partial step-failure, or
    // the dual-write transition window from Plan 03, both land here safely.
    //
    // Transient DB errors bubble as plain `Error` so Inngest retries; only
    // truly-deterministic failures (e.g. missing user in step 2) escalate
    // to NonRetriableError below.
    await step.run('insert-notification', async () => {
      const idempotencyKey = computeNotificationIdempotencyKey({
        createdBy: data.createdBy,
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
      })

      await db
        .insert(notifications)
        .values({
          userId:         data.userId,
          type:           data.type,
          title:          data.title,
          body:           data.body ?? null,
          entityType:     data.entityType ?? null,
          entityId:       data.entityId ?? null,
          linkHref:       data.linkHref ?? null,
          idempotencyKey,
        })
        .onConflictDoNothing()
    })

    // Step 2: resolve the target user's email address. May return null for
    // phone-only users - in which case the email step is skipped entirely.
    // If the user row does not exist at all (e.g. deleted between mutation
    // and dispatch), throw NonRetriableError - no retry can resurrect a
    // deleted row, so burning retry budget on it is wasteful.
    const recipientEmail = await step.run('fetch-user-email', async () => {
      const [row] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, data.userId))
        .limit(1)

      if (!row) {
        throw new NonRetriableError(`user ${data.userId} not found`)
      }
      return row.email ?? null
    })

    // Step 3: send the email via the type-appropriate helper. Skip when the
    // user has no email address or the type is in-app only. Each helper
    // silently no-ops if RESEND_API_KEY is unset.
    //
    // R3/R14: `feedback_status_changed` is now skipped at the SKIP_EMAIL_TYPES
    // gate above -- Flow 5 (accept/partial/reject) sends its own email via
    // feedbackReviewedFn with a properly structured payload, and there is no
    // dedicated email template for start-review or close. The old default
    // branch here forwarded `decision: data.type` and the notification title
    // as the readable ID, producing broken subjects like "Your feedback
    // Feedback under review has been reviewed". The default branch below is
    // a no-op fallback for future types that have not yet been wired up.
    if (recipientEmail && !SKIP_EMAIL_TYPES.has(data.type)) {
      await step.run('send-email', async () => {
        // P30: idempotency guard. Look up the notification row by its
        // deterministic idempotency key; if `email_sent_at` is already set
        // the email has already been delivered (or another retry is racing
        // with us — still safe, because the UPDATE below only flips NULL
        // rows). Skip on hit.
        const idempotencyKey = computeNotificationIdempotencyKey({
          createdBy: data.createdBy,
          entityType: data.entityType,
          entityId: data.entityId,
          action: data.action,
        })
        const [existing] = await db
          .select({
            id:          notifications.id,
            emailSentAt: notifications.emailSentAt,
          })
          .from(notifications)
          .where(eq(notifications.idempotencyKey, idempotencyKey))
          .limit(1)

        if (existing?.emailSentAt) {
          console.log(
            `[notification-dispatch] email already sent for ${idempotencyKey}; skipping`,
          )
          return
        }

        switch (data.type) {
          case 'version_published':
            // P10: pass distinct policyName + versionLabel so the subject
            // line doesn't double-prefix. The event emitter packs these as
            // `"<Policy Name>|<Version Label>"` in the title (callers must
            // adopt the separator). Fallback: use the whole title as
            // policyName if no separator is present, leaving versionLabel
            // empty. Back-compat with the prior event shape where the
            // title carried the bare "New version published: Policy X v1.0"
            // string: split on the first ": " and take the tail.
            {
              const { policyName, versionLabel } =
                parseVersionPublishedTitle(data.title, data.body)
              await sendVersionPublishedEmail(recipientEmail, {
                policyName,
                versionLabel,
              })
            }
            break
          case 'section_assigned':
            await sendSectionAssignedEmail(recipientEmail, {
              sectionName: data.title,
              policyName:  data.body ?? '',
            })
            break
          default:
            // Unknown type: skip the email rather than misroute it. The
            // in-app notification was inserted above so the user still has
            // a record of the event. Log so we notice if a new type ships
            // without a corresponding email branch.
            console.warn(
              `[notification-dispatch] no email template for type=${data.type}; skipping`,
            )
            break
        }

        // P30: mark the email as delivered. UPDATE is guarded by
        // `email_sent_at IS NULL` so two concurrent runs won't both claim
        // to have sent; Postgres ignores the second write without error.
        if (existing) {
          await db
            .update(notifications)
            .set({ emailSentAt: new Date() })
            .where(
              and(
                eq(notifications.id, existing.id),
                isNull(notifications.emailSentAt),
              ),
            )
        }
      })
    }

    return {
      userId:  data.userId,
      type:    data.type,
      action:  data.action,
      emailed: Boolean(recipientEmail && !SKIP_EMAIL_TYPES.has(data.type)),
    }
  },
)
