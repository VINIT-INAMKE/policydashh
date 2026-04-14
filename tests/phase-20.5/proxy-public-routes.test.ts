import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Phase 20.5 Wave 0 — RED contract for D-17 proxy.ts public-route matcher.
 *
 * Locks that Plan 20.5-03 adds '/research(.*)' and '/framework(.*)' to the
 * createRouteMatcher call in proxy.ts, gated behind a Phase 20.5 comment
 * header naming PUB-06, PUB-07, PUB-08.
 *
 * This is a static string-match test; it does NOT execute proxy.ts.
 */

describe('proxy.ts public-route matcher — D-17', () => {
  const src = readFileSync(path.join(process.cwd(), 'proxy.ts'), 'utf8')

  it("includes '/research(.*)' in createRouteMatcher", () => {
    expect(src).toContain("'/research(.*)'")
  })

  it("includes '/framework(.*)' in createRouteMatcher and Phase 20.5 comment header", () => {
    expect(src).toContain("'/framework(.*)'")
    expect(src).toMatch(/\/\/ Phase 20\.5[\s\S]*PUB-06[\s\S]*PUB-07[\s\S]*PUB-08/)
  })
})
