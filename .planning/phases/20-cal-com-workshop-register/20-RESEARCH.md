# Phase 20: Cal.com Workshop Register — Research

**Researched:** 2026-04-14
**Domain:** cal.com webhooks, event-type provisioning, embed-react, Inngest Clerk invite pattern, JWT feedback tokens, Next.js 16 caching APIs
**Confidence:** HIGH (all critical unknowns resolved with primary sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Workshop create stays in the existing tRPC mutation; cal.com event-type creation is async via Inngest (`workshopCreatedFn`). Mutation persists row with `calcomEventTypeId=null` and emits `workshop.created` event. Inngest backfills `calcomEventTypeId`.

**D-02:** Default cal.com event-type location is Cal Video. No per-workshop location selector in this phase.

**D-03:** Workshop row persists even if cal.com create fails. Retries: 3, 5xx → retry, 4xx → NonRetriableError. Public embed surfaces only when `calcomEventTypeId` is non-null.

**D-04:** Single shared cal.com org account, one API key in env (`CAL_API_KEY`). Per-admin OAuth is out of scope. `workshops.createdBy` is informational only.

**D-05:** Modal popup on Register click. Card list renders title/description/scheduledAt/spots-left. Lazy-load `@calcom/embed-react`.

**D-06:** Three sections — Upcoming (`status='upcoming' AND scheduled_at > now()`), Live (`status='in_progress'`), Past (`status='completed' AND scheduled_at < now()`).

**D-07:** Spots-left: `{capacity − registered_count}`. `maxSeats` NULL = open registration (no number). Server-rendered with 60-second cache keyed on workshopId.

**D-08:** `/workshops` and `/api/webhooks/cal` added to proxy.ts PUBLIC_ROUTES.

**D-09:** New table `workshopRegistrations` with columns: `id`, `workshopId`, `bookingUid` (UNIQUE), `email`, `emailHash`, `name`, `userId NULL`, `status` enum, `cancelledAt`, `attendedAt`, `attendanceSource` enum, `bookingStartTime`, `createdAt`, `updatedAt`.

**D-10:** No separate `workshopAttendance` table. Attendance = `attendedAt IS NOT NULL` on registration row.

**D-11:** Unknown-email Clerk invite is async via Inngest (`workshopRegistrationReceivedFn`). Same pattern as `participateIntakeFn`.

**D-12:** Walk-in handling: synthesize registration row, generate synthetic `bookingUid` (`walkin:{workshopId}:{emailHash}`), enqueue `workshop.registration.received`.

**D-13:** Route handler `app/api/webhooks/cal/route.ts`. Raw body via `await req.text()` BEFORE parse. HMAC-SHA256 with `CAL_WEBHOOK_SECRET`. Header: `X-Cal-Signature-256` (lowercase in HTTP: `x-cal-signature-256`). Hex encoding. `crypto.timingSafeEqual`. Reject bad sig with 401.

**D-14:** Events: `BOOKING_CREATED`, `BOOKING_CANCELLED`, `BOOKING_RESCHEDULED`, `MEETING_ENDED`. BOOKING_RESCHEDULED creates a NEW uid; the original uid is in `rescheduleUid`. Handler must match on `rescheduleUid` (the old bookingUid) for update. `BOOKING_COMPLETED` does not exist — `MEETING_ENDED` is the correct event.

**D-15:** Idempotency via DB UNIQUE INDEX on `bookingUid`. No separate `processedWebhookEvents` table.

**D-16:** `workshop.feedback.invite` event per attendee, emitted by `MEETING_ENDED` handler. `workshopFeedbackInviteFn` sends email immediately.

**D-17:** Deep-link JWT: HS256, payload `{ workshopId, email, exp: now+14d, iat }`, signed with `WORKSHOP_FEEDBACK_JWT_SECRET`. Implemented in `src/lib/feedback-token.ts` using Node `crypto.createHmac`. No external JWT library needed.

**D-18:** `/participate` mode-switch. `workshopId` query param present → validate JWT → render feedback form (rating + comment + optional sectionId). Submit to `/api/intake/workshop-feedback`. Creates `feedbackItems` row with `source='workshop'` AND `workshopFeedbackLinks` row. Turnstile NOT required (JWT is proof of legitimacy).

### Claude's Discretion

None documented in CONTEXT.md — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

- Per-admin cal.com OAuth
- Configurable event-type location per workshop
- Public listing pagination / infinite scroll
- Capacity "fully booked" admin alert / waitlist
- Reschedule/cancel notifications to admins
- No-show analytics / engagement scoring (Phase 24)
- Anonymized cal.com payload retention policy
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WS-07 | Workshop linked to cal.com event type via `calcomEventTypeId` FK on `workshops` | D-01: async Inngest create; cal.com API v2 POST /v2/event-types confirmed; `calcomEventTypeId text` column to add |
| WS-08 | Public `/workshops` listing shows upcoming workshops with cal.com embed for registration | D-05/D-06: three-section SSR page; `@calcom/embed-react` 1.5.3 confirmed React 19 compatible; lazy-load via `next/dynamic` ssr:false |
| WS-09 | Cal.com webhook handler verifies HMAC-SHA256 signature on raw request body before processing | D-13: header confirmed `x-cal-signature-256`, hex encoding confirmed; `req.text()` before JSON.parse is the correct pattern |
| WS-10 | `BOOKING_CREATED` webhook creates `workshopRegistrations` row, auto-inviting unknown emails via Clerk | D-09/D-11: schema defined; Inngest fn mirrors participateIntakeFn exactly |
| WS-11 | `MEETING_ENDED` webhook transitions workshop to `completed` and auto-populates attendance | D-14: MEETING_ENDED confirmed; flat payload research completed — payload IS wrapped in `payload` object per current docs; MEETING_ENDED attendees include id, email, name, timeZone, phoneNumber, locale, bookingId, noShow |
| WS-15 | Post-workshop feedback link emailed to attendees; back-links via `workshopFeedbackLinks` | D-16/D-17/D-18: JWT token, feedback-token.ts lib, mode-switch on /participate, workshop-feedback API route; `feedbackItems.source='workshop'` requires new enum value + migration |
</phase_requirements>

---

## Summary

Phase 20 wires the public cal.com registration loop into PolicyDash. The phase has 18 locked decisions covering every moving part, so the planner's job is to sequence implementation correctly rather than make design choices.

The seven key technical answers from research:

1. **cal.com signature header** is `x-cal-signature-256` (case-insensitive HTTP, always lowercase). Encoding is **hex**. HMAC-SHA256 over raw body with Node `crypto.createHmac`. This is confirmed by official cal.com docs.

2. **BOOKING_RESCHEDULED creates a new uid.** The new uid is in `payload.uid`; the original is in `payload.rescheduleUid`. D-14's assumption that rescheduling "preserves the same bookingUid" is INCORRECT per official docs and GitHub issues. The handler MUST match on `rescheduleUid` (the old uid) to find the existing registration, then optionally update with the new uid or simply update `bookingStartTime`. The plan must address this divergence from D-14.

3. **MEETING_ENDED payload wraps data in a `payload` object** (same as all other events), not a flat spread. Earlier reports of a flat payload were from an old cal.com bug that appears corrected in current documentation. The safe coding approach is to handle both: try `payload.uid ?? body.uid`.

4. **`unstable_cache` is replaced by `use cache` directive in Next.js 16.** The Next.js docs in this project confirm this. D-07 must use `'use cache'` with `cacheTag(workshopId)` and `cacheLife('seconds', 60)` instead of `unstable_cache`. The `cacheComponents` flag must be checked in `next.config.ts` — it is currently NOT enabled.

5. **`feedbackItems.source` column does not exist** in the schema. D-18's requirement to write `source='workshop'` requires adding both a new `pgEnum` column and a migration. This is a required schema change.

6. **No JWT library exists in this project.** Package.json has no `jose` or `jsonwebtoken`. D-17's `src/lib/feedback-token.ts` must implement HS256 using Node `crypto.createHmac('sha256', secret).update(payload).digest('base64url')`. The token is a simple JSON payload — no full JWT library needed.

7. **`@calcom/embed-react` 1.5.3 supports React 19** (peerDependencies: `"react": "^18.2.0 || ^19.0.0"`). Install is safe without overrides. The `<Cal>` component takes `calLink` prop (the scheduling link slug/URL), `namespace` for isolation, and optional `config` object.

**Primary recommendation:** Sequence as Wave 0 (TDD RED contracts) → Wave 1 (schema migration + events registration) → Wave 2 (webhook handler + Inngest functions) → Wave 3 (public page + embed) → Wave 4 (feedback mode-switch + feedback route) → Wave 5 (proxy whitelist + proxy.ts).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@calcom/embed-react` | 1.5.3 | Cal.com scheduling embed component | Official cal.com React package; React 19 compatible |
| `next/dynamic` | (built-in, Next.js 16.2.1) | Lazy-load cal.com embed with `ssr: false` | Prevents SSR of browser-only cal.com bundle |
| `crypto` (Node built-in) | built-in | HMAC-SHA256 for webhook signature + JWT signing | No external dep needed; already used in participate route |
| `drizzle-orm` | 0.45.1 | ORM for new schema tables and queries | Already in use; same patterns as existing tables |
| `inngest` | 4.2.1 | Async functions for Clerk invite + email | Already in use; three new event types to register |
| `resend` | 6.9.4 | Transactional email (registration confirm + feedback invite) | Already in use; add two new helpers to `src/lib/email.ts` |
| `zod` | 4.3.6 | Schema validation for webhook body + feedback form | Already in use; note z.guid() not z.uuid() for IDs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@clerk/nextjs` | 7.0.6 | Clerk invitation API for auto-onboarding | Already in use; `invitations.createInvitation` with `ignoreExisting: true` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Node crypto for JWT | `jose` library | jose is more complete but unnecessary for simple HS256 HMAC; avoids new dep |
| `'use cache'` directive | `unstable_cache` | unstable_cache is replaced in Next.js 16; use the new directive |

**Installation:**
```bash
npm install @calcom/embed-react
```

**Version verification:**
```bash
npm view @calcom/embed-react version  # → 1.5.3 (verified 2026-04-14)
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 20 additions)

```
app/
├── (public)/
│   ├── workshops/
│   │   ├── page.tsx                  # SSR listing page with 'use cache'
│   │   └── _components/
│   │       ├── cal-embed.tsx         # <Cal> wrapper (client, loaded by dynamic)
│   │       └── workshop-card.tsx     # Upcoming/live/past card variants
│   └── participate/                  # Existing — extend for mode-switch
│       ├── page.tsx                  # Extend: read workshopId+token params
│       └── _components/
│           └── workshop-feedback-form.tsx  # New client component
├── api/
│   ├── webhooks/
│   │   └── cal/
│   │       └── route.ts              # HMAC-verified webhook handler
│   └── intake/
│       └── workshop-feedback/
│           └── route.ts              # POST feedback submission (JWT-gated)
src/
├── db/schema/
│   └── workshops.ts                  # Add: calcomEventTypeId, maxSeats, workshopRegistrations, 2 new enums
├── db/migrations/
│   └── 0011_cal_com_workshop_register.sql  # New migration
├── inngest/
│   ├── events.ts                     # Add: workshop.created, workshop.registration.received, workshop.feedback.invite
│   └── functions/
│       ├── workshop-created.ts       # Cal.com event-type provisioning
│       ├── workshop-registration-received.ts  # Clerk invite + confirmation email
│       └── workshop-feedback-invite.ts        # Feedback invite email
└── lib/
    ├── email.ts                      # Add: sendWorkshopRegistrationEmail, sendWorkshopFeedbackInviteEmail
    └── feedback-token.ts             # NEW: signFeedbackToken, verifyFeedbackToken (HS256)
```

### Pattern 1: Webhook Handler (HMAC-verify-then-dispatch)

**What:** Raw body read first, HMAC-SHA256 verify, then route by `triggerEvent`.
**When to use:** All webhook routes receiving untrusted external payloads.

```typescript
// Source: D-13 + app/api/webhooks/clerk/route.ts pattern (adapted)
// app/api/webhooks/cal/route.ts
import { createHmac, timingSafeEqual } from 'node:crypto'

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CAL_WEBHOOK_SECRET
  if (!secret) return new Response('Misconfigured', { status: 500 })

  // MUST read raw body BEFORE any parse (signature covers raw bytes)
  const rawBody = await req.text()

  const sig = req.headers.get('x-cal-signature-256') ?? ''
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const sigBuf = Buffer.from(sig, 'hex')
  const expBuf = Buffer.from(expected, 'hex')

  if (sigBuf.length === 0 || sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return new Response('Invalid signature', { status: 401 })
  }

  const body = JSON.parse(rawBody) as CalWebhookBody
  // ... dispatch by body.triggerEvent
}
```

### Pattern 2: Inngest Function (Clerk Invite + Email)

**What:** Mirror of `participateIntakeFn` for workshop registration.
**When to use:** Any async processing that needs Clerk invite + email.

```typescript
// Source: src/inngest/functions/participate-intake.ts (existing reference impl)
// Critical: triggers MUST be inlined (Pitfall 4 — type widening footgun)
export const workshopRegistrationReceivedFn = inngest.createFunction(
  {
    id: 'workshop-registration-received',
    name: 'Workshop registration received — Clerk invite + confirmation email',
    retries: 3,
    rateLimit: { key: 'event.data.emailHash', limit: 1, period: '15m' },
    triggers: [{ event: 'workshop.registration.received' }],  // INLINE — do not extract
  },
  async ({ event, step }) => { /* ... */ },
)
```

### Pattern 3: JWT Feedback Token (HS256 via Node crypto)

**What:** Sign and verify 14-day feedback tokens without an external JWT library.
**When to use:** `src/lib/feedback-token.ts` — sign at send time, verify at `/participate` render.

```typescript
// Source: D-17; Node crypto built-in
// No jose/jsonwebtoken needed — simple HMAC HS256 with JSON payload

