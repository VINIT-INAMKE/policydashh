# Architecture Research — PolicyDash v0.2

**Domain:** Next.js 16 + tRPC v11 + Drizzle + Inngest + Clerk on Vercel serverless (existing PolicyDash app, subsequent milestone integration)
**Researched:** 2026-04-13
**Confidence:** HIGH (grounded in repo source; no redesign, only integration guidance)

## Scope

This is **integration research, not greenfield design.** v0.1 shipped 13 phases; v0.2 adds ~10 capabilities (async evidence export, workshop lifecycle, public `/participate`, cal.com webhooks, public content surfaces, LLM consultation summaries, Milestone entity, SHA256 hashing, Cardano anchoring, engagement tracking). Every recommendation below respects the existing file layout observed in:

- `src/trpc/init.ts` — `publicProcedure`, `protectedProcedure`, `requirePermission(p)` already defined
- `src/server/routers/_app.ts` — flat barrel-imported router composition
- `src/inngest/client.ts`, `events.ts`, `functions/index.ts`, `functions/feedback-reviewed.ts` — canonical Flow 5 pattern
- `app/api/webhooks/clerk/route.ts` — svix-verified webhook pattern
- `proxy.ts` — Clerk middleware config with public-route matcher (note: file is named `proxy.ts` not `middleware.ts`)
- `src/db/schema/workshops.ts` — existing FK pattern (link tables, not polymorphic)

---

## System Overview (existing + v0.2 additions)

```
┌────────────────────────────────────────────────────────────────────────┐
│                         Browser / Public Visitors                     │
│   (workspace) authed routes    |    (public) /portal /participate     │
└──────────┬────────────────────────────────┬───────────────────────────┘
           │ tRPC over HTTP                 │ public tRPC + form POSTs
           ▼                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Next.js 16 app/ (Vercel serverless)             │
│                                                                        │
│  app/api/trpc/[trpc]/route.ts   ──►  appRouter                        │
│      ├── protectedProcedure (Clerk session required)                  │
│      └── publicProcedure + publicRateLimited (NEW, no auth ctx)       │
│                                                                        │
│  app/api/webhooks/                                                    │
│      ├── clerk/route.ts     (existing — user.created)                 │
│      ├── calcom/route.ts    (NEW — BOOKING_CREATED / COMPLETED)       │
│      └── _lib/verify.ts     (NEW — shared signature helpers)          │
│                                                                        │
│  app/api/inngest/route.ts ──► functions[] barrel (Inngest handler)    │
│                                                                        │
│  app/(workspace)/  ... authed UI (existing)                           │
│  app/(public)/portal/ ... existing public pages                       │
│  app/(public)/participate/ /workshops/ /research/ /framework/ (NEW)   │
└──────────┬────────────────────────────┬──────────────┬────────────────┘
           │ drizzle (Neon HTTP)        │ inngest.send │ 3rd-party
           ▼                            ▼              ▼
┌─────────────────────────┐  ┌───────────────────┐  ┌────────────────┐
│       Postgres          │  │  Inngest runtime  │  │ Clerk, cal.com,│
│   (existing schema      │  │  ┌─────────────┐  │  │  Groq, R2,     │
│    + new milestones,    │  │  │ feedback/   │  │  │  Blockfrost    │
│    hashes,              │  │  │ workshop/   │  │  │  (Cardano)     │
│    engagement cols)     │  │  │ milestone/  │  │  └────────────────┘
└─────────────────────────┘  │  │ public/     │  │
                             │  │ export/     │  │
                             │  └─────────────┘  │
                             │  step.run units   │
                             │  for long jobs    │
                             └───────────────────┘
```

---

## 1. Public vs Protected tRPC Organization

### Current state (verified in `src/trpc/init.ts`)

```ts
export const publicProcedure   = t.procedure                  // already exported, unused
export const protectedProcedure = t.procedure.use(enforceAuth) // Clerk session gate
export const requirePermission  = (p) => protectedProcedure.use(...)
```

`publicProcedure` is **defined but never used**. All routers in `src/server/routers/_app.ts` consume `requirePermission(...)` or `protectedProcedure`. The Clerk middleware (`proxy.ts`) already excludes `/api/trpc` from forced auth via the matcher, but any router calling `ctx.user!` would throw for unauthed callers — meaning public procedures must be explicitly built, not just "left unprotected."

### Recommendation: Separate `publicRouter` + `publicProcedure` helper with rate-limit middleware

**Do NOT** mix public and protected procedures in the same router file. Two reasons:

1. **Accidental re-gating risk.** If `feedbackRouter` mixed `submit` (protected) and `publicSubmit` (public), a refactor touching shared imports or middleware could accidentally add `requirePermission` to the public one. Humans scan for "does this procedure live in the protected router" as a heuristic.
2. **Context shape divergence.** Public procedures must not reference `ctx.user.id`. Keeping them in a separate file enforces this by typing — the public context has `user: null`.

**File layout (NEW):**

```
src/server/
├── routers/
│   ├── _app.ts              (MODIFIED: add publicRouter, milestone, cardano, etc.)
│   ├── public/
│   │   ├── index.ts         (NEW: publicRouter composition — participate, workshops, research)
│   │   ├── participate.ts   (NEW: participate.submit with Turnstile verify)
│   │   ├── workshops.ts     (NEW: public.workshops.list, getById)
│   │   └── framework.ts     (NEW: public section status reads)
│   ├── milestone.ts         (NEW: milestone CRUD + readiness checks)
│   ├── cardano.ts           (NEW: verified-state reads, re-anchor trigger)
│   └── ... (existing)
└── trpc/
    └── public-procedure.ts  (NEW: publicProcedure with Turnstile + rate limit)
```

**New `publicProcedure` helper (NEW file `src/trpc/public-procedure.ts`):**

```ts
// Wrap t.procedure with a Turnstile-verify + rate-limit middleware.
// Cannot extend existing publicProcedure in init.ts without importing
// Turnstile into the base trpc module — keep the concern separate.
import { t } from '@/src/trpc/init'
import { verifyTurnstile } from '@/src/lib/turnstile'
import { rateLimitByIp } from '@/src/lib/rate-limit'

export const publicProcedure = t.procedure
  .use(async ({ ctx, next, getRawInput }) => {
    // Read a `_turnstile` field from input on mutations; skip for queries.
    const raw = (await getRawInput()) as { _turnstile?: string } | undefined
    if (raw?._turnstile) {
      const ok = await verifyTurnstile(raw._turnstile, ctx.headers)
      if (!ok) throw new TRPCError({ code: 'FORBIDDEN', message: 'Turnstile failed' })
    }
    await rateLimitByIp(ctx.headers)
    return next({ ctx: { ...ctx, user: null } })  // explicit nulling
  })
```

