import { router } from '@/src/trpc/init'
import { userRouter } from './user'
import { auditRouter } from './audit'
import { documentRouter } from './document'
import { feedbackRouter } from './feedback'
import { sectionAssignmentRouter } from './sectionAssignment'
import { evidenceRouter } from './evidence'
import { changeRequestRouter } from './changeRequest'
import { versionRouter } from './version'
import { traceabilityRouter } from './traceability'
import { notificationRouter } from './notification'
import { workshopRouter } from './workshop'
import { consultationSummaryRouter } from './consultation-summary'
import { milestoneRouter } from './milestone'
import { researchRouter } from './research'

export const appRouter = router({
  user: userRouter,
  audit: auditRouter,
  document: documentRouter,
  feedback: feedbackRouter,
  sectionAssignment: sectionAssignmentRouter,
  evidence: evidenceRouter,
  changeRequest: changeRequestRouter,
  version: versionRouter,
  consultationSummary: consultationSummaryRouter,
  traceability: traceabilityRouter,
  notification: notificationRouter,
  workshop: workshopRouter,
  milestone: milestoneRouter,
  research: researchRouter,
})

export type AppRouter = typeof appRouter