function signToken(payload: { workshopId: string; email: string }): string {
  const exp = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60
  const iat = Math.floor(Date.now() / 1000)
  const body = Buffer.from(JSON.stringify({ ...payload, exp, iat })).toString('base64url')
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const sig = createHmac('sha256', process.env.WORKSHOP_FEEDBACK_JWT_SECRET!)
    .update(`${header}.${body}`)
    .digest('base64url')
  return `${header}.${body}.${sig}`
}
```

### Pattern 4: `'use cache'` for spots-left query (Next.js 16)

**What:** Cache spots-left query per workshopId with 60-second TTL.
**When to use:** SSR server components that need per-item cache with tag-based invalidation.

CRITICAL: `unstable_cache` is deprecated in Next.js 16. The replacement is the `'use cache'` directive.
However, `'use cache'` requires `cacheComponents: true` in `next.config.ts`, which is NOT currently set.

Two options for the planner:
- **Option A (recommended):** Enable `cacheComponents: true` in `next.config.ts` and use `'use cache'` + `cacheTag` + `cacheLife`.
- **Option B (fallback):** `unstable_cache` still works in Next.js 16 despite deprecation (it is not removed). Use it for the spots query to avoid enabling the experimental cacheComponents flag across the whole app.

```typescript
// Option B — unstable_cache (still functional, deprecated but not removed)
// Source: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md
import { unstable_cache } from 'next/cache'