**Composition in `_app.ts` (MODIFIED):**

```ts
export const appRouter = router({
  // authed
  user, audit, document, feedback, ...
  // public — single namespace keeps client-side type safety clean
  public: publicRouter,
  // new authed modules
  milestone: milestoneRouter,
  cardano: cardanoRouter,
})
```

Client calls become `trpc.public.participate.submit.useMutation()` — the `public.` prefix is self-documenting.

### How to prevent accidental re-gating

1. **Lint rule / convention:** any file under `src/server/routers/public/` may only import from `src/trpc/public-procedure.ts`, never from `src/trpc/init.ts`. Add a single eslint-plugin-import restriction pattern.
2. **Context type narrowing:** the `publicProcedure` middleware sets `user: null` explicitly in context, so any `ctx.user.id` access fails typechecking inside public routers.
3. **Router barrel hygiene:** `publicRouter`'s barrel file (`src/server/routers/public/index.ts`) re-exports only public sub-routers. If a developer types `protected` imports into this file, code review catches it as an obvious diff.

---

## 2. Inngest Function Organization

### Current state (verified in `src/inngest/functions/index.ts`)

```ts
import { helloFn } from './hello'
import { feedbackReviewedFn } from './feedback-reviewed'
export const functions = [helloFn, feedbackReviewedFn]
```

Flat, two functions. Flow 5 pattern: one file per function, Zod-schema'd event in `src/inngest/events.ts`, typed `send*()` helpers, shared copy/content builders in `src/inngest/lib/`. Every side effect wrapped in `step.run` for retry-memoization. `NonRetriableError` for missing-row cases. Context is re-fetched inside the function, not carried in the payload (keeps emit path minimal).

### Recommendation: Domain-based grouping with flat `functions[]` barrel

Lifecycle grouping (intake/lifecycle/export) sounds tidy but falls apart once a function spans lifecycle boundaries (e.g., `milestoneReadyFn` computes hashes AND submits to Cardano AND sends confirmation email — which bucket?). Domain grouping is unambiguous: each function lives in the folder of the entity it serves.

**File layout:**

```
src/inngest/
├── client.ts                  (unchanged)
├── events.ts                  (MODIFIED: add ~12 new events)
├── functions/
│   ├── index.ts               (MODIFIED: import and list all)
│   ├── hello.ts               (existing)
│   ├── feedback/
│   │   ├── reviewed.ts        (MOVED from ../feedback-reviewed.ts)
│   │   └── notification-dispatch.ts (NEW — generic notification.create handler)
│   ├── workshop/
│   │   ├── lifecycle.ts       (NEW — on workshop.scheduled_at, transition states)
│   │   ├── reminders.ts       (NEW — 48h/2h nudges, step.sleepUntil)
│   │   ├── recording-processed.ts (NEW — Whisper + llama summary)
│   │   └── checklist-nudge.ts (NEW — 72h + 7d evidence checklist)
│   ├── participate/
│   │   └── intake.ts          (NEW — Clerk invite + welcome email)
│   ├── calcom/
│   │   ├── booking-created.ts (NEW — auto-invite user, link workshop)
│   │   └── booking-completed.ts (NEW — attendance rec + feedback link email)
│   ├── version/
│   │   └── published.ts       (NEW — LLM summary + hash + anchor)
│   ├── milestone/
│   │   └── ready.ts           (NEW — hash bundle + Cardano anchor)
│   └── export/
│       └── evidence-pack.ts   (NEW — R2 ZIP + presigned email delivery)
└── lib/                        (shared pure helpers per function)
    ├── feedback-reviewed-copy.ts    (existing)
    ├── auto-draft-cr-content.ts     (existing)
    ├── create-draft-cr.ts           (existing)
    ├── workshop-reminder-copy.ts    (NEW)
    ├── groq-transcribe.ts           (NEW)
    ├── groq-summarize.ts            (NEW)
    ├── clerk-invite.ts              (NEW — wraps Clerk invitations API)
    ├── milestone-hash.ts            (NEW — SHA256 canonicalization)
    └── cardano-anchor.ts            (NEW — Mesh + Blockfrost)
```

### Barrel scaling pattern (scales cleanly from 2 → 20 functions)

Keep `functions/index.ts` as a single flat array — the alternative (one barrel per subfolder) buys nothing because Inngest doesn't care about groupings at registration time, and Vercel's route handler just needs the array.

```ts
// src/inngest/functions/index.ts (MODIFIED)
import { helloFn } from './hello'
import { feedbackReviewedFn } from './feedback/reviewed'
import { notificationDispatchFn } from './feedback/notification-dispatch'
import { workshopLifecycleFn } from './workshop/lifecycle'
import { workshopRemindersFn } from './workshop/reminders'
import { workshopRecordingProcessedFn } from './workshop/recording-processed'
import { workshopChecklistNudgeFn } from './workshop/checklist-nudge'
import { participateIntakeFn } from './participate/intake'
import { calcomBookingCreatedFn } from './calcom/booking-created'
import { calcomBookingCompletedFn } from './calcom/booking-completed'
import { versionPublishedFn } from './version/published'
import { milestoneReadyFn } from './milestone/ready'
import { exportEvidencePackFn } from './export/evidence-pack'

export const functions = [
  helloFn,
  feedbackReviewedFn,
  notificationDispatchFn,
  workshopLifecycleFn,
  workshopRemindersFn,
  workshopRecordingProcessedFn,
  workshopChecklistNudgeFn,
  participateIntakeFn,
  calcomBookingCreatedFn,
  calcomBookingCompletedFn,
  versionPublishedFn,
  milestoneReadyFn,
  exportEvidencePackFn,
]
```

### Event naming convention (extends current `feedback.reviewed`)

```
<entity>.<past-tense-verb>    workshop.scheduled, workshop.completed, version.published
<entity>.<action>.<state>     milestone.ready, milestone.anchored
<source>.<webhook-event>      calcom.booking.created, calcom.booking.completed
```

