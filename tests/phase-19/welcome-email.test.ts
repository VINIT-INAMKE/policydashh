import { describe, it, expect, beforeAll } from 'vitest'

/**
 * Wave 0 RED contract for Plan 19-04:
 * `renderWelcomeEmail({ name, email, orgType })` must produce an HTML string
 * with 6 org-bucket variants (government / industry / legal / academia /
 * civil_society / internal), each containing the canonical audience phrase
 * and the CTA label appropriate to its flow (invitation vs direct sign-in).
 *
 * Strategy: variable-path dynamic import + @vite-ignore so Vite's import
 * analyzer does not crash on the missing
 * `src/lib/email-templates/welcome-email.ts` file.
 */

type RenderFn = (args: { name: string; email: string; orgType: string }) => Promise<string>

let renderWelcomeEmail: RenderFn | null = null

beforeAll(async () => {
  const segments = ['@', 'src', 'lib', 'email-templates', 'welcome-email']
  const modPath = segments.join('/')
  try {
    const mod = await import(/* @vite-ignore */ modPath)
    renderWelcomeEmail = ((mod as { renderWelcomeEmail?: RenderFn }).renderWelcomeEmail ??
      null) as RenderFn | null
  } catch {
    renderWelcomeEmail = null
  }
})

const base = { name: 'Alice Example', email: 'alice@test.org' }

describe('renderWelcomeEmail — 6 org-bucket variants', () => {
  it('RED: renderWelcomeEmail is importable', () => {
    expect(renderWelcomeEmail).not.toBeNull()
  })

  it('Test 3.1: government variant contains "government official"', async () => {
    expect(renderWelcomeEmail).not.toBeNull()
    const html = await renderWelcomeEmail!({ ...base, orgType: 'government' })
    expect(html.toLowerCase()).toContain('government official')
  })

  it('Test 3.2: industry variant contains "industry professional"', async () => {
    expect(renderWelcomeEmail).not.toBeNull()
    const html = await renderWelcomeEmail!({ ...base, orgType: 'industry' })
    expect(html.toLowerCase()).toContain('industry professional')
  })

  it('Test 3.3: legal variant contains "legal professional"', async () => {
    expect(renderWelcomeEmail).not.toBeNull()
    const html = await renderWelcomeEmail!({ ...base, orgType: 'legal' })
    expect(html.toLowerCase()).toContain('legal professional')
  })

  it('Test 3.4: academia variant contains "academic or researcher"', async () => {
    expect(renderWelcomeEmail).not.toBeNull()
    const html = await renderWelcomeEmail!({ ...base, orgType: 'academia' })
    expect(html.toLowerCase()).toContain('academic or researcher')
  })

  it('Test 3.5: civil_society variant contains "civil society representative"', async () => {
    expect(renderWelcomeEmail).not.toBeNull()
    const html = await renderWelcomeEmail!({ ...base, orgType: 'civil_society' })
    expect(html.toLowerCase()).toContain('civil society representative')
  })

  it('Test 3.6: internal variant contains "internal team member" AND CTA "Sign In to Dashboard"', async () => {
    expect(renderWelcomeEmail).not.toBeNull()
    const html = await renderWelcomeEmail!({ ...base, orgType: 'internal' })
    expect(html.toLowerCase()).toContain('internal team member')
    expect(html).toContain('Sign In to Dashboard')
  })

  it('Test 3.7: non-internal variants contain CTA "Accept Invitation & Sign In"', async () => {
    expect(renderWelcomeEmail).not.toBeNull()
    for (const orgType of ['government', 'industry', 'legal', 'academia', 'civil_society']) {
      const html = await renderWelcomeEmail!({ ...base, orgType })
      expect(html).toContain('Accept Invitation &amp; Sign In')
    }
  })

  it('Test 3.8: all variants contain hero line "You\u2019re in." or "You&apos;re in."', async () => {
    expect(renderWelcomeEmail).not.toBeNull()
    for (const orgType of [
      'government',
      'industry',
      'legal',
      'academia',
      'civil_society',
      'internal',
    ]) {
      const html = await renderWelcomeEmail!({ ...base, orgType })
      const hasHero =
        html.includes('You&apos;re in.') ||
        html.includes('You\u2019re in.') ||
        html.includes("You're in.")
      expect(hasHero).toBe(true)
    }
  })
})
