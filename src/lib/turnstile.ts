/**
 * Cloudflare Turnstile server-side token verification.
 *
 * Mirrors the pattern inlined in `app/api/intake/participate/route.ts` and
 * `app/api/intake/workshop-register/route.ts` so both public intake routes
 * share a single implementation.
 *
 * Pitfall 2 (19-RESEARCH.md): always pass whatever secret is configured to
 * Cloudflare /siteverify and trust ITS reply. Do NOT short-circuit on a
 * missing secret — in production the real siteverify endpoint answers
 * `success: false`; in tests the global `fetch` is stubbed and answers from
 * the test's mock. Either way the gate stays closed unless siteverify itself
 * returns `success: true`.
 */
export async function verifyTurnstile(
  token: string,
  req: Request,
): Promise<{ success: boolean }> {
  // Read directly from process.env so tests can stub a missing / bogus
  // secret via `vi.stubEnv` and still exercise the closed-gate branch.
  // env.ts validates the same key at boot, so prod deployments can't ship
  // with it unset.
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
    const res = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body: form },
    )
    const data = (await res.json()) as { success?: boolean }
    return { success: data.success === true }
  } catch {
    return { success: false }
  }
}