All new events follow the three-step pattern from `src/inngest/events.ts`: private Zod schema → exported `eventType()` instance → exported `sendX()` helper with `.validate()` before `inngest.send()`. Two rules (A: helper param is `z.infer<typeof schema>`, B: helper calls `.validate()` first) are already documented in that file and must not be bypassed.

**One-file-per-event vs a single `events.ts`:** keep the single file until it exceeds ~800 lines. The current 97-line file with 2 events will grow to ~600-800 lines with ~12 events — still manageable. Splitting earlier creates import churn. When it does split, split by domain: `events/feedback.ts`, `events/workshop.ts`, etc.

---

## 3. Webhook Routing

### Current state (verified)

```
app/api/webhooks/clerk/route.ts   — svix.Webhook verification, upserts users table
app/api/inngest/route.ts           — Inngest's own handler (excluded from auth in proxy.ts)
proxy.ts                           — matcher lists /api/webhooks(.*) as public
```

### Recommendation: `_lib` folder for shared verification helpers

```
app/api/webhooks/
├── _lib/
│   ├── verify-svix.ts       (NEW — extract from clerk/route.ts; reused by clerk)
│   ├── verify-calcom.ts     (NEW — cal.com uses HMAC-SHA256 over raw body)
│   └── types.ts             (NEW — shared WebhookHandler<T> return shapes)
├── clerk/
│   └── route.ts             (MODIFIED — import verify-svix, keep handler logic)
└── calcom/
    └── route.ts             (NEW — HMAC verify, dispatch to sendCalcomBookingCreated)
```

**Why `_lib` not `src/lib/webhooks/`:** Next.js 16 app router allows `_` prefixed folders to opt out of routing. Co-locating the verify helpers with the routes they serve makes it obvious which file-system neighbors use them, and eliminates the `src/lib` vs `app/api` drift.

### Cal.com webhook signature

Cal.com signs webhooks with HMAC-SHA256 using a shared secret, header name `X-Cal-Signature-256`. Unlike svix (Clerk), there's no timestamp replay protection in the default cal.com signer, so:

- **Verify HMAC over raw request body** (not parsed JSON — Next.js `req.text()` before any `.json()`)
- **Deduplicate** by `bookingId + triggerEvent` to survive retries (cal.com retries on 5xx with exponential backoff)
- **Return 200 fast**, delegate work to Inngest via `sendCalcomBookingCreated()` before returning

**Route handler shape (`app/api/webhooks/calcom/route.ts`):**

```ts
export async function POST(req: Request) {
  const body = await req.text()
  const sig = (await headers()).get('x-cal-signature-256')
  if (!verifyCalcomSignature(body, sig)) return new Response('bad sig', { status: 400 })

  const event = JSON.parse(body) as CalcomWebhookEvent
  if (event.triggerEvent === 'BOOKING_CREATED') {
    await sendCalcomBookingCreated({ bookingId: event.payload.uid, ... })
  } else if (event.triggerEvent === 'BOOKING_COMPLETED') {
    await sendCalcomBookingCompleted({ bookingId: event.payload.uid, ... })
  }
  return Response.json({ ok: true })
}
```

The handler does NO database work beyond what svix verification needs. All DB mutation + side effects live in the Inngest function. This matches the philosophy of the existing `clerk/route.ts` but pushes even the user upsert into Inngest (see §9 Data Flow Changes).

### Inngest handler

`app/api/inngest/route.ts` already exists and is excluded by `proxy.ts` matcher `/api/inngest(.*)`. No changes needed except updating the `functions` import to the growing barrel.

---

## 4. Cal.com ↔ Workshop Sync Direction

### Decision: **cal.com is the source of truth for scheduling; PolicyDash mirrors via webhook.**

This inverts the instinct of "our app owns everything" but is correct for three reasons:

1. **Cal.com has features we don't:** reschedule flow, timezone handling, ICS emails, participant availability, buffer times. Treating it as primary means those features come free.
2. **v0.2 Key Decision already committed to delegation.** PROJECT.md: "Cal.com delegated scheduling. Half of Phase 20 deleted; we only handle the webhook + auto-create-user via Clerk invitation."
3. **Write-write conflicts are a known failure mode.** If workshops were created in our app and POSTed to cal.com, a cal.com API failure would leave our DB and cal.com out of sync with unclear recovery. One-directional flow (cal.com → us) has no divergence risk.

### Mechanics

- **Workshops table stays as-is** (`src/db/schema/workshops.ts`). Add one column: `calcomEventTypeId int`. This identifies WHICH cal.com event type generates registrations for this workshop.
- **Admin creates workshop in PolicyDash first** (existing `workshops.create` mutation), then enters the matching cal.com event-type ID in the form. No cal.com API call required for creation.
- **Participants register in cal.com** via embed at `app/(public)/workshops/[id]/register/page.tsx`. Embed is configured to the event type.
- **`BOOKING_CREATED` webhook** arrives → `calcomBookingCreatedFn` (Inngest):
  1. Look up workshop by `calcomEventTypeId`
  2. Check if user exists by email (in `users` table)
  3. If not, call Clerk invitations API to create user + send invite
  4. Insert `workshopRegistrations` row linking workshop + user
  5. Queue `workshop.reminder` events (48h + 2h prior) via `inngest.send` with `ts: scheduledAt - 48h`
- **`BOOKING_COMPLETED` webhook** arrives → `calcomBookingCompletedFn`:
  1. Mark registration as attended
  2. Send post-workshop feedback link email (linked via existing `workshopFeedbackLinks` table)

### Trade-off acknowledged

**We lose the ability to cancel/reschedule from inside PolicyDash.** Admins must do this in cal.com. Acceptable because: (a) scheduling is rare once set, (b) cal.com's UI is better than what we'd build, (c) cancellation webhooks (`BOOKING_CANCELLED`) flow back to us the same way.

### Idempotency

`bookingId` is unique across cal.com. Use it as the idempotency key on `workshopRegistrations` (unique index on `calcomBookingId`). Webhook retries are safe: second insert fails the unique constraint, Inngest step memoizes the first successful run.

---

## 5. Milestone Entity Schema

### Context

Milestones aggregate "what was the state of the platform at a governance checkpoint?" — e.g., "Framework v1.0 milestone completed 2026-06-01 with 3 workshops, 127 feedback items, 4 evidence bundles, 1 published version." The hash commits that exact aggregation.