const getSpotsLeft = unstable_cache(
  async (workshopId: string) => { /* db count query */ },
  ['spots-left'],
  { tags: [`workshop-spots-${workshopId}`], revalidate: 60 },
)
```

**Planner must choose Option A or B.** Option A enables forward-compatible caching but changes a global config. Option B works without config change but carries a deprecation warning in Next.js 16.

### Pattern 5: Cal.com Embed Lazy Load

**What:** Load `@calcom/embed-react` only on Register click, not on page render.
**When to use:** Any public page where the cal.com bundle should not block initial load.

```typescript
// Source: Next.js 16 lazy-loading docs + @calcom/embed-react README
// In the parent Workshop listing page (client component island):
import dynamic from 'next/dynamic'

const LazyCalEmbed = dynamic(
  () => import('./_components/cal-embed'),
  { ssr: false }
)

// In app/(public)/workshops/_components/cal-embed.tsx:
import Cal, { getCalApi } from '@calcom/embed-react'

export default function CalEmbed({ calLink }: { calLink: string }) {
  // calLink = the event type slug, e.g. "org-name/workshop-2026-04-15"
  return (
    <Cal
      calLink={calLink}
      namespace={calLink}  // isolates multiple embeds on the same page
      style={{ width: '100%', minHeight: 400 }}
    />
  )
}
```

### Anti-Patterns to Avoid

- **Do NOT call `req.json()` before signature verification.** The raw body stream is consumed after the first read. Always call `req.text()` first.
- **Do NOT use `unstable_cache` with `headers()` or `cookies()` inside the cached function.** Next.js 16 docs warn that uncached data sources inside a cache scope are not supported.
- **Do NOT extract `triggers` to a `const`.** Inngest v4 collapses `event.data` to `any` when triggers are not inlined (Pitfall 4 — documented in `participate-intake.ts`).
- **Do NOT call `revalidateTag()` from inside an Inngest function.** Inngest runs in a separate process from Next.js; tag invalidation must go through a Next.js Route Handler or Server Action.
- **Do NOT use `z.uuid()` for ID fields in Inngest event schemas.** Use `z.guid()` (Phase 16 decision — z.uuid() rejects version-0 test fixture UUIDs).
- **Do NOT match BOOKING_RESCHEDULED on `payload.uid` to find the existing registration.** The `uid` in a rescheduled payload is the NEW booking uid. Match on `payload.rescheduleUid` to find the original registration row.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HMAC constant-time compare | Custom string equality | `crypto.timingSafeEqual` | Timing attacks on naive string compare |
| Cal.com embed UI | Custom iframe/script | `@calcom/embed-react` | Handles xframe, postMessage, theme vars |
| Clerk dedup on email | Custom user lookup | `ignoreExisting: true` on `createInvitation` | Atomic — Clerk handles race conditions |
| Email throttle/dedup | Custom rate-limit table | Inngest `rateLimit` on `emailHash` | Already proven in participateIntakeFn |
| Webhook bookingUid dedup | `processedWebhookEvents` table | DB UNIQUE INDEX on `workshopRegistrations.bookingUid` | D-15 decision; simpler, same safety |

---

## Critical Research Finding: D-14 Divergence

**BOOKING_RESCHEDULED does NOT preserve the original bookingUid.**

CONTEXT.md D-14 states: "cal.com rescheduling preserves the same bookingUid in their flat payload — verify in research."

Research finding: This is INCORRECT. Per official cal.com webhook docs and GitHub issue #1551:

- `BOOKING_RESCHEDULED` payload contains:
  - `payload.uid` = **new booking uid** (for the rescheduled booking)
  - `payload.rescheduleUid` = **original booking uid** (the booking that was changed)
  - `payload.rescheduleId` = numeric ID of the original booking
  - `payload.rescheduleStartTime` / `payload.rescheduleEndTime` = original slot times

The webhook handler for `BOOKING_RESCHEDULED` MUST:
1. Match the existing `workshopRegistrations` row using `WHERE booking_uid = payload.rescheduleUid`
2. Update `status = 'rescheduled'` and `booking_start_time = new start time`
3. Optionally update `booking_uid` to the new `payload.uid` for future cancel/end events

The planner must update the handler logic from D-14's stated approach.

---

## Critical Research Finding: `feedbackItems.source` Column Missing

`feedbackItems` table in `src/db/schema/feedback.ts` has NO `source` column. D-18 requires writing `source='workshop'`.

**Required additions:**

1. New pgEnum `feedback_source` with values `('intake', 'workshop')` (or similar)
2. New nullable column `source feedback_source` on `feedback` table
3. SQL migration `0011_cal_com_workshop_register.sql` must include:
   ```sql
   CREATE TYPE feedback_source AS ENUM ('intake', 'workshop');
   ALTER TABLE feedback ADD COLUMN source feedback_source;
   ```

---

## Critical Research Finding: Next.js 16 `unstable_cache` Deprecation

The `unstable_cache` API is **replaced** (not removed) by the `'use cache'` directive in Next.js 16. The official docs in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md` state:

