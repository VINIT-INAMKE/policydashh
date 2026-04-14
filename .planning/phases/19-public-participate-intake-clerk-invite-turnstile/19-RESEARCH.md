# Phase 19: Public `/participate` Intake — Research

**Researched:** 2026-04-14
**Domain:** Public intake form, Clerk invitations API, Cloudflare Turnstile, Inngest rate limiting, Resend react-email
**Confidence:** HIGH

---

## Summary

Phase 19 wires a fully public, unauthenticated intake form at `/participate` into the existing Inngest event pipeline. A visitor completes a multi-field form gated by Cloudflare Turnstile; the server verifies the token, fires a `participate.intake` Inngest event (returning 200 immediately), and the Inngest function handles the slow work: Clerk invitation API call, idempotency check, and org-bucket-tailored welcome email via Resend react-email.

No new infrastructure packages are required beyond `@marsidev/react-turnstile` (Turnstile widget) and potentially `crypto` (Node built-in for SHA-256 emailHash). No Redis/Upstash is available; rate limiting runs through Inngest's built-in `rateLimit` / `throttle` options keyed on a hashed email. The existing `(public)` route group, `proxy.ts` matcher, `src/lib/email.ts` pattern, and Inngest event/function patterns are all reusable without modification.

**Primary recommendation:** Use a dedicated Route Handler (`app/api/intake/participate/route.ts`) — not a tRPC mutation — for the submit endpoint. This keeps the Turnstile secret server-side without tRPC ceremony, matches the pattern used for other non-authenticated API routes (`/api/webhooks/clerk`, `/api/upload`), and is callable via a simple `fetch` from a client component in ~150ms.

---

## Project Constraints (from CLAUDE.md / AGENTS.md)

- This Next.js is version **16.2.1** — treat all conventions as potentially changed from training data. Read `node_modules/next/dist/docs/` before writing code patterns.
- The AGENTS.md directive is: *"Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."*
- No Radix — base-nova uses `@base-ui/react` for all primitives (Phase 02 decision).
- Toaster is imported from `sonner` directly, not a shadcn wrapper (Phase 02 decision).
- All emails use Resend with silent no-op guard pattern (`if (!resend || !to) return`).
- `z.guid()` not `z.uuid()` for event schema UUIDs (Phase 16 decision, Zod 4 compat).
- Inngest triggers inlined in `createFunction` options — never extract to `const triggers = [...]` (type widening footgun, documented in Phase 16).
- No audit log for purely public, unauthenticated actions — the intake submission has no `actorId` to write. Write audit log only after user is created, if at all.
- `publicProcedure` exists in `src/trpc/init.ts` but the rule "*no publicProcedure in application routers*" (Phase 01 decision) means the submit endpoint must be a Route Handler, not tRPC.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTAKE-01 | Public can submit `/participate` form with role, org type, expertise, email, and interest | Route group `(public)`, zero Clerk imports; shadcn form components already in `components/ui/` |
| INTAKE-02 | Cloudflare Turnstile captcha gates server-side before any processing | Turnstile `/siteverify` endpoint + `CLOUDFLARE_TURNSTILE_SECRET_KEY` env var; Route Handler POST verifies token before any DB/Clerk call |
| INTAKE-03 | Submission triggers `participateIntake` Inngest fn (rate-limited, idempotent per emailHash) | Inngest `rateLimit` option with `key` expression on event data; `sendParticipateIntake` helper following events.ts pattern |
| INTAKE-04 | Auto-creates Clerk user via `invitations.createInvitation` when email unknown | `clerkClient().invitations.createInvitation({ emailAddress, publicMetadata: { role: 'stakeholder', orgType } })` with `ignoreExisting: true` |
| INTAKE-05 | Role-tailored welcome email via Resend per 6 org buckets | react-email components (`Html`, `Body`, `Container`, `Text`, `Button`) + `render()` from `@react-email/render`; 6 template variants in `src/lib/email.ts` |
| INTAKE-06 | Existing Clerk user routed to existing account, no duplicate invite, still receives welcome email | `ignoreExisting: true` on `createInvitation` silently no-ops; welcome email sends regardless (same Inngest fn path) |
| INTAKE-07 | `/participate` form reachable without authentication | `(public)` route group + `proxy.ts` `isPublicRoute` whitelist addition for `/participate(.*)` |
</phase_requirements>