### Recommendation: **single `milestoneId` FK on each aggregated entity + a `milestone_slots` definition table.**

**Reject many-to-many join tables.** Reason: a workshop belongs to at most one milestone (the one it contributed evidence toward); a feedback item belongs to at most one milestone (the first one whose hash includes it). Putting entities in multiple milestones muddles the hashing semantics and creates per-lookup joins on hash computation.

**Schema (NEW file `src/db/schema/milestones.ts`):**

```ts
export const milestoneStatusEnum = pgEnum('milestone_status', [
  'draft',      // being composed
  'ready',      // all required slots filled, ready to hash
  'anchoring',  // hash computed, cardano tx submitted
  'anchored',   // tx confirmed
  'failed',     // anchoring failed after retries
])

export const milestones = pgTable('milestones', {
  id:           uuid('id').primaryKey().defaultRandom(),
  readableId:   text('readable_id').notNull().unique(),    // M-001, M-002
  title:        text('title').notNull(),
  description:  text('description'),
  status:       milestoneStatusEnum('status').notNull().default('draft'),
  // slot definitions — JSONB: [{ kind: 'version', minCount: 1 }, { kind: 'workshop', minCount: 2 }, ...]
  requiredSlots: jsonb('required_slots').notNull(),
  // hash artifacts (null until status >= 'ready')
  contentHash:  text('content_hash'),                      // sha256 hex, 64 chars
  metadataJson: jsonb('metadata_json'),                    // canonical JSON that was hashed
  // cardano anchoring (null until 'anchored')
  cardanoTxHash: text('cardano_tx_hash'),
  cardanoNetwork: text('cardano_network'),                 // 'preview' | 'mainnet'
  anchoredAt:   timestamp('anchored_at', { withTimezone: true }),
  createdBy:    uuid('created_by').notNull().references(() => users.id),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

**MODIFIED existing tables** (add single nullable FK each — migrations are additive):

```ts
// src/db/schema/documents.ts — documentVersions
milestoneId: uuid('milestone_id').references(() => milestones.id, { onDelete: 'set null' })

// src/db/schema/workshops.ts — workshops
milestoneId: uuid('milestone_id').references(() => milestones.id, { onDelete: 'set null' })

// src/db/schema/evidence.ts — evidenceArtifacts (or a dedicated evidenceBundles table if added)
milestoneId: uuid('milestone_id').references(() => milestones.id, { onDelete: 'set null' })

// src/db/schema/feedback.ts — feedbackItems
milestoneId: uuid('milestone_id').references(() => milestones.id, { onDelete: 'set null' })
```

`onDelete: 'set null'` means deleting a milestone unbinds but doesn't cascade-delete its members — safer for audit.

### Hash computation references via index

`milestone_hash.ts` canonicalization query reads all rows where `milestoneId = M` from each table, sorts deterministically by `id`, serializes to canonical JSON, hashes the result. Indexes required:

```sql
CREATE INDEX idx_document_versions_milestone ON document_versions(milestone_id) WHERE milestone_id IS NOT NULL;
CREATE INDEX idx_workshops_milestone         ON workshops(milestone_id)         WHERE milestone_id IS NOT NULL;
CREATE INDEX idx_evidence_milestone          ON evidence_artifacts(milestone_id) WHERE milestone_id IS NOT NULL;
CREATE INDEX idx_feedback_milestone          ON feedback_items(milestone_id)    WHERE milestone_id IS NOT NULL;
```

Partial indexes keep them small (most rows have null `milestone_id`).

### Why not a many-to-many?

Many-to-many would require answering "which milestone's hash includes this workshop" at anchor time, and invite the question "can the same workshop appear in two milestones with two different hashes?" The answer is unambiguous with single-FK: a workshop is assigned to exactly one milestone at the moment its moderator says "include this in milestone M." Before that, `milestoneId IS NULL`.

---

## 6. SHA256 Hashing Service Location

### Recommendation: **pure function in `src/lib/hashing.ts`, called once at `.status → 'ready'` transition, result stored in `milestones.content_hash` and sibling `content_hash` columns on each hashable entity.**

This is a hybrid (pure-function + derived column). The pure function is the canonicalizer + hasher; the column is the cached result. Trade-offs:

| Pattern | Pro | Con |
|---------|-----|-----|
| Compute on demand | No stale cache, always current | Every verification request re-reads all referenced rows, slow for milestones with 100+ items |
| Cached column only | Fast verification | Stale if someone mutates a referenced row after hashing |
| **Hybrid (this)** | Fast reads, single write event, immutability enforced by state transition | Requires state machine gate to prevent post-hash mutation |

**Immutability enforcement:** once a `milestone.status` goes to `ready` (or a `documentVersion.status` goes to `published`), service-layer mutations must refuse writes to linked rows. v0.1 already has an immutable-snapshot pattern on published versions (Phase 6). Extend the same pattern to milestone-member rows: a DB-level check constraint or a service-layer guard on every mutation.

**Pure function shape (`src/lib/hashing.ts`, NEW):**

```ts
import { createHash } from 'crypto'

// Canonical JSON: keys sorted lexically, no whitespace, ISO date strings.
export function canonicalize(value: unknown): string { /* ... */ }

export function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}

