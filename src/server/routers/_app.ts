import { router } from '@/src/trpc/init'
import { userRouter } from './user'
import { auditRouter } from './audit'
import { documentRouter } from './document'
import { feedbackRouter } from './feedback'
import { sectionAssignmentRouter } from './sectionAssignment'
import { evidenceRouter } from './evidence'

export const appRouter = router({
  user: userRouter,
  audit: auditRouter,
  document: documentRouter,
  feedback: feedbackRouter,
  sectionAssignment: sectionAssignmentRouter,
  evidence: evidenceRouter,
})

export type AppRouter = typeof appRouter
