import { helloFn } from './hello'
import { feedbackReviewedFn } from './feedback-reviewed'
import { notificationDispatchFn } from './notification-dispatch'
import { workshopCompletedFn } from './workshop-completed'
import { workshopRecordingProcessedFn } from './workshop-recording-processed'
import { evidencePackExportFn } from './evidence-pack-export'
import { participateIntakeFn } from './participate-intake'
import { workshopRegistrationReceivedFn } from './workshop-registration-received'
import { workshopFeedbackInviteFn } from './workshop-feedback-invite'
import { workshopRemindersScheduledFn } from './workshop-reminders-scheduled'
import { consultationSummaryGenerateFn } from './consultation-summary-generate'
import { milestoneReadyFn } from './milestone-ready'
import { versionAnchorFn } from './version-anchor'
import { userUpsertedFn } from './user-upserted'

/**
 * The array of Inngest functions mounted at /api/inngest.
 *
 * To add a new flow: create the function file in this directory, import it
 * here, and append it to the functions array below. The route handler at
 * app/api/inngest/route.ts imports this array and hands it to serve().
 *
 * I5: helloFn is a bootstrap smoke test. Keep it registered in
 * development/test environments; exclude it in production so the
 * `sample.hello` event surface isn't live in prod.
 */
export const functions = [
  // helloFn is dev/test only - guard against production registration.
  ...(process.env.NODE_ENV !== 'production' ? [helloFn] : []),
  feedbackReviewedFn,
  notificationDispatchFn,
  workshopCompletedFn,
  workshopRecordingProcessedFn,
  evidencePackExportFn,                // Phase 18
  participateIntakeFn,                 // Phase 19
  workshopRegistrationReceivedFn,      // Phase 20 Plan 04 - Clerk invite
  workshopFeedbackInviteFn,            // Phase 20 Plan 04 - feedback JWT email
  workshopRemindersScheduledFn,        // Pivot 2026-04-28 - replaces workshopCreatedFn (24h+1h reminder fan-out)
  consultationSummaryGenerateFn,       // Phase 21 LLM
  milestoneReadyFn,                    // Phase 23 VERIFY-06
  versionAnchorFn,                     // Phase 23 VERIFY-07
  userUpsertedFn,                      // P2 - Clerk webhook fan-out
]
