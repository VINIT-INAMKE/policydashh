import { createHash } from 'node:crypto'
import { NonRetriableError } from 'inngest'
import { eq } from 'drizzle-orm'
import { inngest } from '../client'
import { feedbackReviewedEvent } from '../events'
import { buildFeedbackReviewedCopy } from '../lib/feedback-reviewed-copy'
import { buildAutoDraftCRContent } from '../lib/auto-draft-cr-content'
import { createDraftCRFromFeedback } from '../lib/create-draft-cr'
import { db } from '@/src/db'
import { feedbackItems } from '@/src/db/schema/feedback'
import { policySections } from '@/src/db/schema/documents'
import { users } from '@/src/db/schema/users'
import { notifications } from '@/src/db/schema/notifications'
import { sendFeedbackReviewedEmail } from '@/src/lib/email'

/**
 * Flow 5 - revision engine.
 *
 * Triggered when a reviewer decides a feedback item (accept / partially
 * accept / reject). Runs three side effects as idempotent steps:
 *
 *   1. Notify the submitter in-app (always).
 *   2. Email the submitter (always, if they have an email address).
 *   3. Auto-draft a change request (only for accept and partially_accept).
 *
 * Context is looked up inside the function rather than carried in the
 * event payload - this keeps the emit path in the router minimal, and
 * since each DB read is wrapped in `step.run` the result is memoized on
 * retry so the reads don't repeat.
 */
export const feedbackReviewedFn = inngest.createFunction(
  {
    id: 'feedback-reviewed',
    name: 'Feedback reviewed - notify, email, auto-draft CR',
    retries: 3,
    triggers: [{ event: feedbackReviewedEvent }],
  },
  async ({ event, step }) => {
    const { feedbackId, decision, rationale, reviewedByUserId } = event.data

    // Step 1: fetch the feedback row.
    const feedback = await step.run('fetch-feedback', async () => {
      const [row] = await db
        .select({
          id: feedbackItems.id,
          readableId: feedbackItems.readableId,
          submitterId: feedbackItems.submitterId,
          sectionId: feedbackItems.sectionId,
          documentId: feedbackItems.documentId,
          title: feedbackItems.title,
          body: feedbackItems.body,
        })
        .from(feedbackItems)
        .where(eq(feedbackItems.id, feedbackId))
        .limit(1)

      if (!row) {
        throw new NonRetriableError(`feedback ${feedbackId} not found`)
      }
      return row
    })

    // Step 2: fetch the section title (for notification copy).
    const sectionName = await step.run('fetch-section-name', async () => {
      const [row] = await db
        .select({ title: policySections.title })
        .from(policySections)
        .where(eq(policySections.id, feedback.sectionId))
        .limit(1)
      return row?.title ?? ''
    })

    // Step 3: fetch the submitter's email (may be null for phone-only users).
    const submitterEmail = await step.run('fetch-submitter-email', async () => {
      const [row] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, feedback.submitterId))
        .limit(1)
      return row?.email ?? null
    })

    // Step 4: insert the in-app notification.
    //
    // R2: idempotency guard. `retries: 3` on this function means a step-run
    // that ACKs after the INSERT but before Inngest records success will
    // re-enter this step on the next attempt, inserting a duplicate
    // "Your feedback has been reviewed" notification each time (up to 4
    // copies per decide call). We compute a deterministic key from
    // (feedbackId + ':reviewed:' + decision) and rely on the partial unique
    // index `notifications_idempotency_key_unique` (migration 0009) with
    // `.onConflictDoNothing()` to no-op the duplicate. Mirrors the pattern
    // in notification-dispatch.ts:74-94.
    await step.run('insert-notification', async () => {
      const copy = buildFeedbackReviewedCopy({
        decision,
        sectionName,
        rationale,
      })
      const idempotencyKey = createHash('sha256')
        .update(`${feedback.id}:reviewed:${decision}`)
        .digest('hex')
      await db
        .insert(notifications)
        .values({
          userId:     feedback.submitterId,
          type:       'feedback_status_changed',
          title:      copy.title,
          body:       copy.body,
          entityType: 'feedback',
          entityId:   feedback.id,
          linkHref:   `/feedback/${feedback.id}`,
          idempotencyKey,
        })
        .onConflictDoNothing()
    })

    // Step 5: send the email (skip if no address).
    if (submitterEmail) {
      await step.run('send-email', async () => {
        await sendFeedbackReviewedEmail(submitterEmail, {
          feedbackReadableId: feedback.readableId,
          decision,
          rationale,
        })
      })
    }

    // Step 6: auto-draft a CR for accept / partially_accept.
    if (decision === 'accept' || decision === 'partially_accept') {
      const draftCr = await step.run('auto-draft-change-request', async () => {
        const content = buildAutoDraftCRContent({
          feedback: {
            readableId: feedback.readableId,
            title: feedback.title,
            body: feedback.body,
          },
          decision,
          rationale,
        })
        return await createDraftCRFromFeedback({
          documentId: feedback.documentId,
          sectionId: feedback.sectionId,
          feedbackId: feedback.id,
          ownerId: reviewedByUserId,
          title: content.title,
          description: content.description,
        })
      })

      return {
        feedbackId: feedback.id,
        decision,
        autoDraftedCR: draftCr,
      }
    }

    return {
      feedbackId: feedback.id,
      decision,
      autoDraftedCR: null,
    }
  },
)
