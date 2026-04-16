import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Lightweight HS256 JWT for post-workshop feedback deep-links.
 *
 * Why Node crypto instead of jose/jsonwebtoken:
 *   - Neither library is a dependency of this project; adding one just for
 *     this single use-case costs bundle bytes without a functional win.
 *   - The token is short-lived (14 days), single-purpose (gate access to the
 *     post-workshop feedback form on `/participate?workshopId=...&token=...`),
 *     and only ever validated server-side with our own secret.
 *   - HS256 via `crypto.createHmac` is standard and well-understood.
 *
 * Payload shape ties the token to a specific workshop + email + expiry. The
 * verify path requires the caller to pass the workshopId it expects (e.g.
 * parsed from the `/participate` query string), so a stolen token for
 * workshop A cannot be replayed against workshop B.
 *
 * References: 20-CONTEXT.md D-17, 20-RESEARCH.md §"Verified: Feedback Token
 * Sign/Verify". Consumed by Plan 20-04/20-06 (feedback mode switch + submit).
 */
export interface FeedbackTokenPayload {
  workshopId: string
  email: string
  /** Seconds since epoch. */
  exp: number
  /** Seconds since epoch. */
  iat: number
}

const FOURTEEN_DAYS_SECONDS = 14 * 24 * 60 * 60

function getSecret(): string {
  const secret = process.env.WORKSHOP_FEEDBACK_JWT_SECRET
  if (!secret) throw new Error('WORKSHOP_FEEDBACK_JWT_SECRET not set')
  return secret
}

/**
 * Sign a feedback-access token. `exp` is fixed at 14 days from now per D-17.
 *
 * Throws if `WORKSHOP_FEEDBACK_JWT_SECRET` is missing - callers MUST run
 * inside a server context (route handler, Inngest step) where the env is set.
 */
export function signFeedbackToken(workshopId: string, email: string): string {
  const secret = getSecret()
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + FOURTEEN_DAYS_SECONDS
  const payload: FeedbackTokenPayload = { workshopId, email, exp, iat }

  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url')

  return `${header}.${body}.${sig}`
}

/**
 * Verify a feedback-access token. Returns the decoded payload on success,
 * or `null` on ANY failure (bad structure, bad signature, expired, wrong
 * workshopId, missing secret, or empty token). Never throws - public-route
 * callers must always get a boolean-ish result.
 *
 * Defence-in-depth:
 *   - Constant-time signature comparison via `timingSafeEqual` (wrapped in a
 *     length check so mismatched-buffer-length inputs return null instead of
 *     throwing at the Node layer).
 *   - `payload.workshopId !== expectedWorkshopId` rejection prevents replay
 *     of a valid-for-workshop-A token against workshop B.
 *   - `payload.exp < now` rejection honours the 14-day expiry window.
 */
export function verifyFeedbackToken(
  token: string,
  expectedWorkshopId: string,
): FeedbackTokenPayload | null {
  const secret = process.env.WORKSHOP_FEEDBACK_JWT_SECRET
  if (!secret || !token) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts

  const expectedSig = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url')

  let sigBuf: Buffer
  let expBuf: Buffer
  try {
    sigBuf = Buffer.from(sig, 'base64url')
    expBuf = Buffer.from(expectedSig, 'base64url')
  } catch {
    return null
  }

  if (sigBuf.length === 0 || sigBuf.length !== expBuf.length) return null
  if (!timingSafeEqual(sigBuf, expBuf)) return null

  try {
    const decoded = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as FeedbackTokenPayload
    if (typeof decoded.exp !== 'number' || typeof decoded.iat !== 'number') return null
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null
    if (decoded.workshopId !== expectedWorkshopId) return null
    return decoded
  } catch {
    return null
  }
}
