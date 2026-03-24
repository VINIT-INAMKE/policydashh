import { router } from '@/src/trpc/init'
import { userRouter } from './user'
import { auditRouter } from './audit'
import { documentRouter } from './document'

export const appRouter = router({
  user: userRouter,
  audit: auditRouter,
  document: documentRouter,
})

export type AppRouter = typeof appRouter
