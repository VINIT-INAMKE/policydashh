/**
 * Global vitest setup. Runs once before any test file.
 *
 * Populates process.env with placeholder values for every required env var
 * so that module loads which touch `@/src/db`, `@/src/lib/env`, or other
 * env-validated singletons do not throw before tests can mock their
 * internals.
 *
 * These placeholders are deliberately fake — anything that actually makes a
 * network call in tests must be mocked per-file (see the `@/src/db` mock
 * pattern in `tests/phase-20/workshop-register-route.test.ts`). The placeholder
 * DATABASE_URL is enough for `neon()`'s lazy factory to succeed, but any
 * real query would 404 against the stub hostname.
 */

// Neon HTTP driver stores the connection string at module load but does NOT
// connect until a query runs. Any valid-looking URL satisfies the factory.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@db.test.invalid:5432/test'
}

// Clerk: secret + publishable key + webhook secret.
if (!process.env.CLERK_SECRET_KEY) process.env.CLERK_SECRET_KEY = 'sk_test_placeholder'
if (!process.env.CLERK_WEBHOOK_SECRET) process.env.CLERK_WEBHOOK_SECRET = 'whsec_placeholder'
if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_placeholder'
}

// Inngest keys (only required for `requireEnv`-style guards; SDK itself is
// tolerant when unset).
if (!process.env.INNGEST_EVENT_KEY) process.env.INNGEST_EVENT_KEY = 'event-key-placeholder'
if (!process.env.INNGEST_SIGNING_KEY) process.env.INNGEST_SIGNING_KEY = 'signing-key-placeholder'

// R2 storage — module load only, never actually dials out in tests.
if (!process.env.R2_ENDPOINT) process.env.R2_ENDPOINT = 'https://r2.test.invalid'
if (!process.env.R2_ACCESS_KEY_ID) process.env.R2_ACCESS_KEY_ID = 'placeholder'
if (!process.env.R2_SECRET_ACCESS_KEY) process.env.R2_SECRET_ACCESS_KEY = 'placeholder'
if (!process.env.R2_BUCKET_NAME) process.env.R2_BUCKET_NAME = 'test-bucket'
if (!process.env.R2_PUBLIC_URL) process.env.R2_PUBLIC_URL = 'https://files.test.invalid'

// Public app URL.
if (!process.env.NEXT_PUBLIC_APP_URL) process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'

// Resend.
if (!process.env.RESEND_API_KEY) process.env.RESEND_API_KEY = 're_placeholder'

// Groq.
if (!process.env.GROQ_API_KEY) process.env.GROQ_API_KEY = 'gsk_placeholder'

// Cloudflare Turnstile.
if (!process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY) {
  process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = 'turnstile-secret-placeholder'
}
if (!process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY) {
  process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY = '0x000000000000000000AA'
}

// Cardano anchoring.
if (!process.env.CARDANO_WALLET_MNEMONIC) {
  process.env.CARDANO_WALLET_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art'
}
if (!process.env.BLOCKFROST_PROJECT_ID) {
  process.env.BLOCKFROST_PROJECT_ID = 'previewPlaceholderPlaceholderPlace'
}

// Workshop feedback JWT.
if (!process.env.WORKSHOP_FEEDBACK_JWT_SECRET) {
  process.env.WORKSHOP_FEEDBACK_JWT_SECRET = 'a'.repeat(64)
}

// Cal.com credentials + primary attendee identity (added 2026-04-21 with the
// workshop meetings redesign).
if (!process.env.CAL_API_KEY) process.env.CAL_API_KEY = 'cal_test_placeholder'
if (!process.env.CAL_WEBHOOK_SECRET) process.env.CAL_WEBHOOK_SECRET = 'cal-webhook-placeholder'
if (!process.env.CAL_PRIMARY_ATTENDEE_EMAIL) {
  process.env.CAL_PRIMARY_ATTENDEE_EMAIL = 'test-attendee@konma.io'
}
if (!process.env.CAL_PRIMARY_ATTENDEE_NAME) {
  process.env.CAL_PRIMARY_ATTENDEE_NAME = 'Test Attendee'
}