export async function computePolicyVersionHash(versionId: string): Promise<string> { /* ... */ }
export async function computeWorkshopHash(workshopId: string): Promise<string> { /* ... */ }
export async function computeEvidenceBundleHash(bundleId: string): Promise<string> { /* ... */ }
export async function computeMilestoneHash(milestoneId: string): Promise<{
  hash: string
  metadataJson: unknown          // the canonical object that was hashed (stored verbatim)
}> { /* ... */ }
```

Milestone hash includes the contentHash of each referenced version/workshop/bundle, not their raw payloads — a Merkle-tree-ish structure. This means mutating a workshop row after hashing breaks the milestone hash indirectly via the workshop hash. The state-machine gate prevents that.

### Where it's called

- `versionPublishedFn` (Inngest) computes + stores `documentVersions.content_hash` as step 1 of post-publish flow.
- `milestoneReadyFn` (Inngest) computes + stores `milestones.content_hash` as step 1 before Cardano anchoring.

**Never called synchronously from tRPC.** Hash computation reads many rows; blocking the request path for 500ms–2s to finalize a milestone is acceptable UX-wise as a "finalize" button action, but better placed in Inngest for retry durability and because the next step (Cardano anchoring) is long-running anyway.

---

## 7. Cardano Anchoring Execution Context

### Step boundaries inside `milestoneReadyFn`

Mesh SDK on Vercel serverless is viable because the function runs inside Inngest's durable executor, not Vercel's 10s request timeout. Each `step.run` has its own timeout (default 2 minutes, extendable). The submission flow breaks cleanly into multiple steps:

```ts
// src/inngest/functions/milestone/ready.ts
export const milestoneReadyFn = inngest.createFunction(
  { id: 'milestone-ready', retries: 5, triggers: [{ event: milestoneReadyEvent }] },
  async ({ event, step }) => {
    const { milestoneId } = event.data

    // STEP 1: compute hash + canonicalize metadata (pure, fast, memoized)
    const { hash, metadataJson } = await step.run('compute-hash', async () => {
      return computeMilestoneHash(milestoneId)
    })

    // STEP 2: persist hash BEFORE submitting tx (idempotency anchor — see below)
    await step.run('persist-hash', async () => {
      await db.update(milestones)
        .set({ contentHash: hash, metadataJson, status: 'anchoring' })
        .where(eq(milestones.id, milestoneId))
    })

    // STEP 3: build + sign + submit tx (Mesh SDK + Blockfrost)
    //         Signing is fast; submission is a network call that can take 10-30s.
    //         step.run memoizes the result so retry after a 500 from Blockfrost
    //         does NOT re-submit — it returns the cached txHash.
    const txHash = await step.run('submit-cardano-tx', async () => {
      return await submitMilestoneAnchor({
        metadataJson,   // attached as tx metadata, label 674 or similar
        contentHash: hash,
      })
    })

    await step.run('persist-tx-hash', async () => {
      await db.update(milestones)
        .set({ cardanoTxHash: txHash, cardanoNetwork: 'preview' })
        .where(eq(milestones.id, milestoneId))
    })

    // STEP 4: wait for confirmation (poll Blockfrost with step.sleep + step.run)
    //         NOT a single step — use step.sleep between polls so we don't burn budget.
    for (let i = 0; i < 20; i++) {
      await step.sleep(`wait-${i}`, '30s')
      const confirmed = await step.run(`check-confirm-${i}`, async () => {
        return await isTxConfirmed(txHash)
      })
      if (confirmed) break
    }

    // STEP 5: finalize
    await step.run('mark-anchored', async () => {
      await db.update(milestones)
        .set({ status: 'anchored', anchoredAt: new Date() })
        .where(eq(milestones.id, milestoneId))
    })
  },
)
```

### Retry semantics when Blockfrost is down

Inngest's `retries: 5` with exponential backoff handles transient Blockfrost outages. Each failed step re-runs from scratch — but **only the failed step**. Step 1 (`compute-hash`) is memoized, so retrying step 3 does NOT re-hash.

**If step 3 actually submits but Blockfrost returns a timeout before returning the txHash**, that's the dangerous case: the tx is on-chain but we think it failed. Two mitigations:

1. **Pre-compute and persist the hash before submission (step 2 above).** The content hash is fully deterministic — if the same milestoneId re-enters the function from a retry, `computeMilestoneHash` returns the same hash. We can then query Blockfrost for any tx whose metadata label contains that hash, and if found, skip submission and adopt that txHash.
2. **Blockfrost has `/metadata/txs/labels/:label` search.** Before submitting in step 3, check: "has any tx already been submitted with this exact content hash in its metadata?" If yes → return that txHash (idempotent). If no → submit.

### Idempotency key per milestone hash

Metadata label 674 (per CIP-20) carries the hash. Because the hash is deterministic per milestone content, submitting the same milestone twice produces the same tx metadata payload. The idempotency check is:

```ts
async function submitMilestoneAnchor({ metadataJson, contentHash }) {
  const existingTx = await blockfrost.searchByMetadata({ label: 674, key: 'content_hash', value: contentHash })
  if (existingTx) return existingTx.tx_hash  // already on-chain, idempotent
  // else build + sign + submit
}
```

This makes `step.run('submit-cardano-tx', ...)` truly idempotent: any number of retries converges on the same txHash.

### What NOT to do

- **Don't put Mesh SDK tx building in tRPC.** Synchronous API requests cannot wait 10-30s for Cardano submission. The milestone finalize button in the UI calls a tRPC mutation that emits `milestone.ready` and returns immediately; status is polled/subscribed separately.
- **Don't hash inside cardano-anchor.ts.** Hashing is a separate concern; the anchor function receives the already-computed hash. Keeps it testable without DB.
- **Don't skip the hash persistence between step 1 and step 3.** If the function is killed between "compute hash" and "submit tx", the persisted hash in step 2 is what lets the next retry detect "this milestone already has a computed hash, just re-enter the submit step with the same value."

---

## 8. Suggested Build Order

Dependency-safe sequencing, tagged with integration risks. Phase numbers match PROJECT.md `Active` section.

```
Phase 14  Collab rollback                    (PREREQ for everything — reduces type surface)
           └─ risk: none. Isolated removal.

Phase 15  Stale verification closeout        (fix existing bugs before stacking v0.2)
           └─ risk: Phase 9 auditor dashboard button — touches evidence export which Phase 16 replaces.
              Do Phase 15 FIRST so we're fixing real code, not about-to-be-deleted code.

Phase 16  Flow 5 smoke + notification migration
           └─ risk: HIGH. Migrating every createNotification().catch() callsite to Inngest is
              invasive (touches ~15 tRPC mutations). Must be done before any new Inngest
              function assumes notifications are async-only. Ship behind feature flag first.

Phase 17  Workshop lifecycle state machine   (PREREQ for cal.com webhook)
           └─ risk: MEDIUM. State machine must be in place before cal.com BOOKING_COMPLETED
              can transition workshops to 'completed'. If Phase 17 slips, Phase 20 blocks.

Phase 18  Workshop checklist nudge + recording→Groq transcription
           └─ risk: Groq API rate limits on Whisper. Build with retry budget.

Phase 19  Public /participate + Clerk invite + Turnstile
           └─ risk: HIGH. Clerk invitations API must work end-to-end (create user → send
              email → user accepts → user.created webhook arrives → users row reconciled)
              BEFORE the public form ships. Pre-test with manual invite flow.
              ALSO: Phase 19 needs the publicProcedure helper to exist — do that first.

