import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verify a cal.com webhook signature.
 *
 * Cal.com signs outbound webhook bodies with HMAC-SHA256 using the secret
 * registered against the webhook. The hex-encoded digest is sent in the
 * `X-Cal-Signature-256` header (HTTP-case-insensitive; Next.js request headers
 * surface it as `x-cal-signature-256`). The signature covers the exact raw
 * request body bytes, so callers MUST read `await req.text()` BEFORE any
 * `JSON.parse` and pass that string verbatim.
 *
 * Implementation notes:
 *   - Node's `crypto.createHmac('sha256', secret)` produces the expected digest.
 *   - `crypto.timingSafeEqual` is used for constant-time comparison to defuse
 *     timing attacks. It throws on mismatched buffer lengths, so we guard with
 *     an explicit length check AND wrap hex parsing in try/catch - a malformed
 *     (non-hex or wrong-length) header must return `false`, never throw.
 *   - Empty / missing signature, empty secret, or zero-length hex buffer all
 *     short-circuit to `false`.
 *
 * References: 20-RESEARCH.md §"Verified: HMAC Webhook Signature Verification",
 * D-13, WS-09. Used by `app/api/webhooks/cal/route.ts` in Plan 20-03.
 */
export function verifyCalSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false

  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')

  let sigBuf: Buffer
  let expBuf: Buffer
  try {
    sigBuf = Buffer.from(signatureHeader.trim(), 'hex')
    expBuf = Buffer.from(expected, 'hex')
  } catch {
    return false
  }

  // Buffer.from(hex) silently drops invalid characters, so a non-hex input
  // can decode to a shorter-than-expected buffer. The explicit length guard
  // catches BOTH that case and legitimate-hex-but-wrong-length inputs before
  // timingSafeEqual throws on buffer length mismatch.
  if (sigBuf.length === 0 || sigBuf.length !== expBuf.length) return false

  return timingSafeEqual(sigBuf, expBuf)
}
