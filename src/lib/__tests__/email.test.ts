/**
 * Wave 0 RED contract for EV-07 - sendEvidencePackReadyEmail.
 *
 * Targets the helper added to src/lib/email.ts in Plan 18-01. Mirrors the
 * existing email helper shape (sendWorkshopEvidenceNudgeEmail in src/lib/email.ts):
 *
 *   - Silent no-op when `to` is null/undefined.
 *   - Silent no-op when RESEND_API_KEY is unset (`resend` singleton is null).
 *   - When configured, calls `resend.emails.send` with from=FROM_ADDRESS, the
 *     supplied recipient, an "Evidence pack ready"-style subject, and a text
 *     body containing the downloadUrl + fileCount.
 *   - When `degraded: true`, surfaces a partial-delivery hint in the body.
 *
 * Implementation strategy: vi.mock the `resend` package at module level so
 * the singleton constructed at top of src/lib/email.ts uses our spy. Use
 * vi.stubEnv + vi.resetModules between tests so the env-driven `resend`
 * constant is re-evaluated per case.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const sendMock = vi.fn().mockResolvedValue({ id: 'mock' })

// Vitest v4 requires a `function` (or class) - not an arrow - inside
// mockImplementation when the mock is used with `new`. See
// https://vitest.dev/api/vi#vi-spyon. Wave 0 test factory predated v4 and
// used an arrow; Plan 18-01 (Rule 3 blocker fix) converts to a function.
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: sendMock } }
  }),
}))

describe('sendEvidencePackReadyEmail', () => {
  beforeEach(() => {
    sendMock.mockClear()
  })

  it('is a silent no-op when to is null', async () => {
    vi.stubEnv('RESEND_API_KEY', 'fake-key')
    vi.resetModules()
    const mod: any = await import('@/src/lib/email')
    expect(mod.sendEvidencePackReadyEmail).toBeDefined()
    await mod.sendEvidencePackReadyEmail(null, {
      documentTitle: 'T',
      downloadUrl: 'u',
      fileCount: 1,
      totalSizeBytes: 1,
      expiresAt: 'x',
    })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('is a silent no-op when RESEND_API_KEY is unset', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.resetModules()
    const mod: any = await import('@/src/lib/email')
    expect(mod.sendEvidencePackReadyEmail).toBeDefined()
    await mod.sendEvidencePackReadyEmail('u@example.com', {
      documentTitle: 'T',
      downloadUrl: 'u',
      fileCount: 1,
      totalSizeBytes: 1,
      expiresAt: 'x',
    })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('calls Resend with full payload (recipient, subject, body containing downloadUrl + fileCount)', async () => {
    vi.stubEnv('RESEND_API_KEY', 'fake-key')
    vi.resetModules()
    const mod: any = await import('@/src/lib/email')
    expect(mod.sendEvidencePackReadyEmail).toBeDefined()
    await mod.sendEvidencePackReadyEmail('u@example.com', {
      documentTitle: 'Privacy Policy',
      downloadUrl: 'https://r2.example.com/evidence-packs/abc.zip?sig=xyz',
      fileCount: 12,
      totalSizeBytes: 1048576,
      expiresAt: '2026-04-15T08:00:00Z',
    })
    expect(sendMock).toHaveBeenCalledTimes(1)
    const call = sendMock.mock.calls[0][0] as any
    expect(call.to).toBe('u@example.com')
    expect(String(call.subject).toLowerCase()).toContain('evidence pack')
    expect(String(call.text)).toContain('https://r2.example.com/evidence-packs/abc.zip?sig=xyz')
    expect(String(call.text)).toContain('12') // fileCount surfaces in body
  })

  it('notes degraded mode in body when degraded: true', async () => {
    vi.stubEnv('RESEND_API_KEY', 'fake-key')
    vi.resetModules()
    const mod: any = await import('@/src/lib/email')
    expect(mod.sendEvidencePackReadyEmail).toBeDefined()
    await mod.sendEvidencePackReadyEmail('u@example.com', {
      documentTitle: 'T',
      downloadUrl: 'u',
      fileCount: 1,
      totalSizeBytes: 1,
      expiresAt: 'x',
      degraded: true,
    })
    expect(sendMock).toHaveBeenCalledTimes(1)
    const call = sendMock.mock.calls[0][0] as any
    expect(String(call.text).toLowerCase()).toMatch(/unavailable|degraded|partial|some files/)
  })
})