Phase 20  Public /workshops + cal.com embed + webhook
           └─ risk: HIGH. Depends on Phase 17 (state machine) AND Phase 19 (Clerk invite).
              Cannot ship either piece independently. Webhook handler must be registered
              in cal.com dashboard before webhooks start flowing — operational dependency.

Phase 21  Public /research + /framework + LLM consultation summary
           └─ risk: LOW. Pure read surfaces + one new Inngest function (versionPublishedFn
              adds LLM summary step). Theme work is isolated.

Phase 22  Milestone entity + SHA256 hashing service
           └─ risk: MEDIUM. Schema migration adds nullable FK on 4 tables — safe.
              Hashing canonicalization MUST be deterministic; build with property tests.

Phase 23  Cardano anchoring (Mesh + Blockfrost)
           └─ risk: HIGH. Requires funded preview-net wallet. Blockfrost API key.
              Mesh SDK on Vercel serverless needs verification — has cold-start cost.
              Do the idempotency search BEFORE the first real submission.

Phase 24  Engagement tracking
           └─ risk: LOW. lastActivityAt column update goes in a tRPC middleware that
              runs on every mutation — MUST be added AFTER Phase 16 notification
              migration to avoid merge conflicts in trpc/init.ts.

Phase 25  Integration smoke                  (walks the full chain end-to-end)
           └─ risk: MEDIUM. Flakes in any upstream phase surface here.
              Requires all external deps wired: Clerk, cal.com, Groq, Blockfrost, R2.
```

### Critical path

```
14 → 15 → 16 → 17 ─┬─► 20 ─┐
                   │        │
               19 ─┴────────┤
                             └─► 25
  18 ────────────────────────────┤
  21 ────────────────────────────┤
  22 → 23 ──────────────────────┤
  24 ───────────────────────────┘
```

Phases 18, 21, 22–23, 24 can parallel-develop once their respective prereqs land.

### Integration risks to budget for

1. **Clerk invitations end-to-end** (Phase 19 blocker for Phase 20) — build a smoke script that creates an invite and waits for the webhook, BEFORE building the UI.
2. **Notification migration breadth** (Phase 16) — every `createNotification().catch()` callsite is a touchpoint. Count them first (feedback.ts confirmed to have at least 3 callsites at lines 343, 435, plus the already-migrated 398; expect similar density in changeRequest.ts and version.ts).
3. **Cal.com operational setup** (Phase 20) — webhook URL must be registered in cal.com's dashboard before testing. Needs staging environment with public URL.
4. **Cardano funded wallet** (Phase 23) — preview-net faucet provides test ADA but the wallet seed must be in Vercel env vars (NOT committed). Operational checklist item.
5. **Groq rate limits** (Phase 18, 21) — Whisper on recordings and llama-3.3-70b for summaries. Budget backoff into the Inngest functions.

---

## 9. Data Flow Changes (Inngest takes over notifications)

### Current state (v0.1)

`src/server/routers/feedback.ts` lines 343, 435: synchronous `createNotification(...).catch(console.error)` inside tRPC mutation handlers. Fire-and-forget, NOT awaited, errors silently logged.

```ts
// Phase 16 BEFORE:
const updated = await transitionFeedback(...)
createNotification({ userId, type, title, body, ... }).catch(console.error)
return updated
```

Except `feedback.decide` already uses the new pattern (line 398):

```ts
// Phase 16 TARGET (already done for decide):
const updated = await transitionFeedback(...)
await sendFeedbackReviewed({ feedbackId, decision, rationale, reviewedByUserId })
return updated
```

### v0.2 migration: all notifications flow through `notification.create` event

**NEW event** (`src/inngest/events.ts`):

```ts
const notificationCreateSchema = z.object({
  userId:     z.uuid(),
  type:       z.enum(NOTIFICATION_TYPES),
  title:      z.string().min(1).max(200),
  body:       z.string().min(1).max(2000),
  entityType: z.string(),
  entityId:   z.uuid(),
  linkHref:   z.string().optional(),
})

