import { NonRetriableError } from 'inngest'
import { eq } from 'drizzle-orm'
import { inngest } from '../client'
import {
  notificationCreateEvent,
  computeNotificationIdempotencyKey,
} from '../events'
import { db } from '@/src/db'
import { notifications } from '@/src/db/schema/notifications'
import { users } from '@/src/db/schema/users'
import {
  sendFeedbackReviewedEmail,
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
 *   - `feedback_status_changed` routes through `sendFeedbackReviewedEmail`.
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

const SKIP_EMAIL_TYPES = new Set<string>(['cr_status_changed'])

export const notificationDispatchFn = inngest.createFunction(
  {
    id: 'notification-dispatch',
    name: 'Notification dispatch - DB insert + email',
    retries: 3,
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
    if (recipientEmail && !SKIP_EMAIL_TYPES.has(data.type)) {
      await step.run('send-email', async () => {
        switch (data.type) {
          case 'version_published':
            await sendVersionPublishedEmail(recipientEmail, {
              policyName:   data.title,
              versionLabel: data.body ?? '',
            })
            break
          case 'section_assigned':
            await sendSectionAssignedEmail(recipientEmail, {
              sectionName: data.title,
              policyName:  data.body ?? '',
            })
            break
          case 'feedback_status_changed':
          default:
            await sendFeedbackReviewedEmail(recipientEmail, {
              feedbackReadableId: data.title,
              decision:           data.type,
              rationale:          data.body ?? '',
            })
            break
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
