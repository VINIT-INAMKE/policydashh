import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Phase 28 Wave 0 — RED contract for proxy.ts /api/research(.*) matcher.
 *
 * Plan 28-04 Task 2 must append '/api/research(.*)' to createRouteMatcher
 * with a Phase 28 comment header naming RESEARCH-10. The existing
 * '/research(.*)' matcher (added in Phase 20.5 for the page routes) does
 * NOT cover the API namespace — confirmed in Phase 28 RESEARCH.md
 * §Presigned Download Strategy.
 *
 * Static string-match test; does NOT execute proxy.ts (Phase 20.5 pattern).
 *
 * Authentically RED today: proxy.ts contains '/research(.*)' (passes assertion 3)
 * but lacks '/api/research(.*)' and the Phase 28 comment header (assertions 1+2 fail).
 * This locks Plan 28-04 work.
 */

describe('proxy.ts — Phase 28 /api/research(.*) matcher', () => {
  const src = readFileSync(path.join(process.cwd(), 'proxy.ts'), 'utf8')

  it("includes '/api/research(.*)' in createRouteMatcher", () => {
    expect(src).toContain("'/api/research(.*)'")
  })

  it('includes Phase 28 comment header naming RESEARCH-10', () => {
    expect(src).toMatch(/\/\/ Phase 28[\s\S]*RESEARCH-10/)
  })

  it("preserves existing '/research(.*)' matcher (covers listing + detail pages)", () => {
    expect(src).toContain("'/research(.*)'")
  })
})
