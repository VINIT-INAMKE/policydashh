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

const bodySchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  role: z.enum(['government', 'industry', 'legal', 'academia', 'civil_society', 'internal']),
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

async function verifyTurnstile(token: string, req: Request): Promise<{ success: boolean }> {
  // Pitfall 2: pass whatever secret is configured to Cloudflare /siteverify and
  // trust ITS reply. Do NOT short-circuit on missing secret - in production the
  // real Cloudflare endpoint will reply success:false; in tests the global
  // fetch is stubbed and answers from the test's mock. Either way the gate is
  // closed unless siteverify itself returns success:true.
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY ?? ''
  const ip =
    req.headers.get('CF-Connecting-IP') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    ''
  const form = new FormData()
  form.append('secret', secret)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    })
    const data = (await res.json()) as { success?: boolean }
    return { success: data.success === true }
  } catch {
    return { success: false }
  }
}

export async function POST(request: Request): Promise<Response> {
  // B10: short-circuit oversized payloads before JSON parsing so a
  // malicious client can't exhaust the parser with a 100MB body.
  const contentLength = request.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return Response.json({ error: 'Payload too large' }, { status: 413 })
  }

  const parsed = await parseBody(request)
  if (!parsed.ok) {
    return Response.json({ error: 'Invalid input' }, { status: 400 })
  }
  const { data } = parsed

  // Step 1: Verify Turnstile BEFORE any Clerk / DB work. INTAKE-02 + Pitfall 2.
  const ts = await verifyTurnstile(data.turnstileToken, request)
  if (!ts.success) {
    return Response.json({ error: 'Security check failed' }, { status: 403 })
  }

  // Step 2: SHA-256 hash of lowercased + trimmed email → stable rate-limit key.
  const emailHash = createHash('sha256')
    .update(data.email.toLowerCase().trim())
    .digest('hex')

  // Step 3: Fire Inngest event. Rate limit + Clerk + welcome email all run
  // inside participateIntakeFn (src/inngest/functions/participate-intake.ts).
  // I4: forward orgName and role so the worker can persist them on the
  // Clerk invitation publicMetadata and emit an audit event containing
  // the full intake payload.
  try {
    await sendParticipateIntake({
      emailHash,
      email: data.email,
      name: data.name,
      orgType: data.orgType,
      expertise: data.expertise,
      howHeard: data.howHeard,
      orgName: data.orgName,
      role: data.role,
    })
  } catch (err) {
    // Inngest send failure is a real server error - surface generically.
    console.error('[participate] sendParticipateIntake failed', err)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }

  // Same success shape for new + existing users - no info leak (INTAKE-06).
  return Response.json({ success: true }, { status: 200 })
}