---

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@clerk/nextjs` | 7.0.6 | Clerk invitations API via `clerkClient()` | Already installed; `clerkClient()` returns `ClerkClient` with `.invitations` namespace |
| `inngest` | 4.2.1 | `participateIntakeFn` + `rateLimit` config | Existing Inngest pipeline; `rateLimit` built-in, no Redis needed |
| `resend` | 6.9.4 | Welcome email delivery | Existing Resend singleton in `src/lib/email.ts` |
| `@react-email/components` | 1.0.10 | HTML email templates (6 org bucket variants) | Already installed; `render()` from `@react-email/render` (re-exported) converts JSX to HTML string |
| `zod` | 4.3.6 | Payload validation in Route Handler and Inngest event schema | Existing pattern throughout codebase |
| `next` | 16.2.1 | Route Handler for submit endpoint | `app/api/intake/participate/route.ts` |

### New Install Required

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@marsidev/react-turnstile` | latest (~^3.0) | Turnstile widget React wrapper | Not installed. UI-SPEC approved this or direct script tag. Prefer the npm wrapper for controlled token callback. Executor must audit before npm install. |

**Alternative (no new package):** Use a `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />` in the page + `window.turnstile.render()` imperatively. This avoids the npm dependency at the cost of manual TypeScript ambient declarations. Both are valid; UI-SPEC explicitly notes this decision is deferred to executor. **Recommendation:** use `@marsidev/react-turnstile` — it wraps the script load + callback surface cleanly.

**Installation (new package only):**
```bash
npm install @marsidev/react-turnstile
```

### No New Install

- `crypto` — Node.js built-in, used for `SHA-256(email)` emailHash in the Route Handler before firing the event. No `@types/crypto` needed (built-in types ship with `@types/node`).
- No Redis/Upstash — rate limiting is handled entirely by Inngest's `rateLimit` option.

---

## Architecture Patterns

### Recommended Project Structure

```
app/
├── (public)/
│   ├── layout.tsx              # Existing public layout (update nav to add /participate link)
│   └── participate/
│       ├── page.tsx            # Server component shell — imports ParticipateForm
│       └── _components/
│           └── participate-form.tsx  # 'use client' — full form + Turnstile + fetch submit
app/
└── api/
    └── intake/
        └── participate/
            └── route.ts        # POST handler: verify Turnstile → hash email → send Inngest event
src/
├── inngest/
│   ├── events.ts               # Add participateIntakeEvent + sendParticipateIntake
│   └── functions/
│       ├── participate-intake.ts   # participateIntakeFn: Clerk invite + welcome email
│       └── index.ts            # Register participateIntakeFn
└── lib/
    └── email.ts                # Add sendWelcomeEmail(to, orgType, name) — 6 bucket variants
```

### Pattern 1: Route Handler for Unauthenticated Submit

The submit endpoint is a standard Next.js Route Handler, not tRPC. This:
- Has no Clerk session requirement
- Keeps `CLOUDFLARE_TURNSTILE_SECRET_KEY` server-side
- Returns fast (just validates + fires Inngest event)
- Matches the pattern of `/api/webhooks/clerk/route.ts`

```typescript
// app/api/intake/participate/route.ts
import { createHash } from 'crypto'
import { sendParticipateIntake } from '@/src/inngest/events'
import { z } from 'zod'

const bodySchema = z.object({
  name:         z.string().min(2).max(120),
  email:        z.string().email(),
  role:         z.enum(['government', 'industry', 'legal', 'academia', 'civil_society', 'internal']),
  orgType:      z.enum(['government', 'industry', 'legal', 'academia', 'civil_society', 'internal']),
  orgName:      z.string().min(2).max(200),
  expertise:    z.string().min(20).max(1000),
  howHeard:     z.string().optional(),
  turnstileToken: z.string().min(1),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input' }, { status: 400 })
  }

  // Step 1: Verify Turnstile BEFORE any Clerk or DB work (INTAKE-02)
  const tsResult = await verifyTurnstile(parsed.data.turnstileToken, req)
  if (!tsResult.success) {
    return Response.json({ error: 'Security check failed' }, { status: 403 })
  }

  // Step 2: Hash email for rate limit key (never expose raw email in event key)
  const emailHash = createHash('sha256').update(parsed.data.email.toLowerCase().trim()).digest('hex')

  // Step 3: Fire Inngest event — returns immediately (INTAKE-03)
  await sendParticipateIntake({
    emailHash,
    email:     parsed.data.email,
    name:      parsed.data.name,
    orgType:   parsed.data.orgType,
    expertise: parsed.data.expertise,
    howHeard:  parsed.data.howHeard,
  })

  return Response.json({ success: true }, { status: 200 })
}

async function verifyTurnstile(token: string, req: Request): Promise<{ success: boolean }> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY
  if (!secret) return { success: false }
  const ip = req.headers.get('CF-Connecting-IP') ?? req.headers.get('x-forwarded-for') ?? ''
  const form = new FormData()
  form.append('secret', secret)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body:   form,
  })
  const data = await res.json() as { success: boolean }
  return { success: data.success }
}
```