export const notificationCreateEvent = eventType('notification.create', { schema: notificationCreateSchema })
export async function sendNotificationCreate(data) { /* create + validate + send */ }
```

**NEW function** `src/inngest/functions/feedback/notification-dispatch.ts` (generic):

```ts
export const notificationDispatchFn = inngest.createFunction(
  { id: 'notification-dispatch', retries: 3, triggers: [{ event: notificationCreateEvent }] },
  async ({ event, step }) => {
    await step.run('insert-notification', async () => {
      await db.insert(notifications).values({ ...event.data })
    })
    // Optionally fan out to email if user has email preference set
    const email = await step.run('fetch-email', fetchUserEmail(event.data.userId))
    if (email) await step.run('send-email', sendGenericNotificationEmail(email, event.data))
  },
)
```

### Migration pattern (applied mechanically to every callsite)

```diff
- createNotification({ userId, type, title, body, entityType, entityId, linkHref }).catch(console.error)
+ await sendNotificationCreate({ userId, type, title, body, entityType, entityId, linkHref })
```

### Compat concerns (synchronous expectations)

**Q: Does any v0.1 code await createNotification and expect the notification row to be visible in the next read?**

Scanning `feedback.ts`: no. All existing callsites are `.catch(console.error)` fire-and-forget. The mutations return `updated` immediately; the notification is eventually consistent from the client's perspective.

**Q: Does any v0.1 UI poll for notifications right after a mutation?**

The notification bell (existing component per GRAPH_REPORT) uses TanStack Query. After a mutation invalidates the notifications query, the next fetch happens a beat later. Inngest latency (typically 50-200ms in production, up to a few seconds cold) is comparable to, and often faster than, the query invalidation round-trip. No user-perceivable change.

**Q: What if Inngest is slow and the user refreshes before the notification inserts?**

Acceptable degradation. The notification is durable (Inngest retries), so it WILL appear, just not instantly. For critical in-flow feedback ("your CR was merged"), the mutation response itself carries the success signal — the notification is an asynchronous echo, not the source of truth.

### Other data flows

- **Evidence pack export (Phase 16):** currently synchronous streaming in a Next.js route handler — slow, blocks Vercel function timeout. Migrates to Inngest `export-evidence-pack` event + function. tRPC mutation starts the job and returns a job ID; UI polls or subscribes for completion.
- **LLM consultation summary (Phase 21):** triggered by `version.published` event fired from the version publish mutation. The mutation returns immediately; the summary appears asynchronously in `documentVersions.consultationSummary`. UI shows "Generating summary..." placeholder until it arrives.
- **Cardano anchoring (Phase 23):** triggered by both `version.published` (per-version) AND `milestone.ready` (per-milestone). Same pattern: mutation returns fast, status column goes `anchoring → anchored`, UI polls.

---

## 10. File Catalog: New vs Modified

### NEW files

**Public tRPC surface:**
- `src/trpc/public-procedure.ts` — rate-limited, Turnstile-verified procedure helper
- `src/server/routers/public/index.ts` — publicRouter barrel
- `src/server/routers/public/participate.ts` — participate.submit mutation
- `src/server/routers/public/workshops.ts` — public workshop list + detail
- `src/server/routers/public/framework.ts` — public section status reads
- `src/lib/turnstile.ts` — Cloudflare Turnstile server verify
- `src/lib/rate-limit.ts` — IP-based rate limiter (likely Upstash or in-memory per-lambda)

**New tRPC routers:**
- `src/server/routers/milestone.ts` — milestone CRUD, slot-fill checks, finalize
- `src/server/routers/cardano.ts` — verified state reads, re-anchor trigger

**Webhooks:**
- `app/api/webhooks/_lib/verify-svix.ts` — extracted shared helper
- `app/api/webhooks/_lib/verify-calcom.ts` — HMAC-SHA256 verifier
- `app/api/webhooks/_lib/types.ts` — shared webhook types
- `app/api/webhooks/calcom/route.ts` — cal.com webhook handler

**Public pages:**
- `app/(public)/participate/page.tsx` — intake form
- `app/(public)/workshops/page.tsx` — workshop listing
- `app/(public)/workshops/[id]/register/page.tsx` — cal.com embed
- `app/(public)/research/page.tsx` — research content surface
- `app/(public)/framework/page.tsx` — framework draft-consultation surface

**Inngest events + functions (per §2 layout):**
- `src/inngest/functions/feedback/reviewed.ts` (moved from flat)
- `src/inngest/functions/feedback/notification-dispatch.ts`
- `src/inngest/functions/workshop/lifecycle.ts`
- `src/inngest/functions/workshop/reminders.ts`
- `src/inngest/functions/workshop/recording-processed.ts`
- `src/inngest/functions/workshop/checklist-nudge.ts`
- `src/inngest/functions/participate/intake.ts`
- `src/inngest/functions/calcom/booking-created.ts`
- `src/inngest/functions/calcom/booking-completed.ts`
- `src/inngest/functions/version/published.ts`
- `src/inngest/functions/milestone/ready.ts`
- `src/inngest/functions/export/evidence-pack.ts`
- `src/inngest/lib/workshop-reminder-copy.ts`
- `src/inngest/lib/groq-transcribe.ts`
- `src/inngest/lib/groq-summarize.ts`
- `src/inngest/lib/clerk-invite.ts`
- `src/inngest/lib/milestone-hash.ts`
- `src/inngest/lib/cardano-anchor.ts`

**Services:**
- `src/lib/hashing.ts` — canonicalize + sha256 + per-entity hash computers
- `src/lib/cardano/mesh-client.ts` — Mesh SDK wrapper (wallet, tx build, sign)
- `src/lib/cardano/blockfrost-client.ts` — Blockfrost REST wrapper
- `src/lib/groq/client.ts` — Groq API wrapper (whisper + llama)
- `src/lib/clerk/invitations.ts` — Clerk invitations API wrapper

**Schema:**
- `src/db/schema/milestones.ts` — milestones table + status enum
- `src/db/schema/workshopRegistrations.ts` — registration table (if not already in workshops.ts; review during Phase 20)
- Migration files: additive FK columns on 4 existing tables

### MODIFIED files

**tRPC composition:**
- `src/server/routers/_app.ts` — add `public`, `milestone`, `cardano` routers
- `src/trpc/init.ts` — add a `lastActivityMiddleware` used by protected mutations (Phase 24)

**Existing routers (notification migration, Phase 16):**
- `src/server/routers/feedback.ts` — replace `createNotification().catch()` with `sendNotificationCreate`
- `src/server/routers/changeRequest.ts` — same
- `src/server/routers/version.ts` — same; also emit `version.published` event
- `src/server/routers/notification.ts` — no change (read-only)
- `src/server/routers/workshop.ts` — add lifecycle transition mutations, emit workshop events
- `src/server/routers/evidence.ts` — emit `evidence.pack.export.requested`

**Inngest:**
- `src/inngest/client.ts` — no change
- `src/inngest/events.ts` — add ~12 new event definitions (following the documented template)
- `src/inngest/functions/index.ts` — append all new functions to the barrel array

**Schema (additive columns):**
- `src/db/schema/documents.ts` — add `milestoneId` FK + `contentHash` column on documentVersions, add `consultationSummary text` column
- `src/db/schema/workshops.ts` — add `milestoneId` FK, `contentHash`, `status` enum column, `calcomEventTypeId int`, `recordingUrl`, `transcript`, `summary`
- `src/db/schema/evidence.ts` — add `milestoneId` FK, `contentHash`
- `src/db/schema/feedback.ts` — add `milestoneId` FK
- `src/db/schema/users.ts` — add `lastActivityAt`, `engagementScore` (Phase 24)
- `src/db/schema/index.ts` — export new milestones table

**Webhooks:**
- `app/api/webhooks/clerk/route.ts` — refactor to import `verify-svix.ts` helper (no behavior change); optionally dispatch into Inngest for Phase 19 participate welcome email

**Middleware:**
- `proxy.ts` — add `/participate(.*)`, `/workshops(.*)`, `/research(.*)`, `/framework(.*)` to the public route matcher

### NOT touched

- Real-time collab files — being removed in Phase 14, don't modify
- Existing v0.1 section editor, CR workflow internals, traceability matrix — stable surfaces
- `src/db/schema/collaboration.ts` — being dropped in Phase 14

---

## Architectural Patterns Reinforced in v0.2

### Pattern 1: Event-sourced side effects via Inngest

**What:** tRPC mutation mutates exactly one entity in one transaction, then emits a domain event. All downstream side effects (notifications, emails, auto-drafts, hash computation, cardano anchoring) live in Inngest functions triggered by the event.

**Why:** retries, memoization, observability, durability. Vercel serverless CANNOT do long-running background work in the request path — Inngest is the only sanctioned off-ramp.

**Trade-off:** slight eventual consistency (notifications appear 50-200ms late). Acceptable for this domain.

### Pattern 2: Idempotency via deterministic keys

**What:** every side effect that talks to an external system uses a deterministic key for idempotency.
- Cal.com: `bookingId` unique constraint
- Clerk invite: `emailAddress + role` upsert
- Cardano: metadata-label search for `contentHash` before submission
- Hashing: content hash itself is deterministic, so re-running is safe

**Why:** webhooks retry, Inngest retries, users double-click. Every path must be idempotent or we corrupt state.

### Pattern 3: State-machine-gated immutability

**What:** once an entity enters a "finalized" state (version.published, milestone.ready, feedback.closed), service-layer mutations refuse to write to it or its referenced rows.

**Why:** hash-based verification (Phase 22/23) only works if the hashed content cannot change post-hash. v0.1 already enforces this for documentVersions; extend the same pattern to milestones and workshop-recordings-frozen-for-milestone.

---

## Anti-Patterns (explicit "don't do this")

### Anti-Pattern 1: Public procedures mixed with protected in the same router file

**What people do:** add an `intake` mutation to `feedbackRouter` using `publicProcedure` because it's "about feedback."
**Why wrong:** one refactor away from accidentally inheriting `requirePermission` middleware. Public/protected must be filesystem-separated.
**Instead:** `src/server/routers/public/participate.ts` uses the dedicated `publicProcedure` helper with Turnstile + rate limit.

### Anti-Pattern 2: Synchronous Cardano tx submission from tRPC

**What people do:** call Mesh SDK directly inside a mutation handler, user waits 20 seconds.
**Why wrong:** Vercel function timeout is 10s (hobby) / 60s (pro); submission can take longer than the soft timeout; retry story is hand-coded; zero idempotency.
**Instead:** mutation emits `milestone.ready`, returns `{ status: 'anchoring' }`. Inngest function handles submission with proper retries + idempotency.

### Anti-Pattern 3: Many-to-many milestone membership

**What people do:** `milestone_members` join table linking milestones to all entity types polymorphically.
**Why wrong:** hash semantics become ambiguous ("which milestone is this workshop's hash part of?"), Postgres can't enforce polymorphic FKs cleanly, queries are slower.
**Instead:** single nullable `milestoneId` FK on each entity type. One entity → zero or one milestones.

### Anti-Pattern 4: Recomputing hashes on every verification read

**What people do:** `/portal/verified-state` endpoint re-canonicalizes + re-hashes on every request.
**Why wrong:** O(N) reads per public page load, unpredictable latency, blocks under load.
**Instead:** hash is computed once by `milestoneReadyFn` and stored in `milestones.content_hash`. Verification just reads the stored value.

### Anti-Pattern 5: Storing `contentHash` without a state-machine gate

**What people do:** add `contentHash` column, compute on publish, let anyone mutate linked rows afterward.
**Why wrong:** stored hash becomes a lie; Cardano-anchored content silently drifts from the hash.
**Instead:** couple the column with a `status` state that refuses mutations after finalization.

---

## Integration Points

### External services

| Service | Integration | Gotchas |
|---------|-------------|---------|
| Clerk | Auth + invitations API via @clerk/nextjs/server | Invitation flow has two steps: create invite (returns ticket) + listen for user.created webhook. Don't assume `users` row exists immediately after invite POST. |
| Cal.com | Webhook-only integration; embed on public page | HMAC-SHA256 verify over raw body; no built-in replay protection → dedupe by bookingId. |
| Groq | Direct inference (not compound-beta) | Rate limits vary by model; whisper-large-v3-turbo has per-minute audio limits. Always retry with backoff. |
| Blockfrost | REST API key in env | Preview-net base URL differs from mainnet; easy misconfiguration. Rate limits are per-project. |
| Mesh SDK | Cardano tx building in Node (not browser) | Cold-start cost on Vercel serverless — first call is slow. Inngest is the right home because duration doesn't matter. |
| R2 | Presigned upload URLs (existing) | Already working; extend for evidence pack ZIP and workshop recording download. forcePathStyle + CRC workaround already in place. |

### Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| tRPC ↔ Inngest | `inngest.send()` via typed `send*()` helpers | Never call `inngest.send()` directly — registry pattern enforces validation |
| Inngest ↔ DB | `db` from `@/src/db` inside `step.run` | Memoized on retry; never call outside step.run from a function |
| Inngest ↔ external APIs | Service wrappers in `src/lib/*` imported from functions | Keeps functions declarative, wrappers testable in isolation |
| Webhooks → Inngest | Route handler verifies, then calls `send*()` helper | Route handlers do NO DB work beyond dedupe keys |
| Public tRPC ↔ protected tRPC | No direct boundary — composed in `appRouter` | `ctx.user: null` in public contexts enforces separation via types |

---

## Sources

- Direct read of `src/trpc/init.ts`, `src/server/routers/_app.ts`, `src/server/routers/feedback.ts`
- Direct read of `src/inngest/client.ts`, `events.ts`, `functions/index.ts`, `functions/feedback-reviewed.ts`, `lib/create-draft-cr.ts`
- Direct read of `app/api/webhooks/clerk/route.ts`, `proxy.ts`
- Direct read of `src/db/schema/workshops.ts`, `src/db/schema/index.ts`
- `.planning/PROJECT.md` v0.2 milestone definition, Active requirements list, Key Decisions
- Inngest v4 durable-execution model (step.run memoization, NonRetriableError, retries config) — referenced in existing feedback-reviewed.ts inline docs
- CIP-20 (Cardano transaction metadata label conventions) for anchoring label choice
- Cal.com webhook documentation (HMAC-SHA256 signature header `X-Cal-Signature-256`, BOOKING_CREATED / BOOKING_COMPLETED / BOOKING_CANCELLED events)
- Svix webhooks (Clerk's signature provider) documentation

---
*Architecture research for: PolicyDash v0.2 integration into existing Next.js 16 + tRPC v11 + Drizzle + Inngest + Clerk app*
*Researched: 2026-04-13*
*Confidence: HIGH — grounded in direct source reads of the existing app; no unverified framework claims*
