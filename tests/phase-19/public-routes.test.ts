import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Wave 0 RED contract for Plan 19-05:
 * `proxy.ts`'s Clerk `createRouteMatcher` whitelist must include
 *   - `/participate(.*)`            (public intake page + static assets)
 *   - `/api/intake(.*)` or `/api/intake/participate(.*)`  (POST endpoint)
 *
 * Strategy: read proxy.ts from disk as text and regex-match; no dynamic
 * import needed because the target file already exists - we only assert the
 * NEW entries that Plan 19-05 must add.
 */

describe('proxy.ts isPublicRoute whitelist', () => {
  const proxySource = readFileSync(resolve(process.cwd(), 'proxy.ts'), 'utf8')

  it('Test 4.1: includes /participate(.*) literal in the createRouteMatcher array', () => {
    expect(proxySource).toMatch(/['"]\/participate\(\.\*\)['"]/)
  })

  it('Test 4.2: includes /api/intake(.*) or /api/intake/participate(.*) so the submit endpoint is public', () => {
    const hasIntake =
      /['"]\/api\/intake\(\.\*\)['"]/.test(proxySource) ||
      /['"]\/api\/intake\/participate\(\.\*\)['"]/.test(proxySource)
    expect(hasIntake).toBe(true)
  })
})
