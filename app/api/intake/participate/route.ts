/**
 * POST /api/intake/participate - Public intake endpoint (Phase 19).
 *
 * Flow (INTAKE-01, INTAKE-02, INTAKE-03, INTAKE-07):
 *   1. Parse + validate body with Zod (INTAKE-01 schema).
 *   2. Verify Cloudflare Turnstile token server-side BEFORE any further work
 *      (INTAKE-02 - Pitfall 2 in 19-RESEARCH.md: never touch Clerk/DB before
 *      verify, or bots can enumerate / exhaust quota).
 *   3. Hash email with SHA-256 to produce `emailHash` - the stable rate-limit
 *      key for the Inngest function (raw email MUST NOT be the rate limit key).
 *   4. Fire `participate.intake` Inngest event and return 200 immediately.
 *      Clerk invite + welcome email happen in `participateIntakeFn`.
 *
 * Public by proxy.ts `isPublicRoute` whitelist (added in Plan 19-05).
 * No audit log write - public unauthenticated actions have no actorId.
 */

import { createHash } from 'node:crypto'
import { z } from 'zod'
import { sendParticipateIntake } from '@/src/inngest/events'
import { consume, getClientIp } from '@/src/lib/rate-limit'
import { verifyTurnstile } from '@/src/lib/turnstile'

const bodySchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  // Option C (migration 0028): the intake form used to ask the user to pick
  // their "role" from the same enum as orgType, which was redundant. Now it
  // asks for a free-text designation/title (e.g. "Partner, Fintech Practice")
  // which is actually useful signal for the stakeholder directory.
  designation: z.string().min(2).max(200),
  orgType: z.enum(['government', 'industry', 'legal', 'academia', 'civil_society', 'internal']),
  orgName: z.string().min(2).max(200),
  expertise: z.string().min(20).max(1000),
  howHeard: z.string().max(100).optional(),
  turnstileToken: z.string().min(1),
})

type ParseFail = { ok: false; status: 400 }
type ParseOk = { ok: true; data: z.infer<typeof bodySchema> }

// B10: request body cap. The Zod schema bounds every field (name 120,
// email ~254, expertise 1000, orgName 200, etc.) so legit payloads max
// out well under 16KB. We gate at 64KB to give the turnstile token
// + FormData headroom while still rejecting pathological JSON.
const MAX_BODY_BYTES = 64 * 1024

async function parseBody(req: Request): Promise<ParseFail | ParseOk> {
  const json = await req.json().catch(() => null)
  if (!json) return { ok: false, status: 400 }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return { ok: false, status: 400 }
  return { ok: true, data: parsed.data }
}

export async function POST(request: Request): Promise<Response> {
  // B10: short-circuit oversized payloads before JSON parsing so a
  // malicious client can't exhaust the parser with a 100MB body.
  const contentLength = request.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return Response.json({ error: 'Payload too large' }, { status: 413 })
  }

  // S1 / P22: per-IP rate limit before any parsing or Turnstile verify.
  // 20 req / 5 min mirrors the workshop-register ceiling. Defuses burst
  // abuse at the transport layer before we touch Turnstile quota, Clerk
  // invite APIs, or the Inngest rate-limit step inside participateIntakeFn.
  const ip = getClientIp(request)
  const ipLimit = consume(`participate-intake:ip:${ip}`, {
    max: 20,
    windowMs: 5 * 60_000,
  })
  if (!ipLimit.ok) {
    return Response.json(
      { error: 'Too many requests. Try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.max(
            1,
            Math.ceil((ipLimit.resetAt - Date.now()) / 1000),
          ).toString(),
        },
      },
    )
  }

  const parsed = await parseBody(request)
  if (!parsed.ok) {
    return Response.json({ error: 'Invalid input' }, { status: 400 })
  }
  const { data } = parsed

  // S1: per-email rate limit (5 req / 10 min) keyed on email-hash so an
  // attacker rotating IPs cannot still spam the same inbox through the
  // Inngest pipeline. Matches the workshop-register/email pattern.
  const emailHash = createHash('sha256')
    .update(data.email.toLowerCase().trim())
    .digest('hex')
  const emailLimit = consume(`participate-intake:email:${emailHash}`, {
    max: 5,
    windowMs: 10 * 60_000,
  })
  if (!emailLimit.ok) {
    return Response.json(
      { error: 'Too many attempts for this email. Try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.max(
            1,
            Math.ceil((emailLimit.resetAt - Date.now()) / 1000),
          ).toString(),
        },
      },
    )
  }

  // Step 1: Verify Turnstile BEFORE any Clerk / DB work. INTAKE-02 + Pitfall 2.
  const ts = await verifyTurnstile(data.turnstileToken, request)
  if (!ts.success) {
    return Response.json({ error: 'Security check failed' }, { status: 403 })
  }

  // Step 3: Fire Inngest event. Rate limit + Clerk + welcome email all run
  // inside participateIntakeFn (src/inngest/functions/participate-intake.ts).
  // Option C: forward orgName + designation so the worker stashes them on the
  // Clerk invitation publicMetadata; the webhook then hydrates the users row
  // on invitation-accept (migration 0028).
  try {
    await sendParticipateIntake({
      emailHash,
      email: data.email,
      name: data.name,
      orgType: data.orgType,
      expertise: data.expertise,
      howHeard: data.howHeard,
      orgName: data.orgName,
      designation: data.designation,
    })
  } catch (err) {
    // Inngest send failure is a real server error - surface generically.
    console.error('[participate] sendParticipateIntake failed', err)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }

  // Same success shape for new + existing users - no info leak (INTAKE-06).
  return Response.json({ success: true }, { status: 200 })
}
