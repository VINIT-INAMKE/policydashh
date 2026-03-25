import { createRouteHandler } from 'uploadthing/next'
import { ourFileRouter } from './core'

/**
 * Uploadthing API route handler.
 * Exports GET and POST handlers per Next.js 16 App Router convention.
 */
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
})