> "This API has been replaced by `use cache` in Next.js 16. We recommend opting into Cache Components and replacing `unstable_cache` with the `use cache` directive."

`unstable_cache` still **works** — it is not removed. It will generate a deprecation warning.

`'use cache'` requires `cacheComponents: true` in `next.config.ts`. Current `next.config.ts` does NOT have this flag.

**Planner decision needed:** Use `unstable_cache` (simpler, no config change, deprecation warning) or enable `cacheComponents` and use `'use cache'` (cleaner, forward-compatible, but changes global config). Research recommends flagging this in PLAN.md and defaulting to `unstable_cache` to avoid surprise side-effects of enabling `cacheComponents` on the entire app mid-phase.

---

## Critical Research Finding: MEETING_ENDED Payload Shape

Early Cal.com versions had a bug where `MEETING_ENDED` spread the booking data at the root level instead of wrapping in `payload: {}`. This was a known issue documented in GitHub #12494.

Current official documentation shows the standard wrapped format:
```json
{
  "triggerEvent": "MEETING_ENDED",
  "createdAt": "2024-01-01T10:20:00.000Z",
  "payload": {
    "uid": "booking-uid",
    "attendees": [
      {
        "id": 101,
        "email": "guest@example.com",
        "name": "Guest User",
        "timeZone": "UTC",
        "phoneNumber": null,
        "locale": "en",
        "bookingId": 100,
        "noShow": false
      }
    ]
  }
}
```

**Recommendation:** Parse defensively: `const bookingData = body.payload ?? body`. This handles both old and new cal.com behavior. Access `uid` as `bookingData.uid`, attendees as `bookingData.attendees ?? []`.

---

## cal.com API Reference (Verified)

### Webhook Signature Verification

