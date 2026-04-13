# Stack Research — v0.2 Verifiable Policy OS

**Scope:** v0.2 new capabilities ONLY. The v0.1 stack (Next.js 16, tRPC v11, Drizzle + Neon HTTP, Clerk phone-only, R2, Inngest, Tiptap 3, Resend, XState 5, Vitest, Vercel) is LOCKED — not re-evaluated here.
**Researched:** 2026-04-13
**Confidence:** HIGH (groq-sdk, Blockfrost, Turnstile, Clerk backend); MEDIUM (Mesh SDK beta channel, Cal.com embed-react React-19 peer); see per-dep notes.
**Historical context:** The v0.1 stack decisions remain at the bottom of this file's git history (commit `research:` entries). This document REPLACES it for v0.2 planning.

---

## Summary Table — New Dependencies for v0.2

| Purpose | Package | Version | Confidence | Runtime | Notes |
|---------|---------|---------|------------|---------|-------|
| Groq LLM + Whisper | `groq-sdk` | `^1.1.2` | HIGH | Node (Inngest fn) | Official SDK, covers chat + audio transcription |
| Cardano tx builder | `@meshsdk/core` | `1.9.0-beta.102` (pin exact) | MEDIUM | Node (Inngest fn) | Beta channel is current stable; pin exact version |
| Blockfrost provider | `@meshsdk/core` (re-exports `BlockfrostProvider`) | — | HIGH | Node | No separate install; Mesh bundles it |
| Blockfrost REST (fallback / metadata lookups) | `@blockfrost/blockfrost-js` | `^6.1.1` | HIGH | Node | Only install if Mesh's provider is insufficient for metadata queries; optional |
| Cloudflare Turnstile (React) | `@marsidev/react-turnstile` | `^1.3.0` (latest stable) | HIGH | Client | Server verification is plain `fetch` — no server SDK needed |
| Cal.com embed | `@calcom/embed-react` | `^1.5.3` | MEDIUM | Client | React 19 peer warning — install with `--legacy-peer-deps`; see Integration Risks |
| Clerk backend (already installed via `@clerk/nextjs`) | — | — | HIGH | Node | `@clerk/nextjs/server` re-exports `clerkClient` — no new dep |
| Cal.com webhook signing | — | — | HIGH | Node | Uses HMAC-SHA256 via `node:crypto` — no new dep |
| SHA256 hashing service | — | — | HIGH | Node | `node:crypto.createHash('sha256')` — no new dep |
| ICS calendar file | **DO NOT INSTALL** | — | — | — | Cal.com delegates scheduling end-to-end; `.ics` generation handled by Cal.com. Delete from scope. |

**Total new npm installs:** 4 (`groq-sdk`, `@meshsdk/core`, `@marsidev/react-turnstile`, `@calcom/embed-react`). Optional 5th: `@blockfrost/blockfrost-js` only if Mesh's bundled provider is insufficient.

---

## 1. Groq — `groq-sdk`

**Version:** `^1.1.2` (published April 2026; latest on npm as of research date)
**Install:** `npm install groq-sdk`
**Runtime:** Node.js (server-only — API key never ships to client)
**Models in scope for v0.2:**
- `llama-3.1-8b-instant` — fast classification, auto-draft CR content, consultation summary drafting
- `llama-3.3-70b-versatile` — consultation summary prose (`documentVersions.consultationSummary`), workshop summary from transcript
- `whisper-large-v3-turbo` — workshop recording transcription

### Rationale vs alternatives

| Option | Verdict | Why |
|--------|---------|-----|
| **`groq-sdk` (official)** | ✓ Use | Official, TypeScript-first, covers both `chat.completions` and `audio.transcriptions` in one client. 379 dependents on npm. Stable 1.x line. |
| `@ai-sdk/groq` (Vercel AI SDK provider) | ✗ Skip | Adds `ai` peer dep + provider abstraction we don't need. We're not multi-provider; direct SDK is simpler and has fewer layers to debug inside Inngest `step.run`. |
| OpenAI SDK in compat mode (Groq exposes OpenAI-shaped API) | ✗ Skip | Works but loses access to Groq-specific flags (e.g. `service_tier`). No upside over the official SDK. |
| `@langchain/groq` | ✗ Skip | LangChain framework overhead for three call-sites is unjustified. |
| Compound-beta agentic model | ✗ Explicitly out of scope | Per PROJECT.md Key Decision: direct inference is cheaper/sufficient for summarization + transcription + classification. |

### Integration with Next.js 16 + Vercel serverless

