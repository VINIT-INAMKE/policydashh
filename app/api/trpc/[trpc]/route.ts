import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '@/src/server/routers/_app'
import { createTRPCContext } from '@/src/trpc/init'

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
  })

export { handler as GET, handler as POST }
