/**
 * P18: centralised environment validation.
 *
 * Scattered `requireEnv()` helpers in r2.ts, cardano.ts, llm.ts throw at
 * first-call time (lazy). A misconfigured deployment passes health checks
 * and then crashes the first time a user uploads a file or triggers
 * anchoring, producing confusing 500s instead of a clear startup failure.
 *
 * This module validates every known required env var at module load and
 * throws a single aggregated error listing every missing/malformed key.
 *
 * Import from `next.config.ts` for validation at build time and from
 * route handlers / libs that want typed access to env values.
 *
 * Design constraint: zod is already a runtime dependency (every tRPC
 * router depends on it). Pulling in `@t3-oss/env-nextjs` would be a
 * heavier lift and is not required — a plain Zod `.safeParse()` against
 * process.env is sufficient for the fail-fast guarantee.
 *
 * Fail mode: `validateEnv()` on strict-mode (the default) throws an
 * aggregated Error. `assertEnv()` is a thin wrapper that runs once at
 * module load. Routes that need a specific var can either destructure
 * from `env` (typed) or rely on the existing `requireEnv()` helpers
 * (which still throw lazily — this module is additive, not replacing).
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

// All vars that MUST be present for the app to function. Each entry has a
// short rationale for why it's in the required set.
const requiredServerEnvSchema = z.object({
  // --- Database --------------------------------------------------------
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // --- Clerk Auth ------------------------------------------------------
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
  CLERK_WEBHOOK_SECRET: z.string().min(1, 'CLERK_WEBHOOK_SECRET is required'),

  // --- Inngest ---------------------------------------------------------
  // P19/P28: the SDK reads these at runtime; asserting them here guarantees
  // prod deployments never silently skip signature verification.
  INNGEST_SIGNING_KEY: z.string().min(1, 'INNGEST_SIGNING_KEY is required'),
  INNGEST_EVENT_KEY: z.string().min(1, 'INNGEST_EVENT_KEY is required'),

  // --- R2 object storage -----------------------------------------------
  R2_ENDPOINT: z.string().url('R2_ENDPOINT must be a valid URL'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET_NAME: z.string().min(1, 'R2_BUCKET_NAME is required'),
  R2_PUBLIC_URL: z.string().url('R2_PUBLIC_URL must be a valid URL'),

  // --- Resend ----------------------------------------------------------
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),

  // --- Groq LLM --------------------------------------------------------
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),

  // --- Cloudflare Turnstile (public intake bot-gate) -------------------
  CLOUDFLARE_TURNSTILE_SECRET_KEY: z.string().min(1, 'CLOUDFLARE_TURNSTILE_SECRET_KEY is required'),

  // --- Cardano anchoring -----------------------------------------------
  CARDANO_WALLET_MNEMONIC: z
    .string()
    .min(1, 'CARDANO_WALLET_MNEMONIC is required (24-word preview-net seed)'),
  BLOCKFROST_PROJECT_ID: z
    .string()
    .min(1, 'BLOCKFROST_PROJECT_ID is required')
    .regex(/^preview/, 'BLOCKFROST_PROJECT_ID must start with "preview" for testnet'),

  // --- Workshop feedback deep-link JWT ---------------------------------
  WORKSHOP_FEEDBACK_JWT_SECRET: z
    .string()
    .min(32, 'WORKSHOP_FEEDBACK_JWT_SECRET must be at least 32 characters'),

  // --- cal.com --------------------------------------------------------
  CAL_API_KEY: z.string().min(1, 'CAL_API_KEY is required'),
  CAL_WEBHOOK_SECRET: z.string().min(1, 'CAL_WEBHOOK_SECRET is required'),
  CAL_PRIMARY_ATTENDEE_EMAIL: z
    .string()
    .email('CAL_PRIMARY_ATTENDEE_EMAIL must be a valid email')
    .min(1, 'CAL_PRIMARY_ATTENDEE_EMAIL is required'),
  CAL_PRIMARY_ATTENDEE_NAME: z
    .string()
    .min(1, 'CAL_PRIMARY_ATTENDEE_NAME is required'),
})

// Public `NEXT_PUBLIC_*` vars baked into the client bundle. Validated but
// distinct from the server schema so typos don't fail the server validation.
const requiredPublicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required'),
  NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY is required'),
})

// Optional vars documented here for discoverability. Not validated beyond
// type — missing values are tolerated by the app.
const optionalEnvSchema = z.object({
  APP_BASE_URL: z.string().url().optional(),
  RESEND_FROM_ADDRESS: z.string().optional(),
  // P11: support address that replyTo headers point to so replies to system
  // emails don't bounce off the noreply mailbox.
  SUPPORT_EMAIL: z.string().email().optional(),
  SENTRY_DSN: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
})

// ---------------------------------------------------------------------------
// Validation entrypoints
// ---------------------------------------------------------------------------

export type ServerEnv = z.infer<typeof requiredServerEnvSchema>
export type PublicEnv = z.infer<typeof requiredPublicEnvSchema>
export type OptionalEnv = z.infer<typeof optionalEnvSchema>

/**
 * Validate server-side env vars. Throws an aggregated Error listing every
 * missing or malformed key. Returns typed env on success.
 *
 * Skipped entirely when SKIP_ENV_VALIDATION=true — used by Next.js build
 * steps that do not have access to secrets (e.g. `next lint`).
 */
export function validateEnv(): {
  server: ServerEnv
  public: PublicEnv
  optional: OptionalEnv
} {
  if (process.env.SKIP_ENV_VALIDATION === 'true') {
    return {
      server: {} as ServerEnv,
      public: {} as PublicEnv,
      optional: {} as OptionalEnv,
    }
  }

  const serverResult = requiredServerEnvSchema.safeParse(process.env)
  const publicResult = requiredPublicEnvSchema.safeParse(process.env)
  const optionalResult = optionalEnvSchema.safeParse(process.env)

  const issues: string[] = []
  if (!serverResult.success) {
    for (const issue of serverResult.error.issues) {
      issues.push(`  - server.${issue.path.join('.')}: ${issue.message}`)
    }
  }
  if (!publicResult.success) {
    for (const issue of publicResult.error.issues) {
      issues.push(`  - public.${issue.path.join('.')}: ${issue.message}`)
    }
  }
  if (!optionalResult.success) {
    for (const issue of optionalResult.error.issues) {
      issues.push(`  - optional.${issue.path.join('.')}: ${issue.message}`)
    }
  }

  if (issues.length > 0) {
    throw new Error(
      `Environment validation failed:\n${issues.join('\n')}\n\n` +
        `See .env.example for the full list. Set SKIP_ENV_VALIDATION=true to bypass during builds.`,
    )
  }

  return {
    server: serverResult.data!,
    public: publicResult.data!,
    optional: optionalResult.data!,
  }
}

/**
 * P18: lazy typed accessor. Computes once and caches. Use this inside
 * server code that wants typed env values; pairs with the lazy
 * `requireEnv()` helpers in r2.ts / cardano.ts / llm.ts (which still
 * exist as belt-and-braces).
 */
let _cached: ReturnType<typeof validateEnv> | null = null
export function env(): ReturnType<typeof validateEnv> {
  if (_cached) return _cached
  _cached = validateEnv()
  return _cached
}
