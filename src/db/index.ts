import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const dbUrl = process.env.DATABASE_URL!

// B7-1: in tests, `tests/setup.ts` populates DATABASE_URL with the
// placeholder `postgresql://test:test@db.test.invalid:5432/test` so that
// `neon()`'s lazy factory succeeds at module load. Any code path that
// accidentally reaches a real query against that URL would hang on DNS
// resolution. Wrap the drizzle client in a Proxy that throws on any
// access when the placeholder is active — the error fires the moment
// test code forgets to mock `@/src/db`, not 15 minutes into a DNS-stall
// retry loop.
function buildDb() {
  if (
    process.env.NODE_ENV === 'test' &&
    typeof dbUrl === 'string' &&
    dbUrl.includes('db.test.invalid')
  ) {
    const guard = new Proxy(
      {},
      {
        get(_t, prop: string | symbol) {
          // Let `typeof db` and similar probes work — drizzle's internal
          // wiring may introspect symbols at import time.
          if (typeof prop === 'symbol') return undefined
          throw new Error(
            `[src/db] test placeholder DATABASE_URL reached a real query (.${String(prop)}) — mock @/src/db in your test file`,
          )
        },
      },
    )
    return guard as unknown as ReturnType<typeof drizzle<typeof schema>>
  }
  const sql = neon(dbUrl)
  return drizzle(sql, { schema })
}

export const db = buildDb()