- Client instantiation: `new Groq({ apiKey: process.env.GROQ_API_KEY })` inside `src/lib/groq.ts` with the same `requireEnv()` fail-fast pattern as `src/lib/r2.ts`.
- All calls happen inside Inngest `step.run` blocks so retries memoize — same pattern as `feedback-reviewed.ts` Step 5 (`send-email`).
- Transcription: Whisper accepts audio files up to 25 MB per call (Groq limit). Workshop recordings longer than that must be chunked server-side — flag for Phase 17 planning.
- Vercel serverless function timeout: default 10s on Hobby, 60s on Pro. Whisper calls on long recordings can exceed this. **Solution:** always wrap in Inngest `step.run` — Inngest steps run independently with their own invocation budget, and the function persists state across Vercel invocations. Do NOT call Groq directly from a tRPC mutation; always emit an Inngest event.

### Env vars

```
GROQ_API_KEY=gsk_...           # required. Single key, no org separation.
```

Validate via `requireEnv('GROQ_API_KEY')` at module load in `src/lib/groq.ts`.

### Known incompatibilities with existing stack

- None with Drizzle HTTP, base-ui, Clerk, or Inngest. The SDK is a pure fetch-based client.
- Large responses (70B model with long context) may exceed Inngest's step payload size (see PITFALLS). Persist outputs to Postgres inside the same `step.run`, not as step return value.

