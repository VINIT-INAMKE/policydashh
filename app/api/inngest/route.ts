import { serve } from 'inngest/next'
import { inngest } from '@/src/inngest/client'
import { functions } from '@/src/inngest/functions'

/**
 * Inngest HTTP entry point.
 *
 * Inngest Cloud calls this route to (a) discover the list of functions at
 * deploy time, (b) deliver events to the appropriate function handler at
 * runtime. Locally, the Inngest Dev Server polls GET /api/inngest to
 * discover functions and POSTs here to trigger runs.
 *
 * This file should stay a three-line glue file — the client lives in
 * src/inngest/client.ts and functions are added to the barrel at
 * src/inngest/functions/index.ts.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
})