**Source:** Next.js 16 route.md (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`), Cloudflare Turnstile server-side docs.

### Pattern 2: Inngest Event + `rateLimit` for per-emailHash Rate Limiting

Inngest v4.2.1 ships `rateLimit` as a native function option. Key expression uses event data. This is the canonical approach for this repo — no Redis, no Upstash.

```typescript
// src/inngest/functions/participate-intake.ts
export const participateIntakeFn = inngest.createFunction(
  {
    id: 'participate-intake',
    name: 'Participate intake — Clerk invite + welcome email',
    retries: 3,
    // Rate limit: max 1 run per emailHash per 15 minutes (INTAKE-03)
    // This is a HARD skip — over-limit events are dropped.
    // Use throttle instead if you want queue-not-drop behaviour.
    rateLimit: {
      key:    'event.data.emailHash',
      limit:  1,
      period: '15m',
    },
    // Inlined per Phase 16 pattern (type widening footgun)
    triggers: [{ event: participateIntakeEvent }],
  },
  async ({ event, step }) => { ... }
)
```

**Source:** `node_modules/inngest/components/InngestFunction.d.ts` lines 172-185 (verified).

**Critical distinction — `rateLimit` vs `throttle`:**
- `rateLimit`: hard skip. If limit exceeded, the run is silently dropped. Correct for abuse prevention.
- `throttle`: enqueues. If limit exceeded, the run waits in a backlog. Wrong for intake — spammers would fill the queue.

Use `rateLimit` for INTAKE-03.

### Pattern 3: Clerk `invitations.createInvitation` with `ignoreExisting`

```typescript
// Inside participateIntakeFn step
const client = await clerkClient()
let invitation: Awaited<ReturnType<typeof client.invitations.createInvitation>> | null = null
try {
  invitation = await client.invitations.createInvitation({
    emailAddress:   email,
    ignoreExisting: true,   // INTAKE-06: silently no-ops if email already invited/user exists
    publicMetadata: {
      role:    'stakeholder',
      orgType: orgType,
    },
  })
} catch (err) {
  // ClerkAPIResponseError with status !== 422/duplicate will propagate.
  // NonRetriableError for truly permanent failures (e.g. invalid email format).
  // Plain Error for transient (lets Inngest retry budget run).
  if (isClerkAPIResponseError(err) && err.status >= 500) {
    throw err  // plain Error → Inngest retries
  }
  throw new NonRetriableError(`Clerk invitation failed: ${String(err)}`)
}
```

**Key facts (verified from type definitions):**

| Fact | Source | Confidence |
|------|--------|------------|
| `clerkClient()` is a Promise, must be awaited | `@clerk/nextjs/dist/types/server/clerkClient.d.ts` | HIGH |
| `invitations.createInvitation(params)` returns `Promise<Invitation>` | `@clerk/backend/dist/api/endpoints/InvitationApi.d.ts` line 45 | HIGH |
| `ignoreExisting?: boolean` is a valid param on `createInvitation` | `InvitationApi.d.ts` line 12 | HIGH |
| `publicMetadata` is `UserPublicMetadata` (extends `Record<string, unknown>`) | `InvitationApi.d.ts` line 13 | HIGH |
| Errors thrown as `ClerkAPIResponseError` (from `@clerk/shared/error`) | `@clerk/backend/dist/api/request.d.ts` | HIGH |
| `isClerkAPIResponseError` guard available from `@clerk/shared/error` | `@clerk/shared/dist/runtime/error.d.ts` | HIGH |

**INTAKE-06 Handling — Existing User:**
When `ignoreExisting: true` is set, Clerk silently accepts the call even if the email already exists as an invitation or registered user. The function should still proceed to send the welcome email. The UI always shows the success panel (never exposes account existence per UI-SPEC).

### Pattern 4: Inngest Idempotency Key

Inngest v4 `idempotency` field on function options (not event send) deduplicates concurrent runs with the same key expression. For intake:

```typescript
// Option A: Inngest-native idempotency key on the function
idempotency: 'event.data.emailHash'
// This prevents double-processing the same emailHash across concurrent events.
// NOTE: idempotency overrides rateLimit if both are set — use one or the other.
```

**Decision:** Use `rateLimit` (not `idempotency`) for INTAKE-03. `rateLimit` with `limit: 1, period: '15m'` achieves both rate limiting and within-window deduplication simultaneously. `idempotency` would only deduplicate, not rate-limit.

**Source:** `node_modules/inngest/components/InngestFunction.d.ts` line 165: `idempotency?: string` — "If specified, this overrides the `rateLimit` object."

### Pattern 5: React-Email Templates (6 org buckets)

`@react-email/components` v1.0.10 is already installed. The `render()` function is available from the re-exported `@react-email/render` package.

```typescript
// src/lib/email.ts — add sendWelcomeEmail
import { render } from '@react-email/components'
import { WelcomeEmail } from './email-templates/welcome-email'

export async function sendWelcomeEmail(
  to: string | null | undefined,
  data: { name: string; orgType: OrgType; email: string }
): Promise<void> {
  if (!resend || !to) return
  const html = await render(<WelcomeEmail {...data} />)
  await resend.emails.send({
    from:    FROM_ADDRESS,
    to,
    subject: `Welcome to the consultation, ${data.name.split(' ')[0]}`,
    html,
  })
}
```

Template file: `src/lib/email-templates/welcome-email.tsx` — a React component returning `<Html><Body>...</Body></Html>` with a switch on `orgType` for the body paragraph and CTA label (per UI-SPEC).

**Source:** `@react-email/render` v1.x node render export (`render(node)` returns `Promise<string>`). Verified from `node_modules/@react-email/render/dist/node/index.d.ts`.

**Existing email.ts pattern:** All 4 existing helpers (`sendFeedbackReviewedEmail`, `sendVersionPublishedEmail`, `sendSectionAssignedEmail`, `sendWorkshopEvidenceNudgeEmail`) use plain text strings. Phase 19 is the first to use HTML via `render()` — this is a deliberate upgrade, matching the UI-SPEC which specifies structured HTML email output with a CTA button.

### Pattern 6: Inngest Event Schema (events.ts template)

```typescript
// src/inngest/events.ts — add to existing file

const participateIntakeSchema = z.object({
  emailHash:  z.string().min(64).max(64),   // SHA-256 hex = 64 chars
  email:      z.string().email(),
  name:       z.string().min(2).max(120),
  orgType:    z.enum(['government', 'industry', 'legal', 'academia', 'civil_society', 'internal']),
  expertise:  z.string().min(1),
  howHeard:   z.string().optional(),
})

export const participateIntakeEvent = eventType('participate.intake', {
  schema: participateIntakeSchema,
})

export type ParticipateIntakeData = z.infer<typeof participateIntakeSchema>

export async function sendParticipateIntake(data: ParticipateIntakeData): Promise<void> {
  const event = participateIntakeEvent.create(data)
  await event.validate()
  await inngest.send(event)
}
```

**Note on emailHash:** The hash is the rate-limit key, not the email itself. Carrying the raw email in the event is also required (for the Clerk API call and the welcome email send). The hash is a separate field for the `rateLimit.key` expression.

### Anti-Patterns to Avoid

- **Do not use tRPC for the submit endpoint.** `publicProcedure` exists in init.ts but Phase 01 decision: "no publicProcedure in application routers". Use a Route Handler.
- **Do not call Clerk or send email synchronously in the Route Handler.** Return 200 immediately after firing Inngest event. Clerk invite + email send happen in the Inngest fn (INTAKE-03 success criterion: toast within 500ms).
- **Do not use `throttle` instead of `rateLimit`.** `throttle` enqueues; `rateLimit` drops. Abuse vectors use `rateLimit`.
- **Do not expose raw email in error responses.** All errors return generic messages (INTAKE-06 no-info-leak).
- **Do not add `/participate` route to tRPC router.** Add it to `proxy.ts` `isPublicRoute` matcher.
- **Do not set `idempotency` AND `rateLimit` together.** Inngest docs state idempotency overrides rateLimit if both specified.
- **Do not use `z.uuid()` in Inngest event schemas.** Use `z.guid()` per Phase 16 decision. The emailHash field is a plain string, not a UUID, so this only applies to any UUID fields added.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Turnstile bot check | Custom CAPTCHA / heuristics | Cloudflare Turnstile `/siteverify` endpoint | Cloudflare handles browser fingerprinting, proof-of-work, accessibility |
| Rate limiting | In-memory Map / DB query counter | Inngest `rateLimit` option | Native, durable across function restarts, keyed on event data expression |
| Email HTML | String concatenation template | `@react-email/components` + `render()` | Already installed, handles inline CSS, Outlook compat, HTML sanitization |
| Duplicate invite detection | DB query + conditional | `ignoreExisting: true` on Clerk `createInvitation` | Single flag; Clerk handles dedup atomically |
| Clerk error detection | `instanceof` checks | `isClerkAPIResponseError` from `@clerk/shared/error` | Type-safe guard, works across module boundaries |

---

## Common Pitfalls

### Pitfall 1: `clerkClient()` Must Be Awaited (Breaking Change in Clerk v7)

**What goes wrong:** Calling `clerkClient.invitations.createInvitation(...)` without awaiting the `clerkClient()` Promise returns undefined.
**Why it happens:** Clerk v7 changed `clerkClient` from a singleton to an async factory: `declare const clerkClient: () => Promise<ClerkClient>`. The type declaration in `@clerk/nextjs/dist/types/server/clerkClient.d.ts` confirms this.
**How to avoid:** Always `const client = await clerkClient()` before calling any API.
**Warning signs:** TypeScript error "Property 'invitations' does not exist on type 'Promise<ClerkClient>'"

### Pitfall 2: Turnstile Token Must Be Verified BEFORE Clerk/DB

**What goes wrong:** Calling Clerk invite before verifying Turnstile allows bots to enumerate valid emails (404 vs 200 timing difference) or exhaust Clerk API quota.
**Why it happens:** Developers put Turnstile verification after business logic for "simplicity".
**How to avoid:** Verify Turnstile as the absolute first step in the Route Handler. Return 403 immediately on failure before any other processing.

### Pitfall 3: `rateLimit` is Lossy — Legitimate Users May Be Rate-Limited

**What goes wrong:** A legitimate user submits twice (double-click, network retry). Second submission is silently dropped.
**Why it happens:** `rateLimit` in Inngest is a hard drop, not a queue.
**How to avoid:** The UI success state (form replaced by success panel) and sonner toast prevent double-submit. The Route Handler always returns 200 (the event was accepted, even if Inngest drops the function run). This is correct per INTAKE-06: same response for new and existing users.

### Pitfall 4: Inngest Type Widening with Extracted Triggers

**What goes wrong:** Extracting `const triggers = [{ event: participateIntakeEvent }]` and passing it to `createFunction` collapses `event.data` to `any` inside the handler.
**Why it happens:** Inngest v4 type inference requires the trigger array to be inlined directly in options.
**How to avoid:** Always inline triggers. This is already documented as Phase 16 pattern: "Inlined per src/inngest/README.md §90-94 (type widening footgun)".

### Pitfall 5: `publicMetadata` on Invitation Does NOT Immediately Set User Role

**What goes wrong:** Relying on `publicMetadata.role` set at invitation time to be immediately queryable in the DB `users` table.
**Why it happens:** `publicMetadata` flows into the user's profile only after the user ACCEPTS the invitation and completes sign-up. The Clerk webhook (`user.created`) fires at that point — that's when the user row is upserted in `users` with the role from `public_metadata`.
**How to avoid:** The Phase 19 Inngest fn only creates the invitation + sends welcome email. The role assignment lands in the DB when the user accepts and the `/api/webhooks/clerk` handler fires. This is the correct and existing flow — verify by checking `app/api/webhooks/clerk/route.ts` which already reads `public_metadata.role` on `user.created`.

### Pitfall 6: React-Email `render()` is Async

**What goes wrong:** Calling `render(<WelcomeEmail ... />)` without `await` returns a Promise<string> that gets sent as HTML, rendering as "[object Promise]" in the email client.
**Why it happens:** `@react-email/render` v1.x changed `render()` to return `Promise<string>` (async render).
**How to avoid:** Always `const html = await render(<WelcomeEmail ... />)`. Verified from type signature: `declare const render: (node: React.ReactNode, options?: Options) => Promise<string>`.

### Pitfall 7: Missing `proxy.ts` Whitelist Entry for `/participate`

**What goes wrong:** `clerkMiddleware` in `proxy.ts` calls `auth.protect()` on the route, returning 401 before the page renders.
**Why it happens:** `/participate` is not in the existing `isPublicRoute` matcher.
**How to avoid:** Add `'/participate(.*)'` to the `createRouteMatcher([...])` array in `proxy.ts`. This is the **only change needed** in `proxy.ts`.

### Pitfall 8: Email Template JSX in Inngest Function File

**What goes wrong:** Importing a `.tsx` React-email template from an Inngest function file causes Vitest to fail because Inngest function tests typically mock modules without JSX transforms.
**Why it happens:** React components in test environments need the JSX transform configured.
**How to avoid:** Keep the email template as a `.tsx` file in `src/lib/email-templates/`. The `sendWelcomeEmail` helper in `src/lib/email.ts` wraps the template import. Inngest function tests mock `src/lib/email.ts` at module level (same as Phase 16/17/18 pattern), so the TSX never gets imported directly in test context.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@clerk/nextjs` | INTAKE-04 Clerk invite | ✓ | 7.0.6 | — |
| `inngest` | INTAKE-03 async fn | ✓ | 4.2.1 | — |
| `resend` | INTAKE-05 welcome email | ✓ | 6.9.4 | Silent no-op (existing pattern) |
| `@react-email/components` | INTAKE-05 HTML email | ✓ | 1.0.10 | Fall back to plain-text (existing pattern) |
| `zod` | Input validation | ✓ | 4.3.6 | — |
| Cloudflare Turnstile API | INTAKE-02 bot check | ✓ (external HTTPS) | — | Returns 403 if `CLOUDFLARE_TURNSTILE_SECRET_KEY` unset |
| `@marsidev/react-turnstile` | INTAKE-02 widget | ✗ (not installed) | — | Direct script tag (no npm package) |
| Redis/Upstash | rate limiting | ✗ | — | Inngest `rateLimit` (no Redis needed) |
| `crypto` | emailHash | ✓ (Node built-in) | — | — |

**New env vars required (add to `.env.example`):**

```bash
# Cloudflare Turnstile
NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=0x...   # public — used by widget
CLOUDFLARE_TURNSTILE_SECRET_KEY=0x...              # secret — server-side verify only
```

**Missing with no fallback:**
- `@marsidev/react-turnstile` — must install OR implement direct script embed. Both work; this is an executor decision.

**Missing with fallback:**
- `RESEND_API_KEY` / `CLOUDFLARE_TURNSTILE_SECRET_KEY` — existing silent-no-op guards handle missing keys gracefully.

---

## Validation Architecture

`workflow.nyquist_validation: true` — this section is MANDATORY.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm test -- --reporter=verbose src/inngest/__tests__/participate-intake.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTAKE-02 | Turnstile `success: false` → Route Handler returns 403, no Inngest event fired | unit | `npm test -- src/__tests__/participate-route.test.ts` | ❌ Wave 0 |
| INTAKE-02 | Turnstile `success: true` → continues to event fire | unit | `npm test -- src/__tests__/participate-route.test.ts` | ❌ Wave 0 |
| INTAKE-03 | `sendParticipateIntake` helper validates + sends event | unit | `npm test -- src/__tests__/participate-route.test.ts` | ❌ Wave 0 |
| INTAKE-03 | `participateIntakeFn` has `rateLimit: { key: 'event.data.emailHash', limit: 1, period: '15m' }` | unit | `npm test -- src/inngest/__tests__/participate-intake.test.ts` | ❌ Wave 0 |
| INTAKE-04 | `participateIntakeFn` calls `clerkClient().invitations.createInvitation` with `ignoreExisting: true` | unit | `npm test -- src/inngest/__tests__/participate-intake.test.ts` | ❌ Wave 0 |
| INTAKE-05 | `sendWelcomeEmail` called with correct `orgType` after Clerk invite step | unit | `npm test -- src/inngest/__tests__/participate-intake.test.ts` | ❌ Wave 0 |
| INTAKE-05 | 6 org bucket copy variants render distinct body + CTA in email component | unit | `npm test -- src/lib/__tests__/welcome-email.test.ts` | ❌ Wave 0 |
| INTAKE-06 | `ignoreExisting: true` → Inngest fn still sends welcome email on repeat submission | unit | `npm test -- src/inngest/__tests__/participate-intake.test.ts` | ❌ Wave 0 |
| INTAKE-07 | `/participate` is in `proxy.ts` `isPublicRoute` — no Clerk session required | unit (matcher test) | `npm test -- src/__tests__/public-routes.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- src/inngest/__tests__/participate-intake.test.ts src/__tests__/participate-route.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

All 4 test files need to be created in Wave 0 (Plan 19-00):

- [ ] `src/__tests__/participate-route.test.ts` — covers INTAKE-02, INTAKE-03 (route handler level)
- [ ] `src/inngest/__tests__/participate-intake.test.ts` — covers INTAKE-03, INTAKE-04, INTAKE-05, INTAKE-06 (Inngest fn level)
- [ ] `src/lib/__tests__/welcome-email.test.ts` — covers INTAKE-05 (6 template variants render)
- [ ] `src/__tests__/public-routes.test.ts` — covers INTAKE-07 (proxy.ts route matcher)

**Wave 0 pattern to follow:** Phase 16/17/18 established:
- `vi.hoisted()` for sharing mock functions across `vi.mock` factory hoist boundary
- Variable-path dynamic import inside `beforeAll` for modules that do not yet exist on disk (`/* @vite-ignore */`)
- `router._def.procedures.X` probe pattern for tRPC TDD (not applicable here — Route Handler, not tRPC)
- Mock `src/inngest/events.ts` and `src/lib/email.ts` at module level

---

## Code Examples

### Turnstile Server-Side Verification

```typescript
// Source: Cloudflare Turnstile docs (https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
async function verifyTurnstile(token: string, remoteip?: string): Promise<boolean> {
  const formData = new FormData()
  formData.append('secret', process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY!)
  formData.append('response', token)
  if (remoteip) formData.append('remoteip', remoteip)

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  })
  const data = await res.json() as { success: boolean; 'error-codes'?: string[] }
  return data.success
}
```

**Response shape:** `{ success: boolean, challenge_ts: string, hostname: string, 'error-codes': string[] }`

### Clerk Invitation Create with ignoreExisting

```typescript
// Source: @clerk/backend InvitationApi.d.ts (verified)
import { clerkClient } from '@clerk/nextjs/server'
import { isClerkAPIResponseError } from '@clerk/shared/error'
import { NonRetriableError } from 'inngest'

