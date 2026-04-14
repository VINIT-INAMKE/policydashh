import { helloFn } from './hello'
import { feedbackReviewedFn } from './feedback-reviewed'
import { notificationDispatchFn } from './notification-dispatch'
import { workshopCompletedFn } from './workshop-completed'
import { workshopRecordingProcessedFn } from './workshop-recording-processed'
import { evidencePackExportFn } from './evidence-pack-export'
import { participateIntakeFn } from './participate-intake'
import { workshopCreatedFn } from './workshop-created'

/**
 * The array of Inngest functions mounted at /api/inngest.
 *
 * To add a new flow: create the function file in this directory, import it
 * here, and append it to the functions array below. The route handler at
 * app/api/inngest/route.ts imports this array and hands it to serve().
 */
export const functions = [
  helloFn,
  feedbackReviewedFn,
  notificationDispatchFn,
  workshopCompletedFn,
  workshopRecordingProcessedFn,
  evidencePackExportFn, // Phase 18
  participateIntakeFn,  // Phase 19
  workshopCreatedFn,    // Phase 20 Plan 02 — cal.com event-type provisioning
]