**Sources:**
- [groq-sdk on npm](https://www.npmjs.com/package/groq-sdk)
- [Groq Client Libraries docs](https://console.groq.com/docs/libraries)
- [groq/groq-typescript GitHub](https://github.com/groq/groq-typescript)

---

## 2. Mesh SDK — `@meshsdk/core`

**Version:** `1.9.0-beta.102` — **PIN EXACT** (do not use `^`)
**Install:** `npm install @meshsdk/core@1.9.0-beta.102`
**Runtime:** Node.js only (server-side tx building inside Inngest fn)

### Rationale vs alternatives

| Option | Verdict | Why |
|--------|---------|-----|
| **`@meshsdk/core`** | ✓ Use | Unified TypeScript SDK: `MeshTxBuilder` + `BlockfrostProvider` + `MeshWallet` headless mode. Active development, supports Cardano preview-net, Node-friendly. One install covers tx build + sign + submit. |
| Lucid Evolution (`@lucid-evolution/lucid`) | ✗ Skip | Valid alternative but smaller ecosystem; Mesh has first-class Next.js guide and Blockfrost integration docs. Mesh was also the user's stated choice in PROJECT.md Key Decisions. |
| `cardano-serialization-lib` (raw) | ✗ Skip | Too low-level — we'd reimplement tx builder helpers that Mesh provides. |
| `@blockfrost/blockfrost-js` alone | ✗ Skip | Only covers chain queries, not tx construction/signing. |

### Why beta channel is acceptable

The 1.9 line has been in beta since late 2025. The Mesh team uses beta tags for new builds even after production readiness — beta.102 is the *current* version. The stable `1.8.x` line is older. **Pin exact** to guard against a broken beta push mid-development.

### Integration with Next.js 16 app router + Vercel serverless

**Server-side only** — import only inside:
- `src/lib/cardano.ts` (wallet + provider factory)
- `src/inngest/functions/milestone-ready.ts` and `version-published.ts` (tx build + submit)

Do NOT import from React components or client bundles. Mesh pulls in WASM modules (`@emurgo/cardano-serialization-lib-nodejs`) that do not tree-shake and will bloat client bundles if accidentally imported. Use `import 'server-only'` at the top of `src/lib/cardano.ts` to fail builds if it leaks to client.

**Vercel serverless gotcha — WASM cold start:** Mesh's Cardano serialization lib loads a ~5 MB WASM blob. First invocation on a cold Vercel function can take 1-3s. All Cardano calls MUST run inside Inngest `step.run` — never in a tRPC mutation that blocks user response. This aligns with the existing `feedbackReviewedFn` pattern.

**Serverless function size limit:** Vercel Hobby enforces a 250 MB unzipped limit (Pro: 250 MB). Adding Mesh + WASM + existing AWS SDK + Next.js runtime may push close. Flag for Phase 22 planning: if bundle size errors appear, route Cardano functions to a dedicated Inngest-only edge or move to `runtime: 'nodejs'` with explicit `includeFiles` in `vercel.json`.

### Wallet construction (server-side)

Preview-net requires a funded wallet. Use `MeshWallet` headless mode:
```ts
// pseudocode — research only
const provider = new BlockfrostProvider(env.BLOCKFROST_PROJECT_ID)
const wallet = new MeshWallet({
  networkId: 0,                  // 0 = preview/preprod, 1 = mainnet
  fetcher: provider,
  submitter: provider,
  key: { type: 'mnemonic', words: env.CARDANO_WALLET_MNEMONIC.split(' ') },
})
```

Mnemonic lives in Vercel env vars **encrypted-at-rest** (standard Vercel behavior). Never logged, never returned from tRPC. Access control: only the Inngest serve handler (`/api/inngest`) loads `src/lib/cardano.ts`.

### Env vars

```
BLOCKFROST_PROJECT_ID=previewXXXXXXXX...     # required. Preview-net-specific project ID.
CARDANO_WALLET_MNEMONIC=word1 word2 ...      # required. 15 or 24 words. Space-separated.
CARDANO_NETWORK_ID=0                          # required. 0=preview, 1=mainnet. Explicit to prevent accidental mainnet submit.
```

Validate via `requireEnv()` in `src/lib/cardano.ts`. Add an explicit assertion: `if (CARDANO_NETWORK_ID !== '0') throw` during v0.2 to prevent mainnet pivots before Phase 23 approval.

### Known incompatibilities

- **Drizzle HTTP driver:** irrelevant — Cardano code does no DB transactions. Writes go to `policyVersions.cardanoTxHash` / `milestones.cardanoTxHash` via separate Drizzle calls inside `step.run`.
- **base-ui / Clerk / Inngest:** no surface overlap.
- **Next.js 16 Turbopack client bundle:** will fail if accidentally imported client-side. `server-only` guard prevents this.
- **`@emurgo/cardano-serialization-lib-nodejs` is a native/WASM module** — cannot run on Edge runtime. Inngest functions must use `runtime: 'nodejs'` (default).

**Sources:**
- [@meshsdk/core on npm](https://www.npmjs.com/package/@meshsdk/core)
- [Mesh SDK Blockfrost Provider](https://meshjs.dev/providers/blockfrost)
- [Mesh SDK Headless Wallet (Server-Side)](https://meshjs.dev/apis/wallets/meshwallet)
- [Mesh SDK Transaction Builder](https://meshjs.dev/resources/solutions/transaction-builder)

---

## 3. Blockfrost — `@blockfrost/blockfrost-js` (OPTIONAL)

**Version:** `^6.1.1` (only if installed)
**Decision:** **Do NOT install by default.** `@meshsdk/core` re-exports `BlockfrostProvider` which covers all needs for v0.2 anchoring (UTXO fetch, protocol params, tx submit). Only install the standalone SDK if a future phase needs metadata queries Mesh's provider doesn't surface (e.g. asset metadata endpoints).

### Blockfrost free tier limits (STARTER plan)

- **50,000 requests / day** — free forever
- **10 requests / second** sustained, **500 request burst** (10 rps cool-off)
- **1 project** — free account gets ONE API key, which maps to ONE network. Create the project as **Cardano Preview** during Phase 22 setup. Upgrading to a second network requires a paid plan or a second free account.
- **1 webhook**, **100 MB IPFS storage** (not used)

**Estimated v0.2 load (sanity check):**
- Per version published: 1 fetch UTXOs + 1 submit tx + 1 confirmation poll = ~3 requests
- Per milestone completed: same, ~3 requests
- Preview-net policy work at PolicyDash scale: <100 anchoring events/day
- Total: ~300 requests/day worst case, 150x headroom under free limit ✓

### Env vars

```
BLOCKFROST_PROJECT_ID=previewXXXXXXXX         # shared with Mesh SDK section — same key
```

### Known incompatibilities

- None. HTTP-only REST, works anywhere Node runs.
- **Important:** the project ID prefix (`preview` / `preprod` / `mainnet`) MUST match the network ID passed to Mesh. Mismatched project+network is the #1 Blockfrost error. Assert at load time.

**Sources:**
- [@blockfrost/blockfrost-js on npm](https://www.npmjs.com/package/@blockfrost/blockfrost-js)
- [Blockfrost Plans and Billing](https://blockfrost.dev/overview/plans-and-billing)
- [Blockfrost Getting Started](https://blockfrost.dev/overview/getting-started)

---

## 4. Cloudflare Turnstile — `@marsidev/react-turnstile`

**Version:** `^1.3.0` (latest stable)
**Install:** `npm install @marsidev/react-turnstile`
**Runtime:** Client widget + server verification via plain `fetch` (no server SDK needed)

### Rationale vs alternatives

| Option | Verdict | Why |
|--------|---------|-----|
| **`@marsidev/react-turnstile`** | ✓ Use | Officially recommended by the Cloudflare Turnstile team. Next.js 16 App Router demo exists. React 19 compatible. Clean `Turnstile` component with ref-based imperative API (reset, getResponse). |
| `react-turnstile` (sarneeh/react-turnstile) | ✗ Skip | Also officially recommended but less active. marsidev is the more current option. |
| Raw `<script>` + manual binding | ✗ Skip | Manual DOM lifecycle on Next.js app router is error-prone with React 19 Strict Mode double-mounts. |

### Integration with Next.js 16 app router

**Client component (`src/components/public/participate-form.tsx`):**
```tsx
'use client'
import { Turnstile } from '@marsidev/react-turnstile'
// ...
<Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={setToken} />
```

**Server verification (inside the tRPC public procedure or server action):**
- POST to `https://challenges.cloudflare.com/turnstile/v0/siteverify`
- Body: `{ secret: TURNSTILE_SECRET_KEY, response: token, remoteip: headers['x-forwarded-for'] }`
- No SDK, just `fetch`. Verify once, then proceed to Clerk invitation creation.

### Where to verify in PolicyDash

The `/participate` submission must:
1. Verify Turnstile token server-side (rejects on failure → 403)
2. Create Clerk user via `clerkClient.users.createUser({ phoneNumber: [...], emailAddress: [...] })` (see Clerk section)
3. Emit `participate.intake` Inngest event
4. Return success

Do NOT verify inside an Inngest step — rate-limit enforcement needs to happen at the edge of the request, before work is enqueued.

### Env vars

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0xAAAAAAAAAAAAAAAAAA   # required, client-safe (ships to browser)
TURNSTILE_SECRET_KEY=0xBBBBBBBBBBBBBBBBBB              # required, server-only
```

The `NEXT_PUBLIC_` prefix is the Next.js convention for client-exposed vars — this is correct and safe for Turnstile site keys.

### Known incompatibilities

- **None with base-ui** (Turnstile renders its own iframe — no component conflict).
- **Clerk middleware:** `proxy.ts` must NOT protect `/participate` or the Turnstile verification endpoint. Add to `clerkMiddleware` public routes list.
- **Next.js 16 Turbopack dev:** widget fails to render if the domain isn't in the Turnstile site's allowed hostnames. Add `localhost` to the Cloudflare dashboard during dev.

**Sources:**
- [@marsidev/react-turnstile on npm](https://www.npmjs.com/package/@marsidev/react-turnstile)
- [React Turnstile server validation docs](https://docs.page/marsidev/react-turnstile/validating-a-token)
- [React Turnstile GitHub](https://github.com/marsidev/react-turnstile)

---

## 5. Cal.com — `@calcom/embed-react` + webhooks + REST API

### Hosted vs self-hosted decision

**Use Cal.com HOSTED free tier for v0.2 launch.**

| Factor | Hosted (cal.com) | Self-hosted |
|--------|------------------|-------------|
| Cost | Free forever | $5–50/mo infra + ops |
| Webhooks | ✓ included free | ✓ included |
| REST API (v1 + v2) | ✓ included free | ✓ included |
| Workshop/group event types | ✓ included | ✓ included |
| HTTPS requirement | Only HTTPS webhook URLs (blocks localhost) | Accepts HTTP + private IPs |
| Ops burden | Zero | Postgres + maintenance |
| Time to v0.2 launch | Hours | Days |

**Verdict:** Hosted free covers all v0.2 needs (unlimited bookings, webhooks, workflows, REST API). Only downside is local dev can't receive webhooks without a tunnel — use `cloudflared` or `ngrok` for Phase 20 integration testing. Self-hosting is a deferred decision — revisit only if we need paragraph-level webhook filtering or HTTP-only internal dev webhooks.

### `@calcom/embed-react` — version and integration

**Version:** `^1.5.3` (latest on npm)
**Install:** `npm install @calcom/embed-react --legacy-peer-deps`

**⚠ Known Integration Risk — MEDIUM confidence:** `@calcom/embed-react@1.5.x` has a `peerDependencies` entry pinned to `react ^18.2.0`. PolicyDash runs React 19.2.4. Installation requires `--legacy-peer-deps` or `--force`. Runtime compatibility reports from the Cal.com repo (issues #18399, #20814, #20990) indicate the embed *works* on React 19 — the peer is stale, not the code. **Validate in Phase 20 with a smoke test** before committing to the integration; fallback plan below.

**Fallback if embed-react breaks on React 19 Strict Mode:**
- Use raw `<iframe src="https://cal.com/<username>/<event-type>">` directly. No npm dep needed. Cal.com supports iframe embed natively. Loses prefill via `getCalApi` but we can prefill via URL query params (`?name=&email=&phone=`).

### Next.js 16 app router integration pattern

```tsx
// src/components/public/workshop-register-embed.tsx
'use client'
import { useEffect } from 'react'
import { getCalApi } from '@calcom/embed-react'
import Cal from '@calcom/embed-react'

export function WorkshopRegisterEmbed({ calLink }: { calLink: string }) {
  useEffect(() => {
    ;(async () => {
      const cal = await getCalApi({ namespace: 'workshop' })
      cal('ui', { hideEventTypeDetails: false, layout: 'month_view' })
    })()
  }, [])
  return <Cal namespace="workshop" calLink={calLink} style={{ width: '100%', height: '100%' }} />
}
```

Must be a client component (`'use client'`). Dynamic-import from server components with `next/dynamic({ ssr: false })` pattern if you need to gate on auth server-side.

### Cal.com webhooks in PolicyDash

**Events to subscribe to (set up manually in Cal.com dashboard during Phase 20):**
- `BOOKING_CREATED` → create `workshopRegistrations` row + invite user via Clerk
- `BOOKING_RESCHEDULED` → update row
- `BOOKING_CANCELLED` → mark registration cancelled
- `MEETING_ENDED` (a.k.a. `BOOKING_COMPLETED`) → mark attendance; emit `workshop.feedback_link_send` event

**Webhook handler:** new route `app/api/webhooks/cal/route.ts` (Node runtime). Must:
1. Be added to `clerkMiddleware` public routes (webhook has no Clerk session).
2. Verify HMAC-SHA256 signature using `CAL_WEBHOOK_SECRET` and `node:crypto`. Cal.com sends the signature in the `X-Cal-Signature-256` header. No new npm dep.
3. Parse body, emit Inngest event, return 200 quickly (webhook providers require fast ACK).

### Env vars

```
CAL_API_KEY=cal_live_...          # required. From Cal.com dashboard → API Keys.
CAL_WEBHOOK_SECRET=...             # required. Generated when creating the webhook.
NEXT_PUBLIC_CAL_USERNAME=policydash # optional, convenience for embed calLink construction.
```

`@calcom/embed-react` itself needs no env var — the Cal.com origin is embedded in the package.

### Known incompatibilities

- **React 19 peer warning** — see above. Install with `--legacy-peer-deps`.
- **base-ui / shadcn-nova theme:** Cal.com embed renders inside an iframe, so CSS scoping is clean. The iframe background is configurable via the Cal.com UI settings to match the PolicyDash white/slate/saffron theme.
- **Clerk middleware:** `/api/webhooks/cal` and `/workshops/*/register` must be in the `publicRoutes` matcher. Failing to do this returns 401 to Cal.com's webhook — silent data loss.
- **Next.js 16 Turbopack dev:** iframe loads fine; no known issue.
- **tRPC:** webhook handler is a plain Next.js route, not tRPC — tRPC would add auth context overhead we don't need.

### Delete from scope

**DO NOT install `ics` npm package.** Cal.com generates and sends `.ics` attachments in its own booking confirmation emails. Attempting to also generate our own would produce duplicate calendar events. The Phase 20 scope entry for "ICS calendar file generation" should be deleted from the roadmap.

**Sources:**
- [@calcom/embed-react on npm](https://www.npmjs.com/package/@calcom/embed-react)
- [Cal.com Webhooks docs](https://cal.com/docs/developing/guides/automation/webhooks)
- [Cal.com React 19 peer dependency issue #20814](https://github.com/calcom/cal.com/issues/20814)
- [Cal.com Next.js embed issue #15772](https://github.com/calcom/cal.com/issues/15772)
- [Cal.com free plan features](https://cal.com/faq)

---

## 6. Clerk invitations vs createUser for public auto-register

**Problem:** v0.1 `/participate` currently uses `clerkClient.users.createUser()` (phone-only). v0.2 needs public auto-register from both `/participate` (phone OR email+phone) and Cal.com webhook (email from booking). Decision: which API is right?

### Decision: Keep `users.createUser` for phone flows; use `invitations.createInvitation` ONLY for email-first Cal.com bookings.

| API | Use in v0.2 | Why |
|-----|-------------|-----|
| **`clerkClient.users.createUser({ phoneNumber, emailAddress })`** | ✓ `/participate` form | Synchronous: user exists immediately, our webhook can reconcile role assignment. Works with phone-only instance because `phoneNumber` is a valid primary identifier. Email + phone auto-marked as verified. Matches v0.1 existing pattern — minimal migration. |
| **`clerkClient.invitations.createInvitation({ emailAddress })`** | ✓ Cal.com webhook path (email-only from booking) | Cal.com gives us an email, not a phone. `invitations` API sends a verification email with a sign-up link. User completes phone setup on first sign-in. Avoids creating a half-valid phone-less user in a phone-only Clerk instance. |
| Mixed/either | ✗ Don't try to pick dynamically | Branching makes reconciliation webhook logic complex. Have two explicit code paths. |

### Critical caveat — Clerk phone-only instance

The Clerk dashboard setting "phone number required" means `createUser` without a `phoneNumber` will fail. The `/participate` form MUST collect phone before calling `createUser`. The Cal.com webhook CAN'T collect phone (Cal.com's booking form doesn't ask for it by default — configure a custom question in Cal.com to capture phone, then you can use `createUser` for both paths).

**Recommended simplification:** Add a required "Phone number" custom question to the Cal.com event type. Then BOTH code paths use `createUser`, and we skip `invitations` entirely. This is the simplest v0.2 architecture.

**Fallback if custom questions don't work as expected on Cal.com free tier:** drop to `invitations.createInvitation` for Cal.com path and eat the two-code-path complexity.

### No new dependency

`@clerk/nextjs@^7.0.6` already installed. Import:
```ts
import { clerkClient } from '@clerk/nextjs/server'
const client = await clerkClient()
await client.users.createUser({ phoneNumber: ['+91...'], emailAddress: ['x@y.com'] })
// or
await client.invitations.createInvitation({ emailAddress: 'x@y.com', redirectUrl: '/welcome' })
```

### Known incompatibilities

- Clerk webhook (`/api/webhooks/clerk`) in v0.1 already reconciles `user.created` events to the `users` table. The auto-registration flow relies on this webhook firing AFTER `createUser` returns — there is a race. **Mitigation:** in the `/participate` route handler, after `createUser` returns, upsert the `users` table directly (don't wait for the webhook). The webhook remains the fallback for out-of-band user creation.
- **Inngest `participateIntake` fn** should NOT call `createUser` itself — do it in the route handler so the user sees the sign-up-success response synchronously. Inngest gets the `userId` in its event payload and only handles side effects (welcome email, role assignment, notifications).

**Sources:**
- [Clerk createUser() Backend SDK](https://clerk.com/docs/reference/backend/user/create-user)
- [Clerk createInvitation() Backend SDK](https://clerk.com/docs/reference/backend/invitations/create-invitation)
- [Clerk Invite users docs](https://clerk.com/docs/guides/users/inviting)

---

## 7. SHA256 hashing service — `node:crypto`

**Decision:** No new dependency. Use built-in `node:crypto`.

```ts
// src/lib/hashing.ts
import { createHash } from 'node:crypto'

export function sha256(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex')
}

export function canonicalJsonSha256(obj: unknown): string {
  // RFC 8785 JSON Canonicalization Scheme — needed so hashes are stable
  // across key-ordering changes. IF we need strict canonicalization, add
  // `canonicalize` npm pkg (~1KB). Otherwise a sorted JSON.stringify is
  // sufficient for v0.2 since we control the input shape.
  return sha256(stableStringify(obj))
}
```

**Optional add-on:** If Phase 22 determines that hash stability across object key reordering matters (it likely does for milestone JSON submitted to Cardano metadata), add `canonicalize` (`npm i canonicalize`) — 1.5 KB, single-function lib implementing RFC 8785. Flag for Phase 22 planning, not installed now.

**Runtime:** Node.js only. Edge runtime has Web Crypto (`crypto.subtle.digest('SHA-256', ...)`), but all hashing in PolicyDash v0.2 happens server-side inside Inngest functions, which run in Node.

### Env vars

None.

### Known incompatibilities

None. Built into Node.

---

## 8. Delete from scope

| Package | Why we do NOT install |
|---------|----------------------|
| `ics` / `ical-generator` | Cal.com handles calendar invites end-to-end. Installing our own `.ics` generator creates duplicate events in users' calendars. See PROJECT.md Key Decision "Cal.com delegated scheduling". |
| `openai` (compat mode for Groq) | `groq-sdk` is the official path. |
| `@ai-sdk/groq` / `ai` (Vercel AI SDK) | Framework overhead unnecessary for 3 call-sites. |
| `@langchain/groq` / LangChain | Same reason. |
| Lucid Evolution | Mesh SDK chosen per Key Decisions. |
| `cardano-serialization-lib-browser` | All Cardano code runs server-side. |
| `node-cron` / `agenda` / `bullmq` | Inngest already handles scheduling. |
| Custom captcha (hCaptcha / reCAPTCHA) | Turnstile chosen (free, privacy-first, Cloudflare-native). |
| n8n / Zapier / Make SDKs | Excluded by PROJECT.md Key Decision "All automation in-code via Inngest". |

---

## Install Commands (consolidated)

```bash
# v0.2 new dependencies — run in one go
npm install groq-sdk@^1.1.2
npm install @meshsdk/core@1.9.0-beta.102          # PIN EXACT — no caret
npm install @marsidev/react-turnstile@^1.3.0
npm install @calcom/embed-react@^1.5.3 --legacy-peer-deps

# Optional, only if Mesh's BlockfrostProvider proves insufficient during Phase 22
# npm install @blockfrost/blockfrost-js@^6.1.1

# Optional, only if Phase 22 requires RFC 8785 canonicalization
# npm install canonicalize
```

After install, run `npm ls react react-dom` to confirm React 19 is unshaken (the `--legacy-peer-deps` flag suppresses the Cal.com warning but should not perturb the resolved tree).

---

## Environment Variables — complete new-dep list

Add to `.env.example` and validate via `requireEnv()` in the corresponding `src/lib/*.ts` module, matching the R2 pattern:

```bash
# Groq — src/lib/groq.ts
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Cardano / Blockfrost — src/lib/cardano.ts
BLOCKFROST_PROJECT_ID=previewxxxxxxxxxxxxxxxxxxxxxxxx
CARDANO_WALLET_MNEMONIC=word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15
CARDANO_NETWORK_ID=0

# Cloudflare Turnstile — validated in tRPC public procedure
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0xAAAAAAAAAAAAAAAAAA
TURNSTILE_SECRET_KEY=0xBBBBBBBBBBBBBBBBBB

# Cal.com — src/lib/cal.ts (REST client) + app/api/webhooks/cal/route.ts (webhook verify)
CAL_API_KEY=cal_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CAL_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_CAL_USERNAME=policydash
```

**Pattern enforcement:** Every new `src/lib/*.ts` wrapper for a v0.2 dep MUST call `requireEnv()` at module load, mirroring `src/lib/r2.ts`. This fails fast at import time rather than producing confusing errors at first use (the R2 commit history shows why — R2_ENDPOINT=undefined produced misleading CORS errors; we want equivalent guardrails for GROQ_API_KEY, BLOCKFROST_PROJECT_ID, CARDANO_WALLET_MNEMONIC, etc).

Also add a `.env.example` update in Phase 19 (first v0.2 phase that touches env) so future onboarders aren't bitten.

---

## Integration Points with Existing Locked Stack

| Existing | New dep touchpoint | Rule |
|----------|--------------------|------|
| **Next.js 16 app router** | Cal.com embed, Turnstile widget | Both are client components (`'use client'`). Never import Mesh or groq-sdk from client components. |
| **tRPC v11** | Turnstile server verification, Clerk createUser, Cal.com REST API | Happens in public procedures / protected mutations. All LLM + Cardano work DELEGATED to Inngest events. |
| **Drizzle + Neon HTTP** | Cardano fn writes `cardanoTxHash`, Groq fn writes `consultationSummary` | Remember: no `db.transaction()` on HTTP driver for some ops — write one row at a time inside separate `step.run` blocks. Existing pattern in `feedback-reviewed.ts`. |
| **Clerk phone-only** | `createUser` with phone+email | Phone must be collected BEFORE `createUser`. `invitations` is the email-only fallback but introduces branching — avoid if Cal.com custom question works. |
| **R2 + AWS SDK** | Workshop recordings uploaded to R2, then passed to Groq Whisper via presigned GET URL | Groq Whisper accepts a URL or file upload; passing R2 presigned URL avoids re-downloading into Inngest memory. Same pattern as existing evidence-pack flow. |
| **Inngest** | ALL Groq calls, ALL Cardano tx calls, Cal.com webhook side effects, `participateIntake` welcome email | `step.run` blocks for every external call. Match `feedbackReviewedFn` style: `fetch-X` steps, idempotent writes. Never fan out more than necessary — Inngest memoizes retries. |
| **XState 5** | Workshop lifecycle machine (Phase 17) emits events to Inngest when transitioning | State transitions live in tRPC mutations; Inngest handles durable side effects. |
| **base-ui / shadcn-nova** | Turnstile + Cal.com both render inside iframes | No component collision. Style iframe container with Tailwind, not the iframe content. |
| **Resend** | Groq-generated consultation summaries emailed via existing `sendFeedbackReviewedEmail` pattern | New email templates go in `src/lib/email.ts` / `@react-email/components`, same shape as existing. No new email dep. |
| **Vitest** | Tests for hashing service, Groq prompt builders (mocked), Turnstile verify (mocked), Cal webhook HMAC verify | All mockable. Don't hit live Groq/Blockfrost in tests — use `vi.mock('groq-sdk')`. |
| **Vercel serverless** | Mesh WASM cold start, Groq Whisper latency, Cal.com webhook response time | Mitigation: everything external goes through Inngest. User-facing routes (`/participate`, `/api/webhooks/cal`) do minimal work (verify → enqueue → 200) and stay under Vercel's 10s hobby timeout. |

---

## Confidence Assessment

| Dep | Confidence | Reason |
|-----|------------|--------|
| `groq-sdk` | HIGH | Context7-unavailable but official SDK, version verified via npm registry (1.1.2), 379 dependents, stable 1.x. |
| `@meshsdk/core` | MEDIUM | Current version is on `beta` tag. Production-grade per docs but pin-exact required. Has been the Mesh team's active line since late 2025. |
| `@blockfrost/blockfrost-js` | HIGH | Version 6.1.1 verified on npm. Free tier limits verified (50K req/day, preview-net supported). Mature lib. |
| `@marsidev/react-turnstile` | HIGH | Officially recommended by Cloudflare Turnstile team. Next.js 16 demo exists. |
| `@calcom/embed-react` | MEDIUM | React 19 peer-dep warning is a real friction point. Install path requires `--legacy-peer-deps`. Runtime compatibility is plausibly fine (GitHub issues say package itself works) but **MUST be validated in a Phase 20 smoke test**. Fallback plan (raw iframe) is cheap. |
| `clerkClient.invitations` vs `createUser` | HIGH (recommendation) / MEDIUM (Cal.com custom-question path) | Core decision is clear. The "collect phone via Cal.com custom question" path is the simplest and should be validated empirically — it may have a UX wart where phone input is non-E.164. |
| `node:crypto` SHA256 | HIGH | Built-in, deterministic, zero risk. |
| Cal.com hosted free tier | HIGH | Published free-tier features include webhooks, REST API, unlimited bookings, workflows. Verified against cal.com docs + G2 pricing pages. |
| Blockfrost free tier capacity | HIGH | 50K req/day vs ~300/day estimated load. 150× headroom. |

---

## Research Flags for Phase Planning

These are items research couldn't fully validate — flag for targeted Phase research:

1. **Phase 17 (workshop recording → Whisper):** validate 25MB upload limit handling path. If average recording > 25MB, need chunking strategy.
2. **Phase 19 (Turnstile):** confirm `publicRoutes` matcher in `proxy.ts` excludes `/participate` and the tRPC verify endpoint.
3. **Phase 20 (Cal.com):** end-to-end smoke test MUST run before locking `@calcom/embed-react`. Alternative plan: raw iframe embed if React 19 Strict Mode breaks the official component.
4. **Phase 20 (Cal.com custom question for phone):** verify Cal.com free tier supports required custom questions on event types. If not, switch the email-only path to `invitations.createInvitation`.
5. **Phase 22 (SHA256 canonicalization):** decide on `canonicalize` (RFC 8785) vs sorted `JSON.stringify`. Matters because the hash is submitted to Cardano and must be reproducible.
6. **Phase 22 (Mesh WASM bundle size):** first Vercel deploy after Mesh install — check `Function Sizes` in Vercel dashboard. If near 250MB cap, reconfigure `next.config.ts` serverComponentsExternalPackages or move to a standalone Inngest-only deployment target.
7. **Phase 23 (Cardano preview-net funded wallet):** user must provide mnemonic + fund wallet from preview-net faucet BEFORE Phase 23 can validate. Gate the phase on this handoff.

---

## Cross-check vs v0.1 STACK.md

This document REPLACES the previous v0.1 STACK.md for planning purposes. All v0.1 decisions (Next.js 16, tRPC v11, Drizzle, Clerk phone, R2, Inngest, Tiptap 3, XState 5, Resend, shadcn-nova on base-ui, Vercel, Vitest) remain locked and are NOT re-evaluated. Items removed from v0.1 scope (Yjs, Hocuspocus, `@tiptap/extension-collaboration`, `@tiptap/extension-collaboration-caret`) are being torn out in v0.2 Phase 14 per PROJECT.md "Collab rollback" — those dependency removals are tracked in the roadmap, not this research file.
