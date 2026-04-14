import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

/**
 * Wave 0 RED contract for Plan 19-01 / 19-02:
 * POST /api/intake/participate route must
 *   - validate body via zod (turnstileToken required, orgType enum)
 *   - POST the token to Cloudflare /siteverify
 *   - on success=false: return 403 without firing the Inngest event
 *   - on success=true: compute SHA-256(emailHash) and fire sendParticipateIntake
 *
 * Strategy: vi.hoisted mocks + variable-path dynamic import in beforeAll to
 * bypass Vite's static import-analysis walker (module does not exist yet).
 */

const mocks = vi.hoisted(() => ({
  sendParticipateIntake: vi.fn().mockResolvedValue(undefined),
  verifyTurnstile: vi.fn(),
  fetchMock: vi.fn(),
}))

vi.mock('@/src/inngest/events', () => ({
  sendParticipateIntake: mocks.sendParticipateIntake,
}))

// Stub global fetch for Turnstile /siteverify
vi.stubGlobal('fetch', mocks.fetchMock)

let POST: ((req: Request) => Promise<Response>) | null = null

beforeAll(async () => {
  const segments = ['@', 'app', 'api', 'intake', 'participate', 'route']
  const modPath = segments.join('/')
  try {
    const mod = await import(/* @vite-ignore */ modPath)
    POST = (mod as { POST?: (req: Request) => Promise<Response> }).POST ?? null
  } catch {
    POST = null
  }
})

beforeEach(() => {
  mocks.sendParticipateIntake.mockClear()
  mocks.fetchMock.mockReset()
})

const validBody = {
  name: 'Dr. Priya Sharma',
  email: 'priya@ministry.gov.in',
  role: 'government',
  orgType: 'government',
  orgName: 'Ministry of Electronics and IT',
  expertise: 'Digital policy and data protection frameworks for India.',
  howHeard: 'Colleague / referral',
  turnstileToken: 'XXXX.DUMMY.TOKEN',
}

describe('POST /api/intake/participate', () => {
  it('RED: module is importable', () => {
    expect(POST).not.toBeNull()
  })

  it('Test 1.1: rejects missing turnstileToken with 400', async () => {
    expect(POST).not.toBeNull()
    const { turnstileToken: _omit, ...rest } = validBody
    void _omit
    const req = new Request('http://test/api/intake/participate', {
      method: 'POST',
      body: JSON.stringify(rest),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST!(req)
    expect(res.status).toBe(400)
    expect(mocks.sendParticipateIntake).not.toHaveBeenCalled()
  })

  it('Test 1.2: Turnstile failure returns 403 and does NOT fire event', async () => {
    expect(POST).not.toBeNull()
    mocks.fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: false }), { status: 200 }),
    )
    const req = new Request('http://test/api/intake/participate', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST!(req)
    expect(res.status).toBe(403)
    expect(mocks.sendParticipateIntake).not.toHaveBeenCalled()
  })

  it('Test 1.3: Turnstile success returns 200 and fires event exactly once', async () => {
    expect(POST).not.toBeNull()
    mocks.fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    )
    const req = new Request('http://test/api/intake/participate', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST!(req)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { success: boolean }
    expect(json.success).toBe(true)
    expect(mocks.sendParticipateIntake).toHaveBeenCalledTimes(1)
  })

  it('Test 1.4: emailHash is SHA-256 hex (64 chars lowercase) of lowercased email', async () => {
    expect(POST).not.toBeNull()
    mocks.fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    )
    const req = new Request('http://test/api/intake/participate', {
      method: 'POST',
      body: JSON.stringify(validBody),
      headers: { 'content-type': 'application/json' },
    })
    await POST!(req)
    const call = mocks.sendParticipateIntake.mock.calls[0][0] as { emailHash: string }
    expect(call.emailHash).toMatch(/^[0-9a-f]{64}$/)
    // Known SHA-256 of 'priya@ministry.gov.in'
    const { createHash } = await import('node:crypto')
    const expected = createHash('sha256').update('priya@ministry.gov.in').digest('hex')
    expect(call.emailHash).toBe(expected)
  })

  it('Test 1.5: invalid orgType enum → 400', async () => {
    expect(POST).not.toBeNull()
    const bad = { ...validBody, orgType: 'unknown-bucket' }
    const req = new Request('http://test/api/intake/participate', {
      method: 'POST',
      body: JSON.stringify(bad),
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST!(req)
    expect(res.status).toBe(400)
  })
})
