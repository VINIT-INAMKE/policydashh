import { router } from '@/src/trpc/init'
import { userRouter } from './user'
import { auditRouter } from './audit'

export const appRouter = router({
  user: userRouter,
  audit: auditRouter,
})

export type AppRouter = typeof appRouter
