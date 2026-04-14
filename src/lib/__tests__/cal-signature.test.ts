/**
 * Phase 20-01 — cal.com webhook HMAC-SHA256 signature verification.
 *
 * Covers D-13 (RESEARCH §"Verified: HMAC Webhook Signature Verification"):
 *   T1: valid hex signature over body returns true
 *   T2: tampered body (same sig) returns false
 *   T3: missing signature header returns false
 *   T4: wrong-length signature returns false (prevents timingSafeEqual crash)
 */

import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifyCalSignature } from '../cal-signature'

const SECRET = 'test-secret'
const BODY = '{"hello":"world"}'

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex')
}

describe('verifyCalSignature', () => {
  it('T1: returns true for a valid hex signature over the exact body', () => {
    const sig = sign(BODY, SECRET)
    expect(verifyCalSignature(BODY, sig, SECRET)).toBe(true)
  })

  it('T2: returns false when the body has been tampered with (same sig)', () => {
    const sig = sign(BODY, SECRET)
    const tamperedBody = '{"hello":"evil"}'
    expect(verifyCalSignature(tamperedBody, sig, SECRET)).toBe(false)
  })

  it('T3: returns false when the signature header is missing (null / empty)', () => {
    expect(verifyCalSignature(BODY, null, SECRET)).toBe(false)
    expect(verifyCalSignature(BODY, '', SECRET)).toBe(false)
  })

  it('T4: returns false when the signature is the wrong length (prevents timingSafeEqual crash)', () => {
    // Valid hex but wrong byte-length — must short-circuit before timingSafeEqual.
    const shortSig = 'deadbeef'
    expect(() => verifyCalSignature(BODY, shortSig, SECRET)).not.toThrow()
    expect(verifyCalSignature(BODY, shortSig, SECRET)).toBe(false)
  })

  it('T4b: returns false when the signature is not valid hex', () => {
    const junk = 'not-hex-at-all-zzzzzzzzzzz'
    expect(() => verifyCalSignature(BODY, junk, SECRET)).not.toThrow()
    expect(verifyCalSignature(BODY, junk, SECRET)).toBe(false)
  })

  it('returns false when the secret is empty', () => {
    const sig = sign(BODY, SECRET)
    expect(verifyCalSignature(BODY, sig, '')).toBe(false)
  })
})
