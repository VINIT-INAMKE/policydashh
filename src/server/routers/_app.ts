import { router } from '@/src/trpc/init'

export const appRouter = router({
  // Routers added in Plan 03
})

export type AppRouter = typeof appRouter
