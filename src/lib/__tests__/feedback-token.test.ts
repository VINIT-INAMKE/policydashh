/**
 * Phase 20-01 - feedback-token sign/verify unit tests (HS256 via Node crypto).
 *
 * Covers D-17 (RESEARCH §"Verified: Feedback Token Sign/Verify"):
 *   T5: signFeedbackToken + verifyFeedbackToken round-trips the payload
 *   T6: expired token (exp in past) → null
 *   T7: wrong expectedWorkshopId → null
 *   T8: tampered signature → null
 *   T9: wrong secret → null
 *
 * No jose/jsonwebtoken dependency is present - implementation uses
 * `crypto.createHmac` and `crypto.timingSafeEqual` only.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { signFeedbackToken, verifyFeedbackToken } from '../feedback-token'

const WORKSHOP_ID = '11111111-1111-4111-8111-111111111111'
const EMAIL = 'alice@example.com'
const SECRET = 'test-secret-32-bytes-minimum-abc!'

describe('feedback-token (HS256 via Node crypto)', () => {
  beforeEach(() => {
    vi.stubEnv('WORKSHOP_FEEDBACK_JWT_SECRET', SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('T5: signFeedbackToken + verifyFeedbackToken round-trip returns original payload', () => {
    const token = signFeedbackToken(WORKSHOP_ID, EMAIL)
    const payload = verifyFeedbackToken(token, WORKSHOP_ID)
    expect(payload).not.toBeNull()
    expect(payload?.workshopId).toBe(WORKSHOP_ID)
    expect(payload?.email).toBe(EMAIL)
    expect(typeof payload?.iat).toBe('number')
    expect(typeof payload?.exp).toBe('number')
    // 14-day expiry per D-17
    expect((payload?.exp ?? 0) - (payload?.iat ?? 0)).toBe(14 * 24 * 60 * 60)
  })

  it('T6: expired token (exp in past) returns null', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const token = signFeedbackToken(WORKSHOP_ID, EMAIL)
    // Jump 15 days forward - token's 14d expiry has passed.
    vi.setSystemTime(new Date('2026-01-16T00:00:00Z'))
    expect(verifyFeedbackToken(token, WORKSHOP_ID)).toBeNull()
  })

  it('T7: wrong expectedWorkshopId returns null', () => {
    const token = signFeedbackToken(WORKSHOP_ID, EMAIL)
    const other = '22222222-2222-4222-8222-222222222222'
    expect(verifyFeedbackToken(token, other)).toBeNull()
  })

  it('T8: tampered signature returns null', () => {
    const token = signFeedbackToken(WORKSHOP_ID, EMAIL)
    const [header, body] = token.split('.')
    // Replace signature with a plausible-looking base64url value of wrong bytes.
    const tampered = `${header}.${body}.AAAA_AAAA_AAAA_AAAA_AAAA_AAAA_AAAA_AAAA_AAAA`
    expect(verifyFeedbackToken(tampered, WORKSHOP_ID)).toBeNull()
  })

  it('T8b: tampered body (recomputed to look valid) returns null under the original signature', () => {
    const token = signFeedbackToken(WORKSHOP_ID, EMAIL)
    const parts = token.split('.')
    // Flip one character in the body and keep the original signature - HMAC must fail.
    const flipped = parts[1].slice(0, -1) + (parts[1].slice(-1) === 'A' ? 'B' : 'A')
    expect(verifyFeedbackToken(`${parts[0]}.${flipped}.${parts[2]}`, WORKSHOP_ID)).toBeNull()
  })

  it('T9: token signed with one secret fails verification under a different secret', () => {
    const token = signFeedbackToken(WORKSHOP_ID, EMAIL)
    // Change the secret so verify runs HMAC under a different key.
    vi.stubEnv('WORKSHOP_FEEDBACK_JWT_SECRET', 'a-totally-different-secret-value!')
    expect(verifyFeedbackToken(token, WORKSHOP_ID)).toBeNull()
  })

  it('malformed tokens (not 3 parts) return null', () => {
    expect(verifyFeedbackToken('only.two', WORKSHOP_ID)).toBeNull()
    expect(verifyFeedbackToken('', WORKSHOP_ID)).toBeNull()
  })
})