- **Header name:** `x-cal-signature-256` (HTTP headers are case-insensitive; cal.com docs use lowercase)
- **Encoding:** HEX (not base64)
- **Algorithm:** HMAC-SHA256 over raw request body using `CAL_WEBHOOK_SECRET`
- **Rejection status:** 401 Unauthorized (CONTEXT.md D-13 is correct)
- **Source:** [cal.com webhook docs](https://cal.com/docs/developing/guides/automation/webhooks) — HIGH confidence

### Available Trigger Events (subscribed in Phase 20)

| Event | Action |
|-------|--------|
| `BOOKING_CREATED` | Create workshopRegistrations row + emit registration.received |
| `BOOKING_CANCELLED` | Update registration status → 'cancelled' |
| `BOOKING_RESCHEDULED` | Match on rescheduleUid, update bookingStartTime |
| `MEETING_ENDED` | Transition workshop → completed, upsert attendance |

`BOOKING_COMPLETED` does NOT exist — confirmed by cal.com docs.

### Event Types API (for `workshopCreatedFn`)

- **Base URL:** `https://api.cal.com/v2`
- **Endpoint:** `POST /v2/event-types`
- **Auth header:** `Authorization: Bearer ${CAL_API_KEY}`
- **Version header:** `cal-api-version: 2024-06-14` (required)
- **Required fields:** `title`, `slug`, `lengthInMinutes`
- **Cal Video location:** Pass location type `"integration"` with `"integration": "cal-video"`. If location not set, Cal Video is used as the default.
- **Known quirk:** Some docs show `lengthInMinutes`, some show `length`. Use `lengthInMinutes` (the documented field). If it fails with 400, fall back to `length`. Consider setting both.
- **Source:** [cal.com event types API docs](https://cal.com/docs/api-reference/v2/event-types/create-an-event-type) — HIGH confidence

### BOOKING_RESCHEDULED Payload

```json
{
  "triggerEvent": "BOOKING_RESCHEDULED",
  "payload": {
    "uid": "NEW-booking-uid",
    "rescheduleId": 200,
    "rescheduleUid": "ORIGINAL-booking-uid",
    "rescheduleStartTime": "2024-01-01T10:00:00Z",
    "rescheduleEndTime": "2024-01-01T11:00:00Z",
    "startTime": "2024-01-15T10:00:00Z",
    "endTime": "2024-01-15T11:00:00Z",
    "attendees": [...]
  }
}
```

Handler must: `WHERE booking_uid = payload.rescheduleUid` to find the existing registration.

### @calcom/embed-react Usage

```typescript
// Source: @calcom/embed-react npm + Cal.tsx source
import Cal from '@calcom/embed-react'

// calLink = scheduling URL slug (e.g., "org-name/workshop-title-slug")
<Cal
  calLink={calcomLink}
  namespace={workshopId}     // isolates concurrent modal instances
  style={{ width: '100%' }}
  config={{ layout: 'month_view' }}  // optional
/>
```

- React 19 compatible: `peerDependencies: { react: "^18.2.0 || ^19.0.0" }` — verified
- Install: `npm install @calcom/embed-react` — no peer dep overrides needed
- Must be wrapped in `next/dynamic({ ssr: false })` — accesses browser APIs at mount

---

## Existing Code Patterns (Verified by Reading Source)

### Migration Pattern

Migrations live in `src/db/migrations/` (NOT `drizzle/`). The journal at `src/db/migrations/meta/_journal.json` tracks entries. Convention: hand-written SQL files named `NNNN_description.sql`.

The current highest migration is `0010_workshop_lifecycle.sql`. Phase 20 migration is `0011_cal_com_workshop_register.sql`.

**Migration application:** Per Phase 14 precedent, apply via the `@neondatabase/serverless` DDL runner (`sql.query(stmt)` form, Pattern 2). `drizzle-kit push` is NOT the canonical path for this project.

### Event Registration Pattern

`src/inngest/events.ts` is the single registry. Three new events for Phase 20:

```typescript
// Pattern: eventType(name, { schema }) + sendX() helper with .validate() before send
// Use z.guid() (not z.uuid()) for all ID fields — Phase 16 decision

export const workshopCreatedEvent = eventType('workshop.created', {
  schema: z.object({ workshopId: z.guid(), moderatorId: z.guid() }),
})

export const workshopRegistrationReceivedEvent = eventType('workshop.registration.received', {
  schema: z.object({
    workshopId: z.guid(),
    email: z.string().email(),
    emailHash: z.string().regex(/^[0-9a-f]{64}$/),
    name: z.string(),
    bookingUid: z.string().min(1),
    source: z.enum(['cal_booking', 'walk_in']),
  }),
})

export const workshopFeedbackInviteEvent = eventType('workshop.feedback.invite', {
  schema: z.object({
    workshopId: z.guid(),
    email: z.string().email(),
    name: z.string(),
    attendeeUserId: z.guid().nullable(),
  }),
})
```

### Inngest Function Barrel

Check `src/inngest/client.ts` or wherever functions are registered — all functions must be listed in the Inngest serve handler. Per Phase 17/19 patterns, functions are imported and passed to the `inngest.serve()` call in `app/api/inngest/route.ts`.

### Clerk Webhook Handler Extension (D from CONTEXT.md code_context)

`app/api/webhooks/clerk/route.ts` must be extended for the `user.created` event to backfill `workshopRegistrations.userId` when a Clerk-invited stakeholder completes signup:

```typescript
// Add after existing upsert in user.created handler:
if (email) {
  await db.update(workshopRegistrations)
    .set({ userId: newUserId })
    .where(and(eq(workshopRegistrations.email, email), isNull(workshopRegistrations.userId)))
}
```

### Phase 17 Integration (workshop.completed event)

`src/server/routers/workshop.ts` transition mutation ALREADY emits `workshop.completed` when `toStatus === 'completed'`. The MEETING_ENDED webhook handler calls the same transition helper (or directly updates + emits the event). This means `workshopCompletedFn` (evidence checklist + nudges) fires automatically when MEETING_ENDED transitions the workshop. No additional wiring needed.

### tRPC Workshop Create Mutation Extension

`src/server/routers/workshop.ts` create mutation must emit `workshop.created` after the insert. Add:

```typescript
// After the existing insert + auditLog in the create mutation:
await sendWorkshopCreated({ workshopId: workshop.id, moderatorId: ctx.user.id })
```

The `CAL_API_KEY` env var must be in `.env.local` and TypeScript env validation. Add to the env validation pattern used by `requireEnv` in `src/lib/llm.ts`.

---

## Common Pitfalls

### Pitfall 1: BOOKING_RESCHEDULED uid mismatch

**What goes wrong:** Handler looks up registration by `payload.uid` for BOOKING_RESCHEDULED. Finds nothing. Creates a duplicate registration instead of updating.
**Why it happens:** `payload.uid` on a BOOKING_RESCHEDULED event is the NEW booking's uid. The original registration was stored under the original uid, which is in `payload.rescheduleUid`.
**How to avoid:** For BOOKING_RESCHEDULED: `WHERE booking_uid = payload.rescheduleUid`.
**Warning signs:** Integration test shows no update to existing registrations on reschedule.

### Pitfall 2: Reading body after text() is consumed

**What goes wrong:** `req.text()` is called for HMAC verification; later code calls `req.json()` and gets an error or empty object.
**Why it happens:** The Request body stream can only be consumed once.
**How to avoid:** `const raw = await req.text(); const body = JSON.parse(raw)`. Never call `req.json()` after `req.text()`.
**Warning signs:** `SyntaxError: Unexpected end of JSON input` or `TypeError: body is locked` from the route handler.

### Pitfall 3: Inngest triggers extracted to const (Pitfall 4 from Phase 19)

**What goes wrong:** `event.data` collapses to `any` inside the handler, losing all TypeScript type checks.
**Why it happens:** Inngest v4 type narrowing requires the triggers literal to be inline in the options object.
**How to avoid:** Keep `triggers: [{ event: 'workshop.registration.received' }]` inline. Never extract to a variable.
**Warning signs:** TypeScript stops complaining about `event.data.nonExistentField`.

### Pitfall 4: MEETING_ENDED walk-in creates duplicate if called twice

**What goes wrong:** Walk-in with synthetic bookingUid `walkin:{workshopId}:{emailHash}` fires twice. Second run inserts a second registration row (UNIQUE violation or silent duplicate).
**Why it happens:** MEETING_ENDED idempotency relies on the workshop status guard (`already-completed → short-circuit`). If the webhook fires again before the status update completes, walk-in creation runs twice.
**How to avoid:** Use `ON CONFLICT (booking_uid) DO NOTHING` for all insertions, including walk-ins. The synthetic bookingUid is deterministic, so the second insert is a no-op.
**Warning signs:** More workshopRegistrations rows than attendees after MEETING_ENDED replay.

### Pitfall 5: feedbackItems INSERT without source column

**What goes wrong:** Runtime error when D-18 handler tries to set `source='workshop'` — column doesn't exist yet.
**Why it happens:** `feedbackItems` schema has no `source` column currently. It must be added in the Phase 20 migration.
**How to avoid:** Migration Wave 1 adds the column before any code using it is deployed.
**Warning signs:** Drizzle compile-time error on `feedbackItems.source` reference.

### Pitfall 6: @calcom/embed-react "Inline embed already exists"

**What goes wrong:** Returning to the `/workshops` page after the modal was opened triggers a cal.com error "Inline embed already exists. Ignoring this call."
**Why it happens:** Cal.com embed persists its state per namespace. If the component unmounts and remounts with the same namespace, the second init is ignored.
**How to avoid:** Use a unique `namespace` per workshop (e.g., `workshopId`). This is documented in the component — each embed instance needs its own namespace string.
**Warning signs:** cal.com embed fails silently on second open after navigating away and back.

### Pitfall 7: `cacheComponents` not enabled for `'use cache'`

**What goes wrong:** Adding `'use cache'` directive to a function without enabling `cacheComponents: true` in `next.config.ts` causes a build error or silently falls back to no caching.
**Why it happens:** `'use cache'` is a Cache Components feature gated behind a config flag.
**How to avoid:** Either enable the flag or use `unstable_cache` (still functional in Next.js 16 despite being deprecated).
**Warning signs:** Build errors mentioning unknown directive.

---

## Code Examples

### Verified: HMAC Webhook Signature Verification
```typescript
// Source: cal.com webhook docs + Node crypto module (built-in)
import { createHmac, timingSafeEqual } from 'node:crypto'

function verifyCalSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const sigBuf = Buffer.from(signatureHeader.trim(), 'hex')
  const expBuf = Buffer.from(expected, 'hex')
  if (sigBuf.length === 0 || sigBuf.length !== expBuf.length) return false
  return timingSafeEqual(sigBuf, expBuf)
}
```

### Verified: Walk-in Synthetic bookingUid
```typescript
// Source: CONTEXT.md D-12
import { createHash } from 'node:crypto'

function walkinBookingUid(workshopId: string, email: string): string {
  const emailHash = createHash('sha256').update(email.toLowerCase().trim()).digest('hex')
  return `walkin:${workshopId}:${emailHash}`
}
```

### Verified: Cal.com Event Type Creation
```typescript
// Source: cal.com API v2 docs (verified 2026-04-14)
async function createCalEventType(workshop: {
  title: string
  slug: string
  durationMinutes: number
}) {
  const res = await fetch('https://api.cal.com/v2/event-types', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CAL_API_KEY}`,
      'Content-Type': 'application/json',
      'cal-api-version': '2024-06-14',
    },
    body: JSON.stringify({
      title: workshop.title,
      slug: workshop.slug,
      lengthInMinutes: workshop.durationMinutes,
      locations: [{ type: 'integration', integration: 'cal-video' }],
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`cal.com API ${res.status}: ${text}`)
  }
  const data = await res.json() as { data?: { id: number } }
  return data.data?.id
}
```

### Verified: Feedback Token Sign/Verify
```typescript
// Source: D-17; Node crypto built-in (no jose/jsonwebtoken installed)
import { createHmac, timingSafeEqual } from 'node:crypto'

