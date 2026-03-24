import 'server-only'
import { createTRPCContext, createCallerFactory } from './init'
import { appRouter } from '@/src/server/routers/_app'
import { headers } from 'next/headers'
import { cache } from 'react'

const createCaller = createCallerFactory(appRouter)

export const api = cache(async () => {
  const heads = new Headers(await headers())
  heads.set('x-trpc-source', 'rsc')
  return createCaller(await createTRPCContext({ headers: heads }))
})