const client = await clerkClient()
try {
  await client.invitations.createInvitation({
    emailAddress:   email,
    ignoreExisting: true,
    publicMetadata: { role: 'stakeholder', orgType },
  })
} catch (err) {
  if (isClerkAPIResponseError(err) && err.status && err.status >= 500) {
    throw err  // transient — Inngest retries
  }
  throw new NonRetriableError(`Clerk invite failed permanently: ${String(err)}`)
}
```

### Inngest rateLimit on emailHash

```typescript
// Source: node_modules/inngest/components/InngestFunction.d.ts (verified)
inngest.createFunction(
  {
    id: 'participate-intake',
    rateLimit: {
      key:    'event.data.emailHash',
      limit:  1,
      period: '15m',
    },
    triggers: [{ event: participateIntakeEvent }],  // inlined — never extract
  },
  async ({ event, step }) => { ... }
)
```

### React-Email Template (async render)

```tsx
// src/lib/email-templates/welcome-email.tsx
import { Html, Body, Container, Text, Button, Hr } from '@react-email/components'

const BUCKET_COPY: Record<string, { body: string; cta: string }> = {
  government:    { body: 'As a government official...', cta: 'Accept Invitation & Sign In' },
  industry:      { body: 'As an industry professional...', cta: 'Accept Invitation & Sign In' },
  legal:         { body: 'As a legal professional...', cta: 'Accept Invitation & Sign In' },
  academia:      { body: 'As an academic or researcher...', cta: 'Accept Invitation & Sign In' },
  civil_society: { body: 'As a civil society representative...', cta: 'Accept Invitation & Sign In' },
  internal:      { body: 'You've been added as an internal team member...', cta: 'Sign In to Dashboard' },
}

export function WelcomeEmail({ name, orgType, email }: { name: string; orgType: string; email: string }) {
  const bucket = BUCKET_COPY[orgType] ?? BUCKET_COPY.civil_society
  return (
    <Html>
      <Body style={{ fontFamily: 'Inter, sans-serif', color: '#181c1e' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto' }}>
          <Text style={{ fontSize: '24px', fontWeight: '700' }}>You're in.</Text>
          <Text>{bucket.body}</Text>
          <Button href={process.env.NEXT_PUBLIC_APP_URL ?? 'https://policydash.app'} style={{ background: '#000a1e', color: '#fff' }}>
            {bucket.cta}
          </Button>
          <Hr />
          <Text style={{ fontSize: '12px', color: '#44474e' }}>
            This invitation was sent to {email}. If you didn't request this, you can safely ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

```typescript
// Source: @react-email/render node dist (verified — render is async)
import { render } from '@react-email/components'  // re-exports render
const html = await render(<WelcomeEmail name={name} orgType={orgType} email={email} />)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `clerkClient.invitations.createInvitation()` (singleton) | `await clerkClient()` then `.invitations.createInvitation()` (async factory) | Clerk v7 | Must await client factory every call |
| `render()` sync string | `await render()` Promise<string> | react-email v1.x | Must await in Inngest step |
| `z.uuid()` for UUID event fields | `z.guid()` | Phase 16 (Zod 4) | Version-0 test fixtures rejected by z.uuid() |
| `const triggers = [...]` extracted | Inline triggers in createFunction options | Phase 16 (Inngest v4) | Extraction collapses event.data to `any` |

---

## Open Questions

1. **`@marsidev/react-turnstile` vs direct script embed**
   - What we know: UI-SPEC defers this to executor. Both paths are valid.
   - What's unclear: npm package maintenance status, bundle size impact.
   - Recommendation: Use `@marsidev/react-turnstile` — actively maintained (~3.x), provides clean React ref/callback interface. Executor must audit `npm audit` output after install.

2. **Welcome email `from` address for Phase 19**
   - What we know: Existing `FROM_ADDRESS` = `process.env.RESEND_FROM_ADDRESS || 'PolicyDash <onboarding@resend.dev>'`. UI-SPEC says from name = "Civilization Lab Policy Team".
   - What's unclear: Whether a new env var `RESEND_WELCOME_FROM_ADDRESS` is needed or `RESEND_FROM_ADDRESS` should be updated.
   - Recommendation: Use the existing `FROM_ADDRESS` env var. Update `.env.example` comment to document that this address should be "Civilization Lab Policy Team <...>" for production. No new env var.

3. **Inngest rate limit behaviour when `INNGEST_EVENT_KEY` is unset (local dev)**
   - What we know: Inngest runs keyless locally. Rate limits are enforced by the Inngest Cloud / Dev Server.
   - What's unclear: Whether `rateLimit` is enforced by Inngest Dev Server in local mode.
   - Recommendation: Plan Wave 0 tests should mock the Inngest client and verify the function CONFIG has the rateLimit option set — not test the runtime enforcement. Runtime enforcement is Inngest's responsibility.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/@clerk/backend/dist/api/endpoints/InvitationApi.d.ts` — `createInvitation` signature, `ignoreExisting` param
- `node_modules/@clerk/nextjs/dist/types/server/clerkClient.d.ts` — async factory pattern confirmed
- `node_modules/@clerk/backend/dist/api/resources/Invitation.d.ts` — Invitation resource shape
- `node_modules/inngest/components/InngestFunction.d.ts` — `rateLimit`, `throttle`, `idempotency` options
- `node_modules/@react-email/render/dist/node/index.d.ts` — `render()` is `Promise<string>`
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — Route Handler conventions for Next.js 16
- `src/inngest/events.ts` — existing event/helper pattern (eventType, validate, send)
- `src/inngest/functions/notification-dispatch.ts` — Inngest step patterns, NonRetriableError usage
- `src/lib/email.ts` — Resend singleton, silent no-op guard, existing helper signatures
- `proxy.ts` — `isPublicRoute` matcher, `clerkMiddleware` pattern
- `app/(public)/layout.tsx` — public route group structure
- `.env.example` — existing env var inventory

### Secondary (MEDIUM confidence)
- Cloudflare Turnstile server-side validation docs (HTTPS endpoint + FormData payload verified from multiple Cloudflare published examples)
- `@clerk/shared/dist/runtime/error.d.ts` — `isClerkAPIResponseError` type guard export confirmed

### Tertiary (LOW confidence — flag for validation)
- `rateLimit` enforcement in Inngest Dev Server (local) — documented in Inngest Cloud docs but local behaviour not verified against installed version.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from installed node_modules type declarations
- Architecture: HIGH — pattern follows existing phases 16/17/18 faithfully
- Clerk API: HIGH — type signatures read directly from installed package
- Turnstile verify endpoint: MEDIUM — standard Cloudflare public API, stable for years, not verifiable via Context7
- Pitfalls: HIGH — derived from actual phase decisions and installed type declarations

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable APIs; Clerk v7 and Inngest v4 unlikely to change in 30 days)