export interface FeedbackTokenPayload {
  workshopId: string
  email: string
  exp: number
  iat: number
}

export function signFeedbackToken(workshopId: string, email: string): string {
  const secret = process.env.WORKSHOP_FEEDBACK_JWT_SECRET!
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 14 * 24 * 60 * 60  // 14 days
  const payload: FeedbackTokenPayload = { workshopId, email, exp, iat }
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

export function verifyFeedbackToken(
  token: string,
  expectedWorkshopId: string
): FeedbackTokenPayload | null {
  const secret = process.env.WORKSHOP_FEEDBACK_JWT_SECRET
  if (!secret || !token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts
  const expectedSig = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url')
  const sigBuf = Buffer.from(sig, 'base64url')
  const expBuf = Buffer.from(expectedSig, 'base64url')
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as FeedbackTokenPayload
  if (payload.exp < Math.floor(Date.now() / 1000)) return null
  if (payload.workshopId !== expectedWorkshopId) return null
  return payload
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `unstable_cache` | `'use cache'` directive | Next.js 16 | Need to decide: use deprecated or enable cacheComponents flag |
| `BOOKING_COMPLETED` event | `MEETING_ENDED` event | Always (BOOKING_COMPLETED never existed) | MEETING_ENDED is the only "meeting over" event |
| Flat MEETING_ENDED payload | Wrapped payload (standard) | Fixed in recent cal.com | Parse defensively: `body.payload ?? body` |

**Deprecated/outdated:**
- `unstable_cache`: Deprecated in Next.js 16; still functional but replaced by `'use cache'`
- `BOOKING_COMPLETED` cal.com event: Never existed; do not subscribe or handle

---

## Open Questions

1. **`cacheComponents` flag decision**
   - What we know: `unstable_cache` is deprecated but works; `'use cache'` requires a config flag not currently set
   - What's unclear: Are there other spots in the codebase that would break if `cacheComponents` is enabled globally?
   - Recommendation: Use `unstable_cache` in Phase 20; a separate migration to `'use cache'` can be done in a future phase

2. **Cal.com `lengthInMinutes` vs `length` field**
   - What we know: Docs say `lengthInMinutes`; a GitHub issue reports `length` is the only accepted field
   - What's unclear: Which field name the current cal.com API version accepts
   - Recommendation: Pass both fields in the create payload: `{ lengthInMinutes: n, length: n }`. One will be ignored, neither will cause a 400 if both are valid.

3. **`MEETING_ENDED` ONLY fires for Cal Video calls**
   - What we know: D-02 mandates Cal Video as the location; `MEETING_ENDED` fires reliably for Cal Video
   - What's unclear: Whether enabling other location types in the future would break the attendance pipeline
   - Recommendation: Document in code that Cal Video is required for MEETING_ENDED to fire

4. **Walk-in email dedup with participateIntakeFn rate limit**
   - What we know: `workshopRegistrationReceivedFn` uses the same `rateLimit: { key: emailHash, limit: 1, period: 15m }` as `participateIntakeFn`
   - What's unclear: If a walk-in and a BOOKING_CREATED happen for the same email within 15m (e.g., user booked and also walked in), the second Inngest event is dropped
   - Recommendation: Accept this edge case as acceptable (15m window is very unlikely for genuine duplicates)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js crypto | HMAC verification, JWT signing | ✓ | Built-in | — |
| `@calcom/embed-react` | Public /workshops embed | Install needed | 1.5.3 (latest) | — |
| `CAL_API_KEY` env var | workshopCreatedFn API call | Unknown (runtime) | — | Inngest function fails gracefully; workshop row persists |
| `CAL_WEBHOOK_SECRET` env var | Webhook signature verify | Unknown (runtime) | — | 401 on all webhooks until set |
| `WORKSHOP_FEEDBACK_JWT_SECRET` env var | feedback-token.ts | Unknown (runtime) | — | Token sign fails; feedback links broken |

**Missing dependencies with no fallback:**
- `CAL_API_KEY`, `CAL_WEBHOOK_SECRET`, `WORKSHOP_FEEDBACK_JWT_SECRET` — all must be in `.env.local` before the phase can be tested. Wave 0 should include env var documentation/validation.

**Missing dependencies with fallback:**
- None — `@calcom/embed-react` install is straightforward.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run tests/phase-20/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WS-09 | HMAC verify: valid sig passes | unit | `npx vitest run tests/phase-20/cal-hmac.test.ts` | ❌ Wave 0 |
| WS-09 | HMAC verify: invalid sig → 401 | unit | same | ❌ Wave 0 |
| WS-09 | HMAC verify: missing sig → 401 | unit | same | ❌ Wave 0 |
| WS-09 | HMAC verify: tampered body → 401 | unit | same | ❌ Wave 0 |
| WS-10 | BOOKING_CREATED: creates registration row | integration | `npx vitest run tests/phase-20/webhook-route.test.ts` | ❌ Wave 0 |
| WS-10 | BOOKING_CREATED: idempotent on duplicate bookingUid | integration | same | ❌ Wave 0 |
| WS-10 | workshopRegistrationReceivedFn: Clerk invite called | unit | `npx vitest run tests/phase-20/registration-fn.test.ts` | ❌ Wave 0 |
| WS-10 | workshopRegistrationReceivedFn: Clerk 5xx → retry | unit | same | ❌ Wave 0 |
| WS-10 | workshopRegistrationReceivedFn: Clerk 4xx → NonRetriableError | unit | same | ❌ Wave 0 |
| WS-11 | BOOKING_CANCELLED: updates status to 'cancelled' | integration | `npx vitest run tests/phase-20/webhook-route.test.ts` | ❌ Wave 0 |
| WS-11 | BOOKING_RESCHEDULED: matches on rescheduleUid (not uid) | integration | same | ❌ Wave 0 |
| WS-11 | MEETING_ENDED: transitions workshop to completed | integration | same | ❌ Wave 0 |
| WS-11 | MEETING_ENDED: walk-in attendee → synthesized registration | integration | same | ❌ Wave 0 |
| WS-11 | MEETING_ENDED: idempotent on replay (already-completed guard) | integration | same | ❌ Wave 0 |
| WS-15 | signFeedbackToken + verifyFeedbackToken: valid token passes | unit | `npx vitest run tests/phase-20/feedback-token.test.ts` | ❌ Wave 0 |
| WS-15 | verifyFeedbackToken: expired token → null | unit | same | ❌ Wave 0 |
| WS-15 | verifyFeedbackToken: wrong workshopId → null | unit | same | ❌ Wave 0 |
| WS-15 | verifyFeedbackToken: wrong signature → null | unit | same | ❌ Wave 0 |
| WS-15 | workshopFeedbackInviteFn: sends email with valid JWT link | unit | `npx vitest run tests/phase-20/feedback-invite-fn.test.ts` | ❌ Wave 0 |
| WS-15 | /participate feedback mode: valid token → feedback form | manual (SSR) | dev server walk | manual |
| WS-15 | /participate feedback mode: expired token → expired state | manual (SSR) | dev server walk | manual |
| WS-07 | workshopCreatedFn: calls cal.com API, backfills calcomEventTypeId | unit | `npx vitest run tests/phase-20/workshop-created-fn.test.ts` | ❌ Wave 0 |
| WS-07 | workshopCreatedFn: cal.com 4xx → NonRetriableError | unit | same | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/phase-20/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + `tsc --noEmit` before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/phase-20/cal-hmac.test.ts` — covers WS-09 HMAC verification (4 tests)
- [ ] `tests/phase-20/webhook-route.test.ts` — covers WS-09/WS-10/WS-11 route handler (integration, ~12 tests)
- [ ] `tests/phase-20/registration-fn.test.ts` — covers WS-10 Inngest fn (mirrors participate-intake.test.ts pattern)
- [ ] `tests/phase-20/feedback-token.test.ts` — covers WS-15 JWT sign/verify (4 tests)
- [ ] `tests/phase-20/feedback-invite-fn.test.ts` — covers WS-15 Inngest fn
- [ ] `tests/phase-20/workshop-created-fn.test.ts` — covers WS-07 Inngest fn

All test files follow the `tests/phase-19/` conventions:
- `vi.hoisted()` for shared mocks across factory hoist boundary
- Variable-path dynamic import in `beforeAll` (`/* @vite-ignore */`) for modules that don't exist yet
- `jsdom` environment (already configured in `vitest.config.mts`)

---

## Sources

### Primary (HIGH confidence)
- [cal.com webhook docs](https://cal.com/docs/developing/guides/automation/webhooks) — signature header name (`x-cal-signature-256`), hex encoding, event list, payload shapes
- [cal.com Event Types API](https://cal.com/docs/api-reference/v2/event-types/create-an-event-type) — required fields (title, slug, lengthInMinutes), auth header (Authorization: Bearer), cal-api-version header
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md` — confirms `unstable_cache` replaced by `use cache` in Next.js 16
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — Route Handler pattern, raw body reading
- `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md` — `next/dynamic` with `ssr: false`
- `src/inngest/functions/participate-intake.ts` — Reference impl for Inngest Clerk invite pattern
- `src/inngest/events.ts` — Event registration patterns (z.guid(), eventType(), sendX() with .validate())
- `src/db/schema/workshops.ts` — Baseline schema (missing calcomEventTypeId, maxSeats, workshopRegistrations)
- `src/db/schema/feedback.ts` — Confirms NO `source` column on feedbackItems
- `package.json` — Confirms no jose/jsonwebtoken; Node crypto is the JWT implementation path
- `npm view @calcom/embed-react peerDependencies` — Confirms React 19 support

### Secondary (MEDIUM confidence)
- [cal.com MEETING_ENDED payload issue #12494](https://github.com/calcom/cal.com/issues/12494) — Historical flat payload bug; current docs show wrapped payload
- [cal.com BOOKING_RESCHEDULED issue #1551](https://github.com/calcom/cal.com/issues/1551) — Confirms new uid created on reschedule, original in rescheduleUid
- [cal.com embed-react React 19 issue #20814](https://github.com/calcom/cal.com/issues/20814) — Confirms React 19 peerDep was added and issue is closed

### Tertiary (LOW confidence)
- WebSearch results on `lengthInMinutes` vs `length` field — conflicting sources; planner should pass both

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against registry or docs
- Architecture: HIGH — all patterns traced to existing working code in this repo
- cal.com webhook signature: HIGH — confirmed by official docs (header name + hex encoding)
- BOOKING_RESCHEDULED uid behavior: HIGH — confirmed by official docs + GitHub issues
- MEETING_ENDED payload shape: MEDIUM — current docs show wrapped; defensive parse recommended
- feedbackItems.source: HIGH — confirmed missing by reading schema file
- Next.js cache API: HIGH — confirmed from bundled Next.js 16 docs
- Pitfalls: HIGH — all traced to existing repo patterns or verified external sources

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable APIs — cal.com API versioned, Next.js 16 docs bundled locally)
