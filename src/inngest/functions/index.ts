import { helloFn } from './hello'
import { feedbackReviewedFn } from './feedback-reviewed'
import { notificationDispatchFn } from './notification-dispatch'
import { workshopCompletedFn } from './workshop-completed'
import { workshopRecordingProcessedFn } from './workshop-recording-processed'
import { evidencePackExportFn } from './evidence-pack-export'
import { participateIntakeFn } from './participate-intake'
import { workshopCreatedFn } from './workshop-created'
import { workshopRegistrationReceivedFn } from './workshop-registration-received'
import { workshopFeedbackInviteFn } from './workshop-feedback-invite'
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
  evidencePackExportFn, // Phase 18
  participateIntakeFn,  // Phase 19
  workshopCreatedFn,    // Phase 20 Plan 02 - cal.com event-type provisioning
  workshopRegistrationReceivedFn,  // Phase 20 Plan 04 - Clerk invite (F28: confirmation email dropped)
  workshopFeedbackInviteFn,  // Phase 20 Plan 04 - post-workshop feedback JWT deep-link email
  consultationSummaryGenerateFn, // Phase 21 LLM-04/05/06/08 - per-section consultation summary via llama-3.3-70b-versatile
  milestoneReadyFn,     // Phase 23 VERIFY-06 - milestoneReady 5-step Cardano anchor
  versionAnchorFn,      // Phase 23 VERIFY-07 - per-version Cardano anchor on version.published
  userUpsertedFn,       // P2 - Clerk webhook fan-out (audit + workshop reg backfill)
]
